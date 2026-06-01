import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import FileLoader from './components/FileLoader';
import MapView from './components/MapView';
import Viewer from './components/Viewer';
import AttributePanel from './components/AttributePanel';
import BuildingCreator, { type NewBuildingForm } from './components/BuildingCreator';
// `NewBuildingForm` shape is re-used by App to carry the live-updating dialog state.
import { filterToBuilding } from './lib/footprints';
import { saveDocument } from './lib/storage';
import { detectCrs } from './lib/projection';
import {
  splitBuildingByFloor,
  splitBuildingByFloorHeights,
  splitBuildingByFloorPlans,
  splitBuildingBySide,
  MIN_STOREY_HEIGHT,
  type FloorPlanDivision,
  type SplitAxis,
} from './lib/subdivision';
import { regenerateBuilding } from './lib/regenerate';
import { extractFootprints } from './lib/footprints';
import { exportToGltf } from './lib/gltf-export';
import { checkIntegrity } from './lib/integrity';
import { compactVertices } from './lib/compact';
import { matchingIds, isFilterEmpty, type BuildingFilter } from './lib/filter';
import { mergeCityJson } from './lib/merge';
import { parseCityJsonAuto } from './lib/cityjson';
import {
  DEFAULT_HAMBURG_CATALOG_URL,
  fetchCityJsonSeqViewport,
  normalizeCatalogBaseUrl,
  projectWgs84BboxToCrs,
  type Bbox,
  type CityJsonSeqLoadedTile,
  type CityJsonSeqViewportLoad,
} from './lib/cityjsonseq-catalog';
import {
  CatalogWritebackError,
  evictCleanCityJsonSeqTiles,
  persistDirtyCityJsonSeqTiles,
} from './lib/cityjsonseq-writeback';
import {
  commitBuildingTransformFromEditor,
  createBuildingFromEditor,
  runStructurallyGuardedMutation,
} from './lib/editor-actions';
import {
  prepareValidatedCityJsonExport,
  validateExportGeometry,
} from './lib/export-validation';
import proj4 from 'proj4';
import type { IfcImportResult } from './lib/ifc-import';
import FilterBar from './components/FilterBar';
import BuildingListPanel from './components/BuildingListPanel';
import { applyFilter } from './lib/filter';
import { UndoStore } from './lib/undo';
import {
  computeTransformedFootprint,
  type PendingTransform,
} from './lib/transform-preview';
import { buildPreviewMesh } from './lib/preview-mesh';
import { cloneBuildings } from './lib/clipboard';
import { deleteBuildings } from './lib/delete';
import { extractOpenings, moveOpening, type OpeningInfo } from './lib/opening-edit';
import { parametriseBuilding } from './lib/parametrise';
import {
  fetchHamburgPlanningZones,
  findZoneForPoint,
  isBboxNearHamburg,
  validateBuildingType,
  type ParcelZone,
} from './lib/zoning';
import type { AttributeValue, CityJsonDocument, SelectionInfo } from './types';

interface CatalogConnection {
  baseUrl: string;
  crs: string;
  loadedTiles: Map<string, CityJsonSeqLoadedTile>;
}

type PrimitiveValidationState = {
  kind: 'unchecked' | 'checking' | 'valid' | 'invalid' | 'unavailable';
  message: string;
};

