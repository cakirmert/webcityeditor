import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import proj4 from 'proj4';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(
  __dirname,
  '../public/data/hamburg/hamburg-city-center-buildings.city.jsonl'
);
const buildingCatalogPath = path.resolve(
  repoRoot,
  'Data/hamburg-lod2/cityjsonseq/catalog.json'
);

// Elbe waterfront / HafenCity through Rathaus and Jungfernstieg.
const DEMO_BBOX_WGS84 = [9.978, 53.5395, 10.0035, 53.5545];
const DEMO_INITIAL_VIEW = {
  center: [9.991, 53.547],
  zoom: 15.1,
  pitch: 48,
  bearing: -12,
};
const OUTPUT_TRANSFORM = {
  scale: [0.001, 0.001, 0.001],
  translate: [564000, 5932000, 0],
};

const projectedSouthWest = proj4(
  'EPSG:4326',
  'EPSG:25832',
  DEMO_BBOX_WGS84.slice(0, 2)
);
const projectedNorthEast = proj4(
  'EPSG:4326',
  'EPSG:25832',
  DEMO_BBOX_WGS84.slice(2, 4)
);
const demoBbox = [
  projectedSouthWest[0],
  projectedSouthWest[1],
  projectedNorthEast[0],
  projectedNorthEast[1],
];

const buildingCatalog = await readCatalog(buildingCatalogPath, 'Hamburg LoD2 building');
const sourceGroups = [
  {
    kind: 'building',
    catalog: buildingCatalog,
    directory: path.dirname(buildingCatalogPath),
  },
];

const selectedSources = sourceGroups.flatMap(({ kind, catalog, directory }) =>
  catalog.tiles
    .filter((tile) => extentsIntersect(tile.extent, demoBbox))
    .map((tile) => ({
      kind,
      file: path.join(directory, tile.file),
    }))
);

if (selectedSources.length === 0) {
  throw new Error('No source catalog tiles intersect the Hamburg city-center demo bbox.');
}

await mkdir(path.dirname(outputPath), { recursive: true });
const bodyPath = `${outputPath}.body.tmp`;
const finalPath = `${outputPath}.tmp`;
await rm(bodyPath, { force: true });
await rm(finalPath, { force: true });

const summary = {
  buildings: 0,
  features: 0,
  cityObjects: 0,
  surfaces: 0,
  vertices: 0,
  sourceTiles: selectedSources.length,
};
const extent = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
const seenFeatureIds = new Set();
const bodyStream = createWriteStream(bodyPath, { encoding: 'utf8' });

try {
  for (const source of selectedSources) {
    await appendSelectedFeatures(source, bodyStream, {
      bbox: demoBbox,
      extent,
      seenFeatureIds,
      summary,
    });
  }
} finally {
  await endStream(bodyStream);
}

if (summary.features === 0 || summary.buildings === 0) {
  throw new Error(
    `Demo generation was incomplete: ${summary.features} features and ` +
      `${summary.buildings} buildings.`
  );
}

const generatedAt = latestCatalogTimestamp(buildingCatalog);
const header = {
  type: 'CityJSON',
  version: '2.0',
  CityObjects: {},
  vertices: [],
  transform: OUTPUT_TRANSFORM,
  metadata: {
    title: 'Hamburg city center buildings — Elbe to Jungfernstieg demo',
    referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    geographicalExtent: extent.map(round3),
    sourceDescription:
      'Committed showcase of official Hamburg LoD2 buildings. The matching ' +
      'committed OSM crop is processed by browser osm2streets at startup.',
    sources: [
      {
        name: 'Freie und Hansestadt Hamburg LoD2-DE buildings',
        url: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod2-de-hamburg2',
      },
    ],
    generatedAt,
    demoBboxWgs84: DEMO_BBOX_WGS84,
    webcityeditorInitialView: DEMO_INITIAL_VIEW,
    featureCount: summary.features,
    buildingCount: summary.buildings,
  },
};

await writeFile(finalPath, `${JSON.stringify(header)}\n`, 'utf8');
await pipeline(
  createReadStream(bodyPath),
  createWriteStream(finalPath, { flags: 'a' })
);
await rm(outputPath, { force: true });
await rename(finalPath, outputPath);
await rm(bodyPath, { force: true });

const outputBytes = (await stat(outputPath)).size;
console.log(
  JSON.stringify(
    {
      type: 'HamburgCityCenterDemo',
      output: outputPath,
      bboxWgs84: DEMO_BBOX_WGS84,
      projectedBbox: demoBbox.map(round3),
      outputMiB: round3(outputBytes / 1024 / 1024),
      ...summary,
    },
    null,
    2
  )
);

