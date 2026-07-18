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
  createManualRoadDraft,
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  insertRoadIntoCityJson,
  parseOsmPointFeaturesFromXml,
  parseOsmRoadsFromXml,
  splitRoadSectionAtFraction,
  summarizeRoadDraft,
  synchronizeRoadConnectionMetadata,
  roadDraftPreservesExactGeometry,
  updateExactRoadAttributesInCityJson,
} from '../lib/transportation';
import { processOsmXml } from '../lib/osm2streets';
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import { insertOsm2StreetsRoadIntoCityJson } from '../lib/osm2streets-cityjson';
import { buildRoadDraftFromOsm2StreetsSelection } from '../lib/osm2streets-draft';
import { connectedRoadIdsForIntersection } from '../lib/osm2streets-selection';
import { activeMetricCrsForCityJson } from '../lib/projection';
import { limitRoadQueryBbox, type Wgs84Bbox } from '../lib/road-query';
import { extractFootprints } from '../lib/footprints';
import { runStructurallyGuardedMutation } from '../lib/editor-actions';
import { validateRoadFit, type RoadFitConflict } from '../lib/road-fit';
import type { ParcelZone } from '../lib/zoning';
import { compactVertices } from '../lib/compact';

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
const EMPTY_PARCEL_ZONES: ParcelZone[] = [];

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
  options: { zones?: ParcelZone[] } = {}
) {
  const affectedZones = options.zones?.length ? options.zones : EMPTY_PARCEL_ZONES;
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
  const [basemap, setBasemap] = useState<'map' | 'satellite'>('map');
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.82);
  const [roadOverlayOpacity, setRoadOverlayOpacity] = useState(0.92);
  const [osmRoads, setOsmRoads] = useState<OsmRoadFeature[]>([]);
  const [osmPointFeatures, setOsmPointFeatures] = useState<OsmPointFeature[]>([]);
  const [selectedOsmRoadId, setSelectedOsmRoadId] = useState<string | null>(null);
  const [roadDraft, setRoadDraft] = useState<RoadDraft | null>(null);
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
  }, [setDrawMode, setSelection]);

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
  }, []);

  const handleOsm2StreetsSelect = useCallback((selection: Osm2StreetsSelection) => {
    setShowRoadEditor(true);
    setOsm2streetsSelection(selection);
    setHighlightedOsm2StreetsRoadIds(new Set());
    if (!selection) return;
    if (selection.kind === 'lane') {
      const props = selection.feature.properties ?? {};
      setRoadStatus(
        `Selected osm2streets lane ${props.index ?? '?'} on road ${props.road ?? '?'}. Tap Edit road to store its exact surfaces in CityJSON and change it.`
      );
    } else {
      const props = selection.feature.properties ?? {};
      setRoadStatus(
        `Selected osm2streets intersection ${props.id ?? '?'} (${props.intersection_kind ?? props.kind ?? 'unknown'}).`
      );
    }
  }, []);

  const handleHighlightConnectedOsm2StreetsRoads = useCallback(() => {
    const connected = connectedRoadIdsForIntersection(osm2streetsSelection, osm2streetsResult);
    setHighlightedOsm2StreetsRoadIds(connected);
    if (connected.size === 0) {
      setRoadStatus('No connected osm2streets road polygons were found for this intersection.');
      return;
    }
    setRoadStatus(
      `Highlighted ${connected.size} osm2streets road polygon${connected.size === 1 ? '' : 's'} connected to the selected intersection.`
    );
  }, [osm2streetsResult, osm2streetsSelection]);

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
  }, [osm2streetsResult, osm2streetsSelection, osmRoads]);

  const handleStartRoadDraw = useCallback(() => {
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
      setRoadDraft((current) => {
        if (!current) {
          return createManualRoadDraft(lineWgs84);
        }
        const fallback = createManualRoadDraft(lineWgs84).sections[0];
        const first = current.sections[0] ?? fallback;
        return {
          ...current,
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
        };
      });
      setRoadDraftDirty(true);
      setRoadStatus('Manual road centerline updated. Check bands and speed, then insert.');
    },
    [setDrawMode]
  );

  const handleRoadDraftChange = useCallback((draft: RoadDraft) => {
    setRoadDraft(draft);
    setRoadDraftDirty(true);
    setLastInsertedRoadId(null);
  }, []);

  const handleEditSelectedRoadArea = useCallback((area: RoadArea) => {
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
      id: draft.id ?? area.roadId,
    };
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
  }, [cityjson]);

  const handleCancelRoadEdit = useCallback(() => {
    if (roadDraftDirty && !window.confirm('Discard the unsaved road-edit draft?')) return;
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
  }, [roadDraftDirty, setDrawMode, setSelection]);

  const handleSplitRoadDraft = useCallback((sectionId: string, fraction: number) => {
    setRoadDraftDirty(true);
    setRoadDraft((current) => {
      if (!current) return current;
      try {
        const next = splitRoadSectionAtFraction(current, sectionId, fraction);
        setRoadStatus(`Split ${sectionId} at ${(fraction * 100).toFixed(0)}%.`);
        return next;
      } catch (error) {
        alert(`Road split failed: ${error instanceof Error ? error.message : String(error)}`);
        return current;
      }
    });
  }, []);

  const buildingFootprints = useMemo(
    () => (cityjson ? extractFootprints(cityjson) : []),
    [cityjson, reloadToken]
  );
  const roadAreas = useMemo(() => {
    if (!cityjson) return [];
    return extractTransportationAreas(cityjson);
  }, [cityjson, reloadToken]);
  const [roadPreviewAreas, setRoadPreviewAreas] = useState<RoadArea[]>([]);
  const [roadFitConflicts, setRoadFitConflicts] = useState<RoadFitConflict[]>([]);
  const [roadFitPending, setRoadFitPending] = useState(false);
  const lastPreviewAtRef = useRef(0);

  // Geometry preview is capped at roughly 20 fps during a drag. The previous
  // path cloned the entire CityJSON document and reran fit validation for every
  // pointer event, which made handles feel detached on city-scale datasets.
  useEffect(() => {
    const shouldHide =
      !cityjson ||
      !roadDraft ||
      (!roadDraftDirty && !!(osm2streetsResult || selectedRoadArea || lastInsertedRoadId));
    if (shouldHide) {
      setRoadPreviewAreas([]);
      setRoadFitConflicts([]);
      setRoadFitPending(false);
      return;
    }
    const elapsed = performance.now() - lastPreviewAtRef.current;
    const delay = Math.max(0, 50 - elapsed);
    const timer = window.setTimeout(() => {
      try {
        setRoadPreviewAreas(
          exactGeometryStatus === 'preserved' && editingRoadId
            ? buildExactRoadAttributePreviewAreas(roadAreas, editingRoadId, roadDraft!)
            : buildRoadPreviewAreas(cityjson!, roadDraft!, { id: '__road_preview__' })
        );
      } catch {
        setRoadPreviewAreas([]);
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

  // Clearance/overlap checks intentionally trail the visual curve slightly;
  // they settle after the user's latest movement instead of blocking it.
  useEffect(() => {
    if (
      !cityjson ||
      roadPreviewAreas.length === 0 ||
      exactGeometryStatus === 'preserved'
    ) {
      setRoadFitConflicts([]);
      setRoadFitPending(false);
      return;
    }
    setRoadFitPending(true);
    const timer = window.setTimeout(() => {
      setRoadFitConflicts(
        validateRoadFit({
          roadAreas: roadPreviewAreas,
          buildingFootprints,
          affectedLand: affectedZones,
          metricCrs: activeMetricCrsForCityJson(cityjson),
          buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
          buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
        })
      );
      setRoadFitPending(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [
    cityjson,
    roadPreviewAreas,
    buildingFootprints,
    affectedZones,
    exactGeometryStatus,
  ]);

  const handleInsertRoad = useCallback(() => {
    if (!cityjson || !roadDraft) return;
    const targetRoadId = editingRoadId;
    const preserveExactGeometry =
      exactGeometryStatus === 'preserved' && targetRoadId !== null;
    // Recheck synchronously at commit so the edit-time debounce can never
    // allow a stale clear result to bypass the insertion gate.
    const commitPreview = preserveExactGeometry
      ? buildExactRoadAttributePreviewAreas(roadAreas, targetRoadId!, roadDraft)
      : buildRoadPreviewAreas(cityjson, roadDraft, {
          id: targetRoadId ?? '__road_preview__',
        });
    // Existing exact polygons are not moved by an attribute-only edit, so a
    // pre-existing fit issue must not suddenly block changing their semantics.
    const commitConflicts = preserveExactGeometry
      ? []
      : validateRoadFit({
          roadAreas: commitPreview,
          buildingFootprints,
          affectedLand: affectedZones,
          metricCrs: activeMetricCrsForCityJson(cityjson),
          buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
          buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
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
            ? updateExactRoadAttributesInCityJson(cityjson, targetRoadId!, roadDraft)
            : insertRoadIntoCityJson(
                cityjson,
                roadDraft,
                targetRoadId ? { id: targetRoadId } : undefined
              );
          const connectedRoadIds = synchronizeRoadConnectionMetadata(
            cityjson,
            inserted.id,
            roadDraft
          );
          if (targetRoadId && !preserveExactGeometry) compactVertices(cityjson);
          return { ...inserted, connectedRoadIds };
        }
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(result.id);
        for (const connectedRoadId of result.connectedRoadIds) next.add(connectedRoadId);
        return next;
      });
      setSelection(null);
      setSelectedRoadArea(null);
      setLastInsertedRoadId(result.id);
      setEditingRoadId(result.id);
      setRoadDraftDirty(false);
      setRoadEditBaseline(
        preserveExactGeometry
          ? {
              roadId: result.id,
              draft: cloneRoadDraft(roadDraft),
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
    editingRoadId,
    exactGeometryStatus,
    roadAreas,
    buildingFootprints,
    affectedZones,
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
    pushUndo,
    setDirtyIds,
    setSelection,
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
    roadDraftDirty,
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
    clearOsmRoadData,
    handleFetchOsmRoads,
    loadOsmRoadXml,
    handleOsmRoadSelect,
    handleOsm2StreetsSelect,
    handleHighlightConnectedOsm2StreetsRoads,
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
    handleExportRoadPayload,
    handlePostRoadPayload,
    roadAreas,
    roadPreviewAreas,
    roadFitConflicts,
    roadFitPending,
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
