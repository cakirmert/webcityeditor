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
  engine: 'classic';
}

let initPromise: Promise<any> | null = null;

export async function initOsm2Streets(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm(osm2streetsWasmUrl);
  }
  await initPromise;
}

export async function processOsmXml(
  osmXml: string,
  clipBbox: [number, number, number, number] | null
): Promise<Osm2StreetsResult> {
  await initOsm2Streets();

  const clipPtsGeojson = clipBbox ? buildClipPolygonGeojson(clipBbox) : '';

  /*
   * Use exactly one geometry engine: the classic osm2streets parser.
   * The osm2lanes-backed parser in the old npm WASM does not support common
   * sidewalk tag combinations in Hamburg data.
   */
  const importOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: false });
  return readOsm2StreetsResult(osmXml, clipPtsGeojson, importOptions);
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
  const network = new JsStreetNetwork(osmXml, clipPtsGeojson, importOptions);
  try {
    const lanes = JSON.parse(network.toLanePolygonsGeojson());
    const laneMarkings = JSON.parse(network.toLaneMarkingsGeojson());
    const intersectionMarkings = JSON.parse(network.toIntersectionMarkingsGeojson());

    return {
      lanes,
      laneMarkings,
      intersectionMarkings,
      engine: 'classic',
    };
  } finally {
    network.free();
  }
}
