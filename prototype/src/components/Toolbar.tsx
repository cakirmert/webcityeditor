import { Button } from './ui/button';

interface Stats {
  version: string;
  totalObjects: number;
  rootBuildings: number;
  vertices: number;
  crs: string | null;
}

interface Props {
  fileName: string;
  stats: Stats | null;
  dirtyCount: number;
  hasData: boolean;
  onExport: () => void;
  /** Optional secondary export — emit a binary glTF (.glb) so the user can
   *  open the city in Blender / Sketchfab / any glTF viewer. */
  onExportGltf?: () => void;
  /** Optional integrity-check action. Shows a small pill in the toolbar
   *  when there are warnings/errors and opens a details modal on click. */
  integrity?: {
    errorCount: number;
    warningCount: number;
    onShow: () => void;
  };
  /** Optional vertex-compaction action. Shows a small "Compact" button in
   *  the toolbar when the doc has orphaned vertices (typical after
   *  footprint-edit regenerations). */
  orphanedVertexCount?: number;
  onCompactVertices?: () => void;
  /** Optional undo/redo. Buttons render disabled when stacks are empty.
   *  Tooltips include the next action's label ("Undo: Move building"). */
  undoState?: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel?: string;
    redoLabel?: string;
    onUndo: () => void;
    onRedo: () => void;
  };
  /** Toggle for the building list sidebar. */
  showList?: boolean;
  onToggleList?: () => void;
  /** Optional merge action — opens a file picker, parses the picked file,
   *  and merges its CityObjects into the current doc. Useful for stitching
   *  adjacent Hamburg tiles together. */
  onMergeFile?: () => void;
  /** Optional IFC import. Click to open a file picker; subsequent flow
   *  (placement, etc.) is owned by the parent. */
  onImportIfc?: () => void;
  /** Disabled the IFC button while a parse is in flight. */
  ifcParsing?: boolean;
  onReloadView: () => void;
  onNewFile: () => void;
  onSaveLocal?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  drawMode?: 'none' | 'polygon';
  onStartDraw?: () => void;
  onCancelDraw?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canCopy?: boolean;
  canPaste?: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
  zoningEnabled?: boolean;
  onToggleZoning?: () => void;
}

