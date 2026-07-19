import type { RoadDraft } from './transportation';

export const MAX_ROAD_DRAFT_HISTORY = 40;
export const ROAD_DRAFT_HISTORY_COALESCE_MS = 650;

export interface RoadDraftHistorySnapshot {
  draft: RoadDraft | null;
  dirty: boolean;
  label?: string;
}

interface RecordOptions {
  label: string;
  group?: string;
  now?: number;
}

/**
 * Small, draft-only history used while a road is being shaped.
 *
 * It is intentionally separate from the CityJSON undo store: road controls
 * edit a preview draft first, and only the Save action mutates CityJSON.
 * Repeated pointer/slider updates in one gesture are coalesced so dragging a
 * curve anchor creates one useful undo step instead of dozens per second.
 */
export class RoadDraftHistory {
  private undoStack: RoadDraftHistorySnapshot[] = [];
  private redoStack: RoadDraftHistorySnapshot[] = [];
  private lastGroup: string | null = null;
  private lastRecordedAt = -Infinity;

  constructor(readonly maxDepth = MAX_ROAD_DRAFT_HISTORY) {}

  record(snapshot: RoadDraftHistorySnapshot, options: RecordOptions): void {
    const now = options.now ?? Date.now();
    const canCoalesce =
      !!options.group &&
      options.group === this.lastGroup &&
      now - this.lastRecordedAt <= ROAD_DRAFT_HISTORY_COALESCE_MS &&
      this.undoStack.length > 0;

    if (!canCoalesce) {
      this.undoStack.push(cloneSnapshot({ ...snapshot, label: options.label }));
      if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    }

    // Any newly recorded edit is a divergent timeline, even when it was
    // coalesced into the current drag/slider gesture.
    this.redoStack = [];
    this.lastGroup = options.group ?? null;
    this.lastRecordedAt = now;
  }

  undo(current: RoadDraftHistorySnapshot): RoadDraftHistorySnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(cloneSnapshot({ ...current, label: previous.label }));
    if (this.redoStack.length > this.maxDepth) this.redoStack.shift();
    this.endGesture();
    return cloneSnapshot(previous);
  }

  redo(current: RoadDraftHistorySnapshot): RoadDraftHistorySnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneSnapshot({ ...current, label: next.label }));
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    this.endGesture();
    return cloneSnapshot(next);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.endGesture();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  peekUndoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  peekRedoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label;
  }

  private endGesture(): void {
    this.lastGroup = null;
    this.lastRecordedAt = -Infinity;
  }
}

function cloneSnapshot(snapshot: RoadDraftHistorySnapshot): RoadDraftHistorySnapshot {
  if (typeof structuredClone === 'function') return structuredClone(snapshot);
  return JSON.parse(JSON.stringify(snapshot)) as RoadDraftHistorySnapshot;
}
