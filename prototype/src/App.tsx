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
import { generateBuilding, insertBuilding } from './lib/generator';
import { detectCrs } from './lib/projection';
import {
  splitBuildingByFloor,
  splitBuildingByFloorHeights,
  splitBuildingBySide,
  MIN_STOREY_HEIGHT,
  type SplitAxis,
} from './lib/subdivision';
import { moveBuilding, rotateBuilding } from './lib/transform';
import { regenerateBuilding } from './lib/regenerate';
import { extractFootprints } from './lib/footprints';
import { exportToGltf } from './lib/gltf-export';
import { checkIntegrity } from './lib/integrity';
import { compactVertices } from './lib/compact';
import { matchingIds, isFilterEmpty, type BuildingFilter } from './lib/filter';
import { mergeCityJson } from './lib/merge';
import { parseCityJsonAuto } from './lib/cityjson';
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
import {
  generateZonesAroundCenter,
  findZoneForPoint,
  validateBuildingType,
  type ParcelZone,
} from './lib/zoning';
import type { AttributeValue, CityJsonDocument, SelectionInfo } from './types';

export default function App() {
  const [cityjson, setCityjson] = useState<CityJsonDocument | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
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

  // ── Zoning ────────────────────────────────────────────────────────────────
  const [zones, setZones] = useState<ParcelZone[]>([]);
  const [zoningEnabled, setZoningEnabled] = useState(false);

  // ── Raw CityJSONSeq cache for viewport re-parse ───────────────────────────
  // Held only for CityJSONSeq inputs. The "Filter to viewport" toolbar action
  // re-parses this with parseCityJsonSeq(text, undefined, bboxInCrs) to drop
  // features outside the current map view — useful on city-scale jsonl files.
  const [seqRawText, setSeqRawText] = useState<string | null>(null);
  const mapBboxRef = useRef<[number, number, number, number] | null>(null);

  // Snapshot of original attributes per-building, for revert.
  const [originals] = useState<Map<string, Record<string, AttributeValue>>>(new Map());

  const handleLoaded = useCallback(
    (doc: CityJsonDocument, name: string, rawText: string | null = null) => {
      setCityjson(doc);
      setFileName(name);
      setSeqRawText(rawText);
      setSelection(null);
      setDirtyIds(new Set());
      setFilter({}); // reset filters when loading a new doc
      undoRef.current.clear();
      setUndoVersion((v) => v + 1);
      originals.clear();
    },
    [originals]
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
  }, [cityjson, dirtyIds, selection]);

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
  }, [cityjson, dirtyIds, selection]);

  // ── Opening move ─────────────────────────────────────────────────────────
  const handleMoveOpening = useCallback(
    (buildingId: string, opening: import('./lib/opening-edit').OpeningInfo, dx: number, dy: number, dz: number) => {
      if (!cityjson) return;
      pushUndo(`Move ${opening.type} on ${buildingId}`);
      moveOpening(cityjson, buildingId, opening, dx, dy, dz);
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(buildingId);
        return next;
      });
      setReloadToken((t) => t + 1);
    },
    [cityjson, pushUndo]
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
    const { clonedIds } = cloneBuildings(cityjson, clipboardIds, 5, 5);
    setDirtyIds((prev) => {
      const next = new Set(prev);
      for (const id of clonedIds) next.add(id);
      return next;
    });
    setReloadToken((t) => t + 1);
    if (clonedIds.length === 1) setSelection({ objectId: clonedIds[0] });
    setMultiSelection(new Set(clonedIds));
  }, [cityjson, clipboardIds, pushUndo]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!cityjson) return;
    const ids = new Set(multiSelection);
    if (selection) ids.add(selection.objectId);
    if (ids.size === 0) return;
    const label =
      ids.size === 1 ? `Delete ${[...ids][0]}` : `Delete ${ids.size} buildings`;
    pushUndo(label);
    const { deletedIds } = deleteBuildings(cityjson, ids);
    const gone = new Set(deletedIds);
    setDirtyIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (!gone.has(id)) next.add(id);
      return next;
    });
    setSelection(null);
    setMultiSelection(new Set());
    setReloadToken((t) => t + 1);
  }, [cityjson, selection, multiSelection, pushUndo]);

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
        const { partIds } = splitBuildingByFloor(cityjson, id, floorCount);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo]
  );

  const handleSplitByFloorHeights = useCallback(
    (id: string, heights: number[]) => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} with custom heights`);
        const { partIds } = splitBuildingByFloorHeights(cityjson, id, heights);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo]
  );

  const handleSplitBySide = useCallback(
    (id: string, partCount: number, axis: SplitAxis = 'auto') => {
      if (!cityjson) return;
      try {
        pushUndo(`Split ${id} into ${partCount} side parts`);
        const { partIds } = splitBuildingBySide(cityjson, id, partCount, axis);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson, pushUndo]
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
      // Order: rotate first (around centroid), then translate. Matches what the
      // live preview does in computeTransformedFootprint.
      if (angle !== 0) rotateBuilding(cityjson, id, angle);
      if (dx !== 0 || dy !== 0) moveBuilding(cityjson, id, dx, dy, 0);
      if (angle !== 0 || dx !== 0 || dy !== 0) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setReloadToken((t) => t + 1);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingTransform(null);
    }
  }, [cityjson, pendingTransform, pushUndo]);

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
    const res = regenerateBuilding(cityjson, footprintEdit.buildingId, ring);
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
  }, [cityjson, footprintEdit, pushUndo, dirtyIds, selection]);

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

  // ── Zoning toggle ─────────────────────────────────────────────────────────
  const handleToggleZoning = useCallback(() => {
    if (!cityjson) return;
    if (zoningEnabled) {
      setZoningEnabled(false);
      setZones([]);
      return;
    }
    const fps = extractFootprints(cityjson);
    if (fps.length === 0) return;
    let sx = 0, sy = 0, n = 0;
    for (const fp of fps) {
      for (const [lng, lat] of fp.polygon) { sx += lng; sy += lat; n++; }
    }
    if (n === 0) return;
    const center: [number, number] = [sx / n, sy / n];
    setZones(generateZonesAroundCenter(center));
    setZoningEnabled(true);
  }, [cityjson, zoningEnabled]);

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
      // Zoning check
      if (zoningEnabled && zones.length > 0) {
        const cx = pendingFootprint.reduce((a, v) => a + v[0], 0) / pendingFootprint.length;
        const cy = pendingFootprint.reduce((a, v) => a + v[1], 0) / pendingFootprint.length;
        const zone = findZoneForPoint(zones, [cx, cy]);
        const check = validateBuildingType(zone, form.function);
        if (!check.allowed) {
          alert(`Zoning violation: ${check.reason}`);
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
        const result = generateBuilding(cityjson, {
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
        });
        const id = insertBuilding(cityjson, result);
        const newIds = new Set([id]);
        // Apply the optional split-on-create immediately.
        if (form.splitMode === 'floors') {
          try {
            const { partIds } = splitBuildingByFloor(cityjson, id, form.splitCount);
            for (const p of partIds) newIds.add(p);
          } catch (e) {
            alert(
              `Building created but split-by-floor failed: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        } else if (form.splitMode === 'sides') {
          try {
            const { partIds } = splitBuildingBySide(cityjson, id, form.splitCount, form.splitAxis);
            for (const p of partIds) newIds.add(p);
          } catch (e) {
            alert(
              `Building created but split-by-side failed: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        }
        setDirtyIds((prev) => {
          const next = new Set(prev);
          for (const nid of newIds) next.add(nid);
          return next;
        });
        setReloadToken((t) => t + 1);
        setSelection({ objectId: id });
      } catch (e) {
        console.error(e);
        alert(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setPendingFootprint(null);
        setPendingForm(null);
      }
    },
    [cityjson, pendingFootprint, pushUndo, zoningEnabled, zones]
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

  const handleExport = useCallback(() => {
    if (!cityjson) return;
    const text = JSON.stringify(cityjson);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = fileName.replace(/\.city\.json$|\.json$/i, '') || 'export';
    a.download = `${base}.modified.city.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [cityjson, fileName]);

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
    setFileName('');
    setSelection(null);
    setDirtyIds(new Set());
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
        const result = convertIfcToCityJsonBuilding(
          cityjson,
          ifcPending.parsed,
          lngLat,
          ifcPending.fileName
        );
        // Append vertices + insert the CityObject (manual — generator's
        // insertBuilding asserts vertexOffset === doc.vertices.length, which
        // matches our converter's contract).
        if (result.vertexOffset !== cityjson.vertices.length) {
          throw new Error(
            `Vertex offset mismatch: expected ${cityjson.vertices.length}, got ${result.vertexOffset}`
          );
        }
        cityjson.vertices.push(...result.newVertices);
        cityjson.CityObjects[result.id] = result.cityObject;
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(result.id);
          return next;
        });
        setSelection({ objectId: result.id });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(
          `Could not create building from IFC: ${e instanceof Error ? e.message : String(e)}`
        );
      } finally {
        setIfcPending(null);
      }
    },
    [cityjson, ifcPending, pushUndo]
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
        const r = mergeCityJson(cityjson, parsed.doc);
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
  }, [cityjson, pushUndo, dirtyIds, selection]);

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
      alert('No integrity issues found.');
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
  }, [integrity]);

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
        onToggleZoning={handleToggleZoning}
        onFilterViewport={handleReloadViewport}
        canFilterViewport={!!seqRawText}
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
              onViewportChange={(bbox) => {
                mapBboxRef.current = bbox;
              }}
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
            <FileLoader onLoaded={handleLoaded} />
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
                    ? { buildingId: selection.objectId, heights: splitPreviewHeights }
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
              onCustomHeightsPreview={setSplitPreviewHeights}
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
  onCustomHeightsPreview: (heights: number[] | null) => void;
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
      onCustomHeightsPreview={props.onCustomHeightsPreview}
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
      hideHeader
    />
  );
}

/**
 * Floating banner shown over the map while the user is in IFC-placement
 * mode. Surfaces the parsed IFC's headline numbers + a Cancel button (Esc
 * also works). Click anywhere on the map to drop the building.
 */
function ZoneLegend({ zones }: { zones: ParcelZone[] }) {
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
        Zoning
      </div>
      {zones.map((z) => (
        <div
          key={z.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
          title={`Allowed: ${z.allowedTypes.join(', ')}`}
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
    </div>
  );
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
