import type { CityJsonDocument, CityObject, JsonValue } from '../types';
import {
  deriveEditableRoadDraftFromAreas,
  type RoadArea,
  type RoadBand,
  type RoadDraft,
  type RoadLaneMovement,
  type RoadMovementStatus,
  type RoadMovementTurn,
  type RoadSectionDraft,
} from './transportation';

export interface ImportedMovementOptions {
  /** Endpoint clusters without an explicit osm2streets junction are joined within this radius. */
  geometryJunctionRadiusM?: number;
}

interface RoadApproach {
  roadId: string;
  identifiers: Set<string>;
  areas: RoadArea[];
  draft: RoadDraft;
}

interface ApproachEndpoint {
  section: RoadSectionDraft;
  endpoint: 'start' | 'end';
  position: [number, number];
}

interface ImportedJunction {
  id: string;
  center: [number, number];
  connectedIds: Set<string>;
}

const DEFAULT_GEOMETRY_JUNCTION_RADIUS_M = 12;

/**
 * Derive editable lane-movement proposals for one active imported road.
 * Explicit osm2streets junction membership wins; a small deterministic
 * endpoint cluster is the fallback for older fixtures that only retained lane
 * polygons and split centerlines.
 */
export function deriveImportedRoadMovements(
  roadAreas: RoadArea[],
  activeDraft: RoadDraft,
  options: ImportedMovementOptions = {}
): RoadLaneMovement[] {
  if (!activeDraft.id) return activeDraft.movements ?? [];
  const approaches = buildRoadApproaches(roadAreas, activeDraft);
  const active = approaches.get(activeDraft.id);
  if (!active) return activeDraft.movements ?? [];
  const junctions = buildImportedJunctions(roadAreas);
  const geometryRadius = options.geometryJunctionRadiusM ?? DEFAULT_GEOMETRY_JUNCTION_RADIUS_M;
  const proposals: RoadLaneMovement[] = [];

  for (const sourceEndpoint of endpointsForDraft(activeDraft)) {
    const incoming = connectableBands(sourceEndpoint.section).filter(({ band }) =>
      roadBandCanArriveAtEndpoint(band, sourceEndpoint.endpoint)
    );
    if (incoming.length === 0) continue;

    const explicit = nearestExplicitJunction(active, sourceEndpoint, junctions);
    const activeJunctionEndpoint = explicit ? nearestEndpoint(activeDraft, explicit.center) : null;
    if (activeJunctionEndpoint && endpointKey(activeJunctionEndpoint) !== endpointKey(sourceEndpoint)) {
      continue;
    }

    for (const target of approaches.values()) {
      if (target.roadId === active.roadId) continue;
      if (
        explicit &&
        !setsOverlap(target.identifiers, explicit.connectedIds)
      ) {
        continue;
      }
      const targetEndpoint = explicit
        ? nearestEndpoint(target.draft, explicit.center)
        : nearestEndpoint(target.draft, sourceEndpoint.position);
      if (!targetEndpoint) continue;
      const endpointDistance = approximateDistanceMeters(
        sourceEndpoint.position,
        targetEndpoint.position
      );
      if (!explicit && endpointDistance > geometryRadius) continue;

      const outgoing = connectableBands(targetEndpoint.section).filter(({ band }) =>
        roadBandCanDepartFromEndpoint(band, targetEndpoint.endpoint)
      );
      if (outgoing.length === 0) continue;
      const junctionId = explicit?.id ?? geometryJunctionId(
        sourceEndpoint.position,
        targetEndpoint.position
      );
      const provenance = explicit
        ? 'osm2streets' as const
        : active.areas.some((area) => String(area.attributes.source).toLowerCase() === 'osm2streets')
          ? 'osm2streets' as const
          : activeDraft.source === 'osm'
            ? 'osm' as const
            : 'geometry' as const;
      const pairs = compatibleRoadBandPairs(incoming, outgoing);
      for (const pair of pairs) {
        const turn = classifyRoadMovementTurn(
          sourceEndpoint.section,
          sourceEndpoint.endpoint,
          targetEndpoint.section,
          targetEndpoint.endpoint,
          pair.mode,
          approachesShareOsmWay(active, target)
        );
        const allowedTurns = allowedTurnsForBand(active.areas, pair.source.band, pair.source.index);
        if (allowedTurns && !turnIsAllowed(turn, allowedTurns)) continue;
        const movement: RoadLaneMovement = {
          id: movementId({
            junctionId,
            sourceRoadId: active.roadId,
            sourceSectionId: sourceEndpoint.section.id,
            sourceEndpoint: sourceEndpoint.endpoint,
            sourceBandId: pair.source.band.id,
            sourceBandIndex: pair.source.index,
            targetRoadId: target.roadId,
            targetSectionId: targetEndpoint.section.id,
            targetEndpoint: targetEndpoint.endpoint,
            targetBandId: pair.target.band.id,
            targetBandIndex: pair.target.index,
            mode: pair.mode,
          }),
          junctionId,
          sourceRoadId: active.roadId,
          sourceSectionId: sourceEndpoint.section.id,
          sourceEndpoint: sourceEndpoint.endpoint,
          ...(pair.source.band.id ? { sourceBandId: pair.source.band.id } : {}),
          sourceBandIndex: pair.source.index,
          sourceDirection: roadBandDirection(pair.source.band),
          targetRoadId: target.roadId,
          targetSectionId: targetEndpoint.section.id,
          targetEndpoint: targetEndpoint.endpoint,
          ...(pair.target.band.id ? { targetBandId: pair.target.band.id } : {}),
          targetBandIndex: pair.target.index,
          targetDirection: roadBandDirection(pair.target.band),
          sourceMode: pair.mode,
          targetMode: pair.mode,
          turn,
          status: 'proposed',
          provenance,
          semanticEvidence: !!explicit || !!allowedTurns,
        };
        proposals.push(movement);
      }
    }
  }

  const persisted = [
    ...(activeDraft.movements ?? []),
    ...persistedMovementsFromAreas(active.areas),
  ];
  return mergeRoadMovementDecisions(proposals, persisted);
}

