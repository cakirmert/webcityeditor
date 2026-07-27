import { describe, expect, it } from 'vitest';
import type {
  RoadArea,
  RoadBand,
  RoadDraft,
  RoadSectionDraft,
} from '../../src/lib/transportation';
import {
  buildConfirmedRoadLaneContinuations,
  buildRoadConnectionIndex,
  buildSelectedRoadConnections,
} from '../../src/lib/road-lane-continuations';

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

function roadArea(
  roadId: string,
  draft: RoadDraft,
  osm2streetsRoadId?: string
): RoadArea {
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
    attributes: {
      ...(osm2streetsRoadId ? { osm2streetsRoadId } : {}),
    },
  };
}

function exactRoadArea(
  roadId: string,
  osm2streetsRoadId: string,
  centerlineWgs84: [number, number][]
): RoadArea {
  return {
    id: `${roadId}-surface`,
    roadId,
    sectionId: `${roadId}-section`,
    bandId: `${roadId}-band`,
    surfaceIndex: 0,
    surfaceType: 'TrafficArea',
    function: 'driving_lane',
    polygon: [
      centerlineWgs84[0],
      centerlineWgs84.at(-1)!,
      [
        centerlineWgs84.at(-1)![0] + 0.00001,
        centerlineWgs84.at(-1)![1] + 0.00001,
      ],
      centerlineWgs84[0],
    ],
    attributes: {
      osm2streetsRoadId,
      sourceCenterlineWgs84: centerlineWgs84,
      transportationUsage: 'car_lane',
      sourceType: 'Driving',
      trafficDirection: 'both',
      allowedModes: ['car'],
    },
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

  it('keeps a rejected reciprocal movement hidden after layout reload', () => {
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
      laneMovementDecisions: [
        {
          id: 'reject-middle-lane',
          status: 'rejected',
          source: {
            roadId: 'target',
            sectionId: 'target-section',
            endpoint: 'start',
            bandId: 'lane-2',
          },
          target: {
            roadId: 'source',
            sectionId: 'source-section',
            endpoint: 'end',
            bandId: 'lane-2',
          },
          mode: 'car',
          provenance: {
            source: 'osm2streets',
            sourceId: 'hamburg-short-intersection',
          },
        },
      ],
    };

    const continuations = buildConfirmedRoadLaneContinuations(
      connect(source, 'end', target, 'start')
    );

    expect(
      continuations.map((item) => [
        item.sourceBandId,
        item.targetBandId,
      ])
    ).toEqual([
      ['lane-1', 'lane-1'],
      ['lane-3', 'lane-3'],
    ]);
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

  it('shows every lane movement and connected node for a clicked junction road', () => {
    const sharedBand: RoadBand = {
      id: 'car',
      kind: 'car_lane',
      widthM: 3.2,
      direction: 'both',
    };
    const west: RoadDraft = {
      id: 'west',
      source: 'manual',
      sections: [
        section(
          'west-section',
          [[9.999, 53.55], [10, 53.55]],
          [{ ...sharedBand }]
        ),
      ],
    };
    const east: RoadDraft = {
      id: 'east',
      source: 'manual',
      sections: [
        section(
          'east-section',
          [[10, 53.55], [10.001, 53.55]],
          [{ ...sharedBand }]
        ),
      ],
    };
    const north: RoadDraft = {
      id: 'north',
      source: 'manual',
      sections: [
        section(
          'north-section',
          [[10, 53.55], [10, 53.551]],
          [{ ...sharedBand }]
        ),
      ],
    };
    const junction: RoadArea = {
      id: 'junction-surface',
      roadId: 'junction',
      sectionId: '',
      bandId: '',
      surfaceIndex: 0,
      surfaceType: 'TrafficArea',
      function: 'intersection',
      polygon: [
        [9.99995, 53.54995],
        [10.00005, 53.54995],
        [10.00005, 53.55005],
        [9.99995, 53.55005],
        [9.99995, 53.54995],
      ],
      attributes: {
        transportationUsage: 'intersection',
        connectedRoadIds: ['1', '2', '3'],
      },
    };
    const areas = [
      roadArea('west', west, '1'),
      roadArea('east', east, '2'),
      roadArea('north', north, '3'),
      junction,
    ];
    const index = buildRoadConnectionIndex(areas);

    const roadSelection = buildSelectedRoadConnections(
      index,
      'west-surface'
    );
    const junctionSelection = buildSelectedRoadConnections(
      index,
      junction.id
    );

    expect([...roadSelection.roadIds].sort()).toEqual(['east', 'north', 'west']);
    expect([...roadSelection.junctionAreaIds]).toEqual([junction.id]);
    expect(roadSelection.nodes).toHaveLength(1);
    expect(roadSelection.continuations).toHaveLength(3);
    expect(
      roadSelection.continuations.every(
        (continuation) => continuation.path.length > 2
      )
    ).toBe(true);
    expect([...junctionSelection.roadIds].sort()).toEqual([
      'east',
      'north',
      'west',
    ]);
    expect(junctionSelection.continuations).toHaveLength(3);
  });

  it('derives visible connections for exact imported roads without saved editor layouts', () => {
    const west = exactRoadArea(
      'west',
      '1',
      [[9.999, 53.55], [10, 53.55]]
    );
    const east = exactRoadArea(
      'east',
      '2',
      [[10, 53.55], [10.001, 53.55]]
    );
    const junction: RoadArea = {
      id: 'junction-surface',
      roadId: 'junction',
      sectionId: '',
      bandId: '',
      surfaceIndex: 0,
      surfaceType: 'TrafficArea',
      function: 'intersection',
      polygon: [
        [9.99995, 53.54995],
        [10.00005, 53.54995],
        [10.00005, 53.55005],
        [9.99995, 53.55005],
        [9.99995, 53.54995],
      ],
      attributes: {
        transportationUsage: 'intersection',
        connectedRoadIds: ['1', '2'],
      },
    };

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([west, east, junction]),
      west.id
    );

    expect([...selection.roadIds].sort()).toEqual(['east', 'west']);
    expect(selection.nodes).toHaveLength(1);
    expect(selection.continuations).toHaveLength(1);
    expect(selection.continuations[0].path.length).toBeGreaterThan(2);
  });

  it('shows a snapped connection before a new road has been saved', () => {
    const target = exactRoadArea(
      'target',
      '2',
      [[10, 53.55], [10.001, 53.55]]
    );
    const activeDraft: RoadDraft = {
      source: 'manual',
      sections: [
        section(
          'new-section',
          [[9.999, 53.55], [10, 53.55]],
          [{
            id: 'new-lane',
            kind: 'car_lane',
            widthM: 3.2,
            direction: 'both',
          }]
        ),
      ],
    };
    activeDraft.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: target.roadId,
        targetSectionId: target.sectionId,
        targetEndpoint: 'start',
        positionWgs84: [10, 53.55],
        confirmed: true,
      },
    };

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([target]),
      null,
      activeDraft
    );

    expect(selection.focusRoadId).toBe('__road_preview__');
    expect([...selection.roadIds].sort()).toEqual([
      '__road_preview__',
      'target',
    ]);
    expect(selection.nodes).toHaveLength(1);
    expect(selection.continuations).toHaveLength(1);
  });
});
