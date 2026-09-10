import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const output = 'test-output/intersection-review';
const source = 'public/data/hamburg/hamburg-city-center-roads.city.json';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['polygon-clipping'] } });
try {
  const { extractTransportationAreas } = await server.ssrLoadModule('/src/lib/transportation.ts');
  const { buildRoadConnectionIndex } = await server.ssrLoadModule('/src/lib/road-lane-continuations.ts');
  const { readRoadJunction, buildRoadJunctionPlan } = await server.ssrLoadModule('/src/lib/road-junctions.ts');
  const { validateRoadOverlaps } = await server.ssrLoadModule('/src/lib/road-fit.ts');
  const { activeMetricCrsForCityJson } = await server.ssrLoadModule('/src/lib/projection.ts');
  const { suggestJunctionCluster, consolidateJunctionCluster } = await server.ssrLoadModule('/src/lib/junction-clusters.ts');
  const document = JSON.parse(await readFile(source, 'utf8'));
  const areas = extractTransportationAreas(document), index = buildRoadConnectionIndex(areas);
  const closed = ring => [...ring, ring[0]];
  const features = (list, id) => ({ type: 'FeatureCollection', features: list.map(area => ({ type: 'Feature', properties: {
    id: area.roadId, junction: area.roadId === id, kind: String(area.attributes.sourceType ?? area.function),
  }, geometry: { type: 'Polygon', coordinates: [closed(area.polygon), ...(area.holes ?? []).map(closed)] } })) });
  const cases = [210, 483, 0, 2, 12, 17, 177, 182, 302, 144].map(number => {
    const id = `hh-road-r00-c00-osm2streets-intersection-${number}`;
    const junction = index.junctions.find(junction => junction.roadId === id);
    const sourceDraft = readRoadJunction(areas, id), cluster = number === 210 ? suggestJunctionCluster(areas,id) : null;
    const draft = cluster ? consolidateJunctionCluster(areas,sourceDraft,cluster) : sourceDraft;
    const plan = buildRoadJunctionPlan({ ...draft, surfaceMode: 'rebuild' }, areas);
    const conflicts = plan.error ? [] : validateRoadOverlaps(plan.areas, areas, activeMetricCrsForCityJson(document),plan.removedRoadIds);
    return { id, name: [...new Set(draft.roadIds.map(id => index.areasByRoadId.get(id)?.[0]?.attributes.roadName).filter(name => name && !name.startsWith('osm2streets')))].join(' / '),
      center: junction.position, checkedAt: new Date().toISOString().slice(0,10),
      error: plan.error ?? (conflicts.some(conflict => conflict.severity === 'error') ? 'SAVE BLOCKED: new overlap with neighbouring pavement; adjust the boundary or connections.' : null),
      source: features(areas.filter(area => area.roadId === id || draft.roadIds.includes(area.roadId) || cluster?.junctionIds.includes(area.roadId) || cluster?.internalRoadIds.includes(area.roadId)), id), generated: features(plan.areas, id) };
  });
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/junction-cases.json`, JSON.stringify(cases));
  await writeFile(`${output}/index.html`, await readFile('scripts/templates/intersection-review.html', 'utf8'));
  console.log('Start npm run dev:frontend, then open /test-output/intersection-review/index.html on that Vite server. All three maps stay synchronized.');
} finally { await server.close(); }
