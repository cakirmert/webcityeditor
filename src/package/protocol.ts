import type { CityJsonDocument } from '../types-cityjson.js';

export const BRIDGE_PROTOCOL = 'webcityeditor/1';

export interface EditorSelection {
  kind: 'building' | 'road' | 'intersection';
  id: string;
}

export interface EditorState {
  fileName: string;
  objectCount: number;
  /** Session change counter, not a shared-project database revision. */
  revision: number;
  dirtyObjectIds: string[];
  hasDraft: boolean;
  selection: EditorSelection | null;
}

export interface LoadDocumentOptions {
  fileName?: string;
  /** Explicitly abandon open and parked drafts when replacing the document. */
  discardDrafts?: boolean;
}

export interface EditorOptions {
  /** URL of the copied editor/index.html, served over HTTP(S). */
  editorUrl: string;
  document?: CityJsonDocument;
  fileName?: string;
  title?: string;
  timeoutMs?: number;
  /** Applied document changes only. Call getDocument() to obtain a snapshot. */
  onChange?: (state: EditorState) => void;
  onSelectionChange?: (selection: EditorSelection | null) => void;
  onError?: (error: Error) => void;
}

export interface EditorHandle {
  readonly iframe: HTMLIFrameElement;
  /** Resolves after the bridge and optional initial document are ready. */
  readonly ready: Promise<void>;
  loadDocument(document: CityJsonDocument, options?: LoadDocumentOptions): Promise<void>;
  /** Applied, loaded CityJSON only; excludes drafts and unloaded catalog tiles. */
  getDocument(): Promise<CityJsonDocument | null>;
  getState(): Promise<EditorState>;
  destroy(): void;
}

export interface BridgeMessage {
  protocol: typeof BRIDGE_PROTOCOL;
  channel: string;
  kind: 'connect' | 'ready' | 'request' | 'response' | 'change' | 'selection';
  id?: string;
  method?: string;
  payload?: unknown;
  error?: { code: string; message: string };
}

export function isBridgeMessage(value: unknown, channel: string): value is BridgeMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<BridgeMessage>;
  return message.protocol === BRIDGE_PROTOCOL && message.channel === channel &&
    typeof message.kind === 'string';
}

export class EditorError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'EditorError';
  }
}
