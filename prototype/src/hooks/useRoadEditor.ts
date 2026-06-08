import { useState, useCallback, useMemo } from 'react';
import type { OsmRoadFeature, RoadArea, RoadDraft } from '../lib/transportation';
import type { CoreState } from './useCoreState';
import type { UndoRedoState } from './useUndoRedo';
import {
  buildOverpassRoadQuery,
  buildRoadEditPayload,
  createManualRoadDraft,
  extractTransportationAreas,
  insertRoadIntoCityJson,
  parseOsmRoadsFromXml,
  splitRoadSectionAtFraction,
  summarizeRoadDraft,
} from '../lib/transportation';
import { processOsmXml } from '../lib/osm2streets';
import { extractFootprints } from '../lib/footprints';
import { runStructurallyGuardedMutation } from '../lib/editor-actions';

function computeFootprintBbox(
  footprints: { polygon: [number, number, number][] }[]
): [number, number, number, number] | null {
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
  bbox: [number, number, number, number],
  ratio = 0.15,
  minPad = 0.002
): [number, number, number, number] {
  const [west, south, east, north] = bbox;
  const lngPad = Math.max((east - west) * ratio, minPad);
  const latPad = Math.max((north - south) * ratio, minPad);
  return [west - lngPad, south - latPad, east + lngPad, north + latPad];
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

export function useRoadEditor(coreState: CoreState, undoRedo: UndoRedoState) {
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
  const [roadStatus, setRoadStatus] = useState<string | null>(null);
  const [selectedRoadArea, setSelectedRoadArea] = useState<RoadArea | null>(null);
  const [lastInsertedRoadId, setLastInsertedRoadId] = useState<string | null>(null);
  const [roadBackendUrl, setRoadBackendUrl] = useState('http://127.0.0.1:8787/api/roads');
  const [finishRoadDrawToken, setFinishRoadDrawToken] = useState(0);
  const [osm2streetsResult, setOsm2streetsResult] = useState<import('../lib/osm2streets').Osm2StreetsResult | null>(null);
  const [osm2streetsBbox, setOsm2streetsBbox] = useState<[number, number, number, number] | null>(null);

  const handleFetchOsmRoads = useCallback(async () => {
    if (!cityjson) return;
    const viewportBbox = coreState.mapBboxRef.current;
    const footprintBbox = computeFootprintBbox(extractFootprints(cityjson));
    const bbox = viewportBbox ?? footprintBbox;
    if (!bbox) {
      alert('Could not derive a map bbox for the OSM road query.');
      return;
    }
    const queryBbox = expandBbox(bbox, 0.15);
    setRoadStatus('Fetching OSM XML data for the current viewport...');
    try {
      const body = new URLSearchParams({ data: buildOverpassRoadQuery(queryBbox, 'xml') });
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (!response.ok) {
        throw new Error(`Overpass HTTP ${response.status} ${response.statusText}`);
      }
      const xmlText = await response.text();
      const roads = parseOsmRoadsFromXml(xmlText);
      setOsmRoads(roads);
      setShowRoadEditor(true);

      setRoadStatus('Computing detailed lane-level 2D visualization (osm2streets)...');
      try {
        const result = await processOsmXml(xmlText, queryBbox);
        setOsm2streetsResult(result);
        setOsm2streetsBbox(queryBbox);
        setRoadStatus(
          roads.length > 0
            ? `Loaded ${roads.length} OSM road segment${roads.length === 1 ? '' : 's'} and computed 2D lane layout. Click a road on the map to edit.`
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
      setRoadStatus(error instanceof Error ? error.message : String(error));
      alert(`OSM road fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [cityjson, coreState.mapBboxRef]);

  const handleOsmRoadSelect = useCallback((road: OsmRoadFeature) => {
    setShowRoadEditor(true);
    setSelectedOsmRoadId(road.id);
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
      setRoadStatus('OSM interpretation accepted. Edit widths/speed if needed, then insert.');
      return;
    }
    setRoadDraft({ ...inferred, userVerified: false });
    setRoadStatus('OSM kept as a seed. Use Draw / redraw road and edit lanes before inserting.');
  }, []);

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
      setRoadStatus('Manual road centerline updated. Check bands and speed, then insert.');
    },
    [setDrawMode]
  );

  const handleRoadDraftChange = useCallback((draft: RoadDraft) => {
    setRoadDraft(draft);
    setLastInsertedRoadId(null);
  }, []);

  const handleSplitRoadDraft = useCallback((sectionId: string, fraction: number) => {
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

  const handleInsertRoad = useCallback(() => {
    if (!cityjson || !roadDraft) return;
    try {
      pushUndo('Insert CityJSON road');
      const { value: result } = runStructurallyGuardedMutation(
        cityjson,
        'Inserting CityJSON road',
        () => insertRoadIntoCityJson(cityjson, roadDraft)
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
      setRoadStatus(`Inserted ${result.id} with ${result.areas.length} transportation surfaces.`);
    } catch (error) {
      console.error(error);
      alert(`Road insertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [cityjson, roadDraft, pushUndo, setDirtyIds, setSelection, setReloadToken, markGeometryChanged]);

  const handleExportRoadPayload = useCallback(() => {
    if (!roadDraft) return;
    downloadJson(
      buildRoadEditPayload(roadDraft, lastInsertedRoadId ?? undefined),
      `${lastInsertedRoadId ?? roadDraft.id ?? 'road-edit'}.payload.json`
    );
  }, [roadDraft, lastInsertedRoadId]);

  const handlePostRoadPayload = useCallback(async () => {
    if (!roadDraft) return;
    try {
      const response = await fetch(roadBackendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRoadEditPayload(roadDraft, lastInsertedRoadId ?? undefined)),
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
  }, [roadDraft, roadBackendUrl, lastInsertedRoadId]);

  const roadAreas = useMemo(() => {
    if (!cityjson) return [];
    return extractTransportationAreas(cityjson);
  }, [cityjson, reloadToken]);

  const roadPreviewAreas = useMemo(() => {
    if (!cityjson || !roadDraft) return [];
    try {
      const previewDoc = JSON.parse(JSON.stringify(cityjson)) as any;
      return insertRoadIntoCityJson(previewDoc, roadDraft, { id: '__road_preview__' }).areas;
    } catch {
      return [];
    }
  }, [cityjson, roadDraft, reloadToken]);

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
    handleFetchOsmRoads,
    handleOsmRoadSelect,
    handleStartRoadDraw,
    handleRoadLineDrawn,
    handleRoadDraftChange,
    handleSplitRoadDraft,
    handleInsertRoad,
    handleExportRoadPayload,
    handlePostRoadPayload,
    roadAreas,
    roadPreviewAreas,
  };
}
export type RoadEditorState = ReturnType<typeof useRoadEditor>;
