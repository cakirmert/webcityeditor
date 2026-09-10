import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import { saveDocument } from '../lib/storage';
import { checkProjectRoadResetExtent, prepareProjectRoadReplacement, projectRoadResetExtent } from '../lib/project-road-reset';
import { runStructurallyGuardedMutation } from '../lib/editor-actions';

export function useProjectRoadReset(core: CoreState, undo: UndoRedoState, draftActive: boolean, onApplied: () => void) {
  type Preview = ReturnType<typeof prepareProjectRoadReplacement> & { original: string; summary: string; notices: string[] };
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const applying = useRef(false);
  const context = useRef({ core, draftActive, onApplied }); context.current = { core, draftActive, onApplied };
  useEffect(() => () => request.current?.abort(), [core.cityjson]);
  const cancel = useCallback(() => { if (applying.current) return; request.current?.abort(); request.current = null; setPreview(null); setBusy(false); setMessage(''); }, []);
  const prepare = useCallback(async () => {
    const { core, draftActive } = context.current;
    if (!core.cityjson || draftActive || request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setPreview(null);
    try {
      const original = JSON.stringify(core.cityjson), snapshot = JSON.parse(original);
      const bbox = projectRoadResetExtent(snapshot); checkProjectRoadResetExtent(bbox);
      setMessage('Preparing roads and intersections for the whole project. This can take a minute; the current design stays in place.');
      const { prepareFreshOsmRoads } = await import('../lib/project-osm-reset');
      const fresh = await prepareFreshOsmRoads(bbox, controller.signal);
      controller.signal.throwIfAborted();
      const replacement = prepareProjectRoadReplacement(snapshot, fresh.document, fresh.source);
      setPreview({ ...replacement, original, summary: `${replacement.removedIds.length} existing road/intersection objects will be replaced by ${fresh.summary.roads} roads and ${fresh.summary.intersections} intersections.`, notices: fresh.diagnostics.map(item => item.message) });
      setMessage('Replacement prepared. Review the counts and download the preview before resetting.');
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : String(error)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }, []);
  const apply = useCallback(async () => {
    const { core, draftActive } = context.current, doc = core.cityjson;
    if (!preview || !doc || draftActive || busy || applying.current) return;
    applying.current = true; setBusy(true);
    try {
      if (JSON.stringify(doc) !== preview.original) throw new Error('The project changed since preparation. Prepare the reset again to include its current extent and edits.');
      const backup = `Before road reset — ${core.fileName || 'Project'} — ${new Date().toISOString()}`;
      await saveDocument(backup, JSON.parse(preview.original));
      if (context.current.core.cityjson !== doc || context.current.draftActive || JSON.stringify(doc) !== preview.original) throw new Error('The project changed while creating its backup. Nothing was reset; prepare again.');
      undo.pushUndo('Reset project roads from OSM');
      runStructurallyGuardedMutation(doc, 'Reset project roads', () => Object.assign(doc, structuredClone(preview.document)));
      context.current.onApplied();
      core.setDirtyIds(ids => new Set([...ids, ...preview.removedIds, ...preview.addedIds])); core.setReloadToken(token => token + 1);
      core.setSelection(null); core.markGeometryChanged('Project roads reset; review the new intersections before export.');
      setPreview(null); setMessage('Project roads reset. Undo restores the previous design. A recovery copy is also available in Data → Local saves.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { applying.current = false; setBusy(false); }
  }, [preview, busy, undo]);
  const downloadPreview = useCallback(() => {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(preview.document)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'project-road-reset-preview.city.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [preview]);
  return { busy, preview, message, prepare, apply, cancel, downloadPreview };
}
export type ProjectRoadResetState = ReturnType<typeof useProjectRoadReset>;
