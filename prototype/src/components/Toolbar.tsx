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
  onReloadView: () => void;
  onNewFile: () => void;
  onSaveLocal?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  drawMode?: 'none' | 'polygon';
  onStartDraw?: () => void;
  onCancelDraw?: () => void;
}

export default function Toolbar({
  fileName,
  stats,
  dirtyCount,
  hasData,
  onExport,
  onExportGltf,
  integrity,
  onReloadView,
  onNewFile,
  onSaveLocal,
  saveStatus = 'idle',
  drawMode = 'none',
  onStartDraw,
  onCancelDraw,
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

          <Button onClick={onReloadView} title="Re-parse modified data and refresh map + 3D view">
            ↻ Reload view
          </Button>

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
