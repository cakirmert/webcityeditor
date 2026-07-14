import { useState, useCallback, useMemo } from 'react';
import type { OsmRoadFeature, RoadArea, RoadDraft } from '../lib/transportation';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import {
  buildOverpassRoadQuery,
  buildRoadEditPayload,
  createManualRoadDraft,
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  insertRoadIntoCityJson,
  parseOsmRoadsFromXml,
  splitRoadSectionAtFraction,
  summarizeRoadDraft,
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
  const [osmRoads, setOsmRoads] = useState<OsmRoadFeature[]>([]);
  const [selectedOsmRoadId, setSelectedOsmRoadId] = useState<string | null>(null);
  const [roadDraft, setRoadDraft] = useState<RoadDraft | null>(null);
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
      const roads = parseOsmRoadsFromXml(xmlText);
      setOsmRoads(roads);

      setRoadStatus('Computing detailed lane-level 2D visualization (osm2streets)...');
      try {
        const result = await processOsmXml(xmlText, queryBbox);
        setOsm2streetsResult(result);
        setOsm2streetsBbox(queryBbox);
        const warningCount = result.diagnostics.filter((diagnostic) => diagnostic.level === 'warn').length;
        const errorCount = result.diagnostics.filter((diagnostic) => diagnostic.level === 'error').length;
        const diagnosticSuffix =
          warningCount > 0 || errorCount > 0
            ? ` osm2streets reported ${warningCount} warning${warningCount === 1 ? '' : 's'} and ${errorCount} error${errorCount === 1 ? '' : 's'}; first diagnostic: ${result.diagnostics[0]?.message ?? 'none'}.`
            : '';
        setRoadStatus(
          roads.length > 0
            ? `Loaded ${roads.length} OSM road segment${roads.length === 1 ? '' : 's'} from ${shortEndpointName(endpoint)} and computed 2D lane layout with osm2streets.${diagnosticSuffix} Click a road on the map to edit.`
            : 'No OSM roads returned for this viewport.'
        );
      } catch (wasmError) {
        console.error('osm2streets Wasm generation failed:', wasmError);
        setRoadStatus(
          `Loaded ${roads.length} roads, but detailed visualization failed: ${wasmError instanceof Error ? wasmError.message : String(wasmError)}`
        );
      }
    } catch (error) {
      console.error(error);
      setRoadStatus(
        `OSM road fetch failed from public Overpass services. Zoom in or pan to a smaller area, then try again. You can still use Draw / redraw road. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [cityjson, coreState.mapBboxRef]);

  const handleOsmRoadSelect = useCallback((road: OsmRoadFeature) => {
    setShowRoadEditor(true);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setSelectedOsmRoadId(road.id);
    setSelectedRoadArea(null);
    setEditingRoadId(null);
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
        `Selected osm2streets lane ${props.index ?? '?'} on road ${props.road ?? '?'}. Inspect it or create an editable draft.`
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
    setRoadDraft({
      ...draft,
      id: draft.id ?? area.roadId,
    });
    setRoadDraftDirty(false);
    setSelectedRoadArea(area);
    setEditingRoadId(area.roadId);
    setLastInsertedRoadId(area.roadId);
    setOsm2streetsSelection(null);
    setHighlightedOsm2StreetsRoadIds(new Set());
    setSelectedOsmRoadId(null);
    setRoadStatus(
      savedDraft
        ? `Loaded editable layout from ${area.roadId}. Changes stay in the draft until you save them.`
        : `Derived an editable layout from ${area.roadId}'s CityJSON surfaces. The exact polygons stay unchanged until you save; saving rebuilds them from the editable centerline and bands.`
    );
  }, [cityjson]);

  const handleCancelRoadEdit = useCallback(() => {
    if (roadDraftDirty && !window.confirm('Discard the unsaved road-edit draft?')) return;
    setDrawMode('none');
    setSelection(null);
    setRoadDraft(null);
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

  const roadPreviewAreas = useMemo(() => {
    if (!cityjson || !roadDraft) return [];
    if (!roadDraftDirty && (osm2streetsResult || selectedRoadArea || lastInsertedRoadId)) return [];
    try {
      const previewDoc = JSON.parse(JSON.stringify(cityjson)) as any;
      return insertRoadIntoCityJson(previewDoc, roadDraft, { id: '__road_preview__' }).areas;
    } catch {
      return [];
    }
  }, [
    cityjson,
    roadDraft,
    roadDraftDirty,
    osm2streetsResult,
    selectedRoadArea,
    lastInsertedRoadId,
    reloadToken,
  ]);

  const roadFitConflicts = useMemo<RoadFitConflict[]>(() => {
    if (!cityjson || roadPreviewAreas.length === 0) return [];
    return validateRoadFit({
      roadAreas: roadPreviewAreas,
      buildingFootprints: extractFootprints(cityjson),
      affectedLand: options.zones ?? [],
      metricCrs: activeMetricCrsForCityJson(cityjson),
      buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
      buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
    });
  }, [cityjson, roadPreviewAreas, options.zones]);

  const handleInsertRoad = useCallback(() => {
    if (!cityjson || !roadDraft) return;
    const blockingConflicts = roadFitConflicts.filter((conflict) => conflict.severity === 'error');
    if (blockingConflicts.length > 0) {
      alert(
        `Road insertion is blocked by ${blockingConflicts.length} fit conflict${
          blockingConflicts.length === 1 ? '' : 's'
        }:\n\n${blockingConflicts.slice(0, 5).map((conflict) => conflict.label).join('\n')}`
      );
      return;
    }
    try {
      const targetRoadId = editingRoadId;
      pushUndo(targetRoadId ? 'Update CityJSON road' : 'Insert CityJSON road');
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        targetRoadId ? 'Updating CityJSON road' : 'Inserting CityJSON road',
        () => {
          const inserted = insertRoadIntoCityJson(
            cityjson,
            roadDraft,
            targetRoadId ? { id: targetRoadId } : undefined
          );
          if (targetRoadId) compactVertices(cityjson);
          return inserted;
        }
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(result.id);
        return next;
      });
      setSelection({ objectId: result.id });
      setSelectedRoadArea(null);
      setLastInsertedRoadId(result.id);
      setEditingRoadId(result.id);
      setRoadDraftDirty(false);
      setReloadToken((t) => t + 1);
      markGeometryChanged('Road geometry changed; run Check 3D before export.');
      setRoadStatus(
        targetRoadId
          ? `Saved changes to ${result.id} with ${result.areas.length} transportation surfaces.`
          : `Inserted ${result.id} with ${result.areas.length} transportation surfaces.`
      );
    } catch (error) {
      console.error(error);
      alert(`Road insertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [
    cityjson,
    roadDraft,
    editingRoadId,
    roadFitConflicts,
    pushUndo,
    setDirtyIds,
    setSelection,
    setReloadToken,
    markGeometryChanged,
  ]);

  const handleInsertOsm2StreetsSelection = useCallback(() => {
    if (!cityjson || !osm2streetsResult || !osm2streetsSelection) return;
    try {
      const previewDoc = JSON.parse(JSON.stringify(cityjson)) as typeof cityjson;
      const preview = insertOsm2StreetsRoadIntoCityJson(
        previewDoc,
        osm2streetsSelection,
        osm2streetsResult,
        osmRoads
      );
      const conflicts = validateRoadFit({
        roadAreas: preview.areas,
        buildingFootprints: extractFootprints(cityjson),
        affectedLand: options.zones ?? [],
        metricCrs: activeMetricCrsForCityJson(cityjson),
        buildingClearanceBlockM: ROAD_BUILDING_CLEARANCE_BLOCK_METERS,
        buildingClearanceWarningM: ROAD_BUILDING_CLEARANCE_WARNING_METERS,
      });
      const blockingConflicts = conflicts.filter((conflict) => conflict.severity === 'error');
      if (blockingConflicts.length > 0) {
        alert(
          `osm2streets road insertion is blocked by ${blockingConflicts.length} fit conflict${
            blockingConflicts.length === 1 ? '' : 's'
          }:\n\n${blockingConflicts.slice(0, 5).map((conflict) => conflict.label).join('\n')}`
        );
        return;
      }

      pushUndo('Insert osm2streets CityJSON road');
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        'Inserting osm2streets CityJSON road',
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
      setSelection({ objectId: result.id });
      setSelectedRoadArea(null);
      setLastInsertedRoadId(result.id);
      setReloadToken((t) => t + 1);
      markGeometryChanged('Road geometry changed; run Check 3D before export.');
      setRoadStatus(
        `Inserted ${result.id} from exact osm2streets polygons with ${result.areas.length} transportation surfaces.`
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
    options.zones,
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

  const roadAreas = useMemo(() => {
    if (!cityjson) return [];
    return extractTransportationAreas(cityjson);
  }, [cityjson, reloadToken]);

  return {
    showRoadEditor,
    setShowRoadEditor,
    basemap,
    setBasemap,
    osmRoads,
    setOsmRoads,
    selectedOsmRoadId,
    setSelectedOsmRoadId,
    roadDraft,
    setRoadDraft,
    roadDraftDirty,
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
    handleFetchOsmRoads,
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
