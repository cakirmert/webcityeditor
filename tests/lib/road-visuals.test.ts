import { describe, expect, it } from 'vitest';
import type { RoadArea } from '../../src/lib/transportation';
import { buildRoadVisuals } from '../../src/lib/road-visuals';

function area(
  id: string,
  laneIndex: number,
  polygon: [number, number][],
  direction: 'forward' | 'backward' | 'both' = 'forward'
): RoadArea {
  return {
    id,
    roadId: 'road-1',
    sectionId: 'section-1',
    bandId: id,
    surfaceIndex: laneIndex,
    surfaceType: 'TrafficArea',
    function: 'driving_lane',
    polygon,
    attributes: {
      transportationUsage: 'car_lane',
      trafficDirection: direction,
      osm2streetsLaneIndex: laneIndex,
      sourceCenterlineWgs84: [[0, 0.5], [10, 0.5]],
    },
  };
}

describe('CityJSON road visuals', () => {
  it('derives a shared dashed divider and direction arrows from lane surfaces', () => {
    const visuals = buildRoadVisuals([
      area('lane-left', 0, [[0, 0], [10, 0], [10, 1], [0, 1], [0, 0]]),
      // Reversed ring winding must not reverse the travel arrow. Polygon order
      // is a surface-topology detail, not the stored road direction.
      area('lane-right', 1, [[0, 1], [0, 2], [10, 2], [10, 1], [0, 1]], 'backward'),
    ]);

    expect(visuals.dividers).toHaveLength(1);
    expect(visuals.dividers[0].kind).toBe('lane-divider');
    expect(visuals.dividers[0].path).toEqual([[10, 1], [0, 1]]);
    expect(visuals.directions).toHaveLength(2);
    expect(visuals.directions.map((marker) => marker.direction)).toEqual(['forward', 'backward']);
    expect(visuals.directions[0].angle).toBeCloseTo(0, 6);
    expect(Math.abs(visuals.directions[1].angle)).toBeCloseTo(180, 6);
    expect(visuals.directions.every((marker) => marker.polygon.length >= 8)).toBe(true);
  });

  it('does not draw lane arrows or dividers inside an intersection surface', () => {
    const intersection = area(
      'junction',
      0,
      [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]
    );
    intersection.function = 'intersection';
    intersection.attributes.transportationUsage = 'intersection';

    expect(buildRoadVisuals([intersection])).toEqual({ dividers: [], directions: [] });
  });
});
