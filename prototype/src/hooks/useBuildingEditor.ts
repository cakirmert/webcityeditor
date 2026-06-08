import { useState, useRef, useCallback, useEffect } from 'react';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import type { NewBuildingForm } from '../types';
import type { FloorPlanDivision, SplitAxis } from '../lib/subdivision';
import {
  splitBuildingByFloor,
  splitBuildingByFloorHeights,
  splitBuildingByFloorPlans,
  splitBuildingBySide,
  MIN_STOREY_HEIGHT,
} from '../lib/subdivision';
import { regenerateBuilding } from '../lib/regenerate';
import { extractFootprints, footprintPolygonToWgs84 } from '../lib/footprints';
import {
  commitBuildingTransformFromEditor,
  createBuildingFromEditor,
  runStructurallyGuardedMutation,
} from '../lib/editor-actions';
import { detectCrs } from '../lib/projection';
import type { IfcImportResult } from '../lib/ifc-import';
import {
  type PendingTransform,
} from '../lib/transform-preview';
import { snapTransformToTerrain } from '../lib/terrain';
import { cloneBuildings } from '../lib/clipboard';
import { deleteBuildings } from '../lib/delete';
import { moveOpening } from '../lib/opening-edit';
import { parametriseBuilding } from '../lib/parametrise';
import { findZoneForPoint, validateBuildingType, type ParcelZone } from '../lib/zoning';

