import initWasm, { JsStreetNetwork } from 'osm2streets-js';
import osm2streetsWasmUrl from 'osm2streets-js/osm2streets_js_bg.wasm?url';

export interface Osm2StreetsResult {
  lanes: any;
  laneMarkings: any;
  intersectionMarkings: any;
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
    });
  }

  // Import options for the Rust osm2streets reader
  const importOptions = {
    debug_each_step: false,
    dual_carriageway_experiment: false,
    sidepath_zipping_experiment: false,
    inferred_sidewalks: true,
    inferred_kerbs: false,
    date_time: null,
    override_driving_side: 'Right', // default to Right-hand traffic (Germany/NL/etc.)
  };

  const network = new JsStreetNetwork(osmXml, clipPtsGeojson, importOptions);

  try {
    const lanes = JSON.parse(network.toLanePolygonsGeojson());
    const laneMarkings = JSON.parse(network.toLaneMarkingsGeojson());
    const intersectionMarkings = JSON.parse(network.toIntersectionMarkingsGeojson());

    return {
      lanes,
      laneMarkings,
      intersectionMarkings,
    };
  } finally {
    network.free();
  }
}
