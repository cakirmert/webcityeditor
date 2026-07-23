import { useState, useEffect, useCallback } from 'react';
import type { CityJsonDocument, CatalogConnection } from '../types';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import type { CatalogState } from './useCatalog';
import { checkIntegrity } from '../lib/integrity';
import { saveDocument } from '../lib/storage';
import { detectCrs } from '../lib/projection';
import { parseCityJsonAuto } from '../lib/cityjson';
import { mergeCityJson } from '../lib/merge';
import { compactVertices } from '../lib/compact';
import { exportToGltf } from '../lib/gltf-export';
import {
  DEFAULT_HAMBURG_CATALOG_URL,
  normalizeCatalogBaseUrl,
  type CityJsonSeqViewportLoad,
} from '../lib/cityjsonseq-catalog';
import {
  prepareValidatedCityJsonExport,
  validateExportGeometry,
} from '../lib/export-validation';
import proj4 from 'proj4';

export function useImportExport(
  coreState: CoreState,
  undoRedo: UndoRedoState,
  catalog: CatalogState
) {
  const {
    cityjson,
    setCityjson,
    fileName,
    setFileName,
    selection,
    setSelection,
    dirtyIds,
    setDirtyIds,
    reloadToken,
    setReloadToken,
    setSaveStatus,
    setFilter,
    primitiveValidation,
    setPrimitiveValidation,
    originals,
  } = coreState;

  const { pushUndo, undoRef, setUndoVersion } = undoRedo;
  const { setCatalogConnection, setCatalogStatus, mapBboxRef } = catalog;

  const [loadModalOpen, setLoadModalOpen] = useState(true);
  const [seqRawText, setSeqRawText] = useState<string | null>(null);
  const [inputIntegrity, setInputIntegrity] = useState<ReturnType<typeof checkIntegrity> | null>(null);

  const handleLoaded = useCallback(
    (
      doc: CityJsonDocument,
      name: string,
      rawText: string | null = null,
      options: { skipIntegrity?: boolean } = {}
    ) => {
      setCityjson(doc);
      setFileName(name);
      setSeqRawText(rawText);
      setCatalogConnection(null);
      setCatalogStatus({ kind: 'idle' });
      setSelection(null);
      setDirtyIds(new Set());
      setFilter({});
      undoRef.current.clear();
      setUndoVersion((v) => v + 1);
      originals.clear();
      setInputIntegrity(options.skipIntegrity ? null : checkIntegrity(doc));
      setPrimitiveValidation({
        kind: 'unchecked',
        message: 'Loaded input has not been checked for ISO 19107 primitive validity in this session.',
      });
      setLoadModalOpen(false);
    },
    [setCityjson, setFileName, setCatalogConnection, setCatalogStatus, setSelection, setDirtyIds, setFilter, undoRef, setUndoVersion, originals, setPrimitiveValidation]
  );

  const handleCatalogLoaded = useCallback(
    (
      loaded: CityJsonSeqViewportLoad,
      catalogUrl: string,
      options: { loadMode?: CatalogConnection['loadMode'] } = {}
    ) => {
      if (!loaded.doc) return;
      const tileCount = loaded.tiles.length;
      handleLoaded(loaded.doc, `Hamburg CityJSONSeq catalog (${tileCount} tiles)`, null, {
        skipIntegrity: options.loadMode === 'all',
      });
      const connection: CatalogConnection = {
        baseUrl: normalizeCatalogBaseUrl(catalogUrl).toString(),
        crs: loaded.crs,
        loadedTiles: new Map(loaded.tiles.map((tile) => [tile.catalog.id, tile])),
        loadMode: options.loadMode ?? 'viewport',
      };
      setCatalogConnection(connection);
      setCatalogStatus({
        kind: 'ok',
        message:
          options.loadMode === 'all'
            ? `${tileCount} strict CityJSONSeq tile${tileCount === 1 ? '' : 's'} loaded from the full catalog`
            : `${tileCount} strict CityJSONSeq tile${tileCount === 1 ? '' : 's'} loaded`,
      });
      setPrimitiveValidation({
        kind: 'valid',
        message: 'Loaded strict Hamburg catalog tiles passed the prepared val3dity audit.',
      });
    },
    [handleLoaded, setCatalogConnection, setCatalogStatus, setPrimitiveValidation]
  );

  const handleSaveLocal = useCallback(async () => {
    if (!cityjson || !fileName) return;
    setSaveStatus('saving');
    try {
      await saveDocument(fileName, cityjson);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('Local save failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }, [cityjson, fileName, setSaveStatus]);

  const runExternalGeometryValidation = useCallback(async (text: string) => {
    setPrimitiveValidation({
      kind: 'checking',
      message: 'Checking exported CityJSON primitives with the local val3dity service...',
    });
    try {
      const result = await validateExportGeometry(
        DEFAULT_HAMBURG_CATALOG_URL,
        text
      );
      setPrimitiveValidation({
        kind: result.ok ? 'valid' : 'invalid',
        message: result.message,
      });
      return result.ok;
    } catch (error) {
      setPrimitiveValidation({
        kind: 'unavailable',
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [setPrimitiveValidation]);

  const handleValidateGeometry = useCallback(async () => {
    if (!cityjson) return;
    const prepared = prepareValidatedCityJsonExport(cityjson);
    if (!prepared.ok) {
      alert(prepared.error);
      return;
    }
    const valid = await runExternalGeometryValidation(prepared.text);
    if (valid === true) {
      alert('The current CityJSON passed browser structural validation and local val3dity.');
    } else if (valid === false) {
      alert('The current CityJSON failed local val3dity. See the 3D validation status for details.');
    } else {
      alert('The local val3dity service is unavailable. Start the Hamburg catalog server to run the 3D check.');
    }
  }, [cityjson, runExternalGeometryValidation]);

  const handleExport = useCallback(async () => {
    if (!cityjson) return;
    const prepared = prepareValidatedCityJsonExport(cityjson);
    if (!prepared.ok) {
      alert(`${prepared.error}\n\nExport stopped so an invalid CityJSON file is not downloaded.`);
      return;
    }
    const geometryValid = await runExternalGeometryValidation(prepared.text);
    if (geometryValid === false) {
      alert('Export stopped because val3dity rejected the exact CityJSON bytes prepared for download.');
      return;
    }
    if (
      geometryValid === null &&
      !window.confirm(
        'Browser structural validation passed, but the local val3dity service is unavailable. ' +
          'Export with 3D primitive validity unchecked?'
      )
    ) {
      return;
    }
    const text = prepared.text;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = fileName.replace(/\.city\.json$|\.json$/i, '') || 'export';
    a.download = `${base}.modified.city.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [cityjson, fileName, runExternalGeometryValidation]);

  const handleExportGltf = useCallback(() => {
    if (!cityjson) return;
    try {
      const glb = exportToGltf(cityjson);
      const blob = new Blob([glb.slice().buffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base =
        fileName.replace(/\.city\.json$|\.json$|\.jsonl$|\.city\.jsonl$/i, '') || 'export';
      a.download = `${base}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [cityjson, fileName]);

  const handleMergeFile = useCallback(() => {
    if (!cityjson) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.city.json,.jsonl,.city.jsonl';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseCityJsonAuto(text);
        if (!parsed.ok) {
          alert(`Could not parse "${file.name}": ${parsed.error}`);
          return;
        }
        pushUndo(`Merge ${file.name}`);
        const r = mergeCityJson(cityjson, parsed.doc);
        if (!r.ok) {
          undoRef.current.undo({
            doc: cityjson,
            dirtyIds: new Set(dirtyIds),
            selectionId: selection?.objectId ?? null,
          });
          setUndoVersion((v) => v + 1);
          alert(`Merge failed: ${r.reason}`);
          return;
        }
        setReloadToken((t) => t + 1);
        setPrimitiveValidation({
          kind: 'unchecked',
          message: 'Merged geometry has not been checked with val3dity yet.',
        });
        const lines = [
          `Merged "${file.name}" successfully.`,
          `Added ${r.added} CityObject${r.added === 1 ? '' : 's'}.`,
        ];
        if (r.renamed && r.renamed > 0) {
          lines.push(
            `${r.renamed} id conflict${r.renamed === 1 ? '' : 's'} resolved with __mergeN suffix.`
          );
        }
        alert(lines.join('\n'));
      } catch (e) {
        alert(`Could not parse merged file: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    document.body.appendChild(input);
    input.click();
  }, [cityjson, pushUndo, undoRef, dirtyIds, selection, setReloadToken, setPrimitiveValidation, setUndoVersion]);

  const handleCompactVertices = useCallback(() => {
    if (!cityjson) return;
    pushUndo('Compact orphaned vertices');
    const r = compactVertices(cityjson);
    if (r.changed) {
      setReloadToken((t) => t + 1);
      setSaveStatus('idle');
    } else {
      undoRef.current.undo({
        doc: cityjson,
        dirtyIds: new Set(dirtyIds),
        selectionId: selection?.objectId ?? null,
      });
      setUndoVersion((v) => v + 1);
    }
    alert(
      r.changed
        ? `Reclaimed ${r.reclaimed.toLocaleString()} orphaned vertices. ` +
            `Doc now has ${r.after.toLocaleString()} vertices (was ${r.before.toLocaleString()}).`
        : 'No orphaned vertices to reclaim.'
    );
  }, [cityjson, pushUndo, undoRef, dirtyIds, selection, setReloadToken, setSaveStatus, setUndoVersion]);

  const [integrity, setIntegrity] = useState<ReturnType<typeof checkIntegrity> | null>(null);
  useEffect(() => {
    if (!cityjson) {
      setIntegrity(null);
      return;
    }
    // Let the mutation render before scanning a city-scale document. This
    // keeps delete/save controls responsive and coalesces quick consecutive
    // edits into one current-state integrity pass.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const report = checkIntegrity(cityjson);
      if (!cancelled) setIntegrity(report);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cityjson, reloadToken]);

  const handleShowIntegrity = useCallback(() => {
    if (!integrity) return;
    if (integrity.issues.length === 0) {
      alert(
        `Current browser structure check: valid.\n` +
          `Input at load: ${
            inputIntegrity?.ok
              ? 'valid'
              : `${inputIntegrity?.counts.error ?? 0} error(s) detected`
          }.\n\n` +
          `ISO 19107 primitive status: ${primitiveValidation.message}`
      );
      return;
    }
    const lines: string[] = [];
    lines.push(
      `Integrity: ${integrity.counts.error} error(s), ${integrity.counts.warning} warning(s), ${integrity.counts.info} info`
    );
    lines.push(
      `Scanned ${integrity.summary.cityObjects} CityObjects, ${integrity.summary.vertices} vertices (${integrity.summary.referencedVertices} referenced).`
    );
    lines.push(
      `Input at load: ${
        inputIntegrity?.ok ? 'valid' : `${inputIntegrity?.counts.error ?? 0} error(s) detected`
      }.`
    );
    lines.push(`ISO 19107 primitive status: ${primitiveValidation.message}`);
    lines.push('');
    const max = 12;
    for (const issue of integrity.issues.slice(0, max)) {
      const tag = issue.severity === 'error' ? 'ERROR' : issue.severity === 'warning' ? 'WARNING' : 'INFO';
      lines.push(`${tag} [${issue.code}] ${issue.message}`);
    }
    if (integrity.issues.length > max) {
      lines.push(`… + ${integrity.issues.length - max} more`);
    }
    alert(lines.join('\n'));
  }, [integrity, inputIntegrity, primitiveValidation.message]);

  const handleReloadViewport = useCallback(() => {
    if (!seqRawText || !cityjson) return;
    const bboxWgs = mapBboxRef.current;
    if (!bboxWgs) {
      alert('Map viewport not ready yet. Move the map once, then try again.');
      return;
    }
    const crs = detectCrs(cityjson);
    if (!crs.supported) {
      alert(`Can't reload: CRS ${crs.code} isn't supported by proj4.`);
      return;
    }
    const [w, s, e, n] = bboxWgs;
    const corners: [number, number][] = [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
    ];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of corners) {
      const p = proj4('EPSG:4326', crs.code, c) as [number, number];
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    const result = parseCityJsonAuto(seqRawText, undefined, [minX, minY, maxX, maxY]);
    if (!result.ok) {
      alert(`Reload failed: ${result.error}`);
      return;
    }
    pushUndo('Filter to viewport');
    setCityjson(result.doc);
    setDirtyIds(new Set());
    setSelection(null);
    setReloadToken((t) => t + 1);
  }, [seqRawText, cityjson, mapBboxRef, pushUndo, setCityjson, setDirtyIds, setSelection, setReloadToken]);

  return {
    loadModalOpen,
    setLoadModalOpen,
    seqRawText,
    setSeqRawText,
    inputIntegrity,
    integrity,
    handleLoaded,
    handleCatalogLoaded,
    handleSaveLocal,
    handleValidateGeometry,
    handleExport,
    handleExportGltf,
    handleMergeFile,
    handleCompactVertices,
    handleShowIntegrity,
    handleReloadViewport,
  };
}

export type ImportExportState = ReturnType<typeof useImportExport>;
