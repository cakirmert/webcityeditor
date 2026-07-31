import { buildLaneConnectorSurface } from './road-connection-surfaces';
import {
  deriveEditableRoadDraftFromAreas,
  roadAllowedTurnsPermitMovement,
  sampleRoadSectionCenterlineWgs84,
  type RoadArea,
  type RoadAllowedTurn,
  type RoadBand,
  type RoadBandKind,
  type RoadDirection,
  type RoadDraft,
  type RoadIntersectionTurn,
  type RoadLaneMovementDecision,
  type RoadLaneMovementReference,
  type RoadSectionDraft,
} from './transportation';

export type RoadLaneContinuationTurn = RoadIntersectionTurn;

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
  sourceBandId?: string;
  targetBandId?: string;
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
  /** Authoritative directed CityJSON road pairs; undefined is legacy/unknown. */
  allowedRoadMovements?: Set<string>;
  roadEndpoints?: Record<string, 'start' | 'end'>;
}

interface JunctionApproach {
  roadId: string;
  section: RoadSectionDraft;
  endpoint: 'start' | 'end';
  distanceM: number;
}

interface JunctionSourceBandAllocation {
  sourceBandIndices: Set<number>;
  targetBandAnchor?: number;
}

interface SourceSeamEndpoint {
  ref: string;
  roadId: string;
  sourceNamespace: string;
  endpoint: 'start' | 'end';
  position: [number, number];
  inwardTangent: [number, number];
}

interface SourceSeamCandidate {
  key: string;
  left: SourceSeamEndpoint;
  right: SourceSeamEndpoint;
  distanceM: number;
  externalRoadIds: Set<string>;
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
const MAX_JUNCTION_APPROACH_DISTANCE_M = 120;
const MAX_SOURCE_SEAM_REFERENCE_DISTANCE_M = 0.5;
const MAX_SOURCE_SEAM_INWARD_DOT = -0.8;
const SOURCE_SEAM_AMBIGUITY_DISTANCE_M = 0.05;

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
  return applyRoadLaneMovementDecisions(
    buildConfirmedRoadLaneContinuationsFromIndex(index, activeDraft, draftCache),
    draftCache.values()
  );
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
    continuations: applyRoadLaneMovementDecisions(
      dedupeContinuations([...inferred, ...confirmed]),
      draftCache.values()
    ),
  };
}

export function applyRoadLaneMovementDecisions(
  continuations: RoadLaneContinuation[],
  drafts: Iterable<RoadDraft>
): RoadLaneContinuation[] {
  const rejected = [...drafts]
    .flatMap((draft) => draft.laneMovementDecisions ?? [])
    .filter((decision) => decision.status === 'rejected');
  if (rejected.length === 0) return continuations;
  return continuations.filter(
    (continuation) =>
      !rejected.some((decision) =>
        roadLaneMovementDecisionMatchesContinuation(decision, continuation)
      )
  );
}

/**
 * Add reviewable metadata for imported junction movements when an exact road
 * is first opened in the editor. Existing user decisions remain authoritative;
 * re-opening the road does not duplicate or reset them.
 */
export function addImportedRoadLaneMovementProposals(
  areas: RoadArea[],
  roadId: string,
  draft: RoadDraft
): RoadDraft {
  const index = buildRoadConnectionIndex(areas);
  const proposals = buildSelectedRoadConnections(index, null, draft).continuations
    .filter(
      (continuation) =>
        continuation.sourceRoadId === roadId &&
        continuation.id.startsWith('junction-continuation:') &&
        !!continuation.sourceBandId &&
        !!continuation.targetBandId
    )
    .map(
      (continuation): RoadLaneMovementDecision => ({
        id: `imported:${continuation.id}`,
        status: 'proposed',
        source: {
          roadId: continuation.sourceRoadId,
          sectionId: continuation.sourceSectionId,
          endpoint: continuation.sourceEndpoint,
          bandId: continuation.sourceBandId!,
        },
        target: {
          roadId: continuation.targetRoadId,
          sectionId: continuation.targetSectionId,
          endpoint: continuation.targetEndpoint,
          bandId: continuation.targetBandId!,
        },
        mode: continuation.mode,
        provenance: { source: 'osm2streets' },
      })
    );
  if (proposals.length === 0) return draft;

  const existing = draft.laneMovementDecisions ?? [];
  const additions = proposals.filter(
    (proposal) =>
      !existing.some((decision) =>
        laneMovementDecisionsMatch(decision, proposal)
      )
  );
  if (additions.length === 0) return draft;

  return {
    ...draft,
    laneMovementDecisions: [...existing, ...additions],
  };
}

