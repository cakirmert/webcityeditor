import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_TILESET =
  'https://daten-hamburg.de/gdi3d/datasource-data/Strassenbaumkataster_Sommerbaeume/tileset.json';
const DEFAULT_BBOX = [9.978, 53.5395, 10.0035, 53.5545];
const OUTPUT_FILE = path.resolve(
  process.argv[2] ?? 'public/data/hamburg/hamburg-city-center-trees.json'
);
const bboxDegrees = process.argv[3]
  ? process.argv[3].split(',').map(Number)
  : DEFAULT_BBOX;
const bbox = bboxDegrees.map(degreesToRadians);

if (bbox.length !== 4 || !bbox.every(Number.isFinite)) {
  throw new Error('Tree bbox must be west,south,east,north in WGS84 degrees.');
}

const source = await fetchJson(SOURCE_TILESET);
const coarseUrls = [];
visit(source.root, (tile) => {
  if (tile.content?.uri && intersects(tile.boundingVolume?.region, bbox)) {
    coarseUrls.push(new URL(tile.content.uri, SOURCE_TILESET).href);
  }
});

const tileUrls = new Set();
for (const coarseUrl of coarseUrls) {
  const coarse = await fetchJson(coarseUrl);
  collectHighestResolutionTileUrls(coarse.root, coarseUrl, tileUrls);
}

const tileBuffers = await downloadAll([...tileUrls], 12);
const treesById = new Map();
for (const buffer of tileBuffers) {
  for (const tree of readTreeTile(buffer)) treesById.set(tree.id, tree);
}
const trees = [...treesById.values()]
  .filter(
    (tree) =>
      tree.position[0] >= bboxDegrees[0] &&
      tree.position[0] <= bboxDegrees[2] &&
      tree.position[1] >= bboxDegrees[1] &&
      tree.position[1] <= bboxDegrees[3]
  )
  .sort((a, b) => a.id.localeCompare(b.id));

const output = {
  type: 'HamburgCityCenterTrees',
  version: 1,
  source: SOURCE_TILESET,
  sourceDataset: '3D Straßenbaumkataster Hamburg — Sommerbäume 2024',
  attribution: 'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
  bboxWgs84: bboxDegrees,
  count: trees.length,
  trees,
};

