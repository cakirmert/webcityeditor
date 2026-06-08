export interface Osm2StreetsImportOptions {
  debug_each_step: boolean;
  dual_carriageway_experiment: boolean;
  sidepath_zipping_experiment: boolean;
  inferred_sidewalks: boolean;
  osm2lanes: boolean;
}

export function buildOsm2StreetsImportOptions({
  useOsm2Lanes,
}: {
  useOsm2Lanes: boolean;
}): Osm2StreetsImportOptions {
  /*
   * osm2streets-js 0.1.4 ships a WASM binary built from an older Rust API.
   * The generated TypeScript definitions only say "input: any", but the
   * binary still deserializes a required legacy `osm2lanes` boolean. If this
   * field is missing, the constructor fails before any lane geometry can be
   * produced with: "missing field `osm2lanes`".
   *
   * Keep the shape exact and toggle only the parser choice. `useOsm2Lanes`
   * enables the osm2lanes-backed parser; false uses the classic osm2streets
   * parser as a graceful fallback when a real OSM tag combination crashes the
   * older bundled wasm.
   */
  return {
    debug_each_step: false,
    dual_carriageway_experiment: false,
    sidepath_zipping_experiment: false,
    inferred_sidewalks: true,
    osm2lanes: useOsm2Lanes,
  };
}
