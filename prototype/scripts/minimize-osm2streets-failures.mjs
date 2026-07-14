import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));
const prototypeRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const summaryPath = resolvePath(
  args.summary ??
    '../Data/hamburg-roads-osm2streets/cityjsonseq/hamburg-osm2streets-roads-current-summary.json'
);
const sourceSummary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const osmPath = resolvePath(args.osm ?? sourceSummary.source?.osm ?? '../Data/hamburg-osm/hamburg-latest.osm.pbf');
const exporter = resolvePath(
  args.exporter ??
    sourceSummary.source?.exporter ??
    '../vendor/osm2streets/target/release/webcityeditor_native_export.exe'
);
const outputDir = resolvePath(
  args['output-dir'] ?? '../Data/hamburg-roads-osm2streets/panic-minimization'
);
const maxDepth = integerOption('max-depth', 5, 0);
const minSpanM = numberOption('min-span-m', 25, 0);
const bufferM = numberOption('buffer-m', 0, 0);
const keepSuccessOutput = booleanOption('keep-success-output', false);
const clean = booleanOption('clean', false);

if (!existsSync(osmPath)) throw new Error(`Missing OSM input: ${osmPath}`);
if (!existsSync(exporter)) throw new Error(`Missing native exporter: ${exporter}`);

const roots = (sourceSummary.failed ?? sourceSummary.failures ?? []).map((failure, index) => ({
  id: String(failure.id ?? `failure-${index + 1}`),
  bbox: parseBbox(failure.bbox),
}));
if (roots.length === 0) {
  throw new Error(`No failed bboxes found in ${summaryPath}`);
}

