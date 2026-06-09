import { describe, expect, it } from 'vitest';
import { validateRoadFit } from './road-fit';
import type { Footprint } from './footprints';
import type { RoadArea } from './transportation';

const roadArea: RoadArea = {
  id: 'road-preview-surface-1',
  roadId: 'road-preview',
  sectionId: 'section-1',
  bandId: 'car-forward',
  surfaceIndex: 0,
  surfaceType: 'TrafficArea',
  function: 'driving_lane',
  polygon: [
    [0, 0],
    [4, 0],
    [4, 1],
    [0, 1],
    [0, 0],
  ],
  attributes: {},
};

function footprint(id: string, polygon: [number, number][]): Footprint {
  return {
    id,
    type: 'Building',
    polygon: polygon.map(([lng, lat]) => [lng, lat, 0]),
    height: 10,
    baseElevation: 0,
    attributes: {},
  };
}

describe('road-fit validation', () => {
  it('flags road surfaces that overlap loaded building footprints', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      buildingFootprints: [
        footprint('building-a', [
          [2, 0.5],
          [3, 0.5],
          [3, 1.5],
          [2, 1.5],
          [2, 0.5],
        ]),
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'building_overlap',
      severity: 'error',
      affectedId: 'building-a',
    });
  });

  it('flags affected planning or lot polygons as warnings', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      affectedLand: [
        {
          id: 'lot-1',
          label: 'Lot 1',
          polygon: [
            [3, 0.25],
            [5, 0.25],
            [5, 1.25],
            [3, 1.25],
            [3, 0.25],
          ],
        },
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'affected_land',
      severity: 'warning',
      affectedId: 'lot-1',
    });
  });

  it('flags road polygons outside an allowed corridor', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      allowedCorridors: [
        {
          id: 'corridor-1',
          polygon: [
            [0, -0.2],
            [2, -0.2],
            [2, 1.2],
            [0, 1.2],
            [0, -0.2],
          ],
        },
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'outside_corridor',
      severity: 'warning',
      roadAreaId: roadArea.id,
    });
  });

  it('returns no conflicts when a road fits its corridor and misses buildings', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      buildingFootprints: [
        footprint('building-away', [
          [10, 10],
          [11, 10],
          [11, 11],
          [10, 11],
          [10, 10],
        ]),
      ],
      allowedCorridors: [
        {
          id: 'corridor-1',
          polygon: [
            [-1, -1],
            [5, -1],
            [5, 2],
            [-1, 2],
            [-1, -1],
          ],
        },
      ],
    });

    expect(conflicts).toEqual([]);
  });
});
