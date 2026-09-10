import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  OsmPointFeature,
  OsmRoadFeature,
  RoadArea,
  RoadDraft,
} from '../lib/transportation';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import {
  buildExactRoadAttributePreviewAreas,
  buildOverpassRoadQuery,
  buildRoadEditPayload,
  buildRoadPreviewAreas,
  clearStaleReciprocalRoadConnections,
  createManualRoadDraft,
  deleteRoadFromCityJson,
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  findStaleReciprocalRoadConnections,
  insertRoadIntoCityJson,
  parseOsmPointFeaturesFromXml,
  parseOsmRoadsFromXml,
  planStaleReciprocalRoadPropagation,
  splitRoadSectionAtFraction,
  summarizeRoadDraft,
  synchronizeRoadConnectionMetadata,
  roadDraftPreservesExactGeometry,
  updateExactRoadAttributesInCityJson,
} from '../lib/transportation';
import { processOsmXml } from '../lib/osm2streets';
import { validateRoadRules } from '../lib/road-rules';
import type { JunctionEditTool } from '../lib/junction-footprint';
import { buildConnectedJunctionPreview, buildRoadJunctionPlan, createRoadJunctionAtEndpoint, readRoadJunction, saveRoadJunction, type RoadJunctionDraft } from '../lib/road-junctions';
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import { insertOsm2StreetsRoadIntoCityJson } from '../lib/osm2streets-cityjson';
import { buildRoadDraftFromOsm2StreetsSelection } from '../lib/osm2streets-draft';
import { connectedRoadIdsForSelection } from '../lib/osm2streets-selection';
import { activeMetricCrsForCityJson } from '../lib/projection';
import { limitRoadQueryBbox, type Wgs84Bbox } from '../lib/road-query';
import { extractFootprints } from '../lib/footprints';
import { runStructurallyGuardedMutation } from '../lib/editor-actions';
import {
  validateRoadFit,
  type RoadFitConflict,
  type RoadFitTree,
} from '../lib/road-fit';
import type { ParcelZone } from '../lib/zoning';
import type { BasemapMode } from '../lib/basemap';
import { compactVertices } from '../lib/compact';
import {
  RoadDraftHistory,
  type RoadDraftHistorySnapshot,
} from '../lib/road-draft-history';

interface FetchOsmRoadOptions {
  source?: 'viewport' | 'loaded-data';
  allowLargeQuery?: boolean;
}

