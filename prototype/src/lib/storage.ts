import type { CityJsonDocument } from '../types';

/**
 * Client-side persistence mock.
 *
 * The approval doc specifies a Fastify + 3DCityDB + pg2b3dm backend that owns
 * persistence. Until that tier exists, we mock it with IndexedDB so the
 * save/reopen end-to-end loop works for real from the user's perspective:
 *
 *   Edit → Save → close browser → reopen → Continue → edits are back.
 *
 * This is **NOT** a substitute for the real backend — there is no multi-user
 * write, no server-side validation, no tile regeneration trigger. It is a
 * faithful UX stand-in for the single-user prototype only.
 *
 * Data model: one object store "documents" keyed by file name, storing a JSON
 * blob and a timestamp.
 */

const DB_NAME = 'city-editor';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

interface StoredDocument {
  name: string;
  savedAt: number;
  doc: CityJsonDocument;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocument(name: string, doc: CityJsonDocument): Promise<void> {
  const db = await openDb();
  const record: StoredDocument = { name, savedAt: Date.now(), doc };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadDocument(name: string): Promise<StoredDocument | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(name);
    req.onsuccess = () => {
      db.close();
      resolve((req.result ?? null) as StoredDocument | null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function listDocuments(): Promise<Omit<StoredDocument, 'doc'>[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result ?? []) as StoredDocument[];
      resolve(
        all
          .map(({ name, savedAt }) => ({ name, savedAt }))
          .sort((a, b) => b.savedAt - a.savedAt)
      );
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteDocument(name: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(name);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
