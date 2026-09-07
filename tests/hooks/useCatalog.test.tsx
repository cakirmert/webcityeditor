import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCatalog } from '../../src/hooks/useCatalog';
import { useCoreState } from '../../src/hooks/useCoreState';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';
import { fetchCityJsonSeqViewport } from '../../src/lib/cityjsonseq-catalog';
import type { CityJsonDocument } from '../../src/types';

vi.mock('../../src/lib/cityjsonseq-catalog', async original => ({
  ...await original<typeof import('../../src/lib/cityjsonseq-catalog')>(),
  fetchCityJsonSeqViewport: vi.fn(),
  projectWgs84BboxToCrs: (bbox: number[]) => bbox,
}));

describe('catalog document isolation', () => {
  it('cannot reconnect or mutate a shared working area when an old viewport arrives', async () => {
    let finish!: (value: Awaited<ReturnType<typeof fetchCityJsonSeqViewport>>) => void;
    vi.mocked(fetchCityJsonSeqViewport).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => {
      const core = useCoreState(), undo = useUndoRedo(core);
      return { core, catalog: useCatalog(core, undo) };
    });
    const doc: CityJsonDocument = { type: 'CityJSON', version: '2.0', vertices: [], CityObjects: {} };
    act(() => {
      result.current.core.setCityjson(doc);
      result.current.core.setFileName('Shared area');
      result.current.catalog.setCatalogConnection({ baseUrl: 'https://example.com/catalog', crs: 'EPSG:25832', loadedTiles: new Map(), readOnly: true });
    });
    let loading!: Promise<void>;
    act(() => { loading = result.current.catalog.loadCatalogViewport([0, 0, 10, 10]); });
    act(() => result.current.catalog.setCatalogConnection(null));
    await act(async () => {
      finish({ doc: { ...doc, CityObjects: { distant: { type: 'Road' } } }, tiles: [], intersectingTileIds: [], features: 1 } as unknown as Awaited<ReturnType<typeof fetchCityJsonSeqViewport>>);
      await loading;
    });
    expect(result.current.catalog.catalogConnection).toBeNull();
    expect(result.current.core.fileName).toBe('Shared area');
    expect(result.current.core.cityjson?.CityObjects).toEqual({});
  });
});
