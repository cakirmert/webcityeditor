import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildOsm2StreetsImportOptions } from '../../src/lib/osm2streets-options';
import { processOsmXml } from '../../src/lib/osm2streets';

describe('osm2streets WASM options', () => {
  it('keeps the import option shape required by the forked WASM', () => {
    const options = buildOsm2StreetsImportOptions();

    /*
     * Regression guard for the browser error:
     *   "osm2streets Wasm generation failed: missing field ..."
     *
     * osm2streets-js types do not document the options shape, so this test
     * makes the required runtime contract explicit.
     */
    expect(options).toEqual({
      debug_each_step: false,
      dual_carriageway_experiment: false,
      sidepath_zipping_experiment: false,
      inferred_sidewalks: true,
      inferred_kerbs: true,
      date_time: null,
      override_driving_side: '',
    });
  });

  it('runs the bundled osm2streets WASM without emitting browser errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (
        url.endsWith('/node_modules/osm2streets-js/osm2streets_js_bg.wasm') ||
        url.endsWith('/vendor/osm2streets-js/osm2streets_js_bg.wasm')
      ) {
        const wasm = readFileSync(
          resolve(__dirname, '../../vendor/osm2streets-js/osm2streets_js_bg.wasm')
        );
        return new Response(wasm, { headers: { 'Content-Type': 'application/wasm' } });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const result = await processOsmXml(
        `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="codex-test">
  <bounds minlat="53.5490" minlon="9.9920" maxlat="53.5510" maxlon="9.9960"/>
  <node id="1" lat="53.5495" lon="9.9925"/>
  <node id="2" lat="53.5500" lon="9.9940"/>
  <node id="3" lat="53.5505" lon="9.9955"/>
  <way id="100">
    <nd ref="1"/>
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="residential"/>
    <tag k="name" v="Codex Test Street"/>
    <tag k="lanes" v="2"/>
    <tag k="maxspeed" v="30"/>
  </way>
</osm>`,
        [9.992, 53.549, 9.996, 53.551]
      );

      expect(result.engine).toBe('fork');
      expect(result.lanes).toMatchObject({ type: 'FeatureCollection' });
      expect(result.laneMarkings).toMatchObject({ type: 'FeatureCollection' });
      expect(result.intersectionMarkings).toMatchObject({ type: 'FeatureCollection' });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      errorSpy.mockRestore();
    }
  });
});
