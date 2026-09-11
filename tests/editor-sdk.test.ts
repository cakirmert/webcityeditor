import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../src/package';
import { attachFrameBridge, readEmbedConfig } from '../src/package/frame-bridge';
import { BRIDGE_PROTOCOL, type EditorHandle, type EditorState } from '../src/package/protocol';
import type { CityJsonDocument } from '../src/types-cityjson';

const doc: CityJsonDocument = { type: 'CityJSON', version: '2.0', CityObjects: {}, vertices: [] };
const handles: EditorHandle[] = [];
afterEach(() => { for (const handle of handles.splice(0)) handle.destroy(); document.body.replaceChildren(); vi.useRealTimers(); });

function client() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const errors = vi.fn();
  const changes = vi.fn();
  const editor = createEditor(container, { editorUrl: 'https://editor.example/editor/index.html', onError: errors, onChange: changes, timeoutMs: 1000 });
  handles.push(editor);
  const post = vi.spyOn(editor.iframe.contentWindow!, 'postMessage').mockImplementation(() => {});
  const channel = new URL(editor.iframe.src).searchParams.get('wce-embed');
  const receive = (message: Record<string, unknown>, overrides: MessageEventInit = {}) => window.dispatchEvent(new MessageEvent('message', {
    source: editor.iframe.contentWindow, origin: 'https://editor.example', data: { protocol: BRIDGE_PROTOCOL, channel, ...message }, ...overrides,
  }));
  editor.iframe.dispatchEvent(new Event('load'));
  return { editor, receive, post, errors, changes };
}

describe('browser SDK', () => {
  it('mounts only its own frame and waits for the matching origin, source and channel', async () => {
    const c = client();
    expect(c.post).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }), 'https://editor.example');
    c.receive({ kind: 'ready' }, { origin: 'https://wrong.example' });
    c.receive({ kind: 'ready' }, { source: window });
    c.receive({ kind: 'ready', channel: 'another-editor' });
    let ready = false;
    void c.editor.ready.then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    c.receive({ kind: 'ready' });
    await c.editor.ready;
    expect(ready).toBe(true);
    const sibling = document.createElement('p');
    c.editor.iframe.parentElement!.append(sibling);
    c.editor.destroy();
    expect(sibling.isConnected).toBe(true);
    await expect(c.editor.getDocument()).rejects.toMatchObject({ code: 'destroyed' });
  });

  it('correlates document requests and typed draft errors', async () => {
    const c = client(); c.receive({ kind: 'ready' }); await c.editor.ready;
    const snapshot = c.editor.getDocument();
    await Promise.resolve();
    const request = c.post.mock.lastCall![0] as { id: string; method: string };
    expect(request.method).toBe('getDocument');
    c.receive({ kind: 'response', id: request.id, payload: doc });
    expect(await snapshot).toEqual(doc);
    const load = c.editor.loadDocument(doc);
    await Promise.resolve();
    const loadId = (c.post.mock.lastCall![0] as { id: string }).id;
    c.receive({ kind: 'response', id: loadId, error: { code: 'draft-active', message: 'Apply the draft.' } });
    await expect(load).rejects.toMatchObject({ code: 'draft-active' });
  });

  it('rejects pending work on teardown and reports a frame reload', async () => {
    const c = client(); c.receive({ kind: 'ready' }); await c.editor.ready;
    const waiting = c.editor.getState(); await Promise.resolve();
    c.editor.iframe.dispatchEvent(new Event('load'));
    await expect(waiting).rejects.toMatchObject({ code: 'reloaded' });
    expect(c.errors).toHaveBeenCalledWith(expect.objectContaining({ code: 'reloaded' }));
    const d = client(); d.receive({ kind: 'ready' }); await d.editor.ready;
    const pending = d.editor.getDocument(); await Promise.resolve(); d.editor.destroy();
    await expect(pending).rejects.toMatchObject({ code: 'destroyed' });
  });

  it('bounds handshake and request waits', async () => {
    vi.useFakeTimers();
    const c = client();
    await vi.advanceTimersByTimeAsync(1001);
    await expect(c.editor.ready).rejects.toMatchObject({ code: 'timeout' });
    const d = client(); d.receive({ kind: 'ready' }); await d.editor.ready;
    const pending = d.editor.getDocument();
    const check = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(1001); await check;
  });

  it('keeps two mounted editors independent', async () => {
    const a = client(); const b = client();
    a.receive({ kind: 'ready' }); b.receive({ kind: 'ready' });
    await Promise.all([a.editor.ready, b.editor.ready]);
    a.receive({ kind: 'change', payload: { revision: 2 } });
    expect(a.changes).toHaveBeenCalledOnce(); expect(b.changes).not.toHaveBeenCalled();
  });
});