export function buildRoadConnectionIndex(areas: RoadArea[]): RoadConnectionIndex {
  const areaById = new Map<string, RoadArea>();
  const areasByRoadId = new Map<string, RoadArea[]>();
  const editableDraftsByRoadId = new Map<string, RoadDraft>();
  const generatedCityRoadIdsByScopedExternalId = new Map<string, Set<string>>();
  const legacyCityRoadIdsByExternalId = new Map<string, Set<string>>();

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
        const sourceNamespace = generatedOsm2StreetsNamespace(area.roadId, 'road');
        const targetIndex =
          sourceNamespace === null
            ? legacyCityRoadIdsByExternalId
            : generatedCityRoadIdsByScopedExternalId;
        const key =
          sourceNamespace === null
            ? externalRoadId
            : scopedExternalRoadId(sourceNamespace, externalRoadId);
        const cityRoadIds = targetIndex.get(key) ?? new Set();
        cityRoadIds.add(area.roadId);
        targetIndex.set(key, cityRoadIds);
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
    const sourceNamespace = generatedOsm2StreetsNamespace(roadId, 'intersection');
    const resolveExternalRoadIds = (externalRoadId: string): Set<string> =>
      sourceNamespace === null
        ? legacyCityRoadIdsByExternalId.get(externalRoadId) ?? new Set()
        : generatedCityRoadIdsByScopedExternalId.get(
            scopedExternalRoadId(sourceNamespace, externalRoadId)
          ) ?? new Set();
    for (const externalRoadId of externalRoadIds) {
      for (const cityRoadId of resolveExternalRoadIds(externalRoadId)) {
        connectedCityRoadIds.add(cityRoadId);
      }
    }
    const externalMovements = firstExplicitRoadMovements(junctionAreas);
    const allowedRoadMovements =
      externalMovements === null
        ? undefined
        : new Set(
            externalMovements.flatMap(([sourceExternalId, targetExternalId]) =>
              [...resolveExternalRoadIds(sourceExternalId)].flatMap(
                (sourceCityId) =>
                  [...resolveExternalRoadIds(targetExternalId)].map(
                    (targetCityId) =>
                      directedRoadMovementKey(sourceCityId, targetCityId)
                  )
              )
            )
          );
    const externalEndpoints = firstExplicitRoadEndpoints(junctionAreas);
    const roadEndpoints: Record<string, 'start' | 'end'> = {};
    for (const [externalRoadId, endpoint] of Object.entries(
      externalEndpoints ?? {}
    )) {
      for (const cityRoadId of resolveExternalRoadIds(externalRoadId)) {
        roadEndpoints[cityRoadId] = endpoint;
      }
    }
    junctions.push({
      id: roadId,
      roadId,
      areaIds: junctionAreas.map((area) => area.id),
      position: polygonGroupCenter(junctionAreas),
      externalRoadIds,
      roadIds: [...connectedCityRoadIds].sort(),
      ...(allowedRoadMovements ? { allowedRoadMovements } : {}),
      ...(Object.keys(roadEndpoints).length > 0 ? { roadEndpoints } : {}),
    });
  }
  junctions.push(...inferGeneratedOsm2StreetsSourceSeams(areasByRoadId));

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
          respectAllowedTurns: false,
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
          ? closestDraftEndpoint(
              draft,
              junction.position,
              junction.roadEndpoints?.[roadId]
            )
          : null;
        return endpoint && endpoint.distanceM <= MAX_JUNCTION_APPROACH_DISTANCE_M
          ? { roadId, ...endpoint }
          : null;
      })
      .filter(
        (approach): approach is JunctionApproach => !!approach
      );

    for (const source of approaches) {
      const legalTargets = approaches.filter((target) => {
        const movementKey = directedRoadMovementKey(
          source.roadId,
          target.roadId
        );
        if (source.roadId === target.roadId) {
          return junction.allowedRoadMovements?.has(movementKey) === true;
        }
        return (
          junction.allowedRoadMovements === undefined ||
          junction.allowedRoadMovements.has(movementKey)
        );
      });
      const usableTargets = legalTargets.filter((target) =>
        indexedBands(target.section).some(({ band }) =>
          bandCanDepartFromEndpoint(band, target.endpoint)
        )
      );
      const targetTurns = classifyJunctionTargetTurns(source, usableTargets);
      const respectAllowedTurns = usableTargets.length > 1;
      const sourceBandAllocations = respectAllowedTurns
        ? allocateJunctionSourceBands(source, usableTargets, targetTurns)
        : usableTargets.map(() => undefined);
      for (let targetIndex = 0; targetIndex < usableTargets.length; targetIndex++) {
        const target = usableTargets[targetIndex];
        const targetTurn = targetTurns[targetIndex];
        const sourceBandAllocation = sourceBandAllocations[targetIndex];
        appendLanePairContinuations({
          idPrefix: `junction-continuation:${junction.id}`,
          sourceRoadId: source.roadId,
          sourceSection: source.section,
          sourceEndpoint: source.endpoint,
          targetRoadId: target.roadId,
          targetSection: target.section,
          targetEndpoint: target.endpoint,
          turnOverride: targetTurn,
          sourceBandIndices: sourceBandAllocation?.sourceBandIndices,
          targetBandAnchor: sourceBandAllocation?.targetBandAnchor,
          // If there is only one authoritative exit, carried arrows can refer
          // to the next logical junction. Preserve the rank-aligned segment.
          respectAllowedTurns,
          continuations,
          seen,
        });
      }
    }
  }

  return continuations.sort((a, b) => a.id.localeCompare(b.id));
}

