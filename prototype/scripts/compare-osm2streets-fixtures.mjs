import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const prototypeRoot = resolve(__dirname, '..');
const repoRoot = resolve(prototypeRoot, '..');
const fixtureRoot = resolve(prototypeRoot, 'test-fixtures', 'osm2streets');
const vendorRoot = resolve(prototypeRoot, 'vendor', 'osm2streets-js');
const osm2streetsRoot = resolve(repoRoot, 'vendor', 'osm2streets');
const outputRoot = resolve(prototypeRoot, 'test-output', 'osm2streets-comparison');

const outputNames = [
  ['lanes', 'lane-polygons.geojson'],
  ['laneMarkings', 'lane-markings.geojson'],
  ['intersectionMarkings', 'intersection-markings.geojson'],
  ['network', 'network.json'],
];

const defaultOptions = {
  debug_each_step: false,
  dual_carriageway_experiment: false,
  sidepath_zipping_experiment: false,
  inferred_sidewalks: true,
  inferred_kerbs: true,
  date_time: null,
  override_driving_side: '',
};

const { default: initWasm, JsStreetNetwork } = await import(
  pathToFileURL(resolve(vendorRoot, 'osm2streets_js.js')).href
);

const wasmBytes = await readFile(resolve(vendorRoot, 'osm2streets_js_bg.wasm'));
await initWasm({ module_or_path: wasmBytes });

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const fixtures = JSON.parse(await readFile(resolve(fixtureRoot, 'fixtures.json'), 'utf8'));
const nativeExe = buildNativeExporter();
const textEncoder = new TextEncoder();
const rows = [];
const comparisons = [];
const failures = [];

for (const fixture of fixtures) {
  const fixtureDir = resolve(outputRoot, fixture.id);
  const wasmDir = resolve(fixtureDir, 'wasm');
  const nativeDir = resolve(fixtureDir, 'native');
  await mkdir(wasmDir, { recursive: true });
  await mkdir(nativeDir, { recursive: true });

  const options = fixture.options ? { ...defaultOptions, ...fixture.options } : defaultOptions;
  const clip = JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [bboxToRing(fixture.bbox)],
    },
  });
  const osmPath = resolve(fixtureRoot, fixture.file);
  const osmXml = await readFile(osmPath, 'utf8');

  const wasmResult = await runWasmFixture(osmXml, clip, options, wasmDir);
  const nativeResult = runNativeFixture(nativeExe, osmPath, clip, options, nativeDir);

  rows.push(rowFor(fixture.id, 'wasm', wasmResult));
  rows.push(rowFor(fixture.id, 'native', nativeResult));

  checkMinimums(fixture, 'wasm', wasmResult);
  checkMinimums(fixture, 'native', nativeResult);
  checkDiagnostics(fixture, 'wasm', wasmResult);
  checkDiagnostics(fixture, 'native', nativeResult);
  checkFixtureEvidence(fixture, 'wasm', wasmResult);
  checkFixtureEvidence(fixture, 'native', nativeResult);

  const outputMatches = compareOutputs(fixture.id, wasmResult.outputs, nativeResult.outputs);
  const diagnosticsMatch = compareDiagnostics(
    fixture.id,
    wasmResult.diagnostics.messages,
    nativeResult.diagnostics.messages
  );
  comparisons.push({
    id: fixture.id,
    outputsMatch: outputMatches.all,
    lanesMatch: outputMatches.lanes,
    laneMarkingsMatch: outputMatches.laneMarkings,
    intersectionMarkingsMatch: outputMatches.intersectionMarkings,
    networkMatch: outputMatches.network,
    diagnosticsMatch,
  });
}

await writeFile(
  resolve(outputRoot, 'comparison-summary.json'),
  `${JSON.stringify({ rows, comparisons, failures }, null, 2)}\n`
);

console.table(rows);
console.table(comparisons);
console.log(`Saved WASM/native outputs to ${outputRoot}`);

