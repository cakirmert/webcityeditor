import { describe, expect, it, vi } from 'vitest';
import { checkIntegrity } from '../../src/lib/integrity';
import { mergeCityJson } from '../../src/lib/merge';
import { splitBuildingByFloorPlans } from '../../src/lib/subdivision';
import { moveBuilding } from '../../src/lib/transform';
import {
  describeCityJsonSeqTileStrict,
  parseCityJsonSeqStrict,
  type CityJsonSeqCatalogTile,
} from '../../src/lib/cityjsonseq-catalog';
import {
  CatalogWritebackError,
  evictCleanCityJsonSeqTiles,
  persistDirtyCityJsonSeqTiles,
  planCatalogWriteback,
  serializeCityJsonSeqTile,
} from '../../src/lib/cityjsonseq-writeback';

function tileText(id: string, translateX: number): string {
  return [
    {
      type: 'CityJSON',
      version: '2.0',
      transform: { scale: [0.001, 0.001, 0.001], translate: [translateX, 5936000, 0] },
      metadata: {
        geographicalExtent: [translateX, 5936000, 0, translateX + 10, 5936010, 10],
        referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
      },
      CityObjects: {},
      vertices: [],
    },
    {
      type: 'CityJSONFeature',
      id,
      CityObjects: {
        [id]: {
          type: 'Building',
          geometry: [
            {
              type: 'Solid',
              lod: '2.0',
              boundaries: [
                [
                  [[0, 3, 2, 1]],
                  [[4, 5, 6, 7]],
                  [[0, 1, 5, 4]],
                  [[1, 2, 6, 5]],
                  [[2, 3, 7, 6]],
                  [[3, 0, 4, 7]],
                ],
              ],
            },
          ],
        },
      },
      vertices: [
        [0, 0, 0],
        [10000, 0, 0],
        [10000, 10000, 0],
        [0, 10000, 0],
        [0, 0, 10000],
        [10000, 0, 10000],
        [10000, 10000, 10000],
        [0, 10000, 10000],
      ],
    },
  ]
    .map((value) => JSON.stringify(value))
    .join('\n');
}

function catalog(id: string, translateX: number, revision = 'r1'): CityJsonSeqCatalogTile {
  return {
    id,
    file: `${id}.city.jsonl`,
    url: `/tiles/${id}.city.jsonl`,
    revision,
    extent: [translateX, 5936000, 0, translateX + 10, 5936010, 10],
    features: 1,
    cityObjects: 1,
    vertices: 8,
    syntheticRootsAdded: 0,
  };
}