function classifyJunctionTargetTurns(
  source: JunctionApproach,
  targets: JunctionApproach[]
): RoadLaneContinuationTurn[] {
  const angles = targets.map((target) =>
    signedTurnAngle(
      source.section,
      source.endpoint,
      target.section,
      target.endpoint
    )
  );
  const geometricTurns = angles.map(classifyTurnAngle);
  if (targets.length <= 1) return geometricTurns;

  const availableSlots: Array<{
    turn: RoadLaneContinuationTurn;
    explicit: boolean;
  }> = [];
  for (const { band } of indexedBands(source.section)) {
    if (!bandCanArriveAtEndpoint(band, source.endpoint)) continue;
    if (!bandModes(band).some(isMotorVehicleMode)) continue;
    const explicitTurns = [
      ...new Set(
        (band.allowedTurns ?? [])
          .map(allowedTurnMovement)
          .filter(
            (turn): turn is RoadLaneContinuationTurn => turn !== null
          )
      ),
    ];
    if (explicitTurns.length > 0) {
      for (const turn of explicitTurns) {
        availableSlots.push({ turn, explicit: true });
      }
    } else {
      availableSlots.push({ turn: 'through', explicit: false });
    }
  }
  if (availableSlots.length === 0) return geometricTurns;

  const assignments: Array<RoadLaneContinuationTurn | null> = targets.map(
    () => null
  );
  const candidates: Array<{
    targetIndex: number;
    slotIndex: number;
    turn: RoadLaneContinuationTurn;
    cost: number;
    explicit: boolean;
  }> = [];
  for (let slotIndex = 0; slotIndex < availableSlots.length; slotIndex++) {
    const slot = availableSlots[slotIndex];
    for (let targetIndex = 0; targetIndex < angles.length; targetIndex++) {
      const angle = angles[targetIndex];
      if (!turnCanMatchAngle(slot.turn, angle)) continue;
      candidates.push({
        targetIndex,
        slotIndex,
        turn: slot.turn,
        // Explicit arrows should win over an unspecified lane's broad
        // straight-ahead fallback when both fit a shallow branch.
        cost: turnAngleCost(slot.turn, angle) + (slot.explicit ? 0 : 80),
        explicit: slot.explicit,
      });
    }
  }
  candidates.sort(
    (left, right) =>
      left.cost - right.cost ||
      Number(right.explicit) - Number(left.explicit) ||
      left.targetIndex - right.targetIndex ||
      left.turn.localeCompare(right.turn) ||
      left.slotIndex - right.slotIndex
  );
  const usedSlots = new Set<number>();
  const assignedTurns = new Set<RoadLaneContinuationTurn>();

  // Prefer distinct movement categories first. A near-straight fork with
  // `through` and `slight_right` arrows should use both categories.
  for (const candidate of candidates) {
    if (
      assignments[candidate.targetIndex] ||
      usedSlots.has(candidate.slotIndex) ||
      assignedTurns.has(candidate.turn)
    ) {
      continue;
    }
    assignments[candidate.targetIndex] = candidate.turn;
    usedSlots.add(candidate.slotIndex);
    assignedTurns.add(candidate.turn);
  }

  // Duplicate turn slots are meaningful: two left lanes can feed two
  // authoritative left branches. Use the remaining physical lane slots
  // before falling back to geometry.
  for (const candidate of candidates) {
    if (
      assignments[candidate.targetIndex] ||
      usedSlots.has(candidate.slotIndex)
    ) {
      continue;
    }
    assignments[candidate.targetIndex] = candidate.turn;
    usedSlots.add(candidate.slotIndex);
  }

  return assignments.map(
    (assignment, targetIndex) => assignment ?? geometricTurns[targetIndex]
  );
}

type RoadLaneTurnFamily = 'left' | 'through' | 'right' | 'uturn';

function allocateJunctionSourceBands(
  source: JunctionApproach,
  targets: JunctionApproach[],
  turns: RoadLaneContinuationTurn[]
): JunctionSourceBandAllocation[] {
  const allocations = targets.map(() => new Set<number>());
  const targetBandAnchors: Array<number | undefined> = targets.map(
    () => undefined
  );
  if (targets.length === 0) return [];

  const orderedSourceBands = orderBandsByTravelSide(
    source.section,
    source.endpoint,
    indexedBands(source.section).filter(({ band }) =>
      bandCanArriveAtEndpoint(band, source.endpoint)
    ),
    true
  );
  const targetAngles = targets.map((target) =>
    signedTurnAngle(
      source.section,
      source.endpoint,
      target.section,
      target.endpoint
    )
  );

  for (const [mode, modeBands] of groupBandsByMode(orderedSourceBands)) {
    const targetIndices = targets
      .map((target, targetIndex) =>
        junctionTargetSupportsMode(target, mode) ? targetIndex : -1
      )
      .filter((targetIndex) => targetIndex >= 0);
    if (targetIndices.length === 0) continue;

    const hasExplicitTurns = modeBands.some(
      ({ band }) => (band.allowedTurns?.length ?? 0) > 0
    );
    if (!hasExplicitTurns) {
      const eligibleByTarget = new Map(
        targetIndices.map((targetIndex) => [targetIndex, modeBands])
      );
      distributeCompatibleSourceBands({
        sourceBands: modeBands,
        targetIndices,
        targetAngles,
        eligibleByTarget,
        allocations,
        targetBandAnchors,
      });
      continue;
    }

    const targetsByFamily = new Map<RoadLaneTurnFamily, number[]>();
    for (const targetIndex of targetIndices) {
      const family = roadLaneTurnFamily(turns[targetIndex]);
      const familyTargets = targetsByFamily.get(family) ?? [];
      familyTargets.push(targetIndex);
      targetsByFamily.set(family, familyTargets);
    }
    for (const familyTargets of targetsByFamily.values()) {
      const eligibleByTarget = new Map<number, IndexedBand[]>();
      for (const targetIndex of familyTargets) {
        let eligible = sourceBandsForMovement(
          modeBands,
          turns[targetIndex],
          true
        );
        if (eligible.length === 0) {
          // Missing arrows are unknown rather than forbidden. Prefer those
          // lanes when explicit tags do not explain an authoritative branch.
          eligible = modeBands.filter(
            ({ band }) => (band.allowedTurns?.length ?? 0) === 0
          );
        }
        eligibleByTarget.set(targetIndex, eligible);
      }
      distributeCompatibleSourceBands({
        sourceBands: modeBands,
        targetIndices: familyTargets,
        targetAngles,
        eligibleByTarget,
        allocations,
        targetBandAnchors,
      });
    }
  }

  return allocations.map((sourceBandIndices, targetIndex) => ({
    sourceBandIndices,
    ...(targetBandAnchors[targetIndex] === undefined
      ? {}
      : { targetBandAnchor: targetBandAnchors[targetIndex] }),
  }));
}

