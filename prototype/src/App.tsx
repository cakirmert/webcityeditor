import { useCallback, useMemo, useState } from 'react';
import Toolbar from './components/Toolbar';
import FileLoader from './components/FileLoader';
import MapView from './components/MapView';
import Viewer from './components/Viewer';
import AttributePanel from './components/AttributePanel';
import NewBuildingDialog, { type NewBuildingForm } from './components/NewBuildingDialog';
// `NewBuildingForm` shape is re-used by App to carry the live-updating dialog state.
import { filterToBuilding } from './lib/footprints';
import { saveDocument } from './lib/storage';
import { generateBuilding, insertBuilding } from './lib/generator';
import { detectCrs } from './lib/projection';
import { splitBuildingByFloor, splitBuildingBySide } from './lib/subdivision';
import { moveBuilding, rotateBuilding } from './lib/transform';
import {
  computeTransformedFootprint,
  type PendingTransform,
} from './lib/transform-preview';
import { buildPreviewMesh } from './lib/preview-mesh';
import type { AttributeValue, CityJsonDocument, SelectionInfo } from './types';

export default function App() {
  const [cityjson, setCityjson] = useState<CityJsonDocument | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [drawMode, setDrawMode] = useState<'none' | 'polygon'>('none');
  const [pendingFootprint, setPendingFootprint] = useState<[number, number][] | null>(null);
  const [pendingForm, setPendingForm] = useState<NewBuildingForm | null>(null);
  const [sidePanelFullscreen, setSidePanelFullscreen] = useState(false);
  /** Live-preview state for translating/rotating a building before committing. */
  const [pendingTransform, setPendingTransform] = useState<PendingTransform | null>(null);

  // Snapshot of original attributes per-building, for revert.
  const [originals] = useState<Map<string, Record<string, AttributeValue>>>(new Map());

  const handleLoaded = useCallback(
    (doc: CityJsonDocument, name: string) => {
      setCityjson(doc);
      setFileName(name);
      setSelection(null);
      setDirtyIds(new Set());
      originals.clear();
    },
    [originals]
  );

  const handleSelect = useCallback(
    (info: SelectionInfo | null) => {
      setSelection(info);
      if (info && cityjson && !originals.has(info.objectId)) {
        const obj = cityjson.CityObjects[info.objectId];
        originals.set(info.objectId, { ...(obj?.attributes ?? {}) });
      }
    },
    [cityjson, originals]
  );

  const handleAttributeChange = useCallback(
    (id: string, key: string, value: AttributeValue) => {
      if (!cityjson) return;
      const obj = cityjson.CityObjects[id];
      if (!obj) return;
      if (!obj.attributes) obj.attributes = {};
      obj.attributes[key] = value;
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [cityjson]
  );

  const handleRevert = useCallback(
    (id: string) => {
      if (!cityjson) return;
      const snap = originals.get(id);
      if (!snap) return;
      cityjson.CityObjects[id].attributes = { ...snap };
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelection((s) => (s ? { ...s } : s));
    },
    [cityjson, originals]
  );

  const handleReloadView = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  const handleSplitByFloor = useCallback(
    (id: string, floorCount: number) => {
      if (!cityjson) return;
      try {
        const { partIds } = splitBuildingByFloor(cityjson, id, floorCount);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson]
  );

  const handleSplitBySide = useCallback(
    (id: string, partCount: number) => {
      if (!cityjson) return;
      try {
        const { partIds } = splitBuildingBySide(cityjson, id, partCount);
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          for (const p of partIds) next.add(p);
          return next;
        });
        setReloadToken((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [cityjson]
  );

  // Enter "edit position" mode for a building. While active, dX/dY/angle are
  // held in pendingTransform and the map renders a ghost preview. Nothing is
  // written to the CityJSON until the user clicks Save.
  const handleStartTransform = useCallback((id: string) => {
    setPendingTransform({ id, dx: 0, dy: 0, angle: 0 });
  }, []);

  const handleUpdateTransform = useCallback(
    (patch: Partial<Omit<PendingTransform, 'id'>>) => {
      setPendingTransform((cur) => (cur ? { ...cur, ...patch } : cur));
    },
    []
  );

  const handleCancelTransform = useCallback(() => {
    setPendingTransform(null);
  }, []);

  const handleSaveTransform = useCallback(() => {
    if (!cityjson || !pendingTransform) return;
    const { id, dx, dy, angle } = pendingTransform;
    try {
      // Order: rotate first (around centroid), then translate. Matches what the
      // live preview does in computeTransformedFootprint.
      if (angle !== 0) rotateBuilding(cityjson, id, angle);
      if (dx !== 0 || dy !== 0) moveBuilding(cityjson, id, dx, dy, 0);
      if (angle !== 0 || dx !== 0 || dy !== 0) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setReloadToken((t) => t + 1);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingTransform(null);
    }
  }, [cityjson, pendingTransform]);

  const handleStartDraw = useCallback(() => {
    setSelection(null);
    setDrawMode('polygon');
  }, []);

  const handleCancelDraw = useCallback(() => {
    setDrawMode('none');
    setPendingFootprint(null);
    setPendingForm(null);
  }, []);

  const handleFootprintDrawn = useCallback((ring: [number, number][]) => {
    setDrawMode('none');
    setPendingFootprint(ring);
  }, []);

  const handleCreateBuilding = useCallback(
    (form: NewBuildingForm) => {
      if (!cityjson || !pendingFootprint) return;
      const crs = detectCrs(cityjson);
      if (!crs.supported) {
        alert(`Can't generate: CRS ${crs.code} isn't supported. Add a proj4 def.`);
        setPendingFootprint(null);
        setPendingForm(null);
        return;
      }
      try {
        const ridgeHeight = form.totalHeight;
        const eaveHeight =
          form.roofType === 'flat' ? form.totalHeight : form.totalHeight - form.roofHeight;
        const result = generateBuilding(cityjson, {
          targetCrs: crs.code,
          footprintWgs84: pendingFootprint,
          storeys: form.storeys,
          eaveHeight,
          ridgeHeight,
          roofType: form.roofType,
          attributes: {
            function: form.function,
            yearOfConstruction: form.yearOfConstruction,
          },
        });
        const id = insertBuilding(cityjson, result);
        const newIds = new Set([id]);
        // Apply the optional split-on-create immediately.
        if (form.splitMode === 'floors') {
          try {
            const { partIds } = splitBuildingByFloor(cityjson, id, form.splitCount);
            for (const p of partIds) newIds.add(p);
          } catch (e) {
            alert(
              `Building created but split-by-floor failed: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        } else if (form.splitMode === 'sides') {
          try {
            const { partIds } = splitBuildingBySide(cityjson, id, form.splitCount);
            for (const p of partIds) newIds.add(p);
          } catch (e) {
            alert(
              `Building created but split-by-side failed: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        }
        setDirtyIds((prev) => {
          const next = new Set(prev);
          for (const nid of newIds) next.add(nid);
          return next;
        });
        setReloadToken((t) => t + 1);
        setSelection({ objectId: id });
      } catch (e) {
        console.error(e);
        alert(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setPendingFootprint(null);
        setPendingForm(null);
      }
    },
    [cityjson, pendingFootprint]
  );

  const handleSaveLocal = useCallback(async () => {
    if (!cityjson || !fileName) return;
    setSaveStatus('saving');
    try {
      await saveDocument(fileName, cityjson);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('Local save failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }, [cityjson, fileName]);

  const handleExport = useCallback(() => {
    if (!cityjson) return;
    const text = JSON.stringify(cityjson);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = fileName.replace(/\.city\.json$|\.json$/i, '') || 'export';
    a.download = `${base}.modified.city.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [cityjson, fileName]);

  const handleReset = useCallback(() => {
    setCityjson(null);
    setFileName('');
    setSelection(null);
    setDirtyIds(new Set());
    originals.clear();
  }, [originals]);

  const stats = useMemo(() => {
    if (!cityjson) return null;
    const ids = Object.keys(cityjson.CityObjects);
    const rootBuildings = ids.filter((id) => {
      const o = cityjson.CityObjects[id];
      return (
        (o.type === 'Building' ||
          o.type === 'Bridge' ||
          o.type === 'CityObjectGroup' ||
          o.type === 'Tunnel') &&
        !o.parents
      );
    });
    return {
      version: cityjson.version,
      totalObjects: ids.length,
      rootBuildings: rootBuildings.length,
      vertices: cityjson.vertices.length,
      crs: cityjson.metadata?.referenceSystem ?? null,
    };
  }, [cityjson]);

  // Derived: filtered sub-document for the selected building
  const filteredForSelected = useMemo(() => {
    if (!cityjson || !selection) return null;
    return filterToBuilding(cityjson, selection.objectId);
  }, [cityjson, selection, reloadToken]);

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        stats={stats}
        dirtyCount={dirtyIds.size}
        hasData={!!cityjson}
        onExport={handleExport}
        onReloadView={handleReloadView}
        onNewFile={handleReset}
        onSaveLocal={handleSaveLocal}
        saveStatus={saveStatus}
        drawMode={drawMode}
        onStartDraw={handleStartDraw}
        onCancelDraw={handleCancelDraw}
      />
      <div className="main">
        <div className="viewer-host">
          {cityjson ? (
            <MapView
              cityjson={cityjson}
              selectedId={selection?.objectId ?? null}
              onSelect={handleSelect}
              reloadToken={reloadToken}
              drawMode={drawMode}
              onFootprintDrawn={handleFootprintDrawn}
              onDrawCanceled={handleCancelDraw}
              preview={
                pendingFootprint && pendingForm
                  ? {
                      // Mesh-based preview gives the user the actual roof shape
                      // in real time; falls back to polygon extrusion if the
                      // target CRS isn't recognised by proj4.
                      mesh:
                        buildPreviewMesh({
                          footprintWgs84: pendingFootprint,
                          targetCrs: detectCrs(cityjson).code,
                          eaveHeight:
                            pendingForm.roofType === 'flat'
                              ? pendingForm.totalHeight
                              : pendingForm.totalHeight - pendingForm.roofHeight,
                          ridgeHeight: pendingForm.totalHeight,
                          roofType: pendingForm.roofType,
                        }) ?? undefined,
                      polygon: pendingFootprint,
                      height: pendingForm.totalHeight,
                    }
                  : pendingTransform
                  ? (() => {
                      const t = computeTransformedFootprint(cityjson, pendingTransform);
                      return t ? { polygon: t.polygon, height: t.height } : null;
                    })()
                  : null
              }
            />
          ) : (
            <FileLoader onLoaded={handleLoaded} />
          )}
          {pendingFootprint && (
            <NewBuildingDialog
              vertexCount={pendingFootprint.length}
              onFormChange={setPendingForm}
              onCreate={handleCreateBuilding}
              onCancel={handleCancelDraw}
            />
          )}
        </div>

        {cityjson && selection && filteredForSelected && (
          <aside className={`side-panel ${sidePanelFullscreen ? 'fullscreen' : ''}`}>
            <div className="panel-header">
              <h3>
                {dirtyIds.has(selection.objectId) && <span className="dirty-dot" />}
                {cityjson.CityObjects[selection.objectId]?.type ?? 'Unknown'}
              </h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setSidePanelFullscreen((f) => !f)}
                  aria-label={sidePanelFullscreen ? 'Collapse' : 'Fullscreen'}
                  title={sidePanelFullscreen ? 'Collapse side panel' : 'Fullscreen side panel'}
                  style={{ padding: '2px 8px' }}
                >
                  {sidePanelFullscreen ? '⇲' : '⇱'}
                </button>
                <button
                  onClick={() => {
                    setSelection(null);
                    setSidePanelFullscreen(false);
                  }}
                  aria-label="Close"
                  style={{ padding: '2px 8px' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="building-viewer-host">
              <Viewer
                cityjson={filteredForSelected}
                reloadToken={reloadToken}
                onSelect={() => {}}
              />
            </div>

            <AttributePanelInline
              buildingId={selection.objectId}
              cityjson={cityjson}
              isDirty={dirtyIds.has(selection.objectId)}
              onAttributeChange={handleAttributeChange}
              onRevert={handleRevert}
              onSplitByFloor={handleSplitByFloor}
              onSplitBySide={handleSplitBySide}
              pendingTransform={
                pendingTransform?.id === selection.objectId ? pendingTransform : null
              }
              onStartTransform={handleStartTransform}
              onUpdateTransform={handleUpdateTransform}
              onCancelTransform={handleCancelTransform}
              onSaveTransform={handleSaveTransform}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// Attribute panel without its own header (the parent aside owns the header now).
function AttributePanelInline(props: {
  buildingId: string;
  cityjson: CityJsonDocument;
  isDirty: boolean;
  onAttributeChange: (id: string, key: string, value: AttributeValue) => void;
  onRevert: (id: string) => void;
  onSplitByFloor: (id: string, floorCount: number) => void;
  onSplitBySide: (id: string, partCount: number) => void;
  pendingTransform: PendingTransform | null;
  onStartTransform: (id: string) => void;
  onUpdateTransform: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform: () => void;
  onSaveTransform: () => void;
}) {
  return (
    <AttributePanel
      buildingId={props.buildingId}
      cityjson={props.cityjson}
      isDirty={props.isDirty}
      onAttributeChange={props.onAttributeChange}
      onRevert={props.onRevert}
      onClose={() => {}}
      onSplitByFloor={props.onSplitByFloor}
      onSplitBySide={props.onSplitBySide}
      pendingTransform={props.pendingTransform}
      onStartTransform={props.onStartTransform}
      onUpdateTransform={props.onUpdateTransform}
      onCancelTransform={props.onCancelTransform}
      onSaveTransform={props.onSaveTransform}
      hideHeader
    />
  );
}
