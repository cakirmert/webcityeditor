import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import {
  GeoJsonLayer,
  PathLayer,
  PolygonLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
} from '@deck.gl/layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { COORDINATE_SYSTEM, type PickingInfo } from '@deck.gl/core';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import proj4 from 'proj4';
import type { CityJsonDocument, SelectionInfo } from '../types';
import { applyVertexTransform, detectCrs, projectToWgs84 } from '../lib/projection';
import { extractFootprints, type Footprint } from '../lib/footprints';
import { tintByRoofType, tintByUsage } from '../lib/footprint-tint';
import { findNearestZoneForPoint, findZoneForPoint, type ParcelZone } from '../lib/zoning';
import type {
  OsmPointFeature,
  OsmRoadFeature,
  RoadArea,
  RoadDraft,
} from '../lib/transportation';
import type { RoadFitConflict } from '../lib/road-fit';
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import {
  osm2streetsIntersectionFillColor,
  osm2streetsIntersectionMarkingFillColor,
  osm2streetsLaneFillColor,
  osm2streetsLaneMarkingFillColor,
  roadBandFillColor,
  roadOverlayColor,
  withAlpha,
  type Rgba,
} from '../lib/osm2streets-style';
import {
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  insertRoadDraftPoint,
  updateRoadDraftPoint,
  type RoadDraftHandle,
  type RoadDraftPath,
} from '../lib/road-draft-edit';

/**
 * Zoom-based LoD thresholds (chosen empirically for OSM raster tiles + city-scale data):
 *  - <= LOD_OUTLINE_MAX: LoD0 — just footprint outlines on the ground. Cheap.
 *  - LOD_OUTLINE_MAX < z <= LOD_EXTRUDE_MAX: LoD1-ish — extruded flat-roof blocks.
 *  - > LOD_EXTRUDE_MAX: highest LoD — selected building gets full LoD2 in the side-panel Three.js viewer.
 * Transitioning between modes is just adjusting deck.gl layers' visibility / extrusion
 * (no additional data is loaded — the CityJSON already carries LoD2 geometry in memory).
 */
const LOD_OUTLINE_MAX = 14.5;
const LOD_EXTRUDE_MAX = 99; // always extrude at z > 14.5 for now
const DATA_FIT_PADDING = 56;
const DATA_FIT_MAX_ZOOM = 14.25;
const ROAD_DATA_FIT_MAX_ZOOM = 18;
const OSM_ROAD_HIT_WIDTH_PIXELS = 20;
const DEFAULT_INITIAL_ZOOM = 12;

function osmPointFeatureColor(feature: OsmPointFeature): Rgba {
  switch (feature.kind) {
    case 'tree':
      return [40, 150, 76, 235];
    case 'traffic_sign':
      return [52, 125, 235, 245];
    case 'traffic_signals':
      return [224, 62, 62, 245];
    case 'street_lamp':
      return [245, 190, 55, 245];
    case 'bollard':
      return [110, 116, 128, 245];
  }
}

function roadAreaKind(area: RoadArea): string {
  const usage = area.attributes.transportationUsage;
  return typeof usage === 'string' ? usage : area.function;
}

function roadAreaSourceType(area: RoadArea): string | undefined {
  const sourceType = area.attributes.sourceType;
  return typeof sourceType === 'string' ? sourceType : undefined;
}

function roadAreaFillColor(
  area: RoadArea,
  basemap: 'map' | 'satellite',
  preview = false
): Rgba {
  const base = roadBandFillColor(roadAreaKind(area), roadAreaSourceType(area));
  return roadOverlayColor(preview ? withAlpha(base, Math.min(base[3], 218)) : base, {
    basemap,
    underground: area.vertical?.placement === 'underground',
  });
}

function roadAreaLineColor(
  area: RoadArea,
  basemap: 'map' | 'satellite',
  selected = false,
  preview = false
): Rgba {
  const color: Rgba = selected
    ? [255, 224, 130, 255]
    : preview
      ? [245, 248, 255, 185]
      : roadAreaKind(area) === 'green' ||
          roadAreaKind(area) === 'green_verge' ||
          roadAreaKind(area) === 'verge'
        ? [116, 190, 142, 165]
        : [238, 242, 255, 130];
  return roadOverlayColor(color, {
    basemap,
    underground: area.vertical?.placement === 'underground',
  });
}

function osm2streetsFeatureIsUnderground(feature: any): boolean {
  const props = feature?.properties ?? {};
  const layer = typeof props.layer === 'number' ? props.layer : Number(props.layer);
  return (Number.isFinite(layer) && layer < 0) || props.tunnel === true || props.tunnel === 'yes';
}

function osm2streetsDisplayColor(
  color: Rgba,
  feature: any,
  basemap: 'map' | 'satellite'
): Rgba {
  return roadOverlayColor(color, {
    basemap,
    underground: osm2streetsFeatureIsUnderground(feature),
  });
}

function osm2streetsSelectionLineColor(
  feature: any,
  selection: Osm2StreetsSelection,
  kind: 'lane' | 'intersection',
  highlighted = false
): Rgba {
  if (isSelectedOsm2StreetsFeature(feature, selection, kind)) return [255, 224, 130, 255];
  if (highlighted) return [255, 210, 92, 245];
  return [0, 0, 0, 0];
}

function osm2streetsSelectionLineWidth(
  feature: any,
  selection: Osm2StreetsSelection,
  kind: 'lane' | 'intersection',
  highlighted = false
): number {
  return isSelectedOsm2StreetsFeature(feature, selection, kind) || highlighted ? 2 : 0;
}

function isSelectedOsm2StreetsFeature(
  feature: any,
  selection: Osm2StreetsSelection,
  kind: 'lane' | 'intersection'
): boolean {
  if (!selection || selection.kind !== kind) return false;
  const props = feature?.properties ?? {};
  const selected = selection.feature.properties ?? {};
  if (kind === 'lane') {
    return props.road !== undefined && selected.road !== undefined
      ? props.road === selected.road && props.index === selected.index
      : feature === selection.feature;
  }
  return props.id !== undefined && selected.id !== undefined
    ? props.id === selected.id
    : feature === selection.feature;
}

