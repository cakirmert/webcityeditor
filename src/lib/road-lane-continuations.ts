import { buildLaneConnectorSurface } from './road-connection-surfaces';
import {
  deriveEditableRoadDraftFromAreas,
  sampleRoadSectionCenterlineWgs84,
  type RoadArea,
  type RoadBand,
  type RoadBandKind,
  type RoadDirection,
  type RoadDraft,
  type RoadSectionDraft,
} from './transportation';

export type RoadLaneContinuationTurn = 'through' | 'left' | 'right' | 'uturn';

export interface RoadLaneContinuation {
  id: string;
  sourceRoadId: string;
  targetRoadId: string;
  sourceSectionId: string;
  targetSectionId: string;
  sourceEndpoint: 'start' | 'end';
  targetEndpoint: 'start' | 'end';
  sourceBandIndex: number;
  targetBandIndex: number;
  sourceKind: RoadBandKind;
  sourceType?: string;
  mode: string;
  turn: RoadLaneContinuationTurn;
  path: [number, number][];
  polygon: [number, number][];
  sourceWidthM: number;
  targetWidthM: number;
}

interface IndexedBand {
  band: RoadBand;
  index: number;
}

interface LanePoint {
  position: [number, number];
  tangent: [number, number];
}

export interface RoadConnectionNode {
  id: string;
  position: [number, number];
  roadIds: string[];
  junctionAreaIds: string[];
  kind: 'junction' | 'confirmed';
}

interface RoadConnectionJunction {
  id: string;
  roadId: string;
  areaIds: string[];
  position: [number, number];
  externalRoadIds: string[];
  roadIds: string[];
}

export interface RoadConnectionIndex {
  areas: RoadArea[];
  areaById: Map<string, RoadArea>;
  areasByRoadId: Map<string, RoadArea[]>;
  editableDraftsByRoadId: Map<string, RoadDraft>;
  junctions: RoadConnectionJunction[];
}

export interface SelectedRoadConnections {
  focusRoadId: string | null;
  roadIds: Set<string>;
  junctionAreaIds: Set<string>;
  nodes: RoadConnectionNode[];
  continuations: RoadLaneContinuation[];
}

const APPROACH_LENGTH_M = 8;
const ACTIVE_DRAFT_ROAD_ID = '__road_preview__';

/**
 * Build render-only lane continuations for confirmed editable CityJSON road
 * endpoint joins. CityJSON layouts remain authoritative and no road geometry
 * is mutated.
 */
export function buildConfirmedRoadLaneContinuations(
  areas: RoadArea[],
  activeDraft: RoadDraft | null = null
): RoadLaneContinuation[] {
  const index = buildRoadConnectionIndex(areas);
  const draftCache = new Map(index.editableDraftsByRoadId);
  const activeRoadId = activeDraftIdentity(activeDraft);
  if (activeDraft && activeRoadId) draftCache.set(activeRoadId, activeDraft);
  return buildConfirmedRoadLaneContinuationsFromIndex(index, activeDraft, draftCache);
}

/**
 * Build the selection-driven road network shown on the map. Exact imported
 * osm2streets roads are connected through their junction metadata, while
 * explicit editor joins remain authoritative for manually connected roads.
 */
