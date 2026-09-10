import { useEffect, useState } from 'react';
import { Cloud, FolderPlus, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import type { SharedProjectsState } from '../hooks/useSharedProjects';
import type { ProjectRoadResetState } from '../hooks/useProjectRoadReset';

export default function SharedProjectsDialog({ open, onOpenChange, state, hasDocument, draftActive, fileName, roadReset }: {
  open: boolean; onOpenChange: (open: boolean) => void; state: SharedProjectsState; hasDocument: boolean; draftActive: boolean; fileName: string;
  roadReset?: ProjectRoadResetState;
}) {
  const [url, setUrl] = useState(state.serverUrl), [token, setToken] = useState('');
  const [workspaceName, setWorkspaceName] = useState(''), [projectName, setProjectName] = useState('');
  useEffect(() => { if (open) setProjectName(fileName.replace(/\.(city\.)?jsonl?$/i, '') || 'Street design'); }, [open, fileName]);
  useEffect(() => { if (!open) setToken(''); }, [open]);
  useEffect(() => { if (open && state.connected) void state.refresh(); }, [open, state.connected, state.refresh]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="shared-projects-dialog">
      <div className="shared-projects-heading"><Cloud size={25} /><div><DialogTitle>Projects</DialogTitle><DialogDescription>Project data and shared storage.</DialogDescription></div></div>
      <div className="shared-projects-body">
      {!state.connected ? <>
        <p className="shared-projects-intro">Connect your team's storage server to save and reopen projects. Until then, use <b>Save local</b> or <b>Export CityJSON</b> in More.</p>
        <form className="shared-projects-form" onSubmit={event => { event.preventDefault(); void state.connect(url, token).then(() => setToken('')); }}>
          <label>Server address<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://projects.example.com" autoComplete="url" /></label>
          <label>Access key<input type="password" required value={token} onChange={event => setToken(event.target.value)} placeholder="Provided by your server owner" autoComplete="off" /></label>
          <button type="submit" className="shared-primary" disabled={state.busy}>{state.busy ? 'Connecting…' : 'Connect storage'}</button>
        </form>
        <details className="shared-server-help"><summary>No server yet?</summary><p>The repository includes a Docker service with persistent storage. Its setup guide explains how to run it now and host it later.</p><a href="https://github.com/cakirmert/webcityeditor/blob/main/backend/README.md" target="_blank" rel="noreferrer">Open the backend setup guide ↗</a></details>
      </> : <>
        <div className="shared-connection"><span title={state.serverUrl}>Connected to {state.serverUrl}</span><button onClick={state.disconnect} disabled={state.busy || state.status === 'saving'}>Disconnect</button></div>
        {state.active && <div className={`shared-active is-${state.status}`}>
          <b>{state.active.name}</b><span>Revision {state.active.revision} · {state.status === 'saved' ? 'Saved to server' : state.status === 'saving' ? 'Saving…' : state.status === 'pending' ? 'Waiting to sync' : 'Needs attention'}</span>
          <p>Applied road and building changes save automatically. Wait for “Saved to server” before closing.</p>
          {(state.status === 'error' || state.status === 'pending') && <button onClick={() => void state.save()} disabled={state.busy}>Retry saving</button>}
          {(state.remoteRevision || state.status === 'conflict') && <div className="shared-conflict"><b>A newer version is available.</b><p>Open it, or keep your current work with “Save as new project” below.</p><button onClick={() => void state.openProject(state.active!)} disabled={state.busy || draftActive || state.status === 'saving'}>Open latest version</button></div>}
        </div>}
        <div className="shared-workspace-select"><label>Workspace<select aria-label="Shared workspace" value={state.workspaceId} onChange={event => state.setWorkspaceId(event.target.value)} disabled={state.busy}>
          {!state.workspaces.length && <option value="">Create your first workspace</option>}
          {state.workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label><button aria-label="Refresh projects" onClick={() => void state.refresh()} disabled={state.busy}><RefreshCw size={17} /></button></div>
        <details className="shared-new-workspace" open={!state.workspaces.length}>
          <summary><FolderPlus size={16} /> New workspace</summary>
          <form className="shared-inline-form" onSubmit={event => { event.preventDefault(); void state.createWorkspace(workspaceName).then(() => setWorkspaceName('')); }}><input aria-label="New workspace name" placeholder="e.g. Hamburg team" maxLength={120} required value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /><button disabled={state.busy || !workspaceName.trim()}>Create</button></form>
        </details>
        <div className="shared-project-list" aria-label="Saved projects">
          {!state.projects.length && <p>No saved projects in this workspace yet.</p>}
          {state.projects.map(project => <button key={project.id} disabled={state.busy || draftActive || state.status === 'saving'} onClick={() => void state.openProject(project)}><span><b>{project.name}</b><small>Revision {project.revision} · {new Date(project.updatedAt).toLocaleString()}</small></span><span>Open →</span></button>)}
        </div>
        <form className="shared-save-new" onSubmit={event => { event.preventDefault(); void state.createProject(projectName); }}>
          <label>Save current document as<input aria-label="New shared project name" value={projectName} maxLength={120} required onChange={event => setProjectName(event.target.value)} /></label>
          <button className="shared-primary" disabled={!hasDocument || !state.workspaceId || state.busy || draftActive || state.status === 'saving'}>Save as new project</button>
          {draftActive && <p>Apply or discard your current map draft first.</p>}
        </form>
      </>}
      <p className={`shared-status is-${state.status}`} role="status">{state.message}</p>
      {roadReset && <details className="project-road-reset"><summary>Reset project roads from OSM</summary>
        <p>This optional reset replaces <b>all roads, intersections, lane edits and turn restrictions in the loaded project</b> with a fresh OSM conversion. It uses the entire project area, regardless of map zoom. Buildings and other objects remain.</p>
        <p>Generation stays manual in the road editor. A reset starts over from OSM; it does not preserve your road designs. Review the replacement first. Resetting creates a local recovery copy and supports Undo. In a shared project, the replacement will sync to your team.</p>
        {draftActive && <p className="project-reset-notice">Save or discard all active and kept drafts before resetting.</p>}
        {!roadReset.preview && <button disabled={!hasDocument || draftActive || roadReset.busy || state.busy || state.status === 'saving'} onClick={() => void roadReset.prepare()}>{roadReset.busy ? 'Preparing replacement…' : 'Prepare project-wide reset'}</button>}
        {roadReset.preview && <div className="project-reset-preview"><b>{roadReset.preview.summary}</b>
          {roadReset.preview.notices.length > 0 && <details><summary>{roadReset.preview.notices.length} OSM conversion notices</summary><ul>{roadReset.preview.notices.map((notice, i) => <li key={i}>{notice}</li>)}</ul></details>}
          <button onClick={roadReset.downloadPreview}>Download replacement preview</button>
          <button className="project-reset-apply" disabled={draftActive || roadReset.busy || state.busy || state.status === 'saving'} onClick={() => void roadReset.apply()}>Reset all project roads</button>
        </div>}
        {(roadReset.preview || roadReset.busy) && <button disabled={roadReset.busy && !!roadReset.preview} onClick={roadReset.cancel}>Cancel reset</button>}
        {roadReset.message && <p className="project-reset-notice" role="status">{roadReset.message}</p>}
      </details>}
      </div>
    </DialogContent>
  </Dialog>;
}
