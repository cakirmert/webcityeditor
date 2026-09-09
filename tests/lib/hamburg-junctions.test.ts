import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { extractTransportationAreas, type RoadArea } from '../../src/lib/transportation';
import { buildRoadJunctionPlan, readRoadJunction } from '../../src/lib/road-junctions';
import { junctionPolygonArea, localJunctionProjection, validateJunctionFootprint } from '../../src/lib/junction-footprint';
import { validateRoadOverlaps } from '../../src/lib/road-fit';

describe('real Hamburg intersection regressions', () => {
  let areas: RoadArea[];
  beforeAll(() => { areas = extractTransportationAreas(JSON.parse(readFileSync('public/data/hamburg/hamburg-city-center-roads.city.json', 'utf8'))); });
  it.each([0, 2, 12, 17, 177, 182, 302, 144, 299, 305])('constructs source junction %i with valid, disjoint junction and approach pavement', number => {
    const id = `hh-road-r00-c00-osm2streets-intersection-${number}`;
    const draft = readRoadJunction(areas, id);
    const local = areas.filter(area => area.roadId === id || draft.roadIds.includes(area.roadId));
    const before = JSON.stringify(local);
    const plan = buildRoadJunctionPlan({ ...draft, surfaceMode: 'rebuild' }, local);
    expect(plan.error).toBeUndefined();
    expect(validateJunctionFootprint(plan.footprint)).toBeUndefined();
    expect(JSON.stringify(local)).toBe(before);
    if (number === 2) {
      // Coincident kerbs here broke the float sweep line in both projections.
      expect(validateRoadOverlaps(plan.areas, areas)).toEqual([]);
      expect(validateRoadOverlaps(plan.areas, areas, 'EPSG:25832')).toEqual([]);
    }
    const { project } = localJunctionProjection(plan.footprint!.polygon[0]);
    const poly = (area: RoadArea) => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))];
    for (const patch of plan.areas.filter(area => area.roadId === id)) for (const approach of plan.areas.filter(area => area.roadId !== id)) {
      expect(junctionPolygonArea(polygonClipping.intersection(poly(patch), poly(approach)))).toBeLessThan(.04);
    }
  });
});
