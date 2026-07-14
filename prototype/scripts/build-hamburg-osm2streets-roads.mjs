import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

const args = parseArgs(process.argv.slice(2));
const prototypeRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(prototypeRoot, '..');
const osmPath = resolvePath(args.osm ?? '../Data/hamburg-osm/hamburg-latest.osm.pbf');
const outputDir = resolvePath(args['output-dir'] ?? '../Data/hamburg-roads-osm2streets/cityjsonseq');
const workDir = resolvePath(args['work-dir'] ?? '../Data/hamburg-roads-osm2streets/osm2streets-tiles');
const exporter = resolvePath(
  args.exporter ??
    '../vendor/osm2streets/target/release/webcityeditor_native_export.exe'
);
const converter = resolve(prototypeRoot, 'scripts/osm2streets-lanes-to-cityjson.mjs');
const validator = resolve(prototypeRoot, 'scripts/hamburg-lod2.mjs');
const grid = numberOption('grid', 2);
const maxDepth = numberOption('max-depth', 1);
const generatedAt = String(args['generated-at'] ?? new Date().toISOString());
const validate = args.validate !== false && args.validate !== 'false';
const clean = args.clean === true || args.clean === 'true';

if (!existsSync(osmPath)) {
  throw new Error(`Missing OSM PBF: ${osmPath}`);
}
if (!existsSync(exporter)) {
  throw new Error(`Missing native osm2streets exporter: ${exporter}`);
}

if (clean) {
  rmSync(outputDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
}
mkdirSync(outputDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const bbox = args.bbox ? parseBbox(String(args.bbox)) : readHamburgBboxFromLod2Catalog();
const initialTiles = splitBbox(bbox, grid, grid, 'hh-road');
const pending = initialTiles.map((tile) => ({ ...tile, depth: 0 }));
const successful = [];
const empty = [];
const failed = [];

while (pending.length > 0) {
  const tile = pending.shift();
  console.log(`Exporting ${tile.id} depth=${tile.depth} bbox=${tile.bbox.join(',')}`);
  const result = runTile(tile);
  if (result.ok) {
    if (result.empty) {
      empty.push(result.tileSummary);
      console.log(`  empty ${tile.id}: no lane polygons`);
      continue;
    }
    successful.push(result.tileSummary);
    console.log(
      `  ok ${tile.id}: ${result.tileSummary.roads} roads, ` +
        `${result.tileSummary.surfaces} surfaces, ${result.tileSummary.vertices} vertices`
    );
    continue;
  }

  console.log(`  failed ${tile.id}: ${result.error}`);
  if (tile.depth < maxDepth) {
    pending.push(...splitBbox(tile.bbox, 2, 2, tile.id).map((child) => ({ ...child, depth: tile.depth + 1 })));
  } else {
    failed.push({
      id: tile.id,
      bbox: tile.bbox,
      depth: tile.depth,
      error: result.error,
      log: result.log,
    });
  }
}

const summary = {
  type: 'HamburgOsm2StreetsRoadCityJsonSeqBuild',
  generatedAt,
  source: {
    osm: osmPath,
    exporter,
  },
  bbox,
  grid,
  maxDepth,
  tiles: successful,
  failed,
  totals: {
    tiles: successful.length,
    empty: empty.length,
    failed: failed.length,
    roads: successful.reduce((sum, tile) => sum + tile.roads, 0),
    surfaces: successful.reduce((sum, tile) => sum + tile.surfaces, 0),
    vertices: successful.reduce((sum, tile) => sum + tile.vertices, 0),
  },
  empty,
};
const summaryPath = resolve(outputDir, 'hamburg-osm2streets-roads-summary.json');
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary.totals, null, 2));
console.log(`Summary: ${summaryPath}`);
if (failed.length > 0) process.exitCode = 2;