function junctionTargetSupportsMode(
  target: JunctionApproach,
  mode: string
): boolean {
  return indexedBands(target.section).some(
    ({ band }) =>
      bandCanDepartFromEndpoint(band, target.endpoint) &&
      targetBandAcceptsMode(band, mode)
  );
}

function distributeCompatibleSourceBands({
  sourceBands,
  targetIndices,
  targetAngles,
  eligibleByTarget,
  allocations,
  targetBandAnchors,
}: {
  sourceBands: IndexedBand[];
  targetIndices: number[];
  targetAngles: number[];
  eligibleByTarget: Map<number, IndexedBand[]>;
  allocations: Set<number>[];
  targetBandAnchors: Array<number | undefined>;
}): void {
  const sortedTargetIndices = [...targetIndices].sort(
    (left, right) =>
      targetAngles[right] - targetAngles[left] || left - right
  );
  const eligibleIndicesByTarget = new Map(
    sortedTargetIndices.map((targetIndex) => [
      targetIndex,
      new Set(
        (eligibleByTarget.get(targetIndex) ?? []).map(({ index }) => index)
      ),
    ])
  );
  const candidates = sourceBands.filter(({ index }) =>
    sortedTargetIndices.some((targetIndex) =>
      eligibleIndicesByTarget.get(targetIndex)?.has(index)
    )
  );
  if (candidates.length === 0) return;
  if (sortedTargetIndices.length > 1) {
    sortedTargetIndices.forEach((targetIndex, targetOrdinal) => {
      targetBandAnchors[targetIndex] ??= normalizedOrdinal(
        targetOrdinal,
        sortedTargetIndices.length
      );
    });
  }

  const candidateOrdinalByIndex = new Map(
    candidates.map(({ index }, ordinal) => [index, ordinal])
  );
  const usageByIndex = new Map<number, number>();

  // Cover every compatible authoritative target, reusing a lane only when
  // there are fewer compatible lane slots than target branches.
  sortedTargetIndices.forEach((targetIndex, targetOrdinal) => {
    const eligibleIndices =
      eligibleIndicesByTarget.get(targetIndex) ?? new Set<number>();
    const candidate = candidates
      .filter(({ index }) => eligibleIndices.has(index))
      .sort((left, right) => {
        const leftUsage = usageByIndex.get(left.index) ?? 0;
        const rightUsage = usageByIndex.get(right.index) ?? 0;
        const targetRank = normalizedOrdinal(
          targetOrdinal,
          sortedTargetIndices.length
        );
        const leftRank = normalizedOrdinal(
          candidateOrdinalByIndex.get(left.index) ?? 0,
          candidates.length
        );
        const rightRank = normalizedOrdinal(
          candidateOrdinalByIndex.get(right.index) ?? 0,
          candidates.length
        );
        return (
          leftUsage - rightUsage ||
          Math.abs(leftRank - targetRank) -
            Math.abs(rightRank - targetRank) ||
          left.index - right.index
        );
      })[0];
    if (!candidate) return;
    allocations[targetIndex].add(candidate.index);
    usageByIndex.set(
      candidate.index,
      (usageByIndex.get(candidate.index) ?? 0) + 1
    );
  });

  // Extra compatible lanes join their nearest branch without crossing the
  // already ordered lane-to-target assignment.
  for (const candidate of candidates) {
    if ((usageByIndex.get(candidate.index) ?? 0) > 0) continue;
    const candidateRank = normalizedOrdinal(
      candidateOrdinalByIndex.get(candidate.index) ?? 0,
      candidates.length
    );
    const targetIndex = sortedTargetIndices
      .filter((candidateTargetIndex) =>
        eligibleIndicesByTarget
          .get(candidateTargetIndex)
          ?.has(candidate.index)
      )
      .sort((left, right) => {
        const leftRank = normalizedOrdinal(
          sortedTargetIndices.indexOf(left),
          sortedTargetIndices.length
        );
        const rightRank = normalizedOrdinal(
          sortedTargetIndices.indexOf(right),
          sortedTargetIndices.length
        );
        return (
          Math.abs(candidateRank - leftRank) -
            Math.abs(candidateRank - rightRank) ||
          left - right
        );
      })[0];
    if (targetIndex === undefined) continue;
    allocations[targetIndex].add(candidate.index);
  }
}

function normalizedOrdinal(ordinal: number, count: number): number {
  return count <= 1 ? 0.5 : ordinal / (count - 1);
}

function roadLaneTurnFamily(
  turn: RoadLaneContinuationTurn
): RoadLaneTurnFamily {
  if (isLeftTurn(turn)) return 'left';
  if (isRightTurn(turn)) return 'right';
  return turn === 'uturn' ? 'uturn' : 'through';
}