export function mergeRoadMovementDecisions(
  proposals: RoadLaneMovement[],
  persisted: RoadLaneMovement[]
): RoadLaneMovement[] {
  const decisions = new Map(
    persisted
      .filter((movement) => movement.status !== 'proposed')
      .map((movement) => [movement.id, movement] as const)
  );
  const merged = new Map<string, RoadLaneMovement>();
  for (const proposal of proposals) {
    const decision = decisions.get(proposal.id);
    merged.set(proposal.id, decision ? { ...proposal, status: decision.status } : proposal);
  }
  // Preserve decisions whose source data is temporarily outside the loaded
  // viewport. Rejected proposals therefore stay suppressed after reload.
  for (const decision of decisions.values()) {
    if (!merged.has(decision.id)) merged.set(decision.id, decision);
  }
  return [...merged.values()].sort(compareMovements);
}

export function updateRoadMovementStatus(
  draft: RoadDraft,
  movementIdValue: string,
  status: RoadMovementStatus
): RoadDraft {
  return {
    ...draft,
    userVerified: true,
    movements: (draft.movements ?? []).map((movement) =>
      movement.id === movementIdValue ? { ...movement, status } : movement
    ),
  };
}

export interface ManualRoadLaneTarget {
  roadId: string;
  section: RoadSectionDraft;
  endpoint: 'start' | 'end';
  bandIndex: number;
}

/**
 * Confirm one deliberate incoming-lane to outgoing-lane movement. Manual
 * connectors are movements, not road-end snaps: adding a turn must never
 * move the source road's centreline or silently connect every adjacent lane.
 */
