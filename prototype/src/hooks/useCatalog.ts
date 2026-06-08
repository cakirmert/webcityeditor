import { useState, useRef, useEffect, useCallback } from 'react';
import type { CatalogConnection } from '../types';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import {
  DEFAULT_HAMBURG_CATALOG_URL,
  fetchCityJsonSeqViewport,
  normalizeCatalogBaseUrl,
  projectWgs84BboxToCrs,
  type Bbox,
} from '../lib/cityjsonseq-catalog';
import {
  CatalogWritebackError,
  evictCleanCityJsonSeqTiles,
  persistDirtyCityJsonSeqTiles,
} from '../lib/cityjsonseq-writeback';
import { mergeCityJson } from '../lib/merge';

export function useCatalog(coreState: CoreState, undoRedo: UndoRedoState) {
  const {
    cityjson,
    setCityjson,
    cityjsonRef,
    dirtyIdsRef,
    setDirtyIds,
    setFileName,
    setSelection,
    setReloadToken,
    setPrimitiveValidation,
  } = coreState;

  const { undoRef, setUndoVersion } = undoRedo;

  const [catalogConnection, setCatalogConnection] = useState<CatalogConnection | null>(null);
  const catalogConnectionRef = useRef<CatalogConnection | null>(null);
  const catalogLoadingRef = useRef(false);
  const catalogViewportTimerRef = useRef<number | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<{
    kind: 'idle' | 'loading' | 'ok' | 'error';
    message?: string;
  }>({ kind: 'idle' });

  // Map viewport bbox ref
  const mapBboxRef = useRef<[number, number, number, number] | null>(null);

  const loadCatalogViewport = useCallback(async (bboxWgs84: Bbox) => {
    const source = catalogConnectionRef.current;
    const doc = cityjsonRef.current;
    if (!source || !doc || catalogLoadingRef.current) return;

    catalogLoadingRef.current = true;
    setCatalogStatus({
      kind: 'loading',
      message: `${source.loadedTiles.size} tiles loaded; checking viewport...`,
    });
    try {
      const bbox = projectWgs84BboxToCrs(bboxWgs84, source.crs);
      const loaded = await fetchCityJsonSeqViewport(
        source.baseUrl,
        bbox,
        new Set(source.loadedTiles.keys())
      );
      const loadedTiles = new Map(source.loadedTiles);
      if (loaded.doc) {
        const merged = mergeCityJson(doc, loaded.doc);
        if (!merged.ok) throw new Error(merged.reason);
        for (const tile of loaded.tiles) loadedTiles.set(tile.catalog.id, tile);
      }
      const eviction = evictCleanCityJsonSeqTiles(
        doc,
        loadedTiles,
        new Set(loaded.intersectingTileIds),
        dirtyIdsRef.current
      );
      const next = { ...source, loadedTiles: eviction.tiles };
      catalogConnectionRef.current = next;
      setCatalogConnection(next);
      setFileName(`Hamburg CityJSONSeq catalog (${eviction.tiles.size} tiles)`);
      if (loaded.doc || eviction.evictedTileIds.length > 0) {
        setSelection((current) =>
          current && !doc.CityObjects[current.objectId] ? null : current
        );
        if (eviction.evictedTileIds.length > 0) {
          undoRef.current.clear();
          setUndoVersion((version) => version + 1);
        }
        setReloadToken((token) => token + 1);
      }
      setCatalogStatus({
        kind: 'ok',
        message:
          `${eviction.tiles.size} strict sequence tiles loaded` +
          (loaded.features > 0 ? `; added ${loaded.features.toLocaleString()} features` : '') +
          (eviction.evictedTileIds.length > 0
            ? `; unloaded ${eviction.evictedTileIds.length} clean off-screen tiles`
            : ''),
      });
    } catch (error) {
      if (error instanceof CatalogWritebackError && error.result.persistedTileIds.length > 0) {
        const next = { ...source, loadedTiles: error.result.tiles };
        catalogConnectionRef.current = next;
        setCatalogConnection(next);
      }
      setCatalogStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      catalogLoadingRef.current = false;
    }
  }, [cityjsonRef, dirtyIdsRef, setFileName, setSelection, setReloadToken, undoRef, setUndoVersion]);

  const handlePersistCatalog = useCallback(async () => {
    const source = catalogConnectionRef.current;
    const doc = cityjsonRef.current;
    if (!source || !doc || catalogLoadingRef.current || dirtyIdsRef.current.size === 0) return;
    catalogLoadingRef.current = true;
    setCatalogStatus({
      kind: 'loading',
      message: `Validating and saving ${dirtyIdsRef.current.size} changed objects...`,
    });
    let saved = false;
    try {
      const result = await persistDirtyCityJsonSeqTiles(
        source.baseUrl,
        doc,
        source.loadedTiles,
        dirtyIdsRef.current
      );
      const next = { ...source, loadedTiles: result.tiles };
      catalogConnectionRef.current = next;
      setCatalogConnection(next);
      const clean = new Set<string>();
      dirtyIdsRef.current = clean;
      setDirtyIds(clean);
      undoRef.current.clear();
      setUndoVersion((version) => version + 1);
      setCatalogStatus({
        kind: 'ok',
        message: `${result.persistedTileIds.length} sequence tile(s) validated and saved`,
      });
      setPrimitiveValidation({
        kind: 'valid',
        message: `${result.persistedTileIds.length} changed sequence tile(s) passed structural validation and val3dity --ignore204 during Save seq.`,
      });
      saved = true;
    } catch (error) {
      if (error instanceof CatalogWritebackError && error.result.persistedTileIds.length > 0) {
        const next = { ...source, loadedTiles: error.result.tiles };
        catalogConnectionRef.current = next;
        setCatalogConnection(next);
      }
      setCatalogStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      catalogLoadingRef.current = false;
    }
    const bbox = mapBboxRef.current;
    if (saved && bbox) void loadCatalogViewport(bbox);
  }, [cityjsonRef, dirtyIdsRef, setDirtyIds, undoRef, setUndoVersion, setPrimitiveValidation, loadCatalogViewport]);

  const handleViewportChange = useCallback(
    (bbox: Bbox) => {
      mapBboxRef.current = bbox;
      if (!catalogConnectionRef.current) return;
      if (catalogViewportTimerRef.current !== null) {
        window.clearTimeout(catalogViewportTimerRef.current);
      }
      catalogViewportTimerRef.current = window.setTimeout(() => {
        catalogViewportTimerRef.current = null;
        void loadCatalogViewport(bbox);
      }, 450);
    },
    [loadCatalogViewport]
  );

  useEffect(
    () => () => {
      if (catalogViewportTimerRef.current !== null) {
        window.clearTimeout(catalogViewportTimerRef.current);
      }
    },
    []
  );

  return {
    catalogConnection,
    setCatalogConnection,
    catalogConnectionRef,
    catalogStatus,
    setCatalogStatus,
    mapBboxRef,
    loadCatalogViewport,
    handlePersistCatalog,
    handleViewportChange,
  };
}

export type CatalogState = ReturnType<typeof useCatalog>;