function allowedTurnMovement(
  turn: RoadAllowedTurn
): RoadLaneContinuationTurn | null {
  if (turn === 'merge_left') return 'slight_left';
  if (turn === 'merge_right') return 'slight_right';
  return turn;
}

function turnCanMatchAngle(
  turn: RoadLaneContinuationTurn,
  angle: number
): boolean {
  if (turn === 'uturn') return Math.abs(angle) >= 120;
  if (turn === 'through') return Math.abs(angle) <= 60;
  if (isLeftTurn(turn)) return angle > 1;
  if (isRightTurn(turn)) return angle < -1;
  return false;
}

function turnAngleCost(
  turn: RoadLaneContinuationTurn,
  angle: number
): number {
  const ideal =
    turn === 'through'
      ? 0
      : turn === 'slight_left'
        ? 30
        : turn === 'left'
          ? 90
          : turn === 'sharp_left'
            ? 145
            : turn === 'slight_right'
              ? -30
              : turn === 'right'
                ? -90
                : turn === 'sharp_right'
                  ? -145
                  : angle < 0
                    ? -180
                    : 180;
  return Math.abs(angle - ideal);
}

function appendLanePairContinuations({
  idPrefix,
  sourceRoadId,
  sourceSection,
  sourceEndpoint,
  targetRoadId,
  targetSection,
  targetEndpoint,
  turnOverride,
  sourceBandIndices,
  targetBandAnchor,
  respectAllowedTurns = true,
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
  turnOverride?: RoadLaneContinuationTurn;
  sourceBandIndices?: Set<number>;
  targetBandAnchor?: number;
  respectAllowedTurns?: boolean;
  continuations: RoadLaneContinuation[];
  seen: Set<string>;
}): void {
  const sourceBands = orderBandsByTravelSide(
    sourceSection,
    sourceEndpoint,
    indexedBands(sourceSection).filter(
      ({ band, index }) =>
        bandCanArriveAtEndpoint(band, sourceEndpoint) &&
        (!sourceBandIndices || sourceBandIndices.has(index))
    ),
    true
  );
  const targetBands = orderBandsByTravelSide(
    targetSection,
    targetEndpoint,
    indexedBands(targetSection).filter(({ band }) =>
      bandCanDepartFromEndpoint(band, targetEndpoint)
    ),
    false
  );
  const turn =
    turnOverride ??
    classifyTurn(
      sourceSection,
      sourceEndpoint,
      targetSection,
      targetEndpoint
    );

  for (const pair of compatibleBandPairs(
    sourceBands,
    targetBands,
    turn,
    respectAllowedTurns,
    targetBandAnchor
  )) {
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
    const dedupeKey = `${sourceRef}>${targetRef}|${pair.mode}`;
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
      ...(pair.source.band.id ? { sourceBandId: pair.source.band.id } : {}),
      ...(pair.target.band.id ? { targetBandId: pair.target.band.id } : {}),
      sourceKind: pair.source.band.kind,
      ...(pair.source.band.sourceType
        ? { sourceType: pair.source.band.sourceType }
        : {}),
      mode: pair.mode,
      turn,
      path,
      polygon,
      sourceWidthM: pair.source.band.widthM,
      targetWidthM: pair.target.band.widthM,
    });
  }
}

function roadLaneMovementDecisionMatchesContinuation(
  decision: RoadLaneMovementDecision,
  continuation: RoadLaneContinuation
): boolean {
  if (decision.mode !== continuation.mode) return false;
  const direct =
    roadLaneMovementReferenceMatchesContinuation(
      decision.source,
      continuation,
      'source'
    ) &&
    roadLaneMovementReferenceMatchesContinuation(
      decision.target,
      continuation,
      'target'
    );
  const reciprocal =
    roadLaneMovementReferenceMatchesContinuation(
      decision.source,
      continuation,
      'target'
    ) &&
    roadLaneMovementReferenceMatchesContinuation(
      decision.target,
      continuation,
      'source'
    );
  return direct || reciprocal;
}

function laneMovementDecisionsMatch(
  left: RoadLaneMovementDecision,
  right: RoadLaneMovementDecision
): boolean {
  if (left.mode !== right.mode) return false;
  return (
    (laneMovementReferencesMatch(left.source, right.source) &&
      laneMovementReferencesMatch(left.target, right.target)) ||
    (laneMovementReferencesMatch(left.source, right.target) &&
      laneMovementReferencesMatch(left.target, right.source))
  );
}

function laneMovementReferencesMatch(
  left: RoadLaneMovementReference,
  right: RoadLaneMovementReference
): boolean {
  return (
    left.roadId === right.roadId &&
    left.sectionId === right.sectionId &&
    left.endpoint === right.endpoint &&
    left.bandId === right.bandId
  );
}