export function useBuildingEditor(
  coreState: CoreState,
  undoRedo: UndoRedoState,
  zoning: { zones: ParcelZone[]; zoningEnabled: boolean }
) {
  const {
    cityjson,
    selection,
    setSelection,
    dirtyIds,
    setDirtyIds,
    setReloadToken,
    markGeometryChanged,
  } = coreState;

  const { pushUndo, undoRef, setUndoVersion } = undoRedo;
  const { zones, zoningEnabled } = zoning;

  const [pendingFootprint, setPendingFootprint] = useState<[number, number][] | null>(null);
  const [pendingForm, setPendingForm] = useState<NewBuildingForm | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [pendingTransform, setPendingTransform] = useState<PendingTransform | null>(null);
  const [splitPreviewHeights, setSplitPreviewHeights] = useState<number[] | null>(null);
  const [splitPreviewFloorPlans, setSplitPreviewFloorPlans] = useState<FloorPlanDivision[] | null>(null);
  const [footprintEdit, setFootprintEdit] = useState<{
    buildingId: string;
    initialFootprint: [number, number][];
    pendingRing: [number, number][] | null;
  } | null>(null);
  const [ifcPending, setIfcPending] = useState<{
    parsed: IfcImportResult;
    fileName: string;
  } | null>(null);
  const [ifcParsing, setIfcParsing] = useState(false);

  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());
  const [clipboardIds, setClipboardIds] = useState<Set<string> | null>(null);

  const handleMoveOpening = useCallback(
    (buildingId: string, opening: any, dx: number, dy: number, dz: number) => {
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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
  );

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
      const footprintWgs84 = footprintPolygonToWgs84(fp.polygon);
      pushUndo(`Reshape ${id}`);
      const { value: r } = runStructurallyGuardedMutation(cityjson, `Reshaping ${id}`, () =>
        regenerateBuilding(cityjson, id, footprintWgs84, overrides)
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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
  );

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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
  );

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
  }, [cityjson, clipboardIds, pushUndo, setDirtyIds, setReloadToken, setSelection, markGeometryChanged]);

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
      for (const id of deletedIds) next.add(id);
      return next;
    });
    setSelection(null);
    setMultiSelection(new Set());
    setReloadToken((t) => t + 1);
    markGeometryChanged();
  }, [cityjson, selection, multiSelection, pushUndo, setDirtyIds, setSelection, setReloadToken, markGeometryChanged]);

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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
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
    [cityjson, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]
  );

  const handleStartTransform = useCallback(
    (id: string) => {
      const initial: PendingTransform = { id, dx: 0, dy: 0, dz: 0, angle: 0, autoTerrain: true };
      setPendingTransform(cityjson ? snapTransformToTerrain(cityjson, initial) : initial);
    },
    [cityjson]
  );

  const handleUpdateTransform = useCallback(
    (patch: Partial<Omit<PendingTransform, 'id'>>) => {
      setPendingTransform((cur) => {
        if (!cur) return cur;
        let next: PendingTransform = { ...cur, ...patch };
        if ('dz' in patch && !('autoTerrain' in patch)) {
          next = { ...next, autoTerrain: false };
        }
        if (cityjson && next.autoTerrain) {
          next = snapTransformToTerrain(cityjson, next);
        }
        return next;
      });
    },
    [cityjson]
  );

  const handleCancelTransform = useCallback(() => {
    setPendingTransform(null);
  }, []);

  const handleSaveTransform = useCallback(() => {
    if (!cityjson || !pendingTransform) return;
    const { id, dx, dy, angle } = pendingTransform;
    const dz = pendingTransform.dz ?? 0;
    try {
      if (angle !== 0 || dx !== 0 || dy !== 0 || dz !== 0) {
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
  }, [cityjson, pendingTransform, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]);

  const handleStartFootprintEdit = useCallback(
    (id: string) => {
      if (!cityjson) return;
      const fps = extractFootprints(cityjson);
      const fp = fps.find((f) => f.id === id);
      if (!fp) {
        alert(`Could not extract footprint for building ${id}`);
        return;
      }
      const open = footprintPolygonToWgs84(fp.polygon);
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
  }, [cityjson, footprintEdit, pushUndo, undoRef, dirtyIds, selection, setDirtyIds, setReloadToken, setUndoVersion, markGeometryChanged]);

  const handleAdjustSplit = useCallback(
    (ringIndex: number, deltaZ: number) => {
      setSplitPreviewHeights((prev) => {
        if (!prev || ringIndex < 0 || ringIndex >= prev.length - 1) return prev;
        const lower = prev[ringIndex];
        const upper = prev[ringIndex + 1];
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

  const handleCreateBuilding = useCallback(
    (form: NewBuildingForm) => {
      if (!cityjson || !pendingFootprint) return;
      setCreationError(null);
      if (zoningEnabled && zones.length > 0) {
        const cx = pendingFootprint.reduce((a, v) => a + v[0], 0) / pendingFootprint.length;
        const cy = pendingFootprint.reduce((a, v) => a + v[1], 0) / pendingFootprint.length;
        const zone = findZoneForPoint(zones, [cx, cy]);
        const check = validateBuildingType(zone, form.function);
        if (!check.allowed) {
          setCreationError(`Planning layer conflict: ${check.reason}`);
          return;
        }
      }
      const crs = detectCrs(cityjson);
      if (!crs.supported) {
        setCreationError(`Can't generate: CRS ${crs.code} isn't supported. Add a proj4 definition first.`);
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
        setPendingFootprint(null);
        setPendingForm(null);
      } catch (e) {
        console.error(e);
        setCreationError(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [cityjson, pendingFootprint, pushUndo, zoningEnabled, zones, setDirtyIds, setReloadToken, setSelection, markGeometryChanged]
  );

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
        const { parseIfc } = await import('../lib/ifc-import');
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

  const handleIfcPlacement = useCallback(
    async (lngLat: [number, number]) => {
      if (!cityjson || !ifcPending) return;
      try {
        pushUndo(`Import IFC: ${ifcPending.fileName}`);
        const { convertIfcToCityJsonBuilding } = await import('../lib/ifc-to-cityjson');
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
    [cityjson, ifcPending, pushUndo, setDirtyIds, setSelection, setReloadToken, markGeometryChanged]
  );

  const handleCancelIfcPlacement = useCallback(() => {
    setIfcPending(null);
  }, []);

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

  const dragBaseRef = useRef<{ dx: number; dy: number } | null>(null);
  const handleDragMove = useCallback(
    (dx: number, dy: number) => {
      setPendingTransform((cur) => {
        if (!cur) return cur;
        if (!dragBaseRef.current) {
          dragBaseRef.current = { dx: cur.dx, dy: cur.dy };
        }
        const next = { ...cur, dx: dragBaseRef.current.dx + dx, dy: dragBaseRef.current.dy + dy };
        return cityjson && next.autoTerrain ? snapTransformToTerrain(cityjson, next) : next;
      });
    },
    [cityjson]
  );

  useEffect(() => {
    if (!pendingTransform) dragBaseRef.current = null;
  }, [pendingTransform]);

  return {
    pendingFootprint,
    setPendingFootprint,
    pendingForm,
    setPendingForm,
    creationError,
    setCreationError,
    footprintEdit,
    setFootprintEdit,
    pendingTransform,
    setPendingTransform,
    splitPreviewHeights,
    setSplitPreviewHeights,
    splitPreviewFloorPlans,
    setSplitPreviewFloorPlans,
    ifcPending,
    setIfcPending,
    ifcParsing,
    setIfcParsing,
    multiSelection,
    setMultiSelection,
    clipboardIds,
    setClipboardIds,
    handleMoveOpening,
    handleReshapeBuilding,
    handleMakeEditable,
    handleCopy,
    handlePaste,
    handleDelete,
    handleSplitByFloor,
    handleSplitByFloorHeights,
    handleSplitByFloorPlans,
    handleSplitBySide,
    handleStartTransform,
    handleUpdateTransform,
    handleCancelTransform,
    handleSaveTransform,
    handleStartFootprintEdit,
    handleFootprintChange,
    handleCancelFootprintEdit,
    handleSaveFootprintEdit,
    handleAdjustSplit,
    handleCreateBuilding,
    handleImportIfc,
    handleIfcPlacement,
    handleCancelIfcPlacement,
    handleDragMove,
  };
}

export type BuildingEditorState = ReturnType<typeof useBuildingEditor>;
