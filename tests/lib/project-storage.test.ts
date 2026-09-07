import { describe, expect, it, vi } from 'vitest';
import { createProjectClient, normalizeProjectServerUrl, ProjectApiError } from '../../src/lib/project-storage';
import type { CityJsonDocument } from '../../src/types';
const project = { id: '11111111-1111-4111-8111-111111111111', workspaceId: '22222222-2222-4222-8222-222222222222', revision: 3, name: 'Street', updatedAt: '2026-09-07T00:00:00Z' };
const document: CityJsonDocument = { type: 'CityJSON', version: '2.0', vertices: [], CityObjects: {} };
describe('replaceable shared project API', () => {
  it('requires HTTPS except loopback and keeps credentials out of the URL', () => {
    expect(normalizeProjectServerUrl(' https://storage.example/team/ ')).toBe('https://storage.example/team');
    expect(normalizeProjectServerUrl('http://127.0.0.1:8789')).toBe('http://127.0.0.1:8789');
    for (const url of ['http://storage.example', 'https://key@storage.example', 'https://storage.example?token=key', 'file:///data']) expect(() => normalizeProjectServerUrl(url)).toThrow();
  });
  it('sends the base revision and never follows a credential-bearing redirect', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...project, revision: 4 })));
    const client = createProjectClient({ url: 'https://storage.example/team', token: 'secret' }, fetcher);
    await client.saveProject(project, document, '33333333-3333-4333-8333-333333333333');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`https://storage.example/team/api/v1/workspaces/${project.workspaceId}/projects/${project.id}`);
    expect(options).toMatchObject({ method: 'PUT', redirect: 'error', credentials: 'omit', headers: { Authorization: 'Bearer secret', 'If-Match': '"3"' } });
    expect(JSON.parse(options.body).document).toEqual(document);
  });
  it('preserves revision conflicts for the UI to resolve', async () => {
    const client = createProjectClient({ url: 'https://storage.example', token: 'secret' }, vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'revision_conflict', message: 'Newer revision exists.' } }), { status: 409 })));
    await expect(client.saveProject(project, document, 'id')).rejects.toMatchObject({ status: 409, code: 'revision_conflict' });
  });
  it('does not upload structurally broken documents', async () => {
    const fetcher = vi.fn();
    const client = createProjectClient({ url: 'https://storage.example', token: 'secret' }, fetcher);
    expect(() => client.saveProject(project, { ...document, vertices: [[0, 0] as never] }, 'id')).toThrow(/structure/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports authentication failures without returning the key', async () => {
    const client = createProjectClient({ url: 'https://storage.example', token: 'secret' }, vi.fn().mockResolvedValue(new Response('no', { status: 401 })));
    await expect(client.listWorkspaces()).rejects.toBeInstanceOf(ProjectApiError);
  });
});