interface LoadOsmRoadXmlOptions {
  sourceLabel?: string;
  showBoundary?: boolean;
  echoDiagnostics?: boolean;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const ROAD_QUERY_MAX_WIDTH_METERS = 1_600;
const ROAD_QUERY_MAX_HEIGHT_METERS = 1_600;
const ROAD_QUERY_TIMEOUT_MS = 25_000;
const ROAD_BUILDING_CLEARANCE_BLOCK_METERS = 0.5;
const ROAD_BUILDING_CLEARANCE_WARNING_METERS = 1;
const ROAD_TREE_CLEARANCE_METERS = 0;
const EMPTY_PARCEL_ZONES: ParcelZone[] = [];
const EMPTY_ROAD_FIT_TREES: RoadFitTree[] = [];

interface RoadEditBaseline {
  roadId: string;
  draft: RoadDraft;
  exactGeometry: true;
}

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

function expandBbox(
  bbox: Wgs84Bbox,
  ratio = 0.15,
  minPad = 0.002
): Wgs84Bbox {
  const [west, south, east, north] = bbox;
  const lngPad = Math.max((east - west) * ratio, minPad);
  const latPad = Math.max((north - south) * ratio, minPad);
  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
}

async function fetchOsmRoadXml(
  queryBbox: Wgs84Bbox,
  timeoutMs = ROAD_QUERY_TIMEOUT_MS
): Promise<{ xmlText: string; endpoint: string }> {
  const body = new URLSearchParams({
    data: buildOverpassRoadQuery(queryBbox, 'xml', Math.ceil(timeoutMs / 1000)),
  });
  const errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return { xmlText: await response.text(), endpoint };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `timed out after ${timeoutMs / 1000}s`
          : error instanceof Error
          ? error.message
          : String(error);
      errors.push(`${endpoint}: ${message}`);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error(errors.join(' | '));
}

function cloneRoadDraft(draft: RoadDraft): RoadDraft {
  return JSON.parse(JSON.stringify(draft)) as RoadDraft;
}

function downloadJson(value: unknown, fileName: string): void {
  const text = JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useRoadEditor(
  coreState: CoreState,
  undoRedo: UndoRedoState,
  options: { zones?: ParcelZone[]; trees?: RoadFitTree[] } = {}
) {
  const affectedZones = options.zones?.length ? options.zones : EMPTY_PARCEL_ZONES;
  const roadFitTrees = options.trees?.length ? options.trees : EMPTY_ROAD_FIT_TREES;
  const {
    cityjson,
    setSelection,
    setDirtyIds,
    setReloadToken,
    setDrawMode,
    markGeometryChanged,
    reloadToken,
  } = coreState;

  const { pushUndo } = undoRedo;

  const [showRoadEditor, setShowRoadEditor] = useState(false);
  const [basemap, setBasemap] = useState<BasemapMode>('topplus');
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.82);
  const [roadOverlayOpacity, setRoadOverlayOpacity] = useState(0.92);
  const [osmRoads, setOsmRoads] = useState<OsmRoadFeature[]>([]);
  const [osmPointFeatures, setOsmPointFeatures] = useState<OsmPointFeature[]>([]);
  const [selectedOsmRoadId, setSelectedOsmRoadId] = useState<string | null>(null);
  const [roadDraft, setRoadDraft] = useState<RoadDraft | null>(null);
  const [junctionDraft, setJunctionDraft] = useState<RoadJunctionDraft | null>(null);
  const [junctionSaveError, setJunctionSaveError] = useState<string | null>(null);
  useEffect(() => { setJunctionSaveError(null); }, [junctionDraft]);
  const [junctionPendingRoad, setJunctionPendingRoad] = useState<{ draft: RoadDraft; roadId: string; editingRoadId: string | null; dirty: boolean } | null>(null);
  const [junctionSource, setJunctionSource] = useState<string | null>(null);
  const [junctionHistory, setJunctionHistory] = useState<RoadJunctionDraft[]>([]);
  const [junctionFuture, setJunctionFuture] = useState<RoadJunctionDraft[]>([]);
  const [junctionBaseline, setJunctionBaseline] = useState('');
  const [junctionEditTool, setJunctionEditTool] = useState<JunctionEditTool>('none');
  const junctionHistoryGroup = useRef<string | undefined>(undefined);
  useEffect(() => { setJunctionEditTool('none'); junctionHistoryGroup.current = undefined; }, [junctionDraft?.id]);
  const junctionDirty = !!junctionDraft && JSON.stringify(junctionDraft) !== junctionBaseline;
  const handleJunctionChange = useCallback((next: RoadJunctionDraft, group?: string) => {
    if (junctionDraft && (!group || junctionHistoryGroup.current !== group)) setJunctionHistory((history) => [...history.slice(-49), junctionDraft]);
    junctionHistoryGroup.current = group;
    setJunctionFuture([]); setJunctionDraft(next);
  }, [junctionDraft]);
  const handleUndoJunction = useCallback(() => {
    junctionHistoryGroup.current = undefined;
    const previous = junctionHistory.at(-1); if (!previous || !junctionDraft) return;
    setJunctionFuture((future) => [...future, junctionDraft]); setJunctionHistory((history) => history.slice(0, -1)); setJunctionDraft(previous);
  }, [junctionDraft, junctionHistory]);
  const handleRedoJunction = useCallback(() => {
    junctionHistoryGroup.current = undefined;
    const next = junctionFuture.at(-1); if (!next || !junctionDraft) return;
    setJunctionHistory((history) => [...history, junctionDraft]); setJunctionFuture((future) => future.slice(0, -1)); setJunctionDraft(next);
  }, [junctionDraft, junctionFuture]);
  const [selectedRoadBand, setSelectedRoadBand] = useState<{
    sectionId: string;
    bandIndex: number;
  } | null>(null);
  const [roadEditBaseline, setRoadEditBaseline] = useState<RoadEditBaseline | null>(null);
  const [roadDraftDirty, setRoadDraftDirty] = useState(false);
  const [editingRoadId, setEditingRoadId] = useState<string | null>(null);
  const [roadStatus, setRoadStatus] = useState<string | null>(null);
  const [selectedRoadArea, setSelectedRoadArea] = useState<RoadArea | null>(null);
  const [lastInsertedRoadId, setLastInsertedRoadId] = useState<string | null>(null);
  const [roadBackendUrl, setRoadBackendUrl] = useState('http://127.0.0.1:8787/api/roads');
  const [finishRoadDrawToken, setFinishRoadDrawToken] = useState(0);
  const [osm2streetsResult, setOsm2streetsResult] = useState<import('../lib/osm2streets').Osm2StreetsResult | null>(null);
  const [osm2streetsBbox, setOsm2streetsBbox] = useState<[number, number, number, number] | null>(null);
  const [osm2streetsSelection, setOsm2streetsSelection] = useState<Osm2StreetsSelection>(null);
  const [highlightedOsm2StreetsRoadIds, setHighlightedOsm2StreetsRoadIds] = useState<Set<number | string>>(new Set());
  const roadDraftHistoryRef = useRef(new RoadDraftHistory());
  const [roadDraftHistoryVersion, setRoadDraftHistoryVersion] = useState(0);

  const clearRoadSelectionHighlights = useCallback(() => {
    setSelectedRoadArea(null);
    setSelectedOsmRoadId(null);
    setSelectedRoadBand(null);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
  }, []);

  const handleCloseRoadWorkspace = useCallback(() => {
    setShowRoadEditor(false);
    clearRoadSelectionHighlights();
  }, [clearRoadSelectionHighlights]);

  useEffect(() => {
    if (!showRoadEditor) clearRoadSelectionHighlights();
  }, [clearRoadSelectionHighlights, showRoadEditor]);

  useEffect(() => {
    setSelectedRoadBand((current) => {
      if (!showRoadEditor || !roadDraft) return null;
      if (
        current &&
        roadDraft.sections.some(
          (section) =>
            section.id === current.sectionId && !!section.bands[current.bandIndex]
        )
      ) {
        return current;
      }
      const currentSection = current
        ? roadDraft.sections.find((section) => section.id === current.sectionId)
        : undefined;
      const fallbackSection =
        currentSection?.bands.length ? currentSection : roadDraft.sections[0];
      return fallbackSection?.bands.length
        ? {
            sectionId: fallbackSection.id,
            bandIndex: Math.min(
              current?.bandIndex ?? 0,
              fallbackSection.bands.length - 1
            ),
          }
        : null;
    });
  }, [roadDraft, showRoadEditor]);

  const clearRoadDraftHistory = useCallback(() => {
    roadDraftHistoryRef.current.clear();
    setRoadDraftHistoryVersion((version) => version + 1);
  }, []);

  const recordRoadDraftHistory = useCallback(
    (
      currentDraft: RoadDraft | null,
      currentDirty: boolean,
      label: string,
      group?: string
    ) => {
      roadDraftHistoryRef.current.record(
        { draft: currentDraft, dirty: currentDirty },
        { label, group }
      );
      setRoadDraftHistoryVersion((version) => version + 1);
    },
    []
  );

  const applyRoadDraftHistorySnapshot = useCallback(
    (snapshot: RoadDraftHistorySnapshot, action: 'Undid' | 'Redid') => {
      setRoadDraft(snapshot.draft);
      setRoadDraftDirty(snapshot.dirty);
      setDrawMode('none');
      setRoadStatus(
        `${action} ${snapshot.label?.toLowerCase() ?? 'road edit'}. Changes are recorded automatically.`
      );
      setRoadDraftHistoryVersion((version) => version + 1);
    },
    [setDrawMode]
  );

  const handleUndoRoadDraft = useCallback(() => {
    const previous = roadDraftHistoryRef.current.undo({
      draft: roadDraft,
      dirty: roadDraftDirty,
    });
    if (previous) applyRoadDraftHistorySnapshot(previous, 'Undid');
  }, [applyRoadDraftHistorySnapshot, roadDraft, roadDraftDirty]);

  const handleRedoRoadDraft = useCallback(() => {
    const next = roadDraftHistoryRef.current.redo({
      draft: roadDraft,
      dirty: roadDraftDirty,
    });
    if (next) applyRoadDraftHistorySnapshot(next, 'Redid');
  }, [applyRoadDraftHistorySnapshot, roadDraft, roadDraftDirty]);

  const roadDraftHistoryState = useMemo(
    () => ({
      canUndo: roadDraftHistoryRef.current.canUndo(),
      canRedo: roadDraftHistoryRef.current.canRedo(),
      undoLabel: roadDraftHistoryRef.current.peekUndoLabel(),
      redoLabel: roadDraftHistoryRef.current.peekRedoLabel(),
    }),
    [roadDraftHistoryVersion]
  );

  const exactGeometryStatus = useMemo<'preserved' | 'changed' | null>(() => {
    if (
      !roadDraft ||
      !editingRoadId ||
      !roadEditBaseline?.exactGeometry ||
      roadEditBaseline.roadId !== editingRoadId
    ) {
      return null;
    }
    return roadDraftPreservesExactGeometry(roadEditBaseline.draft, roadDraft)
      ? 'preserved'
      : 'changed';
  }, [editingRoadId, roadDraft, roadEditBaseline]);

  const clearOsmRoadData = useCallback(() => {
    setJunctionDraft(null); setJunctionSource(null); setJunctionHistory([]); setJunctionFuture([]);
    clearRoadDraftHistory();
    setRoadEditBaseline(null);
    setRoadDraft(null);
    setRoadDraftDirty(false);
    setEditingRoadId(null);
    setSelectedRoadArea(null);
    setLastInsertedRoadId(null);
    setSelectedOsmRoadId(null);
    setOsmRoads([]);
    setOsmPointFeatures([]);
    setOsm2streetsResult(null);
    setOsm2streetsBbox(null);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setRoadStatus(null);
    setDrawMode('none');
    setSelection(null);
  }, [clearRoadDraftHistory, setDrawMode, setSelection]);

  const loadOsmRoadXml = useCallback(
    async (
      xmlText: string,
      queryBbox: Wgs84Bbox,
      options: LoadOsmRoadXmlOptions = {}
    ) => {
      setOsm2streetsSelection(null);
      setHighlightedOsm2StreetsRoadIds(new Set());
      const roads = parseOsmRoadsFromXml(xmlText);
      const pointFeatures = parseOsmPointFeaturesFromXml(xmlText);
      setOsmRoads(roads);
      setOsmPointFeatures(pointFeatures);
      setRoadStatus('Computing detailed lane-level 2D visualization (osm2streets)...');

      try {
        const result = await processOsmXml(xmlText, queryBbox, {
          echoDiagnostics: options.echoDiagnostics ?? false,
        });
        setOsm2streetsResult(result);
        setOsm2streetsBbox(options.showBoundary === false ? null : queryBbox);
        const warningCount = result.diagnostics.filter(
          (diagnostic) => diagnostic.level === 'warn'
        ).length;
        const errorCount = result.diagnostics.filter(
          (diagnostic) => diagnostic.level === 'error'
        ).length;
        const diagnosticSuffix =
          warningCount > 0 || errorCount > 0
            ? ` ${warningCount} non-blocking geometry warning${warningCount === 1 ? '' : 's'}${
                errorCount > 0
                  ? ` and ${errorCount} error${errorCount === 1 ? '' : 's'}`
                  : ''
              }.`
            : '';
        const sourceSuffix = options.sourceLabel ? ` from ${options.sourceLabel}` : '';
        const pointSuffix =
          pointFeatures.length > 0
            ? ` ${pointFeatures.length} tagged street object${
                pointFeatures.length === 1 ? '' : 's'
              } will appear as you zoom in.`
            : '';
        setRoadStatus(
          roads.length > 0
            ? `Roads ready: ${roads.length} OSM segment${
                roads.length === 1 ? '' : 's'
              }${sourceSuffix} with osm2streets lane and junction surfaces.${pointSuffix}${diagnosticSuffix} Tap a road on the map to edit it.`
            : 'No OSM roads returned for this viewport.'
        );
        return { roads, pointFeatures, result };
      } catch (error) {
        console.error('osm2streets Wasm generation failed:', error);
        setRoadStatus(
          `Loaded ${roads.length} roads, but detailed visualization failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },
    []
  );

  const handleFetchOsmRoads = useCallback(async (fetchOptions: FetchOsmRoadOptions = {}) => {
    if (!cityjson) return;
    setShowRoadEditor(true);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    const viewportBbox = coreState.mapBboxRef.current;
    const footprintBbox = computeFootprintBbox(extractFootprints(cityjson));
    const bbox =
      fetchOptions.source === 'loaded-data'
        ? footprintBbox ?? viewportBbox
        : viewportBbox ?? footprintBbox;
    const scopeLabel =
      fetchOptions.source === 'loaded-data' ? 'loaded Hamburg extent' : 'current viewport';
    if (!bbox) {
      setRoadStatus('Could not derive a map bbox. Draw a road manually, or move the map and try again.');
      return;
    }
    const expandedBbox = expandBbox(bbox, 0.08);
    const metricCrs = activeMetricCrsForCityJson(cityjson);
    const { bbox: queryBbox, wasLimited } = fetchOptions.allowLargeQuery
      ? { bbox: expandedBbox, wasLimited: false }
      : limitRoadQueryBbox(expandedBbox, {
          metricCrs,
          maxWidthMeters: ROAD_QUERY_MAX_WIDTH_METERS,
          maxHeightMeters: ROAD_QUERY_MAX_HEIGHT_METERS,
        });
    const timeoutMs = fetchOptions.allowLargeQuery ? 60_000 : ROAD_QUERY_TIMEOUT_MS;
    setRoadStatus(
      wasLimited
        ? `Fetching OSM roads for the centre of this viewport. The query was limited to a metric ${metricCrs} window to avoid public Overpass timeouts.`
        : `Fetching OSM roads for the ${scopeLabel}...`
    );
    try {
      // Public Overpass instances occasionally return 504 for perfectly valid
      // queries. Rotate through known public instances and keep the editor open
      // so manual drawing remains available when the network path is unhappy.
      const { xmlText, endpoint } = await fetchOsmRoadXml(queryBbox, timeoutMs);
      try {
        await loadOsmRoadXml(xmlText, queryBbox, {
          sourceLabel: shortEndpointName(endpoint),
        });
      } catch {
        // loadOsmRoadXml already reports the detailed WASM failure and keeps
        // the parsed OSM centerlines available for manual editing.
      }
    } catch (error) {
      console.error(error);
      setRoadStatus(
        `OSM road fetch failed from public Overpass services. Zoom in or pan to a smaller area, then try again. You can still use Draw / redraw road. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [cityjson, coreState.mapBboxRef, loadOsmRoadXml]);

  const handleOsmRoadSelect = useCallback((road: OsmRoadFeature) => {
    setJunctionDraft(null);
    clearRoadDraftHistory();
    setShowRoadEditor(true);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setSelectedOsmRoadId(road.id);
    setSelectedRoadArea(null);
    setEditingRoadId(null);
    setRoadEditBaseline(null);
    setLastInsertedRoadId(null);
    const inferred = cloneRoadDraft(road.inferredDraft);
    const ok = window.confirm(
      `OSM interpretation for ${road.tags.name ?? road.id}:\n\n` +
        `${summarizeRoadDraft(inferred)}\n\n` +
        'Does this match the satellite/road reality?\n\n' +
        'OK: use this as the edit draft.\n' +
        'Cancel: keep OSM as a seed, then redraw/edit in the road panel.'
    );
    if (ok) {
      setRoadDraft({ ...inferred, userVerified: true });
      setRoadDraftDirty(false);
      setRoadStatus('OSM interpretation accepted. Edit widths/speed if needed, then insert.');
      return;
    }
    setRoadDraft({ ...inferred, userVerified: false });
    setRoadDraftDirty(false);
    setRoadStatus('OSM kept as a seed. Use Draw / redraw road and edit lanes before inserting.');
  }, [clearRoadDraftHistory]);

  const handleOsm2StreetsSelect = useCallback(
    (selection: Osm2StreetsSelection) => {
      setShowRoadEditor(true);
      setOsm2streetsSelection(selection);
      const connected = connectedRoadIdsForSelection(selection, osm2streetsResult);
      setHighlightedOsm2StreetsRoadIds(connected);
      if (!selection) return;
      if (selection.kind === 'lane') {
        const props = selection.feature.properties ?? {};
        setRoadStatus(
          `Selected osm2streets lane ${props.index ?? '?'} on road ${props.road ?? '?'}. Showing ${connected.size} road${connected.size === 1 ? '' : 's'} sharing its endpoint nodes.`
        );
      } else {
        const props = selection.feature.properties ?? {};
        setRoadStatus(
          `Selected osm2streets intersection ${props.id ?? '?'} (${props.intersection_kind ?? props.kind ?? 'unknown'}). Showing ${connected.size} connected road${connected.size === 1 ? '' : 's'}.`
        );
      }
    },
    [osm2streetsResult]
  );

  const handleClearOsm2StreetsSelection = useCallback(() => {
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
  }, []);

  const handleCreateDraftFromOsm2StreetsSelection = useCallback(() => {
    if (!osm2streetsResult || !osm2streetsSelection) return;
    try {
      const { draft, matchedOsmRoad } = buildRoadDraftFromOsm2StreetsSelection(
        osm2streetsSelection,
        osm2streetsResult,
        osmRoads
      );
      clearRoadDraftHistory();
      setJunctionDraft(null);
      setRoadDraft(draft);
      setRoadEditBaseline(null);
      setRoadDraftDirty(false);
      setEditingRoadId(null);
      setLastInsertedRoadId(null);
      setSelectedRoadArea(null);
      setSelectedOsmRoadId(matchedOsmRoad?.id ?? null);
      setRoadStatus(
        matchedOsmRoad
          ? `Created editable draft from osm2streets road ${draft.id} using OSM way ${matchedOsmRoad.osmWayId}.`
          : `Created editable draft from osm2streets road ${draft.id}; source OSM centerline was unavailable, so the selected lane polygon seeded the centerline.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRoadStatus(message);
      alert(`osm2streets draft creation failed: ${message}`);
    }
  }, [clearRoadDraftHistory, osm2streetsResult, osm2streetsSelection, osmRoads]);

  const handleStartRoadDraw = useCallback(() => {
    setJunctionDraft(null);
    setShowRoadEditor(true);
    setSelection(null);
    setDrawMode('road-line');
    setRoadStatus('Draw the road centerline on the map, then press Enter.');
  }, [setSelection, setDrawMode]);

  const handleRoadLineDrawn = useCallback(
    (lineWgs84: [number, number][]) => {
      setDrawMode('none');
      if (lineWgs84.length < 2) {
        alert('Road centerline needs at least two points.');
        return;
      }
      recordRoadDraftHistory(
        roadDraft,
        roadDraftDirty,
        roadDraft ? 'Redraw road' : 'Draw new road'
      );
      if (!roadDraft) {
        setRoadDraft(createManualRoadDraft(lineWgs84));
      } else {
        const fallback = createManualRoadDraft(lineWgs84).sections[0];
        const first = roadDraft.sections[0] ?? fallback;
        setRoadDraft({
          ...roadDraft,
          userVerified: true,
          sections: [
            {
              ...first,
              id: first.id ?? 'section-1',
              centerlineWgs84: lineWgs84,
              curve: first.curve ?? fallback.curve,
              connections: undefined,
              bands: first.bands.map((band) => ({
                ...band,
                allowedModes: band.allowedModes ? [...band.allowedModes] : undefined,
              })),
            },
          ],
        });
      }
      setRoadDraftDirty(true);
      setRoadStatus('Manual road centerline updated. Check bands and speed, then insert.');
    },
    [recordRoadDraftHistory, roadDraft, roadDraftDirty, setDrawMode]
  );

  const handleRoadDraftChange = useCallback(
    (draft: RoadDraft, label = 'Edit road', historyGroup?: string) => {
      recordRoadDraftHistory(roadDraft, roadDraftDirty, label, historyGroup);
      setRoadDraft(draft);
      setRoadDraftDirty(true);
      setLastInsertedRoadId(null);
    },
    [recordRoadDraftHistory, roadDraft, roadDraftDirty]
  );

  const handleEditSelectedRoadArea = useCallback((area: RoadArea) => {
    if (roadDraftDirty && !window.confirm('Discard the unsaved road draft and edit this selection?')) return;
    if (junctionDirty && !window.confirm('Discard the unsaved intersection draft and edit this selection?')) return;
    setShowRoadEditor(true);
    setJunctionPendingRoad(null);
    if (String(area.attributes.transportationUsage ?? area.function).toLowerCase() === 'intersection') {
      if (!cityjson) return;
      try {
        const loaded = extractTransportationAreas(cityjson);
        const draft = readRoadJunction(loaded, area.roadId);
        setJunctionDraft(draft); setJunctionBaseline(JSON.stringify(draft)); setJunctionHistory([]); setJunctionFuture([]);
        setRoadDraft(null); setRoadDraftDirty(false); setEditingRoadId(null); setSelectedRoadArea(area);
        setJunctionEditTool('none'); setJunctionSource('__all__'); setSelectedOsmRoadId(null); setOsm2streetsSelection(null);
        setRoadStatus('All incoming roads are shown together. Select a lane to inspect turns; click Generate in Shape to preview a new surface.');
      } catch (error) { setRoadStatus(String(error)); }
      return;
    }
    setJunctionDraft(null);
    setJunctionEditTool('none');
    const savedDraft = area.editableDraft ? cloneRoadDraft(area.editableDraft) : null;
    let draft: RoadDraft;
    try {
      draft =
        savedDraft ??
        deriveEditableRoadDraftFromAreas(
          cityjson ? extractTransportationAreas(cityjson) : [area],
          area.roadId
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRoadStatus(message);
      alert(`CityJSON road editing failed: ${message}`);
      return;
    }
    const editingDraft = {
      ...draft,
      id: area.roadId,
    };
    clearRoadDraftHistory();
    setRoadDraft(editingDraft);
    const preservesImportedGeometry = area.geometryMode === 'exact' || !savedDraft;
    setRoadEditBaseline(
      preservesImportedGeometry
        ? {
            roadId: area.roadId,
            draft: cloneRoadDraft(editingDraft),
            exactGeometry: true,
          }
        : null
    );
    setRoadDraftDirty(false);
    setSelectedRoadArea(area);
    setEditingRoadId(area.roadId);
    setLastInsertedRoadId(area.roadId);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setSelectedOsmRoadId(null);
    setRoadStatus(
      savedDraft && !preservesImportedGeometry
        ? `Loaded editable layout from ${area.roadId}. Changes stay in the draft until you save them.`
        : `Editing ${area.roadId} on its exact CityJSON polygons. Type, direction, material, access and speed edits preserve them; moving handles, changing widths or restructuring bands rebuilds editable ribbons.`
    );
  }, [cityjson, clearRoadDraftHistory, roadDraftDirty, junctionDirty, roadFitTrees]);

  const handleCancelRoadEdit = useCallback((force = false) => {
    if (!force && roadDraftDirty && !window.confirm('Discard the unsaved road-edit draft?')) return;
    clearRoadDraftHistory();
    setDrawMode('none');
    setSelection(null);
    setRoadDraft(null);
    setRoadEditBaseline(null);
    setRoadDraftDirty(false);
    setEditingRoadId(null);
    setSelectedRoadArea(null);
    setSelectedOsmRoadId(null);
    setLastInsertedRoadId(null);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setRoadStatus('Road edit canceled. No unsaved draft changes were applied to CityJSON.');
  }, [clearRoadDraftHistory, roadDraftDirty, setDrawMode, setSelection]);

  const handleSplitRoadDraft = useCallback((sectionId: string, fraction: number) => {
    if (!roadDraft) return;
    try {
      const next = splitRoadSectionAtFraction(roadDraft, sectionId, fraction);
      recordRoadDraftHistory(roadDraft, roadDraftDirty, 'Split road section');
      setRoadDraft(next);
      setRoadDraftDirty(true);
      setRoadStatus(`Split ${sectionId} at ${(fraction * 100).toFixed(0)}%.`);
    } catch (error) {
      alert(`Road split failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [recordRoadDraftHistory, roadDraft, roadDraftDirty]);

  const buildingFootprints = useMemo(
    () => (cityjson ? extractFootprints(cityjson) : []),
    [cityjson, reloadToken]
  );
  const roadAreas = useMemo(() => {
    if (!cityjson) return [];
    return extractTransportationAreas(cityjson);
  }, [cityjson, reloadToken]);
  const junctionWorkingAreas = useMemo(() => {
    if (!cityjson || !junctionDraft || !junctionPendingRoad) return roadAreas;
    return [...roadAreas.filter(area => area.roadId !== junctionPendingRoad.roadId), ...buildRoadPreviewAreas(cityjson, junctionPendingRoad.draft, { id: junctionPendingRoad.roadId })];
  }, [cityjson, junctionDraft, junctionPendingRoad, roadAreas]);
  const junctionPlan = useMemo(() => junctionDraft ? buildRoadJunctionPlan(junctionDraft, junctionWorkingAreas) : null, [junctionDraft, junctionWorkingAreas]);
  const junctionConflicts = useMemo(() => junctionDraft?.surfaceMode === 'rebuild' && junctionPlan && cityjson ? validateRoadFit({
    roadAreas: junctionPlan.areas, existingRoadAreas: roadAreas, removedRoadIds: junctionPlan.removedRoadIds, buildingFootprints,
    trees: roadFitTrees, metricCrs: activeMetricCrsForCityJson(cityjson), treeClearanceM: 0,
  }) : [], [junctionDraft, junctionPlan, roadAreas, cityjson, buildingFootprints, roadFitTrees]);
  const handleCreateJunction = useCallback((sectionId: string, endpoint: 'start' | 'end') => {
    if (!cityjson || !roadDraft) return;
    try {
      const baseline = editingRoadId ? roadAreas.find(area => area.roadId === editingRoadId)?.editableDraft ?? deriveEditableRoadDraftFromAreas(roadAreas, editingRoadId) : null;
      const issues = validateRoadRules(roadDraft, baseline).filter(issue => issue.severity === 'error');
      if (issues.length) { setRoadStatus(issues.map(issue => issue.message).join(' ')); return; }
      let suffix = 1; while (cityjson.CityObjects[`connected-road-${suffix}`]) suffix++;
      const roadId = editingRoadId ?? `connected-road-${suffix}`;
      const pending = { draft: { ...roadDraft, id: roadId }, roadId, editingRoadId, dirty: roadDraftDirty };
      const prepared = [...roadAreas.filter(area => area.roadId !== roadId), ...buildRoadPreviewAreas(cityjson, pending.draft, { id: roadId })];
      const draft = createRoadJunctionAtEndpoint(prepared, roadId, sectionId, endpoint);
      setJunctionPendingRoad(pending);
      setJunctionDraft(draft); setJunctionBaseline(''); setJunctionHistory([]); setJunctionFuture([]);
      setRoadDraft(null); setRoadDraftDirty(false); setEditingRoadId(null); setShowRoadEditor(true);
      setRoadStatus('Review the junction and its connected road. Save intersection commits both together; Discard returns to your road draft.');
    } catch (error) { setRoadStatus(error instanceof Error ? error.message : String(error)); }
  }, [cityjson, roadDraft, editingRoadId, roadDraftDirty, roadAreas]);
  const handleSaveJunction = useCallback(() => {
    if (!cityjson || !junctionDraft) return;
    try {
      setJunctionSaveError(null);
      if (junctionEditTool.startsWith('trace-')) throw new Error('Finish or cancel the traced outline before saving.');
      const savedAreas = extractTransportationAreas(cityjson);
      const working = junctionPendingRoad ? [...savedAreas.filter(area => area.roadId !== junctionPendingRoad.roadId), ...buildRoadPreviewAreas(cityjson, junctionPendingRoad.draft, { id: junctionPendingRoad.roadId })] : savedAreas;
      const plan = buildRoadJunctionPlan(junctionDraft, working);
      const conflicts = junctionDraft.surfaceMode === 'rebuild' ? validateRoadFit({ roadAreas: plan.areas, existingRoadAreas: savedAreas, removedRoadIds: plan.removedRoadIds,
        buildingFootprints, trees: roadFitTrees, metricCrs: activeMetricCrsForCityJson(cityjson), treeClearanceM: 0 }) : [];
      if (plan.error || conflicts.some((item) => item.severity === 'error')) throw new Error(plan.error ?? conflicts.map((item) => item.label).join(' '));
      pushUndo('Edit intersection');
      runStructurallyGuardedMutation(cityjson, 'Save intersection', () => {
        if (junctionPendingRoad) {
          insertRoadIntoCityJson(cityjson, junctionPendingRoad.draft, { id: junctionPendingRoad.roadId });
          synchronizeRoadConnectionMetadata(cityjson, junctionPendingRoad.roadId, junctionPendingRoad.draft);
        }
        saveRoadJunction(cityjson, junctionDraft, plan);
        if (junctionDraft.surfaceMode === 'rebuild') compactVertices(cityjson);
      });
      setDirtyIds((ids) => new Set([...ids, ...plan.replacedRoadIds, ...(plan.removedRoadIds ?? [])])); setReloadToken((value) => value + 1);
      if (junctionDraft.surfaceMode === 'rebuild') markGeometryChanged('Intersection surface changed; run Check 3D before export.');
      const saved = readRoadJunction(extractTransportationAreas(cityjson), junctionDraft.id);
      setJunctionDraft(saved); setJunctionBaseline(JSON.stringify(saved)); setJunctionHistory([]); setJunctionFuture([]);
      setJunctionPendingRoad(null);
      setRoadStatus(`Saved ${junctionDraft.name}, including its lane movements${junctionDraft.surfaceMode === 'rebuild' ? ' and trimmed approaches' : ''}.`);
    } catch (error) { const message = error instanceof Error ? error.message : String(error); setJunctionSaveError(message); setRoadStatus(message); }
  }, [cityjson, junctionDraft, junctionPendingRoad, junctionEditTool, buildingFootprints, roadFitTrees, pushUndo, setDirtyIds, setReloadToken, markGeometryChanged]);
  const [roadPreviewAreas, setRoadPreviewAreas] = useState<RoadArea[]>([]);
  const [roadPreviewError, setRoadPreviewError] = useState<string | null>(null);
  const [roadFitConflicts, setRoadFitConflicts] = useState<RoadFitConflict[]>([]);
  const [roadFitPending, setRoadFitPending] = useState(false);
  const ruleBaseline = useMemo(() => {
    if (!editingRoadId) return null;
    try { return roadAreas.find((area) => area.roadId === editingRoadId && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(roadAreas, editingRoadId); }
    catch { return null; }
  }, [roadAreas, editingRoadId]);
  const roadRuleIssues = useMemo(() => roadDraft ? [...validateRoadRules(roadDraft, ruleBaseline), ...(roadPreviewError ? [{ sectionId: '', code: 'configuration' as const, severity: 'error' as const, message: roadPreviewError }] : [])] : [], [roadDraft, ruleBaseline, roadPreviewError]);
  const lastPreviewAtRef = useRef(0);

  // Geometry preview is capped at roughly 20 fps during a drag. The previous
  // path cloned the entire CityJSON document and reran fit validation for every
  // pointer event, which made handles feel detached on city-scale datasets.
  useEffect(() => {
    if (!cityjson || !roadDraft) {
      setRoadPreviewAreas([]);
      setRoadPreviewError(null);
      setRoadFitConflicts([]);
      setRoadFitPending(false);
      return;
    }
    const shouldHidePreview =
      !roadDraftDirty && !!(osm2streetsResult || selectedRoadArea || lastInsertedRoadId);
    if (shouldHidePreview) {
      setRoadPreviewAreas([]);
      setRoadPreviewError(null);
      return;
    }
    const elapsed = performance.now() - lastPreviewAtRef.current;
    const delay = Math.max(0, 50 - elapsed);
    const timer = window.setTimeout(() => {
      try {
        const preview = exactGeometryStatus === 'preserved' && editingRoadId
            ? buildExactRoadAttributePreviewAreas(roadAreas, editingRoadId, roadDraft!)
            : buildRoadPreviewAreas(cityjson!, roadDraft!, { id: editingRoadId ?? '__road_preview__' });
        const connected = exactGeometryStatus === 'preserved' ? { areas: preview } : buildConnectedJunctionPreview(roadAreas, preview);
        setRoadPreviewAreas(connected.areas);
        setRoadPreviewError('error' in connected && connected.error ? String(connected.error) : null);
      } catch (error) {
        setRoadPreviewAreas([]);
        setRoadPreviewError(error instanceof Error ? error.message : String(error));
      }
      lastPreviewAtRef.current = performance.now();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    cityjson,
    roadDraft,
    roadDraftDirty,
    osm2streetsResult,
    selectedRoadArea,
    lastInsertedRoadId,
    exactGeometryStatus,
    editingRoadId,
    roadAreas,
    reloadToken,
  ]);

  const roadFitAreas = useMemo(() => {
    if (roadPreviewAreas.length > 0) return roadPreviewAreas;
    if (!roadDraft || !editingRoadId) return [];
    return roadAreas.filter((area) => area.roadId === editingRoadId);
  }, [editingRoadId, roadAreas, roadDraft, roadPreviewAreas]);

  // Clearance/overlap checks intentionally trail the visual curve slightly;
  // they settle after the user's latest movement instead of blocking it.
  useEffect(() => {
    if (!cityjson || roadFitAreas.length === 0) {
      setRoadFitConflicts([]);
      setRoadFitPending(false);
      return;
    }
    const validateChangedGeometry =
      roadPreviewAreas.length > 0 && exactGeometryStatus !== 'preserved';
    setRoadFitPending(true);
    const timer = window.setTimeout(() => {
      setRoadFitConflicts(
        validateRoadFit({
          roadAreas: roadFitAreas,
          existingRoadAreas: validateChangedGeometry ? roadAreas : undefined,
          buildingFootprints: validateChangedGeometry ? buildingFootprints : [],
          trees: roadFitTrees,
          affectedLand: validateChangedGeometry ? affectedZones : [],
          metricCrs: activeMetricCrsForCityJson(cityjson),
          buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
          buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
          treeClearanceM: ROAD_TREE_CLEARANCE_METERS,
        })
      );
      setRoadFitPending(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [
    cityjson,
    roadFitAreas,
    roadAreas,
    roadFitTrees,
    buildingFootprints,
    affectedZones,
    exactGeometryStatus,
    roadPreviewAreas.length,
  ]);

  const handleInsertRoad = useCallback(() => {
    if (!cityjson || !roadDraft) return;
    const ruleErrors = validateRoadRules(roadDraft, ruleBaseline).filter((issue) => issue.severity === 'error');
    if (ruleErrors.length) {
      setRoadStatus(ruleErrors.map((issue) => issue.message).join(' '));
      return;
    }
    const targetRoadId = editingRoadId;
    const preserveExactGeometry =
      exactGeometryStatus === 'preserved' && targetRoadId !== null;
    // Recheck synchronously at commit so the edit-time debounce can never
    // allow a stale clear result to bypass the insertion gate.
    let connectedPreview: ReturnType<typeof buildConnectedJunctionPreview>;
    try {
    const roadOnlyPreview = preserveExactGeometry
      ? buildExactRoadAttributePreviewAreas(roadAreas, targetRoadId!, roadDraft)
      : buildRoadPreviewAreas(cityjson, roadDraft, {
          id: targetRoadId ?? '__road_preview__',
        });
    connectedPreview = preserveExactGeometry ? { areas: roadOnlyPreview, plans: [] } : buildConnectedJunctionPreview(roadAreas, roadOnlyPreview);
    } catch (error) { setRoadStatus(error instanceof Error ? error.message : String(error)); return; }
    if ('error' in connectedPreview && connectedPreview.error) { setRoadStatus(String(connectedPreview.error)); return; }
    const commitPreview = connectedPreview.areas;
    const propagationPlan = targetRoadId
      ? planStaleReciprocalRoadPropagation(cityjson, targetRoadId, roadDraft)
      : null;
    // Existing exact polygons are not moved by an attribute-only edit, so a
    // pre-existing fit issue must not suddenly block changing their semantics.
    const commitConflicts = validateRoadFit({
          roadAreas: commitPreview,
          existingRoadAreas: preserveExactGeometry || propagationPlan?.propagatedConnectionCount ? undefined : roadAreas,
          buildingFootprints: preserveExactGeometry ? [] : buildingFootprints,
          trees: roadFitTrees,
          affectedLand: preserveExactGeometry ? [] : affectedZones,
          metricCrs: activeMetricCrsForCityJson(cityjson),
          buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
          buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
          treeClearanceM: ROAD_TREE_CLEARANCE_METERS,
        });
    const blockingConflicts = commitConflicts.filter(
      (conflict) => conflict.severity === 'error'
    );
    if (blockingConflicts.length > 0) {
      alert(
        `Road insertion is blocked by ${blockingConflicts.length} fit conflict${
          blockingConflicts.length === 1 ? '' : 's'
        }:\n\n${blockingConflicts.slice(0, 5).map((conflict) => conflict.label).join('\n')}`
      );
      return;
    }
    let savedRoadDraft = roadDraft;
    let propagatedPeerDrafts: Array<{ roadId: string; draft: RoadDraft }> = [];
    let propagatedConnectionCount = 0;
    if (
      propagationPlan &&
      propagationPlan.propagatedConnectionCount > 0 &&
      window.confirm(
        `This edit moved ${propagationPlan.propagatedConnectionCount} confirmed connected road endpoint${
          propagationPlan.propagatedConnectionCount === 1 ? '' : 's'
        }. Move ${
          propagationPlan.propagatedConnectionCount === 1
            ? 'the connected endpoint'
            : 'those connected endpoints'
        } too and keep ${propagationPlan.propagatedConnectionCount === 1 ? 'the join' : 'the joins'}?`
      )
    ) {
      savedRoadDraft = propagationPlan.sourceDraft;
      propagatedPeerDrafts = propagationPlan.peerDrafts;
      propagatedConnectionCount = propagationPlan.propagatedConnectionCount;
    }
    const remainingStaleConnections = targetRoadId
      ? findStaleReciprocalRoadConnections(cityjson, targetRoadId, savedRoadDraft)
      : [];
    if (
      remainingStaleConnections.length > 0 &&
      !window.confirm(
        `This edit leaves ${remainingStaleConnections.length} confirmed reciprocal road join${
          remainingStaleConnections.length === 1 ? '' : 's'
        } stale. Save and disconnect ${
          new Set(remainingStaleConnections.map((connection) => connection.roadId)).size
        } connected road${
          new Set(remainingStaleConnections.map((connection) => connection.roadId)).size === 1
            ? ''
            : 's'
        }?`
      )
    ) {
      return;
    }
    const propagatedAreas = propagatedPeerDrafts.flatMap(({ roadId, draft }) => buildRoadPreviewAreas(cityjson, draft, { id: roadId }));
    const finalPreview = preserveExactGeometry ? connectedPreview : buildConnectedJunctionPreview(roadAreas, [...buildRoadPreviewAreas(cityjson, savedRoadDraft, { id: targetRoadId ?? '__road_preview__' }), ...propagatedAreas]);
    if ('error' in finalPreview && finalPreview.error) { setRoadStatus(finalPreview.error); return; }
    const propagatedBlockingConflicts = !preserveExactGeometry ? validateRoadFit({
        roadAreas: finalPreview.areas,
        existingRoadAreas: roadAreas,
        buildingFootprints,
        trees: roadFitTrees,
        affectedLand: affectedZones,
        metricCrs: activeMetricCrsForCityJson(cityjson),
        buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
        buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
        treeClearanceM: ROAD_TREE_CLEARANCE_METERS,
      }).filter((conflict) => conflict.severity === 'error') : [];
    if (propagatedBlockingConflicts.length > 0) {
      alert(
        `Connected-road movement is blocked by ${propagatedBlockingConflicts.length} fit conflict${
          propagatedBlockingConflicts.length === 1 ? '' : 's'
        }:\n\n${propagatedBlockingConflicts
          .slice(0, 5)
          .map((conflict) => conflict.label)
          .join('\n')}`
      );
      return;
    }
    try {
      pushUndo(
        preserveExactGeometry
          ? 'Update exact CityJSON road attributes'
          : targetRoadId
            ? 'Update CityJSON road'
            : 'Insert CityJSON road'
      );
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        preserveExactGeometry
          ? 'Updating exact CityJSON road attributes'
          : targetRoadId
            ? 'Updating CityJSON road'
            : 'Inserting CityJSON road',
        () => {
          const inserted = preserveExactGeometry
            ? updateExactRoadAttributesInCityJson(cityjson, targetRoadId!, savedRoadDraft)
            : insertRoadIntoCityJson(
                cityjson,
                savedRoadDraft,
                targetRoadId ? { id: targetRoadId } : undefined
              );
          const propagatedRoadIds = propagatedPeerDrafts.map(({ roadId, draft }) => {
            insertRoadIntoCityJson(cityjson, draft, { id: roadId });
            return roadId;
          });
          const disconnected = targetRoadId
            ? clearStaleReciprocalRoadConnections(cityjson, inserted.id, savedRoadDraft)
            : { disconnectedRoadIds: [], disconnectedConnectionCount: 0 };
          const connectedRoadIds = synchronizeRoadConnectionMetadata(
            cityjson,
            inserted.id,
            savedRoadDraft
          );
          if (!preserveExactGeometry) {
            const currentAreas = extractTransportationAreas(cityjson);
            const changedIds = new Set([inserted.id, ...propagatedRoadIds]);
            const connected = buildConnectedJunctionPreview(currentAreas, currentAreas.filter((area) => changedIds.has(area.roadId)));
            if (connected.error) throw new Error(connected.error);
            const conflicts = validateRoadFit({ roadAreas: connected.areas, existingRoadAreas: roadAreas, buildingFootprints, trees: roadFitTrees, metricCrs: activeMetricCrsForCityJson(cityjson), treeClearanceM: 0 });
            if (conflicts.some((conflict) => conflict.severity === 'error')) throw new Error(conflicts.filter((conflict) => conflict.severity === 'error').map((conflict) => conflict.label).join(' '));
            for (const { draft, plan } of connected.plans) saveRoadJunction(cityjson, draft, plan);
            connectedRoadIds.push(...connected.plans.flatMap(({ plan }) => plan.replacedRoadIds));
          }
          if (targetRoadId && !preserveExactGeometry) compactVertices(cityjson);
          return {
            ...inserted,
            ...disconnected,
            connectedRoadIds,
            propagatedRoadIds,
            propagatedConnectionCount,
          };
        }
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(result.id);
        for (const connectedRoadId of result.connectedRoadIds) next.add(connectedRoadId);
        for (const propagatedRoadId of result.propagatedRoadIds) next.add(propagatedRoadId);
        for (const disconnectedRoadId of result.disconnectedRoadIds) next.add(disconnectedRoadId);
        return next;
      });
      setSelection(null);
      setSelectedRoadArea(null);
      setLastInsertedRoadId(result.id);
      setEditingRoadId(result.id);
      setRoadDraft(cloneRoadDraft({ ...savedRoadDraft, id: result.id }));
      setRoadDraftDirty(false);
      clearRoadDraftHistory();
      setRoadEditBaseline(
        preserveExactGeometry
          ? {
              roadId: result.id,
              draft: cloneRoadDraft(savedRoadDraft),
              exactGeometry: true,
            }
          : null
      );
      setReloadToken((t) => t + 1);
      if (!preserveExactGeometry) {
        markGeometryChanged('Road geometry changed; run Check 3D before export.');
      }
      setRoadStatus(
        preserveExactGeometry
          ? `Saved attributes on ${result.id} while preserving all ${result.areas.length} exact transportation polygons and vertices${
              result.connectedRoadIds.length > 0
                ? `; confirmed ${result.connectedRoadIds.length} reciprocal road connection${result.connectedRoadIds.length === 1 ? '' : 's'}`
                : ''
            }.`
          : targetRoadId
          ? `Saved changes to ${result.id} with ${result.areas.length} transportation surfaces${
              result.connectedRoadIds.length > 0
                ? ` and confirmed ${result.connectedRoadIds.length} reciprocal road connection${result.connectedRoadIds.length === 1 ? '' : 's'}`
                : ''
            }${
              result.propagatedConnectionCount > 0
                ? ` and moved ${result.propagatedConnectionCount} connected road endpoint${
                    result.propagatedConnectionCount === 1 ? '' : 's'
                  }`
                : ''
            }${
              result.disconnectedConnectionCount > 0
                ? ` and cleared ${result.disconnectedConnectionCount} stale reciprocal road connection${result.disconnectedConnectionCount === 1 ? '' : 's'}`
                : ''
            }.`
          : `Inserted ${result.id} with ${result.areas.length} transportation surfaces${
              result.connectedRoadIds.length > 0
                ? ` and confirmed ${result.connectedRoadIds.length} reciprocal road connection${result.connectedRoadIds.length === 1 ? '' : 's'}`
                : ''
            }.`
      );
    } catch (error) {
      console.error(error);
      alert(`Road insertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [
    cityjson,
    roadDraft,
    ruleBaseline,
    editingRoadId,
    exactGeometryStatus,
    roadAreas,
    buildingFootprints,
    roadFitTrees,
    affectedZones,
    clearRoadDraftHistory,
    pushUndo,
    setDirtyIds,
    setSelection,
    setReloadToken,
    markGeometryChanged,
  ]);

  const handleInsertOsm2StreetsSelection = useCallback(() => {
    if (!cityjson || !osm2streetsResult || !osm2streetsSelection) return;
    try {
      pushUndo('Import osm2streets road into CityJSON for editing');
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        'Importing osm2streets road into CityJSON for editing',
        () =>
          insertOsm2StreetsRoadIntoCityJson(
            cityjson,
            osm2streetsSelection,
            osm2streetsResult,
            osmRoads
          )
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(result.id);
        return next;
      });
      const editingDraft = deriveEditableRoadDraftFromAreas(result.areas, result.id);
      clearRoadDraftHistory();
      setSelection(null);
      setRoadDraft(editingDraft);
      setRoadEditBaseline({
        roadId: result.id,
        draft: cloneRoadDraft(editingDraft),
        exactGeometry: true,
      });
      setRoadDraftDirty(false);
      setEditingRoadId(result.id);
      setSelectedRoadArea(result.areas[0] ?? null);
      setLastInsertedRoadId(result.id);
      setReloadToken((t) => t + 1);
      markGeometryChanged('Road geometry changed; run Check 3D before export.');
      setRoadStatus(
        `Editing ${result.id}. Its ${result.areas.length} exact osm2streets surfaces are now stored in CityJSON; attribute edits preserve their vertices.`
      );
    } catch (error) {
      console.error(error);
      alert(
        `osm2streets CityJSON insertion failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [
    cityjson,
    osm2streetsResult,
    osm2streetsSelection,
    osmRoads,
    clearRoadDraftHistory,
    pushUndo,
    setDirtyIds,
    setSelection,
    setReloadToken,
    markGeometryChanged,
  ]);

  const handleDeleteSelectedRoadArea = useCallback((area: RoadArea) => {
    if (!cityjson) return;
    const roadId = area.roadId;
    if (!window.confirm(`Delete ${roadId}? Connected roads will be disconnected.`)) return;

    try {
      pushUndo(`Delete ${roadId}`);
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        `Deleting ${roadId}`,
        () => {
          const deletion = deleteRoadFromCityJson(cityjson, roadId);
          if (deletion.deleted) compactVertices(cityjson);
          return deletion;
        }
      );
      if (!result.deleted) {
        setRoadStatus(`${roadId} is no longer available.`);
        return;
      }
      setDirtyIds((previous) => {
        const next = new Set(previous);
        next.add(roadId);
        for (const disconnectedRoadId of result.disconnectedRoadIds) {
          next.add(disconnectedRoadId);
        }
        return next;
      });
      clearRoadDraftHistory();
      setSelectedRoadArea(null);
      setRoadDraft(null);
      setJunctionDraft(null);
      setRoadEditBaseline(null);
      setRoadDraftDirty(false);
      setEditingRoadId(null);
      setLastInsertedRoadId((current) => current === roadId ? null : current);
      setSelection(null);
      setDrawMode('none');
      setReloadToken((token) => token + 1);
      markGeometryChanged('Road geometry changed; run Check 3D before export.');
      setRoadStatus(
        `Deleted ${roadId}${
          result.disconnectedRoadIds.length > 0
            ? ` and cleared ${result.disconnectedRoadIds.length} reciprocal road connection${result.disconnectedRoadIds.length === 1 ? '' : 's'}`
            : ''
        }.`
      );
    } catch (error) {
      console.error(error);
      alert(`Road deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [
    cityjson,
    pushUndo,
    setDirtyIds,
    clearRoadDraftHistory,
    setSelection,
    setDrawMode,
    setReloadToken,
    markGeometryChanged,
  ]);

  const handleExportRoadPayload = useCallback(() => {
    if (!roadDraft) return;
    const targetRoadId = editingRoadId ?? lastInsertedRoadId;
    downloadJson(
      buildRoadEditPayload(roadDraft, targetRoadId ?? undefined),
      `${targetRoadId ?? roadDraft.id ?? 'road-edit'}.payload.json`
    );
  }, [roadDraft, editingRoadId, lastInsertedRoadId]);

  const handlePostRoadPayload = useCallback(async () => {
    if (!roadDraft) return;
    try {
      const targetRoadId = editingRoadId ?? lastInsertedRoadId;
      const response = await fetch(roadBackendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRoadEditPayload(roadDraft, targetRoadId ?? undefined)),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      setRoadStatus(`Posted road payload to ${roadBackendUrl}.`);
    } catch (error) {
      console.error(error);
      setRoadStatus(error instanceof Error ? error.message : String(error));
      alert(`Road backend POST failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [roadDraft, roadBackendUrl, editingRoadId, lastInsertedRoadId]);

  return {
    showRoadEditor,
    setShowRoadEditor,
    basemap,
    setBasemap,
    satelliteOpacity,
    setSatelliteOpacity,
    roadOverlayOpacity,
    setRoadOverlayOpacity,
    osmRoads,
    setOsmRoads,
    osmPointFeatures,
    selectedOsmRoadId,
    setSelectedOsmRoadId,
    roadDraft,
    setRoadDraft,
    selectedRoadBand,
    setSelectedRoadBand,
    roadDraftDirty,
    roadDraftHistoryState,
    handleUndoRoadDraft,
    handleRedoRoadDraft,
    exactGeometryStatus,
    editingRoadId,
    roadStatus,
    setRoadStatus,
    selectedRoadArea,
    setSelectedRoadArea,
    lastInsertedRoadId,
    setLastInsertedRoadId,
    roadBackendUrl,
    setRoadBackendUrl,
    finishRoadDrawToken,
    setFinishRoadDrawToken,
    osm2streetsResult,
    setOsm2streetsResult,
    osm2streetsBbox,
    setOsm2streetsBbox,
    osm2streetsSelection,
    setOsm2streetsSelection,
    highlightedOsm2StreetsRoadIds,
    setHighlightedOsm2StreetsRoadIds,
    clearRoadSelectionHighlights,
    handleCloseRoadWorkspace,
    clearOsmRoadData,
    handleFetchOsmRoads,
    loadOsmRoadXml,
    handleOsmRoadSelect,
    handleOsm2StreetsSelect,
    handleClearOsm2StreetsSelection,
    handleCreateDraftFromOsm2StreetsSelection,
    handleStartRoadDraw,
    handleRoadLineDrawn,
    handleRoadDraftChange,
    handleEditSelectedRoadArea,
    handleCancelRoadEdit,
    handleSplitRoadDraft,
    handleInsertRoad,
    handleInsertOsm2StreetsSelection,
    handleDeleteSelectedRoadArea,
    handleExportRoadPayload,
    handlePostRoadPayload,
    roadAreas: junctionDraft && junctionPendingRoad ? junctionWorkingAreas : roadAreas,
    roadPreviewAreas,
    roadFitConflicts,
    roadFitPending,
    roadRuleIssues,
    junctionDraft, junctionPlan, junctionConflicts, junctionDirty, junctionSaveError,
    junctionSource, setJunctionSource,
    junctionEditTool, setJunctionEditTool,
    handleJunctionChange, handleUndoJunction, handleRedoJunction, handleCreateJunction, handleSaveJunction,
    canUndoJunction: junctionHistory.length > 0, canRedoJunction: junctionFuture.length > 0,
    handleCancelJunction: () => {
      if (junctionPendingRoad) { setRoadDraft(junctionPendingRoad.draft); setEditingRoadId(junctionPendingRoad.editingRoadId); setRoadDraftDirty(junctionPendingRoad.dirty); }
      setJunctionDraft(null); setSelectedRoadArea(null); setJunctionPendingRoad(null);
    },
  };
}
export type RoadEditorState = ReturnType<typeof useRoadEditor>;

function shortEndpointName(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return endpoint;
  }
}
