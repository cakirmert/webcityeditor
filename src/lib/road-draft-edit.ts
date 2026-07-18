import {
  roadSectionPointAt,
  sampleRoadSectionCenterlineWgs84,
  type OsmRoadFeature,
  type RoadArea,
  type RoadDraft,
  type RoadEndpointConnection,
} from './transportation';

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
 * Small, visible connection targets for endpoint snapping. OSM way endpoints
 * act as the shared intersection nodes; saved editable CityJSON roads expose
 * their stored start/end anchors. Duplicates are collapsed by coordinate.
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
    if (first) addDraftCandidate(section.id, 'start', first, add);
    if (last) addDraftCandidate(section.id, 'end', last, add);
  }

  const seenLayouts = new Set<string>();
  for (const area of roadAreas) {
    if (draft?.id && area.roadId === draft.id) continue;
    const layout = area.editableDraft;
    if (!layout || seenLayouts.has(area.roadId)) continue;
    seenLayouts.add(area.roadId);
    for (const section of layout.sections) {
      const first = section.centerlineWgs84[0];
      const last = section.centerlineWgs84.at(-1);
      if (first) addSavedCandidate(area.roadId, section.id, 'start', first, add);
      if (last) addSavedCandidate(area.roadId, section.id, 'end', last, add);
    }
  }

  for (const road of osmRoads) {
    const first = road.path[0];
    const last = road.path.at(-1);
    if (first) addOsmCandidate(road.id, 'start', first, add);
    if (last) addOsmCandidate(road.id, 'end', last, add);
  }
  return candidates;
}

function addDraftCandidate(
  sectionId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
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
  });
}

function addSavedCandidate(
  roadId: string,
  sectionId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
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
  });
}

function addOsmCandidate(
  roadId: string,
  endpoint: 'start' | 'end',
  position: [number, number],
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
