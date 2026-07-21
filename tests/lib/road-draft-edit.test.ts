import { describe, expect, it } from 'vitest';
import type { RoadDraft } from '../../src/lib/transportation';
import {
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  buildRoadSnapCandidates,
  connectRoadLanes,
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
      endpoint: 'start',
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
      endpoint: 'end',
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
        endpoint: 'start',
      },
      {
        sectionId: 'section-1',
        pointIndex: 2,
        position: [10.002, 53.004],
        kind: 'vertex',
        endpoint: 'end',
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

  it('samples smooth paths while keeping the small anchor set editable', () => {
    const curved: RoadDraft = {
      ...draft,
      sections: [
        {
          ...draft.sections[0],
          curve: { mode: 'smooth', strength: 1 },
          centerlineWgs84: [
            [10, 53],
            [10.001, 53],
            [10.001, 53.001],
          ],
        },
      ],
    };

    const path = buildRoadDraftPaths(curved)[0].path;
    const handles = buildRoadDraftHandles(curved);

    expect(path.length).toBeGreaterThan(curved.sections[0].centerlineWgs84.length);
    expect(handles).toHaveLength(5);
    expect(handles[1].kind).toBe('midpoint');
    expect(handles[1].position[1]).not.toBe(53);
  });

  it('persists a confirmed endpoint snap and marks the connected handle', () => {
    const connection = {
      target: 'osm' as const,
      targetId: 'osm-way-9',
      targetEndpoint: 'start' as const,
      positionWgs84: [10.004, 53.006] as [number, number],
      confirmed: true as const,
    };
    const connected = updateRoadDraftPoint(
      draft,
      'section-1',
      1,
      connection.positionWgs84,
      connection
    );

    expect(connected.sections[0].connections?.end).toEqual(connection);
    expect(buildRoadDraftHandles(connected).at(-1)).toMatchObject({
      endpoint: 'end',
      connected: true,
      position: connection.positionWgs84,
    });
  });

  it('records explicit compatible lane mappings when road ends are connected', () => {
    const connection = connectRoadLanes(
      {
        target: 'cityjson',
        targetId: 'road-2',
        positionWgs84: [10.004, 53.006],
        confirmed: true,
      },
      draft.sections[0].bands,
      [
        { id: 'target-bike', kind: 'bike_lane', widthM: 1.8, allowedModes: ['bicycle'] },
        { id: 'target-car-a', kind: 'car_lane', widthM: 3.2, allowedModes: ['car'] },
        { id: 'target-car-b', kind: 'car_lane', widthM: 3.2, allowedModes: ['car'] },
      ]
    );

    expect(connection.laneConnections).toEqual([
      expect.objectContaining({ sourceBandId: 'lane-1', targetBandId: 'target-car-a', sourceMode: 'car' }),
      expect.objectContaining({ sourceBandId: 'lane-2', targetBandId: 'target-car-b', sourceMode: 'car' }),
    ]);
  });

  it('offers OSM endpoints as explicit road-network snap targets', () => {
    const candidates = buildRoadSnapCandidates(draft, [], [
      {
        id: 'osm-way-9',
        osmWayId: 9,
        tags: { highway: 'residential' },
        path: [
          [10.01, 53.01],
          [10.02, 53.02],
        ],
        inferredDraft: draft,
      },
    ]);

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'osm:osm-way-9:start',
          connection: expect.objectContaining({
            target: 'osm',
            targetId: 'osm-way-9',
            confirmed: true,
          }),
        }),
      ])
    );
  });
});
