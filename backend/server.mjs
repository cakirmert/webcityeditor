import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { checkIntegrity } from '../src/lib/integrity.ts';

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status, message, code = 'request_failed') => Object.assign(new Error(message), { status, code });
const nameOf = (name) => {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw fail(422, 'Choose a name between 1 and 120 characters.');
  return name.trim();
};
const validateDocument = (document) => {
  try {
    if (!document || document.type !== 'CityJSON' || !Array.isArray(document.vertices) || !document.CityObjects || typeof document.CityObjects !== 'object' || Array.isArray(document.CityObjects)) throw new Error('Expected a CityJSON document.');
    const result = checkIntegrity(document);
    if (!result.ok) throw new Error(result.issues.find(issue => issue.severity === 'error')?.message ?? 'Invalid CityJSON structure.');
  } catch (error) { throw fail(422, `Document was not saved: ${error.message}`, 'invalid_document'); }
  return JSON.stringify(document);
};

/** Storage stays behind this interface so a later database service can replace SQLite. */
export function createProjectStore(dataDir, historyLimit = 20) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'projects.sqlite'), { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, revision INTEGER NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions (projectId TEXT NOT NULL REFERENCES projects(id), revision INTEGER NOT NULL, document TEXT NOT NULL, updatedAt TEXT NOT NULL, mutationId TEXT NOT NULL, PRIMARY KEY(projectId, revision), UNIQUE(projectId, mutationId));
    PRAGMA user_version=1;`);
  const transaction = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const workspace = (id) => {
    const found = db.prepare('SELECT * FROM workspaces WHERE id=?').get(id);
    if (!found) throw fail(404, 'Workspace not found.');
    return found;
  };
  const head = (workspaceId, id) => {
    const found = db.prepare('SELECT * FROM projects WHERE workspaceId=? AND id=?').get(workspaceId, id);
    if (!found) throw fail(404, 'Project not found in this workspace.');
    return found;
  };
  return {
    close: () => db.close(),
    listWorkspaces: () => db.prepare('SELECT * FROM workspaces ORDER BY name, id').all(),
    createWorkspace: (name) => {
      const row = { id: randomUUID(), name: nameOf(name), createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO workspaces VALUES (?,?,?)').run(row.id, row.name, row.createdAt);
      return row;
    },
    listProjects: (workspaceId) => { workspace(workspaceId); return db.prepare('SELECT * FROM projects WHERE workspaceId=? ORDER BY updatedAt DESC, id').all(workspaceId); },
    head,
    get: (workspaceId, id, revision) => {
      const row = head(workspaceId, id);
      const snapshot = db.prepare('SELECT * FROM revisions WHERE projectId=? AND revision=?').get(id, revision ?? row.revision);
      if (!snapshot) throw fail(404, 'This revision is no longer retained.');
      return { ...row, revision: snapshot.revision, updatedAt: snapshot.updatedAt, document: JSON.parse(snapshot.document) };
    },
    history: (workspaceId, id) => { head(workspaceId, id); return db.prepare('SELECT revision, updatedAt FROM revisions WHERE projectId=? ORDER BY revision DESC').all(id); },
    create: (workspaceId, name, document, mutationId) => {
      const text = validateDocument(document), title = nameOf(name);
      return transaction(() => {
        workspace(workspaceId);
        // A retried creation keeps the same client-generated id; never create duplicates.
        const prior = db.prepare('SELECT * FROM projects WHERE id=?').get(mutationId);
        if (prior) {
          if (prior.workspaceId !== workspaceId || prior.revision !== 1 || prior.name !== title || db.prepare('SELECT document FROM revisions WHERE projectId=? AND revision=1').get(prior.id)?.document !== text) throw fail(409, 'A retried creation must match its original document. Open the existing project or create a new copy.', 'idempotency_conflict');
          return prior;
        }
        const row = { id: mutationId, workspaceId, name: title, revision: 1, updatedAt: new Date().toISOString() };
        db.prepare('INSERT INTO projects VALUES (?,?,?,?,?)').run(row.id, workspaceId, title, 1, row.updatedAt);
        db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?)').run(row.id, 1, text, row.updatedAt, mutationId);
        return row;
      });
    },
    save: (workspaceId, id, expectedRevision, document, mutationId) => {
      const text = validateDocument(document);
      return transaction(() => {
        const current = head(workspaceId, id);
        const prior = db.prepare('SELECT revision, document FROM revisions WHERE projectId=? AND mutationId=?').get(id, mutationId);
        if (prior) {
          if (prior.document !== text) throw fail(409, 'A retried save must match its original document.', 'idempotency_conflict');
          // The previous response may have been lost. Do not claim newer edits as our baseline.
          if (prior.revision !== current.revision) throw fail(409, 'Someone saved a newer revision. Reload it or save your work as a new project.', 'revision_conflict');
          return current;
        }
        if (expectedRevision !== current.revision) throw fail(409, 'Someone saved a newer revision. Reload it or save your work as a new project.', 'revision_conflict');
        const row = { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString() };
        db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?)').run(id, row.revision, text, row.updatedAt, mutationId);
        db.prepare('UPDATE projects SET revision=?,updatedAt=? WHERE id=?').run(row.revision, row.updatedAt, id);
        db.prepare('DELETE FROM revisions WHERE projectId=? AND revision<=?').run(id, row.revision - historyLimit);
        return row;
      });
    },
  };
}

function readBody(request, limit) {
  return new Promise((resolveBody, reject) => {
    let size = 0, finished = false;
    const chunks = [];
    const stop = (error) => { if (!finished) { finished = true; reject(error); } };
    request.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > limit) { chunks.length = 0; stop(fail(413, 'This project exceeds the server document-size limit.')); }
      else chunks.push(chunk);
    });
    request.on('error', () => stop(fail(400, 'Request was interrupted.')));
    request.on('end', () => {
      if (finished) return;
      finished = true;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(fail(400, 'Request must contain valid JSON.')); }
    });
  });
}

export function createProjectServer({ dataDir, token, allowedOrigins = [], maxBodyBytes = 64 * 1024 * 1024, historyLimit = 20 }) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('PROJECTS_TOKEN must contain at least 32 characters. Generate one with npm run backend:key.');
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1024 || !Number.isSafeInteger(historyLimit) || historyLimit < 1) throw new Error('Invalid storage limits.');
  const origins = new Set(allowedOrigins.map(origin => {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Allowed origins must be exact HTTP(S) origins without paths.');
    return origin;
  }));
  const secretHash = createHash('sha256').update(token).digest();
  const store = createProjectStore(dataDir, historyLimit);
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { response.writeHead(status); response.end(body === undefined ? undefined : JSON.stringify(body)); };
    try {
      const origin = request.headers.origin;
      if (origin && !origins.has(origin)) throw fail(403, 'This editor origin is not allowed.');
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      response.setHeader('Access-Control-Expose-Headers', 'ETag');
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match');
        send(204); return;
      }
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path === '/health' && request.method === 'GET') { send(200, { ok: true, service: 'city-editor-projects', apiVersion: 1 }); return; }
      const credential = request.headers.authorization;
      if (!credential?.startsWith('Bearer ') || !timingSafeEqual(secretHash, createHash('sha256').update(credential.slice(7)).digest())) throw fail(401, 'Enter a valid workspace access key.', 'unauthorized');
      if (!path.startsWith('/api/v1/')) throw fail(404, 'API route not found.');
      const parts = path.slice(8).split('/');
      if (parts[0] !== 'workspaces' || parts.length > 6) throw fail(404, 'API route not found.');
      const [_, workspaceId, resource, projectId, action, revision] = parts;
      if ((workspaceId && !idPattern.test(workspaceId)) || (projectId && !idPattern.test(projectId))) throw fail(404, 'Project or workspace not found.');
      let body;
      if (['POST', 'PUT'].includes(request.method)) {
        if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw fail(415, 'Use application/json.');
        body = await readBody(request, maxBodyBytes);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Expected a JSON object.');
      }
      if (parts.length === 1) {
        if (request.method === 'GET') { send(200, { workspaces: store.listWorkspaces() }); return; }
        if (request.method === 'POST') { send(201, store.createWorkspace(body.name)); return; }
      }
      if (resource !== 'projects') throw fail(404, 'API route not found.');
      if (parts.length === 3) {
        if (request.method === 'GET') { send(200, { projects: store.listProjects(workspaceId) }); return; }
        if (request.method === 'POST') {
          if (!idPattern.test(body.mutationId ?? '')) throw fail(422, 'A UUID mutationId is required.');
          send(201, store.create(workspaceId, body.name, body.document, body.mutationId)); return;
        }
      }
      if (parts.length === 4 && request.method === 'PUT') {
        const match = /^"([1-9]\d*)"$/.exec(request.headers['if-match'] ?? '');
        if (!match) throw fail(428, 'Save requires the revision you opened (If-Match).');
        if (!idPattern.test(body.mutationId ?? '')) throw fail(422, 'A UUID mutationId is required.');
        const result = store.save(workspaceId, projectId, Number(match[1]), body.document, body.mutationId);
        response.setHeader('ETag', `"${result.revision}"`); send(200, result); return;
      }
      if (request.method === 'GET' && projectId) {
        let result;
        if (parts.length === 4) result = store.get(workspaceId, projectId);
        else if (parts.length === 5 && action === 'head') result = store.head(workspaceId, projectId);
        else if (action === 'revisions' && parts.length === 5) { send(200, { revisions: store.history(workspaceId, projectId) }); return; }
        else if (action === 'revisions' && parts.length === 6 && /^[1-9]\d*$/.test(revision)) result = store.get(workspaceId, projectId, Number(revision));
        else throw fail(404, 'API route not found.');
        response.setHeader('ETag', `"${result.revision}"`); send(200, result); return;
      }
      throw fail(405, 'Method is not supported for this route.');
    } catch (error) {
      if (!error.status) console.error('Project storage request failed:', error.message);
      if (!response.headersSent) send(error.status ?? 500, { error: { code: error.code ?? 'storage_error', message: error.status ? error.message : 'Storage is unavailable. Your local work has not been replaced.' } });
      else response.end();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.on('close', () => store.close());
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server } = createProjectServer({
    dataDir: resolve(process.env.PROJECTS_DATA_DIR ?? '.projects-data'),
    token: process.env.PROJECTS_TOKEN,
    allowedOrigins: (process.env.PROJECTS_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').filter(Boolean),
    maxBodyBytes: Number(process.env.PROJECTS_MAX_BYTES ?? 64 * 1024 * 1024),
    historyLimit: Number(process.env.PROJECTS_HISTORY_LIMIT ?? 20),
  });
  server.listen(Number(process.env.PORT ?? 8789), process.env.HOST ?? '127.0.0.1', () => console.log(`City Editor project storage listening on port ${server.address().port}`));
  const shutdown = () => { server.close(); server.closeIdleConnections(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
