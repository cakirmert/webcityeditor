import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import {
  buildRoadPreviewAreas,
  createManualRoadDraft,
  type RoadDraft,
} from '../../src/lib/transportation';
import type { RoadLaneContinuation } from '../../src/lib/road-lane-continuations';
import {
  roadAreaMatchesDraftBand,
  roadLaneContinuationMatchesDraftBand,
} from '../../src/lib/road-selection';

describe('road band map selection', () => {
  it('matches generated preview areas by their preview road id', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft([
      [4.35704, 52.01158],
      [4.35742, 52.01164],
    ]);
    draft.id = 'saved-road';
    const preview = buildRoadPreviewAreas(doc, draft, {
      id: '__road_preview__',
    });
    const selection = {
      sectionId: draft.sections[0].id,
      bandIndex: 1,
    };

    expect(preview[1].id).not.toMatch(/^__road_preview__/);
    expect(preview[1].roadId).toBe('__road_preview__');
    expect(roadAreaMatchesDraftBand(preview[1], draft, selection)).toBe(true);
    expect(roadAreaMatchesDraftBand(preview[0], draft, selection)).toBe(false);
  });

  it('matches either end of a lane continuation to the selected draft band', () => {
    const continuation = {
      sourceRoadId: 'source-road',
      sourceSectionId: 'source-section',
      sourceBandIndex: 2,
      targetRoadId: 'target-road',
      targetSectionId: 'target-section',
      targetBandIndex: 0,
    } as RoadLaneContinuation;
    const sourceDraft: RoadDraft = {
      id: 'source-road',
      source: 'manual',
      sections: [],
    };

    expect(
      roadLaneContinuationMatchesDraftBand(continuation, sourceDraft, {
        sectionId: 'source-section',
        bandIndex: 2,
      })
    ).toBe(true);
    expect(
      roadLaneContinuationMatchesDraftBand(continuation, sourceDraft, {
        sectionId: 'source-section',
        bandIndex: 1,
      })
    ).toBe(false);
  });

  it('matches lane continuations for an unsaved preview draft', () => {
    expect(
      roadLaneContinuationMatchesDraftBand(
        {
          sourceRoadId: '__road_preview__',
          sourceSectionId: 'new-section',
          sourceBandIndex: 0,
        } as RoadLaneContinuation,
        {
          source: 'manual',
          sections: [],
        },
        {
          sectionId: 'new-section',
          bandIndex: 0,
        }
      )
    ).toBe(true);
  });
});
