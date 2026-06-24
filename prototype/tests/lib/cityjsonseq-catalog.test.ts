import { describe, expect, it, vi } from 'vitest';
import {
  fetchCityJsonSeqCatalog,
  fetchCityJsonSeqViewport,
  normalizeCatalogBaseUrl,
  parseCityJsonSeqStrict,
  projectWgs84BboxToCrs,
} from '../../src/lib/cityjsonseq-catalog';
import { checkIntegrity } from '../../src/lib/integrity';

function tileText(id: string, translateX: number): string {
  const header = {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [0.001, 0.001, 0.001], translate: [translateX, 5936000, 0] },
    metadata: {
      geographicalExtent: [translateX, 5936000, 0, translateX + 10, 5936010, 10],
      referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
    },
    CityObjects: {},
    vertices: [],
  };
  const feature = {
    type: 'CityJSONFeature',
    id,
    CityObjects: {
      [id]: {
        type: 'Building',
        geometry: [{ type: 'Solid', lod: '2.0', boundaries: [[[[0, 1, 2, 3]]]] }],
      },
    },
    vertices: [
      [0, 0, 0],
      [10000, 0, 0],
      [10000, 10000, 0],
      [0, 10000, 0],
    ],
  };
  return [header, feature].map((value) => JSON.stringify(value)).join('\n');
}

function queryResponse() {
  return {
    crs: 'EPSG:25832',
    count: 2,
    tiles: [
      {
        id: 'tile-a',
        file: 'tile-a.city.jsonl',
        url: '/tiles/tile-a.city.jsonl',
        extent: [565000, 5936000, 0, 565010, 5936010, 10],
        features: 1,
        cityObjects: 1,
        vertices: 4,
        syntheticRootsAdded: 0,
      },
      {
        id: 'tile-b',
        file: 'tile-b.city.jsonl',
        url: '/tiles/tile-b.city.jsonl',
        extent: [566000, 5936000, 0, 566010, 5936010, 10],
        features: 1,
        cityObjects: 1,
        vertices: 4,
        syntheticRootsAdded: 0,
      },
    ],
  };
}

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => String(body),
  } as unknown as Response;
}

describe('fetchCityJsonSeqViewport', () => {
  it('fetches matching seq tiles and re-encodes different local transforms exactly', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/hamburg/tiles?')) return response(queryResponse());
      if (url.endsWith('/tiles/tile-a.city.jsonl')) return response(tileText('Building_A', 565000));
      if (url.endsWith('/tiles/tile-b.city.jsonl')) return response(tileText('Building_B', 566000));
      throw new Error(`Unexpected URL ${url}`);
    }) as unknown as typeof fetch;

    const loaded = await fetchCityJsonSeqViewport(
      'http://127.0.0.1:8787',
      [565000, 5936000, 566000, 5937000],
      new Set(),
      fetchImpl
    );

    expect(loaded.tileIds).toEqual(['tile-a', 'tile-b']);
    expect(loaded.features).toBe(2);
    expect(Object.keys(loaded.doc!.CityObjects).sort()).toEqual(['Building_A', 'Building_B']);
    expect(loaded.doc!.vertices[4]).toEqual([1000000, 0, 0]);
    expect(checkIntegrity(loaded.doc!).ok).toBe(true);
  });

  it('does not re-fetch tiles already present in the working set', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/hamburg/tiles?')) return response(queryResponse());
      if (url.endsWith('/tiles/tile-b.city.jsonl')) return response(tileText('Building_B', 566000));
      throw new Error(`Unexpected URL ${url}`);
    }) as unknown as typeof fetch;

    const loaded = await fetchCityJsonSeqViewport(
      'http://127.0.0.1:8787',
      [565000, 5936000, 566000, 5937000],
      new Set(['tile-a']),
      fetchImpl
    );

    expect(loaded.tileIds).toEqual(['tile-b']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('requires the user to zoom in before a request can pull too many new tiles', async () => {
    const fetchImpl = vi.fn(async () => response(queryResponse())) as unknown as typeof fetch;
    await expect(
      fetchCityJsonSeqViewport(
        'http://127.0.0.1:8787',
        [565000, 5936000, 566000, 5937000],
        new Set(),
        fetchImpl,
        1
      )
    ).rejects.toThrow(/Zoom in/);
  });
});

describe('fetchCityJsonSeqCatalog', () => {
  it('fetches every tile exposed by the Hamburg catalog endpoint', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'http://127.0.0.1:8787/api/hamburg/tiles') return response(queryResponse());
      if (url.endsWith('/tiles/tile-a.city.jsonl')) return response(tileText('Building_A', 565000));
      if (url.endsWith('/tiles/tile-b.city.jsonl')) return response(tileText('Building_B', 566000));
      throw new Error(`Unexpected URL ${url}`);
    }) as unknown as typeof fetch;

    const loaded = await fetchCityJsonSeqCatalog('http://127.0.0.1:8787', new Set(), fetchImpl);

    expect(loaded.queriedTileCount).toBe(2);
    expect(loaded.tileIds).toEqual(['tile-a', 'tile-b']);
    expect(Object.keys(loaded.doc!.CityObjects).sort()).toEqual(['Building_A', 'Building_B']);
    expect(fetchImpl).toHaveBeenCalledWith(new URL('http://127.0.0.1:8787/api/hamburg/tiles'));
  });
});

describe('CityJSONSeq catalog helpers', () => {
  it('rejects malformed feature lines instead of silently skipping them', () => {
    expect(() => parseCityJsonSeqStrict(`${tileText('Building_A', 565000)}\n{bad`, 'bad-tile')).toThrow(
      /bad-tile:3: invalid JSON/
    );
  });

  it('accepts either the catalog endpoint or the server root as base URL', () => {
    expect(normalizeCatalogBaseUrl('http://127.0.0.1:8787/api/hamburg/catalog').toString()).toBe(
      'http://127.0.0.1:8787/'
    );
  });

  it('projects a Hamburg WGS84 viewport into EPSG:25832 metres', () => {
    const bbox = projectWgs84BboxToCrs([9.98, 53.54, 10.0, 53.56], 'EPSG:25832');
    expect(bbox[0]).toBeGreaterThan(560000);
    expect(bbox[2]).toBeLessThan(570000);
    expect(bbox[1]).toBeGreaterThan(5930000);
    expect(bbox[3]).toBeLessThan(5945000);
  });
});
