import { Button } from './ui/button';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
  /** Optional secondary export. Emits binary glTF (.glb). */
  onExportGltf?: () => void;
  /** Browser-side structural integrity check. */
  integrity?: {
    errorCount: number;
    warningCount: number;
    onShow: () => void;
  };
  /** ISO 19107 primitive validation, usually backed by val3dity. */
  primitiveValidation?: {
    kind: 'unchecked' | 'checking' | 'valid' | 'invalid' | 'unavailable';
    message: string;
    onValidate: () => void;
  };
  orphanedVertexCount?: number;
  onCompactVertices?: () => void;
  undoState?: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel?: string;
    redoLabel?: string;
    onUndo: () => void;
    onRedo: () => void;
  };
  showList?: boolean;
  onToggleList?: () => void;
  onMergeFile?: () => void;
  onImportIfc?: () => void;
  ifcParsing?: boolean;
  onReloadView: () => void;
  onOpenLoader: () => void;
  onSaveLocal?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  drawMode?: 'none' | 'polygon' | 'road-line';
  onStartDraw?: () => void;
  onCancelDraw?: () => void;
  roadEditorOpen?: boolean;
  onToggleRoadEditor?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canCopy?: boolean;
  canPaste?: boolean;
  onDelete?: () => void;
  canDelete?: boolean;
  zoningEnabled?: boolean;
  zoningLoading?: boolean;
  onToggleZoning?: () => void;
  onFilterViewport?: () => void;
  canFilterViewport?: boolean;
  catalogState?: {
    loadedTiles: number;
    loading: boolean;
    dirty?: boolean;
    error?: string;
    message?: string;
  };
  onLoadCatalogViewport?: () => void;
  onPersistCatalog?: () => void;
}

type PrimitiveValidationKind = NonNullable<Props['primitiveValidation']>['kind'];