if (failures.length) {
  throw new Error(`osm2streets WASM/native comparison failed:\n${failures.join('\n')}`);
}

function buildNativeExporter() {
  const cargo = findCargo();
  const build = spawnSync(
    cargo,
    ['build', '--release', '-p', 'osm2streets-js', '--bin', 'webcityeditor_native_export'],
    { cwd: osm2streetsRoot, encoding: 'utf8' }
  );
  if (build.status !== 0) {
    throw new Error(
      `Failed to build native osm2streets exporter:\n${build.stdout}\n${build.stderr}`
    );
  }

  const exe = resolve(
    osm2streetsRoot,
    'target',
    'release',
    process.platform === 'win32' ? 'webcityeditor_native_export.exe' : 'webcityeditor_native_export'
  );
  if (!existsSync(exe)) {
    throw new Error(`Native osm2streets exporter was not built at ${exe}`);
  }
  return exe;
}

function findCargo() {
  const cargoName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const cargoHome = process.env.CARGO_HOME
    ? resolve(process.env.CARGO_HOME, 'bin', cargoName)
    : resolve(homedir(), '.cargo', 'bin', cargoName);
  return existsSync(cargoHome) ? cargoHome : cargoName;
}

async function runWasmFixture(osmXml, clip, options, outDir) {
  const diagnostics = {
    runner: 'wasm',
    warnings: 0,
    errors: 0,
    messages: [],
  };

  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = (...args) => {
    diagnostics.warnings += 1;
    diagnostics.messages.push({ level: 'WARN', message: args.map(String).join(' ') });
  };
  console.error = (...args) => {
    diagnostics.errors += 1;
    diagnostics.messages.push({ level: 'ERROR', message: args.map(String).join(' ') });
  };

  let network;
  try {
    network = new JsStreetNetwork(textEncoder.encode(osmXml), clip, options);
    const outputs = {
      lanes: network.toLanePolygonsGeojson(),
      laneMarkings: network.toLaneMarkingsGeojson(),
      intersectionMarkings: network.toIntersectionMarkingsGeojson(),
      network: network.toJson(),
    };
    const counts = {
      lanes: countFeatures(outputs.lanes),
      laneMarkings: countFeatures(outputs.laneMarkings),
      intersectionMarkings: countFeatures(outputs.intersectionMarkings),
    };

    await writeRunnerOutputs(outDir, outputs, {
      runner: 'wasm',
      counts,
      diagnostics: {
        warnings: diagnostics.warnings,
        errors: diagnostics.errors,
      },
    });
    await writeFile(
      resolve(outDir, 'diagnostics.json'),
      `${JSON.stringify(diagnostics, null, 2)}\n`
    );

    return { counts, diagnostics, outputs: normalizeOutputs(outputs) };
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
    if (network) {
      network.free();
    }
  }
}

function runNativeFixture(exe, osmPath, clip, options, outDir) {
  const result = spawnSync(
    exe,
    [
      '--osm',
      osmPath,
      '--clip-geojson',
      clip,
      '--options-json',
      JSON.stringify(options),
      '--out-dir',
      outDir,
    ],
    { encoding: 'utf8' }
  );

  return readNativeResult(outDir, result);
}

