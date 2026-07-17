import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import FileLoader from './components/FileLoader';
import MapView from './components/MapView';
import Viewer from './components/Viewer';
import AttributePanel from './components/AttributePanel';
import BuildingCreator from './components/BuildingCreator';
import RoadEditorPanel from './components/RoadEditorPanel';
import FilterBar from './components/FilterBar';
import BuildingListPanel from './components/BuildingListPanel';

// Hooks
import { useCoreState } from './hooks/useCoreState';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useCatalog } from './hooks/useCatalog';
import { useImportExport } from './hooks/useImportExport';
import { useRoadEditor } from './hooks/useRoadEditor';
import { useBuildingEditor } from './hooks/useBuildingEditor';

// Libs
import { extractFootprints, filterToBuilding } from './lib/footprints';
import { matchingIds, isFilterEmpty, applyFilter } from './lib/filter';
import { estimateTerrainSnap } from './lib/terrain';
import { buildPreviewMesh } from './lib/preview-mesh';
import { computeTransformedFootprint } from './lib/transform-preview';
import { detectCrs } from './lib/projection';
import {
  parseCityJsonSeqStrict,
  type CityJsonSeqViewportLoad,
} from './lib/cityjsonseq-catalog';
import { publicAssetUrl } from './lib/public-assets';
import {
  fetchPlanningZones,
  getPlanningProviderForBbox,
  planningCoverageSummary,
  planningSourceLabel,
  type ParcelZone,
  type Wgs84Bbox,
} from './lib/zoning';

// Types
import type { AttributeValue, CityJsonDocument, SelectionInfo } from './types';
import type { FloorPlanDivision, SplitAxis } from './lib/subdivision';
import type { IfcImportResult } from './lib/ifc-import';
import type { PendingTransform } from './lib/transform-preview';

const HAMBURG_CITY_CENTER: [number, number] = [9.9937, 53.5511];
const HAMBURG_OVERVIEW_ZOOM = 9.75;
const HAMBURG_CITY_CENTER_DEMO_URL =
  'data/hamburg/hamburg-city-center-buildings.city.jsonl';
const HAMBURG_CITY_CENTER_DEMO_NAME = 'hamburg-city-center-buildings.city.jsonl';
const HAMBURG_CITY_CENTER_OSM_URL = 'data/hamburg/hamburg-city-center-roads.osm';
const HAMBURG_CITY_CENTER_DEMO_BBOX: Wgs84Bbox = [9.978, 53.5395, 10.0035, 53.5545];

