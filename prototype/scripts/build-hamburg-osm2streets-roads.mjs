import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
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
    `../vendor/osm2streets/target/release/webcityeditor_native_export${process.platform === 'win32' ? '.exe' : ''}`
);
const converter = resolve(prototypeRoot, 'scripts/osm2streets-lanes-to-cityjson.mjs');
const validator = resolve(prototypeRoot, 'scripts/hamburg-lod2.mjs');
const grid = numberOption('grid', 2);
const minDepth = numberOption('min-depth', 0);
const maxDepth = numberOption('max-depth', 1);
const maxLaneGeoJsonBytes = numberOption('max-lane-geojson-mb', 384) * 1024 * 1024;
const generatedAt = String(args['generated-at'] ?? new Date().toISOString());
const validate = args.validate !== false && args.validate !== 'false';
const clean = args.clean === true || args.clean === 'true';
const seqOnly = args['seq-only'] === true || args['seq-only'] === 'true';
const discardWork = args['discard-work'] === true || args['discard-work'] === 'true';

if (minDepth > maxDepth) {
  throw new Error('--min-depth cannot be greater than --max-depth');
}

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
  if (tile.depth < minDepth) {
    pending.push(
      ...splitBbox(tile.bbox, 2, 2, tile.id).map((child) => ({
        ...child,
        depth: tile.depth + 1,
      }))
    );
    continue;
  }
  console.log(`Exporting ${tile.id} depth=${tile.depth} bbox=${tile.bbox.join(',')}`);
  const result = await runTile(tile);
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
    if (result.cleanupWork || discardWork) {
      rmSync(resolve(workDir, tile.id), { recursive: true, force: true });
    }
    pending.push(...splitBbox(tile.bbox, 2, 2, tile.id).map((child) => ({ ...child, depth: tile.depth + 1 })));
  } else {
    failed.push({
      id: tile.id,
      bbox: tile.bbox,
      depth: tile.depth,
      error: result.error,
      log: result.log,
      stage: result.stage,
      panicSignature: result.panicSignature ?? null,
    });
  }
}

const forkRevision = readGitRevision(resolve(repoRoot, 'vendor/osm2streets'));
const osmSha256 = sha256File(osmPath);
const exporterSha256 = sha256File(exporter);