function roadLaneMovementReferenceMatchesContinuation(
  reference: RoadLaneMovementReference,
  continuation: RoadLaneContinuation,
  side: 'source' | 'target'
): boolean {
  const roadId =
    side === 'source' ? continuation.sourceRoadId : continuation.targetRoadId;
  const sectionId =
    side === 'source'
      ? continuation.sourceSectionId
      : continuation.targetSectionId;
  const endpoint =
    side === 'source'
      ? continuation.sourceEndpoint
      : continuation.targetEndpoint;
  const bandId =
    side === 'source' ? continuation.sourceBandId : continuation.targetBandId;
  return (
    reference.roadId === roadId &&
    reference.sectionId === sectionId &&
    reference.endpoint === endpoint &&
    reference.bandId === bandId
  );
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
  position: [number, number],
  requiredEndpoint?: 'start' | 'end'
): {
  section: RoadSectionDraft;
  endpoint: 'start' | 'end';
  distanceM: number;
} | null {
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
      if (requiredEndpoint && endpoint !== requiredEndpoint) continue;
      const point = endpoint === 'start' ? line[0] : line[line.length - 1];
      const distance = approximateDistanceMeters(point, position);
      if (!closest || distance < closest.distance) {
        closest = { section, endpoint, distance };
      }
    }
  }
  return closest
    ? {
        section: closest.section,
        endpoint: closest.endpoint,
        distanceM: closest.distance,
      }
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
    const key = `${sourceRef}>${targetRef}|${continuation.mode}`;
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

function firstExplicitRoadMovements(
  areas: RoadArea[]
): Array<[string, string]> | null {
  let found = false;
  const result: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const area of areas) {
    const value = area.attributes.allowedRoadMovements;
    if (!Array.isArray(value)) continue;
    found = true;
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const source = normalizeExternalId(entry[0]);
      const target = normalizeExternalId(entry[1]);
      if (!source || !target) continue;
      const key = directedRoadMovementKey(source, target);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push([source, target]);
    }
  }
  return found ? result : null;
}

function firstExplicitRoadEndpoints(
  areas: RoadArea[]
): Record<string, 'start' | 'end'> | null {
  for (const area of areas) {
    const value = area.attributes.roadEndpoints;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const result: Record<string, 'start' | 'end'> = {};
    for (const [roadId, endpoint] of Object.entries(value)) {
      if (endpoint === 'start' || endpoint === 'end') {
        result[roadId] = endpoint;
      }
    }
    return result;
  }
  return null;
}

function directedRoadMovementKey(
  sourceRoadId: string,
  targetRoadId: string
): string {
  return `${sourceRoadId}\u0000${targetRoadId}`;
}

function generatedOsm2StreetsNamespace(
  cityObjectId: string,
  kind: 'road' | 'intersection'
): string | null {
  const marker = `osm2streets-${kind}-`;
  const markerIndex = cityObjectId.lastIndexOf(marker);
  return markerIndex >= 0 ? cityObjectId.slice(0, markerIndex) : null;
}

function scopedExternalRoadId(sourceNamespace: string, externalRoadId: string): string {
  return `${sourceNamespace}\u0000${externalRoadId}`;
}

function inferGeneratedOsm2StreetsSourceSeams(
  areasByRoadId: Map<string, RoadArea[]>
): RoadConnectionJunction[] {
  const endpointsByOsmWayId = new Map<string, SourceSeamEndpoint[]>();

  for (const [roadId, roadAreas] of areasByRoadId) {
    const sourceNamespace = generatedOsm2StreetsNamespace(roadId, 'road');
    const area = roadAreas.find((candidate) => !isIntersectionArea(candidate));
    if (!sourceNamespace || !area) continue;
    const centerline = readWgs84Line(area.attributes.sourceCenterlineWgs84);
    const osmWayIds = [
      ...new Set(
        roadAreas.flatMap((candidate) =>
          normalizeExternalIds(candidate.attributes.osmWayIds)
        )
      ),
    ];
    const mapEdgeEndpoints = readSourceMapEdgeEndpoints(
      area.attributes.sourceMapEdgeEndpointsWgs84
    );
    if (!centerline || osmWayIds.length === 0 || mapEdgeEndpoints.length === 0) {
      continue;
    }

    for (const mapEdge of mapEdgeEndpoints) {
      const inwardTangent = sourceSeamInwardTangent(centerline, mapEdge.endpoint);
      if (!inwardTangent) continue;
      const endpoint: SourceSeamEndpoint = {
        ref: `${roadId}#${mapEdge.endpoint}`,
        roadId,
        sourceNamespace,
        endpoint: mapEdge.endpoint,
        position: mapEdge.position,
        inwardTangent,
      };
      for (const osmWayId of osmWayIds) {
        const group = endpointsByOsmWayId.get(osmWayId) ?? [];
        group.push(endpoint);
        endpointsByOsmWayId.set(osmWayId, group);
      }
    }
  }

  const candidatesByKey = new Map<string, SourceSeamCandidate>();
  for (const [osmWayId, endpoints] of endpointsByOsmWayId) {
    for (let leftIndex = 0; leftIndex < endpoints.length; leftIndex += 1) {
      const left = endpoints[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < endpoints.length; rightIndex += 1) {
        const right = endpoints[rightIndex];
        if (
          left.roadId === right.roadId ||
          left.sourceNamespace === right.sourceNamespace
        ) {
          continue;
        }
        const distanceM = approximateDistanceMeters(left.position, right.position);
        if (distanceM > MAX_SOURCE_SEAM_REFERENCE_DISTANCE_M) continue;
        const inwardDot =
          left.inwardTangent[0] * right.inwardTangent[0] +
          left.inwardTangent[1] * right.inwardTangent[1];
        if (inwardDot > MAX_SOURCE_SEAM_INWARD_DOT) continue;

        const key =
          left.ref < right.ref
            ? `${left.ref}|${right.ref}`
            : `${right.ref}|${left.ref}`;
        const current = candidatesByKey.get(key);
        if (current) {
          current.externalRoadIds.add(osmWayId);
        } else {
          candidatesByKey.set(key, {
            key,
            left,
            right,
            distanceM,
            externalRoadIds: new Set([osmWayId]),
          });
        }
      }
    }
  }

  const candidatesByEndpoint = new Map<string, SourceSeamCandidate[]>();
  for (const candidate of candidatesByKey.values()) {
    for (const endpointRef of [candidate.left.ref, candidate.right.ref]) {
      const endpointCandidates = candidatesByEndpoint.get(endpointRef) ?? [];
      endpointCandidates.push(candidate);
      candidatesByEndpoint.set(endpointRef, endpointCandidates);
    }
  }
  for (const endpointCandidates of candidatesByEndpoint.values()) {
    endpointCandidates.sort(
      (left, right) =>
        left.distanceM - right.distanceM || left.key.localeCompare(right.key)
    );
  }

  const junctions: RoadConnectionJunction[] = [];
  for (const candidate of candidatesByKey.values()) {
    const leftCandidates = candidatesByEndpoint.get(candidate.left.ref) ?? [];
    const rightCandidates = candidatesByEndpoint.get(candidate.right.ref) ?? [];
    if (
      leftCandidates[0] !== candidate ||
      rightCandidates[0] !== candidate ||
      sourceSeamBestCandidateIsAmbiguous(leftCandidates) ||
      sourceSeamBestCandidateIsAmbiguous(rightCandidates)
    ) {
      continue;
    }
    const position: [number, number] = [
      (candidate.left.position[0] + candidate.right.position[0]) / 2,
      (candidate.left.position[1] + candidate.right.position[1]) / 2,
    ];
    const id = `osm2streets-source-seam:${candidate.key}`;
    junctions.push({
      id,
      roadId: id,
      areaIds: [],
      position,
      externalRoadIds: [...candidate.externalRoadIds].sort(),
      roadIds: [candidate.left.roadId, candidate.right.roadId].sort(),
      roadEndpoints: {
        [candidate.left.roadId]: candidate.left.endpoint,
        [candidate.right.roadId]: candidate.right.endpoint,
      },
    });
  }
  return junctions.sort((left, right) => left.id.localeCompare(right.id));
}

