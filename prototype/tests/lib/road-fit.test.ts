import { describe, expect, it } from 'vitest';
import { validateRoadFit } from '../../src/lib/road-fit';
import type { Footprint } from '../../src/lib/footprints';
import type { RoadArea } from '../../src/lib/transportation';
import { projectToWgs84 } from '../../src/lib/projection';

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

function metricRoadArea(id: string, polygon: [number, number][]): RoadArea {
  return {
    ...roadArea,
    id,
    polygon: polygon.map((point) =>
      projectToWgs84('EPSG:25832', { x: point[0], y: point[1], z: 0 })
    ),
  };
}

function metricFootprint(id: string, polygon: [number, number][]): Footprint {
  return footprint(
    id,
    polygon.map((point) =>
      projectToWgs84('EPSG:25832', { x: point[0], y: point[1], z: 0 })
    )
  );
}

function expectPolygonBounds(
  polygon: [number, number][],
  expected: [number, number, number, number]
): void {
  const xs = polygon.map(([lng]) => lng);
  const ys = polygon.map(([, lat]) => lat);
  expect(Math.min(...xs)).toBeCloseTo(expected[0], 6);
  expect(Math.min(...ys)).toBeCloseTo(expected[1], 6);
  expect(Math.max(...xs)).toBeCloseTo(expected[2], 6);
  expect(Math.max(...ys)).toBeCloseTo(expected[3], 6);
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
    expectPolygonBounds(conflicts[0].polygon, [2, 0.5, 3, 1]);
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
    expectPolygonBounds(conflicts[0].polygon, [3, 0.25, 4, 1]);
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
    expectPolygonBounds(conflicts[0].polygon, [2, 0, 4, 1]);
  });

  it('blocks road polygons outside a trusted corridor when requested', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      allowedCorridors: [{
        id: 'approved-corridor',
        polygon: [[0, -0.2], [2, -0.2], [2, 1.2], [0, 1.2], [0, -0.2]],
      }],
      corridorSeverity: 'error',
    });

    expect(conflicts[0]).toMatchObject({
      kind: 'outside_corridor',
      severity: 'error',
    });
  });

  it('accepts road polygons that exactly follow an allowed corridor boundary', () => {
    const conflicts = validateRoadFit({
      roadAreas: [roadArea],
      allowedCorridors: [
        {
          id: 'corridor-1',
          polygon: roadArea.polygon,
        },
      ],
    });

    expect(conflicts).toEqual([]);
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

  it('warns when a road surface is inside the building clearance threshold', () => {
    const conflicts = validateRoadFit({
      metricCrs: 'EPSG:25832',
      buildingClearanceWarningM: 1,
      roadAreas: [
        metricRoadArea('road-near-building', [
          [565000, 5935000],
          [565004, 5935000],
          [565004, 5935001],
          [565000, 5935001],
          [565000, 5935000],
        ]),
      ],
      buildingFootprints: [
        metricFootprint('building-near', [
          [565004.4, 5935000],
          [565005.4, 5935000],
          [565005.4, 5935001],
          [565004.4, 5935001],
          [565004.4, 5935000],
        ]),
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'building_clearance',
      severity: 'warning',
      affectedId: 'building-near',
    });
    expect(conflicts[0].clearanceM).toBeGreaterThan(0.35);
    expect(conflicts[0].clearanceM).toBeLessThan(0.45);
  });

  it('blocks when a road surface violates the hard building clearance threshold', () => {
    const conflicts = validateRoadFit({
      metricCrs: 'EPSG:25832',
      buildingClearanceBlockM: 0.5,
      buildingClearanceWarningM: 1,
      roadAreas: [
        metricRoadArea('road-too-close-to-building', [
          [565000, 5935000],
          [565004, 5935000],
          [565004, 5935001],
          [565000, 5935001],
          [565000, 5935000],
        ]),
      ],
      buildingFootprints: [
        metricFootprint('building-hard-clearance', [
          [565004.4, 5935000],
          [565005.4, 5935000],
          [565005.4, 5935001],
          [565004.4, 5935001],
          [565004.4, 5935000],
        ]),
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'building_clearance',
      severity: 'error',
      affectedId: 'building-hard-clearance',
    });
    expect(conflicts[0].label).toContain('hard clearance');
  });

  it('keeps building clearance between the hard and warning thresholds as a warning', () => {
    const conflicts = validateRoadFit({
      metricCrs: 'EPSG:25832',
      buildingClearanceBlockM: 0.5,
      buildingClearanceWarningM: 1,
      roadAreas: [
        metricRoadArea('road-warning-close-to-building', [
          [565000, 5935000],
          [565004, 5935000],
          [565004, 5935001],
          [565000, 5935001],
          [565000, 5935000],
        ]),
      ],
      buildingFootprints: [
        metricFootprint('building-warning-clearance', [
          [565004.75, 5935000],
          [565005.75, 5935000],
          [565005.75, 5935001],
          [565004.75, 5935001],
          [565004.75, 5935000],
        ]),
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'building_clearance',
      severity: 'warning',
      affectedId: 'building-warning-clearance',
    });
    expect(conflicts[0].clearanceM).toBeGreaterThan(0.7);
    expect(conflicts[0].clearanceM).toBeLessThan(0.8);
  });

  it('does not warn when a road surface stays outside the building clearance threshold', () => {
    const conflicts = validateRoadFit({
      metricCrs: 'EPSG:25832',
      buildingClearanceWarningM: 1,
      roadAreas: [
        metricRoadArea('road-clear-of-building', [
          [565000, 5935000],
          [565004, 5935000],
          [565004, 5935001],
          [565000, 5935001],
          [565000, 5935000],
        ]),
      ],
      buildingFootprints: [
        metricFootprint('building-clear', [
          [565005.2, 5935000],
          [565006.2, 5935000],
          [565006.2, 5935001],
          [565005.2, 5935001],
          [565005.2, 5935000],
        ]),
      ],
    });

    expect(conflicts).toEqual([]);
  });

  it('downgrades a 2D tunnel overlap to vertical uncertainty when elevation is missing', () => {
    const conflicts = validateRoadFit({
      roadAreas: [
        {
          ...roadArea,
          vertical: { placement: 'underground', source: 'osm_tags', osmLayer: -1 },
        },
      ],
      buildingFootprints: [
        footprint('building-over-tunnel', [
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
      kind: 'vertical_uncertainty',
      severity: 'warning',
      affectedId: 'building-over-tunnel',
    });
    expect(conflicts[0].label).toContain('OSM layer -1');
  });

  it('accepts a plan overlap when the road elevation is vertically clear of the building', () => {
    const conflicts = validateRoadFit({
      roadAreas: [
        {
          ...roadArea,
          vertical: { placement: 'elevated', source: 'user', elevationM: 12 },
        },
      ],
      buildingFootprints: [
        footprint('building-below-road', [
          [2, 0.5],
          [3, 0.5],
          [3, 1.5],
          [2, 1.5],
          [2, 0.5],
        ]),
      ],
      verticalClearanceM: 0.5,
    });

    expect(conflicts).toEqual([]);
  });

  it('keeps a known vertical collision blocking', () => {
    const conflicts = validateRoadFit({
      roadAreas: [
        {
          ...roadArea,
          vertical: { placement: 'elevated', source: 'user', elevationM: 5 },
        },
      ],
      buildingFootprints: [
        footprint('building-at-road-level', [
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
      affectedId: 'building-at-road-level',
    });
    expect(conflicts[0].label).toContain('vertical range');
  });

  it('treats a known elevation inside the building range as blocking even when placement is unknown', () => {
    const conflicts = validateRoadFit({
      roadAreas: [
        {
          ...roadArea,
          vertical: { placement: 'unknown', source: 'cityjson_geometry', elevationM: 5 },
        },
      ],
      buildingFootprints: [
        footprint('building-at-unknown-road', [
          [2, 0.5],
          [3, 0.5],
          [3, 1.5],
          [2, 1.5],
          [2, 0.5],
        ]),
      ],
    });

    expect(conflicts[0]).toMatchObject({ kind: 'building_overlap', severity: 'error' });
  });

  it('suppresses horizontal clearance warnings for a vertically separated road', () => {
    const conflicts = validateRoadFit({
      metricCrs: 'EPSG:25832',
      buildingClearanceWarningM: 1,
      roadAreas: [
        {
          ...metricRoadArea('road-above-building', [
            [565000, 5935000],
            [565004, 5935000],
            [565004, 5935001],
            [565000, 5935001],
            [565000, 5935000],
          ]),
          vertical: { placement: 'elevated', source: 'user', elevationM: 20 },
        },
      ],
      buildingFootprints: [
        metricFootprint('building-near-below', [
          [565004.4, 5935000],
          [565005.4, 5935000],
          [565005.4, 5935001],
          [565004.4, 5935001],
          [565004.4, 5935000],
        ]),
      ],
    });

    expect(conflicts).toEqual([]);
  });

  it('keeps conflicts unique per road area and building', () => {
    const building = footprint('building-crossed-by-two-bands', [
      [2, 0.5],
      [3, 0.5],
      [3, 1.5],
      [2, 1.5],
      [2, 0.5],
    ]);
    const conflicts = validateRoadFit({
      roadAreas: [roadArea, { ...roadArea, id: 'road-preview-surface-2' }],
      buildingFootprints: [building],
    });

    expect(conflicts).toHaveLength(2);
    expect(new Set(conflicts.map((conflict) => conflict.id)).size).toBe(2);
  });
});