const summary = {
  type: 'HamburgOsm2StreetsRoadCityJsonSeqBuild',
  generatedAt,
  source: {
    osm: osmPath,
    osmSha256,
    exporter,
    exporterSha256,
    exporterBuiltAt: statSync(exporter).mtime.toISOString(),
    forkRevision,
  },
  bbox,
  grid,
  minDepth,
  maxDepth,
  maxLaneGeoJsonMiB: maxLaneGeoJsonBytes / 1024 / 1024,
  outputMode: {
    cityjsonseqOnly: seqOnly,
    discardSuccessfulWork: discardWork,
  },
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
const catalogPath = writeRoadCatalog(outputDir, summary);
console.log(JSON.stringify(summary.totals, null, 2));
console.log(`Summary: ${summaryPath}`);
console.log(`Catalog: ${catalogPath}`);
if (failed.length > 0) process.exitCode = 2;

async function runTile(tile) {
  const tileWorkDir = resolve(workDir, tile.id);
  const tileOutJson = resolve(outputDir, `${tile.id}.city.json`);
  const tileOutSeq = resolve(outputDir, `${tile.id}.city.jsonl`);
  rmSync(tileWorkDir, { recursive: true, force: true });
  rmSync(tileOutJson, { force: true });
  rmSync(tileOutSeq, { force: true });
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
      stage: 'native_export',
      panicSignature: panicSignature(`${native.stdout ?? ''}\n${native.stderr ?? ''}`),
    };
  }

  const lanes = resolve(tileWorkDir, 'lane-polygons.geojson');
  if (!existsSync(lanes)) {
    return {
      ok: false,
      error: 'native exporter did not write lane-polygons.geojson',
      log: logPath,
      stage: 'lane_polygons',
    };
  }
  const nativeSummary = JSON.parse(readFileSync(resolve(tileWorkDir, 'summary.json'), 'utf8'));
  if ((nativeSummary.counts?.lanes ?? 0) === 0) {
    const result = {
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
    if (discardWork) rmSync(tileWorkDir, { recursive: true, force: true });
    return result;
  }
  const laneGeoJsonBytes = statSync(lanes).size;
  if (laneGeoJsonBytes > maxLaneGeoJsonBytes) {
    return {
      ok: false,
      error:
        `lane-polygons.geojson is ${(laneGeoJsonBytes / 1024 / 1024).toFixed(1)} MiB; ` +
        `subdivide before CityJSON conversion (limit ${(maxLaneGeoJsonBytes / 1024 / 1024).toFixed(0)} MiB)`,
      log: logPath,
      stage: 'subdivide_before_cityjson_conversion',
      cleanupWork: true,
    };
  }
  const source = `Geofabrik Hamburg OSM PBF -> osm2streets tile ${tile.id}`;
  const converterArgs = [
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
  ];
  if (seqOnly) converterArgs.push('--seq-only');
  const converted = spawnSync(process.execPath, converterArgs, {
    cwd: prototypeRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  writeFileSync(resolve(tileWorkDir, 'cityjson-convert.log'), `${converted.stdout ?? ''}${converted.stderr ?? ''}`, 'utf8');
  if (converted.error || converted.status !== 0) {
    return {
      ok: false,
      error: converted.error?.message ?? `CityJSON converter exited ${converted.status}`,
      log: resolve(tileWorkDir, 'cityjson-convert.log'),
      stage: 'cityjson_conversion',
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
        stage: 'cityjsonseq_validation',
      };
    }
  }

  const seqStats = await readSeqStats(tileOutSeq);
  const result = {
    ok: true,
    tileSummary: {
      id: tile.id,
      bbox: tile.bbox,
      ...(seqOnly ? {} : { cityjson: tileOutJson }),
      cityjsonseq: tileOutSeq,
      native: nativeSummary.counts,
      diagnostics: nativeSummary.diagnostics,
      extent: seqStats.extent,
      roads: seqStats.features,
      surfaces: seqStats.surfaces,
      vertices: seqStats.vertices,
    },
  };
  if (seqOnly) rmSync(tileOutJson, { force: true });
  if (discardWork) rmSync(tileWorkDir, { recursive: true, force: true });
  return result;
}

async function readSeqStats(file) {
  const input = createReadStream(file, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let features = 0;
  let surfaces = 0;
  let vertices = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!header) {
      header = JSON.parse(line);
      continue;
    }
    const feature = JSON.parse(line);
    features++;
    vertices += Array.isArray(feature.vertices) ? feature.vertices.length : 0;
    for (const object of Object.values(feature.CityObjects ?? {})) {
      for (const geometry of object.geometry ?? []) {
        if (Array.isArray(geometry.boundaries)) surfaces += geometry.boundaries.length;
      }
    }
  }
  if (!header) throw new Error(`CityJSONSeq output is empty: ${file}`);
  return {
    features,
    surfaces,
    vertices,
    extent: header.metadata?.geographicalExtent ?? null,
  };
}

function writeRoadCatalog(directory, summary) {
  const tiles = summary.tiles
    .map((tile) => ({
      id: tile.id,
      file: basename(tile.cityjsonseq),
      url: `/tiles/${basename(tile.cityjsonseq)}`,
      bbox: tile.bbox,
      extent: tile.extent,
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
  const catalogPath = resolve(directory, 'catalog.json');
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return catalogPath;
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function readGitRevision(cwd) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function panicSignature(log) {
  const line = log
    .split(/\r?\n/)
    .find((candidate) => /panicked at|thread .* panicked|called `Result::unwrap/i.test(candidate));
  return line?.trim() ?? null;
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
  const min = name.endsWith('depth') ? 0 : 1;
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