export function buildSelectedRoadConnections(
  index: RoadConnectionIndex,
  selectedAreaId: string | null,
  activeDraft: RoadDraft | null = null
): SelectedRoadConnections {
  const selectedArea = selectedAreaId ? index.areaById.get(selectedAreaId) : undefined;
  const selectedJunctionRoadId =
    selectedArea && isIntersectionArea(selectedArea) ? selectedArea.roadId : null;
  const focusRoadId =
    activeDraftIdentity(activeDraft) ??
    (selectedArea && !isIntersectionArea(selectedArea) ? selectedArea.roadId : null);
  if (!focusRoadId && !selectedJunctionRoadId) return emptySelectedRoadConnections();

  const selectedJunctions = selectedJunctionRoadId
    ? index.junctions.filter((junction) => junction.roadId === selectedJunctionRoadId)
    : index.junctions.filter((junction) => junction.roadIds.includes(focusRoadId!));
  const roadIds = new Set<string>();
  if (focusRoadId) roadIds.add(focusRoadId);
  for (const junction of selectedJunctions) {
    for (const roadId of junction.roadIds) roadIds.add(roadId);
  }

  const draftCache = new Map(index.editableDraftsByRoadId);
  if (activeDraft && focusRoadId) draftCache.set(focusRoadId, activeDraft);
  const confirmedNodes = collectConfirmedConnectionNodes(
    index,
    draftCache,
    activeDraft,
    focusRoadId,
    roadIds
  );
  for (const node of confirmedNodes) {
    for (const roadId of node.roadIds) roadIds.add(roadId);
  }

  const junctionAreaIds = new Set(
    selectedJunctions.flatMap((junction) => junction.areaIds)
  );
  const junctionNodes: RoadConnectionNode[] = selectedJunctions.map((junction) => ({
    id: `junction-node:${junction.id}`,
    position: junction.position,
    roadIds: [...junction.roadIds].sort(),
    junctionAreaIds: [...junction.areaIds],
    kind: 'junction',
  }));
  const inferred = buildJunctionRoadLaneContinuations(
    index,
    selectedJunctions,
    activeDraft,
    draftCache
  );
  const confirmed = buildConfirmedRoadLaneContinuationsFromIndex(
    index,
    activeDraft,
    draftCache
  ).filter((continuation) =>
    focusRoadId
      ? continuation.sourceRoadId === focusRoadId ||
        continuation.targetRoadId === focusRoadId
      : roadIds.has(continuation.sourceRoadId) &&
        roadIds.has(continuation.targetRoadId)
  );

  return {
    focusRoadId,
    roadIds,
    junctionAreaIds,
    nodes: dedupeConnectionNodes([...junctionNodes, ...confirmedNodes]),
    continuations: dedupeContinuations([...inferred, ...confirmed]),
  };
}

export function buildRoadConnectionIndex(areas: RoadArea[]): RoadConnectionIndex {
  const areaById = new Map<string, RoadArea>();
  const areasByRoadId = new Map<string, RoadArea[]>();
  const editableDraftsByRoadId = new Map<string, RoadDraft>();
  const cityRoadIdsByExternalId = new Map<string, Set<string>>();

  for (const area of areas) {
    areaById.set(area.id, area);
    const roadAreas = areasByRoadId.get(area.roadId) ?? [];
    roadAreas.push(area);
    areasByRoadId.set(area.roadId, roadAreas);
    if (area.editableDraft && !editableDraftsByRoadId.has(area.roadId)) {
      editableDraftsByRoadId.set(area.roadId, area.editableDraft);
    }
    if (!isIntersectionArea(area)) {
      const externalRoadId = normalizeExternalId(area.attributes.osm2streetsRoadId);
      if (externalRoadId) {
        const cityRoadIds = cityRoadIdsByExternalId.get(externalRoadId) ?? new Set();
        cityRoadIds.add(area.roadId);
        cityRoadIdsByExternalId.set(externalRoadId, cityRoadIds);
      }
    }
  }

  const junctions: RoadConnectionJunction[] = [];
  for (const [roadId, roadAreas] of areasByRoadId) {
    const junctionAreas = roadAreas.filter(isIntersectionArea);
    if (junctionAreas.length === 0) continue;
    const externalRoadIds = [
      ...new Set(
        junctionAreas.flatMap((area) =>
          normalizeExternalIds(area.attributes.connectedRoadIds)
        )
      ),
    ];
    const connectedCityRoadIds = new Set<string>();
    for (const externalRoadId of externalRoadIds) {
      for (const cityRoadId of cityRoadIdsByExternalId.get(externalRoadId) ?? []) {
        connectedCityRoadIds.add(cityRoadId);
      }
    }
    junctions.push({
      id: roadId,
      roadId,
      areaIds: junctionAreas.map((area) => area.id),
      position: polygonGroupCenter(junctionAreas),
      externalRoadIds,
      roadIds: [...connectedCityRoadIds].sort(),
    });
  }

  return {
    areas,
    areaById,
    areasByRoadId,
    editableDraftsByRoadId,
    junctions,
  };
}

