import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'vite';

// A read-only crop of the published citywide catalog, not hand-drawn geometry.
const tiles = ['hh-road-e566-n5933', 'hh-road-e566-n5934'];
const bbox = [10.00635, 53.55002, 10.00925, 53.55084];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['polygon-clipping'] } });
try {
  const { parseCityJsonSeqStrict } = await server.ssrLoadModule('/src/lib/cityjsonseq-catalog.ts');
  const { mergeCityJson } = await server.ssrLoadModule('/src/lib/merge.ts');
  const { extractTransportationAreas } = await server.ssrLoadModule('/src/lib/transportation.ts');
  const { compactVertices } = await server.ssrLoadModule('/src/lib/compact.ts');
  const { checkIntegrity } = await server.ssrLoadModule('/src/lib/integrity.ts');
  let document;
  for (const id of tiles) {
    const text = gunzipSync(await readFile(`public/data/hamburg/roads/tiles/${id}.city.jsonl.gz`)).toString();
    const tile = parseCityJsonSeqStrict(text);
    if (!document) document = tile;
    else if (!mergeCityJson(document, tile).ok) throw new Error(`Cannot merge ${id}`);
  }
  const ids = new Set(extractTransportationAreas(document).filter(area => area.polygon.some(p =>
    p[0] > bbox[0] && p[0] < bbox[2] && p[1] > bbox[1] && p[1] < bbox[3])).map(area => area.roadId));
  document.CityObjects = Object.fromEntries(Object.entries(document.CityObjects).filter(([id]) => ids.has(id)));
  compactVertices(document);
  const coordinates = document.vertices.map(v => v.map((n, i) => n * document.transform.scale[i] + document.transform.translate[i]));
  document.metadata = { ...document.metadata, title: 'Altmannbrücke — road bridges above the Hamburg station tracks',
    geographicalExtent: [0, 1, 2].map(i => Math.min(...coordinates.map(v => v[i]))).concat([0, 1, 2].map(i => Math.max(...coordinates.map(v => v[i])))),
    crossingReview: { source: 'Published Hamburg road catalog', sourceTiles: tiles, cropBboxWgs84: bbox,
      roadOsmWays: ['32959523', '32959524'], note: 'Original road layer +1 is retained. Nearby open railway cuttings use layer -1; actual tunnels have tunnel tags.' },
  };
  const integrity = checkIntegrity(document);
  if (!integrity.ok) throw new Error(JSON.stringify(integrity.counts));
  await writeFile('public/examples/hamburg-altmannbruecke.json', JSON.stringify(document));
  console.log(`${Object.keys(document.CityObjects).length} CityObjects; source geometry and crossing levels retained.`);
} finally { await server.close(); }