describe('editor frame bridge', () => {
  function server() {
    let current: CityJsonDocument | null = null;
    const state: EditorState = { fileName: '', objectCount: 0, revision: 0, dirtyObjectIds: [], hasDraft: false, selection: null };
    const parent = { postMessage: vi.fn() };
    const target = Object.assign(new EventTarget(), { parent }) as unknown as Window;
    const bridge = attachFrameBridge(target, { channel: 'test-channel', parentOrigin: 'https://host.example' }, {
      getDocument: () => current,
      getState: () => state,
      loadDocument: (next, fileName) => { current = next; state.fileName = fileName; },
    });
    const receive = (data: Record<string, unknown>, origin = 'https://host.example') => target.dispatchEvent(new MessageEvent('message', {
      source: parent as unknown as Window, origin, data: { protocol: BRIDGE_PROTOCOL, channel: 'test-channel', ...data },
    }));
    return { state, parent, bridge, receive, getCurrent: () => current };
  }

  it('requires parent handshake and validates structures before replacement', () => {
    const s = server();
    s.receive({ kind: 'request', method: 'getDocument', id: '1' });
    s.receive({ kind: 'connect' }, 'https://intruder.example');
    expect(s.parent.postMessage).not.toHaveBeenCalled();
    s.receive({ kind: 'connect' });
    s.receive({ kind: 'request', method: 'loadDocument', id: '2', payload: { document: { ...doc, vertices: [[NaN, 0, 0]] } } });
    expect(s.parent.postMessage.mock.lastCall![0]).toMatchObject({ error: { code: 'invalid-document' } });
    expect(s.getCurrent()).toBeNull();
    s.receive({ kind: 'request', method: 'loadDocument', id: '3', payload: { document: doc, fileName: 'test.city.json' } });
    expect(s.getCurrent()).toEqual(doc); expect(s.getCurrent()).not.toBe(doc);
    expect(s.state.fileName).toBe('test.city.json');
    s.bridge.dispose();
  });

  it('requires explicit draft discard and supports document snapshots', () => {
    const s = server(); s.receive({ kind: 'connect' }); s.state.hasDraft = true;
    s.receive({ kind: 'request', id: '1', method: 'loadDocument', payload: { document: doc } });
    expect(s.parent.postMessage.mock.lastCall![0]).toMatchObject({ error: { code: 'draft-active' } });
    s.receive({ kind: 'request', id: '2', method: 'loadDocument', payload: { document: doc, discardDrafts: true } });
    expect(s.getCurrent()).toEqual(doc);
    s.receive({ kind: 'request', id: '3', method: 'getDocument' });
    expect(s.parent.postMessage.mock.lastCall![0]).toMatchObject({ kind: 'response', payload: doc });
    s.bridge.dispose(); s.parent.postMessage.mockClear(); s.receive({ kind: 'connect' });
    expect(s.parent.postMessage).not.toHaveBeenCalled();
  });

  it('only enables embedding with an exact HTTP(S) parent origin', () => {
    expect(readEmbedConfig({ search: '?wce-embed=x&wce-parent=https%3A%2F%2Fhost.example' })).toEqual({ channel: 'x', parentOrigin: 'https://host.example' });
    for (const origin of ['*', 'null', 'https://host.example/path', 'file:///tmp/host.html']) {
      expect(readEmbedConfig({ search: `?wce-embed=x&wce-parent=${encodeURIComponent(origin)}` })).toBeUndefined();
    }
  });
});
