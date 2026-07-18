import { useState, useRef, useMemo, useCallback } from 'react';
import { UndoStore } from '../lib/undo';
import type { CoreState } from './useCoreState';

export function useUndoRedo(coreState: CoreState) {
  const {
    cityjson,
    setCityjson,
    selection,
    setSelection,
    dirtyIds,
    setDirtyIds,
    setReloadToken,
    markGeometryChanged,
  } = coreState;

  const undoRef = useRef<UndoStore>(new UndoStore());
  const [undoVersion, setUndoVersion] = useState(0);

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
  }, [cityjson, dirtyIds, selection, setCityjson, setDirtyIds, setSelection, setReloadToken, markGeometryChanged]);

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
  }, [cityjson, dirtyIds, selection, setCityjson, setDirtyIds, setSelection, setReloadToken, markGeometryChanged]);

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
  }, [cityjson, undoVersion, handleUndo, handleRedo]);

  return {
    undoRef,
    undoVersion,
    setUndoVersion,
    pushUndo,
    handleUndo,
    handleRedo,
    undoState,
  };
}

export type UndoRedoState = ReturnType<typeof useUndoRedo>;
