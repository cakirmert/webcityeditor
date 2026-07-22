import { describe, expect, it } from 'vitest';
import type { RoadArea } from '../../src/lib/transportation';
import {
  elevateRoadPath,
  elevateRoadPolygon,
  roadDepthTestEnabled,
} from '../../src/lib/road-rendering';

const area: RoadArea = {
  id: 'road-1-surface-0',
  roadId: 'road-1',
  sectionId: 'section-1',
  bandId: 'lane-1',
  surfaceIndex: 0,
  surfaceType: 'TrafficArea',
  function: 'car_lane',
  polygon: [[10, 53], [10.001, 53], [10, 53.001], [10, 53]],
  vertical: { placement: 'surface', source: 'manual', elevationM: 3 },
  attributes: {},
};

describe('road rendering helpers', () => {
  it('places surface roads just above sampled terrain', () => {
    const polygon = elevateRoadPolygon(area, ([lng]) => lng === 10 ? 8 : 9);

    expect(polygon[0]).toEqual([10, 53, 8.12]);
    expect(polygon[1]).toEqual([10.001, 53, 9.12]);
  });

  it('preserves explicit bridge elevation instead of clamping it to terrain', () => {
    const path = elevateRoadPath(
      [[10, 53]],
      { placement: 'elevated', source: 'cityjson_geometry', elevationM: 21 },
      () => 8
    );

    expect(path).toEqual([[10, 53, 21.12]]);
  });

  it('only disables road depth testing inside the road workspace', () => {
    expect(roadDepthTestEnabled(false)).toBe(true);
    expect(roadDepthTestEnabled(true)).toBe(false);
  });
});
