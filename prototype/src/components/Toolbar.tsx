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
  sidePanelFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
    <div className="toolbar">
      <span className="title">City Editor</span>
      {fileName && (
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          {dirtyCount > 0 && <span className="dirty-dot" />}
          {fileName}
          {dirtyCount > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--warn)' }}>
              · {dirtyCount} unsaved
            </span>
          )}
        </span>
      )}
      <div className="spacer" />
      {stats && (
        <span className="stats">
          CityJSON <b>{stats.version}</b> · <b>{stats.rootBuildings}</b> buildings ·{' '}
          <b>{stats.vertices.toLocaleString()}</b> vertices
          {stats.crs && (
            <>
              {' '}
              · CRS <b style={{ fontFamily: 'monospace' }}>{shortCrs(stats.crs)}</b>
            </>
          )}
        </span>
      )}
      {hasData && (
        <>
          {drawMode === 'polygon' ? (
            <button
              onClick={onCancelDraw}
              style={{ background: 'var(--warn)', color: '#000', borderColor: 'var(--warn)' }}
              title="Cancel drawing (Esc)"
            >
              ✕ Cancel drawing
            </button>
          ) : (
            onStartDraw && (
              <button
                onClick={onStartDraw}
                className="primary"
                title="Draw a 2D footprint to create a new LoD2 building"
              >
                ＋ New Building
              </button>
            )
          )}
          <button onClick={onReloadView} title="Re-parse modified data and refresh map + 3D view">
            ↻ Reload view
          </button>
          {onSaveLocal && (
            <button
              onClick={onSaveLocal}
              disabled={saveStatus === 'saving'}
              title="Persist current in-memory doc to browser IndexedDB (local)"
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                ? '✓ Saved'
                : saveStatus === 'error'
                ? '⚠ Save failed'
                : '💾 Save local'}
            </button>
          )}
          <button className="primary" onClick={onExport} disabled={!hasData}>
            ⬇ Export CityJSON
          </button>
          <button onClick={onNewFile} title="Load a different file">
            Load another…
          </button>
        </>
      )}
    </div>
  );
}

function shortCrs(crs: string): string {
  // Strip long OGC URL, keep EPSG code when possible
  const m = crs.match(/EPSG\/\d+\/(\d+)/);
  if (m) return `EPSG:${m[1]}`;
  return crs.length > 30 ? crs.slice(-20) : crs;
}
