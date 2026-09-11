import {
  BRIDGE_PROTOCOL, EditorError, isBridgeMessage,
  type BridgeMessage, type EditorHandle, type EditorOptions, type EditorSelection, type EditorState,
} from './protocol.js';
import type { CityJsonDocument } from '../types-cityjson.js';

export { EditorError } from './protocol.js';
export type { EditorHandle, EditorOptions, EditorSelection, EditorState, LoadDocumentOptions } from './protocol.js';
export type { CityJsonDocument, CityObject } from '../types-cityjson.js';

/** Mount an isolated editor without changing host styles or keyboard handlers. */
export function createEditor(container: HTMLElement, options: EditorOptions): EditorHandle {
  const host = container.ownerDocument.defaultView;
  if (!host || host.location.origin === 'null') throw new EditorError('origin', 'Serve the host page over HTTP(S).');
  const url = new URL(options.editorUrl, host.location.href);
  if (!['https:', 'http:'].includes(url.protocol)) throw new EditorError('url', 'editorUrl must use HTTP(S).');
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new EditorError('timeout', 'timeoutMs must be positive.');
  const channel = Array.from(host.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  url.searchParams.set('wce-embed', channel);
  url.searchParams.set('wce-parent', host.location.origin);
  const iframe = container.ownerDocument.createElement('iframe');
  iframe.title = options.title ?? 'WebCityEditor';
  iframe.style.cssText = 'display:block;width:100%;height:100%;border:0';
  iframe.src = url.href;
  let destroyed = false;
  let connected = false;
  let failed: Error | null = null;
  let sequence = 0;
  let ping: ReturnType<typeof setInterval> | undefined;
  const pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Callers can await ready or receive onError without an unhandled rejection.
  void ready.catch(() => {});

  const report = (error: Error) => { options.onError?.(error); };
  const stopHandshake = () => { clearInterval(ping); clearTimeout(readyTimer); };
  const fail = (error: Error) => {
    failed = error;
    stopHandshake();
    rejectReady(error);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
    report(error);
  };
  const readyTimer = setTimeout(() => fail(new EditorError('timeout', 'The editor did not become ready in time. Check editorUrl and its assets.')), timeoutMs);
  const post = (message: Omit<BridgeMessage, 'protocol' | 'channel'>) => {
    iframe.contentWindow?.postMessage({ ...message, protocol: BRIDGE_PROTOCOL, channel }, url.origin);
  };
  const request = <T>(method: string, payload?: unknown): Promise<T> => {
    if (destroyed || failed) return Promise.reject(failed ?? new EditorError('destroyed', 'The editor was destroyed.'));
    return new Promise<T>((resolve, reject) => {
      const id = String(++sequence);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new EditorError('timeout', `Editor request timed out: ${method}`));
      }, timeoutMs);
      pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      try { post({ kind: 'request', id, method, payload }); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  };
  const onMessage = (event: MessageEvent) => {
    if (destroyed || failed || event.source !== iframe.contentWindow || event.origin !== url.origin || !isBridgeMessage(event.data, channel)) return;
    const message = event.data;
    if (message.kind === 'ready' && !connected) {
      connected = true;
      clearInterval(ping);
      void (async () => {
        if (options.document) await request<void>('loadDocument', { document: options.document, fileName: options.fileName });
        clearTimeout(readyTimer);
        resolveReady();
      })().catch(fail);
    } else if (message.kind === 'response' && typeof message.id === 'string') {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new EditorError(message.error.code, message.error.message));
      else entry.resolve(message.payload);
    } else if (message.kind === 'change') {
      options.onChange?.(message.payload as EditorState);
    } else if (message.kind === 'selection') {
      options.onSelectionChange?.(message.payload as EditorSelection | null);
    }
  };
  const onLoad = () => {
    if (destroyed || failed) return;
    if (connected) { fail(new EditorError('reloaded', 'The editor frame reloaded. Destroy this handle and create a new editor.')); return; }
    clearInterval(ping);
    post({ kind: 'connect' });
    ping = setInterval(() => post({ kind: 'connect' }), 250);
  };
  host.addEventListener('message', onMessage);
  iframe.addEventListener('load', onLoad);
  container.appendChild(iframe);
  return {
    iframe, ready,
    async loadDocument(document, loadOptions = {}) {
      await ready;
      return request<void>('loadDocument', { document, ...loadOptions });
    },
    async getDocument() { await ready; return request<CityJsonDocument | null>('getDocument'); },
    async getState() { await ready; return request<EditorState>('getState'); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopHandshake();
      const error = new EditorError('destroyed', 'The editor was destroyed.');
      rejectReady(error);
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
      pending.clear();
      host.removeEventListener('message', onMessage);
      iframe.removeEventListener('load', onLoad);
      iframe.remove();
    },
  };
}