export function connectManualRoadLaneMovement(
  draft: RoadDraft,
  sourceSectionId: string,
  sourceEndpoint: 'start' | 'end',
  sourceBandIndex: number,
  target: ManualRoadLaneTarget
): RoadDraft {
  const sourceSection = draft.sections.find((section) => section.id === sourceSectionId);
  const sourceBand = sourceSection?.bands[sourceBandIndex];
  const targetBand = target.section.bands[target.bandIndex];
  if (
    !sourceSection ||
    !sourceBand ||
    !targetBand ||
    !roadBandCanArriveAtEndpoint(sourceBand, sourceEndpoint) ||
    !roadBandCanDepartFromEndpoint(targetBand, target.endpoint)
  ) {
    return draft;
  }

  const targetModes = new Set(roadBandModes(targetBand));
  const mode = roadBandModes(sourceBand).find((candidate) => targetModes.has(candidate));
  if (!mode) return draft;

  const sourceRoadId = draft.id ?? 'draft';
  const sourcePosition = endpointPosition(sourceSection, sourceEndpoint);
  const targetPosition = endpointPosition(target.section, target.endpoint);
  const junctionId = `manual:${geometryJunctionId(sourcePosition, targetPosition)}`;
  const id = movementId({
    junctionId,
    sourceRoadId,
    sourceSectionId,
    sourceEndpoint,
    sourceBandId: sourceBand.id,
    sourceBandIndex,
    targetRoadId: target.roadId,
    targetSectionId: target.section.id,
    targetEndpoint: target.endpoint,
    targetBandId: targetBand.id,
    targetBandIndex: target.bandIndex,
    mode,
  });
  const movement: RoadLaneMovement = {
    id,
    junctionId,
    sourceRoadId,
    sourceSectionId,
    sourceEndpoint,
    ...(sourceBand.id ? { sourceBandId: sourceBand.id } : {}),
    sourceBandIndex,
    sourceDirection: roadBandDirection(sourceBand),
    targetRoadId: target.roadId,
    targetSectionId: target.section.id,
    targetEndpoint: target.endpoint,
    ...(targetBand.id ? { targetBandId: targetBand.id } : {}),
    targetBandIndex: target.bandIndex,
    targetDirection: roadBandDirection(targetBand),
    sourceMode: mode,
    targetMode: mode,
    turn: classifyRoadMovementTurn(
      sourceSection,
      sourceEndpoint,
      target.section,
      target.endpoint,
      mode,
      sourceRoadId === target.roadId
    ),
    status: 'confirmed',
    provenance: 'manual',
    semanticEvidence: true,
  };

  return {
    ...draft,
    userVerified: true,
    movements: [
      ...(draft.movements ?? []).filter((candidate) => candidate.id !== id),
      movement,
    ].sort(compareMovements),
  };
}

export function removeRoadMovement(draft: RoadDraft, movementIdValue: string): RoadDraft {
  return {
    ...draft,
    userVerified: true,
    movements: (draft.movements ?? []).filter(
      (movement) => movement.id !== movementIdValue
    ),
  };
}

/**
 * Store only explicit decisions on both participant Road objects. Exact lane
 * polygons and their vertices are intentionally untouched.
 */
export function synchronizeRoadMovementMetadata(
  doc: CityJsonDocument,
  sourceRoadId: string,
  draft: RoadDraft
): string[] {
  const sourceAliases = new Set([sourceRoadId, draft.id, 'draft'].filter(Boolean));
  const decisions = (draft.movements ?? [])
    .filter(
      (movement) =>
        sourceAliases.has(movement.sourceRoadId) && movement.status !== 'proposed'
    )
    .map((movement) => ({
      ...movement,
      sourceRoadId,
      targetRoadId: sourceAliases.has(movement.targetRoadId)
        ? sourceRoadId
        : movement.targetRoadId,
    }));
  const affected = new Set<string>([sourceRoadId]);
  for (const movement of decisions) affected.add(movement.targetRoadId);

  // Remove stale decisions made by this source road before writing the latest
  // list. Decisions sourced by other roads remain intact.
  for (const [roadId, object] of Object.entries(doc.CityObjects)) {
    if (object.type !== 'Road') continue;
    const retained = readRoadMovementsFromCityObject(object).filter(
      (movement) => movement.sourceRoadId !== sourceRoadId
    );
    const additions = decisions.filter(
      (movement) => roadId === sourceRoadId || movement.targetRoadId === roadId
    );
    if (additions.length === 0 && retained.length === readRoadMovementsFromCityObject(object).length) {
      continue;
    }
    object.attributes = {
      ...(object.attributes ?? {}),
      _roadMovements: [...retained, ...additions] as unknown as JsonValue,
      _updatedAt: new Date().toISOString(),
    };
    affected.add(roadId);
  }
  return [...affected].filter((roadId) => roadId !== sourceRoadId);
}

export function readRoadMovementsFromCityObject(object: CityObject): RoadLaneMovement[] {
  const value = object.attributes?._roadMovements;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const movement = readRoadMovement(entry);
    return movement ? [movement] : [];
  });
}