await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(output)}\n`);
console.log(
  `Built official Hamburg city-center trees: ${trees.length} trees from ` +
    `${tileBuffers.length} highest-resolution source tiles`
);

function collectHighestResolutionTileUrls(tile, baseUrl, output) {
  const region = tile.boundingVolume?.region;
  if (!intersects(region, bbox)) return;

  const children = (tile.children ?? []).filter((child) =>
    intersects(child.boundingVolume?.region, bbox)
  );
  if (children.length) {
    children.forEach((child) => collectHighestResolutionTileUrls(child, baseUrl, output));
    return;
  }
  if (tile.content?.uri) output.add(new URL(tile.content.uri, baseUrl).href);
}

async function downloadAll(urls, concurrency) {
  const output = new Array(urls.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (cursor < urls.length) {
        const index = cursor++;
        const response = await fetch(urls[index]);
        if (!response.ok) {
          throw new Error(`Tree tile download failed: HTTP ${response.status} ${urls[index]}`);
        }
        output[index] = Buffer.from(await response.arrayBuffer());
      }
    })
  );
  return output;
}

function readTreeTile(buffer) {
  const magic = buffer.subarray(0, 4).toString('ascii');
  if (magic === 'i3dm') return readI3dm(buffer, 0);
  if (magic !== 'cmpt') throw new Error(`Unsupported Hamburg tree tile: ${magic}`);

  const trees = [];
  const tilesLength = buffer.readUInt32LE(12);
  let offset = 16;
  for (let index = 0; index < tilesLength; index++) {
    const byteLength = buffer.readUInt32LE(offset + 8);
    const innerMagic = buffer.subarray(offset, offset + 4).toString('ascii');
    if (innerMagic === 'i3dm') trees.push(...readI3dm(buffer, offset));
    offset += byteLength;
  }
  return trees;
}

function readI3dm(buffer, start) {
  const featureJsonLength = buffer.readUInt32LE(start + 12);
  const featureBinaryLength = buffer.readUInt32LE(start + 16);
  const batchJsonLength = buffer.readUInt32LE(start + 20);
  let offset = start + 32;
  const featureTable = readPaddedJson(buffer, offset, featureJsonLength);
  offset += featureJsonLength;
  const featureBinary = buffer.subarray(offset, offset + featureBinaryLength);
  offset += featureBinaryLength;
  const batchTable = readPaddedJson(buffer, offset, batchJsonLength);

  const length = Number(featureTable.INSTANCES_LENGTH ?? 0);
  const attributes = Array.isArray(batchTable.attributes) ? batchTable.attributes : [];
  const ids = Array.isArray(batchTable.id) ? batchTable.id : [];
  const trees = [];
  for (let index = 0; index < length; index++) {
    const batchId = readBatchId(featureTable.BATCH_ID, featureBinary, index);
    const attribute = attributes[batchId] ?? attributes[index] ?? {};
    const ecef = readPosition(featureTable, featureBinary, index);
    if (!ecef) continue;
    const position = ecefToWgs84(ecef);
    const height = finitePositive(attribute.Hoehe_aus_ALS, 7);
    const crownDiameter = finitePositive(attribute.Kronendurchmesser, Math.max(3, height * 0.45));
    const circumferenceCm = finitePositive(attribute.Stammumfang, 60);
    trees.push({
      id: String(ids[batchId] ?? ids[index] ?? `tree-${start}-${index}`),
      position: position.map((value) => round(value, 7)),
      height: round(height, 1),
      crownDiameter: round(crownDiameter, 1),
      trunkRadius: round(clamp(circumferenceCm / 100 / (2 * Math.PI), 0.1, 0.65), 2),
      species: String(attribute.Baumart ?? ''),
      genus: String(attribute.Gattung ?? ''),
      plantingYear: Number.isFinite(Number(attribute.Pflanzjahr))
        ? Number(attribute.Pflanzjahr)
        : null,
      street: String(attribute.Straße ?? ''),
    });
  }
  return trees;
}

function readPosition(table, binary, index) {
  const quantized = table.POSITION_QUANTIZED;
  if (quantized && table.QUANTIZED_VOLUME_OFFSET && table.QUANTIZED_VOLUME_SCALE) {
    const offset = Number(quantized.byteOffset ?? 0) + index * 6;
    return [0, 1, 2].map(
      (axis) =>
        table.QUANTIZED_VOLUME_OFFSET[axis] +
        (binary.readUInt16LE(offset + axis * 2) / 65535) * table.QUANTIZED_VOLUME_SCALE[axis]
    );
  }
  const position = table.POSITION;
  if (position) {
    const offset = Number(position.byteOffset ?? 0) + index * 12;
    return [0, 1, 2].map((axis) => binary.readFloatLE(offset + axis * 4));
  }
  return null;
}

function readBatchId(definition, binary, index) {
  if (!definition) return index;
  const offset = Number(definition.byteOffset ?? 0);
  if (definition.componentType === 'UNSIGNED_BYTE') return binary.readUInt8(offset + index);
  if (definition.componentType === 'UNSIGNED_INT') return binary.readUInt32LE(offset + index * 4);
  return binary.readUInt16LE(offset + index * 2);
}

function ecefToWgs84([x, y, z]) {
  const semiMajor = 6378137;
  const flattening = 1 / 298.257223563;
  const eccentricitySquared = flattening * (2 - flattening);
  const semiMinor = semiMajor * (1 - flattening);
  const secondEccentricitySquared =
    (semiMajor ** 2 - semiMinor ** 2) / semiMinor ** 2;
  const longitude = Math.atan2(y, x);
  const planar = Math.hypot(x, y);
  const theta = Math.atan2(semiMajor * z, semiMinor * planar);
  const latitude = Math.atan2(
    z + secondEccentricitySquared * semiMinor * Math.sin(theta) ** 3,
    planar - eccentricitySquared * semiMajor * Math.cos(theta) ** 3
  );
  const normal = semiMajor / Math.sqrt(1 - eccentricitySquared * Math.sin(latitude) ** 2);
  const elevation = planar / Math.cos(latitude) - normal;
  return [radiansToDegrees(longitude), radiansToDegrees(latitude), elevation];
}

function readPaddedJson(buffer, offset, length) {
  if (!length) return {};
  return JSON.parse(buffer.subarray(offset, offset + length).toString('utf8').trim());
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tree tileset fetch failed: HTTP ${response.status} ${url}`);
  return response.json();
}

function visit(tile, callback) {
  callback(tile);
  for (const child of tile.children ?? []) visit(child, callback);
}

function intersects(region, target) {
  return (
    Array.isArray(region) &&
    region[0] <= target[2] &&
    region[2] >= target[0] &&
    region[1] <= target[3] &&
    region[3] >= target[1]
  );
}

function finitePositive(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}