interface Props {
  cityjson: CityJsonDocument;
  selectedId: string | null;
  onSelect: (info: SelectionInfo | null) => void;
  /** Bump to force layer rebuild with current in-memory edits */
  reloadToken: number;
  /** Terra Draw mode for buildings or road centerlines. */
  drawMode: 'none' | 'polygon' | 'road-line';
  /** Called once the user double-clicks to finish a polygon, with outer ring in WGS84. */
  onFootprintDrawn: (ringWgs84: [number, number][]) => void;
  /** Called when the user finishes a road centerline, with points in WGS84. */
  onRoadLineDrawn?: (lineWgs84: [number, number][]) => void;
  /** Incremented by the parent when the road panel's Finish button is clicked. */
  finishRoadDrawToken?: number;
  /** Called if the user cancels drawing (e.g. ESC). */
  onDrawCanceled?: () => void;
  /**
   * Live preview for the new-building dialog or a pending transform.
   * - `polygon` + `height` renders a ghost extrusion (SolidPolygonLayer).
   * - `mesh` renders an actual triangulated building (SimpleMeshLayer),
   *   which faithfully shows the selected roof type while the user edits the dialog.
   *   If `mesh` is set, it takes priority over the polygon variant.
   */
  preview?: {
    polygon?: [number, number][];
    height?: number;
    mesh?: {
      positions: Float32Array;
      indices: Uint32Array;
      colors: Uint8Array;
      anchorLngLat: [number, number];
    };
  } | null;
  /**
   * When set, the map enters footprint-edit mode for the named building.
   * The building's outer footprint loads as a single editable Terra Draw
   * polygon with draggable vertices and midpoints. Each drag fires
   * `onFootprintChange` with the latest ring; the parent decides when to
   * commit the change (typically via Save/Cancel buttons in the side panel).
   */
  footprintEdit?: {
    buildingId: string;
    footprintWgs84: [number, number][];
  } | null;
  onFootprintChange?: (newRingWgs84: [number, number][]) => void;
  /**
   * When non-null, only buildings whose CityObject id is in this Set are
   * rendered at full opacity — the rest dim to ~25% so the user can pick
   * them out at a glance. `null` = no filter active, every building at
   * full opacity (the default before FilterBar landed).
   */
  filteredIds?: Set<string> | null;
  /**
   * When set, the next map click reports its lng/lat via this callback and
   * is "consumed" — it doesn't trigger building selection. Used by IFC
   * import to let the user drop the imported building wherever they like.
   */
  onPlacementClick?: (lngLat: [number, number]) => void;
  /** Called on map moveend with the current WGS84 viewport [w, s, e, n]. The
   *  parent uses this to feed the bbox to viewport-filtered re-parsing. */
  onViewportChange?: (bbox: [number, number, number, number]) => void;
  /** When set, drag on the map moves the building. Fires onDragMove with
   *  CRS-metre deltas accumulated from the drag start position. */
  dragTransformId?: string | null;
  onDragMove?: (dx: number, dy: number) => void;
  /** Multi-selection: set of building IDs highlighted in addition to selectedId. */
  multiSelectedIds?: Set<string> | null;
  /** Planning overlay polygons. */
  zones?: ParcelZone[];
  /** Called when a planning polygon is clicked. */
  onZoneSelect?: (zone: ParcelZone) => void;
  basemap?: 'map' | 'satellite';
  roadAreas?: RoadArea[];
  roadPreviewAreas?: RoadArea[];
  roadFitConflicts?: RoadFitConflict[];
  selectedRoadAreaId?: string | null;
  onRoadAreaSelect?: (area: RoadArea) => void;
  roadDraft?: RoadDraft | null;
  onRoadDraftChange?: (draft: RoadDraft) => void;
  osmRoads?: OsmRoadFeature[];
  osmPointFeatures?: OsmPointFeature[];
  selectedOsmRoadId?: string | null;
  onOsmRoadSelect?: (road: OsmRoadFeature) => void;
  osm2streetsResult?: import('../lib/osm2streets').Osm2StreetsResult | null;
  osm2streetsBbox?: [number, number, number, number] | null;
  osm2streetsSelection?: Osm2StreetsSelection;
  highlightedOsm2StreetsRoadIds?: Set<number | string>;
  onOsm2StreetsSelect?: (selection: Osm2StreetsSelection) => void;
  initialView?: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
    disableDataFit?: boolean;
  };
  precomputedFootprints?: Footprint[];
}

/**
 * MapLibre basemap + deck.gl extruded-building layer.
 *
 * Per the project plan:
 *   - MapLibre = basemap tiles (OSM for prototype; vector tiles later).
 *   - deck.gl  = every building rendered as an extruded footprint (context view).
 *               A proper production build would use Tile3DLayer with
 *               pg2b3dm-generated 3D Tiles from 3DCityDB; the prototype
 *               extrudes footprints directly from CityJSON instead, so the
 *               same visual pattern works without a backend.
 *   - Three.js = NOT here. The selected building gets a separate Three.js
 *               editor view in the side panel.
 *
 * Picking: deck.gl's onClick returns the CityObject id, which flows up to App
 * as the current selection. The selected building is re-rendered in a
 * highlight color so the user can see what they're editing.
 */