export default function App() {
  const [cityjson, setCityjson] = useState<CityJsonDocument | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [drawMode, setDrawMode] = useState<'none' | 'polygon'>('none');
  const [pendingFootprint, setPendingFootprint] = useState<[number, number][] | null>(null);
  const [pendingForm, setPendingForm] = useState<NewBuildingForm | null>(null);
  const [sidePanelFullscreen, setSidePanelFullscreen] = useState(false);
  /** Live-preview state for translating/rotating a building before committing. */
  const [pendingTransform, setPendingTransform] = useState<PendingTransform | null>(null);
  /** Live-preview state for the visual division editor — set when the user is
   *  in custom-heights mode for the selected building. The 3D viewer reads
   *  this to draw horizontal split-line rings at each cumulative height. */
  const [splitPreviewHeights, setSplitPreviewHeights] = useState<number[] | null>(null);
  /** Optional per-floor footprint plans shown as vertical dividers in Viewer. */
  const [splitPreviewFloorPlans, setSplitPreviewFloorPlans] = useState<
    FloorPlanDivision[] | null
  >(null);
  /** Live-edit state for footprint editing. The map shows the building's
   *  outline as draggable Terra Draw polygon; pending updates flow through
   *  `pendingRing` until the user clicks Save (regenerate) or Cancel. */
  const [footprintEdit, setFootprintEdit] = useState<{
    buildingId: string;
    initialFootprint: [number, number][];
    pendingRing: [number, number][] | null;
  } | null>(null);
  /** Building filter — text + roof type + year/height ranges. Pure UI state;
   *  doesn't mutate the doc, just dims non-matching footprints on the map. */
  const [filter, setFilter] = useState<BuildingFilter>({});
  /** Persistent undo/redo store. Lives in a ref so it survives re-renders
   *  without triggering them; we mirror canUndo/canRedo into state for the
   *  toolbar buttons. */
  const undoRef = useRef<UndoStore>(new UndoStore());
  const [undoVersion, setUndoVersion] = useState(0); // bumped to re-render toolbar
  /** Building list sidebar visibility. Off by default to keep first-time
   *  load minimal; toggled via the Toolbar's "☰ List" button. */
  const [showList, setShowList] = useState(false);
  /** IFC-import "awaiting placement click" state. When set, the map shows a
   *  banner + crosshair cursor; the next click drops the IFC's full
   *  triangulated mesh at that lng/lat as an LoD 3 MultiSurface. */
  const [ifcPending, setIfcPending] = useState<{
    parsed: IfcImportResult;
    fileName: string;
  } | null>(null);
  /** True while the WASM is loading and parsing — disables the toolbar
   *  button so a slow IFC parse doesn't get re-triggered. */
  const [ifcParsing, setIfcParsing] = useState(false);

  // ── Multi-selection + Copy/Paste ──────────────────────────────────────────
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());
  const [clipboardIds, setClipboardIds] = useState<Set<string> | null>(null);

  // ── Planning layer ───────────────────────────────────────────────────────
  const [zones, setZones] = useState<ParcelZone[]>([]);
  const [zoningEnabled, setZoningEnabled] = useState(false);
  const [zoningLoading, setZoningLoading] = useState(false);

  // ── Raw CityJSONSeq cache for viewport re-parse ───────────────────────────
  // Held only for CityJSONSeq inputs. The "Filter to viewport" toolbar action
  // re-parses this with parseCityJsonSeq(text, undefined, bboxInCrs) to drop
  // features outside the current map view — useful on city-scale jsonl files.
  const [seqRawText, setSeqRawText] = useState<string | null>(null);
  const mapBboxRef = useRef<[number, number, number, number] | null>(null);
  const cityjsonRef = useRef<CityJsonDocument | null>(null);
  const [catalogConnection, setCatalogConnection] = useState<CatalogConnection | null>(null);
  const catalogConnectionRef = useRef<CatalogConnection | null>(null);
  const catalogLoadingRef = useRef(false);
  const catalogViewportTimerRef = useRef<number | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<{
    kind: 'idle' | 'loading' | 'ok' | 'error';
    message?: string;
  }>({ kind: 'idle' });
  const [inputIntegrity, setInputIntegrity] = useState<ReturnType<typeof checkIntegrity> | null>(
    null
  );
  const [primitiveValidation, setPrimitiveValidation] = useState<PrimitiveValidationState>({
    kind: 'unchecked',
    message: '3D primitive validity has not been checked yet.',
  });

  const markGeometryChanged = useCallback((message = 'Geometry changed; run Check 3D or Save seq.') => {
    setPrimitiveValidation({ kind: 'unchecked', message });
  }, []);

  useEffect(() => {
    cityjsonRef.current = cityjson;
  }, [cityjson]);

  useEffect(() => {
    dirtyIdsRef.current = dirtyIds;
  }, [dirtyIds]);

  // Snapshot of original attributes per-building, for revert.
  const [originals] = useState<Map<string, Record<string, AttributeValue>>>(new Map());

  const handleLoaded = useCallback(
    (doc: CityJsonDocument, name: string, rawText: string | null = null) => {
      setCityjson(doc);
      cityjsonRef.current = doc;
      setFileName(name);
      setSeqRawText(rawText);
      setCatalogConnection(null);
      catalogConnectionRef.current = null;
      setCatalogStatus({ kind: 'idle' });
      setSelection(null);
      const clean = new Set<string>();
      dirtyIdsRef.current = clean;
      setDirtyIds(clean);
      setFilter({}); // reset filters when loading a new doc
      setZones([]);
      setZoningEnabled(false);
      setZoningLoading(false);
      mapBboxRef.current = null;
      undoRef.current.clear();
      setUndoVersion((v) => v + 1);
      originals.clear();
      setInputIntegrity(checkIntegrity(doc));
      setPrimitiveValidation({
        kind: 'unchecked',
        message: 'Loaded input has not been checked for ISO 19107 primitive validity in this session.',
      });
    },
    [originals]
  );

  const handleCatalogLoaded = useCallback(
    (loaded: CityJsonSeqViewportLoad, catalogUrl: string) => {
      if (!loaded.doc) return;
      handleLoaded(loaded.doc, `Hamburg CityJSONSeq catalog (${loaded.tileIds.length} tiles)`);
      const connection = {
        baseUrl: normalizeCatalogBaseUrl(catalogUrl).toString(),
        crs: loaded.crs,
        loadedTiles: new Map(loaded.tiles.map((tile) => [tile.catalog.id, tile])),
      };
      catalogConnectionRef.current = connection;
      setCatalogConnection(connection);
      setCatalogStatus({
        kind: 'ok',
        message: `${loaded.tileIds.length} strict CityJSONSeq tiles loaded`,
      });
      setPrimitiveValidation({
        kind: 'valid',
        message: 'Loaded strict Hamburg catalog tiles passed the prepared val3dity audit.',
      });
    },
    [handleLoaded]
  );

  /**
   * Capture an undo snapshot of the current doc + selection + dirty state.
   * Call this BEFORE applying a mutation so undo restores the pre-mutation
   * state. Bumps undoVersion to refresh the toolbar's enabled/disabled UI.
   */
  const pushUndo = useCallback(
    (label: string) => {
      if (!cityjson) return;
      undoRef.current.push({
        doc: cityjson,
        label,
        dirtyIds: new Set(dirtyIds),
        selectionId: selection?.objectId ?? null,
      });
      setUndoVersion((v) => v + 1);
    },
    [cityjson, dirtyIds, selection]
  );

  const handleUndo = useCallback(() => {
    if (!cityjson) return;
    const popped = undoRef.current.undo({
      doc: cityjson,
      dirtyIds: new Set(dirtyIds),
      selectionId: selection?.objectId ?? null,
    });
    if (!popped) return;
    setCityjson(popped.doc);
    setDirtyIds(new Set(popped.dirtyIds ?? []));
    setSelection(popped.selectionId ? { objectId: popped.selectionId } : null);
    setReloadToken((t) => t + 1);
    setUndoVersion((v) => v + 1);
    markGeometryChanged('Undo changed the working geometry; run Check 3D before export.');
  }, [cityjson, dirtyIds, selection, markGeometryChanged]);

  const handleRedo = useCallback(() => {
    if (!cityjson) return;
    const popped = undoRef.current.redo({
      doc: cityjson,
      dirtyIds: new Set(dirtyIds),
      selectionId: selection?.objectId ?? null,
    });
    if (!popped) return;
    setCityjson(popped.doc);
    setDirtyIds(new Set(popped.dirtyIds ?? []));
    setSelection(popped.selectionId ? { objectId: popped.selectionId } : null);
    setReloadToken((t) => t + 1);
    setUndoVersion((v) => v + 1);
    markGeometryChanged('Redo changed the working geometry; run Check 3D before export.');
  }, [cityjson, dirtyIds, selection, markGeometryChanged]);

  // ── Opening move ─────────────────────────────────────────────────────────
  const handleMoveOpening = useCallback(
    (buildingId: string, opening: import('./lib/opening-edit').OpeningInfo, dx: number, dy: number, dz: number) => {
      if (!cityjson) return;
      pushUndo(`Move ${opening.type} on ${buildingId}`);
      runStructurallyGuardedMutation(cityjson, `Moving ${opening.type} on ${buildingId}`, () =>
        moveOpening(cityjson, buildingId, opening, dx, dy, dz)
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(buildingId);
        return next;
      });
      setReloadToken((t) => t + 1);
      markGeometryChanged();
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  // ── Reshape (regenerate parametric building with new roof/heights) ──────
  const handleReshapeBuilding = useCallback(
    (
      id: string,
      overrides: {
        roofType?: 'flat' | 'pyramid' | 'gable' | 'hip';
        eaveHeight?: number;
        ridgeHeight?: number;
        eaveOverhang?: number;
        rakeOverhang?: number;
        addWindows?: boolean;
        addDoor?: boolean;
      }
    ) => {
      if (!cityjson) return;
      const fp = extractFootprints(cityjson).find((f) => f.id === id);
      if (!fp) {
        alert(`Cannot reshape ${id}: no extractable footprint.`);
        return;
      }
      pushUndo(`Reshape ${id}`);
      const { value: r } = runStructurallyGuardedMutation(cityjson, `Reshaping ${id}`, () =>
        regenerateBuilding(cityjson, id, fp.polygon, overrides)
      );
      if (!r.ok) {
        alert(`Reshape failed: ${r.reason}`);
        return;
      }
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setReloadToken((t) => t + 1);
      markGeometryChanged();
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  // ── Make-editable (parametrise imported building) ────────────────────────
  const handleMakeEditable = useCallback(
    (buildingId: string) => {
      if (!cityjson) return;
      const ok = window.confirm(
        'Replace this imported building with a parametric regeneration inferred ' +
          'from its attributes?\n\n' +
          'Original geometry detail will be lost. After conversion you can edit ' +
          'its footprint, roof type, openings, and overhangs.'
      );
      if (!ok) return;
      pushUndo(`Make ${buildingId} editable`);
      const { value: r } = runStructurallyGuardedMutation(
        cityjson,
        `Making ${buildingId} editable`,
        () => parametriseBuilding(cityjson, buildingId)
      );
      if (!r.ok) {
        alert(`Couldn't make this building editable: ${r.reason}`);
        return;
      }
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(buildingId);
        return next;
      });
      setReloadToken((t) => t + 1);
      markGeometryChanged();
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  // ── Copy / Paste ─────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const ids = new Set(multiSelection);
    if (selection) ids.add(selection.objectId);
    if (ids.size === 0) return;
    setClipboardIds(ids);
  }, [selection, multiSelection]);

  const handlePaste = useCallback(() => {
    if (!cityjson || !clipboardIds || clipboardIds.size === 0) return;
    pushUndo('Paste buildings');
    const { value: { clonedIds } } = runStructurallyGuardedMutation(
      cityjson,
      'Pasting buildings',
      () => cloneBuildings(cityjson, clipboardIds, 5, 5)
    );
    setDirtyIds((prev) => {
      const next = new Set(prev);
      for (const id of clonedIds) next.add(id);
      return next;
    });
    setReloadToken((t) => t + 1);
    if (clonedIds.length === 1) setSelection({ objectId: clonedIds[0] });
    setMultiSelection(new Set(clonedIds));
    markGeometryChanged();
  }, [cityjson, clipboardIds, pushUndo, markGeometryChanged]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!cityjson) return;
    const ids = new Set(multiSelection);
    if (selection) ids.add(selection.objectId);
    if (ids.size === 0) return;
    const label =
      ids.size === 1 ? `Delete ${[...ids][0]}` : `Delete ${ids.size} buildings`;
    pushUndo(label);
    const { value: { deletedIds } } = runStructurallyGuardedMutation(
      cityjson,
      label,
      () => deleteBuildings(cityjson, ids)
    );
    setDirtyIds((prev) => {
      const next = new Set(prev);
      // Keep tombstones dirty so CityJSONSeq write-back can remove deleted
      // source features instead of forgetting that they ever existed.
      for (const id of deletedIds) next.add(id);
      return next;
    });
    setSelection(null);
    setMultiSelection(new Set());
    setReloadToken((t) => t + 1);
    markGeometryChanged();
  }, [cityjson, selection, multiSelection, pushUndo, markGeometryChanged]);

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Shift+Z / Cmd+Shift+Z
  // for redo. Ctrl+C / Ctrl+V for copy/paste. Delete / Backspace removes the
  // selected building(s). Skip when focus is in an input/textarea so editing
  // fields can still use their native shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleCopy();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, handleCopy, handlePaste, handleDelete]);

  const handleSelect = useCallback(
    (info: SelectionInfo | null) => {
      if (info?.ctrlKey) {
        setMultiSelection((prev) => {
          const next = new Set(prev);
          if (next.has(info.objectId)) next.delete(info.objectId);
          else next.add(info.objectId);
          return next;
        });
        if (!selection) setSelection(info);
        return;
      }
      setSelection(info);
      if (!info?.ctrlKey) setMultiSelection(new Set());
      if (info && cityjson && !originals.has(info.objectId)) {
        const obj = cityjson.CityObjects[info.objectId];
        originals.set(info.objectId, { ...(obj?.attributes ?? {}) });
      }
    },
    [cityjson, originals, selection]
  );

  const handleAttributeChange = useCallback(
    (id: string, key: string, value: AttributeValue) => {
      if (!cityjson) return;
      const obj = cityjson.CityObjects[id];
      if (!obj) return;
      // Only push undo when the value actually changes; otherwise typing in
      // an input that hasn't moved would burn snapshots.
      const prev = obj.attributes?.[key];
      if (prev === value) return;
      pushUndo(`Edit ${id}.${key}`);
      if (!obj.attributes) obj.attributes = {};
      obj.attributes[key] = value;
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [cityjson, pushUndo]
  );

  const handleRevert = useCallback(
    (id: string) => {
      if (!cityjson) return;
      const snap = originals.get(id);
      if (!snap) return;
      cityjson.CityObjects[id].attributes = { ...snap };
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelection((s) => (s ? { ...s } : s));
    },
    [cityjson, originals]
  );

  const handleReloadView = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  const handleSplitByFloor = useCallback(
    (id: string, floorCount: number) => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} into ${floorCount} floors`);
        const { value: { partIds } } = runStructurallyGuardedMutation(
          cityjson,
          `Splitting ${id} into floors`,
          () => splitBuildingByFloor(cityjson, id, floorCount)
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  const handleSplitByFloorHeights = useCallback(
    (id: string, heights: number[]) => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} with custom heights`);
        const { value: { partIds } } = runStructurallyGuardedMutation(
          cityjson,
          `Splitting ${id} with custom floor heights`,
          () => splitBuildingByFloorHeights(cityjson, id, heights)
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  const handleSplitByFloorPlans = useCallback(
    (id: string, heights: number[], floorPlans: FloorPlanDivision[]) => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} into floor-plan sections`);
        const { value: { partIds } } = runStructurallyGuardedMutation(
          cityjson,
          `Splitting ${id} into floor-plan sections`,
          () => splitBuildingByFloorPlans(cityjson, id, heights, floorPlans)
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setSplitPreviewFloorPlans(null);
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  const handleSplitBySide = useCallback(
    (id: string, partCount: number, axis: SplitAxis = 'auto') => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} into ${partCount} side parts`);
        const { value: { partIds } } = runStructurallyGuardedMutation(
          cityjson,
          `Splitting ${id} into side parts`,
          () => splitBuildingBySide(cityjson, id, partCount, axis)
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo, markGeometryChanged]
  );

  // Enter "edit position" mode for a building. While active, dX/dY/angle are
  // held in pendingTransform and the map renders a ghost preview. Nothing is
  // written to the CityJSON until the user clicks Save.
  const handleStartTransform = useCallback((id: string) => {
    setPendingTransform({ id, dx: 0, dy: 0, angle: 0 });
  }, []);

  const handleUpdateTransform = useCallback(
    (patch: Partial<Omit<PendingTransform, 'id'>>) => {
      setPendingTransform((cur) => (cur ? { ...cur, ...patch } : cur));
    },
    []
  );

  const handleCancelTransform = useCallback(() => {
    setPendingTransform(null);
  }, []);

  const handleSaveTransform = useCallback(() => {
    if (!cityjson || !pendingTransform) return;
    const { id, dx, dy, angle } = pendingTransform;
    try {
      // Snapshot only when there's actually a change to commit — pure
      // close/cancel shouldn't pollute the undo stack.
      if (angle !== 0 || dx !== 0 || dy !== 0) {
        pushUndo(`Move ${id}`);
      }
      const result = commitBuildingTransformFromEditor(cityjson, pendingTransform);
      if (result.changed) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingTransform(null);
    }
  }, [cityjson, pendingTransform, pushUndo, markGeometryChanged]);

  // ── Footprint editing (drag building polygon corners) ─────────────────────
  const handleStartFootprintEdit = useCallback(
    (id: string) => {
      if (!cityjson) return;
      const fps = extractFootprints(cityjson);
      const fp = fps.find((f) => f.id === id);
      if (!fp) {
        alert(`Could not extract footprint for building ${id}`);
        return;
      }
      // The footprint polygon comes back closed (first === last); strip the
      // closing vertex so MapView can re-close it for Terra Draw.
      const open = fp.polygon.slice();
      const [first, last] = [open[0], open[open.length - 1]];
      if (first[0] === last[0] && first[1] === last[1]) open.pop();
      setFootprintEdit({ buildingId: id, initialFootprint: open, pendingRing: null });
    },
    [cityjson]
  );

  const handleFootprintChange = useCallback((newRing: [number, number][]) => {
    setFootprintEdit((prev) => (prev ? { ...prev, pendingRing: newRing } : prev));
  }, []);

  const handleCancelFootprintEdit = useCallback(() => {
    setFootprintEdit(null);
  }, []);

  const handleSaveFootprintEdit = useCallback(() => {
    if (!cityjson || !footprintEdit) return;
    const ring = footprintEdit.pendingRing ?? footprintEdit.initialFootprint;
    pushUndo(`Edit footprint of ${footprintEdit.buildingId}`);
    const { value: res } = runStructurallyGuardedMutation(
      cityjson,
      `Editing footprint of ${footprintEdit.buildingId}`,
      () => regenerateBuilding(cityjson, footprintEdit.buildingId, ring)
    );
    if (!res.ok) {
      // Roll back the snapshot we just pushed so the user doesn't have to
      // burn it.
      undoRef.current.undo({
        doc: cityjson,
        dirtyIds: new Set(dirtyIds),
        selectionId: selection?.objectId ?? null,
      });
      setUndoVersion((v) => v + 1);
      alert(res.reason ?? 'Could not regenerate building');
      return;
    }
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(footprintEdit.buildingId);
      return next;
    });
    setReloadToken((t) => t + 1);
    setFootprintEdit(null);
    markGeometryChanged();
  }, [cityjson, footprintEdit, pushUndo, dirtyIds, selection, markGeometryChanged]);

  // ── Drag a split-line ring in the 3D viewer ─────────────────────────────
  // The Viewer raycasts the user's mouse onto the ring and reports dZ each
  // mousemove. We translate that into a transfer between heights[ringIndex]
  // (the floor below) and heights[ringIndex+1] (the floor above), clamping
  // both to MIN_STOREY_HEIGHT so the user can't crush a floor flat.
  const handleAdjustSplit = useCallback(
    (ringIndex: number, deltaZ: number) => {
      setSplitPreviewHeights((prev) => {
        if (!prev || ringIndex < 0 || ringIndex >= prev.length - 1) return prev;
        const lower = prev[ringIndex];
        const upper = prev[ringIndex + 1];
        // Clamp to keep BOTH adjacent floors >= MIN_STOREY_HEIGHT.
        const minDelta = MIN_STOREY_HEIGHT - lower;
        const maxDelta = upper - MIN_STOREY_HEIGHT;
        const d = Math.max(minDelta, Math.min(maxDelta, deltaZ));
        if (Math.abs(d) < 1e-4) return prev;
        const next = prev.slice();
        next[ringIndex] = lower + d;
        next[ringIndex + 1] = upper - d;
        return next;
      });
    },
    []
  );

  // ── CityJSONSeq catalog viewport loading ───────────────────────────────
  // Catalog tiles stay independent on the server. Newly encountered sequence
  // features merge into one renderable working set. Clean tiles outside the
  // current map view are compacted away; dirty tiles remain until checkpointed.
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
        setMultiSelection((current) => {
          const surviving = new Set([...current].filter((id) => doc.CityObjects[id]));
          return surviving.size === current.size ? current : surviving;
        });
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
  }, []);

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
        message: `${result.persistedTileIds.length} changed sequence tile(s) passed structural validation and val3dity during Save seq.`,
      });
      saved = true;
    } catch (error) {
      setCatalogStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      catalogLoadingRef.current = false;
    }
    const bbox = mapBboxRef.current;
    if (saved && bbox) void loadCatalogViewport(bbox);
  }, [loadCatalogViewport]);

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

  // ── Viewport-filter re-parse ───────────────────────────────────────────
  // Re-parses the cached CityJSONSeq text with parseCityJsonAuto's bbox
  // filter using the map's current viewport. Re-projects the WGS84 bounds
  // to the data's CRS (taking the AABB of the four reprojected corners so
  // the filter covers any rotation the projection introduces).
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
    setMultiSelection(new Set());
    setReloadToken((t) => t + 1);
  }, [seqRawText, cityjson, pushUndo]);

  // ── Map drag for position transform ─────────────────────────────────────
  const dragBaseRef = useRef<{ dx: number; dy: number } | null>(null);
  const handleDragMove = useCallback(
    (dx: number, dy: number) => {
      if (!pendingTransform) return;
      if (!dragBaseRef.current) {
        dragBaseRef.current = { dx: pendingTransform.dx, dy: pendingTransform.dy };
      }
      setPendingTransform((cur) =>
        cur
          ? { ...cur, dx: dragBaseRef.current!.dx + dx, dy: dragBaseRef.current!.dy + dy }
          : cur
      );
    },
    [pendingTransform]
  );
  useEffect(() => {
    if (!pendingTransform) dragBaseRef.current = null;
  }, [pendingTransform]);

  // ── Planning toggle ───────────────────────────────────────────────────────
  const handleToggleZoning = useCallback(async () => {
    if (!cityjson || zoningLoading) return;
    if (zoningEnabled) {
      setZoningEnabled(false);
      setZones([]);
      return;
    }

    const footprintBbox = computeFootprintBbox(extractFootprints(cityjson));
    const viewportBbox = mapBboxRef.current;
    const bbox =
      viewportBbox && isBboxNearHamburg(expandBbox(viewportBbox))
        ? viewportBbox
        : footprintBbox && isBboxNearHamburg(expandBbox(footprintBbox))
        ? footprintBbox
        : viewportBbox ?? footprintBbox;
    if (!bbox) {
      alert('Could not derive a map bbox for the planning query.');
      return;
    }
    const queryBbox = expandBbox(bbox);
    if (!isBboxNearHamburg(queryBbox)) {
      alert(
        'Hamburg planning data is only available for Hamburg. Load a Hamburg tile or pan the map to Hamburg first.'
      );
      return;
    }

    setZoningLoading(true);
    try {
      const nextZones = await fetchHamburgPlanningZones(queryBbox);
      if (nextZones.length === 0) {
        alert('No Hamburg planning polygons returned for this viewport.');
        return;
      }
      setZones(nextZones);
      setZoningEnabled(true);
    } catch (e) {
      console.error(e);
      alert(`Planning layer failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setZoningLoading(false);
    }
  }, [cityjson, zoningEnabled, zoningLoading]);

  const handleStartDraw = useCallback(() => {
    setSelection(null);
    setDrawMode('polygon');
  }, []);

  const handleCancelDraw = useCallback(() => {
    setDrawMode('none');
    setPendingFootprint(null);
    setPendingForm(null);
  }, []);

  const handleFootprintDrawn = useCallback((ring: [number, number][]) => {
    setDrawMode('none');
    setPendingFootprint(ring);
  }, []);

  const handleCreateBuilding = useCallback(
    (form: NewBuildingForm) => {
      if (!cityjson || !pendingFootprint) return;
      // Planning compatibility check. This is a lightweight client-side
      // classification over Hamburg planning attributes, not a legal decision.
      if (zoningEnabled && zones.length > 0) {
        const cx = pendingFootprint.reduce((a, v) => a + v[0], 0) / pendingFootprint.length;
        const cy = pendingFootprint.reduce((a, v) => a + v[1], 0) / pendingFootprint.length;
        const zone = findZoneForPoint(zones, [cx, cy]);
        const check = validateBuildingType(zone, form.function);
        if (!check.allowed) {
          alert(`Planning layer conflict: ${check.reason}`);
          return;
        }
      }
      const crs = detectCrs(cityjson);
      if (!crs.supported) {
        alert(`Can't generate: CRS ${crs.code} isn't supported. Add a proj4 def.`);
        setPendingFootprint(null);
        setPendingForm(null);
        return;
      }
      try {
        pushUndo('Create new building');
        const ridgeHeight = form.totalHeight;
        const eaveHeight =
          form.roofType === 'flat' ? form.totalHeight : form.totalHeight - form.roofHeight;
        const { id, objectIds } = createBuildingFromEditor(cityjson, {
          targetCrs: crs.code,
          footprintWgs84: pendingFootprint,
          storeys: form.storeys,
          eaveHeight,
          ridgeHeight,
          roofType: form.roofType,
          attributes: {
            function: form.function,
            yearOfConstruction: form.yearOfConstruction,
          },
          openings:
            form.addWindows || form.addDoor
              ? { windows: form.addWindows, door: form.addDoor }
              : undefined,
          eaveOverhang: form.eaveOverhang,
          rakeOverhang: form.rakeOverhang,
        }, {
          mode: form.splitMode,
          count: form.splitCount,
          axis: form.splitAxis,
        });
        const newIds = new Set(objectIds);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          for (const nid of newIds) next.add(nid);
          return next;
        });
        setReloadToken((t) => t + 1);
        setSelection({ objectId: id });
        markGeometryChanged();
      } catch (e) {
        console.error(e);
        alert(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setPendingFootprint(null);
        setPendingForm(null);
      }
    },
    [cityjson, pendingFootprint, pushUndo, zoningEnabled, zones, markGeometryChanged]
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
  }, [cityjson, fileName]);

  const runExternalGeometryValidation = useCallback(async (text: string) => {
    setPrimitiveValidation({
      kind: 'checking',
      message: 'Checking exported CityJSON primitives with the local val3dity service...',
    });
    try {
      const result = await validateExportGeometry(
        catalogConnectionRef.current?.baseUrl ?? DEFAULT_HAMBURG_CATALOG_URL,
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
  }, []);

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
      // Pass the underlying ArrayBuffer to Blob — Uint8Array's buffer type
      // can be ArrayBufferLike (incl. SharedArrayBuffer), which TS strict
      // mode rejects as a BlobPart. Slicing forces a fresh ArrayBuffer.
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

  const handleReset = useCallback(() => {
    setCityjson(null);
    cityjsonRef.current = null;
    setFileName('');
    setSelection(null);
    const clean = new Set<string>();
    dirtyIdsRef.current = clean;
    setDirtyIds(clean);
    setSeqRawText(null);
    setCatalogConnection(null);
    catalogConnectionRef.current = null;
    setCatalogStatus({ kind: 'idle' });
    setInputIntegrity(null);
    setPrimitiveValidation({
      kind: 'unchecked',
      message: '3D primitive validity has not been checked yet.',
    });
    if (catalogViewportTimerRef.current !== null) {
      window.clearTimeout(catalogViewportTimerRef.current);
      catalogViewportTimerRef.current = null;
    }
    originals.clear();
  }, [originals]);

  // Cheap integrity check — re-runs only when the doc identity / reload-token
  // changes, NOT on every render. The walk is O(vertices+faces), <100 ms even
  // on a Hamburg tile (918 buildings, ~30k vertices).
  const integrity = useMemo(() => {
    if (!cityjson) return null;
    return checkIntegrity(cityjson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityjson, reloadToken]);

  // ── IFC import ────────────────────────────────────────────────────────────

  /** Step 1: open file picker, parse the picked IFC via web-ifc (WASM),
   *  surface a summary, and arm the map for placement. The web-ifc module
   *  + 1.3 MB WASM is dynamically imported here so the initial bundle
   *  doesn't pay the cost for users who never touch IFC. */
  const handleImportIfc = useCallback(() => {
    if (!cityjson) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      setIfcParsing(true);
      try {
        const { parseIfc } = await import('./lib/ifc-import');
        const parsed = await parseIfc(file);
        setIfcPending({ parsed, fileName: file.name });
      } catch (e) {
        alert(`IFC parse failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIfcParsing(false);
      }
    };
    document.body.appendChild(input);
    input.click();
  }, [cityjson]);

  /** Step 2: user clicked the map — drop the IFC's full triangulated mesh
   *  at that location. The mesh is emitted as an LoD 3 MultiSurface (with
   *  GroundSurface / RoofSurface / WallSurface inferred from triangle
   *  normals), preceded by a clean LoD 1 GroundSurface rectangle so the
   *  map's footprint extractor renders a tidy outline. */
  const handleIfcPlacement = useCallback(
    async (lngLat: [number, number]) => {
      if (!cityjson || !ifcPending) return;
      try {
        pushUndo(`Import IFC: ${ifcPending.fileName}`);
        const { convertIfcToCityJsonBuilding } = await import('./lib/ifc-to-cityjson');
        const { value: result } = runStructurallyGuardedMutation(
          cityjson,
          `Importing IFC ${ifcPending.fileName}`,
          () => {
            const converted = convertIfcToCityJsonBuilding(
              cityjson,
              ifcPending.parsed,
              lngLat,
              ifcPending.fileName
            );
            if (converted.vertexOffset !== cityjson.vertices.length) {
              throw new Error(
                `Vertex offset mismatch: expected ${cityjson.vertices.length}, got ${converted.vertexOffset}`
              );
            }
            cityjson.vertices.push(...converted.newVertices);
            cityjson.CityObjects[converted.id] = converted.cityObject;
            return converted;
          }
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(result.id);
          return next;
        });
        setSelection({ objectId: result.id });
        setReloadToken((t) => t + 1);
        markGeometryChanged();
      } catch (e) {
        alert(
          `Could not create building from IFC: ${e instanceof Error ? e.message : String(e)}`
        );
      } finally {
        setIfcPending(null);
      }
    },
    [cityjson, ifcPending, pushUndo, markGeometryChanged]
  );

  const handleCancelIfcPlacement = useCallback(() => {
    setIfcPending(null);
  }, []);

  // Esc key cancels IFC placement (parallel to the polygon-draw cancel).
  useEffect(() => {
    if (!ifcPending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIfcPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ifcPending]);

  const handleMergeFile = useCallback(() => {
    if (!cityjson) return;
    // Hidden file input — appended, clicked, removed.
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
        // Snapshot before mutation so the user can undo a bad merge.
        pushUndo(`Merge ${file.name}`);
        const { value: r } = runStructurallyGuardedMutation(
          cityjson,
          `Merging ${file.name}`,
          () => mergeCityJson(cityjson, parsed.doc)
        );
        if (!r.ok) {
          // Roll back — merge refused, no doc change.
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
        markGeometryChanged('Merged geometry has not been checked with val3dity yet.');
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
        alert(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    document.body.appendChild(input);
    input.click();
  }, [cityjson, pushUndo, dirtyIds, selection, markGeometryChanged]);

  const handleCompactVertices = useCallback(() => {
    if (!cityjson) return;
    pushUndo('Compact orphaned vertices');
    const r = compactVertices(cityjson);
    if (r.changed) {
      setReloadToken((t) => t + 1);
      // Mark every dirty building as still dirty (compact preserves their
      // semantic state, but the doc is structurally different and we want
      // the user to feel that an action took place).
      setSaveStatus('idle');
    } else {
      // Roll back the snapshot we just pushed — nothing actually changed.
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
  }, [cityjson, pushUndo, dirtyIds, selection]);

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
    // Group + cap so the alert isn't a wall of text on huge files. First 12
    // entries cover the typical case; "+ N more" hints at the rest.
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
      const tag = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      lines.push(`${tag} [${issue.code}] ${issue.message}`);
    }
    if (integrity.issues.length > max) {
      lines.push(`… + ${integrity.issues.length - max} more`);
    }
    alert(lines.join('\n'));
  }, [integrity, inputIntegrity, primitiveValidation.message]);

  // Extract footprints once (memoized on doc identity + reload token) so
  // FilterBar and the dimmed-set computation share the same derived data.
  const footprintsForFilter = useMemo(() => {
    if (!cityjson) return [];
    return extractFootprints(cityjson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityjson, reloadToken]);

  const filteredIds = useMemo(
    () => matchingIds(footprintsForFilter, filter),
    [footprintsForFilter, filter]
  );

  // Pre-applied filter result for the BuildingListPanel — same input as
  // matchingIds but we keep the Footprint objects (not just ids) so the
  // list can show function/year/height per row.
  const filteredFootprints = useMemo(
    () => applyFilter(footprintsForFilter, filter),
    [footprintsForFilter, filter]
  );

  const filterIsEmpty = isFilterEmpty(filter);

  // Re-derived after every undo/redo/push so the toolbar buttons reflect
  // the current stack state. `undoVersion` is the dep that drives this.
  const undoState = useMemo(() => {
    if (!cityjson) return undefined;
    return {
      canUndo: undoRef.current.canUndo(),
      canRedo: undoRef.current.canRedo(),
      undoLabel: undoRef.current.peekUndoLabel(),
      redoLabel: undoRef.current.peekRedoLabel(),
      onUndo: handleUndo,
      onRedo: handleRedo,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityjson, undoVersion, handleUndo, handleRedo]);

  const stats = useMemo(() => {
    if (!cityjson) return null;
    const ids = Object.keys(cityjson.CityObjects);
    const rootBuildings = ids.filter((id) => {
      const o = cityjson.CityObjects[id];
      return (
        (o.type === 'Building' ||
          o.type === 'Bridge' ||
          o.type === 'CityObjectGroup' ||
          o.type === 'Tunnel') &&
        !o.parents
      );
    });
    return {
      version: cityjson.version,
      totalObjects: ids.length,
      rootBuildings: rootBuildings.length,
      vertices: cityjson.vertices.length,
      crs: cityjson.metadata?.referenceSystem ?? null,
    };
  }, [cityjson]);

  // Derived: filtered sub-document for the selected building
  const filteredForSelected = useMemo(() => {
    if (!cityjson || !selection) return null;
    return filterToBuilding(cityjson, selection.objectId);
  }, [cityjson, selection, reloadToken]);

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        stats={stats}
        dirtyCount={dirtyIds.size}
        hasData={!!cityjson}
        onExport={handleExport}
        onExportGltf={handleExportGltf}
        integrity={
          integrity
            ? {
                errorCount: integrity.counts.error,
                warningCount: integrity.counts.warning,
                onShow: handleShowIntegrity,
              }
            : undefined
        }
        orphanedVertexCount={integrity?.summary.orphanedVertices ?? 0}
        onCompactVertices={handleCompactVertices}
        undoState={undoState}
        showList={showList}
        onToggleList={() => setShowList((v) => !v)}
        onMergeFile={handleMergeFile}
        onImportIfc={handleImportIfc}
        ifcParsing={ifcParsing}
        onReloadView={handleReloadView}
        onNewFile={handleReset}
        onSaveLocal={handleSaveLocal}
        saveStatus={saveStatus}
        drawMode={drawMode}
        onStartDraw={handleStartDraw}
        onCancelDraw={handleCancelDraw}
        onCopy={handleCopy}
        onPaste={handlePaste}
        canCopy={!!selection || multiSelection.size > 0}
        canPaste={!!clipboardIds && clipboardIds.size > 0}
        onDelete={handleDelete}
        canDelete={!!selection || multiSelection.size > 0}
        zoningEnabled={zoningEnabled}
        zoningLoading={zoningLoading}
        onToggleZoning={handleToggleZoning}
        onFilterViewport={handleReloadViewport}
        canFilterViewport={!!seqRawText}
        catalogState={
          catalogConnection
            ? {
                loadedTiles: catalogConnection.loadedTiles.size,
                loading: catalogStatus.kind === 'loading',
                dirty: dirtyIds.size > 0,
                error: catalogStatus.kind === 'error' ? catalogStatus.message : undefined,
                message: catalogStatus.message,
              }
            : undefined
        }
        primitiveValidation={{
          ...primitiveValidation,
          onValidate: () => void handleValidateGeometry(),
        }}
        onLoadCatalogViewport={
          catalogConnection
            ? () => {
                const bbox = mapBboxRef.current;
                if (bbox) void loadCatalogViewport(bbox);
                else alert('Map viewport is not ready yet.');
              }
            : undefined
        }
        onPersistCatalog={catalogConnection ? handlePersistCatalog : undefined}
      />
      {cityjson && footprintsForFilter.length > 0 && (
        <FilterBar
          footprints={footprintsForFilter}
          filter={filter}
          onChange={setFilter}
          matchCount={filteredIds.size}
        />
      )}
      <div className="main">
        {showList && cityjson && footprintsForFilter.length > 0 && (
          <BuildingListPanel
            filteredFootprints={filteredFootprints}
            totalCount={footprintsForFilter.length}
            selectedId={selection?.objectId ?? null}
            onSelect={(id) => setSelection({ objectId: id })}
            onClose={() => setShowList(false)}
          />
        )}
        <div className="viewer-host" style={{ position: 'relative' }}>
          {ifcPending && (
            <IfcPlacementBanner
              parsed={ifcPending.parsed}
              fileName={ifcPending.fileName}
              onCancel={handleCancelIfcPlacement}
            />
          )}
          {zoningEnabled && zones.length > 0 && <ZoneLegend zones={zones} />}
          {cityjson ? (
            <MapView
              cityjson={cityjson}
              selectedId={selection?.objectId ?? null}
              onSelect={handleSelect}
              reloadToken={reloadToken}
              drawMode={drawMode}
              onFootprintDrawn={handleFootprintDrawn}
              onDrawCanceled={handleCancelDraw}
              filteredIds={filterIsEmpty ? null : filteredIds}
              onPlacementClick={ifcPending ? handleIfcPlacement : undefined}
              onViewportChange={handleViewportChange}
              dragTransformId={pendingTransform?.id ?? null}
              onDragMove={handleDragMove}
              multiSelectedIds={multiSelection.size > 0 ? multiSelection : null}
              zones={zoningEnabled ? zones : []}
              footprintEdit={
                footprintEdit
                  ? {
                      buildingId: footprintEdit.buildingId,
                      footprintWgs84: footprintEdit.initialFootprint,
                    }
                  : null
              }
              onFootprintChange={handleFootprintChange}
              preview={
                pendingFootprint && pendingForm
                  ? {
                      // Mesh-based preview gives the user the actual roof shape
                      // in real time; falls back to polygon extrusion if the
                      // target CRS isn't recognised by proj4.
                      mesh:
                        buildPreviewMesh({
                          footprintWgs84: pendingFootprint,
                          targetCrs: detectCrs(cityjson).code,
                          eaveHeight:
                            pendingForm.roofType === 'flat'
                              ? pendingForm.totalHeight
                              : pendingForm.totalHeight - pendingForm.roofHeight,
                          ridgeHeight: pendingForm.totalHeight,
                          roofType: pendingForm.roofType,
                          storeys: pendingForm.storeys,
                          openings:
                            pendingForm.addWindows || pendingForm.addDoor
                              ? {
                                  windows: pendingForm.addWindows,
                                  door: pendingForm.addDoor,
                                }
                              : undefined,
                        }) ?? undefined,
                      polygon: pendingFootprint,
                      height: pendingForm.totalHeight,
                    }
                  : pendingTransform
                  ? (() => {
                      const t = computeTransformedFootprint(cityjson, pendingTransform);
                      return t ? { polygon: t.polygon, height: t.height } : null;
                    })()
                  : null
              }
            />
          ) : (
            <FileLoader onLoaded={handleLoaded} onCatalogLoaded={handleCatalogLoaded} />
          )}
          {pendingFootprint && cityjson && (
            <BuildingCreator
              vertexCount={pendingFootprint.length}
              footprint={pendingFootprint}
              cityjson={cityjson}
              onFormChange={setPendingForm}
              onCreate={handleCreateBuilding}
              onCancel={handleCancelDraw}
            />
          )}
        </div>

        {cityjson && selection && filteredForSelected && (
          <aside className={`side-panel ${sidePanelFullscreen ? 'fullscreen' : ''}`}>
            <div className="panel-header">
              <h3>
                {dirtyIds.has(selection.objectId) && (
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--warn)]" />
                )}
                {cityjson.CityObjects[selection.objectId]?.type ?? 'Unknown'}
              </h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setSidePanelFullscreen((f) => !f)}
                  aria-label={sidePanelFullscreen ? 'Collapse' : 'Fullscreen'}
                  title={sidePanelFullscreen ? 'Collapse side panel' : 'Fullscreen side panel'}
                  style={{ padding: '2px 8px' }}
                >
                  {sidePanelFullscreen ? '⇲' : '⇱'}
                </button>
                <button
                  onClick={() => {
                    setSelection(null);
                    setSidePanelFullscreen(false);
                  }}
                  aria-label="Close"
                  style={{ padding: '2px 8px' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="building-viewer-host">
              <Viewer
                cityjson={filteredForSelected}
                reloadToken={reloadToken}
                onSelect={() => {}}
                splitPreview={
                  splitPreviewHeights
                    ? {
                        buildingId: selection.objectId,
                        heights: splitPreviewHeights,
                        floorPlans: splitPreviewFloorPlans ?? undefined,
                      }
                    : null
                }
                onAdjustSplit={handleAdjustSplit}
              />
            </div>

            <AttributePanelInline
              buildingId={selection.objectId}
              cityjson={cityjson}
              isDirty={dirtyIds.has(selection.objectId)}
              onAttributeChange={handleAttributeChange}
              onRevert={handleRevert}
              onSplitByFloor={handleSplitByFloor}
              onSplitByFloorHeights={handleSplitByFloorHeights}
              onSplitByFloorPlans={handleSplitByFloorPlans}
              onCustomHeightsPreview={setSplitPreviewHeights}
              onFloorPlansPreview={setSplitPreviewFloorPlans}
              onSplitBySide={handleSplitBySide}
              pendingTransform={
                pendingTransform?.id === selection.objectId ? pendingTransform : null
              }
              onStartTransform={handleStartTransform}
              onUpdateTransform={handleUpdateTransform}
              onCancelTransform={handleCancelTransform}
              onSaveTransform={handleSaveTransform}
              inFootprintEdit={
                footprintEdit?.buildingId === selection.objectId
              }
              onStartFootprintEdit={handleStartFootprintEdit}
              onSaveFootprintEdit={handleSaveFootprintEdit}
              onCancelFootprintEdit={handleCancelFootprintEdit}
              onMoveOpening={handleMoveOpening}
              onMakeEditable={handleMakeEditable}
              onReshapeBuilding={handleReshapeBuilding}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// Attribute panel without its own header (the parent aside owns the header now).
function AttributePanelInline(props: {
  buildingId: string;
  cityjson: CityJsonDocument;
  isDirty: boolean;
  onAttributeChange: (id: string, key: string, value: AttributeValue) => void;
  onRevert: (id: string) => void;
  onSplitByFloor: (id: string, floorCount: number) => void;
  onSplitByFloorHeights: (id: string, heights: number[]) => void;
  onSplitByFloorPlans: (
    id: string,
    heights: number[],
    floorPlans: FloorPlanDivision[]
  ) => void;
  onCustomHeightsPreview: (heights: number[] | null) => void;
  onFloorPlansPreview: (plans: FloorPlanDivision[] | null) => void;
  onSplitBySide: (id: string, partCount: number, axis: SplitAxis) => void;
  pendingTransform: PendingTransform | null;
  onStartTransform: (id: string) => void;
  onUpdateTransform: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform: () => void;
  onSaveTransform: () => void;
  inFootprintEdit: boolean;
  onStartFootprintEdit: (id: string) => void;
  onSaveFootprintEdit: () => void;
  onCancelFootprintEdit: () => void;
  onMoveOpening?: (buildingId: string, opening: import('./lib/opening-edit').OpeningInfo, dx: number, dy: number, dz: number) => void;
  onMakeEditable?: (buildingId: string) => void;
  onReshapeBuilding?: (
    buildingId: string,
    overrides: {
      roofType?: 'flat' | 'pyramid' | 'gable' | 'hip';
      eaveHeight?: number;
      ridgeHeight?: number;
      eaveOverhang?: number;
      rakeOverhang?: number;
      addWindows?: boolean;
      addDoor?: boolean;
    }
  ) => void;
}) {
  return (
    <AttributePanel
      buildingId={props.buildingId}
      cityjson={props.cityjson}
      isDirty={props.isDirty}
      onAttributeChange={props.onAttributeChange}
      onRevert={props.onRevert}
      onClose={() => {}}
      onSplitByFloor={props.onSplitByFloor}
      onSplitByFloorHeights={props.onSplitByFloorHeights}
      onSplitByFloorPlans={props.onSplitByFloorPlans}
      onCustomHeightsPreview={props.onCustomHeightsPreview}
      onFloorPlansPreview={props.onFloorPlansPreview}
      onSplitBySide={props.onSplitBySide}
      pendingTransform={props.pendingTransform}
      onStartTransform={props.onStartTransform}
      onUpdateTransform={props.onUpdateTransform}
      onCancelTransform={props.onCancelTransform}
      onSaveTransform={props.onSaveTransform}
      inFootprintEdit={props.inFootprintEdit}
      onStartFootprintEdit={props.onStartFootprintEdit}
      onSaveFootprintEdit={props.onSaveFootprintEdit}
      onCancelFootprintEdit={props.onCancelFootprintEdit}
      onMoveOpening={props.onMoveOpening}
      onMakeEditable={props.onMakeEditable}
      onReshapeBuilding={props.onReshapeBuilding}
      hideHeader
    />
  );
}

function computeFootprintBbox(
  footprints: { polygon: [number, number][] }[]
): [number, number, number, number] | null {
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  let any = false;
  for (const fp of footprints) {
    for (const [lng, lat] of fp.polygon) {
      if (lng < west) west = lng;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lat > north) north = lat;
      any = true;
    }
  }
  return any ? [west, south, east, north] : null;
}

function expandBbox(
  bbox: [number, number, number, number],
  ratio = 0.15,
  minPad = 0.002
): [number, number, number, number] {
  const [west, south, east, north] = bbox;
  const lngPad = Math.max((east - west) * ratio, minPad);
  const latPad = Math.max((north - south) * ratio, minPad);
  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
}

/**
 * Floating banner shown over the map while the user is in IFC-placement
 * mode. Surfaces the parsed IFC's headline numbers + a Cancel button (Esc
 * also works). Click anywhere on the map to drop the building.
 */
function ZoneLegend({ zones }: { zones: ParcelZone[] }) {
  const visibleZones = uniqueZonesByLabel(zones).slice(0, 6);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 11,
        background: 'rgba(20, 20, 24, 0.88)',
        color: '#fff',
        padding: '8px 10px',
        borderRadius: 6,
        fontSize: 11,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 6,
        }}
      >
        Planning
      </div>
      <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.75)' }}>
        {zones.length} polygons loaded
      </div>
      {visibleZones.map((z) => (
        <div
          key={z.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
          title={
            z.details
              ? `${z.details} | Compatible: ${
                  z.allowedTypes.length > 0 ? z.allowedTypes.join(', ') : 'none mapped'
                }`
              : `Compatible: ${z.allowedTypes.join(', ')}`
          }
        >
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 2,
              background: `rgb(${z.color[0]}, ${z.color[1]}, ${z.color[2]})`,
              border: '1px solid rgba(255,255,255,0.25)',
              flexShrink: 0,
            }}
          />
          <span>{z.label}</span>
        </div>
      ))}
      {zones.length > visibleZones.length && (
        <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.5)' }}>
          +{zones.length - visibleZones.length} more
        </div>
      )}
    </div>
  );
}

