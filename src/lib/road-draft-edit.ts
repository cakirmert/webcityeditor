import {
  deriveEditableRoadDraftFromAreas,
  roadSectionPointAt,
  sampleRoadSectionCenterlineWgs84,
  type OsmRoadFeature,
  type RoadArea,
  type RoadDraft,
  type RoadEndpointConnection,
  type RoadBand,
  type RoadSectionDraft,
} from './transportation';
import {
  isRoadBandConnectable,
  roadBandCanArriveAtEndpoint,
  roadBandCanDepartFromEndpoint,
  roadBandDirection,
  roadBandModes,
} from './road-movements';

export interface RoadDraftHandle {
  sectionId: string;
  pointIndex: number;
  position: [number, number];
  kind: 'vertex' | 'midpoint';
  endpoint?: 'start' | 'end';
  connected?: boolean;
}

export interface RoadDraftPath {
  sectionId: string;
  path: [number, number][];
}

export interface RoadSnapCandidate {
  id: string;
  position: [number, number];
  connection: RoadEndpointConnection;
  targetBands?: RoadBand[];
  compatibleLaneCount?: number;
  distanceMeters?: number;
}

export function connectRoadLanes(
  connection: RoadEndpointConnection,
  sourceBands: RoadBand[],
  targetBands: RoadBand[] = [],
  sourceEndpoint?: 'start' | 'end'
): RoadEndpointConnection {
  const sourceLanes = sourceBands
    .map((band, index) => ({ band, index }))
    .filter(({ band }) => isRoadBandConnectable(band));
  const targetLanes = targetBands
    .map((band, index) => ({ band, index }))
    .filter(({ band }) => isRoadBandConnectable(band));
  const targetOrder =
    sourceEndpoint && connection.targetEndpoint === sourceEndpoint
      ? [...targetLanes].reverse()
      : targetLanes;
  const targetEndpoint = connection.targetEndpoint === 'start' || connection.targetEndpoint === 'end'
    ? connection.targetEndpoint
    : sourceEndpoint === 'start'
      ? 'end'
      : 'start';
  const compatibleTargets = (source: RoadBand) =>
    targetOrder.filter(
      ({ band }) =>
        modesOverlap(source, band) &&
        (!sourceEndpoint ||
          (roadBandCanArriveAtEndpoint(source, sourceEndpoint) &&
            roadBandCanDepartFromEndpoint(band, targetEndpoint)) ||
          (roadBandCanDepartFromEndpoint(source, sourceEndpoint) &&
            roadBandCanArriveAtEndpoint(band, targetEndpoint)))
    );
  const laneConnections = sourceLanes.flatMap(({ band: source, index: sourceBandIndex }, ordinal) => {
    const matches = compatibleTargets(source);
    if (matches.length === 0) return [];
    const targetOrdinal = sourceLanes.length <= 1
      ? 0
      : Math.round((ordinal / (sourceLanes.length - 1)) * Math.max(0, matches.length - 1));
    const chosen = matches[Math.min(targetOrdinal, matches.length - 1)];
    const targetBandIndex = chosen.index;
    const target = targetBands[targetBandIndex];
    const sharedMode = target
      ? roadBandModes(source).find((mode) => roadBandModes(target).includes(mode))
      : undefined;
    return [{
      sourceBandId: source.id,
      sourceBandIndex,
      sourceDirection: roadBandDirection(source),
      targetBandId: target?.id,
      targetBandIndex,
      ...(target ? { targetDirection: roadBandDirection(target) } : {}),
      sourceMode: sharedMode ?? primaryMode(source),
      targetMode: sharedMode ?? (target ? primaryMode(target) : primaryMode(source)),
    }];
  });
  return { ...connection, laneConnections };
}

function primaryMode(band: RoadBand): string {
  return roadBandModes(band)[0] ?? 'none';
}

function modesOverlap(a: RoadBand, b: RoadBand): boolean {
  const bModes = new Set(roadBandModes(b));
  return roadBandModes(a).some((mode) => bModes.has(mode));
}

function finiteLngLat(point: [number, number]): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

export function buildRoadDraftPaths(draft: RoadDraft | null): RoadDraftPath[] {
  if (!draft) return [];
  return draft.sections
    .map((section) => ({
      sectionId: section.id,
      path: sampleRoadSectionCenterlineWgs84(section).filter(finiteLngLat),
    }))
    .filter((section) => section.path.length >= 2);
}

