import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareFreshOsmRoads } from '../../src/lib/project-osm-reset';
const process = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/osm2streets', () => ({ processOsmXml: process }));
afterEach(() => { vi.unstubAllGlobals(); process.mockReset(); });

describe('fresh project OSM download', () => {
  it('refuses partial Overpass responses before constructing a replacement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<osm version="0.6"><node id="1" lat="53.5" lon="10"/><remark>runtime error: Query timed out</remark></osm>')));
    await expect(prepareFreshOsmRoads([9.99, 53.54, 10, 53.55], new AbortController().signal)).rejects.toThrow(/incomplete/);
    expect(process).not.toHaveBeenCalled();
  });
  it('reports server failures without attempting an import', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 504 })));
    await expect(prepareFreshOsmRoads([9.99, 53.54, 10, 53.55], new AbortController().signal)).rejects.toThrow(/504/);
    expect(process).not.toHaveBeenCalled();
  });
});