export function removeRoadMovementReferences(
  doc: CityJsonDocument,
  roadId: string
): string[] {
  const changed = new Set<string>();
  for (const [candidateId, object] of Object.entries(doc.CityObjects)) {
    if (object.type !== 'Road' || candidateId === roadId) continue;
    const before = readRoadMovementsFromCityObject(object);
    const after = before.filter(
      (movement) => movement.sourceRoadId !== roadId && movement.targetRoadId !== roadId
    );
    if (after.length === before.length) continue;
    object.attributes = {
      ...(object.attributes ?? {}),
      _roadMovements: after as unknown as JsonValue,
      _updatedAt: new Date().toISOString(),
    };
    const layout = object.attributes?._roadLayout as Record<string, unknown> | undefined;
    if (layout && Array.isArray(layout.movements)) {
      layout.movements = layout.movements.filter((entry) => {
        const movement = readRoadMovement(entry);
        return !movement || (movement.sourceRoadId !== roadId && movement.targetRoadId !== roadId);
      });
    }
    changed.add(candidateId);
  }
  return [...changed];
}

export function roadBandModes(band: RoadBand): string[] {
  const raw = band.allowedModes?.length
    ? band.allowedModes
    : band.kind === 'bike_lane'
      ? ['bicycle']
      : band.kind === 'sidewalk'
        ? ['pedestrian']
        : band.kind === 'car_lane'
          ? ['car']
          : [];
  return [...new Set(raw.map(normalizeRoadMode).filter(Boolean))];
}

export function isRoadBandConnectable(band: RoadBand): boolean {
  return !['median', 'green', 'parking'].includes(band.kind) && roadBandModes(band).length > 0;
}

export function roadBandCanArriveAtEndpoint(
  band: RoadBand,
  endpoint: 'start' | 'end'
): boolean {
  if (!isRoadBandConnectable(band)) return false;
  const direction = roadBandDirection(band);
  return direction === 'both' || direction === 'none' ||
    (direction === 'forward' && endpoint === 'end') ||
    (direction === 'backward' && endpoint === 'start');
}

export function roadBandCanDepartFromEndpoint(
  band: RoadBand,
  endpoint: 'start' | 'end'
): boolean {
  if (!isRoadBandConnectable(band)) return false;
  const direction = roadBandDirection(band);
  return direction === 'both' || direction === 'none' ||
    (direction === 'forward' && endpoint === 'start') ||
    (direction === 'backward' && endpoint === 'end');
}

export function roadBandDirection(band: RoadBand): NonNullable<RoadBand['direction']> {
  return band.direction ?? (band.kind === 'sidewalk' ? 'none' : 'forward');
}

export function compatibleRoadBandPairs(
  source: Array<{ band: RoadBand; index: number }>,
  target: Array<{ band: RoadBand; index: number }>
): Array<{
  source: { band: RoadBand; index: number };
  target: { band: RoadBand; index: number };
  mode: string;
}> {
  const result: Array<{
    source: { band: RoadBand; index: number };
    target: { band: RoadBand; index: number };
    mode: string;
  }> = [];
  const sourceByMode = groupBandsByMode(source);
  const targetByMode = groupBandsByMode(target);
  for (const [mode, sourceBands] of sourceByMode) {
    const targetBands = targetByMode.get(mode) ?? [];
    if (targetBands.length === 0) continue;
    sourceBands.forEach((sourceBand, ordinal) => {
      const targetOrdinal = sourceBands.length <= 1
        ? Math.floor((targetBands.length - 1) / 2)
        : Math.round((ordinal / (sourceBands.length - 1)) * (targetBands.length - 1));
      const targetBand = targetBands[targetOrdinal];
      if (targetBand) result.push({ source: sourceBand, target: targetBand, mode });
    });
  }
  return result;
}

function buildRoadApproaches(
  roadAreas: RoadArea[],
  activeDraft: RoadDraft
): Map<string, RoadApproach> {
  const groups = new Map<string, RoadArea[]>();
  for (const area of roadAreas) {
    if (isIntersectionArea(area)) continue;
    const current = groups.get(area.roadId) ?? [];
    current.push(area);
    groups.set(area.roadId, current);
  }
  const result = new Map<string, RoadApproach>();
  for (const [roadId, areas] of groups) {
    let draft: RoadDraft;
    try {
      draft = roadId === activeDraft.id
        ? activeDraft
        : areas.find((area) => area.editableDraft)?.editableDraft ??
          deriveEditableRoadDraftFromAreas(areas, roadId);
    } catch {
      continue;
    }
    result.set(roadId, {
      roadId,
      identifiers: roadIdentifiers(roadId, areas),
      areas,
      draft,
    });
  }
  return result;
}

