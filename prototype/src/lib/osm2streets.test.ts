import { describe, expect, it } from 'vitest';
import { buildOsm2StreetsImportOptions } from './osm2streets-options';

describe('osm2streets WASM options', () => {
  it('keeps the legacy osm2lanes flag required by the bundled npm WASM', () => {
    const options = buildOsm2StreetsImportOptions({ useOsm2Lanes: true });

    /*
     * Regression guard for the browser error:
     *   "osm2streets Wasm generation failed: missing field `osm2lanes`"
     *
     * osm2streets-js types do not document the options shape, so this test
     * makes the required runtime contract explicit.
     */
    expect(options).toEqual({
      debug_each_step: false,
      dual_carriageway_experiment: false,
      sidepath_zipping_experiment: false,
      inferred_sidewalks: true,
      osm2lanes: true,
    });
  });

  it('can build a classic-parser fallback while preserving the same WASM contract', () => {
    expect(buildOsm2StreetsImportOptions({ useOsm2Lanes: false })).toMatchObject({
      osm2lanes: false,
    });
  });
});