function runTile(tile) {
  const tileWorkDir = resolve(workDir, tile.id);
  const tileOutJson = resolve(outputDir, `${tile.id}.city.json`);
  const tileOutSeq = resolve(outputDir, `${tile.id}.city.jsonl`);
  rmSync(tileWorkDir, { recursive: true, force: true });
  mkdirSync(tileWorkDir, { recursive: true });

  const native = spawnSync(
    exporter,
    [
      '--osm',
      osmPath,
      '--clip-geojson',
      clipGeoJson(tile.bbox),
      '--options-json',
      JSON.stringify(defaultOptions()),
      '--out-dir',
      tileWorkDir,
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  const logPath = resolve(tileWorkDir, 'native-export.log');
  writeFileSync(logPath, `${native.stdout ?? ''}${native.stderr ?? ''}`, 'utf8');
  if (native.error || native.status !== 0) {
    return {
      ok: false,
      error: native.error?.message ?? `native exporter exited ${native.status}`,
      log: logPath,
    };
  }

  const lanes = resolve(tileWorkDir, 'lane-polygons.geojson');
  if (!existsSync(lanes)) {
    return { ok: false, error: 'native exporter did not write lane-polygons.geojson', log: logPath };
  }
  const nativeSummary = JSON.parse(readFileSync(resolve(tileWorkDir, 'summary.json'), 'utf8'));
  if ((nativeSummary.counts?.lanes ?? 0) === 0) {
    return {
      ok: true,
      empty: true,
      tileSummary: {
        id: tile.id,
        bbox: tile.bbox,
        native: nativeSummary.counts,
        diagnostics: nativeSummary.diagnostics,
        roads: 0,
        surfaces: 0,
        vertices: 0,
      },
    };
  }
  const source = `Geofabrik Hamburg OSM PBF -> osm2streets tile ${tile.id}`;
  const converted = spawnSync(
    process.execPath,
    [
      converter,
      '--lanes',
      lanes,
      '--output',
      tileOutJson,
      '--seq-output',
      tileOutSeq,
      '--generated-at',
      generatedAt,
      '--source',
      source,
      '--id-prefix',
      `${tile.id}-`,
    ],
    { cwd: prototypeRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  writeFileSync(resolve(tileWorkDir, 'cityjson-convert.log'), `${converted.stdout ?? ''}${converted.stderr ?? ''}`, 'utf8');
  if (converted.error || converted.status !== 0) {
    return {
      ok: false,
      error: converted.error?.message ?? `CityJSON converter exited ${converted.status}`,
      log: resolve(tileWorkDir, 'cityjson-convert.log'),
    };
  }

  if (validate) {
    const checked = spawnSync(process.execPath, [validator, 'validate', '--input', tileOutSeq], {
      cwd: prototypeRoot,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    writeFileSync(resolve(tileWorkDir, 'cityjsonseq-validate.log'), `${checked.stdout ?? ''}${checked.stderr ?? ''}`, 'utf8');
    if (checked.error || checked.status !== 0) {
      return {
        ok: false,
        error: checked.error?.message ?? `CityJSONSeq validation exited ${checked.status}`,
        log: resolve(tileWorkDir, 'cityjsonseq-validate.log'),
      };
    }
  }

  const seqStats = readSeqStats(tileOutSeq);
  return {
    ok: true,
    tileSummary: {
      id: tile.id,
      bbox: tile.bbox,
      cityjson: tileOutJson,
      cityjsonseq: tileOutSeq,
      native: nativeSummary.counts,
      diagnostics: nativeSummary.diagnostics,
      roads: seqStats.features,
      surfaces: seqStats.surfaces,
      vertices: seqStats.vertices,
    },
  };
}

function readSeqStats(file) {
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  let features = 0;
  let surfaces = 0;
  let vertices = 0;
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const feature = JSON.parse(line);
    features++;
    vertices += Array.isArray(feature.vertices) ? feature.vertices.length : 0;
    for (const object of Object.values(feature.CityObjects ?? {})) {
      for (const geometry of object.geometry ?? []) {
        if (Array.isArray(geometry.boundaries)) surfaces += geometry.boundaries.length;
      }
    }
  }
  return { features, surfaces, vertices };
}

function readHamburgBboxFromLod2Catalog() {
  const catalogPath = resolvePath('../Data/hamburg-lod2/cityjsonseq/catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const extent = catalog.summary?.extent;
  if (!Array.isArray(extent) || extent.length < 5) {
    throw new Error(`Cannot derive WGS84 bbox from ${catalogPath}`);
  }
  const corners = [
    [extent[0], extent[1]],
    [extent[3], extent[1]],
    [extent[3], extent[4]],
    [extent[0], extent[4]],
  ].map((point) => proj4('EPSG:25832', 'EPSG:4326', point));
  return [
    Math.min(...corners.map((point) => point[0])),
    Math.min(...corners.map((point) => point[1])),
    Math.max(...corners.map((point) => point[0])),
    Math.max(...corners.map((point) => point[1])),
  ];
}

function splitBbox([west, south, east, north], cols, rows, prefix) {
  const tiles = [];
  const width = (east - west) / cols;
  const height = (north - south) / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = `${prefix}-r${String(row).padStart(2, '0')}-c${String(col).padStart(2, '0')}`;
      tiles.push({
        id,
        bbox: [
          west + col * width,
          south + row * height,
          col === cols - 1 ? east : west + (col + 1) * width,
          row === rows - 1 ? north : south + (row + 1) * height,
        ],
      });
    }
  }
  return tiles;
}

function clipGeoJson([west, south, east, north]) {
  return JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
    },
  });
}

function defaultOptions() {
  return {
    debug_each_step: false,
    dual_carriageway_experiment: false,
    sidepath_zipping_experiment: false,
    inferred_sidewalks: true,
    inferred_kerbs: true,
    date_time: null,
    override_driving_side: '',
  };
}

function parseBbox(value) {
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    throw new Error(`Invalid --bbox ${value}`);
  }
  return parts;
}

function numberOption(name, fallback) {
  const raw = args[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  const min = name === 'max-depth' ? 0 : 1;
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`--${name} must be an integer >= ${min}`);
  }
  return value;
}

function resolvePath(value) {
  const text = String(value);
  if (isAbsolute(text)) return text;
  return resolve(text.startsWith('.') || text.startsWith('..') ? prototypeRoot : '.', text);
}

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