export function buildRoadDraftHandles(draft: RoadDraft | null): RoadDraftHandle[] {
  if (!draft) return [];
  const handles: RoadDraftHandle[] = [];
  for (const section of draft.sections) {
    const points = section.centerlineWgs84;
    points.forEach((position, pointIndex) => {
      if (!finiteLngLat(position)) return;
      const endpoint =
        pointIndex === 0 ? 'start' : pointIndex === points.length - 1 ? 'end' : undefined;
      handles.push({
        sectionId: section.id,
        pointIndex,
        position,
        kind: 'vertex',
        ...(endpoint ? { endpoint } : {}),
        ...(endpoint && section.connections?.[endpoint] ? { connected: true } : {}),
      });
      const next = points[pointIndex + 1];
      if (next && finiteLngLat(next)) {
        handles.push({
          sectionId: section.id,
          pointIndex: pointIndex + 1,
          position: roadSectionPointAt(section, pointIndex, 0.5),
          kind: 'midpoint',
        });
      }
    });
  }
  return handles;
}

export function toLngLat(coordinate: number[] | undefined): [number, number] | null {
  if (!coordinate || coordinate.length < 2) return null;
  const [lng, lat] = coordinate;
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

export function updateRoadDraftPoint(
  draft: RoadDraft,
  sectionId: string,
  pointIndex: number,
  position: [number, number],
  connection?: RoadEndpointConnection | null
): RoadDraft {
  const sourceSection = draft.sections.find((section) => section.id === sectionId);
  const sourceEndpoint =
    pointIndex === 0
      ? 'start'
      : sourceSection && pointIndex === sourceSection.centerlineWgs84.length - 1
        ? 'end'
        : null;
  let sections = draft.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const centerlineWgs84 = section.centerlineWgs84.map(
      (point) => [point[0], point[1]] as [number, number]
    );
    if (pointIndex < 0 || pointIndex >= centerlineWgs84.length) return section;
    centerlineWgs84[pointIndex] = position;
    const endpoint =
      pointIndex === 0
        ? 'start'
        : pointIndex === centerlineWgs84.length - 1
          ? 'end'
          : null;
    if (!endpoint) return { ...section, centerlineWgs84 };
    const connections = { ...section.connections };
    if (connection) connections[endpoint] = connection;
    else delete connections[endpoint];
    return {
      ...section,
      centerlineWgs84,
      ...(connections.start || connections.end ? { connections } : { connections: undefined }),
    };
  });

  // Joining two sections in the current draft is reciprocal immediately, so
  // changing lane counts across a split still produces one explicit network.
  if (
    sourceEndpoint &&
    connection?.target === 'draft' &&
    connection.targetSectionId &&
    (connection.targetEndpoint === 'start' || connection.targetEndpoint === 'end')
  ) {
    const targetEndpoint = connection.targetEndpoint;
    sections = sections.map((section) => {
      if (section.id !== connection.targetSectionId) return section;
      return {
        ...section,
        connections: {
          ...section.connections,
          [targetEndpoint]: {
            target: 'draft',
            targetId: sectionId,
            targetSectionId: sectionId,
            targetEndpoint: sourceEndpoint,
            positionWgs84: position,
            ...(connection.laneConnections?.length
              ? {
                  laneConnections: connection.laneConnections.map((lane) => ({
                    ...(lane.targetBandId ? { sourceBandId: lane.targetBandId } : {}),
                    sourceBandIndex: lane.targetBandIndex,
                    ...(lane.targetDirection ? { sourceDirection: lane.targetDirection } : {}),
                    ...(lane.sourceBandId ? { targetBandId: lane.sourceBandId } : {}),
                    targetBandIndex: lane.sourceBandIndex,
                    ...(lane.sourceDirection ? { targetDirection: lane.sourceDirection } : {}),
                    ...(lane.targetMode ? { sourceMode: lane.targetMode } : {}),
                    ...(lane.sourceMode ? { targetMode: lane.sourceMode } : {}),
                  })),
                }
              : {}),
            confirmed: true,
          },
        },
      };
    });
  }
  return {
    ...draft,
    userVerified: true,
    sections,
  };
}

/**
 * Keep stored lane indexes aligned with stable band ids after drag reordering,
 * insertion, or removal. Ids remain authoritative; indexes make exported
 * payloads and downstream tools usable even when an imported lane had no id.
 */
