import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoreState } from '../../src/hooks/useCoreState';
import { useSharedProjects } from '../../src/hooks/useSharedProjects';
import { ProjectApiError } from '../../src/lib/project-storage';
import { saveDocument } from '../../src/lib/storage';
import type { CityJsonDocument } from '../../src/types';
const api = vi.hoisted(() => ({ listWorkspaces: vi.fn(), listProjects: vi.fn(), createWorkspace: vi.fn(), createProject: vi.fn(), openProject: vi.fn(), saveProject: vi.fn(), head: vi.fn() }));
vi.mock('../../src/lib/project-storage', async (original) => ({ ...await original<typeof import('../../src/lib/project-storage')>(), createProjectClient: () => api }));
vi.mock('../../src/lib/storage', () => ({ saveDocument: vi.fn(async () => {}) }));
const workspace = { id: 'workspace-1', name: 'Team', createdAt: '2026-09-07' };
const project = { id: 'project-1', workspaceId: workspace.id, name: 'Street', revision: 1, updatedAt: '2026-09-07' };
const document = (title = 'Original'): CityJsonDocument => ({ type: 'CityJSON', version: '2.0', CityObjects: {}, vertices: [], metadata: { title } });
function setup(onCreated?: () => void) {
  return renderHook(() => {
    const core = useCoreState();
    const shared = useSharedProjects(core, (doc, name) => { core.setCityjson(doc); core.setFileName(name); core.setDirtyIds(new Set()); }, false, onCreated);
    return { core, shared };
  });
}
async function connect(result: ReturnType<typeof setup>['result']) {
  await act(async () => { result.current.core.setCityjson(document()); await result.current.shared.connect('http://127.0.0.1:8789', 'test-key'); });
}
async function attached(result: ReturnType<typeof setup>['result']) { await connect(result); await act(async () => { await result.current.shared.createProject('Street'); }); }
function edit(result: ReturnType<typeof setup>['result'], title: string) {
  act(() => { result.current.core.cityjson!.metadata = { title }; result.current.core.setReloadToken(n => n + 1); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
  api.listWorkspaces.mockResolvedValue([workspace]); api.listProjects.mockResolvedValue([project]);
  api.createProject.mockResolvedValue(project); api.openProject.mockResolvedValue({ ...project, document: document('Server') });
  api.saveProject.mockImplementation(async (item) => ({ ...item, revision: item.revision + 1 })); api.head.mockResolvedValue(project);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('shared project lifecycle', () => {
  it('does not send current documents merely because storage was connected', async () => {
    const { result } = setup(); await connect(result); edit(result, 'Local edit');
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(api.createProject).not.toHaveBeenCalled(); expect(api.saveProject).not.toHaveBeenCalled();
  });
  it('autosaves applied in-place edits and keeps a local recovery copy', async () => {
    const { result } = setup(); await attached(result); edit(result, 'Applied road edit');
    expect(result.current.shared.status).toBe('pending');
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(api.saveProject.mock.calls[0][1].metadata.title).toBe('Applied road edit');
    expect(result.current.shared.active?.revision).toBe(2); expect(result.current.shared.status).toBe('saved');
    expect(saveDocument).toHaveBeenCalledWith(expect.stringContaining('Shared recovery'), expect.objectContaining({ metadata: { title: 'Applied road edit' } }));
  });
  it('sends a later edit after an in-flight save using the newly acknowledged revision', async () => {
    const { result } = setup(); await attached(result);
    let acknowledge!: (value: typeof project) => void;
    api.saveProject.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    edit(result, 'First'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    edit(result, 'Second'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(api.saveProject).toHaveBeenCalledTimes(1);
    await act(async () => { acknowledge({ ...project, revision: 2 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(api.saveProject).toHaveBeenCalledTimes(2);
    expect(api.saveProject.mock.calls[1][0].revision).toBe(2);
    expect(api.saveProject.mock.calls[1][1].metadata.title).toBe('Second');
    expect(result.current.shared.active?.revision).toBe(3);
  });
  it('retains local work and pauses automatic writes after a conflict', async () => {
    const { result } = setup(); await attached(result);
    api.saveProject.mockRejectedValue(new ProjectApiError('Someone saved a newer revision.', 409, 'revision_conflict'));
    edit(result, 'My work'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(result.current.shared.status).toBe('conflict');
    edit(result, 'More local work'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(api.saveProject).toHaveBeenCalledTimes(1);
    expect(result.current.core.cityjson?.metadata?.title).toBe('More local work');
  });
  it('retries the same mutation after a lost response before sending newer work', async () => {
    const { result } = setup(); await attached(result);
    api.saveProject.mockRejectedValueOnce(new Error('Network disconnected'));
    edit(result, 'My work'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(result.current.shared.status).toBe('error');
    const firstId = api.saveProject.mock.calls[0][2];
    await act(async () => { await result.current.shared.save(); });
    expect(api.saveProject.mock.calls[1][2]).toBe(firstId); expect(result.current.shared.status).toBe('saved');
  });
  it('ignores a save completion after the user detached the document', async () => {
    const { result } = setup(); await attached(result);
    let acknowledge!: (value: typeof project) => void;
    api.saveProject.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    edit(result, 'My work'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    act(() => result.current.shared.detach());
    await act(async () => { acknowledge({ ...project, revision: 2 }); });
    expect(result.current.shared.active).toBeNull(); expect(result.current.shared.status).toBe('ready');
  });
  it('opening a stored project does not immediately save it again', async () => {
    const { result } = setup(); await connect(result);
    await act(async () => { await result.current.shared.openProject(project); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(result.current.core.cityjson?.metadata?.title).toBe('Server'); expect(api.saveProject).not.toHaveBeenCalled();
  });
  it('replaces a definitively rejected snapshot when the document is corrected', async () => {
    const { result } = setup(); await attached(result);
    api.saveProject.mockRejectedValueOnce(new ProjectApiError('Invalid document.', 422, 'invalid_document'));
    edit(result, 'Invalid'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(result.current.shared.status).toBe('error');
    edit(result, 'Corrected'); await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(api.saveProject.mock.calls[1][1].metadata.title).toBe('Corrected');
    expect(api.saveProject.mock.calls[1][2]).not.toBe(api.saveProject.mock.calls[0][2]);
    expect(result.current.shared.status).toBe('saved');
  });
  it('freezes the streaming working area only after project creation succeeds', async () => {
    const freeze = vi.fn(), { result } = setup(freeze); await connect(result);
    api.createProject.mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { await result.current.shared.createProject('Street'); });
    expect(freeze).not.toHaveBeenCalled();
    await act(async () => { await result.current.shared.createProject('Street'); });
    expect(freeze).toHaveBeenCalledOnce();
    expect(result.current.core.cityjson?.metadata?.title).toBe('Original');
  });
});
