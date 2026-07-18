import { readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolvePath(
  args['output-dir'] ?? 'Data/hamburg-roads-osm2streets/cityjsonseq'
);
const summaryPath = resolve(
  outputDir,
  String(args.summary ?? 'hamburg-osm2streets-roads-summary.json')
);
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

if (summary.type !== 'HamburgOsm2StreetsRoadCityJsonSeqBuild') {
  throw new Error(`${summaryPath} is not an osm2streets road batch summary.`);
}

const tiles = summary.tiles
  .map((tile) => ({
    id: tile.id,
    file: basename(tile.cityjsonseq),
    url: `/tiles/${basename(tile.cityjsonseq)}`,
    bbox: tile.bbox,
    extent: tile.extent ?? null,
    features: tile.roads,
    cityObjects: tile.roads,
    surfaces: tile.surfaces,
    vertices: tile.vertices,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const catalog = {
  type: 'HamburgOsm2StreetsRoadCityJSONSeqCatalog',
  generatedAt: summary.generatedAt,
  source: summary.source,
  crs: 'EPSG:25832',
  summary: {
    tiles: tiles.length,
    empty: summary.totals.empty,
    failed: summary.totals.failed,
    features: summary.totals.roads,
    cityObjects: summary.totals.roads,
    surfaces: summary.totals.surfaces,
    vertices: summary.totals.vertices,
  },
  tiles,
};

const catalogPath = resolve(outputDir, 'catalog.json');
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Road catalog: ${catalogPath}`);
console.log(JSON.stringify(catalog.summary, null, 2));

function resolvePath(value) {
  const text = String(value);
  if (isAbsolute(text)) return text;
  return resolve(projectRoot, text);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      index++;
    }
  }
  return result;
}
