import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  statfsSync,
} from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  findReadyHamburgRoadCatalog,
  readReadyHamburgRoadCatalog,
} from './hamburg-road-catalog-path.mjs';

const GEOFABRIK_HAMBURG_PBF =
  'https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf';
const PROVEN_HAMBURG_BBOX = [
  8.487587953331118,
  53.39685748599475,
  10.334190169755693,
  53.93059691328656,
];
const MIN_FREE_BYTES = 10 * 1024 ** 3;

const args = parseArgs(process.argv.slice(2));
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const osm2streetsRoot = resolve(projectRoot, 'vendor/osm2streets');
const osmPath = resolvePath(args.osm ?? 'Data/hamburg-osm/hamburg-latest.osm.pbf');
const defaultOutputDir = resolve(projectRoot, 'Data/hamburg-roads-osm2streets/cityjsonseq');
const outputDir = resolvePath(args['output-dir'] ?? defaultOutputDir);
const workDir = resolvePath(args['work-dir'] ?? 'Data/hamburg-roads-osm2streets/work');
const batchScript = resolve(projectRoot, 'scripts/build-hamburg-osm2streets-roads.mjs');
const exporter = resolve(
  osm2streetsRoot,
  'target',
  'release',
  process.platform === 'win32' ? 'webcityeditor_native_export.exe' : 'webcityeditor_native_export'
);
const dryRun = flag('dry-run');

if (dryRun) {
  printPlan();
  process.exit(0);
}

const readyCatalog =
  outputDir === defaultOutputDir
    ? findReadyHamburgRoadCatalog(outputDir)
    : readReadyHamburgRoadCatalog(outputDir);
if (readyCatalog && !flag('rebuild')) {
  console.log(
    `Hamburg road catalog is already complete: ${readyCatalog.catalog.summary.features} ` +
      `features in ${readyCatalog.catalog.summary.tiles} tiles at ${readyCatalog.directory}.`
  );
  printServeInstructions(readyCatalog.directory);
  process.exit(0);
}

ensureFreeDisk();
await ensureNodeDependencies();
ensureOsm2StreetsSubmodule();
const cargo = flag('skip-build') ? null : findCargo();
await ensureHamburgPbf();
if (cargo) buildNativeExporter(cargo);
if (!existsSync(exporter)) throw new Error(`Native osm2streets exporter is missing: ${exporter}`);

const batchArgs = [
  batchScript,
  '--osm',
  osmPath,
  '--output-dir',
  outputDir,
  '--work-dir',
  workDir,
  '--exporter',
  exporter,
  '--bbox',
  PROVEN_HAMBURG_BBOX.join(','),
  '--grid',
  '2',
  '--min-depth',
  '2',
  '--max-depth',
  '3',
  '--max-lane-geojson-mb',
  '384',
  '--seq-only',
  '--discard-work',
];
if (flag('clean') || flag('rebuild')) batchArgs.push('--clean');

console.log('Generating the complete Hamburg CityJSONSeq road catalog.');
console.log('This is a one-time, long-running local conversion; progress is printed per tile.');
run(process.execPath, batchArgs, { cwd: projectRoot });

const catalog = readReadyHamburgRoadCatalog(outputDir);
if (!catalog) {
  throw new Error(
    `Road export finished without a zero-failure catalog at ${resolve(outputDir, 'catalog.json')}.`
  );
}
console.log(
  `Ready: ${catalog.catalog.summary.features} Road features in ` +
    `${catalog.catalog.summary.tiles} tiles; ${catalog.catalog.summary.failed} failed.`
);
printServeInstructions(catalog.directory);

function printPlan() {
  const plan = {
    type: 'HamburgRoadCatalogPreparationPlan',
    sourceUrl: GEOFABRIK_HAMBURG_PBF,
    osmPath,
    osmAlreadyPresent: existsSync(osmPath),
    outputDir,
    workDir,
    osm2streetsSubmodulePresent: existsSync(resolve(osm2streetsRoot, 'Cargo.toml')),
    exporter,
    exporterAlreadyPresent: existsSync(exporter),
    bbox: PROVEN_HAMBURG_BBOX,
    tiling: { grid: 2, minDepth: 2, maxDepth: 3, maxLaneGeoJsonMiB: 384 },
    outputMode: { cityjsonseqOnly: true, discardSuccessfulWork: true },
    expectedFinalSize: 'about 2.3 GiB plus Rust build artifacts',
    minimumRecommendedFreeSpace: '10 GiB',
  };
  console.log(JSON.stringify(plan, null, 2));
}

