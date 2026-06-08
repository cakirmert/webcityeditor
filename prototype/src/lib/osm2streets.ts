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
  engine: 'osm2lanes' | 'classic';
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

  let clipPtsGeojson = '';
  if (clipBbox) {
    const [west, south, east, north] = clipBbox;
    clipPtsGeojson = JSON.stringify({
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

  /*
   * The bundled osm2streets-js 0.1.4 WASM ships an older osm2lanes that does
   * not support common sidewalk tag combinations (sidewalk:left=no +
   * sidewalk:right=separate, sidewalk:both=separate, etc.). This produces a
   * flood of console errors for real-world OSM data.
   *
   * Use the classic osm2streets parser by default — it handles all tag
   * combinations without errors. If the classic parser ever fails on a
   * specific dataset, fall back to osm2lanes as a last resort.
   */
  const primaryOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: false });
  try {
    return readOsm2StreetsResult(osmXml, clipPtsGeojson, primaryOptions, 'classic');
  } catch (error) {
    console.warn('Classic osm2streets parser failed; retrying with osm2lanes.', error);
    const fallbackOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: true });
    return readOsm2StreetsResult(osmXml, clipPtsGeojson, fallbackOptions, 'osm2lanes');
  }
}

function readOsm2StreetsResult(
  osmXml: string,
  clipPtsGeojson: string,
  importOptions: Osm2StreetsImportOptions,
  engine: Osm2StreetsResult['engine']
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
      engine,
    };
  } finally {
    network.free();
  }
}
