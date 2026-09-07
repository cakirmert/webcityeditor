import type { CityJsonDocument } from '../types';
import { checkIntegrity } from './integrity';

export interface ProjectConnection { url: string; token: string }
export interface SharedWorkspace { id: string; name: string; createdAt: string }
export interface SharedProject { id: string; workspaceId: string; name: string; revision: number; updatedAt: string }
export interface SharedProjectDocument extends SharedProject { document: CityJsonDocument }
export class ProjectApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = 'ProjectApiError'; }
}
export function normalizeProjectServerUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash) throw new Error('Use a server address without credentials, query parameters or a fragment.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Shared storage needs an HTTPS address. HTTP is available for localhost development.');
  return url.toString().replace(/\/+$/, '');
}
const id = (value: string) => {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid project or workspace id.');
  return value;
};
export function createProjectClient(connection: ProjectConnection, fetchImpl: typeof fetch = fetch) {
  const base = normalizeProjectServerUrl(connection.url);
  if (!connection.token.trim()) throw new Error('Enter the access key supplied by the server owner.');
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetchImpl(`${base}/api/v1/${path}`, {
      ...init, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(30_000),
      headers: { 'Authorization': `Bearer ${connection.token.trim()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ProjectApiError(body?.error?.message ?? `Storage request failed (${response.status}).`, response.status, body?.error?.code ?? 'request_failed');
    if (!body) throw new Error('The server did not return project data. Check its address.');
    return body as T;
  };
  const projectPath = (workspaceId: string, projectId: string) => `workspaces/${id(workspaceId)}/projects/${id(projectId)}`;
  const checked = (document: CityJsonDocument) => {
    try {
      const report = checkIntegrity(document);
      if (!report.ok) throw new Error(report.issues.find(issue => issue.severity === 'error')?.message ?? 'Invalid CityJSON.');
    } catch (error) {
      throw new ProjectApiError(`Resolve the document structure error before sharing: ${error instanceof Error ? error.message : 'Invalid CityJSON.'}`, 422, 'invalid_document');
    }
    return document;
  };
  return {
    listWorkspaces: () => request<{ workspaces: SharedWorkspace[] }>('workspaces').then(result => result.workspaces),
    createWorkspace: (name: string) => request<SharedWorkspace>('workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
    listProjects: (workspaceId: string) => request<{ projects: SharedProject[] }>(`workspaces/${id(workspaceId)}/projects`).then(result => result.projects),
    openProject: async (workspaceId: string, projectId: string) => {
      const result = await request<SharedProjectDocument>(projectPath(workspaceId, projectId));
      checked(result.document); return result;
    },
    head: (project: SharedProject) => request<SharedProject>(`${projectPath(project.workspaceId, project.id)}/head`),
    createProject: (workspaceId: string, name: string, document: CityJsonDocument, mutationId: string) => request<SharedProject>(`workspaces/${id(workspaceId)}/projects`, { method: 'POST', body: JSON.stringify({ name, document: checked(document), mutationId }) }),
    saveProject: (project: SharedProject, document: CityJsonDocument, mutationId: string) => request<SharedProject>(projectPath(project.workspaceId, project.id), { method: 'PUT', headers: { 'If-Match': `"${project.revision}"` }, body: JSON.stringify({ document: checked(document), mutationId }) }),
  };
}
export type ProjectClient = ReturnType<typeof createProjectClient>;
