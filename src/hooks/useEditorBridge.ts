import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { CityJsonDocument } from '../types';
import { attachFrameBridge, type EmbedConfig } from '../package/frame-bridge';
import type { EditorState } from '../package/protocol';

export function useEditorBridge(config: EmbedConfig | undefined, input: {
  document: CityJsonDocument | null;
  state: Omit<EditorState, 'revision'>;
  reloadToken: number;
  dirtyIds: Set<string>;
  loadDocument(document: CityJsonDocument, fileName: string): void;
}) {
  const current = useRef(input);
  current.current = input;
  const revision = useRef(0);
  const bridge = useRef<ReturnType<typeof attachFrameBridge> | null>(null);
  const previous = useRef({ document: input.document, reloadToken: input.reloadToken, dirtyIds: input.dirtyIds });
  useEffect(() => {
    if (!config) return;
    const getState = (): EditorState => ({ ...current.current.state, revision: revision.current });
    bridge.current = attachFrameBridge(window, config, {
      getDocument: () => current.current.document,
      getState,
      // A host replacement commits before its response. Refs, selection and
      // histories must belong to the new document when the next request arrives.
      loadDocument: (document, fileName) => flushSync(() => current.current.loadDocument(document, fileName)),
    });
    return () => { bridge.current?.dispose(); bridge.current = null; };
  }, [config]);
  useEffect(() => {
    const before = previous.current;
    const changed = before.document !== input.document || before.reloadToken !== input.reloadToken || before.dirtyIds !== input.dirtyIds;
    previous.current = { document: input.document, reloadToken: input.reloadToken, dirtyIds: input.dirtyIds };
    if (changed) {
      revision.current++;
      bridge.current?.notify('change', { ...current.current.state, revision: revision.current });
    }
  }, [input.document, input.reloadToken, input.dirtyIds]);
  const selection = input.state.selection;
  useEffect(() => { bridge.current?.notify('selection', selection); }, [selection?.kind, selection?.id]);
}
