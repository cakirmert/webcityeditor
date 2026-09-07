import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityJsonDocument } from '../types';
import type { CoreState } from './useCoreState';
import { createProjectClient, normalizeProjectServerUrl, ProjectApiError, type ProjectClient, type SharedProject, type SharedWorkspace } from '../lib/project-storage';
import { saveDocument } from '../lib/storage';

export type SharedSaveStatus = 'disconnected' | 'ready' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
interface Binding { project: SharedProject; saved: string; generation: number }
interface PendingSave { project: SharedProject; text: string; mutationId: string }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Shared storage is unavailable.';
export function useSharedProjects(core: CoreState, onLoad: (doc: CityJsonDocument, name: string) => void, draftActive: boolean, onCreated?: () => void) {
  const [serverUrl, setServerUrl] = useState(() => { try { return localStorage.getItem('city-editor-project-server') ?? ''; } catch { return ''; } });
  const [client, setClient] = useState<ProjectClient | null>(null);
  const [workspaces, setWorkspaces] = useState<SharedWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [active, setActive] = useState<SharedProject | null>(null);
  const [status, setStatus] = useState<SharedSaveStatus>('disconnected');
  const [message, setMessage] = useState('Connect a server to keep shared projects across devices.');
  const [busy, setBusy] = useState(false);
  const [remoteRevision, setRemoteRevision] = useState<number | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const binding = useRef<Binding | null>(null);
  const generation = useRef(0), saving = useRef(false), pending = useRef<PendingSave | null>(null);
  const creation = useRef<{ workspaceId: string; name: string; text: string; id: string } | null>(null);
  const blocked = useRef(false);
  const latest = useRef({ core, draftActive, onLoad, onCreated, client, workspaceId });
  latest.current = { core, draftActive, onLoad, onCreated, client, workspaceId };
  const backupQueue = useRef(Promise.resolve());
  const disconnect = useCallback(() => {
    generation.current++; binding.current = null; pending.current = null; creation.current = null; blocked.current = false;
    setActive(null); setClient(null); setProjects([]); setWorkspaces([]); setWorkspaceId(''); setRemoteRevision(null); setStatus('disconnected'); setMessage('Working in this browser.');
  }, []);
  const detach = useCallback(() => {
    generation.current++; binding.current = null; pending.current = null; blocked.current = false;
    setActive(null); setRemoteRevision(null); setStatus(client ? 'ready' : 'disconnected'); setMessage('Current document is not linked to a shared project.');
  }, [client]);
  const connect = async (url: string, token: string) => {
    if (binding.current && !window.confirm('Disconnect the current project and connect to another server? Pending work remains in this browser.')) return;
    setBusy(true);
    try {
      const next = createProjectClient({ url, token }), items = await next.listWorkspaces();
      generation.current++; binding.current = null; pending.current = null; blocked.current = false; creation.current = null;
      setActive(null); setRemoteRevision(null); setProjects([]); setClient(next); setWorkspaces(items); setWorkspaceId(items[0]?.id ?? '');
      const normalized = normalizeProjectServerUrl(url); setServerUrl(normalized);
      try { localStorage.setItem('city-editor-project-server', normalized); } catch { /* Address memory is optional. */ }
      setStatus('ready'); setMessage('Connected. Open a project or save the current document as a new project.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const refresh = useCallback(async () => {
    if (!client || !workspaceId) { setProjects([]); return; }
    const selected = workspaceId;
    try {
      const items = await client.listProjects(selected);
      if (latest.current.client === client && latest.current.workspaceId === selected) setProjects(items);
    } catch (error) {
      if (latest.current.client === client && latest.current.workspaceId === selected) setMessage(errorMessage(error));
    }
  }, [client, workspaceId]);
  useEffect(() => {
    let cancelled = false; setProjects([]);
    if (client && workspaceId) void client.listProjects(workspaceId).then(items => { if (!cancelled) setProjects(items); }).catch(error => { if (!cancelled) setMessage(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [client, workspaceId]);
  const createWorkspace = async (name: string) => {
    if (!client) return; setBusy(true);
    try { const item = await client.createWorkspace(name); setWorkspaces(items => [...items, item]); setWorkspaceId(item.id); }
    catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const attach = (project: SharedProject, text: string) => {
    generation.current++; binding.current = { project, saved: text, generation: generation.current }; pending.current = null; blocked.current = false;
    setActive(project); setRemoteRevision(null); setStatus('saved'); setMessage(`Saved to ${project.name} · revision ${project.revision}`);
  };
  const createProject = async (name: string) => {
    const doc = latest.current.core.cityjson;
    if (!client || !workspaceId || !doc || saving.current) return;
    if (latest.current.draftActive) { setMessage('Apply or discard the current map draft before saving a shared project.'); return; }
    setBusy(true); const currentGeneration = generation.current;
    try {
      const text = JSON.stringify(doc);
      if (!creation.current || creation.current.text !== text || creation.current.name !== name || creation.current.workspaceId !== workspaceId) creation.current = { workspaceId, name, text, id: crypto.randomUUID() };
      const result = await client.createProject(workspaceId, name, JSON.parse(text), creation.current.id);
      if (generation.current !== currentGeneration) return;
      latest.current.onCreated?.();
      attach(result, text); creation.current = null; setSaveTick(tick => tick + 1); await refresh();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const openProject = async (project: SharedProject) => {
    if (!client || saving.current) return;
    if (latest.current.draftActive) { setMessage('Apply or discard the current map draft before opening a project.'); return; }
    const doc = latest.current.core.cityjson;
    if (doc && (binding.current ? JSON.stringify(doc) !== binding.current.saved : latest.current.core.dirtyIds.size > 0) && !window.confirm('Open the server version and replace your current document? Save a new project or export first to keep your work.')) return;
    setBusy(true); const currentGeneration = generation.current;
    try {
      const result = await client.openProject(project.workspaceId, project.id);
      if (generation.current !== currentGeneration) return;
      latest.current.onLoad(result.document, result.name);
      attach(result, JSON.stringify(result.document));
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const save = useCallback(async () => {
    const bound = binding.current, doc = latest.current.core.cityjson;
    if (!client || !bound || !doc || saving.current || blocked.current) return;
    const text = JSON.stringify(doc);
    if (!pending.current && text === bound.saved) return;
    if (!pending.current) pending.current = { project: bound.project, text, mutationId: crypto.randomUUID() };
    const change = pending.current, currentGeneration = generation.current;
    saving.current = true; setStatus('saving'); setMessage('Saving shared project…');
    try {
      const result = await client.saveProject(change.project, JSON.parse(change.text), change.mutationId);
      if (currentGeneration !== generation.current) return;
      binding.current = { project: result, saved: change.text, generation: currentGeneration }; pending.current = null;
      setActive(result); setProjects(items => items.map(item => item.id === result.id ? result : item)); setStatus('saved'); setMessage(`Saved to ${result.name} · revision ${result.revision}`); setRemoteRevision(null); setSaveTick(tick => tick + 1);
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      const conflict = error instanceof ProjectApiError && error.status === 409;
      if (error instanceof ProjectApiError && [400, 413, 422].includes(error.status)) pending.current = null;
      blocked.current = conflict; setStatus(conflict ? 'conflict' : 'error');
      setMessage(conflict ? error.message : `Not synced. ${errorMessage(error)} Use Retry or export a copy.`);
    } finally { saving.current = false; }
  }, [client]);
  useEffect(() => {
    const bound = binding.current, doc = core.cityjson;
    if (!bound || !doc || !client) return;
    const text = JSON.stringify(doc);
    if (text === bound.saved && !pending.current) return;
    // Keep recovery writes ordered; an older write must not replace a newer snapshot.
    const recoveryName = `Shared recovery — ${bound.project.name} (${bound.project.id})`;
    backupQueue.current = backupQueue.current.catch(() => {}).then(() => saveDocument(recoveryName, JSON.parse(text))).catch(() => { /* The visible sync state still requires a server acknowledgement. */ });
    if (blocked.current) return;
    setStatus('pending'); setMessage('Changes waiting to sync…');
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [core.cityjson, core.dirtyIds, core.reloadToken, client, active?.id, saveTick, save]);
  useEffect(() => {
    const retry = () => void save(); window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [save]);
  useEffect(() => {
    if (!client || !active) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      const bound = binding.current; if (!bound || saving.current) return;
      void client.head(bound.project).then(head => { if (!cancelled && binding.current?.project.id === head.id && head.revision > (binding.current?.project.revision ?? Infinity)) setRemoteRevision(head.revision); }).catch(() => {});
    }, 20_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [client, active?.id]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const bound = binding.current, doc = latest.current.core.cityjson;
      if (bound && doc && (pending.current || JSON.stringify(doc) !== bound.saved)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  return { serverUrl, connected: !!client, workspaces, workspaceId, setWorkspaceId, projects, active, status, message, busy, remoteRevision,
    connect, disconnect, detach, createWorkspace, createProject, openProject, refresh, save };
}
export type SharedProjectsState = ReturnType<typeof useSharedProjects>;
