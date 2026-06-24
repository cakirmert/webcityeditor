import { describe, expect, it } from 'vitest';
import type { RoadDraft } from '../../src/lib/transportation';
import {
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  insertRoadDraftPoint,
  updateRoadDraftPoint,
} from '../../src/lib/road-draft-edit';

const draft: RoadDraft = {
  id: 'road-1',
  source: 'manual',
  userVerified: false,
  sections: [
    {
      id: 'section-1',
      centerlineWgs84: [
        [10, 53],
        [10.002, 53.004],
      ],
      bands: [
        { id: 'lane-1', kind: 'car_lane', widthM: 3.25 },
        { id: 'lane-2', kind: 'car_lane', widthM: 3.25 },
      ],
    },
  ],
};

describe('road draft edit helpers', () => {
  it('builds vertex and midpoint handles for draggable centerline editing', () => {
    expect(buildRoadDraftPaths(draft)).toEqual([
      {
        sectionId: 'section-1',
        path: [
          [10, 53],
          [10.002, 53.004],
        ],
      },
    ]);

    const handles = buildRoadDraftHandles(draft);
    expect(handles[0]).toEqual({
      sectionId: 'section-1',
      pointIndex: 0,
      position: [10, 53],
      kind: 'vertex',
    });
    expect(handles[1]).toMatchObject({
      sectionId: 'section-1',
      pointIndex: 1,
      kind: 'midpoint',
    });
    expect(handles[1].position[0]).toBeCloseTo(10.001);
    expect(handles[1].position[1]).toBeCloseTo(53.002);
    expect(handles[2]).toEqual({
      sectionId: 'section-1',
      pointIndex: 1,
      position: [10.002, 53.004],
      kind: 'vertex',
    });
    expect(handles).toHaveLength(3);
  });

  it('keeps handle indices aligned with the original centerline array', () => {
    const dirtyDraft: RoadDraft = {
      ...draft,
      sections: [
        {
          ...draft.sections[0],
          centerlineWgs84: [
            [10, 53],
            [Number.NaN, 53.001],
            [10.002, 53.004],
          ],
        },
      ],
    };

    expect(buildRoadDraftHandles(dirtyDraft)).toEqual([
      {
        sectionId: 'section-1',
        pointIndex: 0,
        position: [10, 53],
        kind: 'vertex',
      },
      {
        sectionId: 'section-1',
        pointIndex: 2,
        position: [10.002, 53.004],
        kind: 'vertex',
      },
    ]);
  });

  it('updates an existing vertex without mutating the original draft', () => {
    const next = updateRoadDraftPoint(draft, 'section-1', 1, [10.003, 53.005]);

    expect(next.userVerified).toBe(true);
    expect(next.sections[0].centerlineWgs84).toEqual([
      [10, 53],
      [10.003, 53.005],
    ]);
    expect(draft.sections[0].centerlineWgs84).toEqual([
      [10, 53],
      [10.002, 53.004],
    ]);
  });

  it('inserts a dragged midpoint as a new centerline vertex', () => {
    const next = insertRoadDraftPoint(draft, 'section-1', 1, [10.001, 53.002]);

    expect(next.userVerified).toBe(true);
    expect(next.sections[0].centerlineWgs84).toEqual([
      [10, 53],
      [10.001, 53.002],
      [10.002, 53.004],
    ]);
  });
});