async function appendSelectedFeatures(source, output, context) {
  const lines = readline.createInterface({
    input: createReadStream(source.file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let header = null;

  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!header) {
      header = JSON.parse(line);
      validateTransform(header.transform, source.file);
      continue;
    }

    const feature = JSON.parse(line);
    if (feature.type !== 'CityJSONFeature' || !Array.isArray(feature.vertices)) continue;
    if (context.seenFeatureIds.has(feature.id)) continue;

    const decodedVertices = feature.vertices.map((vertex) =>
      decodeVertex(vertex, header.transform)
    );
    const featureExtent = verticesExtent(decodedVertices);
    if (!extentsIntersect(featureExtent, context.bbox)) continue;

    context.seenFeatureIds.add(feature.id);
    feature.vertices = decodedVertices.map(encodeVertex);
    updateExtent(context.extent, featureExtent);
    updateSummary(context.summary, feature);
    await writeLine(output, `${JSON.stringify(feature)}\n`);
  }
}

function updateSummary(summaryValue, feature) {
  summaryValue.features += 1;
  summaryValue.vertices += feature.vertices.length;
  for (const object of Object.values(feature.CityObjects ?? {})) {
    summaryValue.cityObjects += 1;
    if (object.type === 'Building') summaryValue.buildings += 1;
    for (const geometry of object.geometry ?? []) {
      if (Array.isArray(geometry.boundaries)) {
        summaryValue.surfaces += geometry.boundaries.length;
      }
    }
  }
}

function validateTransform(transform, file) {
  if (
    !transform ||
    !Array.isArray(transform.scale) ||
    !Array.isArray(transform.translate) ||
    transform.scale.length !== 3 ||
    transform.translate.length !== 3
  ) {
    throw new Error(`Missing CityJSON transform in ${file}`);
  }
}

function decodeVertex(vertex, transform) {
  return [
    vertex[0] * transform.scale[0] + transform.translate[0],
    vertex[1] * transform.scale[1] + transform.translate[1],
    vertex[2] * transform.scale[2] + transform.translate[2],
  ];
}

function encodeVertex(vertex) {
  return [
    Math.round((vertex[0] - OUTPUT_TRANSFORM.translate[0]) / OUTPUT_TRANSFORM.scale[0]),
    Math.round((vertex[1] - OUTPUT_TRANSFORM.translate[1]) / OUTPUT_TRANSFORM.scale[1]),
    Math.round((vertex[2] - OUTPUT_TRANSFORM.translate[2]) / OUTPUT_TRANSFORM.scale[2]),
  ];
}

function verticesExtent(vertices) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of vertices) {
    result[0] = Math.min(result[0], x);
    result[1] = Math.min(result[1], y);
    result[2] = Math.min(result[2], z);
    result[3] = Math.max(result[3], x);
    result[4] = Math.max(result[4], y);
    result[5] = Math.max(result[5], z);
  }
  return result;
}

function updateExtent(target, incoming) {
  target[0] = Math.min(target[0], incoming[0]);
  target[1] = Math.min(target[1], incoming[1]);
  target[2] = Math.min(target[2], incoming[2]);
  target[3] = Math.max(target[3], incoming[3]);
  target[4] = Math.max(target[4], incoming[4]);
  target[5] = Math.max(target[5], incoming[5]);
}

function extentsIntersect(extentValue, bbox) {
  return (
    Array.isArray(extentValue) &&
    extentValue[0] <= bbox[2] &&
    extentValue[3] >= bbox[0] &&
    extentValue[1] <= bbox[3] &&
    extentValue[4] >= bbox[1]
  );
}

async function readCatalog(file, label) {
  try {
    const catalog = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(catalog.tiles)) throw new Error('missing tiles array');
    return catalog;
  } catch (error) {
    throw new Error(
      `${label} catalog is required at ${file}. Prepare the local Hamburg catalogs first. ` +
        `(${error instanceof Error ? error.message : String(error)})`
    );
  }
}

function latestCatalogTimestamp(...catalogs) {
  const timestamps = catalogs
    .map((catalog) => Date.parse(catalog.generatedAt))
    .filter(Number.isFinite);
  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : undefined;
}

function round3(value) {
  return Number(value.toFixed(3));
}

function writeLine(stream, line) {
  if (stream.write(line)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      stream.off('error', onError);
      resolve();
    };
    const onError = (error) => {
      stream.off('drain', onDrain);
      reject(error);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

function endStream(stream) {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.end(resolve);
  });
}
