import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createProjectServer } from './server.mjs';

const token = 'test-only-access-key-with-at-least-32-characters';
const directory = mkdtempSync(join(tmpdir(), 'city-editor-projects-'));
const sample = (name = 'Original') => ({ type: 'CityJSON', version: '2.0', CityObjects: {}, vertices: [], metadata: { title: name } });
let server, base;
async function start() {
  ({ server } = createProjectServer({ dataDir: directory, token, allowedOrigins: ['https://editor.example'], maxBodyBytes: 4096, historyLimit: 3 }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() { const closed = once(server, 'close'); server.close(); server.closeIdleConnections(); await closed; }
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  return { status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() };
}
async function workspace(name = 'Team') { return (await request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify({ name }) })).data; }
async function create(wid, document = sample(), mutationId = randomUUID()) { return request(`/api/v1/workspaces/${wid}/projects`, { method: 'POST', body: JSON.stringify({ name: 'Street design', document, mutationId }) }); }
const projectPath = (project) => `/api/v1/workspaces/${project.workspaceId}/projects/${project.id}`;
async function save(project, revision, document, mutationId = randomUUID()) { return request(projectPath(project), { method: 'PUT', headers: { 'If-Match': `"${revision}"` }, body: JSON.stringify({ document, mutationId }) }); }
before(start);
after(async () => { await stop(); rmSync(directory, { recursive: true, force: true }); });

test('requires a configured nontrivial key', () => assert.throws(() => createProjectServer({ dataDir: directory, token: '' }), /PROJECTS_TOKEN/));
test('health is public but project data requires authentication', async () => {
  assert.equal((await request('/health', { headers: { Authorization: '' } })).status, 200);
  assert.equal((await request('/api/v1/workspaces', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
});
test('uses exact CORS origins and permits authenticated browser preflight', async () => {
  assert.equal((await request('/api/v1/workspaces', { headers: { Origin: 'https://editor.example.evil' } })).status, 403);
  const result = await request('/api/v1/workspaces', { method: 'OPTIONS', headers: { Authorization: '', Origin: 'https://editor.example' } });
  assert.equal(result.status, 204); assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://editor.example');
});
test('namespaces projects and preserves arbitrary CityJSON attributes on reopen', async () => {
  const a = await workspace('Hamburg'), b = await workspace('Alternative');
  const document = { ...sample(), metadata: { custom: { curve: [1, 2, 3] } } };
  const result = await create(a.id, document); assert.equal(result.status, 201);
  assert.equal((await request(`/api/v1/workspaces/${b.id}/projects/${result.data.id}`)).status, 404);
  assert.deepEqual((await request(projectPath(result.data))).data.document, document);
  assert.equal((await request(`/api/v1/workspaces/${b.id}/projects`)).data.projects.length, 0);
});
test('does not lose project data across a server restart', async () => {
  const w = await workspace(), p = (await create(w.id)).data;
  await save(p, 1, sample('Saved after editing'));
  await stop(); await start();
  const reopened = await request(projectPath(p));
  assert.equal(reopened.data.revision, 2); assert.equal(reopened.data.document.metadata.title, 'Saved after editing');
});
test('concurrent writers cannot silently overwrite each other', async () => {
  const w = await workspace(), p = (await create(w.id)).data;
  const responses = await Promise.all([save(p, 1, sample('Writer A')), save(p, 1, sample('Writer B'))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(responses.find(r => r.status === 409).data.error.code, 'revision_conflict');
  assert.equal((await request(projectPath(p))).data.revision, 2);
});
test('rejects writes without a base revision, oversized bodies and invalid documents', async () => {
  const w = await workspace(), p = (await create(w.id)).data;
  assert.equal((await request(projectPath(p), { method: 'PUT', body: JSON.stringify({ document: sample(), mutationId: randomUUID() }) })).status, 428);
  assert.equal((await save(p, 1, { ...sample(), vertices: [[0, 0]] })).status, 422);
  assert.equal((await save(p, 1, sample('x'.repeat(5000)))).status, 413);
  assert.equal((await request(projectPath(p))).data.revision, 1);
});
test('retains bounded revision history and supports reading an older revision', async () => {
  const w = await workspace(), p = (await create(w.id)).data;
  for (let revision = 1; revision <= 4; revision++) assert.equal((await save(p, revision, sample(`Edit ${revision}`))).status, 200);
  const history = await request(`${projectPath(p)}/revisions`);
  assert.deepEqual(history.data.revisions.map(row => row.revision), [5, 4, 3]);
  assert.equal((await request(`${projectPath(p)}/revisions/3`)).data.document.metadata.title, 'Edit 2');
  assert.equal((await request(`${projectPath(p)}/revisions/1`)).status, 404);
});
test('retried creates and saves are idempotent after a lost response', async () => {
  const w = await workspace(), createId = randomUUID();
  const first = await create(w.id, sample(), createId), second = await create(w.id, sample(), createId);
  assert.equal(first.data.id, second.data.id);
  const mutation = randomUUID(), p = first.data;
  await save(p, 1, sample('Edit'), mutation);
  assert.equal((await save(p, 1, sample('Edit'), mutation)).data.revision, 2);
  await save(p, 2, sample('Other editor'));
  assert.equal((await save(p, 1, sample('Edit'), mutation)).status, 409);
});
test('route identifiers cannot escape their workspace namespace', async () => {
  assert.equal((await request('/api/v1/workspaces/not-a-uuid/projects')).status, 404);
  assert.equal((await request('/api/v1/workspaces/%2e%2e%2f/projects')).status, 404);
  assert.equal((await request('/api/v1/workspaces', { method: 'POST', body: 'not json' })).status, 400);
});

test('rejects mutation-id reuse with a different document', async () => {
  const w = await workspace(), mutation = randomUUID();
  const p = (await create(w.id, sample(), mutation)).data;
  assert.equal((await create(w.id, sample('Different'), mutation)).status, 409);
  const updateId = randomUUID();
  await save(p, 1, sample('First save'), updateId);
  assert.equal((await save(p, 1, sample('Changed retry'), updateId)).status, 409);
  assert.equal((await request(projectPath(p))).data.document.metadata.title, 'First save');
});
