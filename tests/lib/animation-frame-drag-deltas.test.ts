import { describe, expect, it, vi } from 'vitest';
import {
  createAnimationFrameDragDeltaBatcher,
  type AnimationFrameScheduler,
} from '../../src/lib/animation-frame-drag-deltas';

function fakeAnimationFrames() {
  let nextId = 1;
  const callbacks = new Map<number, (timestamp: number) => void>();
  const scheduler: AnimationFrameScheduler = {
    request(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(frameId) {
      callbacks.delete(frameId);
    },
  };
  return {
    scheduler,
    run(frameId: number) {
      const callback = callbacks.get(frameId);
      callbacks.delete(frameId);
      callback?.(16);
    },
    pendingIds() {
      return [...callbacks.keys()];
    },
  };
}

describe('animation-frame drag deltas', () => {
  it('coalesces absolute pointer positions into exact incremental frame deltas', () => {
    const frames = fakeAnimationFrames();
    const onMove = vi.fn();
    const drag = createAnimationFrameDragDeltaBatcher(
      onMove,
      undefined,
      frames.scheduler
    );

    expect(drag.start([100, 200])).toBe(true);
    drag.move([103, 198]);
    drag.move([108, 205]);

    expect(onMove).not.toHaveBeenCalled();
    expect(frames.pendingIds()).toEqual([1]);

    frames.run(1);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenLastCalledWith(8, 5);

    drag.move([110, 204]);
    frames.run(2);
    expect(onMove).toHaveBeenLastCalledWith(2, -1);
  });

  it('flushes the final partial frame before ending exactly once', () => {
    const frames = fakeAnimationFrames();
    const lifecycle: string[] = [];
    const drag = createAnimationFrameDragDeltaBatcher(
      (dx, dy) => lifecycle.push(`move:${dx},${dy}`),
      () => lifecycle.push('end'),
      frames.scheduler
    );

    drag.start([0, 0]);
    drag.move([4, 7]);

    expect(drag.finish()).toBe(true);
    expect(lifecycle).toEqual(['move:4,7', 'end']);
    expect(frames.pendingIds()).toEqual([]);
    expect(drag.finish()).toBe(false);
    expect(lifecycle).toEqual(['move:4,7', 'end']);
  });
});