function buildImportedJunctions(roadAreas: RoadArea[]): ImportedJunction[] {
  const grouped = new Map<string, RoadArea[]>();
  for (const area of roadAreas) {
    if (!isIntersectionArea(area)) continue;
    const current = grouped.get(area.roadId) ?? [];
    current.push(area);
    grouped.set(area.roadId, current);
  }
  return [...grouped.entries()].flatMap(([roadId, areas]) => {
    const connected = new Set<string>();
    for (const area of areas) {
      for (const id of arrayValues(area.attributes.connectedRoadIds)) connected.add(String(id));
    }
    if (connected.size < 2) return [];
    const points = areas.flatMap((area) => area.polygon.slice(0, -1));
    if (points.length === 0) return [];
    return [{
      id: String(areas[0].attributes.osm2streetsIntersectionId ?? roadId),
      center: [
        points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length,
      ],
      connectedIds: connected,
    }];
  });
}

function nearestExplicitJunction(
  active: RoadApproach,
  endpoint: ApproachEndpoint,
  junctions: ImportedJunction[]
): ImportedJunction | null {
  return junctions
    .filter((junction) => setsOverlap(active.identifiers, junction.connectedIds))
    .map((junction) => ({
      junction,
      distance: approximateDistanceMeters(endpoint.position, junction.center),
    }))
    .sort((a, b) => a.distance - b.distance || a.junction.id.localeCompare(b.junction.id))[0]
    ?.junction ?? null;
}

function endpointsForDraft(draft: RoadDraft): ApproachEndpoint[] {
  return draft.sections.flatMap((section) => {
    const start = section.centerlineWgs84[0];
    const end = section.centerlineWgs84.at(-1);
    return [
      ...(start ? [{ section, endpoint: 'start' as const, position: start }] : []),
      ...(end ? [{ section, endpoint: 'end' as const, position: end }] : []),
    ];
  });
}

function endpointPosition(
  section: RoadSectionDraft,
  endpoint: 'start' | 'end'
): [number, number] {
  return endpoint === 'start'
    ? section.centerlineWgs84[0]
    : section.centerlineWgs84[section.centerlineWgs84.length - 1];
}

function nearestEndpoint(draft: RoadDraft, point: [number, number]): ApproachEndpoint | null {
  return endpointsForDraft(draft)
    .map((endpoint) => ({ endpoint, distance: approximateDistanceMeters(endpoint.position, point) }))
    .sort((a, b) => a.distance - b.distance || endpointKey(a.endpoint).localeCompare(endpointKey(b.endpoint)))[0]
    ?.endpoint ?? null;
}

function connectableBands(section: RoadSectionDraft): Array<{ band: RoadBand; index: number }> {
  return section.bands
    .map((band, index) => ({ band, index }))
    .filter(({ band }) => isRoadBandConnectable(band));
}

function groupBandsByMode(
  bands: Array<{ band: RoadBand; index: number }>
): Map<string, Array<{ band: RoadBand; index: number }>> {
  const result = new Map<string, Array<{ band: RoadBand; index: number }>>();
  for (const entry of bands) {
    for (const mode of roadBandModes(entry.band)) {
      const group = result.get(mode) ?? [];
      group.push(entry);
      result.set(mode, group);
    }
  }
  return result;
}

function classifyRoadMovementTurn(
  source: RoadSectionDraft,
  sourceEndpoint: 'start' | 'end',
  target: RoadSectionDraft,
  targetEndpoint: 'start' | 'end',
  mode: string,
  sameOsmWay: boolean
): RoadMovementTurn {
  if (mode === 'pedestrian' && !sameOsmWay) return 'crossing';
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
  const line = section.centerlineWgs84;
  const endpointPoint = endpoint === 'start' ? line[0] : line[line.length - 1];
  const innerPoint = endpoint === 'start' ? line[1] : line[line.length - 2];
  const vector = incoming
    ? localVectorMeters(innerPoint, endpointPoint)
    : localVectorMeters(endpointPoint, innerPoint);
  const length = Math.hypot(vector[0], vector[1]);
  return length > 1e-6 ? [vector[0] / length, vector[1] / length] : [1, 0];
}