export default function Toolbar({
  fileName,
  stats,
  dirtyCount,
  hasData,
  onExport,
  onExportGltf,
  integrity,
  primitiveValidation,
  orphanedVertexCount = 0,
  onCompactVertices,
  undoState,
  showList = false,
  onToggleList,
  onMergeFile,
  onImportIfc,
  ifcParsing = false,
  onReloadView,
  onOpenLoader,
  onSaveLocal,
  saveStatus = 'idle',
  drawMode = 'none',
  onStartDraw,
  onCancelDraw,
  roadEditorOpen = false,
  onToggleRoadEditor,
  onCopy,
  onPaste,
  canCopy = false,
  canPaste = false,
  onDelete,
  canDelete = false,
  zoningEnabled = false,
  zoningLoading = false,
  onToggleZoning,
  onFilterViewport,
  canFilterViewport = false,
  catalogState,
  onLoadCatalogViewport,
  onPersistCatalog,
}: Props) {
  const showDirtyCatalogSave = Boolean(catalogState?.dirty && onPersistCatalog);
  const hasMoreActions =
    Boolean(undoState) ||
    Boolean(onCopy) ||
    Boolean(onPaste) ||
    Boolean(onDelete) ||
    Boolean(onFilterViewport && canFilterViewport) ||
    Boolean(catalogState && onLoadCatalogViewport) ||
    Boolean(onReloadView) ||
    Boolean(onCompactVertices && orphanedVertexCount > 50) ||
    Boolean(onSaveLocal) ||
    Boolean(onExportGltf) ||
    Boolean(onImportIfc) ||
    Boolean(onMergeFile);

  return (
    <header className="flex h-10 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 text-xs">
      <span className="font-semibold text-[13px]">City Editor</span>

      <Button size="sm" variant="ghost" onClick={onOpenLoader} title="Open data loader">
        Data
      </Button>

      {fileName && (
        <div className="flex min-w-0 items-center gap-2 text-[var(--text-dim)]">
          {dirtyCount > 0 && (
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--warn)]" />
          )}
          <span className="max-w-[240px] truncate" title={fileName}>
            {fileName}
          </span>
          {dirtyCount > 0 && (
            <span className="whitespace-nowrap text-[var(--warn)]">
              / {dirtyCount} unsaved
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {stats && (
        <span className="hidden text-[11px] text-[var(--text-dim)] tabular-nums lg:inline">
          CityJSON <b className="text-[var(--text)]">{stats.version}</b>{' '}
          / <b className="text-[var(--text)]">{stats.rootBuildings}</b> buildings{' '}
          / <b className="text-[var(--text)]">{stats.vertices.toLocaleString()}</b>{' '}
          vertices
          {stats.crs && (
            <>
              {' '} / CRS{' '}
              <b className="font-mono text-[var(--text)]">{shortCrs(stats.crs)}</b>
            </>
          )}
        </span>
      )}

      {integrity && (
        <button
          onClick={integrity.onShow}
          title="Browser structure check"
          className={integrityClassName(integrity.errorCount, integrity.warningCount)}
        >
          {integrity.errorCount > 0
            ? `Structure: ${integrity.errorCount}`
            : integrity.warningCount > 0
            ? `Structure: ${integrity.warningCount} warn`
            : 'Structure: valid'}
        </button>
      )}

      {primitiveValidation && (
        <button
          onClick={primitiveValidation.onValidate}
          disabled={primitiveValidation.kind === 'checking'}
          title={primitiveValidation.message}
          className={primitiveClassName(primitiveValidation.kind)}
        >
          {primitiveValidation.kind === 'checking'
            ? '3D: checking'
            : primitiveValidation.kind === 'valid'
            ? '3D: valid'
            : primitiveValidation.kind === 'invalid'
            ? '3D: invalid'
            : primitiveValidation.kind === 'unavailable'
            ? '3D: unavailable'
            : 'Check 3D'}
        </button>
      )}

      {hasData && (
        <>
          {onToggleRoadEditor && (
            <Button
              size="sm"
              variant={roadEditorOpen ? 'primary' : 'ghost'}
              onClick={onToggleRoadEditor}
              title="Open road editing: OSM reference, satellite check, lanes, CityJSON Transportation export"
            >
              Roads
            </Button>
          )}

          {drawMode !== 'none' ? (
            <Button variant="warn" onClick={onCancelDraw} title="Cancel drawing (Esc)">
              Cancel drawing
            </Button>
          ) : (
            onStartDraw && (
              <Button
                variant="primary"
                onClick={onStartDraw}
                title="Draw a 2D footprint to create a new LoD2 building"
              >
                New Building
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
              {showList ? 'Hide List' : 'List'}
            </Button>
          )}

          {onToggleZoning && (
            <Button
              size="sm"
              variant={zoningEnabled ? 'primary' : 'ghost'}
              onClick={onToggleZoning}
              disabled={zoningLoading}
              title={
                zoningEnabled
                  ? 'Disable planning overlay'
                  : 'Load planning overlay for the current map view'
              }
            >
              {zoningLoading ? 'Planning...' : zoningEnabled ? 'Planning ON' : 'Planning'}
            </Button>
          )}

          {showDirtyCatalogSave && (
            <Button
              size="sm"
              variant="primary"
              onClick={onPersistCatalog}
              disabled={catalogState?.loading}
              title="Validate edited features and persist them into their source CityJSONSeq tiles"
            >
              {catalogState?.loading ? 'Saving seq...' : 'Save seq'}
            </Button>
          )}

          <Button variant="primary" onClick={onExport} disabled={!hasData}>
            Export CityJSON
          </Button>

          {hasMoreActions && (
            <details className="relative">
              <summary className="h-7 cursor-pointer list-none rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] hover:bg-[#2c3140] [&::-webkit-details-marker]:hidden">
                More
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 flex min-w-[230px] flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                {undoState && (
                  <div className="grid grid-cols-2 gap-1">
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
                      Undo
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
                      Redo
                    </Button>
                  </div>
                )}

                {(onCopy || onPaste || onDelete) && (
                  <div className="grid grid-cols-3 gap-1">
                    {onCopy && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canCopy}
                        onClick={onCopy}
                        title="Copy selected buildings (Ctrl+C)"
                      >
                        Copy
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
                        Paste
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
                        Delete
                      </Button>
                    )}
                  </div>
                )}

                {onFilterViewport && canFilterViewport && (
                  <MenuAction onClick={onFilterViewport}>
                    Filter to viewport
                  </MenuAction>
                )}

                {catalogState && onLoadCatalogViewport && (
                  <MenuAction
                    onClick={onLoadCatalogViewport}
                    disabled={catalogState.loading}
                    title={
                      catalogState.error ??
                      catalogState.message ??
                      'Load unseen CityJSONSeq tiles intersecting the current viewport'
                    }
                  >
                    {catalogState.loading
                      ? 'Seq tiles...'
                      : `Seq tiles ${catalogState.loadedTiles}`}
                  </MenuAction>
                )}

                <MenuAction onClick={onReloadView}>Reload view</MenuAction>

                {onCompactVertices && orphanedVertexCount > 50 && (
                  <MenuAction
                    onClick={onCompactVertices}
                    title={`Reclaim ${orphanedVertexCount} orphaned vertices left over from footprint regenerations`}
                  >
                    Compact ({orphanedVertexCount.toLocaleString()})
                  </MenuAction>
                )}

                {onSaveLocal && (
                  <MenuAction
                    onClick={onSaveLocal}
                    disabled={saveStatus === 'saving'}
                    title="Persist current in-memory doc to browser IndexedDB"
                  >
                    {saveStatus === 'saving'
                      ? 'Saving...'
                      : saveStatus === 'saved'
                      ? 'Saved'
                      : saveStatus === 'error'
                      ? 'Save failed'
                      : 'Save local'}
                  </MenuAction>
                )}

                {onExportGltf && (
                  <MenuAction
                    onClick={onExportGltf}
                    title="Export to binary glTF (.glb)"
                  >
                    Export glTF
                  </MenuAction>
                )}

                {onImportIfc && (
                  <MenuAction
                    onClick={onImportIfc}
                    disabled={ifcParsing}
                    title="Import an IFC building model"
                  >
                    {ifcParsing ? 'Parsing IFC...' : 'Import IFC'}
                  </MenuAction>
                )}

                {onMergeFile && (
                  <MenuAction
                    onClick={onMergeFile}
                    title="Merge another CityJSON file into the current document"
                  >
                    Merge file
                  </MenuAction>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </header>
  );
}

function MenuAction({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <Button size="sm" variant="ghost" className="w-full justify-start" {...props}>
      {children}
    </Button>
  );
}

function integrityClassName(errorCount: number, warningCount: number): string {
  if (errorCount > 0) {
    return 'rounded border border-[var(--err,#cb4b4b)] px-2 py-0.5 text-[10px] font-semibold text-[var(--err,#ff7b7b)] hover:bg-[rgba(203,75,75,0.15)] cursor-pointer';
  }
  if (warningCount > 0) {
    return 'rounded border border-[var(--warn)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warn)] hover:bg-[rgba(251,191,36,0.12)] cursor-pointer';
  }
  return 'rounded border border-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)] hover:bg-[rgba(34,197,94,0.12)] cursor-pointer';
}

function primitiveClassName(kind: PrimitiveValidationKind): string {
  if (kind === 'valid') {
    return 'rounded border border-[var(--success)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)] hover:bg-[rgba(34,197,94,0.12)] cursor-pointer';
  }
  if (kind === 'invalid') {
    return 'rounded border border-[var(--err,#cb4b4b)] px-2 py-0.5 text-[10px] font-semibold text-[var(--err,#ff7b7b)] hover:bg-[rgba(203,75,75,0.15)] cursor-pointer';
  }
  return 'rounded border border-[var(--warn)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warn)] hover:bg-[rgba(251,191,36,0.12)] cursor-pointer disabled:cursor-wait';
}

function shortCrs(crs: string): string {
  const m = crs.match(/EPSG\/\d+\/(\d+)/);
  if (m) return `EPSG:${m[1]}`;
  return crs.length > 30 ? crs.slice(-20) : crs;
}
