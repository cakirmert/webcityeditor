import { describe, expect, it } from 'vitest';
import { RoadDraftHistory } from '../../src/lib/road-draft-history';
import { createManualRoadDraft, type RoadDraft } from '../../src/lib/transportation';

const line: [number, number][] = [
  [10, 53],
  [10.001, 53.001],
];

describe('RoadDraftHistory', () => {
  it('undoes and redoes a road draft without losing the forward step', () => {
    const history = new RoadDraftHistory();
    const original = createManualRoadDraft(line);
    const changed = withWidth(original, 4);

    history.record({ draft: original, dirty: false }, { label: 'Change lane width' });
    const undone = history.undo({ draft: changed, dirty: true });

    expect(undone?.draft?.sections[0].bands[0].widthM).toBe(
      original.sections[0].bands[0].widthM
    );
    expect(undone?.dirty).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(history.peekRedoLabel()).toBe('Change lane width');

    const redone = history.redo(undone!);
    expect(redone?.draft?.sections[0].bands[0].widthM).toBe(4);
    expect(redone?.dirty).toBe(true);
  });

  it('keeps only the pre-gesture state for rapid updates in one group', () => {
    const history = new RoadDraftHistory();
    const original = createManualRoadDraft(line);
    const first = withWidth(original, 3.5);
    const second = withWidth(original, 4);

    history.record(
      { draft: original, dirty: false },
      { label: 'Shape road', group: 'shape', now: 100 }
    );
    history.record(
      { draft: first, dirty: true },
      { label: 'Shape road', group: 'shape', now: 200 }
    );

    const undone = history.undo({ draft: second, dirty: true });
    expect(undone?.draft?.sections[0].bands[0].widthM).toBe(
      original.sections[0].bands[0].widthM
    );
    expect(history.canUndo()).toBe(false);
  });

  it('clears redo only after a new divergent edit', () => {
    const history = new RoadDraftHistory();
    const original = createManualRoadDraft(line);
    const changed = withWidth(original, 4);

    history.record({ draft: original, dirty: false }, { label: 'Change width' });
    const undone = history.undo({ draft: changed, dirty: true });
    expect(history.canRedo()).toBe(true);

    history.record({ draft: undone?.draft ?? null, dirty: false }, { label: 'Change direction' });
    expect(history.canRedo()).toBe(false);
  });

  it('can restore a newly drawn road after undo returns to an empty draft', () => {
    const history = new RoadDraftHistory();
    const newRoad = createManualRoadDraft(line);

    history.record({ draft: null, dirty: false }, { label: 'Draw new road' });
    const undone = history.undo({ draft: newRoad, dirty: true });
    expect(undone?.draft).toBeNull();
    expect(history.canRedo()).toBe(true);

    expect(history.redo(undone!)?.draft).toEqual(newRoad);
  });
});

function withWidth(draft: RoadDraft, widthM: number): RoadDraft {
  const next = structuredClone(draft);
  next.sections[0].bands[0].widthM = widthM;
  return next;
}
