import initWasm, { JsStreetNetwork } from 'osm2streets-js';
import osm2streetsWasmUrl from 'osm2streets-js/osm2streets_js_bg.wasm?url';
import {
  buildOsm2StreetsImportOptions,
  type Osm2StreetsImportOptions,
} from './osm2streets-options';
import {
  buildLaneGeometryFromOsmXml,
  type GeoJsonFeatureCollection,
} from './lane-geometry';

export interface Osm2StreetsResult {
  lanes: GeoJsonFeatureCollection;
  laneMarkings: GeoJsonFeatureCollection;
  intersectionMarkings: GeoJsonFeatureCollection;
  engine: 'osm2lanes' | 'classic' | 'ts-fallback';
  warnings?: string[];
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
  const errors: string[] = [];
  try {
    await initOsm2Streets();

    const primaryOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: false });
    const classic = readOsm2StreetsResult(osmXml, clipPtsGeojson, primaryOptions, 'classic');
    if (hasRenderableLanes(classic)) return classic;
    errors.push('classic osm2streets returned no lane polygons');

    try {
      const fallbackOptions = buildOsm2StreetsImportOptions({ useOsm2Lanes: true });
      const osm2lanes = readOsm2StreetsResult(
        osmXml,
        clipPtsGeojson,
        fallbackOptions,
        'osm2lanes'
      );
      if (hasRenderableLanes(osm2lanes)) return osm2lanes;
      errors.push('osm2lanes returned no lane polygons');
    } catch (error) {
      errors.push(`osm2lanes failed: ${formatError(error)}`);
    }
  } catch (error) {
    errors.push(`osm2streets WASM failed: ${formatError(error)}`);
  }

  const fallback = buildLaneGeometryFromOsmXml(osmXml);
  return {
    ...fallback,
    engine: 'ts-fallback',
    warnings: [...errors, ...fallback.warnings],
  };
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

function hasRenderableLanes(result: Osm2StreetsResult): boolean {
  return Array.isArray(result.lanes?.features) && result.lanes.features.length > 0;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
