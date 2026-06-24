import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const prototypeRoot = resolve(__dirname, '..');
const fixtureRoot = resolve(prototypeRoot, 'test-fixtures', 'osm2streets');
const vendorRoot = resolve(prototypeRoot, 'vendor', 'osm2streets-js');

const { default: initWasm, JsStreetNetwork } = await import(
  pathToFileURL(resolve(vendorRoot, 'osm2streets_js.js')).href
);

const wasmBytes = await readFile(resolve(vendorRoot, 'osm2streets_js_bg.wasm'));
await initWasm({ module_or_path: wasmBytes });

const fixtures = JSON.parse(await readFile(resolve(fixtureRoot, 'fixtures.json'), 'utf8'));
const textEncoder = new TextEncoder();

const defaultOptions = {
  debug_each_step: false,
  dual_carriageway_experiment: false,
  sidepath_zipping_experiment: false,
  inferred_sidewalks: true,
  inferred_kerbs: true,
  date_time: null,
  override_driving_side: '',
};

const originalError = console.error;
const errorMessages = [];
console.error = (...args) => {
  errorMessages.push(args.map(String).join(' '));
};

try {
  const rows = [];
  const failures = [];

  for (const fixture of fixtures) {
    const xml = await readFile(resolve(fixtureRoot, fixture.file), 'utf8');
    const clip = JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [bboxToRing(fixture.bbox)],
      },
    });

    const network = new JsStreetNetwork(
      textEncoder.encode(xml),
      clip,
      fixture.options ? { ...defaultOptions, ...fixture.options } : defaultOptions
    );

    try {
      const counts = {
        lanes: countFeatures(network.toLanePolygonsGeojson()),
        laneMarkings: countFeatures(network.toLaneMarkingsGeojson()),
        intersectionMarkings: countFeatures(network.toIntersectionMarkingsGeojson()),
      };

      rows.push({ id: fixture.id, ...counts });
      for (const [key, minimum] of Object.entries(fixture.minimum)) {
        if (counts[key] < minimum) {
          failures.push(`${fixture.id}: ${key}=${counts[key]} below minimum ${minimum}`);
        }
      }
    } finally {
      network.free();
    }
  }

  console.table(rows);

  if (errorMessages.length) {
    failures.push(`osm2streets emitted console.error ${errorMessages.length} time(s)`);
    for (const message of errorMessages.slice(0, 5)) {
      failures.push(`  ${message}`);
    }
  }

  if (failures.length) {
    throw new Error(`osm2streets fixture comparison failed:\n${failures.join('\n')}`);
  }
} finally {
  console.error = originalError;
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