function uniqueZonesByLabel(zones: ParcelZone[]): ParcelZone[] {
  const seen = new Set<string>();
  const unique: ParcelZone[] = [];
  for (const zone of zones) {
    if (seen.has(zone.label)) continue;
    seen.add(zone.label);
    unique.push(zone);
  }
  return unique;
}

function IfcPlacementBanner({
  parsed,
  fileName,
  onCancel,
}: {
  parsed: IfcImportResult;
  fileName: string;
  onCancel: () => void;
}) {
  const triCount = parsed.indices.length / 3;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 12,
        background: 'rgba(46,64,87,0.96)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 6,
        fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        maxWidth: 520,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            ⌂ Click on the map to place &ldquo;{parsed.name ?? fileName}&rdquo;
          </div>
          <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.78)' }}>
            {parsed.width.toFixed(1)} × {parsed.depth.toFixed(1)} ×{' '}
            {parsed.height.toFixed(1)} m · {parsed.storeyCount} storey
            {parsed.storeyCount === 1 ? '' : 's'} · {triCount.toLocaleString()}{' '}
            triangles
            {parsed.refLat !== null && parsed.refLon !== null && (
              <>
                {' '}· IFC site geo-ref {parsed.refLat.toFixed(4)}°N,{' '}
                {parsed.refLon.toFixed(4)}°E
              </>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
            ESC to cancel · parsed in {parsed.parseMs} ms
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