export function reconcileRoadLaneConnectionIndexes(draft: RoadDraft): RoadDraft {
  const sectionsById = new Map(draft.sections.map((section) => [section.id, section]));
  return {
    ...draft,
    sections: draft.sections.map((section) => ({
      ...section,
      connections: reconcileSectionConnections(section, sectionsById),
    })),
  };
}

function reconcileSectionConnections(
  section: RoadSectionDraft,
  sectionsById: ReadonlyMap<string, RoadSectionDraft>
): RoadSectionDraft['connections'] | undefined {
  if (!section.connections) return undefined;
  const next: RoadSectionDraft['connections'] = {};
  for (const endpoint of ['start', 'end'] as const) {
    const connection = section.connections[endpoint];
    if (!connection) continue;
    const targetSection = connection.target === 'draft' && connection.targetSectionId
      ? sectionsById.get(connection.targetSectionId)
      : undefined;
    const laneConnections = connection.laneConnections?.flatMap((mapping) => {
      const sourceBandIndex = mapping.sourceBandId
        ? section.bands.findIndex((band) => band.id === mapping.sourceBandId)
        : mapping.sourceBandIndex;
      if (sourceBandIndex < 0 || sourceBandIndex >= section.bands.length) return [];
      const targetBandIndex = targetSection && mapping.targetBandId
        ? targetSection.bands.findIndex((band) => band.id === mapping.targetBandId)
        : mapping.targetBandIndex;
      if (targetSection && (targetBandIndex < 0 || targetBandIndex >= targetSection.bands.length)) {
        return [];
      }
      return [{ ...mapping, sourceBandIndex, targetBandIndex }];
    });
    next[endpoint] = {
      ...connection,
      ...(laneConnections?.length ? { laneConnections } : { laneConnections: undefined }),
    };
  }
  return next.start || next.end ? next : undefined;
}

/**
 * Small, visible connection targets for endpoint snapping. OSM way endpoints
 * act as the shared intersection nodes; every CityJSON road exposes either
 * its saved layout or a draft derived from its exact imported surfaces.
 * Duplicates are collapsed by coordinate.
 */