function allowedTurnsForBand(
  areas: RoadArea[],
  band: RoadBand,
  bandIndex: number
): Set<string> | null {
  const area = areas.find((candidate) =>
    (band.id && candidate.bandId === band.id) ||
    Number(candidate.attributes.osm2streetsLaneIndex) === bandIndex
  );
  const raw = area?.attributes.osm2streetsPropertiesJson;
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw) as { allowed_turns?: unknown };
    if (!Array.isArray(value.allowed_turns) || value.allowed_turns.length === 0) return null;
    return new Set(value.allowed_turns.map((turn) => String(turn).toLowerCase()));
  } catch {
    return null;
  }
}

function turnIsAllowed(turn: RoadMovementTurn, allowed: Set<string>): boolean {
  const aliases: Record<RoadMovementTurn, string[]> = {
    through: ['through', 'straight'],
    left: ['left', 'slight_left', 'sharp_left'],
    right: ['right', 'slight_right', 'sharp_right'],
    uturn: ['uturn', 'u_turn', 'reverse'],
    crossing: ['crossing', 'through', 'straight'],
  };
  return aliases[turn].some((alias) => allowed.has(alias));
}

function persistedMovementsFromAreas(areas: RoadArea[]): RoadLaneMovement[] {
  const seen = new Set<string>();
  const result: RoadLaneMovement[] = [];
  for (const area of areas) {
    const value = area.attributes.roadMovements;
    if (!Array.isArray(value)) continue;
    for (const raw of value) {
      const movement = readRoadMovement(raw);
      if (!movement || seen.has(movement.id)) continue;
      seen.add(movement.id);
      result.push(movement);
    }
  }
  return result;
}

function readRoadMovement(value: unknown): RoadLaneMovement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const statuses: RoadMovementStatus[] = ['proposed', 'confirmed', 'rejected'];
  const turns: RoadMovementTurn[] = ['through', 'left', 'right', 'uturn', 'crossing'];
  const endpoints = ['start', 'end'];
  const sourceBandIndex = Number(record.sourceBandIndex);
  const targetBandIndex = Number(record.targetBandIndex);
  if (
    typeof record.id !== 'string' || !record.id ||
    typeof record.junctionId !== 'string' || !record.junctionId ||
    typeof record.sourceRoadId !== 'string' || !record.sourceRoadId ||
    typeof record.sourceSectionId !== 'string' || !record.sourceSectionId ||
    !endpoints.includes(String(record.sourceEndpoint)) ||
    !Number.isInteger(sourceBandIndex) || sourceBandIndex < 0 ||
    typeof record.targetRoadId !== 'string' || !record.targetRoadId ||
    typeof record.targetSectionId !== 'string' || !record.targetSectionId ||
    !endpoints.includes(String(record.targetEndpoint)) ||
    !Number.isInteger(targetBandIndex) || targetBandIndex < 0 ||
    typeof record.sourceMode !== 'string' || !record.sourceMode ||
    typeof record.targetMode !== 'string' || !record.targetMode ||
    !turns.includes(record.turn as RoadMovementTurn) ||
    !statuses.includes(record.status as RoadMovementStatus)
  ) return null;
  const provenance = ['osm2streets', 'osm', 'geometry', 'manual'].includes(String(record.provenance))
    ? record.provenance as RoadLaneMovement['provenance']
    : 'geometry';
  return {
    id: record.id,
    junctionId: record.junctionId,
    sourceRoadId: record.sourceRoadId,
    sourceSectionId: record.sourceSectionId,
    sourceEndpoint: record.sourceEndpoint as 'start' | 'end',
    ...(typeof record.sourceBandId === 'string' ? { sourceBandId: record.sourceBandId } : {}),
    sourceBandIndex,
    ...(['forward', 'backward', 'both', 'none'].includes(String(record.sourceDirection))
      ? { sourceDirection: record.sourceDirection as RoadLaneMovement['sourceDirection'] }
      : {}),
    targetRoadId: record.targetRoadId,
    targetSectionId: record.targetSectionId,
    targetEndpoint: record.targetEndpoint as 'start' | 'end',
    ...(typeof record.targetBandId === 'string' ? { targetBandId: record.targetBandId } : {}),
    targetBandIndex,
    ...(['forward', 'backward', 'both', 'none'].includes(String(record.targetDirection))
      ? { targetDirection: record.targetDirection as RoadLaneMovement['targetDirection'] }
      : {}),
    sourceMode: record.sourceMode,
    targetMode: record.targetMode,
    turn: record.turn as RoadMovementTurn,
    status: record.status as RoadMovementStatus,
    provenance,
    semanticEvidence: record.semanticEvidence === true,
  };
}

