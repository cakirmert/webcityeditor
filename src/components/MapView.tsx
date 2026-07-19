import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import {
  GeoJsonLayer,
  IconLayer,
  PathLayer,
  PolygonLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
  TextLayer,
} from '@deck.gl/layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { PathStyleExtension } from '@deck.gl/extensions';
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
  RoadBandKind,
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
  buildRoadSnapCandidates,
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  insertRoadDraftPoint,
  updateRoadDraftPoint,
  type RoadDraftHandle,
  type RoadDraftPath,
  type RoadSnapCandidate,
} from '../lib/road-draft-edit';
import { osmTrafficSignIcon } from '../lib/osm-street-point-style';
import { buildCityJsonMapMesh } from '../lib/cityjson-map-mesh';
import { buildRoadVisuals } from '../lib/road-visuals';
import {
  BUILDING_BLOCK_FULL_ZOOM,
  BUILDING_BLOCK_MIN_ZOOM,
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MIN_ZOOM,
  smoothZoomStep,
} from '../lib/lod-transition';
import { Layers3, Map as MapIcon, Satellite } from 'lucide-react';

/**
 * Zoom-based LoD thresholds use long overlapping ramps rather than discrete
 * swaps. The block context appears over two zoom levels and the source mesh
 * blends over 3.5 levels, so trackpad and pinch zoom do not pop from LoD0 to
 * LoD2/3 in a single gesture.
 */
const DATA_FIT_PADDING = 56;
const DATA_FIT_MAX_ZOOM = 14.25;
const ROAD_DATA_FIT_MAX_ZOOM = 18;
const OSM_ROAD_HIT_WIDTH_PIXELS = 20;
const DEFAULT_INITIAL_ZOOM = 12;
const EDIT_FOCUS_PADDING_DEGREES = 0.0038;
const ROAD_SNAP_RADIUS_PIXELS = 30;

function addCityObjectWithDescendants(
  doc: CityJsonDocument,
  id: string,
  target: Set<string>
): void {
  if (target.has(id)) return;
  const object = doc.CityObjects[id];
  if (!object) return;
  target.add(id);
  for (const child of object.children ?? []) {
    addCityObjectWithDescendants(doc, child, target);
  }
}

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
  preview = false,
  opacity = 1
): Rgba {
  if (roadAreaKind(area).toLowerCase() === 'intersection') {
    return roadOverlayColor(
      osm2streetsIntersectionFillColor(roadAreaSourceType(area) ?? 'intersection'),
      {
        basemap,
        underground: area.vertical?.placement === 'underground',
        opacity,
      }
    );
  }
  const base = roadBandFillColor(roadAreaKind(area), roadAreaSourceType(area));
  return roadOverlayColor(preview ? withAlpha(base, Math.min(base[3], 218)) : base, {
    basemap,
    underground: area.vertical?.placement === 'underground',
    opacity,
  });
}

