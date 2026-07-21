import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import {
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  type RoadDraft,
} from '../../src/lib/transportation';
import {
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  buildRoadSnapCandidates,
  compatibleRoadLaneSnapCandidates,
  compatibleRoadSnapCandidates,
  connectRoadLanes,
  insertRoadDraftPoint,
  updateRoadDraftPoint,
  type RoadSnapCandidate,
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

  it('maps only reciprocal lane directions and exact shared transport modes', () => {
    const connection = connectRoadLanes(
      {
        target: 'cityjson',
        targetId: 'road-2',
        targetEndpoint: 'start',
        positionWgs84: [10.004, 53.006],
        confirmed: true,
      },
      [
        { id: 'source-in', kind: 'car_lane', widthM: 3.2, direction: 'forward', allowedModes: ['car'] },
        { id: 'source-out', kind: 'car_lane', widthM: 3.2, direction: 'backward', allowedModes: ['bus'] },
        { id: 'source-shared', kind: 'sidewalk', widthM: 3, direction: 'both', allowedModes: ['pedestrian', 'bicycle'] },
      ],
      [
        { id: 'target-out', kind: 'car_lane', widthM: 3.2, direction: 'forward', allowedModes: ['car'] },
        { id: 'target-car-in', kind: 'car_lane', widthM: 3.2, direction: 'backward', allowedModes: ['car'] },
        { id: 'target-bike', kind: 'bike_lane', widthM: 1.8, direction: 'both', allowedModes: ['bicycle'] },
      ],
      'end'
    );

    expect(connection.laneConnections).toEqual([
      expect.objectContaining({
        sourceBandId: 'source-in',
        targetBandId: 'target-out',
        sourceDirection: 'forward',
        targetDirection: 'forward',
        sourceMode: 'car',
        targetMode: 'car',
      }),
      expect.objectContaining({
        sourceBandId: 'source-shared',
        targetBandId: 'target-bike',
        sourceDirection: 'both',
        targetDirection: 'both',
        sourceMode: 'bicycle',
        targetMode: 'bicycle',
      }),
    ]);
    expect(connection.laneConnections?.some((lane) => lane.sourceBandId === 'source-out')).toBe(false);
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

  it('offers exact imported CityJSON road endpoints before a layout has been saved', () => {
    const doc = JSON.parse(readFileSync(
      'public/data/transportation/osm2streets-hamburg-short-intersection.city.json',
      'utf8'
    )) as CityJsonDocument;
    const areas = extractTransportationAreas(doc);
    const active = deriveEditableRoadDraftFromAreas(areas, 'osm2streets-road-0');

    const candidates = buildRoadSnapCandidates(active, areas, []);

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.stringContaining('cityjson:osm2streets-road-1:'),
        connection: expect.objectContaining({
          target: 'cityjson',
          targetId: 'osm2streets-road-1',
        }),
        targetBands: expect.arrayContaining([
          expect.objectContaining({ kind: 'car_lane', allowedModes: ['car'] }),
        ]),
      }),
    ]));
  });

  it('keeps every nearby compatible endpoint discoverable and filters incompatible modes', () => {
    const candidates: RoadSnapCandidate[] = Array.from({ length: 9 }, (_, index) => ({
      id: `cityjson:target-${index}:section:end`,
      position: [10 + (index + 1) * 0.00001, 53] as [number, number],
      connection: {
        target: 'cityjson' as const,
        targetId: `target-${index}`,
        targetSectionId: 'section',
        targetEndpoint: 'end' as const,
        positionWgs84: [10 + (index + 1) * 0.00001, 53] as [number, number],
        confirmed: true as const,
      },
      targetBands: [{
        id: `target-car-${index}`,
        kind: 'car_lane' as const,
        widthM: 3.2,
        direction: 'forward' as const,
        allowedModes: ['car'],
      }],
    }));
    candidates.push({
      id: 'cityjson:pedestrian-only:section:end',
      position: [10.00002, 53],
      connection: {
        target: 'cityjson',
        targetId: 'pedestrian-only',
        targetSectionId: 'section',
        targetEndpoint: 'end',
        positionWgs84: [10.00002, 53],
        confirmed: true,
      },
      targetBands: [{
        id: 'target-sidewalk',
        kind: 'sidewalk',
        widthM: 2,
        direction: 'both',
        allowedModes: ['pedestrian'],
      }],
    });

    const compatible = compatibleRoadSnapCandidates(
      draft,
      'section-1',
      'start',
      candidates,
      80
    );

    expect(compatible).toHaveLength(9);
    expect(compatible.every((candidate) => candidate.compatibleLaneCount === 2)).toBe(true);
    expect(compatible.map((candidate) => candidate.id)).not.toContain(
      'cityjson:pedestrian-only:section:end'
    );
    expect(compatible.map((candidate) => candidate.distanceMeters)).toEqual(
      [...compatible.map((candidate) => candidate.distanceMeters)].sort((a, b) => a! - b!)
    );
  });

  it('expands a road end into exact outgoing lane targets for one incoming lane', () => {
    const source: RoadDraft = {
      ...draft,
      sections: [{
        ...draft.sections[0],
        centerlineWgs84: [[10, 53], [10.001, 53]],
        bands: [
          { id: 'source-car', kind: 'car_lane', widthM: 3.2, direction: 'forward', allowedModes: ['car'] },
          { id: 'source-bike', kind: 'bike_lane', widthM: 1.8, direction: 'forward', allowedModes: ['bicycle'] },
        ],
      }],
    };
    const targetSection = {
      id: 'target-section',
      centerlineWgs84: [[10.00102, 53], [10.002, 53.001]] as [number, number][],
      bands: [
        { id: 'target-car-a', kind: 'car_lane' as const, widthM: 3.2, direction: 'forward' as const, allowedModes: ['car'] },
        { id: 'target-car-b', kind: 'car_lane' as const, widthM: 3.2, direction: 'forward' as const, allowedModes: ['car'] },
        { id: 'target-car-in', kind: 'car_lane' as const, widthM: 3.2, direction: 'backward' as const, allowedModes: ['car'] },
        { id: 'target-walk', kind: 'sidewalk' as const, widthM: 2, direction: 'both' as const, allowedModes: ['pedestrian'] },
      ],
    };
    const candidates: RoadSnapCandidate[] = [{
      id: 'cityjson:target-road:target-section:start',
      position: targetSection.centerlineWgs84[0],
      connection: {
        target: 'cityjson',
        targetId: 'target-road',
        targetSectionId: 'target-section',
        targetEndpoint: 'start',
        positionWgs84: targetSection.centerlineWgs84[0],
        confirmed: true,
      },
      targetBands: targetSection.bands,
      targetSection,
    }];

    const laneTargets = compatibleRoadLaneSnapCandidates(
      source,
      'section-1',
      'end',
      0,
      candidates,
      80
    );

    expect(laneTargets).toHaveLength(2);
    expect(laneTargets.map((candidate) => candidate.targetBand.id)).toEqual([
      'target-car-b',
      'target-car-a',
    ]);
    expect(laneTargets.every((candidate) => candidate.sharedMode === 'car')).toBe(true);
    expect(laneTargets[0].position).not.toEqual(laneTargets[1].position);
    expect(compatibleRoadLaneSnapCandidates(
      source,
      'section-1',
      'start',
      0,
      candidates,
      80
    )).toEqual([]);
  });
});