export function buildRoadSnapCandidates(
  draft: RoadDraft | null,
  roadAreas: RoadArea[],
  osmRoads: OsmRoadFeature[]
): RoadSnapCandidate[] {
  const candidates: RoadSnapCandidate[] = [];
  const seen = new Set<string>();
  const add = (candidate: RoadSnapCandidate) => {
    if (!finiteLngLat(candidate.position)) return;
    const coordinateKey = `${candidate.position[0].toFixed(7)}:${candidate.position[1].toFixed(7)}`;
    const key = `${candidate.connection.target}:${candidate.connection.targetId}:${coordinateKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const section of draft?.sections ?? []) {
    const first = section.centerlineWgs84[0];
    const last = section.centerlineWgs84.at(-1);
    if (first) addDraftCandidate(section.id, 'start', first, section.bands, add);
    if (last) addDraftCandidate(section.id, 'end', last, section.bands, add);
  }

  const cityJsonRoads = new Map<string, RoadArea[]>();
  for (const area of roadAreas) {
    if (draft?.id && area.roadId === draft.id) continue;
    const grouped = cityJsonRoads.get(area.roadId) ?? [];
    grouped.push(area);
    cityJsonRoads.set(area.roadId, grouped);
  }
  for (const [roadId, areas] of cityJsonRoads) {
    if (areas.every((area) =>
      String(area.function).toLowerCase() === 'intersection' ||
      String(area.attributes.transportationUsage ?? '').toLowerCase() === 'intersection'
    )) continue;
    let layout = areas.find((area) => area.editableDraft)?.editableDraft ?? null;
    if (!layout) {
      try {
        layout = deriveEditableRoadDraftFromAreas(areas, roadId);
      } catch {
        continue;
      }
    }
    for (const section of layout.sections) {
      const first = section.centerlineWgs84[0];
      const last = section.centerlineWgs84.at(-1);
      if (first) addSavedCandidate(roadId, section.id, 'start', first, section.bands, add);
      if (last) addSavedCandidate(roadId, section.id, 'end', last, section.bands, add);
    }
  }

  for (const road of osmRoads) {
    const first = road.path[0];
    const last = road.path.at(-1);
    const bands = road.inferredDraft.sections[0]?.bands ?? [];
    if (first) addOsmCandidate(road.id, 'start', first, bands, add);
    if (last) addOsmCandidate(road.id, 'end', last, bands, add);
  }
  return candidates;
}

/**
 * Return every nearby target that has at least one direction- and mode-
 * compatible lane pair with the active endpoint. Sorting is deterministic so
 * visual emphasis and pointer snapping agree at equal distances.
 */
export function compatibleRoadSnapCandidates(
  draft: RoadDraft,
  sectionId: string,
  endpoint: 'start' | 'end',
  candidates: RoadSnapCandidate[],
  maxDistanceMeters = 80
): RoadSnapCandidate[] {
  const section = draft.sections.find((candidate) => candidate.id === sectionId);
  if (!section) return [];
  const sourcePosition = endpoint === 'start'
    ? section.centerlineWgs84[0]
    : section.centerlineWgs84.at(-1);
  if (!sourcePosition) return [];
  const targetEndpointFallback = endpoint === 'start' ? 'end' : 'start';

  return candidates.flatMap((candidate) => {
    if (
      (candidate.connection.target === 'draft' &&
        candidate.connection.targetSectionId === sectionId) ||
      (candidate.connection.target === 'cityjson' && draft.id === candidate.connection.targetId)
    ) {
      return [];
    }
    const targetEndpoint = candidate.connection.targetEndpoint === 'start' ||
      candidate.connection.targetEndpoint === 'end'
      ? candidate.connection.targetEndpoint
      : targetEndpointFallback;
    const targetBands = candidate.targetBands ?? [];
    const compatibleLaneCount = section.bands.filter((sourceBand) =>
      targetBands.some((targetBand) =>
        modesOverlap(sourceBand, targetBand) &&
        (
          (roadBandCanArriveAtEndpoint(sourceBand, endpoint) &&
            roadBandCanDepartFromEndpoint(targetBand, targetEndpoint)) ||
          (roadBandCanDepartFromEndpoint(sourceBand, endpoint) &&
            roadBandCanArriveAtEndpoint(targetBand, targetEndpoint))
        )
      )
    ).length;
    if (compatibleLaneCount === 0) return [];
    const distanceMeters = approximateDistanceMeters(sourcePosition, candidate.position);
    if (distanceMeters > maxDistanceMeters) return [];
    return [{ ...candidate, compatibleLaneCount, distanceMeters }];
  }).sort((left, right) =>
    (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity) ||
    left.id.localeCompare(right.id)
  );
}

function approximateDistanceMeters(a: [number, number], b: [number, number]): number {
  const latitude = ((a[1] + b[1]) / 2) * Math.PI / 180;
  return Math.hypot(
    (b[0] - a[0]) * 111_320 * Math.max(0.2, Math.cos(latitude)),
    (b[1] - a[1]) * 110_540
  );
}

function addDraftCandidate(
  sectionId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
  targetBands: RoadBand[],
  add: (candidate: RoadSnapCandidate) => void
) {
  add({
    id: `draft:${sectionId}:${endpoint}`,
    position,
    connection: {
      target: 'draft',
      targetId: sectionId,
      targetSectionId: sectionId,
      targetEndpoint: endpoint,
      positionWgs84: position,
      confirmed: true,
    },
    targetBands,
  });
}

function addSavedCandidate(
  roadId: string,
  sectionId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
  targetBands: RoadBand[],
  add: (candidate: RoadSnapCandidate) => void
) {
  add({
    id: `cityjson:${roadId}:${sectionId}:${endpoint}`,
    position,
    connection: {
      target: 'cityjson',
      targetId: roadId,
      targetSectionId: sectionId,
      targetEndpoint: endpoint,
      positionWgs84: position,
      confirmed: true,
    },
    targetBands,
  });
}

function addOsmCandidate(
  roadId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
  targetBands: RoadBand[],
  add: (candidate: RoadSnapCandidate) => void
) {
  add({
    id: `osm:${roadId}:${endpoint}`,
    position,
    connection: {
      target: 'osm',
      targetId: roadId,
      targetEndpoint: endpoint,
      positionWgs84: position,
      confirmed: true,
    },
    targetBands,
  });
}

export function insertRoadDraftPoint(
  draft: RoadDraft,
  sectionId: string,
  pointIndex: number,
  position: [number, number]
): RoadDraft {
  return {
    ...draft,
    userVerified: true,
    sections: draft.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const centerlineWgs84 = section.centerlineWgs84.map(
        (point) => [point[0], point[1]] as [number, number]
      );
      const insertAt = Math.max(1, Math.min(pointIndex, centerlineWgs84.length));
      centerlineWgs84.splice(insertAt, 0, position);
      return { ...section, centerlineWgs84 };
    }),
  };
}