function sourceSeamBestCandidateIsAmbiguous(
  candidates: SourceSeamCandidate[]
): boolean {
  return (
    candidates.length > 1 &&
    candidates[1].distanceM - candidates[0].distanceM <=
      SOURCE_SEAM_AMBIGUITY_DISTANCE_M
  );
}

function readSourceMapEdgeEndpoints(
  value: unknown
): Array<{
  endpoint: 'start' | 'end';
  position: [number, number];
}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const result: Array<{
    endpoint: 'start' | 'end';
    position: [number, number];
  }> = [];
  for (const endpoint of ['start', 'end'] as const) {
    const position = readWgs84Point(record[endpoint]);
    if (position) result.push({ endpoint, position });
  }
  return result;
}

function readWgs84Line(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const line = value
    .map(readWgs84Point)
    .filter((point): point is [number, number] => !!point);
  return line.length === value.length && line.length >= 2 ? line : null;
}

function readWgs84Point(value: unknown): [number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return null;
  }
  return [value[0], value[1]];
}

function sourceSeamInwardTangent(
  centerline: [number, number][],
  endpoint: 'start' | 'end'
): [number, number] | null {
  const endpointPosition =
    endpoint === 'start' ? centerline[0] : centerline[centerline.length - 1];
  for (let offset = 1; offset < centerline.length; offset += 1) {
    const innerPosition =
      endpoint === 'start'
        ? centerline[offset]
        : centerline[centerline.length - 1 - offset];
    const vector = localVectorMeters(endpointPosition, innerPosition);
    if (Math.hypot(vector[0], vector[1]) > 1e-6) {
      return normalizeVector(vector);
    }
  }
  return null;
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

function orderBandsByTravelSide(
  section: RoadSectionDraft,
  endpoint: 'start' | 'end',
  bands: IndexedBand[],
  incoming: boolean
): IndexedBand[] {
  const centerline = sampleRoadSectionCenterlineWgs84(section);
  if (centerline.length < 2) return bands;
  const center =
    endpoint === 'start' ? centerline[0] : centerline[centerline.length - 1];
  const travel = endpointTravelVector(section, endpoint, incoming);
  const travelLeft: [number, number] = [-travel[1], travel[0]];
  return [...bands].sort((left, right) => {
    const leftPoint = lanePoint(section, left.index, endpoint, 0);
    const rightPoint = lanePoint(section, right.index, endpoint, 0);
    if (!leftPoint || !rightPoint) return left.index - right.index;
    const leftOffset = localVectorMeters(center, leftPoint.position);
    const rightOffset = localVectorMeters(center, rightPoint.position);
    const leftScore =
      leftOffset[0] * travelLeft[0] + leftOffset[1] * travelLeft[1];
    const rightScore =
      rightOffset[0] * travelLeft[0] + rightOffset[1] * travelLeft[1];
    return rightScore - leftScore || left.index - right.index;
  });
}

function compatibleBandPairs(
  source: IndexedBand[],
  target: IndexedBand[],
  turn: RoadLaneContinuationTurn,
  respectAllowedTurns: boolean,
  targetBandAnchor?: number
): Array<{ source: IndexedBand; target: IndexedBand; mode: string }> {
  const result: Array<{ source: IndexedBand; target: IndexedBand; mode: string }> = [];
  const sourceByMode = groupBandsByMode(source);
  const paired = new Set<string>();

  for (const [mode, sourceBands] of sourceByMode) {
    const targetBands = target.filter(({ band }) =>
      targetBandAcceptsMode(band, mode)
    );
    if (targetBands.length === 0) continue;
    const eligibleSourceBands = sourceBandsForMovement(
      sourceBands,
      turn,
      respectAllowedTurns
    );
    eligibleSourceBands.forEach((sourceBand, ordinal) => {
      const targetOrdinal = targetOrdinalForMovement(
        ordinal,
        eligibleSourceBands.length,
        targetBands.length,
        turn,
        targetBandAnchor
      );
      const targetBand = targetBands[targetOrdinal];
      const key = `${sourceBand.index}:${targetBand?.index}:${mode}`;
      if (!targetBand || paired.has(key)) return;
      paired.add(key);
      result.push({ source: sourceBand, target: targetBand, mode });
    });
  }
  return result;
}

function sourceBandsForMovement(
  sourceBands: IndexedBand[],
  turn: RoadLaneContinuationTurn,
  respectAllowedTurns: boolean
): IndexedBand[] {
  if (!respectAllowedTurns) return sourceBands;
  const explicit = sourceBands.filter(
    ({ band }) => (band.allowedTurns?.length ?? 0) > 0
  );
  if (explicit.length > 0) {
    const permitted = explicit.filter(({ band }) =>
      roadAllowedTurnsPermitMovement(band.allowedTurns, turn)
    );
    if (turn === 'through') {
      permitted.push(
        ...sourceBands.filter(
          ({ band }) => (band.allowedTurns?.length ?? 0) === 0
        )
      );
    }
    return dedupeIndexedBands(permitted);
  }

  if (turn === 'through') return sourceBands;
  if (turn === 'uturn') return [];
  if (isLeftTurn(turn)) return sourceBands.slice(0, 1);
  if (isRightTurn(turn)) return sourceBands.slice(-1);
  return [];
}

function targetOrdinalForMovement(
  sourceOrdinal: number,
  sourceCount: number,
  targetCount: number,
  turn: RoadLaneContinuationTurn,
  targetBandAnchor?: number
): number {
  if (targetCount <= 1) return 0;
  if (
    targetBandAnchor !== undefined &&
    sourceCount <= targetCount
  ) {
    const start = Math.round(
      Math.max(0, Math.min(1, targetBandAnchor)) *
        (targetCount - sourceCount)
    );
    return Math.min(targetCount - 1, start + sourceOrdinal);
  }
  if (sourceCount <= 1) {
    if (isLeftTurn(turn) || turn === 'uturn') return 0;
    if (isRightTurn(turn)) return targetCount - 1;
    return Math.floor((targetCount - 1) / 2);
  }
  if (sourceCount <= targetCount) {
    if (isLeftTurn(turn) || turn === 'uturn') return sourceOrdinal;
    if (isRightTurn(turn)) {
      return targetCount - sourceCount + sourceOrdinal;
    }
  }
  return Math.round(
    (sourceOrdinal / Math.max(1, sourceCount - 1)) * (targetCount - 1)
  );
}

function dedupeIndexedBands(bands: IndexedBand[]): IndexedBand[] {
  const seen = new Set<number>();
  return bands.filter(({ index }) => {
    if (seen.has(index)) return false;
    seen.add(index);
    return true;
  });
}

function targetBandAcceptsMode(band: RoadBand, sourceMode: string): boolean {
  const targetModes = bandModes(band);
  if (targetModes.includes(sourceMode)) return true;
  return (
    sourceMode !== 'car' &&
    isMotorVehicleMode(sourceMode) &&
    targetModes.includes('car')
  );
}

function isMotorVehicleMode(mode: string): boolean {
  return [
    'car',
    'bus',
    'taxi',
    'hgv',
    'motorcycle',
    'motorvehicle',
  ].includes(mode);
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
  return classifyTurnAngle(
    signedTurnAngle(source, sourceEndpoint, target, targetEndpoint)
  );
}

function signedTurnAngle(
  source: RoadSectionDraft,
  sourceEndpoint: 'start' | 'end',
  target: RoadSectionDraft,
  targetEndpoint: 'start' | 'end'
): number {
  const incoming = endpointTravelVector(source, sourceEndpoint, true);
  const outgoing = endpointTravelVector(target, targetEndpoint, false);
  const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
  const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

function classifyTurnAngle(angle: number): RoadLaneContinuationTurn {
  const absoluteAngle = Math.abs(angle);
  if (absoluteAngle >= 165) return 'uturn';
  if (absoluteAngle <= 12) return 'through';
  if (absoluteAngle < 45) {
    return angle > 0 ? 'slight_left' : 'slight_right';
  }
  if (absoluteAngle < 135) return angle > 0 ? 'left' : 'right';
  return angle > 0 ? 'sharp_left' : 'sharp_right';
}

function isLeftTurn(turn: RoadLaneContinuationTurn): boolean {
  return (
    turn === 'slight_left' ||
    turn === 'left' ||
    turn === 'sharp_left'
  );
}

function isRightTurn(turn: RoadLaneContinuationTurn): boolean {
  return (
    turn === 'slight_right' ||
    turn === 'right' ||
    turn === 'sharp_right'
  );
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
