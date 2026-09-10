import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useProjectRoadReset } from '../../src/hooks/useProjectRoadReset';
import { buildSampleCube } from '../../src/lib/cityjson';
import { createManualRoadDraft, insertRoadIntoCityJson } from '../../src/lib/transportation';
import type { CoreState } from '../../src/hooks/useCoreState';

const mocked = vi.hoisted(() => ({ prepare: vi.fn(), backup: vi.fn() }));
vi.mock('../../src/lib/project-osm-reset', () => ({ prepareFreshOsmRoads: mocked.prepare }));
vi.mock('../../src/lib/storage', () => ({ saveDocument: mocked.backup }));

function setup() {
  const original = buildSampleCube();
  insertRoadIntoCityJson(original, createManualRoadDraft([[4.3571, 52.0116], [4.358, 52.0116]]), { id: 'old' });
  const incoming = buildSampleCube(); incoming.CityObjects = {};
  insertRoadIntoCityJson(incoming, createManualRoadDraft([[4.3571, 52.0116], [4.358, 52.0117]]), { id: 'replacement' });
  mocked.prepare.mockResolvedValue({ document: incoming, source: 'test', summary: { roads: 1, intersections: 0 }, diagnostics: [] });
  const core = { cityjson: original, fileName: 'test', setDirtyIds: vi.fn(), setReloadToken: vi.fn(), setSelection: vi.fn(), markGeometryChanged: vi.fn() } as unknown as CoreState;
  const pushUndo = vi.fn(), applied = vi.fn();
  const hook = renderHook(({ draftActive }) => useProjectRoadReset(core, { pushUndo } as never, draftActive, applied), { initialProps: { draftActive: false } });
  return { ...hook, original, core, pushUndo, applied };
}

describe('project road reset lifecycle', () => {
  beforeEach(() => { mocked.prepare.mockReset(); mocked.backup.mockReset().mockResolvedValue(undefined); });
  it('keeps preparation separate, backs up first, then replaces once with Undo', async () => {
    const { result, original, pushUndo, applied } = setup(), before = JSON.stringify(original);
    await act(() => result.current.prepare());
    expect(JSON.stringify(original)).toBe(before); expect(result.current.preview?.removedIds).toEqual(['old']);
    await act(() => result.current.apply());
    expect(mocked.backup).toHaveBeenCalledWith(expect.stringContaining('Before road reset'), JSON.parse(before));
    expect(original.CityObjects.old).toBeUndefined(); expect(original.CityObjects.replacement).toBeDefined();
    expect(pushUndo).toHaveBeenCalledOnce(); expect(applied).toHaveBeenCalledOnce(); expect(result.current.preview).toBeNull();
  });
  it('does not reset if a recovery copy cannot be saved', async () => {
    const { result, original, pushUndo } = setup(), before = JSON.stringify(original);
    await act(() => result.current.prepare()); mocked.backup.mockRejectedValueOnce(new Error('Storage full'));
    await act(() => result.current.apply());
    expect(JSON.stringify(original)).toBe(before); expect(pushUndo).not.toHaveBeenCalled(); expect(result.current.message).toBe('Storage full');
  });
  it('rejects a stale prepared replacement and prevents resets with kept drafts', async () => {
    const { result, original, rerender } = setup();
    rerender({ draftActive: true }); await act(() => result.current.prepare()); expect(mocked.prepare).not.toHaveBeenCalled();
    rerender({ draftActive: false }); await act(() => result.current.prepare());
    original.CityObjects.old.attributes!.name = 'Changed after preparation';
    await act(() => result.current.apply());
    expect(original.CityObjects.old).toBeDefined(); expect(mocked.backup).not.toHaveBeenCalled(); expect(result.current.message).toMatch(/project changed/);
  });
  it('does not apply after a draft is started while the backup is pending', async () => {
    const { result, original, rerender, pushUndo } = setup(), before = JSON.stringify(original);
    await act(() => result.current.prepare());
    let finishBackup!: () => void; mocked.backup.mockReturnValueOnce(new Promise<void>(resolve => { finishBackup = resolve; }));
    let application!: Promise<void>; act(() => { application = result.current.apply(); });
    rerender({ draftActive: true }); await act(async () => { finishBackup(); await application; });
    expect(JSON.stringify(original)).toBe(before); expect(pushUndo).not.toHaveBeenCalled();
  });
});