function buildConfirmedRoadLaneContinuationsFromIndex(
  index: RoadConnectionIndex,
  activeDraft: RoadDraft | null,
  draftCache: Map<string, RoadDraft>
): RoadLaneContinuation[] {
  const drafts = new Map(index.editableDraftsByRoadId);
  const activeRoadId = activeDraftIdentity(activeDraft);
  if (activeDraft && activeRoadId) drafts.set(activeRoadId, activeDraft);
  const continuations: RoadLaneContinuation[] = [];
  const seen = new Set<string>();

  for (const [sourceRoadId, sourceDraft] of drafts) {
    for (const sourceSection of sourceDraft.sections) {
      for (const sourceEndpoint of ['start', 'end'] as const) {
        const connection = sourceSection.connections?.[sourceEndpoint];
        if (
          !connection?.confirmed ||
          (connection.target !== 'cityjson' && connection.target !== 'draft') ||
          !connection.targetSectionId ||
          (connection.targetEndpoint !== 'start' && connection.targetEndpoint !== 'end')
        ) {
          continue;
        }

        const targetEndpoint = connection.targetEndpoint;
        const targetRoadId =
          connection.target === 'draft' ? sourceRoadId : connection.targetId;
        const targetDraft = resolveRoadDraft(
          index,
          targetRoadId,
          activeDraft,
          draftCache
        );
        const targetSection = targetDraft?.sections.find(
          (section) => section.id === connection.targetSectionId
        );
        if (!targetSection) continue;

        appendLanePairContinuations({
          idPrefix: 'lane-continuation',
          sourceRoadId,
          sourceSection,
          sourceEndpoint,
          targetRoadId,
          targetSection,
          targetEndpoint,
          continuations,
          seen,
        });
      }
    }
  }

  return continuations.sort((a, b) => a.id.localeCompare(b.id));
}

function buildJunctionRoadLaneContinuations(
  index: RoadConnectionIndex,
  junctions: RoadConnectionJunction[],
  activeDraft: RoadDraft | null,
  draftCache: Map<string, RoadDraft>
): RoadLaneContinuation[] {
  const continuations: RoadLaneContinuation[] = [];
  const seen = new Set<string>();

  for (const junction of junctions) {
    const approaches = junction.roadIds
      .map((roadId) => {
        const draft = resolveRoadDraft(index, roadId, activeDraft, draftCache);
        const endpoint = draft
          ? closestDraftEndpoint(draft, junction.position)
          : null;
        return endpoint ? { roadId, ...endpoint } : null;
      })
      .filter(
        (
          approach
        ): approach is {
          roadId: string;
          section: RoadSectionDraft;
          endpoint: 'start' | 'end';
        } => !!approach
      );

    for (const source of approaches) {
      for (const target of approaches) {
        if (source.roadId === target.roadId) continue;
        appendLanePairContinuations({
          idPrefix: `junction-continuation:${junction.id}`,
          sourceRoadId: source.roadId,
          sourceSection: source.section,
          sourceEndpoint: source.endpoint,
          targetRoadId: target.roadId,
          targetSection: target.section,
          targetEndpoint: target.endpoint,
          continuations,
          seen,
        });
      }
    }
  }

  return continuations.sort((a, b) => a.id.localeCompare(b.id));
}