export default function Toolbar({
  fileName,
  stats,
  dirtyCount,
  hasData,
  onExport,
  onExportGltf,
  integrity,
  orphanedVertexCount = 0,
  onCompactVertices,
  undoState,
  showList = false,
  onToggleList,
  onMergeFile,
  onImportIfc,
  ifcParsing = false,
  onReloadView,
  onNewFile,
  onSaveLocal,
  saveStatus = 'idle',
  drawMode = 'none',
  onStartDraw,
  onCancelDraw,
  onCopy,
  onPaste,
  canCopy = false,
  canPaste = false,
  onDelete,
  canDelete = false,
  zoningEnabled = false,
  onToggleZoning,
}: Props) {
  return (
    <header className="flex h-10 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 text-xs">
      <span className="font-semibold text-[13px]">City Editor</span>

      {fileName && (
        <div className="flex items-center gap-2 text-[var(--text-dim)]">
          {dirtyCount > 0 && (
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--warn)]" />
          )}
          <span className="max-w-[240px] truncate" title={fileName}>
            {fileName}
          </span>
          {dirtyCount > 0 && (
            <span className="text-[var(--warn)]">· {dirtyCount} unsaved</span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {stats && (
        <span className="text-[11px] text-[var(--text-dim)] tabular-nums">
          CityJSON <b className="text-[var(--text)]">{stats.version}</b>{' '}
          · <b className="text-[var(--text)]">{stats.rootBuildings}</b> buildings{' '}
          · <b className="text-[var(--text)]">{stats.vertices.toLocaleString()}</b>{' '}
          vertices
          {stats.crs && (
            <>
              {' '}· CRS{' '}
              <b className="font-mono text-[var(--text)]">{shortCrs(stats.crs)}</b>
            </>
          )}
        </span>
      )}

      {integrity && (integrity.errorCount > 0 || integrity.warningCount > 0) && (
        <button
          onClick={integrity.onShow}
          title="Click to see details — vertex-index bounds, parent/child links, orphaned vertices, etc."
          className={
            integrity.errorCount > 0
              ? 'rounded border border-[var(--err,#cb4b4b)] px-2 py-0.5 text-[10px] font-semibold text-[var(--err,#ff7b7b)] hover:bg-[rgba(203,75,75,0.15)] cursor-pointer'
              : 'rounded border border-[var(--warn)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warn)] hover:bg-[rgba(251,191,36,0.12)] cursor-pointer'
          }
        >
          {integrity.errorCount > 0
            ? `⚠ ${integrity.errorCount} error${integrity.errorCount === 1 ? '' : 's'}`
            : `⚠ ${integrity.warningCount} warning${integrity.warningCount === 1 ? '' : 's'}`}
        </button>
      )}

      {hasData && (
        <>
          {drawMode === 'polygon' ? (
            <Button variant="warn" onClick={onCancelDraw} title="Cancel drawing (Esc)">
              ✕ Cancel drawing
            </Button>
          ) : (
            onStartDraw && (
              <Button
                variant="primary"
                onClick={onStartDraw}
                title="Draw a 2D footprint to create a new LoD2 building"
              >
                ＋ New Building
              </Button>
            )
          )}

          {onToggleList && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleList}
              title={showList ? 'Hide building list' : 'Show building list'}
            >
              {showList ? '▣ List' : '☰ List'}
            </Button>
          )}

          {undoState && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={!undoState.canUndo}
                onClick={undoState.onUndo}
                title={
                  undoState.undoLabel
                    ? `Undo: ${undoState.undoLabel} (Ctrl+Z)`
                    : 'Nothing to undo'
                }
              >
                ↶ Undo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!undoState.canRedo}
                onClick={undoState.onRedo}
                title={
                  undoState.redoLabel
                    ? `Redo: ${undoState.redoLabel} (Ctrl+Shift+Z)`
                    : 'Nothing to redo'
                }
              >
                ↷ Redo
              </Button>
            </>
          )}

          {onCopy && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canCopy}
              onClick={onCopy}
              title="Copy selected buildings (Ctrl+C)"
            >
              ⧉ Copy
            </Button>
          )}
          {onPaste && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canPaste}
              onClick={onPaste}
              title="Paste copied buildings (Ctrl+V)"
            >
              ⎘ Paste
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!canDelete}
              onClick={onDelete}
              title="Delete selected buildings (Delete)"
            >
              ✕ Delete
            </Button>
          )}

          {onToggleZoning && (
            <Button
              size="sm"
              variant={zoningEnabled ? 'primary' : 'ghost'}
              onClick={onToggleZoning}
              title={zoningEnabled ? 'Disable zoning overlay' : 'Show parcel zoning overlay'}
            >
              {zoningEnabled ? '▦ Zoning ON' : '▦ Zoning'}
            </Button>
          )}

          <Button onClick={onReloadView} title="Re-parse modified data and refresh map + 3D view">
            ↻ Reload view
          </Button>

          {onCompactVertices && orphanedVertexCount > 50 && (
            <Button
              onClick={onCompactVertices}
              variant="ghost"
              title={`Reclaim ${orphanedVertexCount} orphaned vertices left over from footprint regenerations`}
            >
              ◇ Compact ({orphanedVertexCount.toLocaleString()})
            </Button>
          )}

          {onSaveLocal && (
            <Button
              onClick={onSaveLocal}
              disabled={saveStatus === 'saving'}
              title="Persist current in-memory doc to browser IndexedDB"
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                ? '✓ Saved'
                : saveStatus === 'error'
                ? '⚠ Save failed'
                : '💾 Save local'}
            </Button>
          )}

          <Button variant="primary" onClick={onExport} disabled={!hasData}>
            ⬇ Export CityJSON
          </Button>

          {onExportGltf && (
            <Button
              onClick={onExportGltf}
              title="Export to binary glTF (.glb) — opens in Blender / Sketchfab / any 3D viewer"
            >
              ⬇ glTF
            </Button>
          )}

          {onImportIfc && (
            <Button
              variant="ghost"
              onClick={onImportIfc}
              disabled={ifcParsing}
              title="Import an IFC building model — parses with web-ifc and drops a placeable LoD2 box"
            >
              {ifcParsing ? 'Parsing IFC…' : '⌂ Import IFC…'}
            </Button>
          )}

          {onMergeFile && (
            <Button
              variant="ghost"
              onClick={onMergeFile}
              title="Merge another CityJSON file into the current doc — useful for stitching adjacent tiles"
            >
              ＋ Merge file…
            </Button>
          )}

          <Button onClick={onNewFile} variant="ghost" title="Load a different file">
            Load another…
          </Button>
        </>
      )}
    </header>
  );
}

function shortCrs(crs: string): string {
  const m = crs.match(/EPSG\/\d+\/(\d+)/);
  if (m) return `EPSG:${m[1]}`;
  return crs.length > 30 ? crs.slice(-20) : crs;
}