function loaded(id: string, translateX: number, revision = 'r1') {
  const text = tileText(id, translateX);
  return describeCityJsonSeqTileStrict(text, catalog(id, translateX, revision));
}

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Failure',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('CityJSONSeq catalog write-back', () => {
  it('serializes an edited tile back into its original local integer grid', () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    moveBuilding(doc, 'Building_A', 2.5, -1.25, 0);
    const plan = planCatalogWriteback(doc, new Map([['Building_A', source]]), new Set(['Building_A']));
    const text = serializeCityJsonSeqTile(doc, source, plan.featureTileIds);
    const reopened = parseCityJsonSeqStrict(text);

    expect(reopened.transform?.translate).toEqual([565000, 5936000, 0]);
    expect(reopened.vertices[0]).toEqual([2500, -1250, 0]);
    expect(checkIntegrity(reopened).ok).toBe(true);
  });

  it('re-encodes a moved adjacent tile after the viewport merged different transforms', () => {
    const left = loaded('Building_A', 565000);
    const right = loaded('Building_B', 566000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    const incoming = parseCityJsonSeqStrict(tileText('Building_B', 566000));
    expect(mergeCityJson(doc, incoming).ok).toBe(true);
    moveBuilding(doc, 'Building_B', 5, 0, 0);

    const sources = new Map([
      ['Building_A', left],
      ['Building_B', right],
    ]);
    const plan = planCatalogWriteback(doc, sources, new Set(['Building_B']));
    const reopened = parseCityJsonSeqStrict(serializeCityJsonSeqTile(doc, right, plan.featureTileIds));

    expect(plan.dirtyTileIds).toEqual(new Set(['Building_B']));
    expect(reopened.vertices[0]).toEqual([5000, 0, 0]);
    expect(checkIntegrity(reopened).ok).toBe(true);
  });

  it('assigns a newly created root to the nearest loaded sequence tile', () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    doc.CityObjects.Building_New = {
      type: 'Building',
      geometry: JSON.parse(JSON.stringify(doc.CityObjects.Building_A.geometry)),
    };
    const plan = planCatalogWriteback(doc, new Map([['Building_A', source]]), new Set(['Building_New']));
    const values = serializeCityJsonSeqTile(doc, source, plan.featureTileIds)
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { id?: string });

    expect(values.map((value) => value.id).filter(Boolean)).toEqual([
      'Building_A',
      'Building_New',
    ]);
  });

  it('round-trips a per-floor footprint split as one source feature hierarchy', () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    const { partIds } = splitBuildingByFloorPlans(
      doc,
      'Building_A',
      [5, 5],
      [
        { partCount: 1, axis: 'auto' },
        { partCount: 2, axis: 'longer', cutFractions: [0.5] },
      ]
    );
    const plan = planCatalogWriteback(
      doc,
      new Map([['Building_A', source]]),
      new Set(['Building_A', ...partIds])
    );
    const reopened = parseCityJsonSeqStrict(serializeCityJsonSeqTile(doc, source, plan.featureTileIds));

    expect(partIds).toHaveLength(3);
    expect(reopened.CityObjects.Building_A.geometry).toEqual([]);
    expect(reopened.CityObjects.Building_A.children).toEqual(partIds);
    for (const partId of partIds) {
      expect(reopened.CityObjects[partId].parents).toEqual(['Building_A']);
    }
    expect(checkIntegrity(reopened).ok).toBe(true);
  });

  it('keeps dirty off-screen tiles and evicts clean ones', () => {
    const left = loaded('Building_A', 565000);
    const right = loaded('Building_B', 566000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    expect(mergeCityJson(doc, parseCityJsonSeqStrict(tileText('Building_B', 566000))).ok).toBe(true);
    const sources = new Map([
      ['Building_A', left],
      ['Building_B', right],
    ]);

    expect(
      evictCleanCityJsonSeqTiles(doc, sources, new Set(['Building_B']), new Set(['Building_A']))
        .evictedTileIds
    ).toEqual([]);
    const evicted = evictCleanCityJsonSeqTiles(doc, sources, new Set(['Building_B']), new Set());

    expect(evicted.evictedTileIds).toEqual(['Building_A']);
    expect(doc.CityObjects.Building_A).toBeUndefined();
    expect(doc.CityObjects.Building_B).toBeDefined();
    expect(checkIntegrity(doc).ok).toBe(true);
  });

  it('sends optimistic concurrency revision and retains the updated descriptor', async () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    moveBuilding(doc, 'Building_A', 1, 0, 0);
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      expect((init?.headers as Record<string, string>)['If-Match']).toBe('"r1"');
      return response({ tile: { ...source.catalog, revision: 'r2' } });
    }) as unknown as typeof fetch;

    const result = await persistDirtyCityJsonSeqTiles(
      'http://127.0.0.1:8787',
      doc,
      new Map([['Building_A', source]]),
      new Set(['Building_A']),
      fetchImpl
    );

    expect(result.persistedTileIds).toEqual(['Building_A']);
    expect(result.tiles.get('Building_A')?.catalog.revision).toBe('r2');
  });

  it('refuses a blind checkpoint when the loaded catalog tile has no revision', async () => {
    const source = loaded('Building_A', 565000, '');
    source.catalog.revision = undefined;
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    moveBuilding(doc, 'Building_A', 1, 0, 0);
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      persistDirtyCityJsonSeqTiles(
        'http://127.0.0.1:8787',
        doc,
        new Map([['Building_A', source]]),
        new Set(['Building_A']),
        fetchImpl
      )
    ).rejects.toThrow(/has no revision/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('removes a sparse source tile when its final feature is deleted', async () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    delete doc.CityObjects.Building_A;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('DELETE');
      expect(init?.body).toBeUndefined();
      return response({ ok: true, deleted: true, id: 'Building_A' });
    }) as unknown as typeof fetch;

    const result = await persistDirtyCityJsonSeqTiles(
      'http://127.0.0.1:8787',
      doc,
      new Map([['Building_A', source]]),
      new Set(['Building_A']),
      fetchImpl
    );

    expect(result.persistedTileIds).toEqual(['Building_A']);
    expect(result.tiles.size).toBe(0);
  });

  it('ignores a newly created root deleted before its first checkpoint', async () => {
    const source = loaded('Building_A', 565000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const result = await persistDirtyCityJsonSeqTiles(
      'http://127.0.0.1:8787',
      doc,
      new Map([['Building_A', source]]),
      new Set(['Building_NeverPersisted']),
      fetchImpl
    );

    expect(result.persistedTileIds).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retains updated tile revisions when a later tile checkpoint fails', async () => {
    const left = loaded('Building_A', 565000);
    const right = loaded('Building_B', 566000);
    const doc = parseCityJsonSeqStrict(tileText('Building_A', 565000));
    expect(mergeCityJson(doc, parseCityJsonSeqStrict(tileText('Building_B', 566000))).ok).toBe(true);
    moveBuilding(doc, 'Building_A', 1, 0, 0);
    moveBuilding(doc, 'Building_B', 1, 0, 0);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/Building_A')
        ? response({ tile: { ...left.catalog, revision: 'r2' } })
        : response('conflict', false, 409)
    ) as unknown as typeof fetch;

    let failure: unknown;
    try {
      await persistDirtyCityJsonSeqTiles(
        'http://127.0.0.1:8787',
        doc,
        new Map([
          ['Building_A', left],
          ['Building_B', right],
        ]),
        new Set(['Building_A', 'Building_B']),
        fetchImpl
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CatalogWritebackError);
    const writebackError = failure as CatalogWritebackError;
    expect(writebackError.result.persistedTileIds).toEqual(['Building_A']);
    expect(writebackError.result.tiles.get('Building_A')?.catalog.revision).toBe('r2');
  });
});