export default function App() {
  const coreState = useCoreState();
  const undoRedo = useUndoRedo(coreState);
  const catalog = useCatalog(coreState, undoRedo);
  const importExport = useImportExport(coreState, undoRedo, catalog);

  const [sidePanelWide, setSidePanelWide] = useState(false);
  const autoHamburgLoadStartedRef = useRef(false);
  const [autoHamburgStatus, setAutoHamburgStatus] = useState<{
    kind: 'loading' | 'error';
    message: string;
  } | null>(null);

  // ── Planning layer (zones) ────────────────────────────────────────────────
  const [zones, setZones] = useState<ParcelZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ParcelZone | null>(null);
  const [zoningEnabled, setZoningEnabled] = useState(false);
  const [zoningLoading, setZoningLoading] = useState(false);
  const planningAbortRef = useRef<AbortController | null>(null);
  const planningRequestIdRef = useRef(0);

  const handleToggleZoning = useCallback(async () => {
    if (!coreState.cityjson || zoningLoading) return;

    const queryBbox = choosePlanningQueryBbox({
      viewportBbox: coreState.mapBboxRef.current,
      footprintBbox: computeFootprintBbox(extractFootprints(coreState.cityjson)),
    });
    if (!queryBbox) {
      alert('Could not derive a map bbox for the planning query.');
      return;
    }
    if (!getPlanningProviderForBbox(queryBbox)) {
      const coverage = planningCoverageSummary();
      alert(
        `No planning overlay provider is available for this area yet${
          coverage ? `. Current coverage: ${coverage}.` : '.'
        }`
      );
      return;
    }

    planningAbortRef.current?.abort();
    const controller = new AbortController();
    planningAbortRef.current = controller;
    const requestId = planningRequestIdRef.current + 1;
    planningRequestIdRef.current = requestId;
    const sourceCityJson = coreState.cityjson;
    const fetchWithSignal: typeof fetch = (input, init) =>
      fetch(input, { ...init, signal: controller.signal });

    setZoningLoading(true);
    try {
      const nextZones = await fetchPlanningZones(queryBbox, fetchWithSignal);
      if (
        planningRequestIdRef.current !== requestId ||
        coreState.cityjsonRef.current !== sourceCityJson
      ) {
        return;
      }
      if (nextZones.length === 0) {
        alert('No planning polygons returned for this viewport.');
        return;
      }
      setZones(nextZones);
      setSelectedZone(null);
      setZoningEnabled(true);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error(e);
      alert(`Planning layer failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (planningRequestIdRef.current === requestId) {
        planningAbortRef.current = null;
        setZoningLoading(false);
      }
    }
  }, [coreState.cityjson, coreState.cityjsonRef, coreState.mapBboxRef, zoningLoading]);

  const handleHideZoning = useCallback(() => {
    planningRequestIdRef.current += 1;
    planningAbortRef.current?.abort();
    planningAbortRef.current = null;
    setZoningLoading(false);
    setZoningEnabled(false);
    setZones([]);
    setSelectedZone(null);
  }, []);

  useEffect(
    () => () => {
      planningRequestIdRef.current += 1;
      planningAbortRef.current?.abort();
    },
    []
  );

  const handleZoneSelect = useCallback((zone: ParcelZone) => {
    setSelectedZone(zone);
  }, []);

  const roadEditor = useRoadEditor(coreState, undoRedo, {
    zones: zoningEnabled ? zones : [],
  });
  const buildingEditor = useBuildingEditor(coreState, undoRedo, { zones, zoningEnabled });

  const handleLoadedForApp = useCallback(
    (doc: CityJsonDocument, fileName: string, rawText: string | null) => {
      setAutoHamburgStatus(null);
      roadEditor.clearOsmRoadData();
      importExport.handleLoaded(doc, fileName, rawText);
    },
    [importExport.handleLoaded, roadEditor.clearOsmRoadData]
  );

  const handleCatalogLoadedForApp = useCallback(
    (
      loaded: CityJsonSeqViewportLoad,
      catalogUrl: string,
      options: { loadMode?: 'viewport' | 'all' } = {}
    ) => {
      setAutoHamburgStatus(null);
      roadEditor.clearOsmRoadData();
      importExport.handleCatalogLoaded(loaded, catalogUrl, options);
      if (options.loadMode === 'all' && loaded.doc) {
        roadEditor.setRoadStatus(
          `Loaded ${loaded.tiles.length} Hamburg catalog tile${loaded.tiles.length === 1 ? '' : 's'}. Open Roads and click Fetch / Recalculate View when you want OSM roads.`
        );
      }
    },
    [
      importExport.handleCatalogLoaded,
      roadEditor.clearOsmRoadData,
      roadEditor.setRoadStatus,
    ]
  );

  useEffect(() => {
    if (autoHamburgLoadStartedRef.current || coreState.cityjson) return;
    autoHamburgLoadStartedRef.current = true;
    setAutoHamburgStatus({
      kind: 'loading',
      message: 'Loading the Hamburg city-center buildings and roads demo...',
    });
    catalog.setCatalogStatus({
      kind: 'loading',
      message: 'Loading the committed Hamburg city-center demo...',
    });
    importExport.setLoadModalOpen(false);

    void (async () => {
      try {
        const [buildingResult, osmResult] = await Promise.allSettled([
          fetch(publicAssetUrl(HAMBURG_CITY_CENTER_DEMO_URL)),
          fetch(publicAssetUrl(HAMBURG_CITY_CENTER_OSM_URL)),
        ]);
        if (buildingResult.status === 'rejected') throw buildingResult.reason;
        const response = buildingResult.value;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const doc = parseCityJsonSeqStrict(text, HAMBURG_CITY_CENTER_DEMO_NAME);
        handleLoadedForApp(doc, HAMBURG_CITY_CENTER_DEMO_NAME, text);
        coreState.setPrimitiveValidation({
          kind: 'valid',
          message:
            'The committed Hamburg building demo was generated from the validated LoD2 catalog.',
        });

        try {
          if (osmResult.status === 'rejected') throw osmResult.reason;
          const osmResponse = osmResult.value;
          if (!osmResponse.ok) {
            throw new Error(`HTTP ${osmResponse.status} ${osmResponse.statusText}`);
          }
          await roadEditor.loadOsmRoadXml(
            await osmResponse.text(),
            HAMBURG_CITY_CENTER_DEMO_BBOX,
            {
              sourceLabel: 'the committed Hamburg center OSM crop',
              showBoundary: false,
              echoDiagnostics: false,
            }
          );
        } catch (roadError) {
          roadEditor.setRoadStatus(
            `The committed demo roads could not be processed: ${
              roadError instanceof Error ? roadError.message : String(roadError)
            }. Use Fetch Roads to retry.`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        catalog.setCatalogStatus({
          kind: 'error',
          message: `Hamburg demo auto-load failed: ${message}`,
        });
        setAutoHamburgStatus({
          kind: 'error',
          message: `Hamburg demo auto-load failed: ${message}. Use Data to load another CityJSON file.`,
        });
        importExport.setLoadModalOpen(true);
      }
    })();
  }, [
    catalog,
    coreState,
    handleLoadedForApp,
    importExport,
    roadEditor.loadOsmRoadXml,
    roadEditor.setRoadStatus,
  ]);

  const handleMapViewportChange = useCallback(
    (bbox: Wgs84Bbox) => {
      // Several tools need the live WGS84 viewport: catalog streaming, planning
      // overlays, and OSM road fetches. Keep the shared core ref current, then
      // let the catalog hook decide whether it needs to load more sequence tiles.
      coreState.mapBboxRef.current = bbox;
      catalog.handleViewportChange(bbox);
    },
    [catalog.handleViewportChange, coreState.mapBboxRef]
  );

  const handleToggleRoadEditor = useCallback(() => {
    roadEditor.setShowRoadEditor((isOpen) => {
      const nextOpen = !isOpen;
      if (nextOpen) {
        // The data loader is a full-screen modal. Close it before opening the
        // road editor so the toolbar action always produces a visible panel.
        importExport.setLoadModalOpen(false);
        roadEditor.setRoadStatus(
          (current) => current ?? 'Road editor ready. Fetch OSM roads or draw a road manually.'
        );
      } else if (coreState.drawMode === 'road-line') {
        coreState.setDrawMode('none');
      }
      return nextOpen;
    });
  }, [coreState, importExport, roadEditor]);

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z, Ctrl+C / Ctrl+V, Delete, Backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        buildingEditor.handleDelete();
        return;
      }
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) undoRedo.handleRedo();
        else undoRedo.handleUndo();
      } else if (e.key === 'y') {
        e.preventDefault();
        undoRedo.handleRedo();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        buildingEditor.handleCopy();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        buildingEditor.handlePaste();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoRedo, buildingEditor]);

  // Derived properties
  const footprintsForFilter = useMemo(() => {
    if (!coreState.cityjson) return [];
    return extractFootprints(coreState.cityjson);
  }, [coreState.cityjson, coreState.reloadToken]);

  const filteredIds = useMemo(
    () => matchingIds(footprintsForFilter, coreState.filter),
    [footprintsForFilter, coreState.filter]
  );

  const filteredFootprints = useMemo(
    () => applyFilter(footprintsForFilter, coreState.filter),
    [footprintsForFilter, coreState.filter]
  );

  const filterIsEmpty = isFilterEmpty(coreState.filter);

  const stats = useMemo(() => {
    const doc = coreState.cityjson;
    if (!doc) return null;
    const ids = Object.keys(doc.CityObjects);
    const rootBuildings = ids.filter((id) => {
      const o = doc.CityObjects[id];
      return (
        (o.type === 'Building' ||
          o.type === 'Bridge' ||
          o.type === 'CityObjectGroup' ||
          o.type === 'Tunnel') &&
        !o.parents
      );
    });
    return {
      version: doc.version,
      totalObjects: ids.length,
      rootBuildings: rootBuildings.length,
      vertices: doc.vertices.length,
      crs: doc.metadata?.referenceSystem ?? null,
    };
  }, [coreState.cityjson]);

  const filteredForSelected = useMemo(() => {
    if (!coreState.cityjson || !coreState.selection) return null;
    return filterToBuilding(coreState.cityjson, coreState.selection.objectId);
  }, [coreState.cityjson, coreState.selection, coreState.reloadToken]);

  const initialMapView = useMemo(
    () =>
      readInitialMapView(coreState.cityjson) ??
      (catalog.catalogConnection
        ? {
            center: HAMBURG_CITY_CENTER,
            zoom: HAMBURG_OVERVIEW_ZOOM,
            disableDataFit: true,
          }
        : undefined),
    [catalog.catalogConnection, coreState.cityjson]
  );

  const handleSelect = useCallback(
    (info: SelectionInfo | null) => {
      if (info?.ctrlKey) {
        buildingEditor.setMultiSelection((prev) => {
          const next = new Set(prev);
          if (next.has(info.objectId)) next.delete(info.objectId);
          else next.add(info.objectId);
          return next;
        });
        if (!coreState.selection) coreState.setSelection(info);
        return;
      }
      coreState.setSelection(info);
      if (!info?.ctrlKey) buildingEditor.setMultiSelection(new Set());
      if (info && coreState.cityjson && !coreState.originals.has(info.objectId)) {
        const obj = coreState.cityjson.CityObjects[info.objectId];
        coreState.originals.set(info.objectId, { ...(obj?.attributes ?? {}) });
      }
    },
    [coreState, buildingEditor]
  );

  const handleAttributeChange = useCallback(
    (id: string, key: string, value: AttributeValue) => {
      if (!coreState.cityjson) return;
      const obj = coreState.cityjson.CityObjects[id];
      if (!obj) return;
      const prev = obj.attributes?.[key];
      if (prev === value) return;
      undoRedo.pushUndo(`Edit ${id}.${key}`);
      if (!obj.attributes) obj.attributes = {};
      obj.attributes[key] = value;
      coreState.setDirtyIds((prevSet) => {
        const next = new Set(prevSet);
        next.add(id);
        return next;
      });
    },
    [coreState, undoRedo]
  );

  const handleRevert = useCallback(
    (id: string) => {
      if (!coreState.cityjson) return;
      const snap = coreState.originals.get(id);
      if (!snap) return;
      coreState.cityjson.CityObjects[id].attributes = { ...snap };
      coreState.setDirtyIds((prevSet) => {
        const next = new Set(prevSet);
        next.delete(id);
        return next;
      });
      coreState.setSelection((s) => (s ? { ...s } : s));
    },
    [coreState]
  );

  const autoHamburgLoading = autoHamburgStatus?.kind === 'loading';
  const showFileLoader =
    importExport.loadModalOpen || (!coreState.cityjson && !autoHamburgLoading);

  return (
    <div className="app">
      <Toolbar
        fileName={coreState.fileName}
        stats={stats}
        dirtyCount={coreState.dirtyIds.size}
        hasData={!!coreState.cityjson}
        onExport={importExport.handleExport}
        onExportGltf={importExport.handleExportGltf}
        integrity={
          importExport.integrity
            ? {
                errorCount: importExport.integrity.counts.error,
                warningCount: importExport.integrity.counts.warning,
                onShow: importExport.handleShowIntegrity,
              }
            : undefined
        }
        orphanedVertexCount={importExport.integrity?.summary.orphanedVertices ?? 0}
        onCompactVertices={importExport.handleCompactVertices}
        undoState={undoRedo.undoState}
        showList={coreState.showList}
        onToggleList={() => coreState.setShowList((v) => !v)}
        onMergeFile={importExport.handleMergeFile}
        onImportIfc={buildingEditor.handleImportIfc}
        ifcParsing={buildingEditor.ifcParsing}
        onReloadView={() => coreState.setReloadToken((t) => t + 1)}
        onOpenLoader={() => importExport.setLoadModalOpen(true)}
        onSaveLocal={importExport.handleSaveLocal}
        saveStatus={coreState.saveStatus}
        drawMode={coreState.drawMode}
        onStartDraw={() => {
          coreState.setSelection(null);
          roadEditor.setRoadStatus(null);
          buildingEditor.setCreationError(null);
          coreState.setDrawMode('polygon');
        }}
        onCancelDraw={() => {
          coreState.setDrawMode('none');
          buildingEditor.setPendingFootprint(null);
          buildingEditor.setPendingForm(null);
          buildingEditor.setCreationError(null);
        }}
        roadEditorOpen={roadEditor.showRoadEditor}
        onToggleRoadEditor={handleToggleRoadEditor}
        onCopy={buildingEditor.handleCopy}
        onPaste={buildingEditor.handlePaste}
        canCopy={!!coreState.selection || buildingEditor.multiSelection.size > 0}
        canPaste={!!buildingEditor.clipboardIds && buildingEditor.clipboardIds.size > 0}
        onDelete={buildingEditor.handleDelete}
        canDelete={!!coreState.selection || buildingEditor.multiSelection.size > 0}
        zoningEnabled={zoningEnabled}
        zoningLoading={zoningLoading}
        onToggleZoning={handleToggleZoning}
        onFilterViewport={importExport.handleReloadViewport}
        canFilterViewport={!!importExport.seqRawText}
        catalogState={
          catalog.catalogConnection
            ? {
                loadedTiles: catalog.catalogConnection.loadedTiles.size,
                loading: catalog.catalogStatus.kind === 'loading',
                dirty: coreState.dirtyIds.size > 0,
                error: catalog.catalogStatus.kind === 'error' ? catalog.catalogStatus.message : undefined,
                message: catalog.catalogStatus.message,
              }
            : undefined
        }
        primitiveValidation={{
          ...coreState.primitiveValidation,
          onValidate: () => void importExport.handleValidateGeometry(),
        }}
        onLoadCatalogViewport={
          catalog.catalogConnection
            ? () => {
                const bbox = catalog.mapBboxRef.current;
                if (bbox) void catalog.loadCatalogViewport(bbox);
                else alert('Map viewport is not ready yet.');
              }
            : undefined
        }
        onPersistCatalog={catalog.catalogConnection ? catalog.handlePersistCatalog : undefined}
      />
      {coreState.cityjson && footprintsForFilter.length > 0 && (
        <FilterBar
          footprints={footprintsForFilter}
          filter={coreState.filter}
          onChange={coreState.setFilter}
          matchCount={filteredIds.size}
        />
      )}
      <div className="main">
        {coreState.showList && coreState.cityjson && footprintsForFilter.length > 0 && (
          <BuildingListPanel
            filteredFootprints={filteredFootprints}
            totalCount={footprintsForFilter.length}
            selectedId={coreState.selection?.objectId ?? null}
            onSelect={(id) => coreState.setSelection({ objectId: id })}
            onClose={() => coreState.setShowList(false)}
          />
        )}
        <div className="viewer-host" style={{ position: 'relative' }}>
          {buildingEditor.ifcPending && (
            <IfcPlacementBanner
              parsed={buildingEditor.ifcPending.parsed}
              fileName={buildingEditor.ifcPending.fileName}
              onCancel={buildingEditor.handleCancelIfcPlacement}
            />
          )}
          {zoningEnabled && zones.length > 0 && (
            <ZoneLegend
              zones={zones}
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone}
              onClearSelected={() => setSelectedZone(null)}
              onHide={handleHideZoning}
            />
          )}
          {roadEditor.showRoadEditor && (
            <RoadEditorPanel
              osmRoads={roadEditor.osmRoads}
              selectedOsmRoadId={roadEditor.selectedOsmRoadId}
              draft={roadEditor.roadDraft}
              draftDirty={roadEditor.roadDraftDirty}
              editingRoadId={roadEditor.editingRoadId}
              status={roadEditor.roadStatus}
              basemap={roadEditor.basemap}
              drawMode={coreState.drawMode}
              backendUrl={roadEditor.roadBackendUrl}
              insertedRoadId={roadEditor.editingRoadId ?? roadEditor.lastInsertedRoadId}
              onClose={() => roadEditor.setShowRoadEditor(false)}
              onFetchOsmRoads={() => void roadEditor.handleFetchOsmRoads()}
              onBasemapChange={roadEditor.setBasemap}
              onStartManualDraw={roadEditor.handleStartRoadDraw}
              onFinishManualDraw={() => roadEditor.setFinishRoadDrawToken((token) => token + 1)}
              onCancelDraw={() => {
                coreState.setDrawMode('none');
                buildingEditor.setPendingFootprint(null);
                buildingEditor.setPendingForm(null);
                buildingEditor.setCreationError(null);
              }}
              onCancelEdit={roadEditor.handleCancelRoadEdit}
              onDraftChange={roadEditor.handleRoadDraftChange}
              onSplitDraft={roadEditor.handleSplitRoadDraft}
              onInsertRoad={roadEditor.handleInsertRoad}
              onExportPayload={roadEditor.handleExportRoadPayload}
              onPostPayload={() => void roadEditor.handlePostRoadPayload()}
              onBackendUrlChange={roadEditor.setRoadBackendUrl}
              roadFitConflicts={roadEditor.roadFitConflicts}
              selectedRoadArea={roadEditor.selectedRoadArea}
              onEditSelectedRoadArea={roadEditor.handleEditSelectedRoadArea}
              osm2streetsSelection={roadEditor.osm2streetsSelection}
              onCreateDraftFromOsm2StreetsSelection={
                roadEditor.handleCreateDraftFromOsm2StreetsSelection
              }
              onInsertOsm2StreetsSelection={roadEditor.handleInsertOsm2StreetsSelection}
              onHighlightConnectedOsm2StreetsRoads={
                roadEditor.handleHighlightConnectedOsm2StreetsRoads
              }
              onClearOsm2StreetsSelection={roadEditor.handleClearOsm2StreetsSelection}
            />
          )}
          {coreState.cityjson ? (
            <MapView
              cityjson={coreState.cityjson}
              selectedId={coreState.selection?.objectId ?? null}
              onSelect={handleSelect}
              reloadToken={coreState.reloadToken}
              precomputedFootprints={footprintsForFilter}
              initialView={initialMapView}
              drawMode={coreState.drawMode}
              onFootprintDrawn={buildingEditor.setPendingFootprint}
              onRoadLineDrawn={roadEditor.handleRoadLineDrawn}
              finishRoadDrawToken={roadEditor.finishRoadDrawToken}
              onDrawCanceled={() => {
                coreState.setDrawMode('none');
                buildingEditor.setPendingFootprint(null);
                buildingEditor.setPendingForm(null);
                buildingEditor.setCreationError(null);
              }}
              filteredIds={filterIsEmpty ? null : filteredIds}
              onPlacementClick={buildingEditor.ifcPending ? buildingEditor.handleIfcPlacement : undefined}
              onViewportChange={handleMapViewportChange}
              dragTransformId={buildingEditor.pendingTransform?.id ?? null}
              onDragMove={buildingEditor.handleDragMove}
              multiSelectedIds={buildingEditor.multiSelection.size > 0 ? buildingEditor.multiSelection : null}
              zones={zoningEnabled ? zones : []}
              onZoneSelect={handleZoneSelect}
              basemap={roadEditor.basemap}
              roadAreas={roadEditor.roadAreas}
              roadPreviewAreas={roadEditor.roadPreviewAreas}
              roadFitConflicts={roadEditor.roadFitConflicts}
              selectedRoadAreaId={roadEditor.selectedRoadArea?.id ?? null}
              onRoadAreaSelect={(area) => {
                roadEditor.setSelectedRoadArea(area);
                handleSelect({ objectId: area.roadId });
              }}
              roadDraft={roadEditor.roadDraft}
              onRoadDraftChange={roadEditor.handleRoadDraftChange}
              osmRoads={roadEditor.osmRoads}
              osmPointFeatures={roadEditor.osmPointFeatures}
              selectedOsmRoadId={roadEditor.selectedOsmRoadId}
              onOsmRoadSelect={roadEditor.handleOsmRoadSelect}
              osm2streetsResult={roadEditor.osm2streetsResult}
              osm2streetsBbox={roadEditor.osm2streetsBbox}
              osm2streetsSelection={roadEditor.osm2streetsSelection}
              highlightedOsm2StreetsRoadIds={roadEditor.highlightedOsm2StreetsRoadIds}
              onOsm2StreetsSelect={roadEditor.handleOsm2StreetsSelect}
              footprintEdit={
                buildingEditor.footprintEdit
                  ? {
                      buildingId: buildingEditor.footprintEdit.buildingId,
                      footprintWgs84: buildingEditor.footprintEdit.initialFootprint,
                    }
                  : null
              }
              onFootprintChange={buildingEditor.handleFootprintChange}
              preview={
                buildingEditor.pendingFootprint && buildingEditor.pendingForm
                  ? {
                      mesh:
                        buildPreviewMesh({
                          footprintWgs84: buildingEditor.pendingFootprint,
                          targetCrs: detectCrs(coreState.cityjson).code,
                          eaveHeight:
                            buildingEditor.pendingForm.roofType === 'flat'
                              ? buildingEditor.pendingForm.totalHeight
                              : buildingEditor.pendingForm.totalHeight - buildingEditor.pendingForm.roofHeight,
                          ridgeHeight: buildingEditor.pendingForm.totalHeight,
                          roofType: buildingEditor.pendingForm.roofType,
                          storeys: buildingEditor.pendingForm.storeys,
                          eaveOverhang: buildingEditor.pendingForm.eaveOverhang,
                          openings:
                            buildingEditor.pendingForm.addWindows || buildingEditor.pendingForm.addDoor
                              ? {
                                  windows: buildingEditor.pendingForm.addWindows,
                                  door: buildingEditor.pendingForm.addDoor,
                                }
                              : undefined,
                        }) ?? undefined,
                      polygon: buildingEditor.pendingFootprint,
                      height: buildingEditor.pendingForm.totalHeight,
                    }
                  : buildingEditor.pendingTransform
                  ? (() => {
                      const t = computeTransformedFootprint(coreState.cityjson, buildingEditor.pendingTransform);
                      return t ? { polygon: t.polygon, height: t.height } : null;
                    })()
                  : null
              }
            />
          ) : (
            <EmptyMapBackdrop />
          )}
          {autoHamburgLoading && !coreState.cityjson && (
            <AutoHamburgLoading message={autoHamburgStatus.message} />
          )}
          {showFileLoader && (
            <FileLoader
              onLoaded={handleLoadedForApp}
              onCatalogLoaded={handleCatalogLoadedForApp}
              canClose={!!coreState.cityjson}
              onClose={() => importExport.setLoadModalOpen(false)}
              banner={
                autoHamburgStatus?.kind === 'error'
                  ? { kind: 'err', message: autoHamburgStatus.message }
                  : undefined
              }
            />
          )}
          {buildingEditor.pendingFootprint && coreState.cityjson && (
            <BuildingCreator
              vertexCount={buildingEditor.pendingFootprint.length}
              footprint={buildingEditor.pendingFootprint}
              cityjson={coreState.cityjson}
              error={buildingEditor.creationError}
              onFormChange={(form) => {
                buildingEditor.setPendingForm(form);
                buildingEditor.setCreationError(null);
              }}
              onCreate={buildingEditor.handleCreateBuilding}
              onCancel={() => {
                coreState.setDrawMode('none');
                buildingEditor.setPendingFootprint(null);
                buildingEditor.setPendingForm(null);
                buildingEditor.setCreationError(null);
              }}
            />
          )}
        </div>

        {coreState.cityjson && coreState.selection && filteredForSelected && (
          <aside className={`side-panel ${sidePanelWide ? 'wide' : ''}`}>
            <div className="panel-header">
              <h3>
                {coreState.dirtyIds.has(coreState.selection.objectId) && (
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--warn)]" />
                )}
                {coreState.cityjson.CityObjects[coreState.selection.objectId]?.type ?? 'Unknown'}
              </h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setSidePanelWide((wide) => !wide)}
                  aria-label={sidePanelWide ? 'Use normal inspector width' : 'Use wide inspector'}
                  title={sidePanelWide ? 'Use normal inspector width' : 'Use wide inspector'}
                  style={{ padding: '2px 8px' }}
                >
                  {sidePanelWide ? 'Normal' : 'Wide'}
                </button>
                <button
                  onClick={() => {
                    coreState.setSelection(null);
                    setSidePanelWide(false);
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
                reloadToken={coreState.reloadToken}
                onSelect={() => {}}
                splitPreview={
                  buildingEditor.splitPreviewHeights
                    ? {
                        buildingId: coreState.selection.objectId,
                        heights: buildingEditor.splitPreviewHeights,
                        floorPlans: buildingEditor.splitPreviewFloorPlans ?? undefined,
                      }
                    : null
                }
                onAdjustSplit={buildingEditor.handleAdjustSplit}
              />
            </div>

            <AttributePanelInline
              buildingId={coreState.selection.objectId}
              cityjson={coreState.cityjson}
              isDirty={coreState.dirtyIds.has(coreState.selection.objectId)}
              onAttributeChange={handleAttributeChange}
              onRevert={handleRevert}
              onSelectBuilding={(id) => coreState.setSelection(id ? { objectId: id } : null)}
              onSplitByFloor={buildingEditor.handleSplitByFloor}
              onSplitByFloorHeights={buildingEditor.handleSplitByFloorHeights}
              onSplitByFloorPlans={buildingEditor.handleSplitByFloorPlans}
              onCustomHeightsPreview={buildingEditor.setSplitPreviewHeights}
              onFloorPlansPreview={buildingEditor.setSplitPreviewFloorPlans}
              onSplitBySide={buildingEditor.handleSplitBySide}
              pendingTransform={
                buildingEditor.pendingTransform?.id === coreState.selection.objectId ? buildingEditor.pendingTransform : null
              }
              terrainSnap={
                buildingEditor.pendingTransform?.id === coreState.selection.objectId
                  ? estimateTerrainSnap(coreState.cityjson, buildingEditor.pendingTransform)
                  : null
              }
              onStartTransform={buildingEditor.handleStartTransform}
              onUpdateTransform={buildingEditor.handleUpdateTransform}
              onCancelTransform={buildingEditor.handleCancelTransform}
              onSaveTransform={buildingEditor.handleSaveTransform}
              inFootprintEdit={
                buildingEditor.footprintEdit?.buildingId === coreState.selection.objectId
              }
              onStartFootprintEdit={buildingEditor.handleStartFootprintEdit}
              onSaveFootprintEdit={buildingEditor.handleSaveFootprintEdit}
              onCancelFootprintEdit={buildingEditor.handleCancelFootprintEdit}
              onMoveOpening={buildingEditor.handleMoveOpening}
              onMakeEditable={buildingEditor.handleMakeEditable}
              onReshapeBuilding={buildingEditor.handleReshapeBuilding}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Auxiliary helper functions ───────────────────────────────────────────

function computeFootprintBbox(
  footprints: { polygon: [number, number, number][] }[]
): Wgs84Bbox | null {
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  let any = false;
  for (const fp of footprints) {
    for (const [lng, lat] of fp.polygon) {
      if (lng < west) west = lng;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lat > north) north = lat;
      any = true;
    }
  }
  return any ? [west, south, east, north] : null;
}

function readInitialMapView(doc: CityJsonDocument | null):
  | {
      center: [number, number];
      zoom: number;
      pitch?: number;
      bearing?: number;
      disableDataFit: true;
    }
  | undefined {
  const value = doc?.metadata?.webcityeditorInitialView;
  if (!value || typeof value !== 'object') return undefined;
  const view = value as Record<string, unknown>;
  const center = view.center;
  const zoom = view.zoom;
  const pitch = view.pitch;
  const bearing = view.bearing;
  if (
    !Array.isArray(center) ||
    center.length !== 2 ||
    !center.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) ||
    typeof zoom !== 'number' ||
    !Number.isFinite(zoom)
  ) {
    return undefined;
  }
  return {
    center: [center[0], center[1]],
    zoom,
    ...(typeof pitch === 'number' && Number.isFinite(pitch) ? { pitch } : {}),
    ...(typeof bearing === 'number' && Number.isFinite(bearing) ? { bearing } : {}),
    disableDataFit: true,
  };
}

/**
 * Decide which bbox to use for the planning request.
 *
 * Prefer the current viewport when it is covered by a provider because the user
 * usually expects the toolbar action to apply to what they are looking at. If
 * the viewport is outside known coverage but the loaded CityJSON is inside
 * coverage, use the data bbox instead. Returning an unsupported bbox is
 * intentional: the caller can then show a helpful "coverage unavailable"
 * message rather than silently doing nothing.
 */
function choosePlanningQueryBbox({
  viewportBbox,
  footprintBbox,
}: {
  viewportBbox: Wgs84Bbox | null;
  footprintBbox: Wgs84Bbox | null;
}): Wgs84Bbox | null {
  const viewportQueryBbox = viewportBbox ? expandBbox(viewportBbox) : null;
  const footprintQueryBbox = footprintBbox ? expandBbox(footprintBbox) : null;

  if (viewportQueryBbox && getPlanningProviderForBbox(viewportQueryBbox)) {
    return viewportQueryBbox;
  }
  if (footprintQueryBbox && getPlanningProviderForBbox(footprintQueryBbox)) {
    return footprintQueryBbox;
  }
  return viewportQueryBbox ?? footprintQueryBbox;
}

function expandBbox(bbox: Wgs84Bbox, ratio = 0.15, minPad = 0.002): Wgs84Bbox {
  const [west, south, east, north] = bbox;
  const lngPad = Math.max((east - west) * ratio, minPad);
  const latPad = Math.max((north - south) * ratio, minPad);
  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
}

// Attribute panel without its own header
function AttributePanelInline(props: {
  buildingId: string;
  cityjson: CityJsonDocument;
  isDirty: boolean;
  onAttributeChange: (id: string, key: string, value: AttributeValue) => void;
  onRevert: (id: string) => void;
  onSplitByFloor: (id: string, floorCount: number) => void;
  onSplitByFloorHeights: (id: string, heights: number[]) => void;
  onSplitByFloorPlans: (
    id: string,
    heights: number[],
    floorPlans: FloorPlanDivision[]
  ) => void;
  onCustomHeightsPreview: (heights: number[] | null) => void;
  onFloorPlansPreview: (plans: FloorPlanDivision[] | null) => void;
  onSplitBySide: (id: string, partCount: number, axis: SplitAxis) => void;
  pendingTransform: PendingTransform | null;
  terrainSnap: ReturnType<typeof estimateTerrainSnap> | null;
  onStartTransform: (id: string) => void;
  onUpdateTransform: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform: () => void;
  onSaveTransform: () => void;
  inFootprintEdit: boolean;
  onStartFootprintEdit: (id: string) => void;
  onSaveFootprintEdit: () => void;
  onCancelFootprintEdit: () => void;
  onMoveOpening?: (buildingId: string, opening: any, dx: number, dy: number, dz: number) => void;
  onMakeEditable?: (buildingId: string) => void;
  onReshapeBuilding?: (
    buildingId: string,
    overrides: {
      roofType?: 'flat' | 'pyramid' | 'gable' | 'hip';
      eaveHeight?: number;
      ridgeHeight?: number;
      eaveOverhang?: number;
      rakeOverhang?: number;
      addWindows?: boolean;
      addDoor?: boolean;
    }
  ) => void;
  onSelectBuilding?: (id: string | null) => void;
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
      onSplitByFloorHeights={props.onSplitByFloorHeights}
      onSplitByFloorPlans={props.onSplitByFloorPlans}
      onCustomHeightsPreview={props.onCustomHeightsPreview}
      onFloorPlansPreview={props.onFloorPlansPreview}
      onSplitBySide={props.onSplitBySide}
      pendingTransform={props.pendingTransform}
      terrainSnap={props.terrainSnap}
      onStartTransform={props.onStartTransform}
      onUpdateTransform={props.onUpdateTransform}
      onCancelTransform={props.onCancelTransform}
      onSaveTransform={props.onSaveTransform}
      inFootprintEdit={props.inFootprintEdit}
      onStartFootprintEdit={props.onStartFootprintEdit}
      onSaveFootprintEdit={props.onSaveFootprintEdit}
      onCancelFootprintEdit={props.onCancelFootprintEdit}
      onMoveOpening={props.onMoveOpening}
      onMakeEditable={props.onMakeEditable}
      onReshapeBuilding={props.onReshapeBuilding}
      onSelectBuilding={props.onSelectBuilding}
      hideHeader
    />
  );
}

function EmptyMapBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#101722]">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-[-12%] top-[-18%] h-[55%] w-[55%] rounded-full bg-[var(--accent)]/30 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[60%] w-[60%] rounded-full bg-emerald-500/20 blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute bottom-4 left-4 rounded-md border border-[var(--border)] bg-black/25 px-3 py-2 text-xs text-[var(--text-dim)] backdrop-blur-sm">
        Map workspace is ready. Load a CityJSON file or catalog to begin.
      </div>
    </div>
  );
}

function AutoHamburgLoading({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#101722]">
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-dim)] shadow-2xl">
        {message}
      </div>
    </div>
  );
}

function uniqueZonesByLabel(zones: ParcelZone[]): ParcelZone[] {
  const seen = new Set<string>();
  const unique: ParcelZone[] = [];
  for (const zone of zones) {
    if (seen.has(zone.label)) continue;
    seen.add(zone.label);
    unique.push(zone);
  }
  return unique;
}

function ZoneLegend({
  zones,
  selectedZone,
  onSelectZone,
  onClearSelected,
  onHide,
}: {
  zones: ParcelZone[];
  selectedZone: ParcelZone | null;
  onSelectZone: (zone: ParcelZone) => void;
  onClearSelected: () => void;
  onHide: () => void;
}) {
  const legendZones = uniqueZonesByLabel(zones);
  const visibleZones = legendZones.slice(0, 6);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 11,
        background: 'rgba(20, 20, 24, 0.88)',
        color: '#fff',
        padding: '8px 10px',
        borderRadius: 6,
        fontSize: 11,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: 180,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          Planning
        </span>
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide planning overlay"
          style={{
            border: 0,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.82)',
            padding: '1px 6px',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Hide
        </button>
      </div>
      <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.75)' }}>
        {zones.length} polygons loaded for this view
      </div>
      {visibleZones.map((z) => (
        <div
          key={z.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectZone(z)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectZone(z);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 0',
            cursor: 'pointer',
          }}
          title={
            z.details
              ? `${z.details} | Compatible: ${
                  z.allowedTypes.length > 0 ? z.allowedTypes.join(', ') : 'none mapped'
                }`
              : `Compatible: ${z.allowedTypes.join(', ')}`
          }
        >
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 2,
              background: `rgb(${z.color[0]}, ${z.color[1]}, ${z.color[2]})`,
              border: '1px solid rgba(255,255,255,0.25)',
              flexShrink: 0,
            }}
          />
          <span>{z.label}</span>
        </div>
      ))}
      {legendZones.length > visibleZones.length && (
        <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.5)' }}>
          +{legendZones.length - visibleZones.length} more planning categories
        </div>
      )}
      {selectedZone && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            maxWidth: 300,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              Selected Area
            </div>
            <button
              type="button"
              onClick={onClearSelected}
              style={{
                border: 0,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.82)',
                padding: '1px 6px',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{selectedZone.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.72)', marginBottom: 2 }}>
            Source: {planningSourceLabel(selectedZone.source)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', marginBottom: 4 }}>
            Compatible:{' '}
            {selectedZone.allowedTypes.length > 0
              ? selectedZone.allowedTypes.join(', ')
              : 'no mapped building types'}
          </div>
          {selectedZone.details && (
            <div
              style={{
                color: 'rgba(255,255,255,0.62)',
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {selectedZone.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IfcPlacementBanner({
  parsed,
  fileName,
  onCancel,
}: {
  parsed: IfcImportResult;
  fileName: string;
  onCancel: () => void;
}) {
  const triCount = parsed.indices.length / 3;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 12,
        background: 'rgba(46,64,87,0.96)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 6,
        fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        maxWidth: 520,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            ⌂ Click on the map to place &ldquo;{parsed.name ?? fileName}&rdquo;
          </div>
          <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.78)' }}>
            {parsed.width.toFixed(1)} × {parsed.depth.toFixed(1)} ×{' '}
            {parsed.height.toFixed(1)} m · {parsed.storeyCount} storey
            {parsed.storeyCount === 1 ? '' : 's'} · {triCount.toLocaleString()}{' '}
            triangles
            {parsed.refLat !== null && parsed.refLon !== null && (
              <>
                {' '}· IFC site geo-ref {parsed.refLat.toFixed(4)}°N,{' '}
                {parsed.refLon.toFixed(4)}°E
              </>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
            ESC to cancel · parsed in {parsed.parseMs} ms
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
