import type { CityJsonDocument } from '../types';
import { checkIntegrity } from '../lib/integrity';
import { validateCityJson } from '../lib/cityjson';
import { BRIDGE_PROTOCOL, EditorError, isBridgeMessage, type BridgeMessage, type EditorState } from './protocol';

export interface EmbedConfig { channel: string; parentOrigin: string }

export function readEmbedConfig(location: Pick<Location, 'search'>): EmbedConfig | undefined {
  const params = new URLSearchParams(location.search);
  const channel = params.get('wce-embed');
  const parent = params.get('wce-parent');
  if (!channel || !parent) return undefined;
  try {
    const url = new URL(parent);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== parent) return undefined;
    return { channel, parentOrigin: parent };
  } catch { return undefined; }
}

export interface FrameAccess {
  getDocument(): CityJsonDocument | null;
  getState(): EditorState;
  loadDocument(document: CityJsonDocument, fileName: string): void;
}

/** Only the configured parent window can read or replace the document. */
export function attachFrameBridge(frame: Window, config: EmbedConfig, access: FrameAccess) {
  let connected = false;
  const post = (message: Omit<BridgeMessage, 'protocol' | 'channel'>) => {
    frame.parent.postMessage({ ...message, protocol: BRIDGE_PROTOCOL, channel: config.channel }, config.parentOrigin);
  };
  const onMessage = (event: MessageEvent) => {
    if (frame.parent === frame || event.source !== frame.parent || event.origin !== config.parentOrigin || !isBridgeMessage(event.data, config.channel)) return;
    const message = event.data;
    if (message.kind === 'connect') { connected = true; post({ kind: 'ready' }); return; }
    if (!connected || message.kind !== 'request' || typeof message.id !== 'string') return;
    try {
      let result: unknown;
      switch (message.method) {
        case 'getDocument': result = access.getDocument(); break;
        case 'getState': result = access.getState(); break;
        case 'loadDocument': {
          const payload = message.payload as { document?: unknown; fileName?: unknown; discardDrafts?: unknown } | undefined;
          if (access.getState().hasDraft && payload?.discardDrafts !== true) throw new EditorError('draft-active', 'Apply or discard the current drafts, or pass discardDrafts: true.');
          const parsed = validateCityJson(payload?.document);
          if (!parsed.ok) throw new EditorError('invalid-document', parsed.error);
          const report = checkIntegrity(parsed.doc);
          if (!report.ok) throw new EditorError('invalid-document', report.issues.filter(issue => issue.severity === 'error').slice(0, 3).map(issue => issue.message).join(' '));
          access.loadDocument(structuredClone(parsed.doc), typeof payload?.fileName === 'string' ? payload.fileName : 'document.city.json');
          break;
        }
        default: throw new EditorError('method', `Unknown editor method: ${message.method}`);
      }
      post({ kind: 'response', id: message.id, payload: result });
    } catch (error) {
      post({ kind: 'response', id: message.id, error: {
        code: error instanceof EditorError ? error.code : 'editor',
        message: error instanceof Error ? error.message : String(error),
      } });
    }
  };
  frame.addEventListener('message', onMessage);
  return {
    notify(kind: 'change' | 'selection', payload: unknown) { if (connected) post({ kind, payload }); },
    dispose() { frame.removeEventListener('message', onMessage); connected = false; },
  };
}