export default function MapView({
  cityjson,
  selectedId,
  onSelect,
  reloadToken,
  drawMode,
  onFootprintDrawn,
  onRoadLineDrawn,
  finishRoadDrawToken = 0,
  onDrawCanceled,
  preview,
  footprintEdit,
  onFootprintChange,
  filteredIds = null,
  onPlacementClick,
  onViewportChange,
  dragTransformId = null,
  onDragMove,
  multiSelectedIds = null,
  zones = [],
  onZoneSelect,
  basemap = 'map',
  roadAreas = [],
  roadPreviewAreas = [],
  roadFitConflicts = [],
  selectedRoadAreaId = null,
  onRoadAreaSelect,
  roadDraft = null,
  onRoadDraftChange,
  osmRoads = [],
  osmPointFeatures = [],
  selectedOsmRoadId = null,
  onOsmRoadSelect,
  osm2streetsResult = null,
  osm2streetsBbox = null,
  osm2streetsSelection = null,
  highlightedOsm2StreetsRoadIds = new Set(),
  onOsm2StreetsSelect,
  initialView,
  precomputedFootprints,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const roadDraftRef = useRef<RoadDraft | null>(roadDraft);
  const roadDraftDragRef = useRef<{
    sectionId: string;
    pointIndex: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    moved: boolean;
  } | null>(null);
  const onRoadDraftChangeRef = useRef(onRoadDraftChange);
  const flownForDocRef = useRef<CityJsonDocument | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(initialView?.zoom ?? DEFAULT_INITIAL_ZOOM);
  const [mapColorMode, setMapColorMode] = useState<'roof' | 'usage'>('roof');

  useEffect(() => {
    roadDraftRef.current = roadDraft;
  }, [roadDraft]);

  useEffect(() => {
    onRoadDraftChangeRef.current = onRoadDraftChange;
  }, [onRoadDraftChange]);

  const finishCurrentRoadDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return false;
    const snapshot = draw.getSnapshot();
    const feature = snapshot.find(
      (f) =>
        f.geometry.type === 'LineString' &&
        Array.isArray(f.geometry.coordinates) &&
        f.geometry.coordinates.length >= 2
    );
    if (!feature || feature.geometry.type !== 'LineString') return false;
    onRoadLineDrawn?.(feature.geometry.coordinates as [number, number][]);
    draw.clear();
    draw.stop();
    drawRef.current = null;
    return true;
  }, [onRoadLineDrawn]);

  const footprints = useMemo(
    () => precomputedFootprints ?? extractFootprints(cityjson),
    // reloadToken is intentionally a dep so "Reload view" after an edit
    // (e.g. changed measuredHeight) rebuilds the deck.gl data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityjson, reloadToken, precomputedFootprints]
  );

  const commitRoadDraft = useCallback((next: RoadDraft) => {
    roadDraftRef.current = next;
    onRoadDraftChangeRef.current?.(next);
  }, []);

  // Detect CRS support and surface a warning if unsupported
  useEffect(() => {
    const crs = detectCrs(cityjson);
    if (!crs.supported) {
      setWarning(
        `Reference system ${crs.code} is not yet supported. Add a proj4 definition ` +
          `in src/lib/projection.ts, or use CityJSON in EPSG:28992 / 25832 / 25833.`
      );
    } else if (footprints.length === 0 && roadAreas.length === 0) {
      setWarning(
        'No buildings with extractable footprints found. Data may lack GroundSurface semantics.'
      );
    } else {
      setWarning(null);
    }
  }, [cityjson, footprints, roadAreas]);

  // Init map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialBbox = initialView
      ? null
      : computeFootprintBounds(footprints) ??
        computeRoadAreaBounds(roadAreas) ??
        computeVertexBounds(cityjson) ??
        computeMetadataBounds(cityjson);
    const initialCenter =
      initialView?.center ??
      boundsCenter(initialBbox) ??
      computeTranslateCentre(cityjson) ??
      [4.3571, 52.0116];

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
            maxzoom: 19,
          },
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles © Esri',
            maxzoom: 19,
          },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
          {
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            layout: { visibility: 'none' },
          },
        ],
      },
      center: initialCenter,
      zoom: initialView?.zoom ?? DEFAULT_INITIAL_ZOOM,
      pitch: initialView?.pitch ?? 0,
      bearing: initialView?.bearing ?? 0,
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    // The prototype uses a raster-only basemap, so keep deck.gl on its own
    // canvas above MapLibre. Interleaving can place the building context
    // behind the raster layer, which makes the editable city look empty.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);

    const zoomHandler = () => setZoom(map.getZoom());
    map.on('zoom', zoomHandler);
    map.on('zoomend', zoomHandler);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.off('zoom', zoomHandler);
      map.off('zoomend', zoomHandler);
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Keep road-handle drags independent from MapLibre's pan gesture. Capture the
  // pointer before MapLibre/deck.gl see it, then retain that pointer until an
  // explicit pointer-up/cancel. This avoids trackpad/browser mousemove events
  // that intermittently report no pressed button and used to drop the handle.
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    const container = map.getContainer();
    let restoreDragPan = false;
    let previousCursor = '';
    let previousTouchAction = '';

    const removeWindowListeners = () => {
      window.removeEventListener('pointermove', onWindowPointerMove, true);
      window.removeEventListener('pointerup', onWindowPointerUp, true);
      window.removeEventListener('pointercancel', onWindowPointerCancel, true);
      window.removeEventListener('blur', onWindowBlur);
    };

    const finishDrag = (pointerId?: number) => {
      const active = roadDraftDragRef.current;
      if (!active || (pointerId !== undefined && active.pointerId !== pointerId)) return;
      roadDraftDragRef.current = null;
      removeWindowListeners();
      if (container.hasPointerCapture?.(active.pointerId)) {
        try {
          container.releasePointerCapture(active.pointerId);
        } catch {
          // Pointer capture can already be gone after browser/window changes.
        }
      }
      container.style.cursor = previousCursor;
      container.style.touchAction = previousTouchAction;
      if (restoreDragPan) map.dragPan.enable();
      restoreDragPan = false;
    };

    const updateFromPointer = (event: PointerEvent) => {
      const active = roadDraftDragRef.current;
      const draft = roadDraftRef.current;
      if (
        !active ||
        active.pointerId !== event.pointerId ||
        !draft ||
        !onRoadDraftChangeRef.current
      ) {
        return;
      }
      const distance = Math.hypot(
        event.clientX - active.startClientX,
        event.clientY - active.startClientY
      );
      if (!active.moved && distance < 2) return;
      active.moved = true;

      const rect = container.getBoundingClientRect();
      const lngLat = map.unproject([
        event.clientX - rect.left + active.grabOffsetX,
        event.clientY - rect.top + active.grabOffsetY,
      ]);
      commitRoadDraft(
        updateRoadDraftPoint(draft, active.sectionId, active.pointIndex, [lngLat.lng, lngLat.lat])
      );
    };

    function blockMapGesture(event: PointerEvent) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function onWindowPointerMove(event: PointerEvent) {
      const active = roadDraftDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      blockMapGesture(event);
      updateFromPointer(event);
    }

    function onWindowPointerUp(event: PointerEvent) {
      const active = roadDraftDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      blockMapGesture(event);
      updateFromPointer(event);
      finishDrag(event.pointerId);
    }

    function onWindowPointerCancel(event: PointerEvent) {
      finishDrag(event.pointerId);
    }

    function onWindowBlur() {
      finishDrag();
    }

    const onPointerDown = (event: PointerEvent) => {
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        roadDraftDragRef.current ||
        drawMode === 'road-line' ||
        !onRoadDraftChangeRef.current
      ) {
        return;
      }
      const draft = roadDraftRef.current;
      if (!draft) return;

      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const picked = overlay.pickObject({
        x: pointerX,
        y: pointerY,
        radius: 18,
        layerIds: ['road-draft-centerline-handles'],
      });
      const handle = picked?.object as RoadDraftHandle | undefined;
      if (!handle) return;

      blockMapGesture(event);
      restoreDragPan = map.dragPan.isEnabled();
      if (restoreDragPan) map.dragPan.disable();
      previousCursor = container.style.cursor;
      previousTouchAction = container.style.touchAction;
      container.style.cursor = 'grabbing';
      container.style.touchAction = 'none';

      const handlePoint = map.project({ lng: handle.position[0], lat: handle.position[1] });

      roadDraftDragRef.current = {
        sectionId: handle.sectionId,
        pointIndex: handle.pointIndex,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        grabOffsetX: handlePoint.x - pointerX,
        grabOffsetY: handlePoint.y - pointerY,
        moved: false,
      };
      if (handle.kind === 'midpoint') {
        commitRoadDraft(
          insertRoadDraftPoint(draft, handle.sectionId, handle.pointIndex, handle.position)
        );
      }

      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        // Window-level listeners still keep the drag alive when capture is unavailable.
      }
      window.addEventListener('pointermove', onWindowPointerMove, true);
      window.addEventListener('pointerup', onWindowPointerUp, true);
      window.addEventListener('pointercancel', onWindowPointerCancel, true);
      window.addEventListener('blur', onWindowBlur);
    };

    const onLostPointerCapture = (event: PointerEvent) => {
      if (roadDraftDragRef.current?.pointerId === event.pointerId) finishDrag(event.pointerId);
    };

    container.addEventListener('pointerdown', onPointerDown, true);
    container.addEventListener('lostpointercapture', onLostPointerCapture);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true);
      container.removeEventListener('lostpointercapture', onLostPointerCapture);
      finishDrag();
      removeWindowListeners();
    };
  }, [commitRoadDraft, drawMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer('osm') || !map.getLayer('satellite')) return;
      map.setLayoutProperty('osm', 'visibility', basemap === 'map' ? 'visible' : 'none');
      map.setLayoutProperty(
        'satellite',
        'visibility',
        basemap === 'satellite' ? 'visible' : 'none'
      );
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [basemap]);

  // Fly to data + rebuild deck.gl layer when data or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    // Fit the camera to the dataset ONLY on first load of a given document
    // (not on every selection or edit). Hamburg catalog startup deliberately
    // uses a city-center overview instead, because a partial local catalog
    // should not pull the first view away from Hamburg centre.
    //
    // IMPORTANT: MapLibre can drop the camera move if we call fitBounds before
    // its style has loaded — the initial center/zoom from the Map constructor
    // settles AFTER our effect runs. We detect that and defer the move until
    // the `load` event fires.
    if (flownForDocRef.current !== cityjson) {
      flownForDocRef.current = cityjson;
      const footprintBbox = computeFootprintBounds(footprints);
      const roadAreaBbox = computeRoadAreaBounds(roadAreas);
      const vertexBbox = computeVertexBounds(cityjson);
      const metaBbox = computeMetadataBounds(cityjson);
      const centre = computeTranslateCentre(cityjson);

      const bbox = footprintBbox ?? roadAreaBbox ?? vertexBbox ?? metaBbox;
      const fitMaxZoom = footprintBbox ? DATA_FIT_MAX_ZOOM : ROAD_DATA_FIT_MAX_ZOOM;
      const doFit = () => {
        if (initialView?.disableDataFit) {
          map.flyTo({
            center: initialView.center,
            zoom: initialView.zoom,
            pitch: initialView.pitch ?? 0,
            bearing: initialView.bearing ?? 0,
            duration: 0,
          });
        } else if (bbox && isFiniteBbox(bbox)) {
          map.fitBounds(bbox, {
            padding: DATA_FIT_PADDING,
            maxZoom: fitMaxZoom,
            pitch: 0,
            bearing: 0,
            duration: 0,
          });
        } else if (centre && Number.isFinite(centre[0]) && Number.isFinite(centre[1])) {
          map.flyTo({
            center: centre,
            zoom: DEFAULT_INITIAL_ZOOM,
            pitch: 0,
            bearing: 0,
            duration: 0,
          });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            '[MapView auto-fit] No focus location found (no footprints, no extent, unsupported CRS).'
          );
        }
      };

      // Wait one frame so the map container has its final layout before
      // fitting. Repeat after the initial style load when needed because
      // MapLibre may settle the constructor's fallback camera after mount.
      const fitWhenLaidOut = () => {
        requestAnimationFrame(() => {
          map.resize();
          doFit();
        });
      };
      fitWhenLaidOut();
      if (!map.isStyleLoaded()) map.once('load', fitWhenLaidOut);
    }

    // deck.gl's Layer base type is the lowest common denominator; listing the
    // specific parameterised Layer subclasses here is fine and keeps the
    // type-check honest about which layer classes we feed to MapboxOverlay.
    const layers: any[] = [];
    const roadDraftPaths = buildRoadDraftPaths(roadDraft);
    const roadDraftHandles = buildRoadDraftHandles(roadDraft);

    // LoD0 — outlines on the ground. Always on; at low zoom this is the only
    // thing drawn, at high zoom it still fires picking when clicking a roof edge.
    layers.push(
      new PolygonLayer<Footprint>({
        id: 'building-outlines',
        data: footprints,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => {
          const isSelected = d.id === selectedId || (d.parentId && d.parentId === selectedId);
          if (isSelected) return [255, 150, 40, 140];
          const isMultiSelected = multiSelectedIds?.has(d.id) || (d.parentId && multiSelectedIds?.has(d.parentId));
          if (isMultiSelected) return [255, 180, 80, 120];
          const matched = !filteredIds || filteredIds.has(d.id) || (d.parentId && filteredIds.has(d.parentId));
          if (!matched) return [120, 120, 130, 35]; // dimmed
          return mapColorMode === 'usage' ? tintByUsage(d, 120) : tintByRoofType(d, 120);
        },
        getLineColor: (d) => {
          const isSelected = d.id === selectedId || (d.parentId && d.parentId === selectedId);
          if (isSelected) return [255, 120, 10, 255];
          const isMultiSelected = multiSelectedIds?.has(d.id) || (d.parentId && multiSelectedIds?.has(d.parentId));
          if (isMultiSelected) return [255, 150, 40, 200];
          const matched = !filteredIds || filteredIds.has(d.id) || (d.parentId && filteredIds.has(d.parentId));
          if (!matched) return [80, 80, 90, 60]; // dimmed
          return [60, 70, 85, 220];
        },
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        extruded: false,
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedId, filteredIds, multiSelectedIds, mapColorMode],
          getLineColor: [selectedId, filteredIds, multiSelectedIds],
        },
        onClick: (info: PickingInfo<Footprint>, event: unknown) => {
          const src = (event as { srcEvent?: { ctrlKey?: boolean; metaKey?: boolean } })?.srcEvent;
          if (info.object) {
            onSelect({ objectId: info.object.id, ctrlKey: !!(src?.ctrlKey || src?.metaKey) });
          } else {
            onSelect(null);
          }
        },
      })
    );

    // LoD1 context on the map. Renders extruded flat-roof blocks (LoD1) which are fully
    // pickable and select-compatible. Max detail is shown when a building is clicked
    // and loaded into the Three.js viewer in the side panel.
    if (zoom > LOD_OUTLINE_MAX && zoom <= LOD_EXTRUDE_MAX) {
      layers.push(
        new SolidPolygonLayer<Footprint>({
          id: 'building-blocks',
          data: footprints,
          getPolygon: (d) => d.polygon,
          getElevation: (d) => d.height,
          getFillColor: (d) => {
            const isSelected = d.id === selectedId || (d.parentId && d.parentId === selectedId);
            if (isSelected) return [255, 150, 40, 240];
            const isMultiSelected = multiSelectedIds?.has(d.id) || (d.parentId && multiSelectedIds?.has(d.parentId));
            if (isMultiSelected) return [255, 180, 80, 200];
            const matched = !filteredIds || filteredIds.has(d.id) || (d.parentId && filteredIds.has(d.parentId));
            if (!matched) return [120, 120, 130, 60]; // dimmed
            return mapColorMode === 'usage' ? tintByUsage(d, 230) : tintByRoofType(d, 230);
          },
          extruded: true,
          wireframe: false,
          pickable: true,
          material: {
            ambient: 0.35,
            diffuse: 0.8,
            shininess: 16,
            specularColor: [60, 64, 70],
          },
          updateTriggers: {
            getFillColor: [selectedId, filteredIds, multiSelectedIds, mapColorMode],
          },
          onClick: (info: PickingInfo<Footprint>, event: unknown) => {
            const src = (event as { srcEvent?: { ctrlKey?: boolean; metaKey?: boolean } })?.srcEvent;
            if (info.object) {
              onSelect({ objectId: info.object.id, ctrlKey: !!(src?.ctrlKey || src?.metaKey) });
            } else {
              onSelect(null);
            }
          },
        })
      );
    }

    if (osm2streetsResult?.lanes) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-lanes',
          data: osm2streetsResult.lanes as any,
          filled: true,
          stroked: true,
          pickable: !!onOsm2StreetsSelect,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsLaneFillColor(
                feature?.properties?.lane_type ?? feature?.properties?.type ?? ''
              ),
              feature,
              basemap
            ),
          getLineColor: (feature: any) =>
            osm2streetsSelectionLineColor(
              feature,
              osm2streetsSelection,
              'lane',
              highlightedOsm2StreetsRoadIds.has(feature?.properties?.road)
            ),
          getLineWidth: (feature: any) =>
            osm2streetsSelectionLineWidth(
              feature,
              osm2streetsSelection,
              'lane',
              highlightedOsm2StreetsRoadIds.has(feature?.properties?.road)
            ),
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 0,
          onClick: (info: PickingInfo<any>) => {
            if (info.object) {
              onOsm2StreetsSelect?.({ kind: 'lane', feature: info.object });
            }
          },
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap],
            getLineColor: [osm2streetsSelection, highlightedOsm2StreetsRoadIds],
            getLineWidth: [osm2streetsSelection, highlightedOsm2StreetsRoadIds],
          },
        })
      );
    }

    if (osm2streetsResult?.plain) {
      const intersections = osm2streetsResult.plain.features.filter(
        (feature) => feature?.properties?.type === 'intersection'
      );
      if (intersections.length > 0) {
        layers.push(
          new GeoJsonLayer({
            id: 'osm2streets-intersections',
            data: {
              ...osm2streetsResult.plain,
              features: intersections,
            } as any,
            filled: true,
            stroked: true,
            pickable: !!onOsm2StreetsSelect,
            getFillColor: (feature: any) =>
              osm2streetsDisplayColor(
                osm2streetsIntersectionFillColor(
                  feature?.properties?.intersection_kind ?? feature?.properties?.kind ?? ''
                ),
                feature,
                basemap
              ),
            getLineColor: (feature: any) =>
              osm2streetsSelectionLineColor(
                feature,
                osm2streetsSelection,
                'intersection'
              ),
            getLineWidth: (feature: any) =>
              osm2streetsSelectionLineWidth(
                feature,
                osm2streetsSelection,
                'intersection'
              ),
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 0,
            onClick: (info: PickingInfo<any>) => {
              if (info.object) {
                onOsm2StreetsSelect?.({ kind: 'intersection', feature: info.object });
              }
            },
            parameters: { depthTest: false } as unknown as never,
            updateTriggers: {
              getFillColor: [basemap],
              getLineColor: [osm2streetsSelection],
              getLineWidth: [osm2streetsSelection],
            },
          })
        );
      }
    }

    if (highlightedOsm2StreetsRoadIds.size > 0 && osm2streetsResult?.plain) {
      const connectedRoads = osm2streetsResult.plain.features.filter(
        (feature) =>
          feature?.properties?.type === 'road' &&
          highlightedOsm2StreetsRoadIds.has(feature.properties.id)
      );
      if (connectedRoads.length > 0) {
        layers.push(
          new GeoJsonLayer({
            id: 'osm2streets-connected-roads',
            data: {
              ...osm2streetsResult.plain,
              features: connectedRoads,
            } as any,
            filled: false,
            stroked: true,
            pickable: false,
            getLineColor: [255, 218, 92, 245],
            getLineWidth: 4,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 3,
            parameters: { depthTest: false } as unknown as never,
          })
        );
      }
    }

    if (osm2streetsResult?.laneMarkings) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-lane-markings',
          data: osm2streetsResult.laneMarkings as any,
          filled: true,
          stroked: false,
          pickable: false,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsLaneMarkingFillColor(
                feature?.properties?.type ?? feature?.properties?.marking_type ?? ''
              ),
              feature,
              basemap
            ),
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (osm2streetsResult?.intersectionMarkings) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-intersection-markings',
          data: osm2streetsResult.intersectionMarkings as any,
          filled: true,
          stroked: false,
          pickable: false,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsIntersectionMarkingFillColor(
                feature?.properties?.type ?? feature?.properties?.marking_type ?? ''
              ),
              feature,
              basemap
            ),
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (roadAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'cityjson-road-areas',
          data: roadAreas,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => roadAreaFillColor(d, basemap),
          getLineColor: (d) => roadAreaLineColor(d, basemap, d.id === selectedRoadAreaId),
          getLineWidth: (d) => (d.id === selectedRoadAreaId ? 2 : 1),
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: true,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap],
            getLineColor: [selectedRoadAreaId, basemap],
            getLineWidth: [selectedRoadAreaId],
          },
          onClick: (info: PickingInfo<RoadArea>) => {
            if (info.object) onRoadAreaSelect?.(info.object);
          },
        })
      );
    }

    if (roadPreviewAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'road-draft-preview',
          data: roadPreviewAreas,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => roadAreaFillColor(d, basemap, true),
          getLineColor: (d) => roadAreaLineColor(d, basemap, false, true),
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (roadDraftPaths.length > 0) {
      layers.push(
        new PathLayer<RoadDraftPath>({
          id: 'road-draft-centerline',
          data: roadDraftPaths,
          getPath: (d) => d.path,
          getColor: [255, 178, 64, 245],
          getWidth: 2.5,
          widthUnits: 'pixels',
          widthMinPixels: 2,
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (roadDraftHandles.length > 0 && drawMode !== 'road-line' && onRoadDraftChange) {
      layers.push(
        new ScatterplotLayer<RoadDraftHandle>({
          id: 'road-draft-centerline-handles',
          data: roadDraftHandles,
          getPosition: (d) => d.position,
          getFillColor: (d) =>
            d.kind === 'vertex' ? [255, 196, 84, 255] : [255, 255, 255, 235],
          getLineColor: (d) =>
            d.kind === 'vertex' ? [72, 46, 14, 255] : [255, 178, 64, 255],
          getLineWidth: 2,
          getRadius: (d) => (d.kind === 'vertex' ? 8 : 6),
          radiusUnits: 'pixels',
          radiusMinPixels: 6,
          radiusMaxPixels: 11,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 90],
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (roadFitConflicts.length > 0) {
      layers.push(
        new PolygonLayer<RoadFitConflict>({
          id: 'road-fit-conflicts',
          data: roadFitConflicts,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) =>
            d.severity === 'error' ? [240, 50, 50, 145] : [255, 120, 40, 110],
          getLineColor: (d) =>
            d.severity === 'error' ? [255, 235, 235, 255] : [255, 210, 160, 255],
          getLineWidth: 2,
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (osm2streetsBbox) {
      const [west, south, east, north] = osm2streetsBbox;
      const boxCoords = [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ];
      layers.push(
        new PathLayer({
          id: 'osm2streets-bbox-boundary',
          data: [{ path: boxCoords }],
          getPath: (d: any) => d.path,
          getColor: [30, 144, 255, 255], // DodgerBlue
          getWidth: 3,
          widthUnits: 'pixels',
          widthMinPixels: 2,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    // Exact osm2streets polygons own picking whenever they are present. The
    // generic OSM centerline hit target previously sat above them and replaced
    // an exact selected road with a guessed constant-width draft.
    if (osmRoads.length > 0 && !osm2streetsResult?.lanes.features.length) {
      const handleOsmRoadClick = (info: PickingInfo<OsmRoadFeature>) => {
        if (info.object) onOsmRoadSelect?.(info.object);
      };

      layers.push(
        new PathLayer<OsmRoadFeature>({
          id: 'osm-road-reference',
          data: osmRoads,
          getPath: (d) => d.path,
          getColor: (d) =>
            roadOverlayColor(
              d.id === selectedOsmRoadId
                ? [255, 170, 40, 255]
                : [250, 210, 80, 220],
              {
                basemap,
                underground: d.inferredDraft.vertical?.placement === 'underground',
              }
            ),
          getWidth: (d) => (d.id === selectedOsmRoadId ? 6 : 3),
          widthUnits: 'pixels',
          widthMinPixels: 2,
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getColor: [selectedOsmRoadId, basemap],
            getWidth: [selectedOsmRoadId],
          },
        }),
        new PathLayer<OsmRoadFeature>({
          id: 'osm-road-reference-hit-area',
          data: osmRoads,
          getPath: (d) => d.path,
          /*
           * The displayed OSM centerline is intentionally thin, but a thin
           * deck.gl path is frustrating to pick. This transparent companion
           * layer renders after the lane polygons and gives every road a
           * generous click target without changing the visible map style.
           */
          getColor: [255, 255, 255, 1],
          getWidth: OSM_ROAD_HIT_WIDTH_PIXELS,
          widthUnits: 'pixels',
          widthMinPixels: OSM_ROAD_HIT_WIDTH_PIXELS,
          jointRounded: true,
          capRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 170, 40, 70],
          parameters: { depthTest: false } as unknown as never,
          onClick: handleOsmRoadClick,
        })
      );
    }

    if (osmPointFeatures.length > 0) {
      layers.push(
        new ScatterplotLayer<OsmPointFeature>({
          id: 'osm-street-point-features',
          data: osmPointFeatures,
          getPosition: (feature) => feature.position,
          getRadius: (feature) => (feature.kind === 'tree' ? 3.5 : 2.2),
          radiusUnits: 'meters',
          radiusMinPixels: 3,
          radiusMaxPixels: 9,
          getFillColor: osmPointFeatureColor,
          getLineColor: [255, 255, 255, 230],
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 1,
          filled: true,
          stroked: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    // Preview for the in-progress new building (mesh) OR a pending transform (polygon).
    if (preview?.mesh && preview.mesh.positions.length > 0) {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number] }>({
          id: 'new-building-preview-mesh',
          data: [{ position: preview.mesh.anchorLngLat }],
          getPosition: (d) => d.position,
          // A per-vertex mesh.colors buffer is honoured when _useMeshColors is
          // true; but that option isn't typed in deck.gl's public types.
          // getColor is a single tint applied per instance; we pick a warm
          // orange so the preview reads as "pending / unsaved".
          getColor: [255, 180, 80, 230],
          mesh: {
            positions: { value: preview.mesh.positions, size: 3 },
            indices: { value: preview.mesh.indices, size: 1 },
          } as unknown as never,
          _instanced: false,
          sizeScale: 1,
          coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
          coordinateOrigin: [preview.mesh.anchorLngLat[0], preview.mesh.anchorLngLat[1], 0],
          pickable: false,
        })
      );
    } else if (preview?.polygon && preview.polygon.length >= 3) {
      layers.push(
        new SolidPolygonLayer<{ polygon: [number, number][]; height: number }>({
          id: 'new-building-preview-poly',
          data: [{ polygon: preview.polygon, height: preview.height ?? 10 }],
          getPolygon: (d) => d.polygon,
          getElevation: (d) => d.height,
          getFillColor: [255, 180, 80, 200],
          getLineColor: [255, 120, 10, 255],
          extruded: true,
          wireframe: true,
          pickable: false,
          material: {
            ambient: 0.5,
            diffuse: 0.6,
            shininess: 10,
            specularColor: [120, 90, 40],
          },
        })
      );
    }

    // Planning polygons are drawn last with depth testing disabled so they
    // remain visible over extruded buildings.
    if (zones.length > 0) {
      layers.push(
        new PolygonLayer<ParcelZone>({
          id: 'planning-polygons',
          data: zones,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => d.color,
          getLineColor: (d) => [d.color[0], d.color[1], d.color[2], 230],
          getLineWidth: 2,
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
          extruded: false,
          pickable: true,
          parameters: { depthTest: false } as unknown as never,
          onClick: (info: PickingInfo<ParcelZone>) => {
            if (info.object) {
              onZoneSelect?.(info.object);
            }
          },
        })
      );
    }

    overlay.setProps({ layers });
  }, [
    footprints,
    selectedId,
    onSelect,
    zoom,
    preview,
    multiSelectedIds,
    filteredIds,
    zones,
    onZoneSelect,
    roadAreas,
    roadPreviewAreas,
    roadDraft,
    onRoadDraftChange,
    drawMode,
    roadFitConflicts,
    selectedRoadAreaId,
    onRoadAreaSelect,
    osmRoads,
    osmPointFeatures,
    selectedOsmRoadId,
    onOsmRoadSelect,
    osm2streetsResult,
    osm2streetsBbox,
    osm2streetsSelection,
    highlightedOsm2StreetsRoadIds,
    onOsm2StreetsSelect,
    basemap,
    mapColorMode,
  ]);

  // Terra Draw lifecycle — activate/deactivate based on drawMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode === 'polygon' || drawMode === 'road-line') {
      if (drawRef.current) return; // already active

      // Flatten every existing footprint's vertices into one array, so the
      // custom snap can do a linear nearest-vertex search. For a 3DBAG tile
      // with ~500 buildings × ~6 vertices = 3000 points this is fine in a
      // pointermove callback.
      const SNAP_PX = 20;
      const allVertices: [number, number][] = [];
      for (const fp of footprints) {
        for (const [lng, lat] of fp.polygon) allVertices.push([lng, lat]);
      }

      const start = () => {
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes:
            drawMode === 'polygon'
              ? [
                  new TerraDrawPolygonMode({
                    pointerDistance: 30,
                    snapping: {
                      // Snap to the in-progress polygon (close-to-self + prior vertices)
                      toCoordinate: true,
                      toLine: true,
                      // Snap to any existing building footprint vertex within SNAP_PX pixels
                      toCustom: (event, { project }) => {
                        const { x: mx, y: my } = project(event.lng, event.lat);
                        let bestDist = SNAP_PX;
                        let best: [number, number] | undefined;
                        for (const [vlng, vlat] of allVertices) {
                          const { x, y } = project(vlng, vlat);
                          const d = Math.hypot(x - mx, y - my);
                          if (d < bestDist) {
                            bestDist = d;
                            best = [vlng, vlat];
                          }
                        }
                        return best;
                      },
                    },
                  }),
                ]
              : [
                  new TerraDrawLineStringMode({
                    pointerDistance: 24,
                    keyEvents: { cancel: 'Escape', finish: 'Enter' },
                    // showCoordinatePoints draws the handles; editable makes
                    // those handles draggable/selectable while the centerline
                    // is still being drawn.
                    editable: true,
                    showCoordinatePoints: true,
                  }),
                ],
        });
        draw.start();
        draw.setMode(drawMode === 'polygon' ? 'polygon' : 'linestring');
        draw.on('finish', (id) => {
          const snapshot = draw.getSnapshot();
          const feature = snapshot.find((f) => String(f.id) === String(id));
          if (
            drawMode === 'polygon' &&
            feature &&
            feature.geometry.type === 'Polygon' &&
            Array.isArray(feature.geometry.coordinates?.[0])
          ) {
            const ring = feature.geometry.coordinates[0] as [number, number][];
            onFootprintDrawn(ring);
          } else if (
            drawMode === 'road-line' &&
            feature &&
            feature.geometry.type === 'LineString' &&
            Array.isArray(feature.geometry.coordinates)
          ) {
            onRoadLineDrawn?.(feature.geometry.coordinates as [number, number][]);
          }
          draw.clear();
          draw.stop();
          drawRef.current = null;
        });
        drawRef.current = draw;
      };

      if (map.isStyleLoaded()) start();
      else map.once('load', start);
    } else if (drawRef.current) {
      drawRef.current.stop();
      drawRef.current = null;
    }
    // Escape key cancels drawing
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && drawMode === 'road-line' && drawRef.current) {
        if (finishCurrentRoadDraw()) {
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape' && drawRef.current) {
        drawRef.current.stop();
        drawRef.current = null;
        onDrawCanceled?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode, onFootprintDrawn, onRoadLineDrawn, onDrawCanceled, footprints, finishCurrentRoadDraw]);

  useEffect(() => {
    if (finishRoadDrawToken <= 0 || drawMode !== 'road-line') return;
    const ok = finishCurrentRoadDraw();
    if (!ok) {
      setWarning('Road centerline needs at least two points before it can be finished.');
      window.setTimeout(() => setWarning(null), 2500);
    }
  }, [finishRoadDrawToken, drawMode, finishCurrentRoadDraw]);

  // ── One-click placement mode (used by IFC import) ────────────────────────
  // When `onPlacementClick` is set, we attach a one-shot map click listener
  // that fires the callback with the clicked lng/lat. The change in cursor
  // gives the user a visual cue. Selection clicks are blocked because
  // deck.gl's `onClick` on the building layers fires after MapLibre's, but
  // we set the picking layer to non-pickable while placement is awaiting,
  // so map clicks can land cleanly on the basemap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!onPlacementClick) return;

    const prevCursor = map.getCanvas().style.cursor;
    map.getCanvas().style.cursor = 'crosshair';

    const handler = (e: maplibregl.MapMouseEvent) => {
      // Stop deck.gl's onClick from also firing — we don't want the click
      // to also select a building underneath the placement cursor.
      e.preventDefault();
      onPlacementClick([e.lngLat.lng, e.lngLat.lat]);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = prevCursor;
    };
  }, [onPlacementClick]);

  // Planning click fallback: deck.gl picking handles normal zone clicks, but
  // MapLibre's click lng/lat makes the info card reliable for very translucent
  // planning polygons that do not always win the canvas pick.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || zones.length === 0 || !onZoneSelect || onPlacementClick) return;

    const handler = (e: maplibregl.MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const zone = findZoneForPoint(zones, point) ?? findNearestZoneForPoint(zones, point, 150);
      if (zone) onZoneSelect(zone);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [zones, onZoneSelect, onPlacementClick]);

  // ── Viewport-change broadcast ─────────────────────────────────────────────
  // Fire onViewportChange after every pan/zoom settles so the parent can
  // feed the bbox to viewport-filtered re-parsing. Uses moveend (not move)
  // to avoid per-frame callbacks during drag.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onViewportChange) return;
    const broadcast = () => {
      const b = map.getBounds();
      onViewportChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    // Emit once on mount so the parent has an initial bbox without waiting
    // for the first user pan.
    if (map.isStyleLoaded()) broadcast();
    else map.once('load', broadcast);
    map.on('moveend', broadcast);
    return () => {
      map.off('moveend', broadcast);
    };
  }, [onViewportChange]);

  // ── Drag-to-move mode ─────────────────────────────────────────────────────
  // When `dragTransformId` is set, mouse-drag on the map translates the
  // building's ghost preview. The delta is computed in CRS metres so the
  // numeric dX/dY fields in the side panel stay in sync.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dragTransformId || !onDragMove) return;

    const crs = detectCrs(cityjson);
    if (!crs.supported) return;

    let dragging = false;
    let startLngLat: [number, number] | null = null;
    let startCrs: [number, number] | null = null;

    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = 'move';

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      dragging = true;
      startLngLat = [e.lngLat.lng, e.lngLat.lat];
      startCrs = proj4('EPSG:4326', crs.code, startLngLat) as [number, number];
      map.dragPan.disable();
    };
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!dragging || !startCrs) return;
      const curCrs = proj4('EPSG:4326', crs.code, [e.lngLat.lng, e.lngLat.lat]) as [number, number];
      onDragMove(curCrs[0] - startCrs[0], curCrs[1] - startCrs[1]);
    };
    const onMouseUp = () => {
      if (dragging) {
        dragging = false;
        startLngLat = null;
        startCrs = null;
        map.dragPan.enable();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.style.cursor = prevCursor;
      if (dragging) map.dragPan.enable();
    };
  }, [dragTransformId, onDragMove, cityjson]);

  // ── Footprint-edit mode (TerraDrawSelectMode) ─────────────────────────────
  // When `footprintEdit` is set, load the building's polygon as a single
  // editable feature and fire `onFootprintChange` whenever the user drags a
  // vertex or midpoint. The parent commits the change via Save/Cancel buttons
  // in the side panel; this effect just streams the live ring upward.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Only one TerraDraw can be alive at a time on the map. If the polygon-
    // draw effect already started one, bail (drawMode === 'polygon' takes
    // precedence — the parent should ensure these aren't both set, but we
    // fail-soft if they are).
    if (drawMode === 'polygon') return;

    if (footprintEdit && !drawRef.current) {
      const start = () => {
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new TerraDrawSelectMode({
              flags: {
                polygon: {
                  feature: {
                    draggable: true, // whole-shape drag (rare; vertex drag is the main UX)
                    coordinates: {
                      draggable: true, // <-- the actual feature we want
                      midpoints: true, // edge midpoints add a vertex on drag
                      deletable: false, // don't let the user delete a corner — the
                      // generator wouldn't know what to do with < 3 corners
                    },
                  },
                },
              },
            }),
          ],
        });
        draw.start();

        // Strip closing vertex if present — Terra Draw expects open rings
        // internally, then closes for export.
        const open = footprintEdit.footprintWgs84.slice();
        const [first, last] = [open[0], open[open.length - 1]];
        if (first && last && first[0] === last[0] && first[1] === last[1]) open.pop();

        const featureId = 'building-footprint-edit';
        draw.addFeatures([
          {
            id: featureId,
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              // GeoJSON convention: outer ring closed (first === last)
              coordinates: [[...open, open[0]]],
            },
            properties: { mode: 'select' },
          },
        ]);
        draw.setMode('select');
        // Pre-select the feature so the user sees vertex handles immediately.
        draw.selectFeature(featureId);

        draw.on('change', () => {
          const snapshot = draw.getSnapshot();
          const f = snapshot.find((ff) => String(ff.id) === featureId);
          if (
            f &&
            f.geometry.type === 'Polygon' &&
            Array.isArray(f.geometry.coordinates?.[0])
          ) {
            const ring = f.geometry.coordinates[0] as [number, number][];
            onFootprintChange?.(ring);
          }
        });

        drawRef.current = draw;
      };

      if (map.isStyleLoaded()) start();
      else map.once('load', start);
    } else if (!footprintEdit && drawRef.current) {
      drawRef.current.clear();
      drawRef.current.stop();
      drawRef.current = null;
    }
  }, [footprintEdit, drawMode, onFootprintChange]);

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {drawMode === 'polygon' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(46,64,87,0.95)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          <b>Drawing mode</b> — click to place vertices · double-click to finish ·{' '}
          <kbd style={{ background: '#fff', color: '#333', padding: '1px 5px', borderRadius: 3 }}>
            Esc
          </kbd>{' '}
          to cancel
        </div>
      )}
      {drawMode === 'road-line' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(46,64,87,0.95)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          <b>Road drawing</b> - click centerline points, press{' '}
          <kbd style={{ background: '#fff', color: '#333', padding: '1px 5px', borderRadius: 3 }}>
            Enter
          </kbd>{' '}
          to finish,{' '}
          <kbd style={{ background: '#fff', color: '#333', padding: '1px 5px', borderRadius: 3 }}>
            Esc
          </kbd>{' '}
          to cancel
        </div>
      )}
      {warning && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            background: 'rgba(248,113,113,0.15)',
            border: '1px solid var(--error)',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 10,
          }}
        >
          {warning}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: warning ? 50 : 10,
          left: 10,
          zIndex: 10,
          display: 'flex',
          gap: 4,
          background: 'rgba(28,33,48,0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--border)',
          padding: 4,
          borderRadius: 6,
        }}
      >
        <MapColorModeButton
          active={mapColorMode === 'roof'}
          onClick={() => setMapColorMode('roof')}
        >
          Roof
        </MapColorModeButton>
        <MapColorModeButton
          active={mapColorMode === 'usage'}
          onClick={() => setMapColorMode('usage')}
        >
          Usage
        </MapColorModeButton>
      </div>
    </>
  );
}

function MapColorModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-dim)',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: '6px 8px',
      }}
    >
      {children}
    </button>
  );
}



function isFiniteBbox(bbox: maplibregl.LngLatBoundsLike): boolean {
  if (!Array.isArray(bbox) || bbox.length !== 2) return false;
  const [a, b] = bbox as [[number, number], [number, number]];
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    b.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

function computeFootprintBounds(
  footprints: Footprint[]
): maplibregl.LngLatBoundsLike | null {
  if (footprints.length === 0) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  let any = false;
  for (const fp of footprints) {
    for (const [lng, lat] of fp.polygon) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      any = true;
    }
  }
  if (!any) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function computeRoadAreaBounds(roadAreas: RoadArea[]): maplibregl.LngLatBoundsLike | null {
  if (roadAreas.length === 0) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  let any = false;
  for (const area of roadAreas) {
    for (const [lng, lat] of area.polygon) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      any = true;
    }
  }
  if (!any) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Fallback #2: fit to the CityJSON vertices themselves. This is tighter than
 * metadata extents and still works for imports that do not expose footprint
 * semantics.
 */
function computeVertexBounds(doc: CityJsonDocument): maplibregl.LngLatBoundsLike | null {
  if (doc.vertices.length === 0) return null;

  // First inspect the transformed source coordinates. Some CityJSON files are
  // already stored directly in WGS84, in which case no CRS lookup is needed.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let anyProjected = false;
  for (const vertex of doc.vertices) {
    const c = applyVertexTransform(vertex, doc);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
    anyProjected = true;
  }
  if (!anyProjected) return null;

  // If the numbers already look like longitude/latitude, use them directly.
  if (looksLikeWgs84Extent(minX, minY, maxX, maxY)) {
    return [
      [minX, minY],
      [maxX, maxY],
    ];
  }

  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  // Reproject every vertex rather than only the source bbox corners. That keeps
  // the fitted map tight even when a projected CRS bends or skews the WGS84
  // envelope slightly.
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  let anyLngLat = false;
  try {
    for (const vertex of doc.vertices) {
      const c = applyVertexTransform(vertex, doc);
      const [lng, lat] = projectToWgs84(crs.code, c);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      anyLngLat = true;
    }
  } catch {
    return null;
  }

  return anyLngLat
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null;
}

/**
 * Fallback #3: read `metadata.geographicalExtent` (a 6-element bbox in the
 * dataset's own CRS: [minX, minY, minZ, maxX, maxY, maxZ]) and reproject the
 * 2D corners to WGS84. Works for files where extractFootprints returned
 * nothing (for instance, because CityObjects lack GroundSurfaces we can
 * detect).
 */
function computeMetadataBounds(doc: CityJsonDocument): maplibregl.LngLatBoundsLike | null {
  const ext = doc.metadata?.geographicalExtent;
  if (!Array.isArray(ext) || ext.length < 4) return null;
  const [minX, minY, , maxX, maxY] = ext as number[];
  if (looksLikeWgs84Extent(minX, minY, maxX, maxY)) {
    return [
      [minX, minY],
      [maxX, maxY],
    ];
  }
  const crs = detectCrs(doc);
  if (!crs.supported) return null;
  try {
    const a = proj4(crs.code, 'EPSG:4326', [minX, minY]) as [number, number];
    const b = proj4(crs.code, 'EPSG:4326', [maxX, maxY]) as [number, number];
    return [a, b];
  } catch {
    return null;
  }
}

function looksLikeWgs84Extent(minX: number, minY: number, maxX: number, maxY: number): boolean {
  return (
    minX >= -180 &&
    minX <= 180 &&
    maxX >= -180 &&
    maxX <= 180 &&
    minY >= -90 &&
    minY <= 90 &&
    maxY >= -90 &&
    maxY <= 90 &&
    minX <= maxX &&
    minY <= maxY
  );
}

function boundsCenter(bounds: maplibregl.LngLatBoundsLike | null): [number, number] | null {
  if (!bounds || !Array.isArray(bounds) || bounds.length < 2 || !isFiniteBbox(bounds)) {
    return null;
  }
  const sw = bounds[0] as [number, number];
  const ne = bounds[1] as [number, number];
  return [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2];
}

/**
 * Fallback #4: project `transform.translate` — the document's local origin —
 * to WGS84 and use it as a centre. Gives a useful view even when no bbox and
 * no footprints can be determined.
 */
function computeTranslateCentre(doc: CityJsonDocument): [number, number] | null {
  const t = doc.transform?.translate;
  if (!t || !Number.isFinite(t[0]) || !Number.isFinite(t[1])) return null;
  const crs = detectCrs(doc);
  if (!crs.supported) return null;
  try {
    return proj4(crs.code, 'EPSG:4326', [t[0], t[1]]) as [number, number];
  } catch {
    return null;
  }
}
