import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['polygon-clipping'] } });
try {
  const { extractTransportationAreas, deriveEditableRoadDraftFromAreas } = await server.ssrLoadModule('/src/lib/transportation.ts');
  const { readRoadJunction, buildRoadJunctionPlan, saveRoadJunction } = await server.ssrLoadModule('/src/lib/road-junctions.ts');
  const { suggestJunctionCluster, consolidateJunctionCluster } = await server.ssrLoadModule('/src/lib/junction-clusters.ts');
  const { validateRoadOverlaps } = await server.ssrLoadModule('/src/lib/road-fit.ts');
  const { compactVertices } = await server.ssrLoadModule('/src/lib/compact.ts');
  const { checkIntegrity } = await server.ssrLoadModule('/src/lib/integrity.ts');
  const doc = JSON.parse(await readFile('public/examples/hamburg-roedingsmarkt-source.json','utf8'));
  const prefix = 'hh-road-r00-c00-osm2streets-';
  // Explicit review correction requested for these two left-turn lanes. The
  // original OSM crop has no turn:lanes tag on way 43118557; keep it untouched.
  const leftId = `${prefix}road-469`, object = doc.CityObjects[leftId];
  const layout = deriveEditableRoadDraftFromAreas(extractTransportationAreas(doc),leftId);
  for (const section of layout.sections) for (const band of section.bands) if (band.kind === 'car_lane') band.allowedTurns = ['left'];
  object.attributes._roadLayout = layout;
  object.attributes._laneArrowReview = { source: 'User intersection review, 2026-09-10; compared with Esri reference imagery', osmWayId: '43118557', correction: 'Both driving lanes carry a left arrow. Original OSM has no turn:lanes tag.' };
  for (const geometry of object.geometry) for (const surface of geometry.semantics.surfaces) if (surface.sourceType === 'Driving') surface.allowedTurns = ['left'];
  const results = [];
  for (const number of [210,483]) {
    const areas = extractTransportationAreas(doc), id = `${prefix}intersection-${number}`;
    const initial = readRoadJunction(areas,id);
    const draft = number === 210 ? consolidateJunctionCluster(areas,initial,suggestJunctionCluster(areas,id)) : {...initial,surfaceMode:'rebuild'};
    const plan = buildRoadJunctionPlan(draft,areas);
    const errors = validateRoadOverlaps(plan.areas,areas,'EPSG:25832',plan.removedRoadIds).filter(c=>c.severity==='error');
    if(plan.error || errors.length) throw new Error(plan.error ?? errors.map(c=>c.label).join('; '));
    saveRoadJunction(doc,draft,plan);
    results.push({id,approaches:draft.roadIds.length,movements:plan.movements.length,removed:plan.removedRoadIds?.length ?? 0});
  }
  compactVertices(doc);
  const integrity=checkIntegrity(doc); if(!integrity.ok) throw new Error(JSON.stringify(integrity.issues));
  doc.metadata.intersectionReview = { date:'2026-09-10', description:'One consolidated Rödingsmarkt junction and a generated Willy-Brandt lane transition. Geometry is an editable approximation, not a survey. Railway context is shown separately by the viewer.', results };
  await writeFile('public/examples/hamburg-roedingsmarkt.json',JSON.stringify(doc));
  console.log(JSON.stringify({results,integrity:integrity.counts},null,2));
} finally { await server.close(); }