function roadAreaLineColor(
  area: RoadArea,
  basemap: 'map' | 'satellite',
  selected = false,
  preview = false,
  opacity = 1
): Rgba {
  const color: Rgba = selected
    ? [255, 224, 130, 255]
    : preview
      ? [245, 248, 255, 185]
      : [0, 0, 0, 0];
  return roadOverlayColor(color, {
    basemap,
    underground: area.vertical?.placement === 'underground',
    opacity,
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
  basemap: 'map' | 'satellite',
  opacity = 1
): Rgba {
  return roadOverlayColor(color, {
    basemap,
    underground: osm2streetsFeatureIsUnderground(feature),
    opacity,
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
  onBasemapChange?: (basemap: 'map' | 'satellite') => void;
  satelliteOpacity?: number;
  onSatelliteOpacityChange?: (opacity: number) => void;
  roadOverlayOpacity?: number;
  onRoadOverlayOpacityChange?: (opacity: number) => void;
  roadWorkspaceOpen?: boolean;
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
 *   - MapLibre = basemap tiles (OSM raster today; vector tiles later).
 *   - deck.gl  = every building rendered as an extruded footprint (context view).
 *               A proper production build would use Tile3DLayer with
 *               pg2b3dm-generated 3D Tiles from 3DCityDB; the editor
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
  onBasemapChange,
  satelliteOpacity = 0.82,
  onSatelliteOpacityChange,
  roadOverlayOpacity = 0.92,
  onRoadOverlayOpacityChange,
  roadWorkspaceOpen = false,
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
  const pendingRoadDraftChangeRef = useRef<RoadDraft | null>(null);
  const roadDraftFrameRef = useRef<number | null>(null);
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
  const [drawWarning, setDrawWarning] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(initialView?.zoom ?? DEFAULT_INITIAL_ZOOM);
  const [mapColorMode, setMapColorMode] = useState<'roof' | 'usage'>('roof');
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [layerControlOpen, setLayerControlOpen] = useState(false);

  useEffect(() => {
    // Keep this compact control behind its button whenever another map tool
    // opens. Satellite/road blending is also available directly in Roads.
    if (roadWorkspaceOpen || zones.length > 0 || drawMode !== 'none' || selectedId) {
      setLayerControlOpen(false);
    }
  }, [drawMode, roadWorkspaceOpen, selectedId, zones.length]);

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

  const finishCurrentBuildingDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return false;
    const feature = draw
      .getSnapshot()
      .find(
        (candidate) =>
          candidate.geometry.type === 'Polygon' &&
          Array.isArray(candidate.geometry.coordinates?.[0]) &&
          candidate.geometry.coordinates[0].length >= 3
      );
    if (!feature || feature.geometry.type !== 'Polygon') return false;
    const ring = feature.geometry.coordinates[0] as [number, number][];
    onFootprintDrawn(ring);
    draw.clear();
    draw.stop();
    drawRef.current = null;
    return true;
  }, [onFootprintDrawn]);

  const footprints = useMemo(
    () => precomputedFootprints ?? extractFootprints(cityjson),
    // reloadToken is intentionally a dep so "Reload view" after an edit
    // (e.g. changed measuredHeight) rebuilds the deck.gl data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityjson, reloadToken, precomputedFootprints]
  );

  const commitRoadDraft = useCallback((next: RoadDraft) => {
    roadDraftRef.current = next;
    pendingRoadDraftChangeRef.current = next;
    if (roadDraftFrameRef.current !== null) return;
    roadDraftFrameRef.current = window.requestAnimationFrame(() => {
      roadDraftFrameRef.current = null;
      const pending = pendingRoadDraftChangeRef.current;
      pendingRoadDraftChangeRef.current = null;
      if (pending) onRoadDraftChangeRef.current?.(pending);
    });
  }, []);

  useEffect(
    () => () => {
      if (roadDraftFrameRef.current !== null) {
        window.cancelAnimationFrame(roadDraftFrameRef.current);
      }
    },
    []
  );

  const roadSnapCandidates = useMemo(
    () => buildRoadSnapCandidates(roadDraft, roadAreas, osmRoads),
    [roadDraft, roadAreas, osmRoads]
  );
  const roadSnapCandidatesRef = useRef(roadSnapCandidates);
  useEffect(() => {
    roadSnapCandidatesRef.current = roadSnapCandidates;
  }, [roadSnapCandidates]);

  const rawEditFocusBbox = useMemo(() => {
    if (roadDraft) {
      const points = roadDraft.sections.flatMap((section) => section.centerlineWgs84);
      return expandLngLatBbox(pointsBbox(points), EDIT_FOCUS_PADDING_DEGREES);
    }
    if (footprintEdit) {
      return expandLngLatBbox(
        pointsBbox(footprintEdit.footprintWgs84),
        EDIT_FOCUS_PADDING_DEGREES
      );
    }
    if (preview?.polygon?.length) {
      return expandLngLatBbox(pointsBbox(preview.polygon), EDIT_FOCUS_PADDING_DEGREES);
    }
    if (dragTransformId && selectedId) {
      const selectedPoints = footprints
        .filter((footprint) => footprint.id === selectedId || footprint.parentId === selectedId)
        .flatMap((footprint) => footprint.polygon.map(([lng, lat]) => [lng, lat] as [number, number]));
      return expandLngLatBbox(pointsBbox(selectedPoints), EDIT_FOCUS_PADDING_DEGREES);
    }
    return null;
  }, [roadDraft, footprintEdit, preview?.polygon, dragTransformId, selectedId, footprints]);

  const editFocusKey = rawEditFocusBbox
    ? rawEditFocusBbox.map((value) => Math.round(value / 0.0008)).join(':')
    : 'none';
  const editFocusBbox = useMemo(
    () =>
      rawEditFocusBbox
        ? rawEditFocusBbox.map(
            (value) => Math.round(value / 0.0008) * 0.0008
          ) as LngLatBbox
        : null,
    // The key intentionally quantizes focus updates to roughly 50-90 metres,
    // keeping detailed building meshes stable during most road-handle drags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editFocusKey]
  );

  const renderedFootprints = useMemo(
    () =>
      editFocusBbox
        ? footprints.filter((footprint) => polygonIntersectsBbox(footprint.polygon, editFocusBbox))
        : footprints,
    [footprints, editFocusBbox]
  );

  const renderedRoadAreas = useMemo(
    () =>
      editFocusBbox
        ? roadAreas.filter((area) => polygonIntersectsBbox(area.polygon, editFocusBbox))
        : roadAreas,
    [roadAreas, editFocusBbox]
  );

  const roadDecorationAreas = useMemo(() => {
    const scope = editFocusBbox ?? viewportBbox;
    return scope
      ? renderedRoadAreas.filter((area) => polygonIntersectsBbox(area.polygon, scope))
      : renderedRoadAreas;
  }, [renderedRoadAreas, editFocusBbox, viewportBbox]);
  // Keep the thousands of saved CityJSON markings stable while a finger moves
  // one draft handle. Only the tiny preview decoration is rebuilt per drag.
  const savedRoadVisuals = useMemo(
    () => buildRoadVisuals(roadDecorationAreas),
    [roadDecorationAreas]
  );
  const previewRoadVisuals = useMemo(
    () => buildRoadVisuals(roadPreviewAreas),
    [roadPreviewAreas]
  );
  const roadVisuals = useMemo(
    () => ({
      dividers: [...savedRoadVisuals.dividers, ...previewRoadVisuals.dividers],
      directions: [...savedRoadVisuals.directions, ...previewRoadVisuals.directions],
    }),
    [savedRoadVisuals, previewRoadVisuals]
  );

  const renderedZones = useMemo(
    () =>
      editFocusBbox
        ? zones.filter((zone) => polygonIntersectsBbox(zone.polygon, editFocusBbox))
        : zones,
    [zones, editFocusBbox]
  );

  const renderedOsmRoads = useMemo(
    () =>
      editFocusBbox
        ? osmRoads.filter((road) => lineIntersectsBbox(road.path, editFocusBbox))
        : osmRoads,
    [osmRoads, editFocusBbox]
  );

  const renderedOsmPointFeatures = useMemo(
    () => {
      if (!editFocusBbox && zoom < 16) return [];
      return editFocusBbox
        ? osmPointFeatures.filter((feature) => pointInsideBbox(feature.position, editFocusBbox))
        : osmPointFeatures;
    },
    [osmPointFeatures, editFocusBbox, zoom]
  );

  const renderedOsm2StreetsResult = useMemo(() => {
    if (!osm2streetsResult || !editFocusBbox) return osm2streetsResult;
    return {
      ...osm2streetsResult,
      plain: filterGeoJsonToBbox(osm2streetsResult.plain, editFocusBbox),
      lanes: filterGeoJsonToBbox(osm2streetsResult.lanes, editFocusBbox),
      laneMarkings: filterGeoJsonToBbox(osm2streetsResult.laneMarkings, editFocusBbox),
      intersectionMarkings: filterGeoJsonToBbox(
        osm2streetsResult.intersectionMarkings,
        editFocusBbox
      ),
    };
  }, [osm2streetsResult, editFocusBbox]);

  const detailOpacity = smoothZoomStep(
    BUILDING_DETAIL_MIN_ZOOM,
    BUILDING_DETAIL_FULL_ZOOM,
    zoom
  );
  const detailEnabled = zoom >= BUILDING_DETAIL_MIN_ZOOM;
  const detailScopeBbox = editFocusBbox ?? viewportBbox;
  const detailObjectIds = useMemo(() => {
    if (!detailEnabled || !detailScopeBbox) return null;
    const visible = renderedFootprints.filter((footprint) =>
      polygonIntersectsBbox(footprint.polygon, detailScopeBbox)
    );
    const center: [number, number] = [
      (detailScopeBbox[0] + detailScopeBbox[2]) / 2,
      (detailScopeBbox[1] + detailScopeBbox[3]) / 2,
    ];
    visible.sort(
      (a, b) =>
        squaredDistanceToPolygon(center, a.polygon) - squaredDistanceToPolygon(center, b.polygon)
    );
    const ids = new Set<string>();
    // More buildings switch to their highest source geometry progressively as
    // the view closes in. Each building swaps once; two LoDs are never drawn
    // on top of one another, avoiding z-fighting and doubled walls.
    const detailLimit = Math.max(24, Math.round(24 + detailOpacity * 396));
    for (const footprint of visible.slice(0, detailLimit)) {
      addCityObjectWithDescendants(cityjson, footprint.id, ids);
      if (footprint.parentId) addCityObjectWithDescendants(cityjson, footprint.parentId, ids);
    }
    if (selectedId) addCityObjectWithDescendants(cityjson, selectedId, ids);
    return ids.size > 0 ? ids : null;
  }, [cityjson, detailEnabled, detailOpacity, detailScopeBbox, renderedFootprints, selectedId]);

  const detailMesh = useMemo(
    () =>
      detailObjectIds
        ? buildCityJsonMapMesh(cityjson, {
            objectIds: detailObjectIds,
            maxOutputVertices: 160_000,
          })
        : null,
    [cityjson, detailObjectIds, reloadToken]
  );
  const blockFootprints = useMemo(
    () =>
      detailObjectIds
        ? renderedFootprints.filter(
            (footprint) =>
              !detailObjectIds.has(footprint.id) &&
              (!footprint.parentId || !detailObjectIds.has(footprint.parentId))
          )
        : renderedFootprints,
    [renderedFootprints, detailObjectIds]
  );
  const blockOpacity = smoothZoomStep(
    BUILDING_BLOCK_MIN_ZOOM,
    BUILDING_BLOCK_FULL_ZOOM,
    zoom
  );

  // A drawing/editing gesture owns the map until it is saved or discarded.
  // Keeping unrelated pick targets live here caused one finger tap to both add
  // a road anchor and open a building/intersection inspector underneath it.
  const mapSelectionLocked =
    drawMode !== 'none' ||
    !!roadDraft ||
    !!onPlacementClick ||
    !!footprintEdit ||
    !!dragTransformId;
  const buildingSelectionEnabled = !mapSelectionLocked;
  const roadSelectionEnabled = !mapSelectionLocked && roadWorkspaceOpen;
  const planningSelectionEnabled = !mapSelectionLocked && !roadWorkspaceOpen;

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

    // The editor uses a raster-only basemap, so keep deck.gl on its own
    // canvas above MapLibre. Interleaving can place the building context
    // behind the raster layer, which makes the editable city look empty.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);

    let liveZoomFrame: number | null = null;
    const syncLiveZoom = () => {
      if (liveZoomFrame !== null) return;
      liveZoomFrame = window.requestAnimationFrame(() => {
        liveZoomFrame = null;
        setZoom(map.getZoom());
      });
    };
    const syncSettledView = () => {
      setZoom(map.getZoom());
      const bounds = map.getBounds();
      setViewportBbox([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]);
    };
    map.on('zoom', syncLiveZoom);
    map.on('zoomend', syncSettledView);
    map.on('moveend', syncSettledView);
    if (map.isStyleLoaded()) syncSettledView();
    else map.once('load', syncSettledView);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.off('zoom', syncLiveZoom);
      map.off('zoomend', syncSettledView);
      map.off('moveend', syncSettledView);
      if (liveZoomFrame !== null) window.cancelAnimationFrame(liveZoomFrame);
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
      const section = draft.sections.find((candidate) => candidate.id === active.sectionId);
      const isEndpoint =
        !!section &&
        (active.pointIndex === 0 || active.pointIndex === section.centerlineWgs84.length - 1);
      const snap = isEndpoint
        ? nearestRoadSnapCandidate(
            map,
            roadSnapCandidatesRef.current,
            active.sectionId,
            [event.clientX - rect.left, event.clientY - rect.top],
            ROAD_SNAP_RADIUS_PIXELS
          )
        : null;
      commitRoadDraft(
        updateRoadDraftPoint(
          draft,
          active.sectionId,
          active.pointIndex,
          snap?.position ?? [lngLat.lng, lngLat.lat],
          snap?.connection ?? null
        )
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
      // Keep the map layer under imagery so the opacity slider becomes a true
      // compare/blend control rather than a binary source switch.
      map.setLayoutProperty('osm', 'visibility', 'visible');
      map.setLayoutProperty(
        'satellite',
        'visibility',
        basemap === 'satellite' ? 'visible' : 'none'
      );
      map.setPaintProperty(
        'satellite',
        'raster-opacity',
        Math.max(0, Math.min(1, satelliteOpacity))
      );
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [basemap, satelliteOpacity]);

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
    const midpointHandles = roadDraftHandles.filter((handle) => handle.kind === 'midpoint');
    const draftEndpoints = roadDraft
      ? roadDraft.sections.flatMap((section) => {
          const line = section.centerlineWgs84;
          return line.length > 1 ? [line[0], line[line.length - 1]] : [];
        })
      : [];
    const eligibleSnapCandidates = roadSnapCandidates.filter(
      (candidate) =>
        (candidate.connection.target !== 'draft' || (roadDraft?.sections.length ?? 0) > 1) &&
        (!editFocusBbox || pointInsideBbox(candidate.position, editFocusBbox))
    );
    // Showing every road endpoint in the focus box produced hundreds of teal
    // rings. Reveal only the nearest useful joins around each movable end; as
    // the user drags, this set follows the finger and nearby targets appear.
    const visibleSnapCandidateMap = new Map<string, RoadSnapCandidate>();
    for (const endpoint of draftEndpoints) {
      eligibleSnapCandidates
        .map((candidate) => ({
          candidate,
          distance: approximateLngLatDistanceMeters(endpoint, candidate.position),
        }))
        .filter(({ distance }) => distance <= 80)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6)
        .forEach(({ candidate }) => visibleSnapCandidateMap.set(candidate.id, candidate));
    }
    const visibleSnapCandidates = [...visibleSnapCandidateMap.values()];

    // LoD0 — outlines on the ground. Always on; at low zoom this is the only
    // thing drawn, at high zoom it still fires picking when clicking a roof edge.
    layers.push(
      new PolygonLayer<Footprint>({
        id: 'building-outlines',
        data: renderedFootprints,
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
        pickable: buildingSelectionEnabled,
        updateTriggers: {
          getFillColor: [selectedId, filteredIds, multiSelectedIds, mapColorMode],
          getLineColor: [selectedId, filteredIds, multiSelectedIds],
        },
        onClick: (info: PickingInfo<Footprint>, event: unknown) => {
          if (!buildingSelectionEnabled) return;
          const src = (event as { srcEvent?: { ctrlKey?: boolean; metaKey?: boolean } })?.srcEvent;
          if (info.object) {
            onSelect({ objectId: info.object.id, ctrlKey: !!(src?.ctrlKey || src?.metaKey) });
          } else {
            onSelect(null);
          }
        },
      })
    );

    if (detailMesh && detailMesh.indices.length > 0) {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: 'building-highest-detail',
          data: [{ position: [0, 0, 0] }],
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getColor: [255, 255, 255, 255],
          mesh: {
            attributes: {
              positions: { value: detailMesh.positions, size: 3 },
              colors: { value: detailMesh.colors, size: 3 },
            },
            indices: { value: detailMesh.indices, size: 1 },
          } as unknown as never,
          _instanced: false,
          opacity: 1,
          sizeScale: 1,
          coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
          coordinateOrigin: [detailMesh.anchorLngLat[0], detailMesh.anchorLngLat[1], 0],
          pickable: false,
          material: {
            ambient: 0.55,
            diffuse: 0.72,
            shininess: 18,
            specularColor: [70, 74, 82],
          },
        } as any)
      );
    }

    if (detailMesh?.textures.length) {
      detailMesh.textures.forEach((textureMesh, index) => {
        layers.push(
          new SimpleMeshLayer<{ position: [number, number, number] }>({
            id: `building-highest-detail-texture-${index}`,
            data: [{ position: [0, 0, 0] }],
            getPosition: (d: { position: [number, number, number] }) => d.position,
            getColor: [255, 255, 255, 255],
            mesh: {
              attributes: {
                positions: { value: textureMesh.positions, size: 3 },
                texCoords: { value: textureMesh.texCoords, size: 2 },
              },
              indices: { value: textureMesh.indices, size: 1 },
            } as unknown as never,
            texture: textureMesh.image,
            _instanced: false,
            opacity: 1,
            sizeScale: 1,
            coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
            coordinateOrigin: [detailMesh.anchorLngLat[0], detailMesh.anchorLngLat[1], 0],
            pickable: false,
            material: {
              ambient: 0.78,
              diffuse: 0.34,
              shininess: 6,
              specularColor: [30, 30, 30],
            },
          } as any)
        );
      });
    }

    // Cheap block context fills the middle zoom range; close zoom swaps it for
    // the indexed highest-available CityJSON surface mesh above.
    if (blockOpacity > 0.001 && blockFootprints.length > 0) {
      layers.push(
        new SolidPolygonLayer<Footprint>({
          id: 'building-blocks',
          data: blockFootprints,
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
          opacity: blockOpacity,
          wireframe: false,
          pickable: buildingSelectionEnabled,
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
            if (!buildingSelectionEnabled) return;
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

    if (renderedOsm2StreetsResult?.lanes) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-lanes',
          data: renderedOsm2StreetsResult.lanes as any,
          filled: true,
          stroked: true,
          pickable: roadSelectionEnabled && !!onOsm2StreetsSelect,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsLaneFillColor(
                feature?.properties?.lane_type ?? feature?.properties?.type ?? ''
              ),
              feature,
              basemap,
              roadOverlayOpacity
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
            if (roadSelectionEnabled && info.object) {
              onOsm2StreetsSelect?.({ kind: 'lane', feature: info.object });
            }
          },
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap, roadOverlayOpacity],
            getLineColor: [osm2streetsSelection, highlightedOsm2StreetsRoadIds],
            getLineWidth: [osm2streetsSelection, highlightedOsm2StreetsRoadIds],
          },
        })
      );
    }

    if (renderedOsm2StreetsResult?.plain) {
      const intersections = renderedOsm2StreetsResult.plain.features.filter(
        (feature) => feature?.properties?.type === 'intersection'
      );
      if (intersections.length > 0) {
        layers.push(
          new GeoJsonLayer({
            id: 'osm2streets-intersections',
            data: {
              ...renderedOsm2StreetsResult.plain,
              features: intersections,
            } as any,
            filled: true,
            stroked: true,
            pickable: roadSelectionEnabled && !!onOsm2StreetsSelect,
            getFillColor: (feature: any) =>
              osm2streetsDisplayColor(
                osm2streetsIntersectionFillColor(
                  feature?.properties?.intersection_kind ?? feature?.properties?.kind ?? ''
                ),
                feature,
                basemap,
                roadOverlayOpacity
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
              if (roadSelectionEnabled && info.object) {
                onOsm2StreetsSelect?.({ kind: 'intersection', feature: info.object });
              }
            },
            parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
            updateTriggers: {
              getFillColor: [basemap, roadOverlayOpacity],
              getLineColor: [osm2streetsSelection],
              getLineWidth: [osm2streetsSelection],
            },
          })
        );
      }
    }

    if (highlightedOsm2StreetsRoadIds.size > 0 && renderedOsm2StreetsResult?.plain) {
      const connectedRoads = renderedOsm2StreetsResult.plain.features.filter(
        (feature) =>
          feature?.properties?.type === 'road' &&
          highlightedOsm2StreetsRoadIds.has(feature.properties.id)
      );
      if (connectedRoads.length > 0) {
        layers.push(
          new GeoJsonLayer({
            id: 'osm2streets-connected-roads',
            data: {
              ...renderedOsm2StreetsResult.plain,
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

    if (renderedOsm2StreetsResult?.laneMarkings) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-lane-markings',
          data: renderedOsm2StreetsResult.laneMarkings as any,
          filled: true,
          stroked: false,
          pickable: false,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsLaneMarkingFillColor(
                feature?.properties?.type ?? feature?.properties?.marking_type ?? ''
              ),
              feature,
              basemap,
              roadOverlayOpacity
            ),
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: { getFillColor: [basemap, roadOverlayOpacity] },
        })
      );
    }

    if (renderedOsm2StreetsResult?.intersectionMarkings) {
      layers.push(
        new GeoJsonLayer({
          id: 'osm2streets-intersection-markings',
          data: renderedOsm2StreetsResult.intersectionMarkings as any,
          filled: true,
          stroked: false,
          pickable: false,
          getFillColor: (feature: any) =>
            osm2streetsDisplayColor(
              osm2streetsIntersectionMarkingFillColor(
                feature?.properties?.type ?? feature?.properties?.marking_type ?? ''
              ),
              feature,
              basemap,
              roadOverlayOpacity
            ),
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: { getFillColor: [basemap, roadOverlayOpacity] },
        })
      );
    }

    if (renderedRoadAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'cityjson-road-areas',
          data: renderedRoadAreas,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => roadAreaFillColor(d, basemap, false, roadOverlayOpacity),
          getLineColor: (d) =>
            roadAreaLineColor(
              d,
              basemap,
              d.id === selectedRoadAreaId,
              false,
              roadOverlayOpacity
            ),
          getLineWidth: (d) => (d.id === selectedRoadAreaId ? 2 : 1),
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: roadSelectionEnabled,
          extruded: false,
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap, roadOverlayOpacity],
            getLineColor: [selectedRoadAreaId, basemap, roadOverlayOpacity],
            getLineWidth: [selectedRoadAreaId],
          },
          onClick: (info: PickingInfo<RoadArea>) => {
            if (roadSelectionEnabled && info.object) onRoadAreaSelect?.(info.object);
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
          getFillColor: (d) => roadAreaFillColor(d, basemap, true, roadOverlayOpacity),
          getLineColor: (d) =>
            roadAreaLineColor(d, basemap, false, true, roadOverlayOpacity),
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap, roadOverlayOpacity],
            getLineColor: [basemap, roadOverlayOpacity],
          },
        })
      );
    }

    if ((zoom >= 15 || roadWorkspaceOpen) && roadVisuals.dividers.length > 0) {
      layers.push(
        new PathLayer({
          id: 'cityjson-road-lane-markings',
          data: roadVisuals.dividers,
          getPath: (d: any) => d.path,
          getColor: (d: any) =>
            d.kind === 'lane-divider'
              ? roadOverlayColor([248, 250, 252, 238], { basemap, opacity: roadOverlayOpacity })
              : roadOverlayColor([205, 210, 218, 205], { basemap, opacity: roadOverlayOpacity }),
          getWidth: (d: any) => (d.kind === 'lane-divider' ? 0.14 : 0.1),
          widthUnits: 'meters',
          widthMinPixels: 1,
          getDashArray: (d: any) => d.kind === 'lane-divider' ? [3.2, 2.4] : [1, 0],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: {
            getColor: [basemap, roadOverlayOpacity],
          },
        } as any)
      );
    }

    if ((zoom >= 16 || roadWorkspaceOpen) && roadVisuals.directions.length > 0) {
      layers.push(
        new PolygonLayer({
          id: 'cityjson-road-direction-arrows',
          data: roadVisuals.directions,
          getPolygon: (d: any) => d.polygon,
          getFillColor: roadOverlayColor([248, 250, 252, 238], {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineColor: roadOverlayColor([36, 40, 47, 220], {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineWidth: 0.55,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 0.55,
          stroked: true,
          filled: true,
          extruded: false,
          pickable: false,
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap, roadOverlayOpacity],
            getLineColor: [basemap, roadOverlayOpacity],
          },
        } as any)
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
            d.connected
              ? [45, 212, 191, 255]
              : d.kind === 'vertex'
                ? [255, 196, 84, 255]
                : [255, 255, 255, 245],
          getLineColor: (d) =>
            d.connected
              ? [9, 78, 73, 255]
              : d.kind === 'vertex'
                ? [72, 46, 14, 255]
                : [255, 178, 64, 255],
          getLineWidth: 2.5,
          getRadius: (d) => (d.kind === 'vertex' ? 10 : 8),
          radiusUnits: 'pixels',
          radiusMinPixels: 8,
          radiusMaxPixels: 13,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 90],
          parameters: { depthTest: false } as unknown as never,
        })
      );
      if (midpointHandles.length > 0) {
        layers.push(
          new TextLayer<RoadDraftHandle>({
            id: 'road-draft-midpoint-labels',
            data: midpointHandles,
            getPosition: (d) => d.position,
            getText: () => '+',
            getSize: 14,
            sizeUnits: 'pixels',
            getColor: [41, 48, 63, 255],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            billboard: true,
            pickable: false,
            parameters: { depthTest: false } as unknown as never,
          })
        );
      }
    }

    if (roadDraft && visibleSnapCandidates.length > 0) {
      layers.push(
        new ScatterplotLayer<RoadSnapCandidate>({
          id: 'road-connection-snap-targets',
          data: visibleSnapCandidates,
          getPosition: (candidate) => candidate.position,
          getFillColor: [20, 184, 166, 30],
          getLineColor: [45, 212, 191, 220],
          getLineWidth: 2,
          getRadius: 7,
          radiusUnits: 'pixels',
          radiusMinPixels: 7,
          radiusMaxPixels: 9,
          stroked: true,
          filled: true,
          pickable: false,
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
    if (
      renderedOsmRoads.length > 0 &&
      !renderedOsm2StreetsResult?.lanes.features.length
    ) {
      const handleOsmRoadClick = (info: PickingInfo<OsmRoadFeature>) => {
        if (roadSelectionEnabled && info.object) onOsmRoadSelect?.(info.object);
      };

      layers.push(
        new PathLayer<OsmRoadFeature>({
          id: 'osm-road-reference',
          data: renderedOsmRoads,
          getPath: (d) => d.path,
          getColor: (d) =>
            roadOverlayColor(
              d.id === selectedOsmRoadId
                ? [255, 170, 40, 255]
                : [250, 210, 80, 220],
              {
                basemap,
                underground: d.inferredDraft.vertical?.placement === 'underground',
                opacity: roadOverlayOpacity,
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
            getColor: [selectedOsmRoadId, basemap, roadOverlayOpacity],
            getWidth: [selectedOsmRoadId],
          },
        }),
        new PathLayer<OsmRoadFeature>({
          id: 'osm-road-reference-hit-area',
          data: renderedOsmRoads,
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
          pickable: roadSelectionEnabled,
          autoHighlight: true,
          highlightColor: [255, 170, 40, 70],
          parameters: { depthTest: false } as unknown as never,
          onClick: handleOsmRoadClick,
        })
      );
    }

    if (renderedOsmPointFeatures.length > 0) {
      const trafficSigns = renderedOsmPointFeatures.filter(
        (feature) => feature.kind === 'traffic_sign'
      );
      const pointMarkers = renderedOsmPointFeatures.filter(
        (feature) => feature.kind !== 'traffic_sign'
      );
      layers.push(
        new ScatterplotLayer<OsmPointFeature>({
          id: 'osm-street-point-features',
          data: pointMarkers,
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
      if (trafficSigns.length > 0) {
        layers.push(
          new IconLayer<OsmPointFeature>({
            id: 'osm-traffic-sign-features',
            data: trafficSigns,
            getPosition: (feature) => feature.position,
            getIcon: osmTrafficSignIcon,
            getSize: 24,
            sizeUnits: 'pixels',
            sizeMinPixels: 18,
            sizeMaxPixels: 30,
            billboard: true,
            pickable: false,
            parameters: { depthTest: false } as unknown as never,
          })
        );
      }
    }

    // Preview for the in-progress new building (mesh) OR a pending transform (polygon).
    if (preview?.mesh && preview.mesh.positions.length > 0) {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: 'new-building-preview-mesh',
          data: [{ position: [0, 0, 0] }],
          getPosition: (d) => d.position,
          // getColor is a single tint applied per instance; warm orange reads
          // as pending / unsaved against both map and satellite imagery.
          getColor: [255, 180, 80, 230],
          mesh: {
            attributes: {
              positions: { value: preview.mesh.positions, size: 3 },
            },
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
    if (renderedZones.length > 0) {
      layers.push(
        new PolygonLayer<ParcelZone>({
          id: 'planning-polygons',
          data: renderedZones,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => d.color,
          getLineColor: (d) => [d.color[0], d.color[1], d.color[2], 230],
          getLineWidth: 2,
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
          extruded: false,
          pickable: planningSelectionEnabled,
          parameters: { depthTest: false } as unknown as never,
          onClick: (info: PickingInfo<ParcelZone>) => {
            if (planningSelectionEnabled && info.object) {
              onZoneSelect?.(info.object);
            }
          },
        })
      );
    }

    overlay.setProps({ layers });
  }, [
    footprints,
    renderedFootprints,
    renderedRoadAreas,
    blockFootprints,
    renderedZones,
    detailMesh,
    selectedId,
    onSelect,
    zoom,
    preview,
    multiSelectedIds,
    filteredIds,
    onZoneSelect,
    roadPreviewAreas,
    roadVisuals,
    roadDraft,
    onRoadDraftChange,
    drawMode,
    roadFitConflicts,
    selectedRoadAreaId,
    onRoadAreaSelect,
    renderedOsmRoads,
    renderedOsmPointFeatures,
    selectedOsmRoadId,
    onOsmRoadSelect,
    renderedOsm2StreetsResult,
    osm2streetsBbox,
    osm2streetsSelection,
    highlightedOsm2StreetsRoadIds,
    onOsm2StreetsSelect,
    basemap,
    roadOverlayOpacity,
    roadSnapCandidates,
    editFocusBbox,
    mapColorMode,
    buildingSelectionEnabled,
    roadSelectionEnabled,
    roadWorkspaceOpen,
    planningSelectionEnabled,
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
      if (e.key === 'Enter' && drawRef.current) {
        const finished =
          drawMode === 'road-line'
            ? finishCurrentRoadDraw()
            : drawMode === 'polygon'
              ? finishCurrentBuildingDraw()
              : false;
        if (finished) {
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
  }, [
    drawMode,
    onFootprintDrawn,
    onRoadLineDrawn,
    onDrawCanceled,
    footprints,
    finishCurrentRoadDraw,
    finishCurrentBuildingDraw,
  ]);

  useEffect(() => {
    if (finishRoadDrawToken <= 0 || drawMode !== 'road-line') return;
    const ok = finishCurrentRoadDraw();
    if (!ok) {
      setDrawWarning('Road centerline needs at least two points before it can be finished.');
      window.setTimeout(() => setDrawWarning(null), 2500);
    }
  }, [finishRoadDrawToken, drawMode, finishCurrentRoadDraw]);

  useEffect(() => {
    if (drawMode === 'road-line') setDrawWarning(null);
  }, [drawMode]);

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
    if (!map || renderedZones.length === 0 || !onZoneSelect || !planningSelectionEnabled) return;

    const handler = (e: maplibregl.MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const zone =
        findZoneForPoint(renderedZones, point) ??
        findNearestZoneForPoint(renderedZones, point, 150);
      if (zone) onZoneSelect(zone);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [renderedZones, onZoneSelect, planningSelectionEnabled]);

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
        <div className="building-draw-guide" role="status">
          <div>
            <b>Draw the building outline</b>
            <span>Tap at least 3 corners. Tap the first point again, or use the button.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!finishCurrentBuildingDraw()) {
                setDrawWarning('Add at least three building corners before finishing.');
                window.setTimeout(() => setDrawWarning(null), 2500);
              }
            }}
          >Use outline</button>
          <button
            type="button"
            className="is-cancel"
            onClick={() => {
              drawRef.current?.stop();
              drawRef.current = null;
              onDrawCanceled?.();
            }}
          >Cancel</button>
        </div>
      )}
      {drawMode === 'road-line' && (
        <div className="road-draw-guide" role="status">
          <div className="road-draw-guide__title">Draw the road centreline</div>
          <div>Tap along the road, including extra points wherever it bends.</div>
          <div className="road-draw-guide__keys">
            Use the large <b>Finish road</b> button or press <kbd>Enter</kbd>. <kbd>Esc</kbd>{' '}
            cancels.
          </div>
        </div>
      )}
      {roadDraft && drawMode !== 'road-line' && (
        <>
          <RoadHandleGuide draft={roadDraft} />
          {onRoadDraftChange && (
            <MapRoadCrossSection draft={roadDraft} onChange={onRoadDraftChange} />
          )}
        </>
      )}
      {(drawWarning ?? warning) && (
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
          {drawWarning ?? warning}
        </div>
      )}
      <div
        className="map-color-control"
        style={{
          top: (drawWarning ?? warning) ? 58 : 12,
          left: layerControlOpen ? 354 : 202,
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
      <MapLayerControl
        open={layerControlOpen}
        onOpenChange={setLayerControlOpen}
        basemap={basemap}
        onBasemapChange={onBasemapChange}
        satelliteOpacity={satelliteOpacity}
        onSatelliteOpacityChange={onSatelliteOpacityChange}
        roadOverlayOpacity={roadOverlayOpacity}
        onRoadOverlayOpacityChange={onRoadOverlayOpacityChange}
        detailLabel={
          detailMesh
            ? `Source LoD ${detailMesh.maxLod?.toFixed(1) ?? '?'} · ${detailMesh.objectCount} nearby objects · ${
                detailMesh.texturedSurfaceCount > 0
                  ? detailMesh.explicitOpeningSurfaceCount > 0
                    ? `${detailMesh.explicitOpeningSurfaceCount} explicit window/door surfaces`
                    : 'photo-textured facades; windows/doors are painted, not editable geometry'
                  : 'semantic surface colors'
              }`
            : zoom >= BUILDING_DETAIL_MIN_ZOOM
              ? 'Footprint detail (source mesh unavailable)'
              : 'Overview geometry · close detail begins gradually at zoom 14.75'
        }
        focusActive={!!editFocusBbox}
        obscuredByInspector={roadWorkspaceOpen || !!selectedId}
      />
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
        borderRadius: 8,
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-dim)',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        minHeight: 38,
        padding: '8px 12px',
      }}
    >
      {children}
    </button>
  );
}

function RoadHandleGuide({ draft }: { draft: RoadDraft }) {
  const connections = draft.sections.reduce(
    (count, section) =>
      count + Number(!!section.connections?.start) + Number(!!section.connections?.end),
    0
  );
  const smooth = draft.sections.some((section) => section.curve?.mode !== 'straight');
  return (
    <div className="road-handle-guide" data-testid="road-handle-guide">
      <div className="road-handle-guide__title">
        Shape this {smooth ? 'curved' : 'straight'} road
        {connections > 0 && <span>{connections} connected</span>}
      </div>
      <div className="road-handle-guide__items">
        <span><i className="road-guide-dot road-guide-dot--anchor" />Drag yellow to bend</span>
        <span><i className="road-guide-dot road-guide-dot--add">+</i>Tap white to add a bend</span>
        <span><i className="road-guide-dot road-guide-dot--snap" />Drag an end onto teal to connect</span>
      </div>
    </div>
  );
}

function MapRoadCrossSection({
  draft,
  onChange,
}: {
  draft: RoadDraft;
  onChange: (draft: RoadDraft) => void;
}) {
  const [activeBandIndex, setActiveBandIndex] = useState(0);
  const [newBandKind, setNewBandKind] = useState<RoadBandKind>('car_lane');
  const section = draft.sections[0];
  const effectiveBandIndex = Math.min(
    activeBandIndex,
    Math.max(0, (section?.bands.length ?? 1) - 1)
  );
  const activeBand = section?.bands[effectiveBandIndex];
  if (!section || !activeBand) return null;

  const patchActiveBand = (patch: Partial<typeof activeBand>) => {
    onChange({
      ...draft,
      sections: draft.sections.map((candidate, sectionIndex) =>
        sectionIndex === 0
          ? {
              ...candidate,
              bands: candidate.bands.map((band, bandIndex) =>
                bandIndex === effectiveBandIndex ? { ...band, ...patch } : band
              ),
            }
          : candidate
      ),
    });
  };

  const replaceBands = (bands: typeof section.bands) => {
    onChange({
      ...draft,
      sections: draft.sections.map((candidate, sectionIndex) =>
        sectionIndex === 0 ? { ...candidate, bands } : candidate
      ),
    });
  };

  const directions = ['forward', 'backward', 'both', 'none'] as const;

  return (
    <section className="map-road-cross-section" aria-label="Road cross-section quick editor">
      <header>
        <div><b>Road on the map</b><span>Tap a band, then adjust it with large controls.</span></div>
        <span>{section.bands.reduce((sum, band) => sum + band.widthM, 0).toFixed(1)} m total</span>
      </header>
      <div className="map-road-cross-section__bands">
        {section.bands.map((band, index) => {
          const color = roadBandFillColor(band.kind, band.sourceType);
          const lightBand = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114 > 155;
          return (
            <button
              type="button"
              key={`${band.id ?? band.kind}-${index}`}
              className={index === effectiveBandIndex ? 'is-active' : ''}
              style={{
                flexGrow: Math.max(0.75, band.widthM),
                background: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`,
                color: lightBand ? '#17202a' : '#ffffff',
                textShadow: lightBand ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.75)',
              }}
              onClick={() => setActiveBandIndex(index)}
              aria-pressed={index === effectiveBandIndex}
              aria-label={`Band ${index + 1}: ${mapRoadBandLabel(band.kind, band.sourceType)}, ${band.widthM.toFixed(2)} metres`}
            >
              <b>{mapRoadBandLabel(band.kind, band.sourceType)}</b>
              <span>{band.widthM.toFixed(1)} m · {roadDirectionGlyph(band.direction)}</span>
            </button>
          );
        })}
      </div>
      <div className="map-road-cross-section__actions">
        <div><b>{mapRoadBandLabel(activeBand.kind, activeBand.sourceType)}</b><span>band {effectiveBandIndex + 1}</span></div>
        <label className="map-road-cross-section__field">
          <span>Type</span>
          <select
            value={activeBand.sourceType ? '__source__' : activeBand.kind}
            onChange={(event) => {
              const kind = event.target.value as RoadBandKind;
              patchActiveBand({ kind, sourceType: undefined, direction: kind === 'car_lane' || kind === 'bike_lane' ? 'forward' : 'none' });
            }}
          >
            {activeBand.sourceType && <option value="__source__" disabled>{mapRoadBandLabel(activeBand.kind, activeBand.sourceType)} (source)</option>}
            {MAP_ROAD_BAND_KINDS.map((kind) => <option key={kind} value={kind}>{mapRoadBandLabel(kind)}</option>)}
          </select>
        </label>
        <label className="map-road-cross-section__field">
          <span>Surface</span>
          <select value={activeBand.surface ?? 'asphalt'} onChange={(event) => patchActiveBand({ surface: event.target.value })}>
            <option value="asphalt">Asphalt</option>
            <option value="concrete">Concrete</option>
            <option value="paving_stones">Paving stones</option>
            <option value="compacted">Compacted</option>
            <option value="gravel">Gravel</option>
            <option value="grass">Grass</option>
          </select>
        </label>
        <div className="map-road-cross-section__width">
        <button
          type="button"
          onClick={() => patchActiveBand({ widthM: Math.max(0.4, activeBand.widthM - 0.25) })}
          aria-label="Make selected road band narrower"
        >−</button>
        <output>{activeBand.widthM.toFixed(2)} m</output>
        <button
          type="button"
          onClick={() => patchActiveBand({ widthM: Math.min(12, activeBand.widthM + 0.25) })}
          aria-label="Make selected road band wider"
        >+</button>
        </div>
        <div className="map-road-cross-section__directions" role="group" aria-label="Selected band direction">
          {directions.map((direction) => (
            <button key={direction} type="button" className={(activeBand.direction ?? 'none') === direction ? 'is-active' : ''} onClick={() => patchActiveBand({ direction })}>
              {roadDirectionGlyph(direction)} {direction}
            </button>
          ))}
        </div>
        <div className="map-road-cross-section__order">
        <button type="button" disabled={effectiveBandIndex === 0} onClick={() => {
          const bands = section.bands.slice();
          [bands[effectiveBandIndex - 1], bands[effectiveBandIndex]] = [bands[effectiveBandIndex], bands[effectiveBandIndex - 1]];
          setActiveBandIndex(effectiveBandIndex - 1);
          replaceBands(bands);
        }}>Move left</button>
        <button type="button" disabled={effectiveBandIndex === section.bands.length - 1} onClick={() => {
          const bands = section.bands.slice();
          [bands[effectiveBandIndex], bands[effectiveBandIndex + 1]] = [bands[effectiveBandIndex + 1], bands[effectiveBandIndex]];
          setActiveBandIndex(effectiveBandIndex + 1);
          replaceBands(bands);
        }}>Move right</button>
        <button type="button" className="is-destructive" disabled={section.bands.length <= 1} onClick={() => {
          replaceBands(section.bands.filter((_, index) => index !== effectiveBandIndex));
          setActiveBandIndex(Math.max(0, effectiveBandIndex - 1));
        }}>Remove</button>
        </div>
      </div>
      <div className="map-road-cross-section__add">
        <label><span>Add a band</span><select value={newBandKind} onChange={(event) => setNewBandKind(event.target.value as RoadBandKind)}>{MAP_ROAD_BAND_KINDS.map((kind) => <option key={kind} value={kind}>{mapRoadBandLabel(kind)}</option>)}</select></label>
        <button type="button" onClick={() => {
          replaceBands([...section.bands, { kind: newBandKind, widthM: MAP_ROAD_DEFAULT_WIDTH[newBandKind], direction: newBandKind === 'car_lane' || newBandKind === 'bike_lane' ? 'forward' : 'none', surface: newBandKind === 'green' ? 'grass' : 'asphalt' }]);
          setActiveBandIndex(section.bands.length);
        }}>Add band</button>
      </div>
    </section>
  );
}

const MAP_ROAD_BAND_KINDS: RoadBandKind[] = ['car_lane', 'bike_lane', 'sidewalk', 'parking', 'median', 'green'];
const MAP_ROAD_DEFAULT_WIDTH: Record<RoadBandKind, number> = {
  car_lane: 3,
  bike_lane: 1.8,
  sidewalk: 1.8,
  parking: 2.3,
  median: 0.6,
  green: 1.5,
};

function mapRoadBandLabel(kind: string, sourceType?: string): string {
  const key = (sourceType ?? kind).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.includes('sidewalk')) return 'Sidewalk';
  if (key.includes('footway')) return 'Footway';
  if (key.includes('bike') || key.includes('bicy') || key.includes('cycle')) return 'Bike';
  if (key.includes('parking')) return 'Parking';
  if (key.includes('bus')) return 'Bus';
  if (key.includes('rail') || key.includes('tram')) return 'Rail';
  if (key.includes('buffer') || key.includes('median')) return 'Buffer';
  if (key.includes('green') || key.includes('verge')) return 'Green';
  if (kind === 'bike_lane') return 'Bike';
  if (kind === 'sidewalk') return 'Sidewalk';
  if (kind === 'parking') return 'Parking';
  if (kind === 'median') return 'Buffer';
  if (kind === 'green') return 'Green';
  return 'Car lane';
}

function roadDirectionGlyph(direction?: string): string {
  if (direction === 'forward') return '→';
  if (direction === 'backward') return '←';
  if (direction === 'both') return '↔';
  return '—';
}

function MapLayerControl({
  open,
  onOpenChange,
  basemap,
  onBasemapChange,
  satelliteOpacity,
  onSatelliteOpacityChange,
  roadOverlayOpacity,
  onRoadOverlayOpacityChange,
  detailLabel,
  focusActive,
  obscuredByInspector,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basemap: 'map' | 'satellite';
  onBasemapChange?: (basemap: 'map' | 'satellite') => void;
  satelliteOpacity: number;
  onSatelliteOpacityChange?: (opacity: number) => void;
  roadOverlayOpacity: number;
  onRoadOverlayOpacityChange?: (opacity: number) => void;
  detailLabel: string;
  focusActive: boolean;
  obscuredByInspector: boolean;
}) {
  return (
    <section
      className={`map-layer-control ${open ? 'is-open' : ''} ${
        obscuredByInspector ? 'is-obscured-by-inspector' : ''
      }`}
      aria-label="Map layers"
    >
      <button
        type="button"
        className="map-layer-control__toggle"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? 'Collapse map layers' : 'Open map layers'}
      >
        <Layers3 aria-hidden="true" />
        <span>Map layers</span>
      </button>
      {open && (
        <div className="map-layer-control__body">
          <div className="map-layer-control__segment" role="group" aria-label="Basemap">
            <button
              type="button"
              className={basemap === 'map' ? 'is-active' : ''}
              onClick={() => onBasemapChange?.('map')}
            >
              <MapIcon aria-hidden="true" /> Map
            </button>
            <button
              type="button"
              className={basemap === 'satellite' ? 'is-active' : ''}
              onClick={() => onBasemapChange?.('satellite')}
            >
              <Satellite aria-hidden="true" /> Satellite
            </button>
          </div>
          <LayerOpacityControl
            label="Satellite image"
            value={satelliteOpacity}
            disabled={basemap !== 'satellite'}
            onChange={onSatelliteOpacityChange}
          />
          <LayerOpacityControl
            label="Road surfaces"
            value={roadOverlayOpacity}
            onChange={onRoadOverlayOpacityChange}
          />
          <div className="map-layer-control__status">
            <span>{detailLabel}</span>
            {focusActive && <b>Editing focus on</b>}
          </div>
        </div>
      )}
    </section>
  );
}

function LayerOpacityControl({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
}) {
  return (
    <label className={`map-layer-control__slider ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <output>{Math.round(value * 100)}%</output>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        aria-label={`${label} opacity`}
        onInput={(event) => onChange?.(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function nearestRoadSnapCandidate(
  map: maplibregl.Map,
  candidates: RoadSnapCandidate[],
  activeSectionId: string,
  pointer: [number, number],
  radiusPixels: number
): RoadSnapCandidate | null {
  let nearest: RoadSnapCandidate | null = null;
  let nearestDistance = radiusPixels;
  for (const candidate of candidates) {
    if (
      candidate.connection.target === 'draft' &&
      candidate.connection.targetSectionId === activeSectionId
    ) {
      continue;
    }
    const projected = map.project({ lng: candidate.position[0], lat: candidate.position[1] });
    const distance = Math.hypot(projected.x - pointer[0], projected.y - pointer[1]);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

type LngLatBbox = [number, number, number, number];
type LngLatCoordinate = readonly [number, number, ...number[]];

function pointsBbox(points: ReadonlyArray<LngLatCoordinate>): LngLatBbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

function expandLngLatBbox(bbox: LngLatBbox | null, padding: number): LngLatBbox | null {
  return bbox
    ? [bbox[0] - padding, bbox[1] - padding, bbox[2] + padding, bbox[3] + padding]
    : null;
}

function pointInsideBbox(point: LngLatCoordinate, bbox: LngLatBbox): boolean {
  return (
    point[0] >= bbox[0] &&
    point[0] <= bbox[2] &&
    point[1] >= bbox[1] &&
    point[1] <= bbox[3]
  );
}

function approximateLngLatDistanceMeters(
  a: LngLatCoordinate,
  b: LngLatCoordinate
): number {
  const latitudeRadians = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = (a[0] - b[0]) * 111_320 * Math.max(0.01, Math.cos(latitudeRadians));
  const dy = (a[1] - b[1]) * 111_320;
  return Math.hypot(dx, dy);
}

function polygonIntersectsBbox(
  points: ReadonlyArray<LngLatCoordinate>,
  bbox: LngLatBbox
): boolean {
  const polygonBbox = pointsBbox(points);
  return !!polygonBbox && bboxesIntersect(polygonBbox, bbox);
}

function lineIntersectsBbox(points: ReadonlyArray<LngLatCoordinate>, bbox: LngLatBbox): boolean {
  const lineBbox = pointsBbox(points);
  return !!lineBbox && bboxesIntersect(lineBbox, bbox);
}

function bboxesIntersect(a: LngLatBbox, b: LngLatBbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function squaredDistanceToPolygon(
  point: [number, number],
  polygon: ReadonlyArray<LngLatCoordinate>
): number {
  if (polygon.length === 0) return Infinity;
  let best = Infinity;
  for (const coordinate of polygon) {
    best = Math.min(
      best,
      (coordinate[0] - point[0]) ** 2 + (coordinate[1] - point[1]) ** 2
    );
  }
  return best;
}

function filterGeoJsonToBbox<T extends { features: any[] }>(
  collection: T,
  bbox: LngLatBbox
): T {
  return {
    ...collection,
    features: collection.features.filter((feature) => {
      const geometryBbox = coordinateTreeBbox(feature?.geometry?.coordinates);
      return geometryBbox ? bboxesIntersect(geometryBbox, bbox) : false;
    }),
  };
}

function coordinateTreeBbox(value: unknown): LngLatBbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (
      node.length >= 2 &&
      typeof node[0] === 'number' &&
      typeof node[1] === 'number'
    ) {
      west = Math.min(west, node[0]);
      south = Math.min(south, node[1]);
      east = Math.max(east, node[0]);
      north = Math.max(north, node[1]);
      return;
    }
    for (const child of node) visit(child);
  };
  visit(value);
  return Number.isFinite(west) ? [west, south, east, north] : null;
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
