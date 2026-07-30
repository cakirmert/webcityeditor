import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import FileLoader from './components/FileLoader';
import MapView from './components/MapView';
import BuildingDetailPreview from './components/BuildingDetailPreview';
import AttributePanel from './components/AttributePanel';
import BuildingCreator from './components/BuildingCreator';
import BuildingStartPanel from './components/BuildingStartPanel';
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
import { computeTransformedFootprintFromFootprint } from './lib/transform-preview';
import { detectCrs } from './lib/projection';
import { parseCityJson } from './lib/cityjson';
import { mergeCityJson } from './lib/merge';
import {
  DEFAULT_HAMBURG_VIEWPORT_BBOX,
  fetchCityJsonSeqViewport,
  HAMBURG_ROAD_CATALOG_TYPE,
  parseCityJsonSeqStrict,
  type CityJsonSeqViewportLoad,
} from './lib/cityjsonseq-catalog';
import { publicAssetUrl } from './lib/public-assets';
import type { HamburgCityTree } from './lib/hamburg-trees';
import {
  ensureHamburgEditableLodFallback,
  promoteHamburgTileSelectionProxy,
  type HamburgBuildingHandoff,
} from './lib/hamburg-3d-tiles-edit';
import {
  choosePlanningQueryBbox,
  fetchHamburgCitywideFnpZones,
  fetchHamburgXPlanZones,
  getPlanningProviderForBbox,
  isPlanningBboxLoadable,
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
const HAMBURG_ROADS_CATALOG_URL = 'data/hamburg/roads/catalog.json';
const HAMBURG_LOD3_SHOWCASE_URL =
  'data/hamburg/hamburg-lod3-showcase.city.json';
const HAMBURG_CITYWIDE_DEMO_NAME = 'hamburg-citywide-stream.city.json';
const HAMBURG_STARTUP_SEED_ATTRIBUTE = '_webcityeditorHamburgSeed';

export default function App() {
  const coreState = useCoreState();
  const undoRedo = useUndoRedo(coreState);
  const catalog = useCatalog(coreState, undoRedo);
  const importExport = useImportExport(coreState, undoRedo, catalog);

  const [sidePanelWide, setSidePanelWide] = useState(false);
  const [buildingTexturesEnabled, setBuildingTexturesEnabled] = useState(true);
  const [showBuildingStart, setShowBuildingStart] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const autoHamburgLoadStartedRef = useRef(false);
  const [autoHamburgStatus, setAutoHamburgStatus] = useState<{
    kind: 'loading' | 'error';
    message: string;
  } | null>(null);

  // ── Planning layer (zones) ────────────────────────────────────────────────
  const [planningOverviewZones, setPlanningOverviewZones] = useState<
    ParcelZone[]
  >([]);
  const [planningDetailZones, setPlanningDetailZones] = useState<ParcelZone[]>(
    []
  );
  const zones = useMemo(
    () => [...planningOverviewZones, ...planningDetailZones],
    [planningDetailZones, planningOverviewZones]
  );
  const [selectedZone, setSelectedZone] = useState<ParcelZone | null>(null);
  const [zoningEnabled, setZoningEnabled] = useState(false);
  const [planningOverviewLoading, setPlanningOverviewLoading] = useState(false);
  const [planningDetailLoading, setPlanningDetailLoading] = useState(false);
  const zoningLoading = planningOverviewLoading || planningDetailLoading;
  const [planningViewportBbox, setPlanningViewportBbox] =
    useState<Wgs84Bbox | null>(null);
  const planningOverviewAbortRef = useRef<AbortController | null>(null);
  const planningDetailAbortRef = useRef<AbortController | null>(null);
  const planningOverviewRequestIdRef = useRef(0);
  const planningDetailRequestIdRef = useRef(0);
  const lastPlanningQueryKeyRef = useRef('');
  const planningDetailCoverageRef = useRef<Wgs84Bbox | null>(null);

  const handleHideZoning = useCallback(() => {
    planningOverviewRequestIdRef.current += 1;
    planningDetailRequestIdRef.current += 1;
    planningOverviewAbortRef.current?.abort();
    planningDetailAbortRef.current?.abort();
    planningOverviewAbortRef.current = null;
    planningDetailAbortRef.current = null;
    setPlanningOverviewLoading(false);
    setPlanningDetailLoading(false);
    setZoningEnabled(false);
    setPlanningDetailZones([]);
    setSelectedZone(null);
    lastPlanningQueryKeyRef.current = '';
    planningDetailCoverageRef.current = null;
  }, []);

  const ensurePlanningOverview = useCallback(async (
    options: { reportError?: boolean } = {}
  ) => {
    if (planningOverviewZones.length > 0) return;
    planningOverviewAbortRef.current?.abort();
    const controller = new AbortController();
    planningOverviewAbortRef.current = controller;
    const requestId = planningOverviewRequestIdRef.current + 1;
    planningOverviewRequestIdRef.current = requestId;
    const sourceCityJson = coreState.cityjsonRef.current;
    const fetchWithSignal: typeof fetch = (input, init) =>
      fetch(input, { ...init, signal: controller.signal });

    setPlanningOverviewLoading(true);
    try {
      const nextZones = await fetchHamburgCitywideFnpZones(fetchWithSignal);
      if (
        planningOverviewRequestIdRef.current !== requestId ||
        coreState.cityjsonRef.current !== sourceCityJson
      ) {
        return;
      }
      setPlanningOverviewZones(nextZones);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      if (options.reportError) {
        alert(`Hamburg-wide planning overview failed: ${message}`);
      }
    } finally {
      if (planningOverviewRequestIdRef.current === requestId) {
        planningOverviewAbortRef.current = null;
        setPlanningOverviewLoading(false);
      }
    }
  }, [coreState.cityjsonRef, planningOverviewZones.length]);

  const requestPlanningDetailZones = useCallback(async (
    queryBbox: Wgs84Bbox,
    options: { reportError?: boolean } = {}
  ) => {
    const queryKey = planningQueryKey(queryBbox);
    if (queryKey === lastPlanningQueryKeyRef.current) {
      return;
    }
    planningDetailAbortRef.current?.abort();
    const controller = new AbortController();
    planningDetailAbortRef.current = controller;
    const requestId = planningDetailRequestIdRef.current + 1;
    planningDetailRequestIdRef.current = requestId;
    const sourceCityJson = coreState.cityjsonRef.current;
    const fetchWithSignal: typeof fetch = (input, init) =>
      fetch(input, { ...init, signal: controller.signal });

    lastPlanningQueryKeyRef.current = queryKey;
    setPlanningDetailLoading(true);
    try {
      const nextZones = await fetchHamburgXPlanZones(
        queryBbox,
        fetchWithSignal
      );
      if (
        planningDetailRequestIdRef.current !== requestId ||
        coreState.cityjsonRef.current !== sourceCityJson
      ) {
        return;
      }
      setPlanningDetailZones(nextZones);
      planningDetailCoverageRef.current = [...queryBbox];
      setSelectedZone((current) =>
        current?.source === 'hamburg-xplan-baugebiet'
          ? nextZones.find((zone) => zone.id === current.id) ?? null
          : current
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const message = e instanceof Error ? e.message : String(e);
      console.error(e);
      if (options.reportError) alert(`Planning layer failed: ${message}`);
      if (lastPlanningQueryKeyRef.current === queryKey) {
        lastPlanningQueryKeyRef.current = '';
      }
    } finally {
      if (planningDetailRequestIdRef.current === requestId) {
        planningDetailAbortRef.current = null;
        setPlanningDetailLoading(false);
      }
    }
  }, [coreState.cityjsonRef]);

  const handleToggleZoning = useCallback(async () => {
    if (!coreState.cityjson) return;
    if (zoningEnabled) {
      handleHideZoning();
      return;
    }
    if (zoningLoading) return;

    const viewportBbox = coreState.mapBboxRef.current;
    const queryBbox = choosePlanningQueryBbox({
      viewportBbox,
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

    coreState.setSelection(null);
    setZoningEnabled(true);
    const requests: Promise<void>[] = [
      ensurePlanningOverview({ reportError: true }),
    ];
    if (viewportBbox && isPlanningBboxLoadable(viewportBbox)) {
      requests.push(
        requestPlanningDetailZones(queryBbox, { reportError: true })
      );
    }
    await Promise.all(requests);
  }, [
    coreState.cityjson,
    coreState.mapBboxRef,
    coreState.setSelection,
    ensurePlanningOverview,
    handleHideZoning,
    requestPlanningDetailZones,
    zoningEnabled,
    zoningLoading,
  ]);

  useEffect(() => {
    if (!zoningEnabled || !planningViewportBbox || !coreState.cityjson) return;
    if (!isPlanningBboxLoadable(planningViewportBbox)) {
      // A close-view XPlan request can still be in flight while the user
      // zooms out. Invalidate it before clearing the detail layer so its late
      // response cannot recreate a rectangular local patch over the overview.
      planningDetailRequestIdRef.current += 1;
      planningDetailAbortRef.current?.abort();
      planningDetailAbortRef.current = null;
      planningDetailCoverageRef.current = null;
      lastPlanningQueryKeyRef.current = '';
      setPlanningDetailLoading(false);
      setPlanningDetailZones([]);
      setSelectedZone((current) =>
        current?.source === 'hamburg-xplan-baugebiet' ? null : current
      );
      return;
    }
    if (
      planningDetailCoverageRef.current &&
      planningBboxContains(
        planningDetailCoverageRef.current,
        planningViewportBbox
      )
    ) {
      return;
    }
    const queryBbox = choosePlanningQueryBbox({
      viewportBbox: planningViewportBbox,
      footprintBbox: computeFootprintBbox(extractFootprints(coreState.cityjson)),
    });
    if (!queryBbox || !getPlanningProviderForBbox(queryBbox)) return;
    const timer = window.setTimeout(() => {
      void requestPlanningDetailZones(queryBbox);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    coreState.cityjson,
    planningViewportBbox,
    requestPlanningDetailZones,
    zoningEnabled,
  ]);

  useEffect(
    () => () => {
      planningOverviewRequestIdRef.current += 1;
      planningDetailRequestIdRef.current += 1;
      planningOverviewAbortRef.current?.abort();
      planningDetailAbortRef.current?.abort();
    },
    []
  );

  const handleZoneSelect = useCallback((zone: ParcelZone) => {
    setSelectedZone(zone);
  }, []);

  const [hamburgTrees, setHamburgTrees] = useState<HamburgCityTree[]>([]);
  const roadEditor = useRoadEditor(coreState, undoRedo, {
    zones: zoningEnabled ? zones : [],
    trees: hamburgTrees,
  });
  const buildingEditor = useBuildingEditor(coreState, undoRedo, { zones, zoningEnabled });

  useEffect(() => {
    if (zoningEnabled) buildingEditor.setMultiSelection(new Set());
  }, [buildingEditor.setMultiSelection, zoningEnabled]);

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
      message: 'Connecting Hamburg citywide buildings and streamed roads...',
    });
    catalog.setCatalogStatus({
      kind: 'loading',
      message: 'Loading initial static road tiles from Pages...',
    });
    importExport.setLoadModalOpen(false);

    void (async () => {
      try {
        const roadCatalogUrl = publicAssetUrl(HAMBURG_ROADS_CATALOG_URL);
        const [roadsLoaded, buildingResult, lod3Result] = await Promise.all([
          fetchCityJsonSeqViewport(
            roadCatalogUrl,
            DEFAULT_HAMBURG_VIEWPORT_BBOX
          ),
          fetch(publicAssetUrl(HAMBURG_CITY_CENTER_DEMO_URL)),
          fetch(publicAssetUrl(HAMBURG_LOD3_SHOWCASE_URL)),
        ]);
        if (!roadsLoaded.doc || roadsLoaded.tileIds.length === 0) {
          throw new Error('The static Hamburg road catalog returned no tiles for the initial view');
        }

        const response = buildingResult;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const centerBuildings = parseCityJsonSeqStrict(text, HAMBURG_CITY_CENTER_DEMO_NAME);
        for (const object of Object.values(centerBuildings.CityObjects)) {
          object.attributes = {
            ...(object.attributes ?? {}),
            [HAMBURG_STARTUP_SEED_ATTRIBUTE]: true,
          };
        }
        const doc = roadsLoaded.doc;
        const centerMerge = mergeCityJson(doc, centerBuildings);
        if (!centerMerge.ok) {
          throw new Error(`Center building merge failed: ${centerMerge.reason}`);
        }

        const lod3Response = lod3Result;
        if (!lod3Response.ok) {
          throw new Error(`LoD3 CityJSON: HTTP ${lod3Response.status} ${lod3Response.statusText}`);
        }
        const parsedLod3 = parseCityJson(await lod3Response.text());
        if (!parsedLod3.ok) throw new Error(`LoD3 CityJSON: ${parsedLod3.error}`);
        // The bundled showcase is retained only as a local/offline edit seed.
        // Mark it exactly like the center LoD2 sample so it cannot become a
        // second, early-loading island over the uniform remote city stream.
        for (const object of Object.values(parsedLod3.doc.CityObjects)) {
          object.attributes = {
            ...(object.attributes ?? {}),
            [HAMBURG_STARTUP_SEED_ATTRIBUTE]: true,
          };
        }
        const lod3RootIds = Object.entries(parsedLod3.doc.CityObjects)
          .filter(([, object]) => object.type === 'Building')
          .map(([id]) => id);
        const lod2GeometryById = new Map(
          lod3RootIds.map((id) => [
            id,
            structuredClone(doc.CityObjects[id]?.geometry ?? []),
          ])
        );
        for (const id of lod3RootIds) removeCityObjectTree(doc, id);
        const lod3Merge = mergeCityJson(doc, parsedLod3.doc);
        if (!lod3Merge.ok) throw new Error(`LoD3 CityJSON merge failed: ${lod3Merge.reason}`);
        for (const id of lod3RootIds) {
          const object = doc.CityObjects[id];
          const lod2Geometry = lod2GeometryById.get(id);
          if (object && lod2Geometry?.length) {
            object.geometry = [...lod2Geometry, ...(object.geometry ?? [])];
          }
        }
        if (!doc.metadata) doc.metadata = {};
        doc.metadata.title =
          'Hamburg citywide official LoD2 tiles with streamed editable CityJSON roads';
        doc.metadata.sourceDescription =
          `Official Hamburg remote LoD1/LoD2/LoD3 context with viewport-streamed osm2streets CityJSON Transportation roads; ${lod3RootIds.length} bundled LoD3 buildings are retained only as hidden offline seeds.`;

        handleCatalogLoadedForApp(roadsLoaded, roadCatalogUrl, {
          loadMode: 'viewport',
        });
        coreState.setFileName(HAMBURG_CITYWIDE_DEMO_NAME);
        catalog.setCatalogStatus({
          kind: 'ok',
          message:
            `${roadsLoaded.tiles.length} static road tiles loaded from Pages; ` +
            `${roadsLoaded.features.toLocaleString()} road features in the initial view. ` +
            'Move or zoom the map to stream more.',
        });
        coreState.setPrimitiveValidation({
          kind: 'valid',
          message:
            `The Pages road tiles use the validated complete Hamburg catalog. ` +
            'Citywide buildings stream read-only from Hamburg and become local CityJSON only when selected for editing.',
        });
        roadEditor.setRoadStatus(
          `Streamed ${roadsLoaded.features.toLocaleString()} CityJSON road features for the initial view. Tap Roads, then a road, to edit it in memory.`
        );
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
    handleCatalogLoadedForApp,
    importExport,
    roadEditor.setRoadStatus,
  ]);

  const handleMapViewportChange = useCallback(
    (bbox: Wgs84Bbox) => {
      // Several tools need the live WGS84 viewport: catalog streaming, planning
      // overlays, and OSM road fetches. Keep the shared core ref current, then
      // let the catalog hook decide whether it needs to load more sequence tiles.
      coreState.mapBboxRef.current = bbox;
      setPlanningViewportBbox(bbox);
      catalog.handleViewportChange(bbox);
    },
    [catalog.handleViewportChange, coreState.mapBboxRef]
  );

  const handleToggleRoadEditor = useCallback(() => {
    if (roadEditor.showRoadEditor) {
      if (coreState.drawMode === 'road-line') coreState.setDrawMode('none');
      roadEditor.handleCloseRoadWorkspace();
      return;
    }
    // The data loader is a full-screen modal. Close it before opening the
    // road editor so the toolbar action always produces a visible panel.
    importExport.setLoadModalOpen(false);
    // Road editing is a focused map workspace. Do not leave an unrelated
    // building/planning inspector stacked underneath its right-hand dock.
    coreState.setSelection(null);
    buildingEditor.setMultiSelection(new Set());
    buildingEditor.setPendingAsset(null);
    setShowBuildingStart(false);
    setFiltersOpen(false);
    setSelectedZone(null);
    roadEditor.setRoadStatus(
      (current) => current ?? 'Road editor ready. Fetch OSM roads or draw a road manually.'
    );
    roadEditor.setShowRoadEditor(true);
  }, [buildingEditor, coreState, importExport, roadEditor]);

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
        const useRoadDraftHistory =
          roadEditor.showRoadEditor &&
          (roadEditor.roadDraftDirty ||
            roadEditor.roadDraftHistoryState.canUndo ||
            roadEditor.roadDraftHistoryState.canRedo);
        if (useRoadDraftHistory) {
          if (e.shiftKey) roadEditor.handleRedoRoadDraft();
          else roadEditor.handleUndoRoadDraft();
        } else if (e.shiftKey) undoRedo.handleRedo();
        else undoRedo.handleUndo();
      } else if (e.key === 'y') {
        e.preventDefault();
        if (roadEditor.showRoadEditor && roadEditor.roadDraftHistoryState.canRedo) {
          roadEditor.handleRedoRoadDraft();
        } else {
          undoRedo.handleRedo();
        }
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
  }, [undoRedo, buildingEditor, roadEditor]);

  // Derived properties
  const footprintsForFilter = useMemo(() => {
    if (!coreState.cityjson) return [];
    return extractFootprints(coreState.cityjson);
  }, [coreState.cityjson, coreState.reloadToken]);

  const pendingTransformPreview = useMemo(() => {
    const doc = coreState.cityjson;
    const pending = buildingEditor.pendingTransform;
    if (!doc || !pending) return null;
    const footprint = footprintsForFilter.find(
      (candidate) => candidate.id === pending.id
    );
    return footprint
      ? computeTransformedFootprintFromFootprint(doc, pending, footprint)
      : null;
  }, [buildingEditor.pendingTransform, coreState.cityjson, footprintsForFilter]);

  const pendingTerrainSnap = useMemo(() => {
    const doc = coreState.cityjson;
    const pending = buildingEditor.pendingTransform;
    return doc && pending
      ? estimateTerrainSnap(doc, pending, footprintsForFilter)
      : null;
  }, [buildingEditor.pendingTransform, coreState.cityjson, footprintsForFilter]);

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
      roads: ids.filter(
        (id) =>
          doc.CityObjects[id]?.type === 'Road' &&
          doc.CityObjects[id]?.attributes?._transportationKind !== 'intersection'
      ).length,
      intersections: ids.filter(
        (id) => doc.CityObjects[id]?.attributes?._transportationKind === 'intersection'
      ).length,
      vertices: doc.vertices.length,
      crs: doc.metadata?.referenceSystem ?? null,
      maxBuildingLod: maximumBuildingLod(doc),
      hasOpenings: hasBuildingOpenings(doc),
      hasTextures:
        Array.isArray((doc.appearance as { textures?: unknown[] } | undefined)?.textures) &&
        ((doc.appearance as { textures?: unknown[] }).textures?.length ?? 0) > 0,
    };
  }, [coreState.cityjson, coreState.reloadToken]);

  const filteredForSelected = useMemo(() => {
    if (!coreState.cityjson || !coreState.selection) return null;
    return filterToBuilding(coreState.cityjson, coreState.selection.objectId);
  }, [coreState.cityjson, coreState.selection, coreState.reloadToken]);

  const initialMapView = useMemo(() => {
    const saved = readInitialMapView(coreState.cityjson);
    if (saved) return saved;
    return catalog.catalogConnection
      ? {
          center: HAMBURG_CITY_CENTER,
          zoom: HAMBURG_OVERVIEW_ZOOM,
          disableDataFit: true,
        }
      : undefined;
  }, [catalog.catalogConnection, coreState.cityjson, coreState.fileName]);

  const handleSelect = useCallback(
    (info: SelectionInfo | null) => {
      if (zoningEnabled) return;
      if (
        roadEditor.showRoadEditor ||
        roadEditor.selectedRoadArea ||
        roadEditor.selectedOsmRoadId ||
        roadEditor.osm2streetsSelection ||
        roadEditor.highlightedOsm2StreetsRoadIds.size > 0
      ) {
        roadEditor.handleCloseRoadWorkspace();
      }
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
    [coreState, buildingEditor, roadEditor, zoningEnabled]
  );

  const handleHamburgBuildingHandoff = useCallback(
    (handoff: HamburgBuildingHandoff): string | null => {
      const doc = coreState.cityjsonRef.current;
      if (!doc) return null;
      const existing = doc.CityObjects[handoff.objectId];
      let localId = handoff.objectId;
      const sameSourceFeature =
        existing?.attributes?._hamburgTileFeatureId ===
        handoff.sourceFeatureId;
      const existingSourceLod = Number(
        existing?.attributes?._hamburgTileLod ?? 0
      );
      const existingIsPassiveSelectionProxy =
        existing?.attributes?._hamburgTileSelectionProxy === true &&
        existing?.attributes?._hamburgTileGeometryOverride !== true;
      const shouldUpgradeSelectionProxy =
        sameSourceFeature &&
        existingIsPassiveSelectionProxy &&
        handoff.sourceLod > existingSourceLod;
      let createdGeometryOverride = false;

      if (!sameSourceFeature || shouldUpgradeSelectionProxy) {
        undoRedo.pushUndo(`Make ${handoff.objectId} editable`);
        const existingIsStartupSeed =
          existing?.attributes?.[HAMBURG_STARTUP_SEED_ATTRIBUTE] === true;
        const existingHasDetailedGeometry = (existing?.geometry ?? []).some(
          (geometry) => {
            const lod = Number.parseFloat(
              String((geometry as { lod?: unknown }).lod ?? '')
            );
            return Number.isFinite(lod) && lod >= 2;
          }
        );
        if (
          existing &&
          existingHasDetailedGeometry &&
          !existingIsStartupSeed &&
          !shouldUpgradeSelectionProxy
        ) {
          createdGeometryOverride = true;
          coreState.originals.set(
            handoff.objectId,
            { ...(existing.attributes ?? {}) }
          );
          existing.attributes = {
            ...(existing.attributes ?? {}),
            _hamburgTileFeatureId: handoff.sourceFeatureId,
            _hamburgTileBatchId: handoff.batchId,
            _hamburgTileUrl: handoff.sourceTileUrl,
            _hamburgTileLod: handoff.sourceLod,
            _hamburgTileSelectionProxy: false,
            _hamburgTileGeometryOverride: true,
          };
        } else {
          const removedSeedObjects =
            existing &&
            (existingIsStartupSeed || shouldUpgradeSelectionProxy)
              ? removeCityObjectTree(doc, handoff.objectId)
              : null;
          if (existing && !existingIsStartupSeed) {
            delete doc.CityObjects[handoff.objectId];
          }
          const merged = mergeCityJson(doc, handoff.document);
          if (!merged.ok) {
            if (removedSeedObjects) {
              Object.assign(doc.CityObjects, removedSeedObjects);
            } else if (existing) {
              doc.CityObjects[handoff.objectId] = existing;
            }
            alert(`Could not create the local building copy: ${merged.reason}`);
            return null;
          }
          localId = merged.renameMap?.[handoff.objectId] ?? handoff.objectId;
          const local = doc.CityObjects[localId];
          if (local) {
            ensureHamburgEditableLodFallback(
              local,
              shouldUpgradeSelectionProxy ? existing : undefined,
              handoff.sourceLod
            );
            coreState.originals.set(localId, {
              ...(local.attributes ?? {}),
            });
          }
        }
        if (createdGeometryOverride) {
          coreState.setDirtyIds((current) => {
            const next = new Set(current);
            next.add(localId);
            return next;
          });
          coreState.markGeometryChanged(
            'A local building now overrides its streamed Hamburg counterpart; run Check 3D before export.'
          );
        }
        coreState.setReloadToken((token) => token + 1);
      }

      roadEditor.handleCloseRoadWorkspace();
      buildingEditor.setMultiSelection(new Set());
      coreState.setSelection({ objectId: localId });
      return localId;
    },
    [buildingEditor, coreState, roadEditor, undoRedo]
  );

  const handleAttributeChange = useCallback(
    (id: string, key: string, value: AttributeValue) => {
      if (!coreState.cityjson) return;
      const obj = coreState.cityjson.CityObjects[id];
      if (!obj) return;
      const prev = obj.attributes?.[key];
      if (prev === value) return;
      undoRedo.pushUndo(`Edit ${id}.${key}`);
      promoteHamburgTileSelectionProxy(coreState.cityjson, id);
      if (!obj.attributes) obj.attributes = {};
      obj.attributes[key] = value;
      coreState.setDirtyIds((prevSet) => {
        const next = new Set(prevSet);
        next.add(id);
        return next;
      });
      coreState.setReloadToken((token) => token + 1);
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
      coreState.setReloadToken((token) => token + 1);
      coreState.setSelection((s) => (s ? { ...s } : s));
    },
    [coreState]
  );

  const autoHamburgLoading = autoHamburgStatus?.kind === 'loading';
  const hamburgBuildingTilesEnabled =
    catalog.catalogConnection?.catalogType === HAMBURG_ROAD_CATALOG_TYPE;
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
        onToggleList={() => {
          if (!coreState.showList) roadEditor.handleCloseRoadWorkspace();
          setFiltersOpen(false);
          coreState.setShowList((v) => !v);
        }}
        filtersAvailable={!!coreState.cityjson && footprintsForFilter.length > 0}
        filtersOpen={filtersOpen}
        filtersActive={!filterIsEmpty}
        onToggleFilters={() => {
          if (!filtersOpen) {
            roadEditor.handleCloseRoadWorkspace();
            coreState.setShowList(false);
          }
          setFiltersOpen((open) => !open);
        }}
        onMergeFile={importExport.handleMergeFile}
        onImportIfc={buildingEditor.handleImportIfc}
        ifcParsing={buildingEditor.ifcParsing}
        onReloadView={() => coreState.setReloadToken((t) => t + 1)}
        onOpenLoader={() => {
          roadEditor.handleCloseRoadWorkspace();
          setFiltersOpen(false);
          importExport.setLoadModalOpen(true);
        }}
        onSaveLocal={importExport.handleSaveLocal}
        saveStatus={coreState.saveStatus}
        drawMode={coreState.drawMode}
        onStartDraw={() => {
          if (
            roadEditor.roadDraft &&
            roadEditor.roadDraftDirty &&
            !window.confirm('Discard the unsaved road edit and start adding a building?')
          ) {
            return;
          }
          if (roadEditor.roadDraft) roadEditor.handleCancelRoadEdit(true);
          roadEditor.handleCloseRoadWorkspace();
          if (zoningEnabled) handleHideZoning();
          coreState.setShowList(false);
          coreState.setSelection(null);
          roadEditor.setRoadStatus(null);
          buildingEditor.setCreationError(null);
          buildingEditor.setPendingAsset(null);
          coreState.setDrawMode('none');
          setFiltersOpen(false);
          setShowBuildingStart(true);
        }}
        onCancelDraw={() => {
          if (coreState.drawMode === 'road-line') {
            roadEditor.setRoadStatus('Road drawing canceled. Choose a road or start again.');
          }
          coreState.setDrawMode('none');
          buildingEditor.setPendingFootprint(null);
          buildingEditor.setPendingForm(null);
          buildingEditor.setCreationError(null);
          setShowBuildingStart(false);
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
        onToggleZoning={() => {
          if (!zoningEnabled) roadEditor.handleCloseRoadWorkspace();
          void handleToggleZoning();
        }}
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
        onPersistCatalog={
          catalog.catalogConnection && !catalog.catalogConnection.readOnly
            ? catalog.handlePersistCatalog
            : undefined
        }
      />
      <div className="main">
        {filtersOpen && coreState.cityjson && footprintsForFilter.length > 0 && (
          <FilterBar
            footprints={footprintsForFilter}
            filter={coreState.filter}
            onChange={coreState.setFilter}
            matchCount={filteredIds.size}
            onClose={() => setFiltersOpen(false)}
          />
        )}
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
          {buildingEditor.pendingAsset && (
            <AssetPlacementBanner
              name={buildingEditor.pendingAsset.name}
              size={buildingEditor.pendingAsset.size}
              loading={!buildingEditor.pendingAssetDocument}
              hasLocation={!!buildingEditor.pendingAssetLocation}
              ready={!!buildingEditor.pendingAssetPreview}
              error={buildingEditor.pendingAssetError}
              onConfirm={buildingEditor.handleConfirmAssetPlacement}
              onCancel={buildingEditor.handleCancelAssetPlacement}
            />
          )}
          {showBuildingStart && (
            <BuildingStartPanel
              onDrawCustom={() => {
                setShowBuildingStart(false);
                coreState.setDrawMode('polygon');
              }}
              onPlaceAsset={(asset) => {
                setShowBuildingStart(false);
                buildingEditor.setPendingAsset(asset);
              }}
              onCancel={() => setShowBuildingStart(false)}
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
              exactGeometryStatus={roadEditor.exactGeometryStatus}
              editingRoadId={roadEditor.editingRoadId}
              status={roadEditor.roadStatus}
              basemap={roadEditor.basemap}
              satelliteOpacity={roadEditor.satelliteOpacity}
              roadOverlayOpacity={roadEditor.roadOverlayOpacity}
              cityJsonRoadCount={new Set(
                roadEditor.roadAreas
                  .filter((area) => area.function !== 'intersection')
                  .map((area) => area.roadId)
              ).size}
              cityJsonJunctionCount={new Set(
                roadEditor.roadAreas
                  .filter((area) => area.function === 'intersection')
                  .map((area) => area.roadId)
              ).size}
              drawMode={coreState.drawMode}
              backendUrl={roadEditor.roadBackendUrl}
              insertedRoadId={roadEditor.editingRoadId ?? roadEditor.lastInsertedRoadId}
              canUndoDraft={roadEditor.roadDraftHistoryState.canUndo}
              canRedoDraft={roadEditor.roadDraftHistoryState.canRedo}
              undoDraftLabel={roadEditor.roadDraftHistoryState.undoLabel}
              redoDraftLabel={roadEditor.roadDraftHistoryState.redoLabel}
              onClose={roadEditor.handleCloseRoadWorkspace}
              onFetchOsmRoads={() => void roadEditor.handleFetchOsmRoads()}
              onBasemapChange={roadEditor.setBasemap}
              onSatelliteOpacityChange={roadEditor.setSatelliteOpacity}
              onRoadOverlayOpacityChange={roadEditor.setRoadOverlayOpacity}
              onStartManualDraw={roadEditor.handleStartRoadDraw}
              onFinishManualDraw={() => roadEditor.setFinishRoadDrawToken((token) => token + 1)}
              onCancelDraw={() => {
                roadEditor.setRoadStatus('Road drawing canceled. Choose a road or start again.');
                coreState.setDrawMode('none');
                buildingEditor.setPendingFootprint(null);
                buildingEditor.setPendingForm(null);
                buildingEditor.setCreationError(null);
              }}
              onCancelEdit={roadEditor.handleCancelRoadEdit}
              onDraftChange={roadEditor.handleRoadDraftChange}
              onUndoDraft={roadEditor.handleUndoRoadDraft}
              onRedoDraft={roadEditor.handleRedoRoadDraft}
              onSplitDraft={roadEditor.handleSplitRoadDraft}
              onInsertRoad={roadEditor.handleInsertRoad}
              onExportPayload={roadEditor.handleExportRoadPayload}
              onPostPayload={() => void roadEditor.handlePostRoadPayload()}
              onBackendUrlChange={roadEditor.setRoadBackendUrl}
              roadFitConflicts={roadEditor.roadFitConflicts}
              roadFitPending={roadEditor.roadFitPending}
              selectedRoadArea={roadEditor.selectedRoadArea}
              selectedRoadBand={roadEditor.selectedRoadBand}
              onRoadBandSelect={roadEditor.setSelectedRoadBand}
              onEditSelectedRoadArea={roadEditor.handleEditSelectedRoadArea}
              onDeleteSelectedRoadArea={roadEditor.handleDeleteSelectedRoadArea}
              osm2streetsSelection={roadEditor.osm2streetsSelection}
              onEditOsm2StreetsSelection={roadEditor.handleInsertOsm2StreetsSelection}
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
              hamburgBuildingTilesEnabled={hamburgBuildingTilesEnabled}
              onHamburgBuildingHandoff={handleHamburgBuildingHandoff}
              planningInteractionOnly={zoningEnabled}
              texturesEnabled={buildingTexturesEnabled}
              onTexturesEnabledChange={setBuildingTexturesEnabled}
              initialView={initialMapView}
              drawMode={coreState.drawMode}
              onFootprintDrawn={(ring) => {
                buildingEditor.setPendingFootprint(ring);
                coreState.setDrawMode('none');
              }}
              onRoadLineDrawn={roadEditor.handleRoadLineDrawn}
              finishRoadDrawToken={roadEditor.finishRoadDrawToken}
              onDrawCanceled={() => {
                if (coreState.drawMode === 'road-line') {
                  roadEditor.setRoadStatus('Road drawing canceled. Choose a road or start again.');
                }
                coreState.setDrawMode('none');
                buildingEditor.setPendingFootprint(null);
                buildingEditor.setPendingForm(null);
                buildingEditor.setCreationError(null);
              }}
              filteredIds={filterIsEmpty ? null : filteredIds}
              onPlacementClick={
                buildingEditor.pendingAsset
                  ? buildingEditor.handleAssetPlacement
                  : buildingEditor.ifcPending
                  ? buildingEditor.handleIfcPlacement
                  : undefined
              }
              onViewportChange={handleMapViewportChange}
              dragTransformId={buildingEditor.pendingTransform?.id ?? null}
              onDragMove={buildingEditor.handleDragMove}
              onDragEnd={buildingEditor.handleDragEnd}
              multiSelectedIds={buildingEditor.multiSelection.size > 0 ? buildingEditor.multiSelection : null}
              zones={zoningEnabled ? zones : []}
              onZoneSelect={handleZoneSelect}
              basemap={roadEditor.basemap}
              onBasemapChange={roadEditor.setBasemap}
              satelliteOpacity={roadEditor.satelliteOpacity}
              onSatelliteOpacityChange={roadEditor.setSatelliteOpacity}
              roadOverlayOpacity={roadEditor.roadOverlayOpacity}
              onRoadOverlayOpacityChange={roadEditor.setRoadOverlayOpacity}
              roadWorkspaceOpen={roadEditor.showRoadEditor}
              roadAreas={roadEditor.roadAreas}
              roadPreviewAreas={roadEditor.roadPreviewAreas}
              roadFitConflicts={roadEditor.roadFitConflicts}
              selectedRoadAreaId={roadEditor.selectedRoadArea?.id ?? null}
              onRoadAreaSelect={(area) => {
                roadEditor.setSelectedRoadArea(area);
                // Road surfaces are edited in the dedicated transportation
                // workspace. Opening the building inspector here exposed roof
                // and footprint actions that do not apply to Road objects.
                coreState.setSelection(null);
              }}
              roadDraft={roadEditor.roadDraft}
              selectedRoadBand={roadEditor.selectedRoadBand}
              onSelectedRoadBandChange={roadEditor.setSelectedRoadBand}
              onRoadDraftChange={(draft) =>
                roadEditor.handleRoadDraftChange(draft, 'Shape road', 'road-shape')
              }
              osmRoads={roadEditor.osmRoads}
              osmPointFeatures={roadEditor.osmPointFeatures}
              selectedOsmRoadId={roadEditor.selectedOsmRoadId}
              onOsmRoadSelect={roadEditor.handleOsmRoadSelect}
              osm2streetsResult={roadEditor.osm2streetsResult}
              osm2streetsBbox={roadEditor.osm2streetsBbox}
              osm2streetsSelection={roadEditor.osm2streetsSelection}
              highlightedOsm2StreetsRoadIds={roadEditor.highlightedOsm2StreetsRoadIds}
              onOsm2StreetsSelect={roadEditor.handleOsm2StreetsSelect}
              onHamburgTreesLoaded={setHamburgTrees}
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
                buildingEditor.pendingAssetPreview
                  ? { mesh: buildingEditor.pendingAssetPreview }
                  : buildingEditor.pendingFootprint && buildingEditor.pendingForm
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
                  : pendingTransformPreview
                  ? {
                      polygon: pendingTransformPreview.polygon,
                      height: pendingTransformPreview.height,
                    }
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

        {coreState.cityjson &&
          !zoningEnabled &&
          coreState.selection &&
          filteredForSelected &&
          coreState.cityjson.CityObjects[coreState.selection.objectId]?.type !== 'Road' && (
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
              <BuildingDetailPreview
                cityjson={filteredForSelected}
                buildingId={coreState.selection.objectId}
                reloadToken={coreState.reloadToken}
                splitPreview={
                  buildingEditor.splitPreviewHeights
                    ? {
                        buildingId: coreState.selection.objectId,
                        heights: buildingEditor.splitPreviewHeights,
                        floorPlans: buildingEditor.splitPreviewFloorPlans ?? undefined,
                      }
                    : null
                }
                texturesEnabled={buildingTexturesEnabled}
                onTexturesEnabledChange={setBuildingTexturesEnabled}
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
                  ? pendingTerrainSnap
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

function planningQueryKey(bbox: Wgs84Bbox): string {
  return bbox.map((value) => value.toFixed(5)).join(':');
}

function planningBboxContains(
  coverage: Wgs84Bbox,
  viewport: Wgs84Bbox
): boolean {
  return (
    coverage[0] <= viewport[0] &&
    coverage[1] <= viewport[1] &&
    coverage[2] >= viewport[2] &&
    coverage[3] >= viewport[3]
  );
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
        maxHeight: 'min(52vh, 460px)',
        overflowY: 'auto',
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
        {zones.length} polygons loaded across Hamburg and the close view
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

function AssetPlacementBanner({
  name,
  size,
  loading,
  hasLocation,
  ready,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  size: string;
  loading: boolean;
  hasLocation: boolean;
  ready: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const title = error
    ? `Could not preview ${name}`
    : !hasLocation
      ? `Tap the map to preview ${name}`
      : ready
        ? `${name} is ready to place`
        : `Preparing ${name} preview`;
  const detail = error
    ? error
    : !hasLocation
      ? `${size} · detailed geometry loads now; nothing is added yet`
      : ready
        ? 'Tap elsewhere to reposition, or confirm this location'
        : loading
          ? 'Loading detailed geometry…'
          : 'Building the untextured LoD3 preview…';

  return (
    <section className="building-placement-banner" aria-label="Place building">
      <div className="building-placement-banner__copy" role="status" aria-live="polite">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="building-placement-banner__actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="is-primary"
          disabled={!ready || !!error}
          onClick={onConfirm}
        >
          Place here
        </button>
      </div>
    </section>
  );
}

function removeCityObjectTree(
  doc: CityJsonDocument,
  id: string,
  removed: CityJsonDocument['CityObjects'] = {}
): CityJsonDocument['CityObjects'] {
  const object = doc.CityObjects[id];
  if (!object) return removed;
  removed[id] = object;
  for (const child of object.children ?? []) {
    removeCityObjectTree(doc, child, removed);
  }
  delete doc.CityObjects[id];
  return removed;
}

function maximumBuildingLod(doc: CityJsonDocument): number | null {
  let maximum: number | null = null;
  for (const object of Object.values(doc.CityObjects)) {
    if (object.type !== 'Building' && object.type !== 'BuildingPart') continue;
    for (const geometryValue of object.geometry ?? []) {
      const geometry = geometryValue as { lod?: string | number };
      const lod = Number.parseFloat(String(geometry.lod ?? ''));
      if (Number.isFinite(lod)) maximum = Math.max(maximum ?? lod, lod);
    }
  }
  return maximum;
}

function hasBuildingOpenings(doc: CityJsonDocument): boolean {
  for (const object of Object.values(doc.CityObjects)) {
    if (object.type !== 'Building' && object.type !== 'BuildingPart') continue;
    for (const geometry of object.geometry ?? []) {
      const semantics = (geometry as {
        semantics?: { surfaces?: Array<{ type?: string }> };
      }).semantics;
      if (
        semantics?.surfaces?.some(
          (surface) => surface.type === 'Window' || surface.type === 'Door'
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
