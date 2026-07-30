export interface AnimationFrameScheduler {
  request(callback: (timestamp: number) => void): number;
  cancel(frameId: number): void;
}

export interface AnimationFrameDragDeltaBatcher {
  isActive(): boolean;
  start(position: readonly [number, number]): boolean;
  move(position: readonly [number, number]): void;
  finish(): boolean;
  cancel(): boolean;
}

const browserAnimationFrames: AnimationFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (frameId) => window.cancelAnimationFrame(frameId),
};

/**
 * Turns absolute pointer positions into frame-coalesced incremental deltas.
 * `finish` synchronously flushes the last partial frame before notifying the
 * caller that the gesture ended.
 */
export function createAnimationFrameDragDeltaBatcher(
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void,
  scheduler: AnimationFrameScheduler = browserAnimationFrames
): AnimationFrameDragDeltaBatcher {
  let previousPosition: readonly [number, number] | null = null;
  let pendingDx = 0;
  let pendingDy = 0;
  let frameId: number | null = null;

  const flushPending = () => {
    const dx = pendingDx;
    const dy = pendingDy;
    pendingDx = 0;
    pendingDy = 0;
    if (dx !== 0 || dy !== 0) onMove(dx, dy);
  };

  const cancelScheduledFrame = () => {
    if (frameId === null) return;
    scheduler.cancel(frameId);
    frameId = null;
  };

  const scheduleFlush = () => {
    if (frameId !== null) return;
    frameId = scheduler.request(() => {
      frameId = null;
      flushPending();
    });
  };

  const cancel = () => {
    if (!previousPosition) return false;
    previousPosition = null;
    cancelScheduledFrame();
    pendingDx = 0;
    pendingDy = 0;
    return true;
  };

  return {
    isActive() {
      return previousPosition !== null;
    },

    start(position) {
      if (previousPosition) return false;
      previousPosition = [position[0], position[1]];
      pendingDx = 0;
      pendingDy = 0;
      return true;
    },

    move(position) {
      if (!previousPosition) return;
      const dx = position[0] - previousPosition[0];
      const dy = position[1] - previousPosition[1];
      previousPosition = [position[0], position[1]];
      if (dx === 0 && dy === 0) return;
      pendingDx += dx;
      pendingDy += dy;
      scheduleFlush();
    },

    finish() {
      if (!previousPosition) return false;
      previousPosition = null;
      cancelScheduledFrame();
      flushPending();
      onEnd?.();
      return true;
    },

    cancel,
  };
}
