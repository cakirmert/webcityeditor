import initWasm, { JsStreetNetwork } from 'osm2streets-js';
import osm2streetsWasmUrl from 'osm2streets-js/osm2streets_js_bg.wasm?url';
import {
  buildOsm2StreetsImportOptions,
  type Osm2StreetsImportOptions,
} from './osm2streets-options';

export interface Osm2StreetsResult {
  plain: GeoJsonFeatureCollection;
  lanes: GeoJsonFeatureCollection;
  laneMarkings: GeoJsonFeatureCollection;
  intersectionMarkings: GeoJsonFeatureCollection;
  engine: 'fork';
  diagnostics: Osm2StreetsDiagnostic[];
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Osm2StreetsFeature[];
  [key: string]: any;
}

export interface Osm2StreetsFeature {
  type?: 'Feature';
  properties?: Record<string, any>;
  geometry?: {
    type: string;
    coordinates: any;
  } | null;
  [key: string]: any;
}

export type Osm2StreetsSelection =
  | { kind: 'lane'; feature: Osm2StreetsFeature }
  | { kind: 'intersection'; feature: Osm2StreetsFeature }
  | null;

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
    return readOsm2StreetsResult(osmXml, clipPtsGeojson, importOptions, diagnostics);
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
  importOptions: Osm2StreetsImportOptions,
  diagnostics: Osm2StreetsDiagnostic[]
): Osm2StreetsResult {
  const network = new JsStreetNetwork(textEncoder.encode(osmXml), clipPtsGeojson, importOptions);
  try {
    const plain = parseFeatureCollection(network.toGeojsonPlain(), 'plain road/intersection GeoJSON');
    const lanes = parseFeatureCollection(network.toLanePolygonsGeojson(), 'lane polygons GeoJSON');
    const laneMarkings = parseFeatureCollection(
      network.toLaneMarkingsGeojson(),
      'lane markings GeoJSON'
    );
    const intersectionMarkings = parseFeatureCollection(
      network.toIntersectionMarkingsGeojson(),
      'intersection markings GeoJSON'
    );
    if (!plain.features.some((feature) => feature?.properties?.type === 'intersection')) {
      diagnostics.push({
        level: 'warn',
        message:
          'osm2streets plain GeoJSON did not include intersection polygons for this extract.',
      });
    }

    return {
      plain,
      lanes,
      laneMarkings,
      intersectionMarkings,
      engine: 'fork',
      diagnostics,
    };
  } finally {
    network.free();
  }
}

function parseFeatureCollection(text: string, label: string): GeoJsonFeatureCollection {
  const value = JSON.parse(text);
  if (
    !value ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features)
  ) {
    throw new Error(`osm2streets returned invalid ${label}`);
  }
  return value;
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
