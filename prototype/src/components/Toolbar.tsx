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
