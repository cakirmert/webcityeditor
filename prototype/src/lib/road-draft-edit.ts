import type { RoadDraft } from './transportation';

export interface RoadDraftHandle {
  sectionId: string;
  pointIndex: number;
  position: [number, number];
  kind: 'vertex' | 'midpoint';
}

export interface RoadDraftPath {
  sectionId: string;
  path: [number, number][];
}

function finiteLngLat(point: [number, number]): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

export function buildRoadDraftPaths(draft: RoadDraft | null): RoadDraftPath[] {
  if (!draft) return [];
  return draft.sections
    .map((section) => ({
      sectionId: section.id,
      path: section.centerlineWgs84.filter(finiteLngLat),
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
      handles.push({
        sectionId: section.id,
        pointIndex,
        position,
        kind: 'vertex',
      });
      const next = points[pointIndex + 1];
      if (next && finiteLngLat(next)) {
        handles.push({
          sectionId: section.id,
          pointIndex: pointIndex + 1,
          position: [(position[0] + next[0]) / 2, (position[1] + next[1]) / 2],
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
      if (pointIndex < 0 || pointIndex >= centerlineWgs84.length) return section;
      centerlineWgs84[pointIndex] = position;
      return { ...section, centerlineWgs84 };
    }),
  };
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
