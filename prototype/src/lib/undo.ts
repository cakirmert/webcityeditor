import type { CityJsonDocument } from '../types';

/**
 * Snapshot-based undo / redo for in-memory CityJsonDocument edits.
 *
 * Strategy: deep-clone the entire doc with `structuredClone` before every
 * mutating operation. Cheap enough for the prototype (Hamburg-tile-scale
 * docs deep-clone in a few ms; cap of 30 snapshots = ~30 MB worst case),
 * and avoids the bookkeeping of a per-op delta history.
 *
 * The store is intentionally framework-agnostic — it's just a class with
 * push / undo / redo / canUndo / canRedo. App glues it to React state.
 */
export const MAX_UNDO_DEPTH = 30;

export interface UndoSnapshot {
  doc: CityJsonDocument;
  /** Optional human-readable label ("Move building", "Edit attribute") used
   *  by the toolbar tooltip ("Undo: Move building"). */
  label?: string;
  /** Optional dirty-id set captured at the time of the snapshot — restored
   *  on undo so the dirty bookkeeping stays consistent with the geometry. */
  dirtyIds?: Set<string>;
  /** Optional selection snapshot — restored on undo so the user lands back
   *  on whatever they were editing. */
  selectionId?: string | null;
}

export class UndoStore {
  private undoStack: UndoSnapshot[] = [];
  private redoStack: UndoSnapshot[] = [];

  /** Capacity cap. Older snapshots are dropped from the bottom of the undo
   *  stack when a new push exceeds this. */
  readonly maxDepth: number;

  constructor(maxDepth: number = MAX_UNDO_DEPTH) {
    this.maxDepth = maxDepth;
  }

  /**
   * Capture the current doc + selection + dirty state. Call this BEFORE the
   * mutation lands (so undo restores the pre-mutation state). New pushes
   * invalidate the redo stack — standard editor behaviour.
   */
  push(snapshot: UndoSnapshot): void {
    this.undoStack.push(deepClone(snapshot));
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    this.redoStack = [];
  }

  /**
   * Pop the most recent undo snapshot, push the caller's `current` state to
   * the redo stack (re-labelled with the popped snapshot's label so the
   * "Redo: <action>" tooltip shows the action being re-applied, not "current"),
   * and return the popped snapshot for application. Returns null if there's
   * nothing to undo.
   */
  undo(current: UndoSnapshot): UndoSnapshot | null {
    const popped = this.undoStack.pop();
    if (!popped) return null;
    // The redo entry represents "re-apply <whatever was just undone>", so its
    // label = the popped snapshot's label.
    const redoEntry = deepClone({ ...current, label: popped.label });
    this.redoStack.push(redoEntry);
    if (this.redoStack.length > this.maxDepth) this.redoStack.shift();
    return popped;
  }

  /** Pop the most recent redo, archive the caller's current state to the
   *  undo stack with the popped snapshot's label (so subsequent undo says
   *  "Undo: <action that was just redone>"). */
  redo(current: UndoSnapshot): UndoSnapshot | null {
    const popped = this.redoStack.pop();
    if (!popped) return null;
    const undoEntry = deepClone({ ...current, label: popped.label });
    this.undoStack.push(undoEntry);
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    return popped;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Read-only label of the next undo, for tooltips. */
  peekUndoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  peekRedoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label;
  }

  /** Drop all history — typically called when a fresh doc is loaded. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Aggregate sizes — useful for tests + progress displays. */
  get undoCount(): number {
    return this.undoStack.length;
  }
  get redoCount(): number {
    return this.redoStack.length;
  }
}

/** structuredClone shim — falls back to JSON for older runtimes. The
 *  prototype targets modern browsers, but the test environment may lag. */
function deepClone<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}
