import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorBridge } from '../../src/hooks/useEditorBridge';
import { BRIDGE_PROTOCOL, type BridgeMessage, type EditorSelection } from '../../src/package/protocol';
import type { CityJsonDocument } from '../../src/types-cityjson';

const config = { channel: 'hook-lifecycle', parentOrigin: 'https://host.example' };
const parentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent');
afterEach(() => {
  cleanup();
  if (parentDescriptor) Object.defineProperty(window, 'parent', parentDescriptor);
  vi.restoreAllMocks();
});

describe('useEditorBridge lifecycle', () => {
  it('reports applied in-place edits, excludes draft-only updates, and commits host replacement before acknowledging it', () => {
    const parent = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { configurable: true, value: parent });
    const initial: CityJsonDocument = {
      type: 'CityJSON', version: '2.0', vertices: [], CityObjects: { old: { type: 'Building' } },
    };
    const next: CityJsonDocument = {
      type: 'CityJSON', version: '2.0', vertices: [], CityObjects: { replacement: { type: 'Road' } },
    };
    const { result } = renderHook(() => {
      const [document, setDocument] = useState(initial);
      const [fileName, setFileName] = useState('old.city.json');
      const [reloadToken, setReloadToken] = useState(0);
      const [dirtyIds, setDirtyIds] = useState(new Set(['old']));
      const [hasDraft, setHasDraft] = useState(false);
      const [selection, setSelection] = useState<EditorSelection | null>({ kind: 'building', id: 'old' });
      useEditorBridge(config, {
        document, reloadToken, dirtyIds,
        state: { fileName, objectCount: Object.keys(document.CityObjects).length, dirtyObjectIds: [...dirtyIds], hasDraft, selection },
        loadDocument: (value, name) => {
          setDocument(value); setFileName(name); setDirtyIds(new Set());
          setHasDraft(false); setSelection(null); setReloadToken(token => token + 1);
        },
      });
      return { document, setReloadToken, setHasDraft };
    });
    const send = (message: Omit<BridgeMessage, 'protocol' | 'channel'>) => window.dispatchEvent(new MessageEvent('message', {
      source: parent as unknown as Window,
      origin: config.parentOrigin,
      data: { ...message, protocol: BRIDGE_PROTOCOL, channel: config.channel },
    }));
    const messages = () => parent.postMessage.mock.calls.map(call => call[0] as BridgeMessage);
    act(() => { send({ kind: 'connect' }); });
    parent.postMessage.mockClear();

    // Real editor geometry actions mutate the document rather than replacing
    // its React reference. The reload token must still produce a host event.
    act(() => {
      result.current.document.CityObjects.added = { type: 'Road' };
      result.current.setReloadToken(token => token + 1);
    });
    expect(result.current.document).toBe(initial);
    expect(messages().filter(message => message.kind === 'change')).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ revision: 1, objectCount: 2 }) }),
    ]);

    parent.postMessage.mockClear();
    act(() => { result.current.setHasDraft(true); });
    expect(messages().filter(message => message.kind === 'change')).toHaveLength(0);
    act(() => { send({ kind: 'request', id: 'draft-state', method: 'getState' }); });
    expect(messages().find(message => message.id === 'draft-state')).toMatchObject({ payload: { hasDraft: true, revision: 1 } });

    parent.postMessage.mockClear();
    // Dispatch the next reads immediately in the same task: relying on act's
    // final flush would hide a response sent before React installs the load.
    act(() => {
      send({ kind: 'request', id: 'load', method: 'loadDocument', payload: { document: next, fileName: 'next.city.json', discardDrafts: true } });
      send({ kind: 'request', id: 'state', method: 'getState' });
      send({ kind: 'request', id: 'document', method: 'getDocument' });
    });
    expect(messages().find(message => message.id === 'load')).toMatchObject({ kind: 'response' });
    expect(messages().find(message => message.id === 'load')).not.toHaveProperty('error');
    expect(messages().find(message => message.id === 'state')).toMatchObject({
      payload: { fileName: 'next.city.json', objectCount: 1, dirtyObjectIds: [], hasDraft: false, selection: null, revision: 2 },
    });
    expect(messages().find(message => message.id === 'document')?.payload).toEqual(next);
    expect(result.current.document).not.toBe(next);
    expect(messages().filter(message => message.kind === 'change')).toHaveLength(1);
    expect(messages().find(message => message.kind === 'selection')).toMatchObject({ payload: null });
  });
});
