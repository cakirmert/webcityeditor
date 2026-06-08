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

  const primaryOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: true });
  try {
    return readOsm2StreetsResult(osmXml, clipPtsGeojson, primaryOptions, 'osm2lanes');
  } catch (error) {
    /*
     * osm2lanes is the preferred parser because it understands modern lane
     * tagging better than the old osm2streets parser. Some real OSM ways still
     * contain tag combinations that this older bundled WASM cannot digest, so
     * fall back to the classic parser to keep the road editor usable instead
     * of dropping all lane geometry.
     */
    console.warn('osm2lanes generation failed; retrying with classic osm2streets parser.', error);
    const fallbackOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: false });
    return readOsm2StreetsResult(osmXml, clipPtsGeojson, fallbackOptions, 'classic');
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
