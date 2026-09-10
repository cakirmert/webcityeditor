import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseCityJsonSeqStrict } from '../../src/lib/cityjsonseq-catalog';
import { mergeCityJson } from '../../src/lib/merge';
import { extractTransportationAreas } from '../../src/lib/transportation';
import { buildRoadJunctionPlan, readRoadJunction, saveRoadJunction } from '../../src/lib/road-junctions';
import { suggestJunctionCluster, consolidateJunctionCluster } from '../../src/lib/junction-clusters';
import { intersection, union, difference } from '../../src/lib/polygon-boolean';
import { junctionPolygonArea, localJunctionProjection } from '../../src/lib/junction-footprint';
import { compactVertices } from '../../src/lib/compact';
import { checkIntegrity } from '../../src/lib/integrity';

const directory = 'public/data/hamburg/roads/';
const catalog = JSON.parse(readFileSync(`${directory}catalog.json`, 'utf8'));
const tiles = catalog.tiles.filter((tile: { id: string }) => ['hh-road-e564-n5933', 'hh-road-e565-n5933'].includes(tile.id));
const load = () => {
  const parts = tiles.map((tile: { file: string }) => parseCityJsonSeqStrict(gunzipSync(readFileSync(directory + tile.file)).toString()));
  expect(mergeCityJson(parts[0], parts[1]).ok).toBe(true); return parts[0];
};
const id = 'hh-road-r00-c01-r01-c01-r00-c00-r00-c00-osm2streets-intersection-3376';
const distanceToSegment = (p: number[], a: number[], b: number[]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

describe('reported Rödingsmarkt source fragments', () => {
  it('regenerates the selected intersection without absorbing any neighbouring road or junction, including after reopening', () => {
    const doc = load(), before = JSON.parse(JSON.stringify(doc)), areas = extractTransportationAreas(doc);
    const selected = readRoadJunction(areas, id);
    expect(suggestJunctionCluster(areas, id, 'larger')!.internalRoadIds.length).toBeGreaterThan(10);
    const changedIds = new Set([id, ...selected.roadIds]);
    for (let pass = 0; pass < 2; pass++) {
      const current = extractTransportationAreas(doc);
      const draft = { ...readRoadJunction(current, id), surfaceMode: 'rebuild' as const, footprint: undefined };
      const plan = buildRoadJunctionPlan(draft, current);
      expect(plan.error).toBeUndefined();
      expect(plan.removedRoadIds).toEqual([]);
      expect(new Set(plan.replacedRoadIds)).toEqual(changedIds);
      saveRoadJunction(doc, draft, plan);
      expect(Object.keys(doc.CityObjects).sort()).toEqual(Object.keys(before.CityObjects).sort());
      for (const [roadId, object] of Object.entries(before.CityObjects)) {
        if (!changedIds.has(roadId)) expect(doc.CityObjects[roadId]).toEqual(object);
        else expect(doc.CityObjects[roadId].geometry?.length).toBeGreaterThan(0);
      }
    }
    expect(checkIntegrity(doc).ok).toBe(true);
  });

  it.each(['nearby', 'larger'] as const)('removes detached cycling rectangles in the %s merge, keeping full approach widths through save', extent => {
    const doc = load(), areas = extractTransportationAreas(doc);
    const group = suggestJunctionCluster(areas, id, extent)!;
    const draft = consolidateJunctionCluster(areas, readRoadJunction(areas, id), group), plan = buildRoadJunctionPlan(draft, areas);
    expect(draft.retainedCycleways!.length).toBeGreaterThan(10); expect(plan.error).toBeUndefined();
    const ends = plan.baseApproaches!.filter(area => area.attributes.sourceType === 'Biking');
    const { project } = localJunctionProjection(ends[0].polygon[0]);
    const poly = (area: typeof areas[number]) => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))];
    const inspect = (next: typeof areas) => {
      const cycleAreas = next.filter(area => (area.roadId === id || draft.roadIds.includes(area.roadId)) && area.attributes.sourceType === 'Biking');
      const shapes = cycleAreas.map(poly), network = union(shapes[0], ...shapes.slice(1));
      for (const end of ends) expect(junctionPolygonArea(difference(poly(end), network))).toBeLessThan(.08);
      const reached = new Set(network.map((part, index) => ends.some(end => junctionPolygonArea(intersection(part, poly(end))) > .001) ? index : -1)); reached.delete(-1);
      // Shared boundary points and millimetre export seams count as attached.
      let added = true;
      while (added) { added = false; network.forEach((part, index) => {
        if (reached.has(index)) return;
        if ([...reached].some(other => part[0].some(point => network[other][0].slice(1).some((b, i) => distanceToSegment(point, network[other][0][i], b) < .004)))) { reached.add(index); added = true; }
      }); }
      expect(network.filter((part, index) => !reached.has(index) && junctionPolygonArea([part]) > .04)).toEqual([]);
    };
    inspect(plan.areas); saveRoadJunction(doc, draft, plan); compactVertices(doc); inspect(extractTransportationAreas(doc));
    expect(checkIntegrity(doc).ok).toBe(true);
  });
});