function ensureFreeDisk() {
  const stats = statfsSync(nearestExistingPath(outputDir));
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  if (freeBytes < MIN_FREE_BYTES && !flag('allow-low-disk')) {
    throw new Error(
      `Only ${formatBytes(freeBytes)} is free. The complete export needs at least 10 GiB of ` +
        'working space. Free disk space or rerun with --allow-low-disk.'
    );
  }
  console.log(`Free disk space: ${formatBytes(freeBytes)}`);
}

async function ensureNodeDependencies() {
  const marker = resolve(projectRoot, 'node_modules/proj4/package.json');
  if (existsSync(marker)) return;
  console.log('Installing project dependencies with npm ci.');
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) run(process.execPath, [npmExecPath, 'ci'], { cwd: projectRoot });
  else run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], { cwd: projectRoot });
}

function ensureOsm2StreetsSubmodule() {
  if (existsSync(resolve(osm2streetsRoot, 'Cargo.toml'))) return;
  console.log('Initializing the patched osm2streets Git submodule.');
  run('git', ['submodule', 'update', '--init', '--recursive', 'vendor/osm2streets'], {
    cwd: projectRoot,
  });
  if (!existsSync(resolve(osm2streetsRoot, 'Cargo.toml'))) {
    throw new Error('The vendor/osm2streets submodule could not be initialized.');
  }
}

async function ensureHamburgPbf() {
  if (existsSync(osmPath) && !flag('refresh-osm')) {
    const current = await stat(osmPath);
    if (current.size > 0) {
      console.log(`Using existing Hamburg OSM PBF (${formatBytes(current.size)}): ${osmPath}`);
      return;
    }
  }

  await mkdir(dirname(osmPath), { recursive: true });
  const temporary = `${osmPath}.partial`;
  console.log(`Downloading current Hamburg OSM PBF from ${GEOFABRIK_HAMBURG_PBF}`);
  const response = await fetch(GEOFABRIK_HAMBURG_PBF);
  if (!response.ok || !response.body) {
    throw new Error(`Hamburg PBF download failed: HTTP ${response.status} ${response.statusText}`);
  }
  await rm(temporary, { force: true });
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    const partial = await stat(temporary);
    if (partial.size === 0) throw new Error('Hamburg PBF download produced an empty file.');
    await rm(osmPath, { force: true });
    await rename(temporary, osmPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  const downloaded = await stat(osmPath);
  const metadata = {
    type: 'HamburgOsmPbfDownload',
    url: GEOFABRIK_HAMBURG_PBF,
    downloadedAt: new Date().toISOString(),
    bytes: downloaded.size,
    sha256: await sha256File(osmPath),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
  await writeFile(`${osmPath}.metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(`Saved ${formatBytes(downloaded.size)} to ${osmPath}`);
}

function buildNativeExporter(cargo) {
  console.log('Building the patched native osm2streets exporter.');
  run(
    cargo,
    ['build', '--release', '-p', 'osm2streets-js', '--bin', 'webcityeditor_native_export'],
    { cwd: osm2streetsRoot }
  );
}

function findCargo() {
  const cargoName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const cargoHome = process.env.CARGO_HOME
    ? resolve(process.env.CARGO_HOME, 'bin', cargoName)
    : resolve(homedir(), '.cargo', 'bin', cargoName);
  const candidate = existsSync(cargoHome) ? cargoHome : cargoName;
  const version = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    throw new Error(
      'Rust/Cargo was not found. Install Rust with rustup from https://rustup.rs, reopen the ' +
        'terminal, and rerun npm run data:hamburg-roads:prepare.'
    );
  }
  console.log(version.stdout.trim());
  return candidate;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}.`);
  }
}

async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function printServeInstructions(catalogDirectory = outputDir) {
  if (
    catalogDirectory === defaultOutputDir ||
    dirname(catalogDirectory) === dirname(defaultOutputDir)
  ) {
    console.log('Start the road catalog with: npm run data:hamburg-roads:serve');
  } else {
    console.log(
      `Start the road catalog with: npm run data:hamburg-roads:serve -- --output-dir "${catalogDirectory}"`
    );
  }
  console.log('Then connect the editor to: http://127.0.0.1:8788');
}

function nearestExistingPath(target) {
  let current = resolve(target);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return projectRoot;
    current = parent;
  }
  return current;
}

function resolvePath(value) {
  const text = String(value);
  if (isAbsolute(text)) return text;
  return resolve(projectRoot, text);
}

function flag(name) {
  return args[name] === true || args[name] === 'true';
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${bytes} bytes`;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index++;
    }
  }
  return result;
}
