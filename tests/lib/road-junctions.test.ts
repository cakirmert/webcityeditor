import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { intersection } from 'polygon-clipping';
import proj4 from 'proj4';
import type { CityJsonDocument } from '../../src/types';
import { checkIntegrity } from '../../src/lib/integrity';
import { buildRoadPreviewAreas, createManualRoadDraft, extractTransportationAreas, insertRoadIntoCityJson } from '../../src/lib/transportation';
import { buildRoadConnectionIndex, buildSelectedRoadConnections, roadMovementKey } from '../../src/lib/road-lane-continuations';
import { buildConnectedJunctionPreview, buildRoadJunctionPlan, createRoadJunctionAtEndpoint, readRoadJunction, saveRoadJunction, type RoadJunctionDraft } from '../../src/lib/road-junctions';
import { localJunctionProjection, junctionPolygonArea } from '../../src/lib/junction-footprint';

function fixture(fourWay = false) {
  const doc: CityJsonDocument = { type: 'CityJSON', version: '2.0', transform: { scale: [.001, .001, .001], translate: [565000, 5935000, 0] }, metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832' }, vertices: [[0, 0, 0]], CityObjects: {} };
  const point = (x: number, y: number) => proj4('EPSG:25832', 'EPSG:4326', [565000 + x, 5935000 + y]) as [number, number];
  const approaches: Array<[string, [number, number], [number, number]]> = [['west', [-60, 0], [-6, 0]], ['east', [6, 0], [60, 0]], ['north', [0, 6], [0, 60]]];
  if (fourWay) approaches.push(['south', [0, -60], [0, -6]]);
  for (const [id, start, end] of approaches) {
    const draft = createManualRoadDraft([point(start[0], start[1]), point(end[0], end[1])], { name: id, bands: [
      { id: 'back', kind: 'car_lane', widthM: 3.25, direction: 'backward' },
      { id: 'forward', kind: 'car_lane', widthM: 3.25, direction: 'forward' },
    ] });
    insertRoadIntoCityJson(doc, draft, { id });
  }
  const draft: RoadJunctionDraft = { id: 'junction-test', name: 'Test junction', roadIds: ['west', 'east', 'north'], endpoints: { west: 'end', east: 'start', north: 'start' }, disabledMovements: [], surfaceMode: 'rebuild', curveFactor: 1 / 3 };
  if (fourWay) { draft.roadIds.push('south'); draft.endpoints.south = 'end'; }
  return { doc, draft };
}

describe('intersection editing and construction', () => {
  it('constructs physical pavement when every lane points away from the junction', () => {
    const { doc, draft } = fixture();
    const areas = extractTransportationAreas(doc);
    for (const area of areas) for (const section of area.editableDraft!.sections) for (const band of section.bands) band.direction = draft.endpoints[area.roadId] === 'start' ? 'forward' : 'backward';
    const plan = buildRoadJunctionPlan(draft, areas);
    expect(plan.error).toBeUndefined();
    expect(plan.movements).toHaveLength(0);
    expect(plan.areas.filter(area => area.roadId === draft.id).length).toBeGreaterThan(0);
    saveRoadJunction(doc, draft, plan);
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('retains source island openings when regenerating automatic kerbs', () => {
    const { doc, draft } = fixture(true);
    const p = (x: number, y: number) => proj4('EPSG:25832', 'EPSG:4326', [565000 + x, 5935000 + y]) as [number, number];
    const island = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
    draft.footprint = { polygon: [p(-15,-15), p(15,-15), p(15,15), p(-15,15)], holes: [island], source: 'drawn' };
    saveRoadJunction(doc, draft, buildRoadJunctionPlan(draft, extractTransportationAreas(doc)));
    const plan = buildRoadJunctionPlan({ ...draft, footprint: undefined }, extractTransportationAreas(doc));
    expect(plan.error).toBeUndefined();
    expect(plan.footprint?.holes).toHaveLength(1);
    const { project } = localJunctionProjection(island[0]);
    for (const area of plan.areas) expect(junctionPolygonArea(intersection([area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))], [island.map(project)]))).toBeLessThan(.001);
  });
  it('builds both new endpoint junctions without restoring pavement under the other join', () => {
    const { doc } = fixture();
    const areas = extractTransportationAreas(doc);
    const west = areas.find(area => area.roadId === 'west')!.editableDraft!, east = areas.find(area => area.roadId === 'east')!.editableDraft!;
    const from = west.sections[0].centerlineWgs84.at(-1)!, to = east.sections[0].centerlineWgs84[0];
    const road = createManualRoadDraft([from, to], { name: 'Link', bands: west.sections[0].bands });
    road.sections[0].connections = {
      start: { target: 'cityjson', targetId: 'west', targetEndpoint: 'end', targetSectionId: west.sections[0].id, positionWgs84: from, confirmed: true },
      end: { target: 'cityjson', targetId: 'east', targetEndpoint: 'start', targetSectionId: east.sections[0].id, positionWgs84: to, confirmed: true },
    };
    const result = buildConnectedJunctionPreview(areas, buildRoadPreviewAreas(doc, road, { id: 'link' }));
    expect(result.error).toBeUndefined();
    expect(result.plans).toHaveLength(2);
    const { project } = localJunctionProjection(from);
    for (const patch of result.areas.filter(area => area.function === 'intersection')) for (const approach of result.areas.filter(area => area.roadId === 'link')) {
      expect(junctionPolygonArea(intersection([patch.polygon.map(project), ...(patch.holes ?? []).map(ring => ring.map(project))], [approach.polygon.map(project), ...(approach.holes ?? []).map(ring => ring.map(project))]))).toBeLessThan(.02);
    }
    insertRoadIntoCityJson(doc, road, { id: 'link' });
    result.plans.forEach(({ draft, plan }) => saveRoadJunction(doc, draft, plan));
    expect(checkIntegrity(doc).ok).toBe(true);
    const repeated = buildConnectedJunctionPreview(extractTransportationAreas(doc), buildRoadPreviewAreas(doc, road, { id: 'link' }));
    expect(repeated.error).toBeUndefined();
    expect(repeated.plans).toHaveLength(2);
  });
  it('infers missing imported endpoints and builds the real Mattentwiete junction without invented islands', () => {
    const doc = JSON.parse(readFileSync('public/examples/hamburg-mattentwiete-source.json', 'utf8')) as CityJsonDocument;
    const areas = extractTransportationAreas(doc);
    const draft = readRoadJunction(areas, 'hh-road-r00-c00-osm2streets-intersection-177');
    expect(Object.keys(draft.endpoints)).toHaveLength(4);
    expect(draft.endpoints['hh-road-r00-c00-osm2streets-road-175']).toBe('end');
    const plan = buildRoadJunctionPlan({ ...draft, surfaceMode: 'rebuild' }, areas);
    expect(plan.error).toBeUndefined();
    expect(plan.footprint?.holes).toEqual([]);
    expect(plan.areas.find(area => area.roadId === draft.id && area.attributes.sourceType === 'Driving')?.holes).toEqual([]);
    expect(plan.areas.some(area => area.roadId === draft.id && area.attributes.sourceType === 'Sidewalk')).toBe(true);
  });
  it('round-trips the traced reference and keeps junction surfaces disjoint from the approaches', () => {
    const doc = JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json', 'utf8')) as CityJsonDocument;
    const areas = extractTransportationAreas(doc), draft = readRoadJunction(areas, 'hh-road-r00-c00-osm2streets-intersection-177');
    draft.surfaceMode = 'rebuild';
    const original = JSON.stringify(draft.footprint);
    const plan = buildRoadJunctionPlan(draft, areas);
    expect(plan.error).toBeUndefined();
    const { project } = localJunctionProjection(draft.footprint!.polygon[0]);
    const poly = (area: (typeof areas)[number]) => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))];
    for (const junction of plan.areas.filter(area => area.roadId === draft.id)) {
      for (const approach of plan.areas.filter(area => area.roadId !== draft.id)) {
        expect(junctionPolygonArea(intersection(poly(junction), poly(approach)))).toBeLessThan(.01);
      }
    }
    saveRoadJunction(doc, draft, plan);
    expect(JSON.stringify(readRoadJunction(extractTransportationAreas(doc), draft.id).footprint)).toBe(original);
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('keeps islands open across both the junction and underlying approach pavement', () => {
    const { doc, draft } = fixture(true);
    const point = (x: number, y: number) => proj4('EPSG:25832', 'EPSG:4326', [565000 + x, 5935000 + y]) as [number, number];
    draft.footprint = { polygon: [point(-15, -15), point(15, -15), point(15, 15), point(-15, 15)], holes: [[point(-9, -1), point(-7, -1), point(-7, 1), point(-9, 1)]], source: 'drawn' };
    const plan = buildRoadJunctionPlan(draft, extractTransportationAreas(doc));
    expect(plan.error).toBeUndefined();
    const { project } = localJunctionProjection(draft.footprint.polygon[0]);
    for (const area of plan.areas) expect(junctionPolygonArea(intersection([area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))], [draft.footprint.holes[0].map(project)]))).toBeLessThan(.001);
    expect(plan.warnings?.join(' ')).toMatch(/connections cross an island/);
    saveRoadJunction(doc, draft, plan);
    expect(readRoadJunction(extractTransportationAreas(doc), draft.id).footprint?.holes).toHaveLength(1);
  });
  it('rejects a detached trace without changing the document', () => {
    const { doc, draft } = fixture(); const before = JSON.stringify(doc);
    const p = (x: number, y: number) => proj4('EPSG:25832', 'EPSG:4326', [565000 + x, 5935000 + y]) as [number, number];
    draft.footprint = { polygon: [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], holes: [], source: 'drawn' };
    expect(buildRoadJunctionPlan(draft, extractTransportationAreas(doc)).error).toMatch(/does not reach/);
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('constructs and saves a four-arm intersection with every incoming road connected', () => {
    const { doc, draft } = fixture(true); const plan = buildRoadJunctionPlan(draft, extractTransportationAreas(doc));
    expect(plan.error).toBeUndefined();
    expect(new Set(plan.movements.map((movement) => movement.sourceRoadId)).size).toBe(4);
    expect(plan.movements).toHaveLength(12);
    saveRoadJunction(doc, draft, plan);
    expect(checkIntegrity(doc).ok).toBe(true);
    expect(readRoadJunction(extractTransportationAreas(doc), draft.id).roadIds).toHaveLength(4);
  });
  it('constructs the committed short Hamburg junction without losing structure', () => {
    const doc = JSON.parse(readFileSync('public/data/transportation/osm2streets-hamburg-short-intersection.city.json', 'utf8')) as CityJsonDocument;
    const areas = extractTransportationAreas(doc), draft = readRoadJunction(areas, 'osm2streets-intersection-3');
    draft.surfaceMode = 'rebuild';
    const plan = buildRoadJunctionPlan(draft, areas);
    expect(plan.error).toBeUndefined();
    expect(plan.movements.length).toBeGreaterThan(0);
    saveRoadJunction(doc, draft, plan);
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('constructs a T-junction with disjoint surfaces and trims all approaches', () => {
    const { doc, draft } = fixture(); const areas = extractTransportationAreas(doc);
    const plan = buildRoadJunctionPlan(draft, areas);
    expect(plan.error).toBeUndefined(); expect(plan.movements.length).toBeGreaterThanOrEqual(6);
    expect(plan.replacedRoadIds).toEqual(['junction-test', 'west', 'east', 'north']);
    const junction = plan.areas.filter((area) => area.roadId === draft.id);
    for (const area of plan.areas.filter((area) => area.roadId !== draft.id)) {
      for (const patch of junction) {
        const overlap = intersection([area.polygon, ...(area.holes ?? [])], [patch.polygon, ...(patch.holes ?? [])]);
        // Degree→metre round trips can leave numerical slivers at shared edges.
        expect(squareMetres(overlap)).toBeLessThan(0.000001);
      }
    }
    saveRoadJunction(doc, draft, plan);
    expect(checkIntegrity(doc).ok).toBe(true);
    expect(readRoadJunction(extractTransportationAreas(doc), draft.id).roadIds).toEqual(['east', 'north', 'west']);
  });
  it('rebuilds repeatedly without progressively consuming the approaches', () => {
    const { doc, draft } = fixture();
    const initial = buildRoadJunctionPlan(draft, extractTransportationAreas(doc));
    saveRoadJunction(doc, draft, initial);
    for (let i = 0; i < 3; i++) {
      const next = buildRoadJunctionPlan(draft, extractTransportationAreas(doc));
      expect(next.error).toBeUndefined();
      expect(squareMetres(next.areas.filter((area) => area.roadId === 'west').map((area) => [area.polygon, ...(area.holes ?? [])]))).toBeCloseTo(squareMetres(initial.areas.filter((area) => area.roadId === 'west').map((area) => [area.polygon, ...(area.holes ?? [])])), 4);
      saveRoadJunction(doc, draft, next);
    }
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('adapts a constructed junction to a widened approach in one preview', () => {
    const { doc, draft } = fixture();
    saveRoadJunction(doc, draft, buildRoadJunctionPlan(draft, extractTransportationAreas(doc)));
    const previous = JSON.stringify(doc.CityObjects[draft.id].geometry);
    const saved = extractTransportationAreas(doc).find((area) => area.roadId === 'west')!.editableDraft!;
    saved.sections[0].bands[0].widthM = 4;
    insertRoadIntoCityJson(doc, saved, { id: 'west' });
    const areas = extractTransportationAreas(doc);
    const preview = buildConnectedJunctionPreview(areas, areas.filter((area) => area.roadId === 'west'));
    expect(preview.error).toBeUndefined(); expect(preview.plans).toHaveLength(1);
    preview.plans.forEach(({ draft, plan }) => saveRoadJunction(doc, draft, plan));
    expect(JSON.stringify(doc.CityObjects[draft.id].geometry)).not.toBe(previous);
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('stores disabled lane movements without changing source geometry', () => {
    const { doc, draft } = fixture(); const plan = buildRoadJunctionPlan(draft, extractTransportationAreas(doc));
    saveRoadJunction(doc, draft, plan);
    const vertices = JSON.stringify(doc.vertices), geometry = JSON.stringify(doc.CityObjects[draft.id].geometry);
    const edit = readRoadJunction(extractTransportationAreas(doc), draft.id);
    const currentPlan = buildRoadJunctionPlan(edit, extractTransportationAreas(doc));
    edit.disabledMovements = [roadMovementKey(currentPlan.movements[0])];
    saveRoadJunction(doc, edit, currentPlan);
    expect(JSON.stringify(doc.vertices)).toBe(vertices); expect(JSON.stringify(doc.CityObjects[draft.id].geometry)).toBe(geometry);
    const index = buildRoadConnectionIndex(extractTransportationAreas(doc));
    const connections = buildSelectedRoadConnections(index, `${draft.id}-surface-0`);
    expect(connections.continuations.map(roadMovementKey)).not.toContain(edit.disabledMovements[0]);
    expect(buildRoadJunctionPlan(readRoadJunction(extractTransportationAreas(doc), draft.id), extractTransportationAreas(doc)).movements.map(roadMovementKey)).toContain(edit.disabledMovements[0]);
  });
  it('refuses to join grade-separated roads', () => {
    const { doc, draft } = fixture(); const areas = extractTransportationAreas(doc).map((area) => area.roadId === 'north' ? { ...area, vertical: { placement: 'elevated' as const, source: 'user' as const, elevationM: 8 } } : area);
    expect(buildRoadJunctionPlan(draft, areas).error).toMatch(/different levels/);
  });
  it('changes curved connectors without moving their ends', () => {
    const { doc, draft } = fixture(); const areas = extractTransportationAreas(doc);
    const a = buildRoadJunctionPlan(draft, areas), b = buildRoadJunctionPlan({ ...draft, curveFactor: .6 }, areas);
    expect(b.error).toBeUndefined();
    expect(b.movements[0].path[0]).toEqual(a.movements[0].path[0]);
    expect(b.movements[0].path.at(-1)).toEqual(a.movements[0].path.at(-1));
    expect(b.movements[0].path).not.toEqual(a.movements[0].path);
  });
  it('rejects a small height step between otherwise flat approaches', () => {
    const { doc, draft } = fixture();
    const areas = extractTransportationAreas(doc).map((area) => ({ ...area, vertical: { placement: 'surface' as const, source: 'user' as const, elevationM: area.roadId === 'north' ? .25 : 0 } }));
    expect(buildRoadJunctionPlan(draft, areas).error).toMatch(/shared, flat elevation/);
  });
  it('requires a confirmed endpoint join before creating a new intersection', () => {
    const { doc } = fixture();
    expect(() => createRoadJunctionAtEndpoint(extractTransportationAreas(doc), 'west', 'section-1', 'end')).toThrow(/confirmed join/);
  });
});

function squareMetres(polygons: number[][][][]): number {
  return polygons.reduce((sum, polygon) => sum + polygon.reduce((area, ring, index) => {
    const origin = ring[0];
    const points = ring.map((point) => [(point[0] - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180), (point[1] - origin[1]) * 110540]);
    const absolute = Math.abs(points.reduce((total, point, i) => { const next = points[(i + 1) % points.length]; return total + point[0] * next[1] - next[0] * point[1]; }, 0)) / 2;
    return area + (index ? -absolute : absolute);
  }, 0), 0);
}
