export interface Osm2StreetsImportOptions {
  debug_each_step: boolean;
  dual_carriageway_experiment: boolean;
  sidepath_zipping_experiment: boolean;
  inferred_sidewalks: boolean;
  inferred_kerbs: boolean;
  date_time: string | null;
  override_driving_side: '' | 'Left' | 'Right';
}

export function buildOsm2StreetsImportOptions(): Osm2StreetsImportOptions {
  /*
   * Keep the shape exact for the source-built osm2streets-js WASM binding.
   * The generated TypeScript definitions only say "input: any", but Rust
   * deserializes this object into ImportOptions.
   */
  return {
    debug_each_step: false,
    dual_carriageway_experiment: false,
    sidepath_zipping_experiment: false,
    inferred_sidewalks: true,
    inferred_kerbs: true,
    date_time: null,
    override_driving_side: '',
  };
}