function readNativeResult(outDir, result) {
  const stdoutPath = resolve(outDir, 'stdout.txt');
  const stderrPath = resolve(outDir, 'stderr.txt');
  mkdirSync(dirname(stdoutPath), { recursive: true });
  writeFileSync(stdoutPath, result.stdout ?? '');
  writeFileSync(stderrPath, result.stderr ?? '');

  if (result.status !== 0) {
    throw new Error(
      `Native osm2streets exporter failed:\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
  }

  const summary = JSON.parse(readFileSync(resolve(outDir, 'summary.json'), 'utf8'));
  const diagnostics = JSON.parse(readFileSync(resolve(outDir, 'diagnostics.json'), 'utf8'));
  const outputs = {};
  for (const [key, fileName] of outputNames) {
    outputs[key] = readFileSync(resolve(outDir, fileName), 'utf8');
  }

  return {
    counts: summary.counts,
    diagnostics,
    outputs: normalizeOutputs(outputs),
  };
}

async function writeRunnerOutputs(outDir, outputs, summary) {
  for (const [key, fileName] of outputNames) {
    await writeFile(resolve(outDir, fileName), outputs[key]);
  }
  await writeFile(resolve(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

function normalizeOutputs(outputs) {
  return Object.fromEntries(
    Object.entries(outputs).map(([key, value]) => {
      const normalized = stableStringify(JSON.parse(value));
      return [
        key,
        {
          normalized,
          sha256: sha256(normalized),
        },
      ];
    })
  );
}

function compareOutputs(fixtureId, wasmOutputs, nativeOutputs) {
  const result = { all: true };
  for (const [key] of outputNames) {
    const matches = wasmOutputs[key].sha256 === nativeOutputs[key].sha256;
    result[key] = matches;
    if (!matches) {
      result.all = false;
      failures.push(
        `${fixtureId}: ${key} differs between WASM (${wasmOutputs[key].sha256}) and native (${nativeOutputs[key].sha256})`
      );
    }
  }
  return result;
}

function compareDiagnostics(fixtureId, wasmMessages, nativeMessages) {
  const wasm = diagnosticSignature(wasmMessages);
  const native = diagnosticSignature(nativeMessages);
  const matches = JSON.stringify(wasm) === JSON.stringify(native);
  if (!matches) {
    failures.push(`${fixtureId}: diagnostics differ between WASM and native`);
  }
  return matches;
}

function diagnosticSignature(messages) {
  return messages.map(({ level, message }) => ({ level, message }));
}

function checkMinimums(fixture, runner, result) {
  for (const [key, minimum] of Object.entries(fixture.minimum)) {
    if (result.counts[key] < minimum) {
      failures.push(`${fixture.id}/${runner}: ${key}=${result.counts[key]} below minimum ${minimum}`);
    }
  }
}

function checkDiagnostics(fixture, runner, result) {
  if (result.diagnostics.errors) {
    failures.push(`${fixture.id}/${runner}: emitted ${result.diagnostics.errors} error(s)`);
  }
}

function checkFixtureEvidence(fixture, runner, result) {
  const messages = result.diagnostics.messages.map(({ message }) => message);
  for (const expected of fixture.requiredDiagnosticIncludes ?? []) {
    if (!messages.some((message) => message.includes(expected))) {
      failures.push(`${fixture.id}/${runner}: missing diagnostic containing ${JSON.stringify(expected)}`);
    }
  }
  for (const forbidden of fixture.forbiddenDiagnosticIncludes ?? []) {
    if (messages.some((message) => message.includes(forbidden))) {
      failures.push(`${fixture.id}/${runner}: emitted forbidden diagnostic containing ${JSON.stringify(forbidden)}`);
    }
  }

  const lanes = JSON.parse(result.outputs.lanes.normalized);
  const renderedWayIds = new Set(
    (lanes.features ?? []).flatMap((feature) =>
      Array.isArray(feature.properties?.osm_way_ids)
        ? feature.properties.osm_way_ids.map(String)
        : []
    )
  );
  for (const wayId of fixture.requiredLaneWayIds ?? []) {
    if (!renderedWayIds.has(String(wayId))) {
      failures.push(`${fixture.id}/${runner}: required OSM way ${wayId} has no rendered lane polygon`);
    }
  }
}

function rowFor(id, runner, result) {
  return {
    id,
    runner,
    lanes: result.counts.lanes,
    laneMarkings: result.counts.laneMarkings,
    intersectionMarkings: result.counts.intersectionMarkings,
    warnings: result.diagnostics.warnings,
    errors: result.diagnostics.errors,
  };
}

function bboxToRing([west, south, east, north]) {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function countFeatures(geojsonText) {
  const geojson = JSON.parse(geojsonText);
  return Array.isArray(geojson.features) ? geojson.features.length : 0;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
