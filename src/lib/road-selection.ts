import type { RoadArea, RoadDraft } from './transportation';
import type { RoadLaneContinuation } from './road-lane-continuations';

export interface RoadBandSelection {
  sectionId: string;
  bandIndex: number;
}

export function roadAreaMatchesDraftBand(
  area: RoadArea,
  draft: RoadDraft | null,
  selection: RoadBandSelection | null
): boolean {
  if (!draft || !selection || area.sectionId !== selection.sectionId) return false;
  const preview =
    area.roadId === '__road_preview__' ||
    area.id.startsWith('__road_preview__');
  if (draft.id ? area.roadId !== draft.id && !preview : !preview) return false;
  const section = draft.sections.find(
    (candidate) => candidate.id === selection.sectionId
  );
  const band = section?.bands[selection.bandIndex];
  return !!band && area.bandId === (band.id ?? `band-${selection.bandIndex + 1}`);
}

export function roadLaneContinuationMatchesDraftBand(
  continuation: RoadLaneContinuation,
  draft: RoadDraft | null,
  selection: RoadBandSelection | null
): boolean {
  if (!draft || !selection) return false;
  const draftRoadId = draft.id ?? '__road_preview__';
  return (
    (continuation.sourceRoadId === draftRoadId &&
      continuation.sourceSectionId === selection.sectionId &&
      continuation.sourceBandIndex === selection.bandIndex) ||
    (continuation.targetRoadId === draftRoadId &&
      continuation.targetSectionId === selection.sectionId &&
      continuation.targetBandIndex === selection.bandIndex)
  );
}
