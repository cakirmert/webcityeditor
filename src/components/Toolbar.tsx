import { Button } from './ui/button';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  Building2,
  Database,
  Download,
  List,
  MapPinned,
  MoreHorizontal,
  Route,
} from 'lucide-react';

interface Stats {
  version: string;
  totalObjects: number;
  rootBuildings: number;
  roads?: number;
  intersections?: number;
  vertices: number;
  crs: string | null;
  maxBuildingLod?: number | null;
  hasOpenings?: boolean;
  hasTextures?: boolean;
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
    Boolean(integrity) ||
    Boolean(primitiveValidation) ||
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
    <header className="app-toolbar">
      <div className="app-toolbar__identity">
        <span>City Editor</span>
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
                {dirtyCount} unsaved
              </span>
            )}
          </div>
        )}
      </div>

      <Button className="app-toolbar__action" variant="ghost" onClick={onOpenLoader} title="Open data loader">
        <Database aria-hidden="true" /> Data
      </Button>

      <div className="flex-1" />

      {stats && (
        <span className="hidden text-[11px] text-[var(--text-dim)] tabular-nums lg:inline">
          CityJSON <b className="text-[var(--text)]">{stats.version}</b>{' '}
           / <b className="text-[var(--text)]">{stats.rootBuildings}</b> buildings{' '}
           / <b className="text-[var(--text)]">{stats.roads ?? 0}</b> roads{' '}
           / <b className="text-[var(--text)]">{stats.intersections ?? 0}</b> junctions{' '}
           / <b className="text-[var(--text)]">
             {stats.maxBuildingLod == null ? 'LoD ?' : `LoD${stats.maxBuildingLod}`}
           </b>{' '}
           {stats.hasOpenings
             ? 'with editable openings'
             : stats.hasTextures
               ? 'with photo textures; openings are not separate geometry'
               : 'no openings in source'}{' '}
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
          className={`app-toolbar__validation ${integrityClassName(
            integrity.errorCount,
            integrity.warningCount
          )}`}
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
          className={`app-toolbar__validation ${primitiveClassName(
            primitiveValidation.kind
          )}`}
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
              className="app-toolbar__action"
              variant={roadEditorOpen ? 'primary' : 'ghost'}
              onClick={onToggleRoadEditor}
              title="Open road editing: OSM reference, satellite check, lanes, CityJSON Transportation export"
            >
              <Route aria-hidden="true" /> Roads
            </Button>
          )}

          {drawMode !== 'none' ? (
            <Button className="app-toolbar__action" variant="warn" onClick={onCancelDraw} title="Cancel drawing (Esc)">
              Cancel drawing
            </Button>
          ) : (
            onStartDraw && (
              <Button
                className="app-toolbar__action"
                variant="primary"
                onClick={onStartDraw}
                title="Add a custom or ready-made LoD3 building"
              >
                <Building2 aria-hidden="true" /> New Building
              </Button>
            )
          )}

          {onToggleList && (
            <Button
              className="app-toolbar__action app-toolbar__mobile-hide"
              variant="ghost"
              onClick={onToggleList}
              title={showList ? 'Hide building list' : 'Show building list'}
            >
              <List aria-hidden="true" />
              {showList ? 'Hide List' : 'List'}
            </Button>
          )}

          {onToggleZoning && (
            <Button
              className="app-toolbar__action app-toolbar__mobile-hide"
              variant={zoningEnabled ? 'primary' : 'ghost'}
              onClick={onToggleZoning}
              disabled={zoningLoading}
               title={
                 zoningEnabled
                   ? 'Hide the planning overlay'
                   : 'Load planning overlay for the current map view'
               }
            >
              <MapPinned aria-hidden="true" />
               {zoningLoading ? 'Planning...' : zoningEnabled ? 'Hide Planning' : 'Planning'}
            </Button>
          )}

          {showDirtyCatalogSave && (
            <Button
              className="app-toolbar__action"
              variant="primary"
              onClick={onPersistCatalog}
              disabled={catalogState?.loading}
              title="Validate edited features and persist them into their source CityJSONSeq tiles"
            >
              {catalogState?.loading ? 'Saving seq...' : 'Save seq'}
            </Button>
          )}

          <Button className="app-toolbar__action app-toolbar__mobile-hide" variant="primary" onClick={onExport} disabled={!hasData}>
            <Download aria-hidden="true" /> Export CityJSON
          </Button>

          {hasMoreActions && (
            <details className="relative">
              <summary className="app-toolbar__more">
                <MoreHorizontal aria-hidden="true" /> More
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 flex min-w-[230px] flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                <div className="app-toolbar__mobile-menu-actions">
                  {onToggleList && (
                    <MenuAction onClick={onToggleList}>
                      {showList ? 'Hide building list' : 'Show building list'}
                    </MenuAction>
                  )}
                  {onToggleZoning && (
                    <MenuAction onClick={onToggleZoning} disabled={zoningLoading}>
                      {zoningLoading
                        ? 'Loading planning...'
                        : zoningEnabled
                          ? 'Hide planning overlay'
                          : 'Show planning overlay'}
                    </MenuAction>
                  )}
                  <MenuAction onClick={onExport}>Export current CityJSON</MenuAction>
                </div>
                <div className="app-toolbar__more-validation grid gap-1">
                  {integrity && (
                    <Button size="sm" variant="ghost" onClick={integrity.onShow}>
                      {integrity.errorCount > 0
                        ? `Structure: ${integrity.errorCount} errors`
                        : integrity.warningCount > 0
                          ? `Structure: ${integrity.warningCount} warnings`
                          : 'Structure: valid'}
                    </Button>
                  )}
                  {primitiveValidation && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={primitiveValidation.onValidate}
                      disabled={primitiveValidation.kind === 'checking'}
                    >
                      {primitiveValidation.kind === 'checking'
                        ? 'Checking 3D geometry…'
                        : primitiveValidation.kind === 'valid'
                          ? '3D geometry: valid'
                          : 'Check 3D geometry'}
                    </Button>
                  )}
                </div>
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