function movementId(value: {
  junctionId: string;
  sourceRoadId: string;
  sourceSectionId: string;
  sourceEndpoint: 'start' | 'end';
  sourceBandId?: string;
  sourceBandIndex: number;
  targetRoadId: string;
  targetSectionId: string;
  targetEndpoint: 'start' | 'end';
  targetBandId?: string;
  targetBandIndex: number;
  mode: string;
}): string {
  return [
    value.junctionId,
    value.sourceRoadId,
    value.sourceSectionId,
    value.sourceEndpoint,
    value.sourceBandId ?? value.sourceBandIndex,
    value.targetRoadId,
    value.targetSectionId,
    value.targetEndpoint,
    value.targetBandId ?? value.targetBandIndex,
    value.mode,
  ].join('::');
}

function roadIdentifiers(roadId: string, areas: RoadArea[]): Set<string> {
  const result = new Set<string>([roadId]);
  for (const area of areas) {
    const osm2streetsId = area.attributes.osm2streetsRoadId;
    if (typeof osm2streetsId === 'string' || typeof osm2streetsId === 'number') {
      result.add(String(osm2streetsId));
    }
  }
  return result;
}

function approachesShareOsmWay(a: RoadApproach, b: RoadApproach): boolean {
  const aWays = new Set(a.areas.flatMap((area) => arrayValues(area.attributes.osmWayIds).map(String)));
  return b.areas.some((area) =>
    arrayValues(area.attributes.osmWayIds).some((id) => aWays.has(String(id)))
  );
}

function isIntersectionArea(area: RoadArea): boolean {
  return String(area.function).toLowerCase() === 'intersection' ||
    String(area.attributes.transportationUsage ?? '').toLowerCase() === 'intersection';
}

function normalizeRoadMode(value: string): string {
  const mode = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (mode.includes('bicy') || mode.includes('cycle')) return 'bicycle';
  if (mode.includes('pedestrian') || mode.includes('foot') || mode === 'walk') return 'pedestrian';
  if (mode.includes('bus') || mode.includes('transit') || mode === 'psv') return 'bus';
  if (mode.includes('tram') || mode.includes('rail')) return 'rail';
  if (mode.includes('car') || mode.includes('motor') || mode === 'vehicle') return 'car';
  return mode;
}

function geometryJunctionId(a: [number, number], b: [number, number]): string {
  const lng = ((a[0] + b[0]) / 2).toFixed(6);
  const lat = ((a[1] + b[1]) / 2).toFixed(6);
  return `geometry:${lng}:${lat}`;
}

function endpointKey(endpoint: ApproachEndpoint): string {
  return `${endpoint.section.id}:${endpoint.endpoint}`;
}

function setsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

function arrayValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
}

function compareMovements(a: RoadLaneMovement, b: RoadLaneMovement): number {
  return a.junctionId.localeCompare(b.junctionId) ||
    a.sourceSectionId.localeCompare(b.sourceSectionId) ||
    a.sourceEndpoint.localeCompare(b.sourceEndpoint) ||
    a.sourceBandIndex - b.sourceBandIndex ||
    a.targetRoadId.localeCompare(b.targetRoadId) ||
    a.targetBandIndex - b.targetBandIndex;
}

function approximateDistanceMeters(a: [number, number], b: [number, number]): number {
  const latitude = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const dx = (b[0] - a[0]) * 111_320 * Math.max(0.2, Math.cos(latitude));
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}

function localVectorMeters(a: [number, number], b: [number, number]): [number, number] {
  const latitude = ((a[1] + b[1]) / 2) * Math.PI / 180;
  return [
    (b[0] - a[0]) * 111_320 * Math.max(0.2, Math.cos(latitude)),
    (b[1] - a[1]) * 110_540,
  ];
}
