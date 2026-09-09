// Reconstruct every loaded Hamburg junction without mutating the source data.
// This checks geometry and newly introduced road overlap, not imagery accuracy.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const output = resolve(process.argv[2] ?? 'test-output/hamburg-intersections.json');
const source = 'public/data/hamburg/hamburg-city-center-roads.city.json';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['polygon-clipping'] } });
try {
  const { extractTransportationAreas } = await server.ssrLoadModule('/src/lib/transportation.ts');
  const { buildRoadConnectionIndex } = await server.ssrLoadModule('/src/lib/road-lane-continuations.ts');
  const { readRoadJunction, buildRoadJunctionPlan } = await server.ssrLoadModule('/src/lib/road-junctions.ts');
  const { validateRoadOverlaps } = await server.ssrLoadModule('/src/lib/road-fit.ts');
  const { activeMetricCrsForCityJson } = await server.ssrLoadModule('/src/lib/projection.ts');
  const document = JSON.parse(await readFile(source, 'utf8'));
  const areas = extractTransportationAreas(document), index = buildRoadConnectionIndex(areas);
  const junctions = [];
  for (const junction of index.junctions.filter(junction => junction.roadIds.length >= 3)) {
    const draft = readRoadJunction(areas, junction.roadId);
    const local = areas.filter(area => area.roadId === draft.id || draft.roadIds.includes(area.roadId));
    const plan = buildRoadJunctionPlan({ ...draft, surfaceMode: 'rebuild' }, local);
    const conflicts = plan.error ? [] : validateRoadOverlaps(plan.areas, areas, activeMetricCrsForCityJson(document));
    const blocking = conflicts.filter(conflict => conflict.severity === 'error');
    junctions.push({
      id: draft.id, streets: [...new Set(draft.roadIds.map(id => index.areasByRoadId.get(id)?.[0]?.attributes.roadName))],
      position: junction.position, roads: draft.roadIds.length, turns: plan.movements.length,
      boundaryPoints: plan.footprint?.polygon.length ?? 0,
      outcome: plan.error ? 'construction-blocked' : blocking.length ? 'overlap-blocked' : 'geometry-candidate',
      error: plan.error ?? null, conflicts: conflicts.map(({ kind, severity, affectedId, label, overlapAreaM2 }) => ({ kind, severity, affectedId, label, overlapAreaM2 })),
    });
  }
  const counts = Object.fromEntries(['geometry-candidate', 'construction-blocked', 'overlap-blocked'].map(outcome => [outcome, junctions.filter(junction => junction.outcome === outcome).length]));
  const report = { source, checkedAt: new Date().toISOString(), scope: 'Loaded source junctions with at least three approaches. No building/tree or imagery accuracy certification.', count: junctions.length, counts, junctions };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, count: report.count, counts }, null, 2));
} finally { await server.close(); }
