import { describe, expect, it } from 'vitest';
import { UndoStore } from '../../src/lib/undo';
import { buildSampleCube } from '../../src/lib/cityjson';

function snap(label: string, attr?: number) {
  const doc = buildSampleCube();
  if (attr !== undefined) {
    doc.CityObjects.Building_A.attributes!.measuredHeight = attr;
  }
  return {
    doc,
    label,
    dirtyIds: new Set<string>(),
    selectionId: null,
  };
}

describe('UndoStore', () => {
  it('starts empty: canUndo/canRedo both false', () => {
    const s = new UndoStore();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
    expect(s.undoCount).toBe(0);
    expect(s.redoCount).toBe(0);
  });

  it('push enables undo, undo returns the pushed snapshot', () => {
    const s = new UndoStore();
    s.push(snap('A', 10));
    expect(s.canUndo()).toBe(true);
    const popped = s.undo(snap('current', 99));
    expect(popped).not.toBeNull();
    expect(popped!.label).toBe('A');
    expect(popped!.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(10);
  });

  it('undo of nothing returns null and changes nothing', () => {
    const s = new UndoStore();
    const r = s.undo(snap('current'));
    expect(r).toBeNull();
    expect(s.canRedo()).toBe(false);
  });

  it('after undo, redo returns to the post-mutation state', () => {
    const s = new UndoStore();
    s.push(snap('before', 10));
    const popped = s.undo(snap('after', 20));
    expect(popped!.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(10);
    expect(s.canRedo()).toBe(true);

    const redone = s.redo(snap('current', 10));
    expect(redone!.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(20);
  });

  it('a new push after undo invalidates the redo stack', () => {
    const s = new UndoStore();
    s.push(snap('A', 10));
    s.undo(snap('B', 20));
    expect(s.canRedo()).toBe(true);
    s.push(snap('C', 30));
    expect(s.canRedo()).toBe(false);
  });

  it('respects maxDepth — oldest snapshots fall off the stack', () => {
    const s = new UndoStore(3);
    for (let i = 0; i < 5; i++) s.push(snap(`step${i}`, i));
    expect(s.undoCount).toBe(3);
    // The remaining 3 should be the most recent (steps 2, 3, 4).
    s.undo(snap('current', 99));
    expect(s.peekUndoLabel()).toBe('step3');
  });

  it('peekUndoLabel / peekRedoLabel reflect tooltip targets', () => {
    const s = new UndoStore();
    s.push(snap('Move building', 1));
    s.push(snap('Edit attribute', 2));
    expect(s.peekUndoLabel()).toBe('Edit attribute');
    expect(s.peekRedoLabel()).toBeUndefined();
    s.undo(snap('current', 99));
    expect(s.peekUndoLabel()).toBe('Move building');
    expect(s.peekRedoLabel()).toBe('Edit attribute');
  });

  it('clear() empties both stacks', () => {
    const s = new UndoStore();
    s.push(snap('A'));
    s.push(snap('B'));
    s.undo(snap('current'));
    expect(s.canUndo()).toBe(true);
    expect(s.canRedo()).toBe(true);
    s.clear();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
  });

  it('snapshots are deep-cloned — mutations after push do not bleed back', () => {
    const s = new UndoStore();
    const before = snap('A', 10);
    s.push(before);
    // Mutate the source snapshot AFTER pushing.
    before.doc.CityObjects.Building_A.attributes!.measuredHeight = 999;
    // Undo should see the captured value (10), not the post-push mutation.
    const popped = s.undo(snap('current', 5));
    expect(popped!.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(10);
  });

  it('undo restores the captured selectionId so the panel re-opens correctly', () => {
    const s = new UndoStore();
    s.push({ ...snap('A'), selectionId: 'Building_A' });
    const popped = s.undo({ ...snap('current'), selectionId: null });
    expect(popped!.selectionId).toBe('Building_A');
  });

  it('undo restores the captured dirtyIds set', () => {
    const s = new UndoStore();
    s.push({ ...snap('A'), dirtyIds: new Set(['Building_A']) });
    const popped = s.undo({ ...snap('current'), dirtyIds: new Set() });
    expect([...(popped!.dirtyIds ?? [])]).toEqual(['Building_A']);
  });
});
