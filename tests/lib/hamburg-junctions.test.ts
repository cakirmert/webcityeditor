import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { extractTransportationAreas, type RoadArea } from '../../src/lib/transportation';
import { buildRoadJunctionPlan, readRoadJunction, saveRoadJunction } from '../../src/lib/road-junctions';
import { checkIntegrity } from '../../src/lib/integrity';
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
    const plan = buildRoadJunctionPlan({ ...draft, surfaceMode: 'rebuild' }, areas);
    expect(plan.error).toBeUndefined();
    expect(validateJunctionFootprint(plan.footprint)).toBeUndefined();
    expect(JSON.stringify(local)).toBe(before);
    // Include the saved surroundings: isolated fixtures previously missed
    // encroachment into a neighbour or the next short source intersection.
    expect(validateRoadOverlaps(plan.areas, areas)).toEqual([]);
    expect(validateRoadOverlaps(plan.areas, areas, 'EPSG:25832')).toEqual([]);
    const { project } = localJunctionProjection(plan.footprint!.polygon[0]);
    const poly = (area: RoadArea) => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))];
    for (const patch of plan.areas.filter(area => area.roadId === id)) for (const approach of plan.areas.filter(area => area.roadId !== id)) {
      expect(junctionPolygonArea(polygonClipping.intersection(poly(patch), poly(approach)))).toBeLessThan(.04);
    }
  });
  it.each([182, 302, 144])('saves and regenerates fitted junction %i without changing neighbouring roads', number => {
    const doc = JSON.parse(readFileSync('public/data/hamburg/hamburg-city-center-roads.city.json', 'utf8'));
    const id = `hh-road-r00-c00-osm2streets-intersection-${number}`;
    const draft = { ...readRoadJunction(areas, id), surfaceMode: 'rebuild' as const };
    const neighbours = Object.fromEntries(Object.entries(doc.CityObjects).filter(([roadId]) => roadId !== id && !draft.roadIds.includes(roadId)));
    const before = JSON.stringify(neighbours);
    const first = buildRoadJunctionPlan(draft, areas);
    expect(first.error).toBeUndefined();
    expect(first.warnings?.join(' ')).toMatch(/neighbouring roads?/);
    saveRoadJunction(doc, draft, first);
    const saved = extractTransportationAreas(doc);
    expect(checkIntegrity(doc).ok).toBe(true);
    expect(JSON.stringify(Object.fromEntries(Object.keys(neighbours).map(id => [id, doc.CityObjects[id]])))).toBe(before);
    const reopened = readRoadJunction(saved, id);
    expect(reopened.surfaceMode).toBe('preserve');
    expect(buildRoadJunctionPlan(reopened, saved).areas).toEqual(saved.filter(a => a.roadId === id));
    const next = buildRoadJunctionPlan({ ...reopened, surfaceMode: 'rebuild' }, saved);
    expect(next.error).toBeUndefined();
    expect(validateRoadOverlaps(next.areas, saved, 'EPSG:25832')).toEqual([]);
  });
});