function appendLanePairContinuations({
  idPrefix,
  sourceRoadId,
  sourceSection,
  sourceEndpoint,
  targetRoadId,
  targetSection,
  targetEndpoint,
  continuations,
  seen,
}: {
  idPrefix: string;
  sourceRoadId: string;
  sourceSection: RoadSectionDraft;
  sourceEndpoint: 'start' | 'end';
  targetRoadId: string;
  targetSection: RoadSectionDraft;
  targetEndpoint: 'start' | 'end';
  continuations: RoadLaneContinuation[];
  seen: Set<string>;
}): void {
  const sourceBands = indexedBands(sourceSection).filter(({ band }) =>
    bandCanArriveAtEndpoint(band, sourceEndpoint)
  );
  const rawTargetBands = indexedBands(targetSection).filter(({ band }) =>
    bandCanDepartFromEndpoint(band, targetEndpoint)
  );
  const targetBands =
    sourceEndpoint === targetEndpoint
      ? [...rawTargetBands].reverse()
      : rawTargetBands;

  for (const pair of compatibleBandPairs(sourceBands, targetBands)) {
    const sourceRef = laneRef(
      sourceRoadId,
      sourceSection.id,
      sourceEndpoint,
      pair.source.index
    );
    const targetRef = laneRef(
      targetRoadId,
      targetSection.id,
      targetEndpoint,
      pair.target.index
    );
    const dedupeKey =
      sourceRef < targetRef
        ? `${sourceRef}|${targetRef}|${pair.mode}`
        : `${targetRef}|${sourceRef}|${pair.mode}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const path = movementPath(
      sourceSection,
      sourceEndpoint,
      pair.source.index,
      targetSection,
      targetEndpoint,
      pair.target.index
    );
    const polygon = buildLaneConnectorSurface({
      path,
      sourceWidthM: pair.source.band.widthM,
      targetWidthM: pair.target.band.widthM,
    });
    if (path.length < 2 || polygon.length < 4) continue;

    continuations.push({
      id: `${idPrefix}:${dedupeKey}`,
      sourceRoadId,
      targetRoadId,
      sourceSectionId: sourceSection.id,
      targetSectionId: targetSection.id,
      sourceEndpoint,
      targetEndpoint,
      sourceBandIndex: pair.source.index,
      targetBandIndex: pair.target.index,
      sourceKind: pair.source.band.kind,
      ...(pair.source.band.sourceType
        ? { sourceType: pair.source.band.sourceType }
        : {}),
      mode: pair.mode,
      turn: classifyTurn(
        sourceSection,
        sourceEndpoint,
        targetSection,
        targetEndpoint
      ),
      path,
      polygon,
      sourceWidthM: pair.source.band.widthM,
      targetWidthM: pair.target.band.widthM,
    });
  }
}

function resolveRoadDraft(
  index: RoadConnectionIndex,
  roadId: string,
  activeDraft: RoadDraft | null,
  draftCache: Map<string, RoadDraft>
): RoadDraft | null {
  if (activeDraft && activeDraftIdentity(activeDraft) === roadId) return activeDraft;
  const cached = draftCache.get(roadId);
  if (cached) return cached;
  const roadAreas = index.areasByRoadId
    .get(roadId)
    ?.filter((area) => !isIntersectionArea(area));
  if (!roadAreas?.length) return null;
  try {
    const derived = deriveEditableRoadDraftFromAreas(roadAreas, roadId);
    draftCache.set(roadId, derived);
    return derived;
  } catch {
    return null;
  }
}

function closestDraftEndpoint(
  draft: RoadDraft,
  position: [number, number]
): { section: RoadSectionDraft; endpoint: 'start' | 'end' } | null {
  let closest:
    | {
        section: RoadSectionDraft;
        endpoint: 'start' | 'end';
        distance: number;
      }
    | null = null;
  for (const section of draft.sections) {
    const line = sampleRoadSectionCenterlineWgs84(section);
    if (line.length < 2) continue;
    for (const endpoint of ['start', 'end'] as const) {
      const point = endpoint === 'start' ? line[0] : line[line.length - 1];
      const distance = approximateDistanceMeters(point, position);
      if (!closest || distance < closest.distance) {
        closest = { section, endpoint, distance };
      }
    }
  }
  return closest
    ? { section: closest.section, endpoint: closest.endpoint }
    : null;
}

function collectConfirmedConnectionNodes(
  index: RoadConnectionIndex,
  draftCache: Map<string, RoadDraft>,
  activeDraft: RoadDraft | null,
  focusRoadId: string | null,
  selectedRoadIds: Set<string>
): RoadConnectionNode[] {
  const sourceDrafts = new Map(index.editableDraftsByRoadId);
  const activeRoadId = activeDraftIdentity(activeDraft);
  if (activeDraft && activeRoadId) sourceDrafts.set(activeRoadId, activeDraft);
  const nodes: RoadConnectionNode[] = [];

  for (const [sourceRoadId, sourceDraft] of sourceDrafts) {
    for (const section of sourceDraft.sections) {
      for (const endpoint of ['start', 'end'] as const) {
        const connection = section.connections?.[endpoint];
        if (
          !connection?.confirmed ||
          (connection.target !== 'cityjson' && connection.target !== 'draft')
        ) {
          continue;
        }
        const targetRoadId =
          connection.target === 'draft' ? sourceRoadId : connection.targetId;
        const relevant = focusRoadId
          ? sourceRoadId === focusRoadId || targetRoadId === focusRoadId
          : selectedRoadIds.has(sourceRoadId) &&
            selectedRoadIds.has(targetRoadId);
        if (!relevant) continue;
        if (
          !Number.isFinite(connection.positionWgs84[0]) ||
          !Number.isFinite(connection.positionWgs84[1])
        ) {
          continue;
        }
        resolveRoadDraft(index, targetRoadId, activeDraft, draftCache);
        nodes.push({
          id: `confirmed-node:${sourceRoadId}:${section.id}:${endpoint}`,
          position: [...connection.positionWgs84],
          roadIds: [...new Set([sourceRoadId, targetRoadId])].sort(),
          junctionAreaIds: [],
          kind: 'confirmed',
        });
      }
    }
  }
  return nodes;
}

function dedupeContinuations(
  continuations: RoadLaneContinuation[]
): RoadLaneContinuation[] {
  const byLanePair = new Map<string, RoadLaneContinuation>();
  for (const continuation of continuations) {
    const sourceRef = laneRef(
      continuation.sourceRoadId,
      continuation.sourceSectionId,
      continuation.sourceEndpoint,
      continuation.sourceBandIndex
    );
    const targetRef = laneRef(
      continuation.targetRoadId,
      continuation.targetSectionId,
      continuation.targetEndpoint,
      continuation.targetBandIndex
    );
    const key =
      sourceRef < targetRef
        ? `${sourceRef}|${targetRef}|${continuation.mode}`
        : `${targetRef}|${sourceRef}|${continuation.mode}`;
    byLanePair.set(key, continuation);
  }
  return [...byLanePair.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function dedupeConnectionNodes(nodes: RoadConnectionNode[]): RoadConnectionNode[] {
  const byPosition = new Map<string, RoadConnectionNode>();
  for (const node of nodes) {
    const key = `${node.position[0].toFixed(6)}:${node.position[1].toFixed(6)}`;
    const current = byPosition.get(key);
    if (!current) {
      byPosition.set(key, node);
      continue;
    }
    byPosition.set(key, {
      ...current,
      id: current.kind === 'junction' ? current.id : node.id,
      kind:
        current.kind === 'junction' || node.kind === 'junction'
          ? 'junction'
          : 'confirmed',
      roadIds: [...new Set([...current.roadIds, ...node.roadIds])].sort(),
      junctionAreaIds: [
        ...new Set([...current.junctionAreaIds, ...node.junctionAreaIds]),
      ],
    });
  }
  return [...byPosition.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function emptySelectedRoadConnections(): SelectedRoadConnections {
  return {
    focusRoadId: null,
    roadIds: new Set(),
    junctionAreaIds: new Set(),
    nodes: [],
    continuations: [],
  };
}

function activeDraftIdentity(draft: RoadDraft | null): string | null {
  return draft ? draft.id ?? ACTIVE_DRAFT_ROAD_ID : null;
}

function isIntersectionArea(area: RoadArea): boolean {
  return String(
    area.attributes.transportationUsage ?? area.function
  ).toLowerCase() === 'intersection';
}

function normalizeExternalIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(normalizeExternalId)
        .filter((candidate): candidate is string => !!candidate)
    : [];
}

function normalizeExternalId(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : null;
}

function polygonGroupCenter(areas: RoadArea[]): [number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const area of areas) {
    for (const [lng, lat] of area.polygon) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return Number.isFinite(minLng) &&
    Number.isFinite(minLat) &&
    Number.isFinite(maxLng) &&
    Number.isFinite(maxLat)
    ? [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
    : [0, 0];
}

function indexedBands(section: RoadSectionDraft): IndexedBand[] {
  return section.bands.map((band, index) => ({ band, index }));
}

function compatibleBandPairs(
  source: IndexedBand[],
  target: IndexedBand[]
): Array<{ source: IndexedBand; target: IndexedBand; mode: string }> {
  const result: Array<{ source: IndexedBand; target: IndexedBand; mode: string }> = [];
  const sourceByMode = groupBandsByMode(source);
  const targetByMode = groupBandsByMode(target);
  const paired = new Set<string>();

  for (const [mode, sourceBands] of sourceByMode) {
    const targetBands = targetByMode.get(mode) ?? [];
    if (targetBands.length === 0) continue;
    sourceBands.forEach((sourceBand, ordinal) => {
      const targetOrdinal =
        sourceBands.length <= 1
          ? Math.floor((targetBands.length - 1) / 2)
          : Math.round((ordinal / (sourceBands.length - 1)) * (targetBands.length - 1));
      const targetBand = targetBands[targetOrdinal];
      const key = `${sourceBand.index}:${targetBand?.index}:${mode}`;
      if (!targetBand || paired.has(key)) return;
      paired.add(key);
      result.push({ source: sourceBand, target: targetBand, mode });
    });
  }
  return result;
}

function groupBandsByMode(bands: IndexedBand[]): Map<string, IndexedBand[]> {
  const result = new Map<string, IndexedBand[]>();
  for (const entry of bands) {
    for (const mode of bandModes(entry.band)) {
      const group = result.get(mode) ?? [];
      group.push(entry);
      result.set(mode, group);
    }
  }
  return result;
}

function bandModes(band: RoadBand): string[] {
  const raw = band.allowedModes?.length
    ? band.allowedModes
    : band.kind === 'bike_lane'
      ? ['bicycle']
      : band.kind === 'sidewalk'
        ? ['pedestrian']
        : band.kind === 'car_lane'
          ? ['car']
          : [];
  return [...new Set(raw.map(normalizeMode).filter(Boolean))];
}

function bandCanArriveAtEndpoint(
  band: RoadBand,
  endpoint: 'start' | 'end'
): boolean {
  if (!isConnectableBand(band)) return false;
  const direction = bandDirection(band);
  return (
    direction === 'both' ||
    direction === 'none' ||
    (direction === 'forward' && endpoint === 'end') ||
    (direction === 'backward' && endpoint === 'start')
  );
}

function bandCanDepartFromEndpoint(
  band: RoadBand,
  endpoint: 'start' | 'end'
): boolean {
  if (!isConnectableBand(band)) return false;
  const direction = bandDirection(band);
  return (
    direction === 'both' ||
    direction === 'none' ||
    (direction === 'forward' && endpoint === 'start') ||
    (direction === 'backward' && endpoint === 'end')
  );
}

function isConnectableBand(band: RoadBand): boolean {
  return (
    !['median', 'green', 'parking'].includes(band.kind) &&
    bandModes(band).length > 0
  );
}

function bandDirection(band: RoadBand): RoadDirection {
  return band.direction ?? (band.kind === 'sidewalk' ? 'none' : 'forward');
}

function classifyTurn(
  source: RoadSectionDraft,
  sourceEndpoint: 'start' | 'end',
  target: RoadSectionDraft,
  targetEndpoint: 'start' | 'end'
): RoadLaneContinuationTurn {
  const incoming = endpointTravelVector(source, sourceEndpoint, true);
  const outgoing = endpointTravelVector(target, targetEndpoint, false);
  const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
  const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
  if (dot < -0.72) return 'uturn';
  if (dot > 0.72) return 'through';
  return cross > 0 ? 'left' : 'right';
}

function endpointTravelVector(
  section: RoadSectionDraft,
  endpoint: 'start' | 'end',
  incoming: boolean
): [number, number] {
  const line = sampleRoadSectionCenterlineWgs84(section);
  if (line.length < 2) return [1, 0];
  const endpointPoint = endpoint === 'start' ? line[0] : line[line.length - 1];
  const innerPoint = endpoint === 'start' ? line[1] : line[line.length - 2];
  const vector = incoming
    ? localVectorMeters(innerPoint, endpointPoint)
    : localVectorMeters(endpointPoint, innerPoint);
  return normalizeVector(vector);
}

function movementPath(
  source: RoadSectionDraft,
  sourceEndpoint: 'start' | 'end',
  sourceBandIndex: number,
  target: RoadSectionDraft,
  targetEndpoint: 'start' | 'end',
  targetBandIndex: number
): [number, number][] {
  const sourceStart = lanePoint(source, sourceBandIndex, sourceEndpoint, APPROACH_LENGTH_M);
  const sourceEdge = lanePoint(source, sourceBandIndex, sourceEndpoint, 0);
  const targetEdge = lanePoint(target, targetBandIndex, targetEndpoint, 0);
  const targetEnd = lanePoint(target, targetBandIndex, targetEndpoint, APPROACH_LENGTH_M);
  if (!sourceStart || !sourceEdge || !targetEdge || !targetEnd) return [];

  const startTangent = normalizeVector(
    localVectorMeters(sourceStart.position, sourceEdge.position)
  );
  const endTangent = normalizeVector(
    localVectorMeters(targetEdge.position, targetEnd.position)
  );
  const distance = approximateDistanceMeters(sourceStart.position, targetEnd.position);
  const controlDistance = Math.max(2, Math.min(10, distance / 3));
  const controlA = offsetMeters(sourceStart.position, startTangent, controlDistance);
  const controlB = offsetMeters(targetEnd.position, endTangent, -controlDistance);
  const path: [number, number][] = [];
  for (let index = 0; index <= 12; index += 1) {
    path.push(
      cubicBezier(
        sourceStart.position,
        controlA,
        controlB,
        targetEnd.position,
        index / 12
      )
    );
  }
  return path;
}

function lanePoint(
  section: RoadSectionDraft,
  bandIndex: number,
  endpoint: 'start' | 'end',
  inwardDistanceM: number
): LanePoint | null {
  const line = sampleRoadSectionCenterlineWgs84(section);
  const sample = pointFromEndpoint(line, endpoint, inwardDistanceM);
  const band = section.bands[bandIndex];
  if (!sample || !band) return null;
  const totalWidth = section.bands.reduce((sum, candidate) => sum + candidate.widthM, 0);
  const precedingWidth = section.bands
    .slice(0, bandIndex)
    .reduce((sum, candidate) => sum + candidate.widthM, 0);
  const leftOffset = totalWidth / 2 - precedingWidth - band.widthM / 2;
  const normal: [number, number] = [-sample.tangent[1], sample.tangent[0]];
  return {
    position: offsetMeters(sample.position, normal, leftOffset),
    tangent: sample.tangent,
  };
}

function pointFromEndpoint(
  line: [number, number][],
  endpoint: 'start' | 'end',
  distanceM: number
): LanePoint | null {
  if (line.length < 2) return null;
  const indices =
    endpoint === 'start'
      ? Array.from({ length: line.length - 1 }, (_, index) => index)
      : Array.from({ length: line.length - 1 }, (_, index) => line.length - 2 - index);
  let remaining = Math.max(0, distanceM);
  for (const index of indices) {
    const a = line[index];
    const b = line[index + 1];
    const length = approximateDistanceMeters(a, b);
    if (length <= 1e-6) continue;
    const tangent = normalizeVector(localVectorMeters(a, b));
    if (remaining <= length) {
      const fraction =
        endpoint === 'start' ? remaining / length : 1 - remaining / length;
      return {
        position: [
          a[0] + (b[0] - a[0]) * fraction,
          a[1] + (b[1] - a[1]) * fraction,
        ],
        tangent,
      };
    }
    remaining -= length;
  }
  const fallbackIndex = endpoint === 'start' ? line.length - 2 : 0;
  return {
    position: endpoint === 'start' ? [...line[line.length - 1]] : [...line[0]],
    tangent: normalizeVector(localVectorMeters(line[fallbackIndex], line[fallbackIndex + 1])),
  };
}

function cubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  fraction: number
): [number, number] {
  const inverse = 1 - fraction;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * fraction;
  const c = 3 * inverse * fraction * fraction;
  const d = fraction * fraction * fraction;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

function offsetMeters(
  position: [number, number],
  direction: [number, number],
  distanceM: number
): [number, number] {
  const metresPerLng =
    111_320 * Math.max(0.2, Math.cos((position[1] * Math.PI) / 180));
  return [
    position[0] + (direction[0] * distanceM) / metresPerLng,
    position[1] + (direction[1] * distanceM) / 110_540,
  ];
}

function localVectorMeters(
  a: [number, number],
  b: [number, number]
): [number, number] {
  const latitude = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  return [
    (b[0] - a[0]) * 111_320 * Math.max(0.2, Math.cos(latitude)),
    (b[1] - a[1]) * 110_540,
  ];
}

function approximateDistanceMeters(
  a: [number, number],
  b: [number, number]
): number {
  const vector = localVectorMeters(a, b);
  return Math.hypot(vector[0], vector[1]);
}

function normalizeVector(vector: [number, number]): [number, number] {
  const length = Math.hypot(vector[0], vector[1]);
  return length > 1e-8 ? [vector[0] / length, vector[1] / length] : [1, 0];
}

function normalizeMode(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['motorvehicle', 'vehicle', 'driving'].includes(normalized)) return 'car';
  if (['bike', 'cycling'].includes(normalized)) return 'bicycle';
  if (['foot', 'walking'].includes(normalized)) return 'pedestrian';
  return normalized;
}

function laneRef(
  roadId: string,
  sectionId: string,
  endpoint: 'start' | 'end',
  bandIndex: number
): string {
  return `${roadId}:${sectionId}:${endpoint}:${bandIndex}`;
}
