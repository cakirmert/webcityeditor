import { describe, expect, it } from 'vitest';
import type {
  RoadArea,
  RoadBand,
  RoadDraft,
  RoadSectionDraft,
} from '../../src/lib/transportation';
import { buildConfirmedRoadLaneContinuations } from '../../src/lib/road-lane-continuations';

function carBands(direction: 'forward' | 'backward', count = 3): RoadBand[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `lane-${index + 1}`,
    kind: 'car_lane' as const,
    widthM: 3.2,
    direction,
  }));
}

function section(
  id: string,
  centerlineWgs84: [number, number][],
  bands: RoadBand[]
): RoadSectionDraft {
  return { id, centerlineWgs84, bands, curve: { mode: 'straight', strength: 0 } };
}

function roadArea(roadId: string, draft: RoadDraft): RoadArea {
  return {
    id: `${roadId}-surface`,
    roadId,
    sectionId: draft.sections[0].id,
    bandId: draft.sections[0].bands[0].id ?? 'band-1',
    surfaceIndex: 0,
    surfaceType: 'TrafficArea',
    function: 'driving_lane',
    polygon: [
      [9.99, 53.55],
      [9.991, 53.55],
      [9.991, 53.55001],
      [9.99, 53.55001],
      [9.99, 53.55],
    ],
    editableDraft: draft,
    attributes: {},
  };
}

function connect(
  source: RoadDraft,
  sourceEndpoint: 'start' | 'end',
  target: RoadDraft,
  targetEndpoint: 'start' | 'end'
): RoadArea[] {
  source.sections[0].connections = {
    [sourceEndpoint]: {
      target: 'cityjson',
      targetId: target.id!,
      targetSectionId: target.sections[0].id,
      targetEndpoint,
      positionWgs84: [10, 53.55],
      confirmed: true,
    },
  };
  target.sections[0].connections = {
    [targetEndpoint]: {
      target: 'cityjson',
      targetId: source.id!,
      targetSectionId: source.sections[0].id,
      targetEndpoint: sourceEndpoint,
      positionWgs84: [10, 53.55],
      confirmed: true,
    },
  };
  return [roadArea(source.id!, source), roadArea(target.id!, target)];
}

describe('confirmed road lane continuations', () => {
  it('preserves target order for an end-to-start three-lane continuation', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'manual',
      sections: [
        section('source-section', [[9.999, 53.55], [10, 53.55]], carBands('forward')),
      ],
    };
    const target: RoadDraft = {
      id: 'target',
      source: 'manual',
      sections: [
        section('target-section', [[10, 53.55], [10.001, 53.55]], carBands('forward')),
      ],
    };

    const continuations = buildConfirmedRoadLaneContinuations(
      connect(source, 'end', target, 'start')
    );

    expect(continuations.map((item) => [item.sourceBandIndex, item.targetBandIndex])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(continuations.every((item) => item.turn === 'through')).toBe(true);
    expect(continuations.every((item) => item.polygon.length > 4)).toBe(true);
  });

  it('reverses target order for an end-to-end three-lane continuation', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'manual',
      sections: [
        section('source-section', [[9.999, 53.55], [10, 53.55]], carBands('forward')),
      ],
    };
    const target: RoadDraft = {
      id: 'target',
      source: 'manual',
      sections: [
        section('target-section', [[10.001, 53.55], [10, 53.55]], carBands('backward')),
      ],
    };

    const continuations = buildConfirmedRoadLaneContinuations(
      connect(source, 'end', target, 'end')
    );

    expect(continuations.map((item) => [item.sourceBandIndex, item.targetBandIndex])).toEqual([
      [0, 2],
      [1, 1],
      [2, 0],
    ]);
    expect(continuations.every((item) => item.turn === 'through')).toBe(true);
  });

  it('filters non-connectable, incompatible-mode, and wrong-direction bands', () => {
    const sourceBands: RoadBand[] = [
      { id: 'car', kind: 'car_lane', widthM: 3.2, direction: 'forward' },
      { id: 'bike', kind: 'bike_lane', widthM: 1.8, direction: 'forward' },
      { id: 'walk', kind: 'sidewalk', widthM: 2, direction: 'none' },
      { id: 'median', kind: 'median', widthM: 1, direction: 'none' },
    ];
    const targetBands: RoadBand[] = [
      { id: 'wrong-bike', kind: 'bike_lane', widthM: 1.8, direction: 'backward' },
      { id: 'car', kind: 'car_lane', widthM: 3.2, direction: 'forward' },
      { id: 'walk', kind: 'sidewalk', widthM: 2, direction: 'none' },
      { id: 'parking', kind: 'parking', widthM: 2.1, direction: 'none' },
    ];
    const source: RoadDraft = {
      id: 'source',
      source: 'manual',
      sections: [
        section('source-section', [[9.999, 53.55], [10, 53.55]], sourceBands),
      ],
    };
    const target: RoadDraft = {
      id: 'target',
      source: 'manual',
      sections: [
        section('target-section', [[10, 53.55], [10.001, 53.55]], targetBands),
      ],
    };

    const continuations = buildConfirmedRoadLaneContinuations(
      connect(source, 'end', target, 'start')
    );

    expect(continuations.map((item) => [item.mode, item.sourceBandIndex, item.targetBandIndex]))
      .toEqual([
        ['car', 0, 1],
        ['pedestrian', 2, 2],
      ]);
  });
});