if (clean) {
  const resolved = resolve(outputDir);
  const allowedRoot = resolve(prototypeRoot, '../Data/hamburg-roads-osm2streets');
  if (!resolved.startsWith(`${allowedRoot}\\`) && resolved !== allowedRoot) {
    throw new Error(`Refusing to clean output outside ${allowedRoot}: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}
mkdirSync(outputDir, { recursive: true });

const attempts = [];
const smallestFailures = [];

for (const root of roots) {
  console.log(`Minimizing ${root.id} bbox=${root.bbox.join(',')}`);
  const leaves = minimize(root, 0, null);
  smallestFailures.push(...leaves);
}

const manifest = {
  type: 'Osm2StreetsFailureMinimization',
  generatedAt: new Date().toISOString(),
  source: {
    summary: summaryPath,
    osm: osmPath,
    exporter,
  },
  options: {
    maxDepth,
    minSpanM,
    bufferM,
    keepSuccessOutput,
  },
  roots,
  attempts,
  smallestFailures,
};
const manifestPath = resolve(outputDir, 'repro-manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifest: ${manifestPath}`);
console.log(`Smallest still-failing bboxes: ${smallestFailures.length}`);
if (smallestFailures.length === 0) process.exitCode = 2;

function minimize(candidate, depth, parentId) {
  const attempt = runAttempt(candidate, depth, parentId);
  attempts.push(attempt);
  writeManifestCheckpoint();

  if (attempt.exitStatus === 0) return [];

  const [widthM, heightM] = bboxSpanMetres(candidate.bbox);
  if (depth >= maxDepth || Math.max(widthM, heightM) <= minSpanM) {
    return [toFailureLeaf(attempt, false)];
  }

  const childFailures = [];
  for (const child of splitBbox(candidate.bbox, candidate.id)) {
    childFailures.push(...minimize(child, depth + 1, candidate.id));
  }

  // A clip-edge or topology dependency may fail only when several quarters are
  // present together. Preserve the parent as the smallest deterministic repro
  // instead of incorrectly declaring the panic fixed.
  if (childFailures.length === 0) {
    return [toFailureLeaf(attempt, true)];
  }
  return childFailures;
}

function runAttempt(candidate, depth, parentId) {
  const attemptDir = safeAttemptDirectory(candidate.id);
  rmSync(attemptDir, { recursive: true, force: true });
  mkdirSync(attemptDir, { recursive: true });
  const clipBbox = expandBbox(candidate.bbox, bufferM);
  console.log(`  ${candidate.id} depth=${depth} bbox=${candidate.bbox.join(',')}`);

  const startedAt = new Date().toISOString();
  const result = spawnSync(
    exporter,
    [
      '--osm',
      osmPath,
      '--clip-geojson',
      clipGeoJson(clipBbox),
      '--options-json',
      JSON.stringify(defaultOptions()),
      '--out-dir',
      attemptDir,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? 'full' },
      maxBuffer: 256 * 1024 * 1024,
    }
  );
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const logPath = resolve(attemptDir, 'native-export.log');
  writeFileSync(logPath, log, 'utf8');

  const attempt = {
    id: candidate.id,
    parentId,
    depth,
    bbox: candidate.bbox,
    clipBbox,
    spanM: bboxSpanMetres(candidate.bbox).map((value) => Number(value.toFixed(2))),
    startedAt,
    completedAt: new Date().toISOString(),
    exitStatus: result.status,
    spawnError: result.error?.message ?? null,
    panicSignature: panicSignature(log),
    log: logPath,
  };
  writeFileSync(resolve(attemptDir, 'attempt.json'), `${JSON.stringify(attempt, null, 2)}\n`, 'utf8');

  if (result.status === 0 && !keepSuccessOutput) {
    for (const name of [
      'lane-polygons.geojson',
      'lane-markings.geojson',
      'intersection-markings.geojson',
      'network.json',
      'diagnostics.json',
      'summary.json',
    ]) {
      rmSync(resolve(attemptDir, name), { force: true });
    }
  }

  console.log(
    result.status === 0
      ? `    ok`
      : `    failed status=${result.status}: ${attempt.panicSignature ?? attempt.spawnError ?? 'unknown failure'}`
  );
  return attempt;
}

function safeAttemptDirectory(id) {
  const directory = resolve(outputDir, String(id));
  const childPath = relative(outputDir, directory);
  if (
    !childPath ||
    childPath === '..' ||
    childPath.startsWith(`..${sep}`) ||
    isAbsolute(childPath)
  ) {
    throw new Error(`Refusing attempt id outside the minimizer output directory: ${id}`);
  }
  return directory;
}

function writeManifestCheckpoint() {
  const checkpoint = {
    type: 'Osm2StreetsFailureMinimizationCheckpoint',
    generatedAt: new Date().toISOString(),
    source: { summary: summaryPath, osm: osmPath, exporter },
    attempts,
  };
  writeFileSync(resolve(outputDir, 'repro-manifest.partial.json'), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

function toFailureLeaf(attempt, boundarySensitive) {
  return {
    id: attempt.id,
    bbox: attempt.bbox,
    clipBbox: attempt.clipBbox,
    depth: attempt.depth,
    spanM: attempt.spanM,
    panicSignature: attempt.panicSignature,
    boundarySensitive,
    log: attempt.log,
  };
}

function splitBbox([west, south, east, north], prefix) {
  const midX = (west + east) / 2;
  const midY = (south + north) / 2;
  return [
    { id: `${prefix}-r00-c00`, bbox: [west, south, midX, midY] },
    { id: `${prefix}-r00-c01`, bbox: [midX, south, east, midY] },
    { id: `${prefix}-r01-c00`, bbox: [west, midY, midX, north] },
    { id: `${prefix}-r01-c01`, bbox: [midX, midY, east, north] },
  ];
}

function bboxSpanMetres([west, south, east, north]) {
  const latitude = ((south + north) / 2) * (Math.PI / 180);
  const width = Math.abs(east - west) * 111_320 * Math.cos(latitude);
  const height = Math.abs(north - south) * 110_540;
  return [width, height];
}

function expandBbox([west, south, east, north], metres) {
  if (metres === 0) return [west, south, east, north];
  const latitude = ((south + north) / 2) * (Math.PI / 180);
  const lon = metres / (111_320 * Math.max(0.01, Math.cos(latitude)));
  const lat = metres / 110_540;
  return [west - lon, south - lat, east + lon, north + lat];
}

function panicSignature(log) {
  const lines = log.split(/\r?\n/);
  const panicIndex = lines.findIndex((line) => line.includes('panicked at'));
  if (panicIndex >= 0) {
    return lines
      .slice(panicIndex, panicIndex + 3)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' | ');
  }
  const errorLine = [...lines].reverse().find((line) => /error|failed/i.test(line));
  return errorLine?.trim() ?? null;
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

function resolvePath(value) {
  const text = String(value);
  if (isAbsolute(text)) return text;
  return resolve(text.startsWith('.') ? prototypeRoot : process.cwd(), text);
}

function parseBbox(value) {
  const parts = Array.isArray(value) ? value.map(Number) : String(value).split(',').map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    throw new Error(`Invalid bbox: ${JSON.stringify(value)}`);
  }
  return parts;
}

function integerOption(name, fallback, minimum) {
  const value = args[name] === undefined ? fallback : Number(args[name]);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`--${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function numberOption(name, fallback, minimum) {
  const value = args[name] === undefined ? fallback : Number(args[name]);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`--${name} must be a number >= ${minimum}`);
  }
  return value;
}

function booleanOption(name, fallback) {
  const value = args[name];
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`--${name} must be true or false`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index++;
    }
  }
  return parsed;
}
