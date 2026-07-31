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
  centerlineWgs84: [number, number][],
  options: {
    osmWayIds?: string[];
    sourceMapEdgeEndpointsWgs84?: Partial<
      Record<'start' | 'end', [number, number]>
    >;
    trafficDirection?: 'forward' | 'backward' | 'both';
    allowedTurns?: string[];
  } = {}
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
      ...(options.osmWayIds ? { osmWayIds: options.osmWayIds } : {}),
      ...(options.sourceMapEdgeEndpointsWgs84
        ? {
            sourceMapEdgeEndpointsWgs84:
              options.sourceMapEdgeEndpointsWgs84,
          }
        : {}),
      transportationUsage: 'car_lane',
      sourceType: 'Driving',
      trafficDirection: options.trafficDirection ?? 'both',
      allowedModes: ['car'],
      ...(options.allowedTurns
        ? {
            osm2streetsPropertiesJson: JSON.stringify({
              type: 'Driving',
              width: 3,
              allowed_turns: options.allowedTurns,
            }),
          }
        : {}),
    },
  };
}

function junctionArea(
  roadId: string,
  connectedRoadIds: string[],
  center: [number, number] = [10, 53.55],
  allowedRoadMovements?: Array<[string, string]>,
  roadEndpoints?: Record<string, 'start' | 'end'>
): RoadArea {
  const [lng, lat] = center;
  return {
    id: `${roadId}-surface`,
    roadId,
    sectionId: '',
    bandId: '',
    surfaceIndex: 0,
    surfaceType: 'TrafficArea',
    function: 'intersection',
    polygon: [
      [lng - 0.00005, lat - 0.00005],
      [lng + 0.00005, lat - 0.00005],
      [lng + 0.00005, lat + 0.00005],
      [lng - 0.00005, lat + 0.00005],
      [lng - 0.00005, lat - 0.00005],
    ],
    attributes: {
      transportationUsage: 'intersection',
      connectedRoadIds,
      ...(allowedRoadMovements ? { allowedRoadMovements } : {}),
      ...(roadEndpoints ? { roadEndpoints } : {}),
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
    expect(roadSelection.continuations).toHaveLength(6);
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
    expect(junctionSelection.continuations).toHaveLength(6);
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
    expect(selection.continuations).toHaveLength(2);
    expect(selection.continuations[0].path.length).toBeGreaterThan(2);
  });

  it('uses imported allowed_turns to exclude forbidden lane movements', () => {
    const west = exactRoadArea(
      'west',
      '1',
      [[9.999, 53.55], [10, 53.55]],
      { trafficDirection: 'forward', allowedTurns: ['through'] }
    );
    const east = exactRoadArea(
      'east',
      '2',
      [[10, 53.55], [10.001, 53.55]],
      { trafficDirection: 'forward' }
    );
    const north = exactRoadArea(
      'north',
      '3',
      [[10, 53.55], [10, 53.551]],
      { trafficDirection: 'forward' }
    );
    const junction = junctionArea('junction', ['1', '2', '3']);

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([west, east, north, junction]),
      west.id
    );

    expect(
      selection.continuations.map((continuation) => ({
        source: continuation.sourceRoadId,
        target: continuation.targetRoadId,
        turn: continuation.turn,
      }))
    ).toEqual([{ source: 'west', target: 'east', turn: 'through' }]);
  });

  it('uses authoritative road movements and pairs turn lanes without crossing or fan-out', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[10, 53.549], [10, 53.55]],
          [
            {
              id: 'left-1',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
            {
              id: 'left-2',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
            {
              id: 'right-1',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['right'],
            },
            {
              id: 'right-2',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['right'],
            },
          ]
        ),
      ],
    };
    const left: RoadDraft = {
      id: 'left',
      source: 'osm',
      sections: [
        section(
          'left-section',
          [[10, 53.55], [9.999, 53.55]],
          carBands('forward', 2)
        ),
      ],
    };
    const shallowRight: RoadDraft = {
      id: 'shallow-right',
      source: 'osm',
      sections: [
        section(
          'shallow-right-section',
          [[10, 53.55], [10.0005, 53.551]],
          carBands('forward', 2)
        ),
      ],
    };
    const unauthorizedRight: RoadDraft = {
      id: 'unauthorized-right',
      source: 'osm',
      sections: [
        section(
          'unauthorized-right-section',
          [[10, 53.55], [10.001, 53.55]],
          carBands('forward', 2)
        ),
      ],
    };
    const junction = junctionArea(
      'junction',
      ['878', '1380', '877', '624'],
      [10, 53.55],
      [
        ['878', '1380'],
        ['878', '877'],
      ],
      {
        '878': 'end',
        '1380': 'start',
        '877': 'start',
        '624': 'start',
      }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, '878'),
        roadArea('left', left, '1380'),
        roadArea('shallow-right', shallowRight, '877'),
        roadArea('unauthorized-right', unauthorizedRight, '624'),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => ({
        target: continuation.targetRoadId,
        sourceBand: continuation.sourceBandIndex,
        targetBand: continuation.targetBandIndex,
        turn: continuation.turn,
      }))
    ).toEqual([
      { target: 'left', sourceBand: 0, targetBand: 0, turn: 'left' },
      { target: 'left', sourceBand: 1, targetBand: 1, turn: 'left' },
      {
        target: 'shallow-right',
        sourceBand: 2,
        targetBand: 0,
        turn: 'right',
      },
      {
        target: 'shallow-right',
        sourceBand: 3,
        targetBand: 1,
        turn: 'right',
      },
    ]);
    expect(
      selection.continuations.some(
        (continuation) => continuation.targetRoadId === 'unauthorized-right'
      )
    ).toBe(false);
  });

  it('keeps combined turn lanes only on each permitted branch', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[10, 53.549], [10, 53.55]],
          [
            {
              id: 'left',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
            {
              id: 'left-through',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left', 'through'],
            },
            {
              id: 'through-right',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['through', 'right'],
            },
            {
              id: 'right',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['right'],
            },
          ]
        ),
      ],
    };
    const targets = [
      {
        id: 'left-target',
        externalId: 'left',
        centerline: [[10, 53.55], [9.999, 53.55]] as [number, number][],
      },
      {
        id: 'through-target',
        externalId: 'through',
        centerline: [[10, 53.55], [10, 53.551]] as [number, number][],
      },
      {
        id: 'right-target',
        externalId: 'right',
        centerline: [[10, 53.55], [10.001, 53.55]] as [number, number][],
      },
    ].map(({ id, externalId, centerline }) => {
      const draft: RoadDraft = {
        id,
        source: 'osm',
        sections: [
          section(`${id}-section`, centerline, carBands('forward', 2)),
        ],
      };
      return { id, externalId, area: roadArea(id, draft, externalId) };
    });
    const junction = junctionArea(
      'junction',
      ['source', ...targets.map(({ externalId }) => externalId)],
      [10, 53.55],
      targets.map(
        ({ externalId }) => ['source', externalId] as [string, string]
      ),
      Object.fromEntries([
        ['source', 'end'],
        ...targets.map(
          ({ externalId }) => [externalId, 'start'] as const
        ),
      ])
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, 'source'),
        ...targets.map(({ area }) => area),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => [
        continuation.targetRoadId,
        continuation.sourceBandIndex,
        continuation.targetBandIndex,
      ])
    ).toEqual([
      ['left-target', 0, 0],
      ['left-target', 1, 1],
      ['through-target', 1, 0],
      ['right-target', 2, 0],
      ['through-target', 2, 1],
      ['right-target', 3, 1],
    ]);
  });

  it('treats an explicit empty movement list as authoritative', () => {
    const west = exactRoadArea(
      'west',
      '1',
      [[9.999, 53.55], [10, 53.55]],
      { trafficDirection: 'forward' }
    );
    const east = exactRoadArea(
      'east',
      '2',
      [[10, 53.55], [10.001, 53.55]],
      { trafficDirection: 'forward' }
    );
    const junction = junctionArea(
      'junction',
      ['1', '2'],
      [10, 53.55],
      [],
      { '1': 'end', '2': 'start' }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([west, east, junction]),
      junction.id
    );

    expect(selection.continuations).toEqual([]);
  });

  it('rank-maps every lane when a multi-road junction has one authoritative exit', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[10, 53.549], [10, 53.55]],
          [
            {
              id: 'left-only',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
            {
              id: 'right-only',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['right'],
            },
          ]
        ),
      ],
    };
    const target: RoadDraft = {
      id: 'target',
      source: 'osm',
      sections: [
        section(
          'target-section',
          [[10, 53.55], [10.0005, 53.551]],
          carBands('forward', 2)
        ),
      ],
    };
    const otherApproach: RoadDraft = {
      id: 'other',
      source: 'osm',
      sections: [
        section(
          'other-section',
          [[9.999, 53.55], [10, 53.55]],
          carBands('forward', 1)
        ),
      ],
    };
    const junction = junctionArea(
      'junction',
      ['source', 'target', 'other'],
      [10, 53.55],
      [['source', 'target']],
      { source: 'end', target: 'start', other: 'end' }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, 'source'),
        roadArea('target', target, 'target'),
        roadArea('other', otherApproach, 'other'),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => ({
        sourceBand: continuation.sourceBandIndex,
        targetBand: continuation.targetBandIndex,
        target: continuation.targetRoadId,
        turn: continuation.turn,
      }))
    ).toEqual([
      {
        sourceBand: 0,
        targetBand: 0,
        target: 'target',
        turn: 'slight_right',
      },
      {
        sourceBand: 1,
        targetBand: 1,
        target: 'target',
        turn: 'slight_right',
      },
    ]);
  });

  it('distributes unspecified lanes monotonically across authoritative branches', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[10, 53.549], [10, 53.55]],
          carBands('forward', 2)
        ),
      ],
    };
    const through: RoadDraft = {
      id: 'through',
      source: 'osm',
      sections: [
        section(
          'through-section',
          [[10, 53.55], [10, 53.551]],
          carBands('forward', 1)
        ),
      ],
    };
    const right: RoadDraft = {
      id: 'right',
      source: 'osm',
      sections: [
        section(
          'right-section',
          [[10, 53.55], [10.001, 53.55]],
          carBands('forward', 1)
        ),
      ],
    };
    const junction = junctionArea(
      'junction',
      ['source', 'through', 'right'],
      [10, 53.55],
      [
        ['source', 'through'],
        ['source', 'right'],
      ],
      { source: 'end', through: 'start', right: 'start' }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, 'source'),
        roadArea('through', through, 'through'),
        roadArea('right', right, 'right'),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => [
        continuation.sourceBandIndex,
        continuation.targetRoadId,
        continuation.turn,
      ])
    ).toEqual([
      [0, 'through', 'through'],
      [1, 'right', 'right'],
    ]);
  });

  it('assigns two left lanes to two left branches without fan-out', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[10, 53.549], [10, 53.55]],
          [
            {
              id: 'left-outer',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
            {
              id: 'left-inner',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
          ]
        ),
      ],
    };
    const sharpLeft: RoadDraft = {
      id: 'sharp-left',
      source: 'osm',
      sections: [
        section(
          'sharp-left-section',
          [[10, 53.55], [9.999, 53.55]],
          carBands('forward', 1)
        ),
      ],
    };
    const shallowLeft: RoadDraft = {
      id: 'shallow-left',
      source: 'osm',
      sections: [
        section(
          'shallow-left-section',
          [[10, 53.55], [9.9995, 53.551]],
          carBands('forward', 2)
        ),
      ],
    };
    const junction = junctionArea(
      'junction',
      ['source', 'sharp-left', 'shallow-left'],
      [10, 53.55],
      [
        ['source', 'sharp-left'],
        ['source', 'shallow-left'],
      ],
      {
        source: 'end',
        'sharp-left': 'start',
        'shallow-left': 'start',
      }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, 'source'),
        roadArea('sharp-left', sharpLeft, 'sharp-left'),
        roadArea('shallow-left', shallowLeft, 'shallow-left'),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => [
        continuation.sourceBandIndex,
        continuation.targetRoadId,
        continuation.targetBandIndex,
      ])
    ).toEqual([
      [0, 'sharp-left', 0],
      [1, 'shallow-left', 1],
    ]);
  });

  it('keeps the only authoritative continuation despite downstream lane arrows', () => {
    const source: RoadDraft = {
      id: 'source',
      source: 'osm',
      sections: [
        section(
          'source-section',
          [[9.999, 53.55], [10, 53.55]],
          [
            {
              id: 'carried-right',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['right'],
            },
            {
              id: 'carried-left',
              kind: 'car_lane',
              widthM: 3,
              direction: 'forward',
              allowedTurns: ['left'],
            },
          ]
        ),
      ],
    };
    const target: RoadDraft = {
      id: 'target',
      source: 'osm',
      sections: [
        section(
          'target-section',
          [[10, 53.55], [10.001, 53.5501]],
          carBands('forward', 2)
        ),
      ],
    };
    const junction = junctionArea(
      'junction',
      ['10292', '22018'],
      [10, 53.55],
      [['10292', '22018']],
      { '10292': 'end', '22018': 'start' }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        roadArea('source', source, '10292'),
        roadArea('target', target, '22018'),
        junction,
      ]),
      'source-surface'
    );

    expect(
      selection.continuations.map((continuation) => [
        continuation.sourceBandIndex,
        continuation.targetBandIndex,
      ])
    ).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('keeps generated osm2streets road ids scoped to their source network', () => {
    const networkARoad = exactRoadArea(
      'network-a-osm2streets-road-42',
      '42',
      [[9.999, 53.55], [10, 53.55]]
    );
    const networkBRoad = exactRoadArea(
      'network-b-osm2streets-road-42',
      '42',
      [[10.029, 53.57], [10.03, 53.57]]
    );
    const networkAJunction = junctionArea(
      'network-a-osm2streets-intersection-7',
      ['42']
    );
    const networkBJunction = junctionArea(
      'network-b-osm2streets-intersection-7',
      ['42'],
      [10.03, 53.57]
    );
    const index = buildRoadConnectionIndex([
      networkARoad,
      networkBRoad,
      networkAJunction,
      networkBJunction,
    ]);

    const roadSelection = buildSelectedRoadConnections(index, networkARoad.id);
    const junctionSelection = buildSelectedRoadConnections(
      index,
      networkAJunction.id
    );

    expect([...roadSelection.roadIds]).toEqual([networkARoad.roadId]);
    expect([...roadSelection.junctionAreaIds]).toEqual([networkAJunction.id]);
    expect([...junctionSelection.roadIds]).toEqual([networkARoad.roadId]);
  });

  it('stitches exact MapEdge endpoints for the same OSM way across source networks', () => {
    const west = exactRoadArea(
      'network-west-osm2streets-road-1',
      '1',
      [[10.0001, 53.55], [9.9999, 53.55]],
      {
        osmWayIds: ['3100'],
        sourceMapEdgeEndpointsWgs84: { start: [10, 53.55] },
        trafficDirection: 'forward',
      }
    );
    const east = exactRoadArea(
      'network-east-osm2streets-road-8',
      '8',
      [[10.0002, 53.55], [9.9998, 53.55]],
      {
        osmWayIds: ['3100'],
        sourceMapEdgeEndpointsWgs84: {
          end: [10.000001, 53.55],
        },
        trafficDirection: 'forward',
      }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([west, east]),
      west.id
    );

    expect([...selection.roadIds].sort()).toEqual(
      [west.roadId, east.roadId].sort()
    );
    expect(selection.junctionAreaIds.size).toBe(0);
    expect(selection.nodes).toHaveLength(1);
    expect(selection.nodes[0]).toMatchObject({
      kind: 'junction',
      roadIds: [east.roadId, west.roadId].sort(),
    });
    expect(selection.nodes[0].position[0]).toBeCloseTo(10.0000005, 7);
    expect(selection.continuations).toHaveLength(1);
    expect(selection.continuations[0].turn).toBe('through');
  });

  it('rejects source-seam guesses without exact MapEdge, OSM-way, and direction agreement', () => {
    const selected = exactRoadArea(
      'network-west-osm2streets-road-1',
      '1',
      [[9.999, 53.55], [9.9999, 53.55]],
      {
        osmWayIds: ['3100'],
        sourceMapEdgeEndpointsWgs84: { end: [10, 53.55] },
      }
    );
    const missingMapEdge = exactRoadArea(
      'network-east-osm2streets-road-2',
      '2',
      [[10.0001, 53.55], [10.001, 53.55]],
      { osmWayIds: ['3100'] }
    );
    const differentWay = exactRoadArea(
      'network-east-osm2streets-road-3',
      '3',
      [[10.0001, 53.55], [10.001, 53.55]],
      {
        osmWayIds: ['9999'],
        sourceMapEdgeEndpointsWgs84: { start: [10, 53.55] },
      }
    );
    const sameDirection = exactRoadArea(
      'network-east-osm2streets-road-4',
      '4',
      [[10.0001, 53.55], [9.9992, 53.55]],
      {
        osmWayIds: ['3100'],
        sourceMapEdgeEndpointsWgs84: { start: [10, 53.55] },
      }
    );
    const distantReference = exactRoadArea(
      'network-east-osm2streets-road-5',
      '5',
      [[10.0001, 53.55], [10.001, 53.55]],
      {
        osmWayIds: ['3100'],
        sourceMapEdgeEndpointsWgs84: { start: [10.00002, 53.55] },
      }
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([
        selected,
        missingMapEdge,
        differentWay,
        sameDirection,
        distantReference,
      ]),
      selected.id
    );

    expect([...selection.roadIds]).toEqual([selected.roadId]);
    expect(selection.nodes).toEqual([]);
    expect(selection.continuations).toEqual([]);
  });

  it('does not render a junction continuation to approaches over one kilometre away', () => {
    const west = exactRoadArea(
      'network-a-osm2streets-road-1',
      '1',
      [[10.029, 53.55], [10.03, 53.55]]
    );
    const east = exactRoadArea(
      'network-a-osm2streets-road-2',
      '2',
      [[10.03, 53.5501], [10.031, 53.5501]]
    );
    const junction = junctionArea(
      'network-a-osm2streets-intersection-9',
      ['1', '2']
    );

    const selection = buildSelectedRoadConnections(
      buildRoadConnectionIndex([west, east, junction]),
      junction.id
    );

    expect([...selection.roadIds].sort()).toEqual([east.roadId, west.roadId].sort());
    expect(selection.continuations).toEqual([]);
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
