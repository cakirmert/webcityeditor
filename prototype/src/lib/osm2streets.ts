import initWasm, { JsStreetNetwork } from 'osm2streets-js';
import osm2streetsWasmUrl from 'osm2streets-js/osm2streets_js_bg.wasm?url';
import {
  buildOsm2StreetsImportOptions,
  type Osm2StreetsImportOptions,
} from './osm2streets-options';

export interface Osm2StreetsResult {
  lanes: any;
  laneMarkings: any;
  intersectionMarkings: any;
  engine: 'fork';
  diagnostics: Osm2StreetsDiagnostic[];
}

export interface Osm2StreetsDiagnostic {
  level: 'warn' | 'error';
  message: string;
}

let initPromise: Promise<any> | null = null;
const textEncoder = new TextEncoder();

export async function initOsm2Streets(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm({ module_or_path: osm2streetsWasmUrl });
  }
  await initPromise;
}

export async function processOsmXml(
  osmXml: string,
  clipBbox: [number, number, number, number] | null
): Promise<Osm2StreetsResult> {
  await initOsm2Streets();

  const clipPtsGeojson = clipBbox ? buildClipPolygonGeojson(clipBbox) : '';

  const importOptions = buildOsm2StreetsImportOptions();
  const diagnostics: Osm2StreetsDiagnostic[] = [];
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = (...args: unknown[]) => {
    diagnostics.push({ level: 'warn', message: formatConsoleMessage(args) });
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    diagnostics.push({ level: 'error', message: formatConsoleMessage(args) });
    originalError(...args);
  };
  try {
    return {
      ...readOsm2StreetsResult(osmXml, clipPtsGeojson, importOptions),
      diagnostics,
    };
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

function buildClipPolygonGeojson([west, south, east, north]: [
  number,
  number,
  number,
  number,
]): string {
  return JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  });
}

function readOsm2StreetsResult(
  osmXml: string,
  clipPtsGeojson: string,
  importOptions: Osm2StreetsImportOptions
): Osm2StreetsResult {
  const network = new JsStreetNetwork(textEncoder.encode(osmXml), clipPtsGeojson, importOptions);
  try {
    const lanes = JSON.parse(network.toLanePolygonsGeojson());
    const laneMarkings = JSON.parse(network.toLaneMarkingsGeojson());
    const intersectionMarkings = JSON.parse(network.toIntersectionMarkingsGeojson());

    return {
      lanes,
      laneMarkings,
      intersectionMarkings,
      engine: 'fork',
      diagnostics: [],
    };
  } finally {
    network.free();
  }
}

function formatConsoleMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}
