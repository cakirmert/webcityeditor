import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { convertLanePolygonsToCityJson, readRoadMetadata, readRoadMapEdgeEndpoints, cityjsonSeqText } from '../src/lib/osm2streets-network-converter.js';

const args = parseArgs(process.argv.slice(2));
if (!args.lanes || !args.output) {
  throw new Error(usage());
}

const lanesPath = resolve(String(args.lanes));
const outputPath = resolve(String(args.output));
const seqOutputPath = args['seq-output'] ? resolve(String(args['seq-output'])) : null;
const seqOnly = args['seq-only'] === true || args['seq-only'] === 'true';
if (seqOnly && !seqOutputPath) {
  throw new Error('--seq-only requires --seq-output');
}
const generatedAt = String(args['generated-at'] ?? new Date().toISOString());
const sourceLabel = String(args.source ?? 'osm2streets lane-polygons.geojson');
const idPrefix = String(args['id-prefix'] ?? '');
const sourceNetwork = args.network
  ? JSON.parse(await readFile(resolve(String(args.network)), 'utf8'))
  : null;
const roadMetadataById = sourceNetwork ? readRoadMetadata(sourceNetwork) : new Map();
const roadMapEdgeEndpointsById = sourceNetwork
  ? readRoadMapEdgeEndpoints(sourceNetwork, roadMetadataById)
  : new Map();
const cityjson = convertLanePolygonsToCityJson(
  JSON.parse(await readFile(lanesPath, 'utf8')),
  {
    generatedAt,
    sourceLabel,
    idPrefix,
    roadMetadataById,
    roadMapEdgeEndpointsById,
    sourceNetwork,
  }
);

if (!seqOnly) {
  mkdirSync(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(cityjson.doc)}\n`, 'utf8');
}

if (seqOutputPath) {
  mkdirSync(dirname(seqOutputPath), { recursive: true });
  await writeFile(seqOutputPath, cityjsonSeqText(cityjson), 'utf8');
}

console.log(
  `Converted ${cityjson.summary.roads} osm2streets road(s), ` +
    `${cityjson.summary.intersections} intersection(s), ${cityjson.summary.surfaces} surface(s), ` +
    `${cityjson.summary.vertices} vertices`
);
if (!seqOnly) console.log(`CityJSON: ${outputPath}`);
if (seqOutputPath) console.log(`CityJSONSeq: ${seqOutputPath}`);

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i++;
    }
  }
  return result;
}

function usage() {
  return [
    'Usage: node scripts/osm2streets-lanes-to-cityjson.mjs --lanes lane-polygons.geojson --output roads.city.json [--network network.json] [--seq-output roads.city.jsonl] [--seq-only] [--id-prefix tile-001-]',
    '',
    'Converts osm2streets lane and network intersection polygons into CityJSON 2.0 Road MultiSurfaces in EPSG:25832.',
  ].join('\n');
}
