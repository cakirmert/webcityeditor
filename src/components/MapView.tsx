import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Tile3DLayer } from '@deck.gl/geo-layers';
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
import {
  activeMetricCrsForCityJson,
  applyVertexTransform,
  detectCrs,
  projectToWgs84,
} from '../lib/projection';
import {
  clampFootprintsToTerrain,
  extractFootprints,
  type Footprint,
} from '../lib/footprints';
import { tintByRoofType, tintByUsage, usageRgb } from '../lib/footprint-tint';
import { findNearestZoneForPoint, findZoneForPoint, type ParcelZone } from '../lib/zoning';
import {
  deriveEditableRoadDraftFromAreas,
  type RoadLaneMovement,
  OsmPointFeature,
  OsmRoadFeature,
  RoadArea,
  RoadBand,
  RoadBandKind,
  RoadDraft,
  RoadEndpointConnection,
  RoadSectionDraft,
} from '../lib/transportation';
import { validateRoadFit, type RoadFitConflict } from '../lib/road-fit';
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
  compatibleRoadLaneSnapCandidates,
  connectRoadLanes,
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  insertRoadDraftPoint,
  roadLaneEndpointPosition,
  updateRoadDraftPoint,
  type RoadDraftHandle,
  type RoadDraftPath,
  type RoadLaneSnapCandidate,
  type RoadSnapCandidate,
} from '../lib/road-draft-edit';
import {
  connectManualRoadLaneMovement,
  isRoadBandConnectable,
  removeRoadMovement,
  roadBandCanArriveAtEndpoint,
  roadBandModes,
  updateRoadMovementStatus,
} from '../lib/road-movements';
import { osmTrafficSignIcon } from '../lib/osm-street-point-style';
import {
  buildCityJsonMapMesh,
  canonicalCityJsonMapOrigin,
} from '../lib/cityjson-map-mesh';
import {
  rootBuildingObjectId,
  selectBuildingDetailObjectIds,
} from '../lib/building-detail-selection';
import { buildRoadVisuals } from '../lib/road-visuals';
import {
  BUILDING_BLOCK_FULL_ZOOM,
  BUILDING_BLOCK_MIN_ZOOM,
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MIN_ZOOM,
  BUILDING_LOD3_MIN_ZOOM,
  HAMBURG_TREE_MIN_ZOOM,
  buildingDetailObjectLimit,
  smoothZoomStep,
} from '../lib/lod-transition';
import {
  parseHamburgCityTrees,
  TREE_CROWN_FORMS,
  TREE_CROWN_MESHES,
  TREE_TRUNK_MESH,
  treeCrownColor,
  treeCrownForm,
  treeCrownScale,
  treeCrownTranslation,
  treePositionOnTerrain,
  treeTrunkScale,
  type HamburgCityTree,
} from '../lib/hamburg-trees';
import { basemapLayerComposition, type BasemapMode } from '../lib/basemap';
import {
  HAMBURG_UNTEXTURED_LOD3_TILESET_URL,
  isHamburgOfficialBuildingId,
} from '../lib/hamburg-lod3-tiles';
import {
  hamburgTerrainSurfaceUrl,
  hamburgTerrainSurfaceSelection,
  hamburgTerrainTilesForView,
  loadHamburgTerrainTile,
  rememberHamburgTerrainTiles,
  sampleHamburgTerrainElevation,
  type HamburgTerrainTile,
} from '../lib/hamburg-terrain';
import {
  Bike,
  BusFront,
  CarFront,
  CircleParking,
  Footprints,
  Layers3,
  Map as MapIcon,
  Satellite,
  TrainFront,
} from 'lucide-react';

/** Zoom stages keep LoD0, source LoD2, and close LoD3 (optionally textured) distinct. */
const DATA_FIT_PADDING = 56;
const DATA_FIT_MAX_ZOOM = 14.25;
const ROAD_DATA_FIT_MAX_ZOOM = 18;
const OSM_ROAD_HIT_WIDTH_PIXELS = 20;
const DEFAULT_INITIAL_ZOOM = 12;
const EDIT_FOCUS_PADDING_DEGREES = 0.0038;
const ROAD_SNAP_RADIUS_PIXELS = 30;
const ROAD_CONNECTION_HANDLE_OFFSET_PIXELS = 23;
const HAMBURG_CITY_CENTER_TREES_URL = 'data/hamburg/hamburg-city-center-trees.json';

interface TerrainSurfaceTextures {
  basemap: BasemapMode;
  images: Map<string, HTMLImageElement>;
}

function loadTerrainSurfaceImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Terrain basemap image failed: ${url}`));
    image.src = url;
  });
}

interface RoadConnectionHandle extends RoadDraftHandle {
  endpoint: 'start' | 'end';
  anchorPosition: [number, number];
  bandIndex: number;
  bandId?: string;
  mode: string;
}

interface RoadConnectionDragPreview {
  from: [number, number];
  to: [number, number];
  snapped: boolean;
  candidateId?: string;
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
  basemap: BasemapMode,
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
  basemap: BasemapMode,
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
  basemap: BasemapMode,
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
    groundElevation?: number;
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
  /** Building objects that must win the close-detail budget after an edit. */
  priorityBuildingIds?: ReadonlySet<string> | null;
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
  basemap?: BasemapMode;
  onBasemapChange?: (basemap: BasemapMode) => void;
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
  selectedRoadBand?: { sectionId: string; bandIndex: number } | null;
  onSelectedRoadBandChange?: (
    selection: { sectionId: string; bandIndex: number } | null
  ) => void;
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
 *   - deck.gl  = footprint/block context plus a camera-independent local mesh
 *               built directly from the selected CityJSON LoD. The same mesh
 *               owns semantic and photo-textured surfaces, so edits never
 *               disappear behind an unrelated streamed representation.
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
  priorityBuildingIds = null,
  onPlacementClick,
  onViewportChange,
  dragTransformId = null,
  onDragMove,
  multiSelectedIds = null,
  zones = [],
  onZoneSelect,
  basemap = 'topplus',
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
  selectedRoadBand,
  onSelectedRoadBandChange,
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
    mode: 'shape' | 'connection';
    sectionId: string;
    pointIndex: number;
    endpoint?: 'start' | 'end';
    bandIndex?: number;
    anchorPosition?: [number, number];
    snapCandidate?: RoadLaneSnapCandidate | null;
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
  const treeLoadStartedRef = useRef(false);
  const [hamburgTrees, setHamburgTrees] = useState<HamburgCityTree[] | null>(null);
  const [treeDataError, setTreeDataError] = useState<string | null>(null);
  const [mapColorMode, setMapColorMode] = useState<'roof' | 'usage'>('roof');
  const [texturesEnabled, setTexturesEnabled] = useState(true);
  const [hamburgLod3Status, setHamburgLod3Status] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [terrainTiles, setTerrainTiles] = useState<HamburgTerrainTile[]>([]);
  const [terrainStatus, setTerrainStatus] = useState<
    'idle' | 'loading' | 'ready' | 'partial' | 'error'
  >('idle');
  const [terrainSurfaceTextures, setTerrainSurfaceTextures] =
    useState<TerrainSurfaceTextures>({ basemap, images: new Map() });
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [detailFocusPoint, setDetailFocusPoint] = useState<[number, number] | null>(null);
  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [roadConnectionDragPreview, setRoadConnectionDragPreview] =
    useState<RoadConnectionDragPreview | null>(null);
  const [activeRoadConnectionEndpoint, setActiveRoadConnectionEndpoint] = useState<{
    sectionId: string;
    endpoint: 'start' | 'end';
    bandIndex: number;
  } | null>(null);
  const [hoveredRoadSnapCandidateId, setHoveredRoadSnapCandidateId] = useState<string | null>(null);
  const [internalSelectedDraftBand, setInternalSelectedDraftBand] = useState<{
    sectionId: string;
    bandIndex: number;
  } | null>(null);
  const selectedDraftBand = selectedRoadBand === undefined
    ? internalSelectedDraftBand
    : selectedRoadBand;
  const setSelectedDraftBand = useCallback(
    (selection: { sectionId: string; bandIndex: number } | null) => {
      if (selectedRoadBand === undefined) setInternalSelectedDraftBand(selection);
      onSelectedRoadBandChange?.(selection);
    },
    [onSelectedRoadBandChange, selectedRoadBand]
  );

  useEffect(() => {
    if (!roadDraft) setSelectedDraftBand(null);
    else if (!selectedDraftBand || !roadDraft.sections.some((section) => section.id === selectedDraftBand.sectionId && !!section.bands[selectedDraftBand.bandIndex])) {
      const first = roadDraft.sections[0];
      setSelectedDraftBand(first?.bands.length ? { sectionId: first.id, bandIndex: 0 } : null);
    }
  }, [roadDraft, selectedDraftBand]);

  useEffect(() => {
    setActiveRoadConnectionEndpoint((current) => {
      if (!roadDraft) return null;
      if (
        current &&
        roadDraft.sections.some(
          (section) =>
            section.id === current.sectionId &&
            section.centerlineWgs84.length >= 2 &&
            !!section.bands[current.bandIndex] &&
            roadBandCanArriveAtEndpoint(
              section.bands[current.bandIndex],
              current.endpoint
            )
        )
      ) {
        return current;
      }
      for (const section of roadDraft.sections) {
        if (section.centerlineWgs84.length < 2) continue;
        for (const endpoint of ['start', 'end'] as const) {
          const bandIndex = section.bands.findIndex((band) =>
            roadBandCanArriveAtEndpoint(band, endpoint)
          );
          if (bandIndex >= 0) return { sectionId: section.id, endpoint, bandIndex };
        }
      }
      return null;
    });
  }, [roadDraft]);

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

  useEffect(() => {
    if (zoom < HAMBURG_TREE_MIN_ZOOM || treeLoadStartedRef.current) return;
    treeLoadStartedRef.current = true;
    void fetch(HAMBURG_CITY_CENTER_TREES_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((value) => {
        setHamburgTrees(parseHamburgCityTrees(value));
        setTreeDataError(null);
      })
      .catch((error) => {
        setTreeDataError(error instanceof Error ? error.message : String(error));
      });
  }, [zoom]);

  const terrainZoomBucket = Math.floor(zoom);
  const terrainTileDescriptors = useMemo(
    () => hamburgTerrainTilesForView(viewportBbox, terrainZoomBucket),
    [terrainZoomBucket, viewportBbox]
  );
  const terrainSurfaceRequestKey = useMemo(
    () => `${basemap}:${terrainTileDescriptors.map((descriptor) => descriptor.key).join('|')}`,
    [basemap, terrainTileDescriptors]
  );
  useEffect(() => {
    let canceled = false;
    if (terrainTileDescriptors.length === 0) {
      setTerrainTiles([]);
      rememberHamburgTerrainTiles([]);
      setTerrainStatus('idle');
      return () => {
        canceled = true;
      };
    }

    setTerrainStatus('loading');
    void Promise.allSettled(terrainTileDescriptors.map(loadHamburgTerrainTile)).then((results) => {
      if (canceled) return;
      const loaded = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      setTerrainTiles(loaded);
      rememberHamburgTerrainTiles(loaded);
      setTerrainStatus(
        loaded.length === terrainTileDescriptors.length
          ? 'ready'
          : loaded.length > 0
            ? 'partial'
            : 'error'
      );
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        console.warn(
          `Hamburg DGM terrain tile failed: ${
            failed.reason instanceof Error ? failed.reason.message : String(failed.reason)
          }`
        );
      }
    });
    return () => {
      canceled = true;
    };
  }, [terrainTileDescriptors]);

  useEffect(() => {
    let canceled = false;
    const requestedBasemap = basemap;
    // Remove textures from the previous zoom/mode immediately. Until the
    // selected terrain images are ready, MapLibre's already-selected raster
    // remains visible instead of a stale TopPlus or white mesh.
    setTerrainSurfaceTextures({ basemap: requestedBasemap, images: new Map() });
    if (terrainTileDescriptors.length === 0) {
      return () => {
        canceled = true;
      };
    }

    void Promise.allSettled(
      terrainTileDescriptors.map(async (descriptor) => {
        const image = await loadTerrainSurfaceImage(
          hamburgTerrainSurfaceUrl(descriptor, requestedBasemap)
        );
        return [descriptor.key, image] as const;
      })
    ).then((results) => {
      if (canceled) return;
      const images = new Map<string, HTMLImageElement>();
      for (const result of results) {
        if (result.status === 'fulfilled') images.set(...result.value);
      }
      setTerrainSurfaceTextures({ basemap: requestedBasemap, images });
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        console.warn(
          failed.reason instanceof Error ? failed.reason.message : String(failed.reason)
        );
      }
    });
    return () => {
      canceled = true;
    };
  }, [terrainSurfaceRequestKey]);

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

  const groundedRenderedFootprints = useMemo(
    () => clampFootprintsToTerrain(
      renderedFootprints,
      (lngLat) => sampleHamburgTerrainElevation(terrainTiles, lngLat)
    ),
    [renderedFootprints, terrainTiles]
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

  const renderedHamburgTrees = useMemo(() => {
    if (!hamburgTrees || editFocusBbox || zoom < HAMBURG_TREE_MIN_ZOOM) return [];
    return viewportBbox
      ? hamburgTrees.filter((tree) =>
          pointInsideBbox([tree.position[0], tree.position[1]], viewportBbox)
        )
      : hamburgTrees;
  }, [editFocusBbox, hamburgTrees, viewportBbox, zoom]);

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
  const detailLod: 'lod2' | 'lod3' = zoom >= BUILDING_LOD3_MIN_ZOOM ? 'lod3' : 'lod2';
  const hamburgRemoteLod3Eligible = useMemo(
    () => Object.keys(cityjson.CityObjects).some(isHamburgOfficialBuildingId),
    [cityjson, reloadToken]
  );
  const hamburgRemoteLod3Active =
    hamburgRemoteLod3Eligible &&
    detailLod === 'lod3' &&
    !editFocusBbox;
  useEffect(() => {
    if (!hamburgRemoteLod3Active) {
      setHamburgLod3Status('idle');
    } else {
      setHamburgLod3Status((current) => current === 'ready' ? current : 'loading');
    }
  }, [hamburgRemoteLod3Active]);
  const treeDetailLabel = editFocusBbox
    ? 'street trees hidden while editing'
    : zoom < HAMBURG_TREE_MIN_ZOOM
      ? 'official street trees at zoom 16.5'
      : treeDataError
        ? 'street-tree data unavailable'
        : hamburgTrees
          ? `${renderedHamburgTrees.length} official street trees in view`
          : 'official street trees loading';
  const terrainDetailLabel = terrainStatus === 'ready'
    ? `Hamburg DGM terrain (${terrainTiles.length} tiles)`
    : terrainStatus === 'partial'
      ? `Hamburg DGM terrain (${terrainTiles.length} tiles; partial)`
      : terrainStatus === 'loading'
        ? 'Hamburg DGM terrain loading'
        : terrainStatus === 'error'
          ? 'Hamburg DGM terrain unavailable'
          : 'Hamburg DGM terrain outside this view';
  const detailScopeBbox = editFocusBbox ?? viewportBbox;
  const detailFocus = editFocusBbox
    ? [
        (editFocusBbox[0] + editFocusBbox[2]) / 2,
        (editFocusBbox[1] + editFocusBbox[3]) / 2,
      ] as [number, number]
    : detailFocusPoint;
  const detailOriginProjected = useMemo(
    () => {
      const origin = canonicalCityJsonMapOrigin(cityjson);
      return origin ? [origin[0], origin[1], 0] as [number, number, number] : null;
    },
    [cityjson, reloadToken]
  );
  const detailObjectIds = useMemo(() => {
    if (!detailEnabled || !detailScopeBbox) return null;
    const visible = renderedFootprints.filter((footprint) =>
      polygonIntersectsBbox(footprint.polygon, detailScopeBbox)
    );
    // getBounds() becomes strongly skewed toward the horizon on a pitched
    // camera. Prioritise a screen-derived near focus instead of the geographic
    // bbox centre, which previously produced a small distant cone of LoD2.
    const center: [number, number] = detailFocus ?? [
      (detailScopeBbox[0] + detailScopeBbox[2]) / 2,
      (detailScopeBbox[1] + detailScopeBbox[3]) / 2,
    ];
    visible.sort(
      (a, b) =>
        squaredDistanceToPolygon(center, a.polygon) - squaredDistanceToPolygon(center, b.polygon)
    );
    // More buildings switch to their highest source geometry progressively as
    // the view closes in. Each building swaps once; two LoDs are never drawn
    // on top of one another, avoiding z-fighting and doubled walls.
    const detailLimit = buildingDetailObjectLimit(detailOpacity);
    const priorityIds = new Set(priorityBuildingIds ?? []);
    const needsLocalDetail = (objectId: string): boolean => {
      if (!hamburgRemoteLod3Active) return true;
      const rootId = rootBuildingObjectId(cityjson, objectId);
      return !isHamburgOfficialBuildingId(rootId) ||
        priorityIds.has(objectId) ||
        priorityIds.has(rootId) ||
        (texturesEnabled && buildingHasSourceTextures(cityjson, rootId));
    };
    const selectedForLocalDetail = selectedId && needsLocalDetail(selectedId)
      ? selectedId
      : null;
    return selectBuildingDetailObjectIds(cityjson, {
      visibleObjectIds: visible
        .map((footprint) => footprint.parentId ?? footprint.id)
        .filter(needsLocalDetail),
      priorityObjectIds: [...priorityIds].filter(needsLocalDetail),
      selectedObjectId: selectedForLocalDetail,
      maxRootObjects: detailLimit,
    });
  }, [
    cityjson,
    detailEnabled,
    detailFocus,
    detailOpacity,
    detailScopeBbox,
    hamburgRemoteLod3Active,
    priorityBuildingIds,
    renderedFootprints,
    selectedId,
    texturesEnabled,
  ]);

  const detailObjectColors = useMemo(() => {
    if (mapColorMode !== 'usage' || !detailObjectIds) return undefined;
    const colors = new Map<string, readonly [number, number, number]>();
    for (const objectId of detailObjectIds) {
      const rootId = rootBuildingObjectId(cityjson, objectId);
      if (colors.has(rootId)) continue;
      const [red, green, blue] = usageRgb(cityjson.CityObjects[rootId]?.attributes?.function);
      colors.set(rootId, [red / 255, green / 255, blue / 255]);
    }
    return colors;
  }, [cityjson, detailObjectIds, mapColorMode]);

  const terrainGroundByRoot = useMemo(() => {
    const elevations = new Map<string, number>();
    for (const footprint of groundedRenderedFootprints) {
      const rootId = footprint.parentId ?? footprint.id;
      const ground = Math.min(...footprint.polygon.map((point) => point[2]));
      if (!Number.isFinite(ground)) continue;
      elevations.set(rootId, Math.min(elevations.get(rootId) ?? Infinity, ground));
    }
    return elevations;
  }, [groundedRenderedFootprints]);

  const detailMesh = useMemo(
    () =>
      detailObjectIds
        ? buildCityJsonMapMesh(cityjson, {
            objectIds: detailObjectIds,
            maxOutputVertices: 600_000,
            maxLod: detailLod === 'lod3' ? 3.9 : 2.9,
            groundElevationByObject: terrainGroundByRoot,
            // A LoD3-only asset is deliberately kept visible in the middle
            // tier. Honour the material preference whenever that source tier
            // is selected; ordinary LoD2 faces simply have no texture refs.
            texturesEnabled,
            objectColors: detailObjectColors,
            originProjected: detailOriginProjected ?? undefined,
          })
        : null,
    [
      cityjson,
      detailLod,
      detailObjectColors,
      detailObjectIds,
      detailOriginProjected,
      reloadToken,
      terrainGroundByRoot,
      texturesEnabled,
    ]
  );
  const drawnDetailRootIds = useMemo(
    () => new Set(detailMesh?.objectAnchors.map((anchor) => anchor.rootId) ?? []),
    [detailMesh]
  );
  const blockFootprints = useMemo(
    () =>
      (drawnDetailRootIds.size > 0 || hamburgRemoteLod3Active)
        ? groundedRenderedFootprints.filter(
            (footprint) => {
              const rootId = footprint.parentId ?? footprint.id;
              return !(hamburgRemoteLod3Active && isHamburgOfficialBuildingId(rootId)) &&
                !drawnDetailRootIds.has(rootId);
            }
          )
        : groundedRenderedFootprints,
    [drawnDetailRootIds, groundedRenderedFootprints, hamburgRemoteLod3Active]
  );
  const priorityRootIds = useMemo(() => {
    const roots = new Set<string>();
    for (const objectId of priorityBuildingIds ?? []) {
      if (cityjson.CityObjects[objectId]) roots.add(rootBuildingObjectId(cityjson, objectId));
    }
    return roots;
  }, [cityjson, priorityBuildingIds, reloadToken]);
  const priorityBlockFootprints = useMemo(
    () => blockFootprints.filter((footprint) =>
      priorityRootIds.has(footprint.parentId ?? footprint.id)
    ),
    [blockFootprints, priorityRootIds]
  );
  const contextBlockFootprints = useMemo(
    () => blockFootprints.filter((footprint) =>
      !priorityRootIds.has(footprint.parentId ?? footprint.id)
    ),
    [blockFootprints, priorityRootIds]
  );
  const blockOpacity = smoothZoomStep(
    BUILDING_BLOCK_MIN_ZOOM,
    BUILDING_BLOCK_FULL_ZOOM,
    zoom
  );
  const drawnLod3ObjectCount = detailMesh
    ? Object.entries(detailMesh.objectCountByLod).reduce(
        (count, [lod, objects]) => count + (Number(lod) >= 3 ? objects : 0),
        0
      )
    : 0;
  const localDetailParts = detailMesh
    ? [
        drawnLod3ObjectCount > 0
          ? `CityJSON LoD3 (${drawnLod3ObjectCount} drawn objects)`
          : detailMesh.maxLod !== null
            ? `CityJSON LoD${detailMesh.maxLod} (${detailMesh.objectCount} drawn objects)`
            : `CityJSON source geometry (${detailMesh.objectCount} drawn objects)`,
        `${detailMesh.rootObjectCount} building${detailMesh.rootObjectCount === 1 ? '' : 's'}`,
        detailMesh.installationObjectCount > 0
          ? `${detailMesh.installationObjectCount} installations`
          : null,
        `${detailMesh.surfaceCount} surfaces`,
        texturesEnabled && detailMesh.texturedSurfaceCount > 0
          ? `${detailMesh.texturedSurfaceCount} photo-textured surfaces`
          : mapColorMode === 'usage'
            ? 'building usage colours drawn on detailed geometry'
          : detailMesh.availableTexturedSurfaceCount > 0
            ? `${detailMesh.availableTexturedSurfaceCount} source textures hidden; semantic materials drawn`
            : detailMesh.explicitOpeningSurfaceCount > 0
              ? `${detailMesh.explicitOpeningSurfaceCount} explicit window/door surfaces`
              : 'semantic roof, window, and wall materials',
        detailMesh.truncated
          ? `detail budget reached${detailMesh.droppedObjectCount > 0 ? `; ${detailMesh.droppedObjectCount} objects omitted` : ''}`
          : null,
      ].filter((part): part is string => !!part)
    : [];
  const detailRepresentationLabel = hamburgRemoteLod3Active
    ? [
        `Hamburg Geoportal LoD3 untextured (${hamburgLod3Status})`,
        ...localDetailParts,
        terrainDetailLabel,
        treeDetailLabel,
      ].join(' · ')
    : localDetailParts.length > 0
      ? [...localDetailParts, terrainDetailLabel, treeDetailLabel].join(' · ')
      : zoom >= BUILDING_DETAIL_MIN_ZOOM
        ? `Source geometry unavailable here · ${terrainDetailLabel} · ${treeDetailLabel}`
        : `LoD0 overview · source LoD2 at zoom 15.25 · source LoD3 at ${BUILDING_LOD3_MIN_ZOOM} · ${terrainDetailLabel} · ${treeDetailLabel}`;

  const inspectedBuildingFootprints = useMemo<Footprint[]>(
    () => {
      const previewPolygon = preview?.polygon ?? footprintEdit?.footprintWgs84;
      if (previewPolygon && previewPolygon.length >= 3) {
        const sourceFootprint = !preview?.polygon && footprintEdit
          ? groundedRenderedFootprints.find(
              (footprint) =>
                footprint.id === footprintEdit.buildingId ||
                footprint.parentId === footprintEdit.buildingId
            )
          : null;
        const groundElevation = preview?.groundElevation ?? sourceFootprint?.baseElevation ?? 0;
        return [
          {
            id: preview?.polygon ? '__building_preview__' : footprintEdit!.buildingId,
            type: 'Building',
            polygon: previewPolygon.map(
              ([lng, lat]) => [lng, lat, groundElevation] as [number, number, number]
            ),
            height: preview?.height ?? 10,
            baseElevation: groundElevation,
            attributes: {},
          },
        ];
      }
      return selectedId
        ? footprints.filter(
            (footprint) => footprint.id === selectedId || footprint.parentId === selectedId
          )
        : [];
    },
    [
      footprintEdit,
      footprints,
      groundedRenderedFootprints,
      preview?.groundElevation,
      preview?.height,
      preview?.polygon,
      selectedId,
    ]
  );
  const inspectedBuildingRoadConflicts = useMemo(
    () =>
      inspectedBuildingFootprints.length > 0 && roadAreas.length > 0 && !roadDraft
        ? validateRoadFit({
            roadAreas,
            buildingFootprints: inspectedBuildingFootprints,
            metricCrs: activeMetricCrsForCityJson(cityjson),
          }).filter((conflict) => conflict.kind === 'building_overlap')
        : [],
    [cityjson, inspectedBuildingFootprints, roadAreas, roadDraft]
  );
  const visibleRoadFitConflicts = useMemo(
    () => [...roadFitConflicts, ...inspectedBuildingRoadConflicts],
    [roadFitConflicts, inspectedBuildingRoadConflicts]
  );
  const conflictingSavedRoadAreas = useMemo(() => {
    if (inspectedBuildingRoadConflicts.length === 0) return [];
    const ids = new Set(inspectedBuildingRoadConflicts.map((conflict) => conflict.roadAreaId));
    return roadAreas.filter((area) => ids.has(area.id));
  }, [inspectedBuildingRoadConflicts, roadAreas]);
  const buildingRoadConflictMessage =
    inspectedBuildingRoadConflicts.length > 0
      ? `${inspectedBuildingRoadConflicts.length} road surface${
          inspectedBuildingRoadConflicts.length === 1 ? '' : 's'
        } overlap this building. The affected road is highlighted red; move or reshape the road/building before export.`
      : null;

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
          topplus: {
            type: 'raster',
            tiles: [
              'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
            ],
            tileSize: 256,
            attribution: '© Bundesamt für Kartographie und Geodäsie — TopPlusOpen',
            maxzoom: 18,
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
          {
            id: 'basemap-background',
            type: 'background',
            paint: { 'background-color': '#30363d' },
          },
          {
            id: 'topplus',
            type: 'raster',
            source: 'topplus',
          },
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
      // Keep the LoD membership anchored to the geographic camera centre.
      // A pitch-dependent screen sample changed when only bearing/pitch moved,
      // swapping nearby buildings between block and source geometry and making
      // them appear to slide under a stationary camera target.
      const center = map.getCenter();
      setDetailFocusPoint([center.lng, center.lat]);
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
      setRoadConnectionDragPreview(null);
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
      if (active.mode === 'connection') {
        if (!active.endpoint || active.bandIndex === undefined) return;
        const compatibleCandidates = compatibleRoadLaneSnapCandidates(
          draft,
          active.sectionId,
          active.endpoint,
          active.bandIndex,
          roadSnapCandidatesRef.current,
          120
        );
        const snap = nearestRoadSnapCandidate(
          map,
          compatibleCandidates,
          active.sectionId,
          [event.clientX - rect.left, event.clientY - rect.top],
          ROAD_SNAP_RADIUS_PIXELS
        );
        active.snapCandidate = snap;
        setRoadConnectionDragPreview({
          from: active.anchorPosition ?? [lngLat.lng, lngLat.lat],
          to: snap?.position ?? [lngLat.lng, lngLat.lat],
          snapped: !!snap,
          ...(snap ? { candidateId: snap.id } : {}),
        });
        return;
      }

      // Yellow handles only shape the road. Endpoint joins are deliberately
      // owned by the separate purple connector so moving a curve anchor can
      // never create an accidental network link.
      commitRoadDraft(
        updateRoadDraftPoint(
          draft,
          active.sectionId,
          active.pointIndex,
          [lngLat.lng, lngLat.lat],
          null
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
      if (
        active.mode === 'connection' &&
        active.snapCandidate &&
        active.endpoint &&
        active.bandIndex !== undefined
      ) {
        const draft = roadDraftRef.current;
        if (draft) {
          const targetRoadId = active.snapCandidate.connection.target === 'draft'
            ? draft.id ?? 'draft'
            : active.snapCandidate.connection.targetId;
          commitRoadDraft(
            connectManualRoadLaneMovement(
              draft,
              active.sectionId,
              active.endpoint,
              active.bandIndex,
              {
                roadId: targetRoadId,
                section: active.snapCandidate.targetSection,
                endpoint: active.snapCandidate.targetEndpoint,
                bandIndex: active.snapCandidate.targetBandIndex,
              }
            )
          );
        }
      }
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
      const connectionPick = overlay.pickObject({
        x: pointerX,
        y: pointerY,
        radius: 14,
        layerIds: ['road-lane-connection-handles'],
      });
      const shapePick = connectionPick ? null : overlay.pickObject({
        x: pointerX,
        y: pointerY,
        radius: 18,
        layerIds: ['road-draft-centerline-handles'],
      });
      const connectionHandle = connectionPick?.object as RoadConnectionHandle | undefined;
      const handle = connectionHandle ?? (shapePick?.object as RoadDraftHandle | undefined);
      if (!handle) return;

      if (connectionHandle) {
        setActiveRoadConnectionEndpoint({
          sectionId: connectionHandle.sectionId,
          endpoint: connectionHandle.endpoint,
          bandIndex: connectionHandle.bandIndex,
        });
        setSelectedDraftBand({
          sectionId: connectionHandle.sectionId,
          bandIndex: connectionHandle.bandIndex,
        });
      }

      blockMapGesture(event);
      restoreDragPan = map.dragPan.isEnabled();
      if (restoreDragPan) map.dragPan.disable();
      previousCursor = container.style.cursor;
      previousTouchAction = container.style.touchAction;
      container.style.cursor = 'grabbing';
      container.style.touchAction = 'none';

      const handlePoint = map.project({ lng: handle.position[0], lat: handle.position[1] });

      roadDraftDragRef.current = {
        mode: connectionHandle ? 'connection' : 'shape',
        sectionId: handle.sectionId,
        pointIndex: handle.pointIndex,
        ...(connectionHandle
          ? {
              endpoint: connectionHandle.endpoint,
              bandIndex: connectionHandle.bandIndex,
              anchorPosition: connectionHandle.anchorPosition,
              snapCandidate: null,
            }
          : {}),
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        grabOffsetX: handlePoint.x - pointerX,
        grabOffsetY: handlePoint.y - pointerY,
        moved: false,
      };
      if (!connectionHandle && handle.kind === 'midpoint') {
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
      if (!map.getLayer('topplus') || !map.getLayer('satellite')) return;
      // The selected source exclusively owns the raster stack. Otherwise a
      // slow or missing satellite tile reveals TopPlus labels underneath.
      const composition = basemapLayerComposition(basemap, satelliteOpacity);
      map.setLayoutProperty('topplus', 'visibility', composition.topplusVisibility);
      map.setLayoutProperty(
        'satellite',
        'visibility',
        composition.satelliteVisibility
      );
      map.setPaintProperty(
        'satellite',
        'raster-opacity',
        composition.satelliteOpacity
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
    const roadConnectionHandles = buildRoadConnectionHandles(
      map,
      roadDraft
    );
    const midpointHandles = roadDraftHandles.filter((handle) => handle.kind === 'midpoint');
    const visibleSnapCandidateMap = new Map<string, RoadLaneSnapCandidate>();
    if (roadDraft) {
      // Every incoming lane has its own purple connector and advertises every
      // compatible outgoing lane. Target dots are lane centres, not one
      // ambiguous marker for an entire road end.
      for (const handle of roadConnectionHandles) {
        for (const candidate of compatibleRoadLaneSnapCandidates(
          roadDraft,
          handle.sectionId,
          handle.endpoint,
          handle.bandIndex,
          roadSnapCandidates,
          80
        )) {
          if (!editFocusBbox || pointInsideBbox(candidate.position, editFocusBbox)) {
            visibleSnapCandidateMap.set(candidate.id, candidate);
          }
        }
      }
    }
    const visibleSnapCandidates = [...visibleSnapCandidateMap.values()];
    const activeConnectionHandle = roadConnectionHandles.find(
      (handle) =>
        handle.sectionId === activeRoadConnectionEndpoint?.sectionId &&
        handle.endpoint === activeRoadConnectionEndpoint.endpoint &&
        handle.bandIndex === activeRoadConnectionEndpoint.bandIndex
    );
    const activeSnapCandidates = roadDraft && activeConnectionHandle
      ? compatibleRoadLaneSnapCandidates(
          roadDraft,
          activeConnectionHandle.sectionId,
          activeConnectionHandle.endpoint,
          activeConnectionHandle.bandIndex,
          roadSnapCandidates,
          80
        ).filter(
          (candidate) => !editFocusBbox || pointInsideBbox(candidate.position, editFocusBbox)
        )
      : [];
    const emphasizedSnapCandidateId =
      roadConnectionDragPreview?.candidateId ?? hoveredRoadSnapCandidateId ?? activeSnapCandidates[0]?.id;
    const candidateConnectionPaths = activeConnectionHandle
      ? activeSnapCandidates.map((candidate) => ({
          id: candidate.id,
          path: curvedConnectionPath(activeConnectionHandle.position, candidate.position),
          emphasized: candidate.id === emphasizedSnapCandidateId,
        }))
      : [];
    const laneConnectionPaths = buildLaneConnectionPaths(
      roadDraft,
      roadAreas,
      osmRoads,
      selectedDraftBand
    );
    const connectionDragPath = roadConnectionDragPreview
      ? curvedConnectionPath(
          roadConnectionDragPreview.from,
          roadConnectionDragPreview.to
        )
      : [];

    // Hamburg's official DGM hybrid terrain owns the map's vertical datum.
    // Only the selected basemap may own its surface. Images are preloaded, so
    // a zoom transition exposes MapLibre's selected raster instead of drawing
    // a stale TopPlus or an untextured white terrain mesh.
    const terrainSurface = hamburgTerrainSurfaceSelection(basemap, satelliteOpacity);
    for (const tile of terrainTiles) {
      const texture = terrainSurfaceTextures.basemap === terrainSurface.basemap
        ? terrainSurfaceTextures.images.get(tile.descriptor.key)
        : undefined;
      if (!texture || terrainSurface.opacity <= 0.001) continue;
      const mesh = {
        attributes: {
          positions: { value: tile.positions, size: 3 },
          texCoords: { value: tile.texCoords, size: 2 },
        },
        indices: { value: tile.indices, size: 1 },
      } as unknown as never;
      const tileId = tile.descriptor.key.replaceAll('/', '-');
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: `hamburg-dgm-terrain-${terrainSurface.basemap}-${tileId}`,
          data: [{ position: [0, 0, 0] }],
          getPosition: (item: { position: [number, number, number] }) => item.position,
          getColor: [255, 255, 255, 255],
          mesh,
          texture,
          opacity: terrainSurface.opacity,
          _instanced: false,
          coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
          coordinateOrigin: [tile.anchorLngLat[0], tile.anchorLngLat[1], 0],
          pickable: false,
          material: terrainSurface.basemap === 'satellite'
            ? { ambient: 0.88, diffuse: 0.24, shininess: 1 }
            : { ambient: 0.82, diffuse: 0.32, shininess: 2 },
        } as any)
      );
    }

    // The official source positions, laser-derived heights, measured crown
    // diameters, and botanical names drive one detailed trunk plus four
    // species-informed crown meshes. Their surveyed base elevations share the
    // official terrain datum. Instancing keeps thousands of trees inexpensive,
    // and edit focus removes them entirely.
    if (renderedHamburgTrees.length > 0) {
      const treeOpacity = smoothZoomStep(
        HAMBURG_TREE_MIN_ZOOM,
        HAMBURG_TREE_MIN_ZOOM + 0.75,
        zoom
      );
      layers.push(
        new SimpleMeshLayer<HamburgCityTree>({
          id: 'hamburg-official-tree-trunks',
          data: renderedHamburgTrees,
          mesh: TREE_TRUNK_MESH as unknown as never,
          getPosition: treePositionOnTerrain,
          getScale: treeTrunkScale,
          getColor: [104, 74, 50, 255],
          coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
          pickable: false,
          opacity: treeOpacity,
          material: { ambient: 0.48, diffuse: 0.72, shininess: 5 },
        })
      );
      for (const form of TREE_CROWN_FORMS) {
        const trees = renderedHamburgTrees.filter((tree) => treeCrownForm(tree) === form);
        if (trees.length === 0) continue;
        layers.push(
          new SimpleMeshLayer<HamburgCityTree>({
            id: `hamburg-official-tree-crowns-${form}`,
            data: trees,
            mesh: TREE_CROWN_MESHES[form] as unknown as never,
            getPosition: treePositionOnTerrain,
            getTranslation: treeCrownTranslation,
            getScale: treeCrownScale,
            getColor: treeCrownColor,
            coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
            pickable: false,
            opacity: treeOpacity,
            material: { ambient: 0.52, diffuse: 0.82, shininess: 7 },
          })
        );
      }
    }

    if (hamburgRemoteLod3Active) {
      layers.push(
        new Tile3DLayer({
          id: 'hamburg-geoportal-lod3-untextured',
          data: HAMBURG_UNTEXTURED_LOD3_TILESET_URL,
          pickable: false,
          opacity: 1,
          onTilesetLoad: () => setHamburgLod3Status('ready'),
          onTileError: (_tile, url, message) => {
            setHamburgLod3Status('error');
            console.warn(`Hamburg Geoportal LoD3 tile failed (${url}): ${message}`);
          },
          _getMeshColor: () => [214, 210, 202, 255],
        })
      );
    }

    // LoD0 outlines remain available for picking while nearby objects swap to
    // their highest local CityJSON representation below.

    layers.push(
      new PolygonLayer<Footprint>({
        id: 'building-outlines',
        data: groundedRenderedFootprints,
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
          parameters: {
            depthTest: true,
            polygonOffsetFill: true,
            polygonOffset: [-2, -2],
          } as unknown as never,
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
            parameters: {
              depthTest: true,
              polygonOffsetFill: true,
              polygonOffset: [-3, -3],
            } as unknown as never,
          } as any)
        );
      });
    }

    // Cheap block context fills the middle zoom range; close zoom swaps it for
    // the indexed highest-available CityJSON surface mesh above. New and dirty
    // buildings keep a full-opacity block fallback across the overview range,
    // so they never vanish while the detail budget/zoom tier changes.
    const pushBuildingBlockLayer = (
      id: string,
      data: Footprint[],
      opacity: number
    ) => {
      if (data.length === 0 || opacity <= 0.001) return;
      layers.push(
        new SolidPolygonLayer<Footprint>({
          id,
          data,
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
          opacity,
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
    };
    pushBuildingBlockLayer('building-blocks-context', contextBlockFootprints, blockOpacity);
    pushBuildingBlockLayer('building-blocks-priority', priorityBlockFootprints, 1);

    // Detailed meshes and remote 3D Tiles are deliberately batched and cannot
    // expose one CityObject per GPU instance. A nearly invisible extruded
    // footprint volume keeps the visible building body clickable above the
    // terrain instead of relying on a z-fighting ground outline.
    layers.push(
      new SolidPolygonLayer<Footprint>({
        id: 'building-hit-targets',
        data: groundedRenderedFootprints,
        getPolygon: (footprint) => footprint.polygon,
        getElevation: (footprint) => footprint.height,
        getFillColor: [0, 0, 0, 1],
        opacity: 0.01,
        filled: true,
        extruded: true,
        wireframe: false,
        pickable: buildingSelectionEnabled,
        material: false,
        parameters: {
          depthTest: true,
          depthMask: false,
        } as unknown as never,
        onClick: (info: PickingInfo<Footprint>, event: unknown) => {
          if (!buildingSelectionEnabled || !info.object) return;
          const src = (event as { srcEvent?: { ctrlKey?: boolean; metaKey?: boolean } })?.srcEvent;
          onSelect({
            objectId: info.object.parentId ?? info.object.id,
            ctrlKey: !!(src?.ctrlKey || src?.metaKey),
          });
        },
      })
    );

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
          parameters: { depthTest: false } as unknown as never,
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
            parameters: { depthTest: false } as unknown as never,
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
          parameters: { depthTest: false } as unknown as never,
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
          parameters: { depthTest: false } as unknown as never,
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
          getFillColor: (d) => {
            const editingOriginal =
              roadPreviewAreas.length > 0 && !!roadDraft?.id && d.roadId === roadDraft.id;
            if (editingOriginal) {
              return roadOverlayColor([164, 39, 50, 64], {
                basemap,
                opacity: roadOverlayOpacity,
              });
            }
            if (roadAreaMatchesDraftBand(d, roadDraft, selectedDraftBand)) {
              return roadOverlayColor([77, 163, 255, 238], {
                basemap,
                opacity: roadOverlayOpacity,
              });
            }
            return roadAreaFillColor(d, basemap, false, roadOverlayOpacity);
          },
          getLineColor: (d) => {
            if (roadPreviewAreas.length > 0 && roadDraft?.id && d.roadId === roadDraft.id) {
              return roadOverlayColor([210, 62, 73, 150], {
                basemap,
                opacity: roadOverlayOpacity,
              });
            }
            return roadAreaLineColor(
              d,
              basemap,
              d.id === selectedRoadAreaId ||
                roadAreaMatchesDraftBand(d, roadDraft, selectedDraftBand),
              false,
              roadOverlayOpacity
            );
          },
          getLineWidth: (d) =>
            d.id === selectedRoadAreaId || roadAreaMatchesDraftBand(d, roadDraft, selectedDraftBand)
              ? 3
              : 1,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: roadSelectionEnabled,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getFillColor: [
              basemap,
              roadOverlayOpacity,
              roadDraft,
              roadPreviewAreas.length,
              selectedDraftBand,
            ],
            getLineColor: [
              selectedRoadAreaId,
              basemap,
              roadOverlayOpacity,
              roadDraft,
              roadPreviewAreas.length,
              selectedDraftBand,
            ],
            getLineWidth: [selectedRoadAreaId, roadDraft, selectedDraftBand],
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
          getFillColor: (d) => {
            const selected = roadAreaMatchesDraftBand(d, roadDraft, selectedDraftBand);
            return selected
              ? roadOverlayColor([77, 163, 255, 245], { basemap, opacity: roadOverlayOpacity })
              : roadAreaFillColor(d, basemap, true, roadOverlayOpacity);
          },
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
            getFillColor: [basemap, roadOverlayOpacity, selectedDraftBand, roadDraft],
            getLineColor: [basemap, roadOverlayOpacity],
          },
        })
      );
    }

    if (laneConnectionPaths.length > 0) {
      layers.push(
        new PathLayer({
          id: 'road-lane-connections',
          data: laneConnectionPaths,
          getPath: (d: any) => d.path,
          getColor: (d: any) => d.color,
          getWidth: (d: any) => d.selected ? 3.2 : d.status === 'confirmed' ? 2.5 : 1.6,
          widthUnits: 'pixels',
          widthMinPixels: 2,
          getDashArray: (d: any) => d.status === 'proposed' ? [4, 3] : [1, 0],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (candidateConnectionPaths.length > 0) {
      layers.push(
        new PathLayer({
          id: 'road-connection-candidate-curves',
          data: candidateConnectionPaths,
          getPath: (candidate: any) => candidate.path,
          getColor: (candidate: any) =>
            candidate.emphasized ? [73, 230, 204, 215] : [86, 213, 194, 82],
          getWidth: (candidate: any) => candidate.emphasized ? 2.5 : 1.25,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          getDashArray: [4, 3],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        } as any)
      );
    }

    if (connectionDragPath.length > 1) {
      layers.push(
        new PathLayer({
          id: 'road-connection-drag-preview',
          data: [{ path: connectionDragPath }],
          getPath: (item: { path: [number, number][] }) => item.path,
          getColor: roadConnectionDragPreview?.snapped
            ? [72, 230, 200, 220]
            : [192, 132, 252, 165],
          getWidth: 3,
          widthUnits: 'pixels',
          widthMinPixels: 2,
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
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
          parameters: { depthTest: false } as unknown as never,
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
          parameters: { depthTest: false } as unknown as never,
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


    if (roadConnectionHandles.length > 0 && drawMode !== 'road-line' && onRoadDraftChange) {
      layers.push(
        new PathLayer<RoadConnectionHandle>({
          id: 'road-lane-connection-tethers',
          data: roadConnectionHandles,
          getPath: (handle) => [handle.anchorPosition, handle.position],
          getColor: (handle) =>
            handle.connected ? [45, 212, 191, 185] : [178, 112, 246, 185],
          getWidth: 1.5,
          widthUnits: 'pixels',
          widthMinPixels: 1,
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
            d.kind === 'vertex'
                ? [255, 196, 84, 255]
                : [255, 255, 255, 245],
          getLineColor: (d) =>
            d.kind === 'vertex'
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

    if (roadConnectionHandles.length > 0 && drawMode !== 'road-line' && onRoadDraftChange) {
      layers.push(
        new ScatterplotLayer<RoadConnectionHandle>({
          id: 'road-lane-connection-handles',
          data: roadConnectionHandles,
          getPosition: (handle) => handle.position,
          getFillColor: (handle) =>
            handle.connected ? [45, 212, 191, 255] : [168, 85, 247, 255],
          getLineColor: (handle) =>
            handle.connected ? [7, 82, 74, 255] : [69, 26, 112, 255],
          getLineWidth: 2.5,
          getRadius: 10,
          radiusUnits: 'pixels',
          radiusMinPixels: 10,
          radiusMaxPixels: 14,
          stroked: true,
          filled: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 105],
          parameters: { depthTest: false } as unknown as never,
        }),
        new TextLayer<RoadConnectionHandle>({
          id: 'road-lane-connection-labels',
          data: roadConnectionHandles,
          getPosition: (handle) => handle.position,
          getText: (handle) => String(handle.bandIndex + 1),
          getSize: 12,
          sizeUnits: 'pixels',
          getColor: [255, 255, 255, 255],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          billboard: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (roadDraft && visibleSnapCandidates.length > 0) {
      layers.push(
        new ScatterplotLayer<RoadLaneSnapCandidate>({
          id: 'road-connection-snap-targets',
          data: visibleSnapCandidates,
          getPosition: (candidate) => candidate.position,
          getFillColor: (candidate) =>
            candidate.id === emphasizedSnapCandidateId
              ? [45, 212, 191, 155]
              : [20, 184, 166, 38],
          getLineColor: (candidate) =>
            candidate.id === emphasizedSnapCandidateId
              ? [204, 255, 246, 255]
              : [45, 212, 191, 225],
          getLineWidth: 2,
          getRadius: (candidate) => candidate.id === emphasizedSnapCandidateId ? 10 : 7,
          radiusUnits: 'pixels',
          radiusMinPixels: 7,
          radiusMaxPixels: 9,
          stroked: true,
          filled: true,
          pickable: true,
          onHover: (info) => setHoveredRoadSnapCandidateId(info.object?.id ?? null),
          updateTriggers: {
            getFillColor: [emphasizedSnapCandidateId],
            getLineColor: [emphasizedSnapCandidateId],
            getRadius: [emphasizedSnapCandidateId],
          },
          parameters: { depthTest: false } as unknown as never,
        })
      );
    }

    if (visibleRoadFitConflicts.length > 0) {
      layers.push(
        new PolygonLayer<RoadFitConflict>({
          id: 'road-fit-conflicts',
          data: visibleRoadFitConflicts,
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

    // Saved roads normally sit on the ground and are correctly occluded by a
    // building. When the selected building actually collides with a road,
    // repeat only those road surfaces above the depth buffer in red so the
    // invalid geometry does not look like a mysteriously broken road.
    if (conflictingSavedRoadAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'selected-building-road-conflicts',
          data: conflictingSavedRoadAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: [239, 68, 68, 175],
          getLineColor: [255, 235, 235, 255],
          getLineWidth: 3,
          lineWidthMinPixels: 3,
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
      const previewGround = preview.groundElevation ?? 0;
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: 'new-building-preview-mesh',
          data: [{ position: [0, 0, previewGround] }],
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
      const previewGround = preview.groundElevation ?? 0;
      layers.push(
        new SolidPolygonLayer<{
          polygon: [number, number, number][];
          height: number;
        }>({
          id: 'new-building-preview-poly',
          data: [{
            polygon: preview.polygon.map(
              ([lng, lat]) => [lng, lat, previewGround] as [number, number, number]
            ),
            height: preview.height ?? 10,
          }],
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
    groundedRenderedFootprints,
    renderedRoadAreas,
    contextBlockFootprints,
    priorityBlockFootprints,
    renderedZones,
    detailMesh,
    terrainTiles,
    terrainSurfaceTextures,
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
    roadAreas,
    osmRoads,
    onRoadDraftChange,
    roadConnectionDragPreview,
    activeRoadConnectionEndpoint,
    hoveredRoadSnapCandidateId,
    drawMode,
    conflictingSavedRoadAreas,
    visibleRoadFitConflicts,
    selectedRoadAreaId,
    selectedDraftBand,
    onRoadAreaSelect,
    renderedOsmRoads,
    renderedOsmPointFeatures,
    renderedHamburgTrees,
    hamburgRemoteLod3Active,
    selectedOsmRoadId,
    onOsmRoadSelect,
    renderedOsm2StreetsResult,
    osm2streetsBbox,
    osm2streetsSelection,
    highlightedOsm2StreetsRoadIds,
    onOsm2StreetsSelect,
    basemap,
    satelliteOpacity,
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
    // Only one TerraDraw can be alive at a time on the map. Both new-building
    // polygon drawing and new-road line drawing are owned by the draw-mode
    // effect above. This guard must include road-line: otherwise this
    // footprint cleanup immediately stops the freshly started road tool and
    // every map tap is lost.
    if (drawMode !== 'none') return;

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
            <MapRoadCrossSection
              draft={roadDraft}
              onChange={onRoadDraftChange}
              selection={selectedDraftBand}
              onSelectionChange={setSelectedDraftBand}
            />
          )}
        </>
      )}
      {(drawWarning ?? buildingRoadConflictMessage ?? warning) && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            background: 'rgba(91, 24, 30, 0.96)',
            border: '2px solid #ff7b82',
            color: '#fff',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.35,
            boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            zIndex: 10,
          }}
        >
          {drawWarning ?? buildingRoadConflictMessage ?? warning}
        </div>
      )}
      <MapLayerControl
        open={layerControlOpen}
        onOpenChange={setLayerControlOpen}
        basemap={basemap}
        onBasemapChange={onBasemapChange}
        satelliteOpacity={satelliteOpacity}
        onSatelliteOpacityChange={onSatelliteOpacityChange}
        roadOverlayOpacity={roadOverlayOpacity}
        onRoadOverlayOpacityChange={onRoadOverlayOpacityChange}
        mapColorMode={mapColorMode}
        onMapColorModeChange={setMapColorMode}
        texturesEnabled={texturesEnabled}
        onTexturesEnabledChange={setTexturesEnabled}
        lod3Visible={hamburgRemoteLod3Active || drawnLod3ObjectCount > 0}
        detailLabel={detailRepresentationLabel}
        focusActive={!!editFocusBbox}
        obscuredByInspector={roadWorkspaceOpen || !!selectedId}
      />
    </>
  );
}

function RoadHandleGuide({ draft }: { draft: RoadDraft }) {
  const legacyConnections = draft.sections.reduce(
    (count, section) =>
      count + Number(!!section.connections?.start) + Number(!!section.connections?.end),
    0
  );
  const connections = legacyConnections + (draft.movements ?? []).filter(
    (movement) => movement.provenance === 'manual' && movement.status === 'confirmed'
  ).length;
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
        <span><i className="road-guide-dot road-guide-dot--connect">1</i>Drag a purple lane number to connect</span>
        <span><i className="road-guide-dot road-guide-dot--snap" />Drop on a teal target</span>
      </div>
    </div>
  );
}

function roadAreaMatchesDraftBand(
  area: RoadArea,
  draft: RoadDraft | null,
  selection: { sectionId: string; bandIndex: number } | null
): boolean {
  if (!draft || !selection || area.sectionId !== selection.sectionId) return false;
  if (draft.id && area.roadId !== draft.id && !area.id.startsWith('__road_preview__')) {
    return false;
  }
  const section = draft.sections.find((candidate) => candidate.id === selection.sectionId);
  const band = section?.bands[selection.bandIndex];
  return !!band && area.bandId === (band.id ?? `band-${selection.bandIndex + 1}`);
}

function buildRoadConnectionHandles(
  map: maplibregl.Map,
  draft: RoadDraft | null
): RoadConnectionHandle[] {
  if (!draft) return [];
  const result: RoadConnectionHandle[] = [];
  for (const section of draft.sections) {
    if (section.centerlineWgs84.length < 2) continue;
    for (const endpoint of ['start', 'end'] as const) {
      const inside = endpoint === 'start'
        ? section.centerlineWgs84[1]
        : section.centerlineWgs84[section.centerlineWgs84.length - 2];
      for (let bandIndex = 0; bandIndex < section.bands.length; bandIndex++) {
        const band = section.bands[bandIndex];
        if (
          !isRoadBandConnectable(band) ||
          !roadBandCanArriveAtEndpoint(band, endpoint)
        ) {
          continue;
        }
        const anchor = roadLaneEndpointPosition(section, endpoint, bandIndex);
        if (!anchor) continue;
        const anchorPixel = map.project({ lng: anchor[0], lat: anchor[1] });
        const insidePixel = map.project({ lng: inside[0], lat: inside[1] });
        let dx = anchorPixel.x - insidePixel.x;
        let dy = anchorPixel.y - insidePixel.y;
        const length = Math.hypot(dx, dy);
        if (length < 0.5) {
          dx = endpoint === 'start' ? -1 : 1;
          dy = 0;
        } else {
          dx /= length;
          dy /= length;
        }
        const display = map.unproject([
          anchorPixel.x + dx * ROAD_CONNECTION_HANDLE_OFFSET_PIXELS,
          anchorPixel.y + dy * ROAD_CONNECTION_HANDLE_OFFSET_PIXELS,
        ]);
        const connected = (draft.movements ?? []).some(
          (movement) =>
            movement.provenance === 'manual' &&
            movement.status === 'confirmed' &&
            movement.sourceSectionId === section.id &&
            movement.sourceEndpoint === endpoint &&
            (movement.sourceBandId
              ? movement.sourceBandId === band.id
              : movement.sourceBandIndex === bandIndex)
        );
        result.push({
          sectionId: section.id,
          pointIndex: endpoint === 'start' ? 0 : section.centerlineWgs84.length - 1,
          position: [display.lng, display.lat],
          kind: 'vertex',
          endpoint,
          anchorPosition: anchor,
          bandIndex,
          ...(band.id ? { bandId: band.id } : {}),
          mode: roadBandModes(band)[0] ?? band.kind,
          ...(connected ? { connected: true } : {}),
        });
      }
    }
  }
  return result;
}

interface ResolvedConnectionTarget {
  roadId: string;
  section: RoadSectionDraft;
  endpoint: 'start' | 'end';
}

interface LaneConnectionPath {
  path: [number, number][];
  color: [number, number, number, number];
  selected: boolean;
  sourceBandIndex: number;
  targetBandIndex: number;
  status: 'proposed' | 'confirmed';
  provenance: string;
  movementId?: string;
}

function editableRoadDraftForAreas(
  roadAreas: RoadArea[],
  roadId: string
): RoadDraft | null {
  const matching = roadAreas.filter((area) => area.roadId === roadId);
  const saved = matching.find((area) => area.editableDraft)?.editableDraft;
  if (saved) return saved;
  if (matching.length === 0) return null;
  try {
    return deriveEditableRoadDraftFromAreas(matching, roadId);
  } catch {
    return null;
  }
}

function buildLaneConnectionPaths(
  draft: RoadDraft | null,
  roadAreas: RoadArea[],
  osmRoads: OsmRoadFeature[],
  selection: { sectionId: string; bandIndex: number } | null
): LaneConnectionPath[] {
  if (!draft) return [];
  const paths: LaneConnectionPath[] = [];
  const seen = new Set<string>();
  for (const section of draft.sections) {
    if (section.centerlineWgs84.length < 2) continue;
    for (const endpoint of ['start', 'end'] as const) {
      const connection = section.connections?.[endpoint];
      if (!connection) continue;
      const target = resolveConnectionTarget(draft, roadAreas, osmRoads, connection);
      const mappings = connection.laneConnections?.length
        ? connection.laneConnections
        : connectRoadLanes(connection, section.bands, target?.section.bands, endpoint)
            .laneConnections ?? [];
      for (const mapping of mappings) {
        const sourceBandIndex = bandIndexForConnection(
          section.bands,
          mapping.sourceBandId,
          mapping.sourceBandIndex
        );
        if (sourceBandIndex < 0) continue;
        const source = laneEndpointGeometry(section, endpoint, sourceBandIndex);
        if (!source) continue;
        const targetBandIndex = target
          ? bandIndexForConnection(
              target.section.bands,
              mapping.targetBandId,
              mapping.targetBandIndex
            )
          : mapping.targetBandIndex;
        const targetGeometry = target && targetBandIndex >= 0
          ? laneEndpointGeometry(target.section, target.endpoint, targetBandIndex)
          : null;
        const targetPoint = targetGeometry?.point ?? connection.positionWgs84;
        const targetOutward = targetGeometry?.outward ?? source.outward;
        const sourceKey = `${draft.id ?? 'draft'}:${section.id}:${endpoint}:${sourceBandIndex}`;
        const targetKey = `${target?.roadId ?? connection.targetId}:${
          target?.section.id ?? connection.targetSectionId ?? 'node'
        }:${target?.endpoint ?? connection.targetEndpoint ?? 'node'}:${targetBandIndex}`;
        const key = [sourceKey, targetKey].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const selected =
          selection?.sectionId === section.id && selection.bandIndex === sourceBandIndex;
        paths.push({
          path: cubicLaneConnectionPath(
            source.point,
            source.outward,
            targetPoint,
            targetOutward
          ),
          color: laneConnectionColor(mapping.sourceMode, selected, 'confirmed'),
          selected,
          sourceBandIndex,
          targetBandIndex,
          status: 'confirmed',
          provenance: 'manual',
        });
      }
    }
  }
  const targetDraftCache = new Map<string, RoadDraft | null>();
  const targetDraftFor = (roadId: string): RoadDraft | null => {
    if (targetDraftCache.has(roadId)) return targetDraftCache.get(roadId) ?? null;
    const target = editableRoadDraftForAreas(roadAreas, roadId);
    targetDraftCache.set(roadId, target);
    return target;
  };
  for (const movement of draft.movements ?? []) {
    if (movement.status === 'rejected') continue;
    const sourceSection = draft.sections.find(
      (section) => section.id === movement.sourceSectionId
    );
    const targetDraft = movement.targetRoadId === (draft.id ?? 'draft')
      ? draft
      : targetDraftFor(movement.targetRoadId) ??
        osmRoads.find((road) => road.id === movement.targetRoadId)?.inferredDraft ??
        null;
    const targetSection = targetDraft?.sections.find(
      (section) => section.id === movement.targetSectionId
    );
    if (!sourceSection || !targetSection) continue;
    const sourceBandIndex = bandIndexForConnection(
      sourceSection.bands,
      movement.sourceBandId,
      movement.sourceBandIndex
    );
    const targetBandIndex = bandIndexForConnection(
      targetSection.bands,
      movement.targetBandId,
      movement.targetBandIndex
    );
    if (sourceBandIndex < 0 || targetBandIndex < 0) continue;
    const source = laneEndpointGeometry(
      sourceSection,
      movement.sourceEndpoint,
      sourceBandIndex
    );
    const target = laneEndpointGeometry(
      targetSection,
      movement.targetEndpoint,
      targetBandIndex
    );
    if (!source || !target) continue;
    const selected =
      selection?.sectionId === sourceSection.id && selection.bandIndex === sourceBandIndex;
    paths.push({
      path: cubicLaneConnectionPath(
        source.point,
        source.outward,
        target.point,
        target.outward
      ),
      color: laneConnectionColor(movement.sourceMode, selected, movement.status),
      selected,
      sourceBandIndex,
      targetBandIndex,
      status: movement.status,
      provenance: movement.provenance,
      movementId: movement.id,
    });
  }
  return paths;
}

function resolveConnectionTarget(
  draft: RoadDraft,
  roadAreas: RoadArea[],
  osmRoads: OsmRoadFeature[],
  connection: RoadEndpointConnection
): ResolvedConnectionTarget | null {
  let roadId = connection.targetId;
  let targetDraft: RoadDraft | null = null;
  if (connection.target === 'draft') {
    targetDraft = draft;
    roadId = draft.id ?? 'draft';
  } else if (connection.target === 'cityjson') {
    targetDraft = editableRoadDraftForAreas(roadAreas, connection.targetId);
  } else {
    targetDraft =
      osmRoads.find((road) => road.id === connection.targetId)?.inferredDraft ?? null;
  }
  if (!targetDraft) return null;
  const section =
    targetDraft.sections.find(
      (candidate) => candidate.id === connection.targetSectionId
    ) ?? targetDraft.sections[0];
  if (!section || section.centerlineWgs84.length < 2) return null;
  const endpoint = connection.targetEndpoint === 'start' || connection.targetEndpoint === 'end'
    ? connection.targetEndpoint
    : nearestSectionEndpoint(section, connection.positionWgs84);
  return { roadId, section, endpoint };
}

function nearestSectionEndpoint(
  section: RoadSectionDraft,
  point: [number, number]
): 'start' | 'end' {
  const start = section.centerlineWgs84[0];
  const end = section.centerlineWgs84[section.centerlineWgs84.length - 1];
  return approximateLngLatDistanceMeters(point, start) <=
    approximateLngLatDistanceMeters(point, end)
    ? 'start'
    : 'end';
}

function bandIndexForConnection(
  bands: RoadBand[],
  bandId: string | undefined,
  fallback: number
): number {
  const byId = bandId ? bands.findIndex((band) => band.id === bandId) : -1;
  if (byId >= 0) return byId;
  return fallback >= 0 && fallback < bands.length ? fallback : -1;
}

function laneEndpointGeometry(
  section: RoadSectionDraft,
  endpoint: 'start' | 'end',
  bandIndex: number
): { point: [number, number]; outward: [number, number] } | null {
  const line = section.centerlineWgs84;
  const band = section.bands[bandIndex];
  if (!band || line.length < 2) return null;
  const anchor = endpoint === 'start' ? line[0] : line[line.length - 1];
  const inner = endpoint === 'start' ? line[1] : line[line.length - 2];
  const forwardVector = endpoint === 'start'
    ? localVectorMeters(anchor, inner)
    : localVectorMeters(inner, anchor);
  const forward = normalizedVector(forwardVector);
  const interior: [number, number] = endpoint === 'start'
    ? forward
    : [-forward[0], -forward[1]];
  const outward: [number, number] = [-interior[0], -interior[1]];
  const segmentLength = Math.hypot(forwardVector[0], forwardVector[1]);
  const inset = Math.min(6, Math.max(2.25, segmentLength * 0.32));
  const totalWidth = section.bands.reduce((sum, candidate) => sum + candidate.widthM, 0);
  const priorWidth = section.bands
    .slice(0, bandIndex)
    .reduce((sum, candidate) => sum + candidate.widthM, 0);
  const leftOffset = totalWidth / 2 - priorWidth - band.widthM / 2;
  const left: [number, number] = [-forward[1], forward[0]];
  return {
    point: offsetLngLat(
      anchor,
      interior[0] * inset + left[0] * leftOffset,
      interior[1] * inset + left[1] * leftOffset
    ),
    outward,
  };
}

function cubicLaneConnectionPath(
  from: [number, number],
  fromOutward: [number, number],
  to: [number, number],
  toOutward: [number, number]
): [number, number][] {
  const distance = Math.max(1, approximateLngLatDistanceMeters(from, to));
  const reach = Math.min(18, Math.max(3.5, distance * 0.42));
  const controlA = offsetLngLat(from, fromOutward[0] * reach, fromOutward[1] * reach);
  const controlB = offsetLngLat(to, toOutward[0] * reach, toOutward[1] * reach);
  return Array.from({ length: 17 }, (_, index) => {
    const t = index / 16;
    const u = 1 - t;
    return [
      u * u * u * from[0] + 3 * u * u * t * controlA[0] +
        3 * u * t * t * controlB[0] + t * t * t * to[0],
      u * u * u * from[1] + 3 * u * u * t * controlA[1] +
        3 * u * t * t * controlB[1] + t * t * t * to[1],
    ];
  });
}

function curvedConnectionPath(
  from: [number, number],
  to: [number, number]
): [number, number][] {
  const vector = localVectorMeters(from, to);
  const length = Math.hypot(vector[0], vector[1]);
  if (length < 0.05) return [from, to];
  const normal: [number, number] = [-vector[1] / length, vector[0] / length];
  const midpoint = offsetLngLat(
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    normal[0] * Math.min(8, length * 0.18),
    normal[1] * Math.min(8, length * 0.18)
  );
  return Array.from({ length: 13 }, (_, index) => {
    const t = index / 12;
    const u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * midpoint[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * midpoint[1] + t * t * to[1],
    ];
  });
}

function laneConnectionColor(
  mode: string | undefined,
  selected: boolean,
  status: 'proposed' | 'confirmed' = 'confirmed'
): [number, number, number, number] {
  if (selected) return [135, 214, 255, 245];
  const alphaScale = status === 'proposed' ? 0.52 : 1;
  const normalized = (mode ?? '').toLowerCase();
  if (normalized.includes('bicy')) return [74, 222, 152, Math.round(190 * alphaScale)];
  if (normalized.includes('pedestrian') || normalized.includes('foot')) {
    return [250, 190, 82, Math.round(185 * alphaScale)];
  }
  if (normalized.includes('bus') || normalized.includes('transit')) {
    return [201, 134, 255, Math.round(195 * alphaScale)];
  }
  return [94, 181, 255, Math.round(190 * alphaScale)];
}

function buildingHasSourceTextures(doc: CityJsonDocument, rootId: string): boolean {
  const pending = [rootId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const objectId = pending.pop()!;
    if (visited.has(objectId)) continue;
    visited.add(objectId);
    const object = doc.CityObjects[objectId];
    if (!object) continue;
    if ((object.geometry ?? []).some((geometry) =>
      (geometry as { texture?: unknown }).texture != null
    )) {
      return true;
    }
    pending.push(...(object.children ?? []));
  }
  return false;
}

function localVectorMeters(
  from: [number, number],
  to: [number, number]
): [number, number] {
  const latitude = ((from[1] + to[1]) / 2) * Math.PI / 180;
  return [
    (to[0] - from[0]) * 111_320 * Math.max(0.2, Math.cos(latitude)),
    (to[1] - from[1]) * 110_540,
  ];
}

function normalizedVector(vector: [number, number]): [number, number] {
  const length = Math.hypot(vector[0], vector[1]);
  return length > 1e-6 ? [vector[0] / length, vector[1] / length] : [1, 0];
}

function offsetLngLat(
  point: [number, number],
  eastM: number,
  northM: number
): [number, number] {
  const metresPerLng = 111_320 * Math.max(0.2, Math.cos(point[1] * Math.PI / 180));
  return [point[0] + eastM / metresPerLng, point[1] + northM / 110_540];
}

function MapRoadCrossSection({
  draft,
  onChange,
  selection,
  onSelectionChange,
}: {
  draft: RoadDraft;
  onChange: (draft: RoadDraft) => void;
  selection: { sectionId: string; bandIndex: number } | null;
  onSelectionChange: (selection: { sectionId: string; bandIndex: number }) => void;
}) {
  const [newBandKind, setNewBandKind] = useState<RoadBandKind>('car_lane');
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);
  const section =
    draft.sections.find((candidate) => candidate.id === selection?.sectionId) ??
    draft.sections[0];
  const effectiveBandIndex = Math.min(
    selection?.sectionId === section?.id ? selection.bandIndex : 0,
    Math.max(0, (section?.bands.length ?? 1) - 1)
  );
  const activeBand = section?.bands[effectiveBandIndex];
  if (!section || !activeBand) return null;

  const patchActiveBand = (patch: Partial<typeof activeBand>) => {
    onChange({
      ...draft,
      sections: draft.sections.map((candidate) =>
        candidate.id === section.id
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
      sections: draft.sections.map((candidate) =>
        candidate.id === section.id ? { ...candidate, bands } : candidate
      ),
    });
  };

  const directions = ['forward', 'backward', 'both', 'none'] as const;
  const endpointConnections = (['start', 'end'] as const)
    .map((endpoint) => ({ endpoint, connection: section.connections?.[endpoint] }))
    .filter(
      (entry): entry is {
        endpoint: 'start' | 'end';
        connection: RoadEndpointConnection;
      } => !!entry.connection
    );
  const sectionMovements: RoadLaneMovement[] = (draft.movements ?? []).filter(
    (movement) => movement.sourceSectionId === section.id
  );
  const activeMovements = sectionMovements.filter(
    (movement) => movement.sourceBandIndex === effectiveBandIndex
  );

  return (
    <section className="map-road-cross-section" aria-label="Road cross-section quick editor">
      <header>
        <div>
          <b>Road on the map</b>
          <span>Tap or drag a lane; the selected box is highlighted on the map.</span>
        </div>
        {draft.sections.length > 1 && (
          <label className="map-road-cross-section__section">
            <span>Section</span>
            <select
              value={section.id}
              aria-label="Active road section"
              onChange={(event) =>
                onSelectionChange({ sectionId: event.target.value, bandIndex: 0 })
              }
            >
              {draft.sections.map((candidate, index) => (
                <option key={candidate.id} value={candidate.id}>Part {index + 1}</option>
              ))}
            </select>
          </label>
        )}
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
              draggable
              style={{
                flexGrow: Math.max(0.75, band.widthM),
                background: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`,
                color: lightBand ? '#17202a' : '#ffffff',
                textShadow: lightBand ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.75)',
              }}
              onClick={() => onSelectionChange({ sectionId: section.id, bandIndex: index })}
              onDragStart={(event) => {
                setDraggingBandIndex(index);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = Number(event.dataTransfer.getData('text/plain'));
                if (!Number.isInteger(from) || from === index) return;
                const bands = section.bands.slice();
                const [moved] = bands.splice(from, 1);
                bands.splice(index, 0, moved);
                replaceBands(bands);
                onSelectionChange({ sectionId: section.id, bandIndex: index });
                setDraggingBandIndex(null);
              }}
              onDragEnd={() => setDraggingBandIndex(null)}
              data-dragging={draggingBandIndex === index ? 'true' : undefined}
              aria-pressed={index === effectiveBandIndex}
              aria-label={`Band ${index + 1}: ${mapRoadBandLabel(band.kind, band.sourceType)}, ${band.widthM.toFixed(2)} metres`}
            >
              <b><span className="map-road-band__icon" aria-hidden="true"><MapRoadBandIcon kind={band.kind} sourceType={band.sourceType} /></span>{mapRoadBandLabel(band.kind, band.sourceType)}</b>
              <span>{band.widthM.toFixed(1)} m · {roadDirectionGlyph(band.direction)}</span>
            </button>
          );
        })}
      </div>
      <div className="map-road-cross-section__connections">
        <div>
          <b>Lane movements</b>
          <span>Imported proposals are subdued until confirmed. Rejected movements stay suppressed after save.</span>
        </div>
        {sectionMovements.length > 0 && (
          <div className="map-road-cross-section__movement-summary" aria-label="Lane movement status">
            <span>{sectionMovements.filter((movement) => movement.status === 'proposed').length} proposed</span>
            <span>{sectionMovements.filter((movement) => movement.status === 'confirmed').length} confirmed</span>
            <span>{sectionMovements.filter((movement) => movement.status === 'rejected').length} rejected</span>
          </div>
        )}
        {activeMovements.length > 0 ? (
          <div className="map-road-cross-section__movement-list">
            {activeMovements.map((movement) => (
              <div
                key={movement.id}
                className={`map-road-cross-section__movement is-${movement.status}`}
                data-testid={`road-movement-${movement.id}`}
              >
                <div>
                  <strong>
                    <span className="map-road-band__icon" aria-hidden="true">
                      <MapRoadBandIcon
                        kind={section.bands[movement.sourceBandIndex]?.kind ?? 'car_lane'}
                        sourceType={section.bands[movement.sourceBandIndex]?.sourceType}
                      />
                    </span>
                    {movement.turn} · {movement.sourceMode}
                  </strong>
                  <span>
                    {movement.sourceEndpoint} band {movement.sourceBandIndex + 1}
                    {movement.sourceDirection ? ` (${movement.sourceDirection})` : ''} →{' '}
                    {movement.targetRoadId} {movement.targetEndpoint} band {movement.targetBandIndex + 1}
                    {movement.targetDirection ? ` (${movement.targetDirection})` : ''}
                  </span>
                  <small>
                    {movement.provenance} {movement.semanticEvidence ? 'source topology' : 'geometry fallback'}
                  </small>
                </div>
                <div className="map-road-cross-section__movement-actions">
                  {movement.provenance === 'manual' ? (
                    <button
                      type="button"
                      aria-label={`Remove lane connection to ${movement.targetRoadId}`}
                      onClick={() => onChange(removeRoadMovement(draft, movement.id))}
                    >Remove</button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={movement.status === 'confirmed' ? 'is-active' : ''}
                        aria-label={`Confirm ${movement.turn} movement to ${movement.targetRoadId}`}
                        onClick={() => onChange(updateRoadMovementStatus(draft, movement.id, 'confirmed'))}
                      >Confirm</button>
                      <button
                        type="button"
                        className={movement.status === 'rejected' ? 'is-active' : ''}
                        aria-label={`Reject ${movement.turn} movement to ${movement.targetRoadId}`}
                        onClick={() => onChange(updateRoadMovementStatus(draft, movement.id, 'rejected'))}
                      >Reject</button>
                      {movement.status !== 'proposed' && (
                        <button
                          type="button"
                          aria-label={`Reset ${movement.turn} movement to proposed`}
                          onClick={() => onChange(updateRoadMovementStatus(draft, movement.id, 'proposed'))}
                        >Reset</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : sectionMovements.length > 0 ? (
          <p>Select a band with imported junction proposals to inspect its target, direction, and endpoint.</p>
        ) : null}
        <div className="map-road-cross-section__connection-heading">
          <b>Lane connectors</b>
          <span>Each numbered purple handle belongs to one incoming lane. Drag it to one compatible teal outgoing lane.</span>
        </div>
        {(draft.movements ?? []).some((movement) =>
          movement.provenance === 'manual' && movement.sourceSectionId === section.id
        ) ? (
          <p>Manual lane connections are listed above and can be removed individually.</p>
        ) : (
          <p>Select a lane, then drag its purple numbered handle to an exact teal lane target.</p>
        )}
        {endpointConnections.length > 0 && (
          <>
          <div className="map-road-cross-section__connection-heading">
            <b>Legacy road-end joins</b>
            <span>Older files remain readable; new connections are stored per lane.</span>
          </div>
          <div className="map-road-cross-section__connection-list">
            {endpointConnections.map(({ endpoint, connection }) => (
              <div key={endpoint} className="map-road-cross-section__connection">
                <strong>{endpoint} → {connection.targetId}</strong>
                <span>
                  {(connection.laneConnections ?? []).length > 0
                    ? connection.laneConnections!.map((mapping) => {
                        const sourceIndex = bandIndexForConnection(
                          section.bands,
                          mapping.sourceBandId,
                          mapping.sourceBandIndex
                        );
                        return (
                          <i
                            key={`${sourceIndex}-${mapping.targetBandIndex}`}
                            className={sourceIndex === effectiveBandIndex ? 'is-active' : ''}
                          >
                            <span className="map-road-band__icon" aria-hidden="true">
                              <MapRoadBandIcon
                                kind={section.bands[sourceIndex]?.kind ?? 'car_lane'}
                                sourceType={section.bands[sourceIndex]?.sourceType}
                              />
                            </span>{' '}
                            {endpoint} band {sourceIndex + 1} ({mapping.sourceMode ?? 'mode'}
                            {mapping.sourceDirection ? `, ${mapping.sourceDirection}` : ''}) →{' '}
                            {connection.targetEndpoint ?? 'road end'} band {mapping.targetBandIndex + 1}{' '}
                            ({mapping.targetMode ?? 'mode'}
                            {mapping.targetDirection ? `, ${mapping.targetDirection}` : ''})
                          </i>
                        );
                      })
                    : <i>Road end joined · lane pairs will be derived on the next save</i>}
                </span>
              </div>
            ))}
          </div>
          </>
        )}
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
          onSelectionChange({ sectionId: section.id, bandIndex: effectiveBandIndex - 1 });
          replaceBands(bands);
        }}>Move left</button>
        <button type="button" disabled={effectiveBandIndex === section.bands.length - 1} onClick={() => {
          const bands = section.bands.slice();
          [bands[effectiveBandIndex], bands[effectiveBandIndex + 1]] = [bands[effectiveBandIndex + 1], bands[effectiveBandIndex]];
          onSelectionChange({ sectionId: section.id, bandIndex: effectiveBandIndex + 1 });
          replaceBands(bands);
        }}>Move right</button>
        <button type="button" className="is-destructive" disabled={section.bands.length <= 1} onClick={() => {
          replaceBands(section.bands.filter((_, index) => index !== effectiveBandIndex));
          onSelectionChange({ sectionId: section.id, bandIndex: Math.max(0, effectiveBandIndex - 1) });
        }}>Remove</button>
        </div>
      </div>
      <div className="map-road-cross-section__add">
        <label><span>Add a band</span><select value={newBandKind} onChange={(event) => setNewBandKind(event.target.value as RoadBandKind)}>{MAP_ROAD_BAND_KINDS.map((kind) => <option key={kind} value={kind}>{mapRoadBandLabel(kind)}</option>)}</select></label>
        <button type="button" onClick={() => {
          replaceBands([...section.bands, { id: nextMapRoadBandId(section.bands, newBandKind), kind: newBandKind, widthM: MAP_ROAD_DEFAULT_WIDTH[newBandKind], direction: newBandKind === 'car_lane' || newBandKind === 'bike_lane' ? 'forward' : 'none', surface: newBandKind === 'green' ? 'grass' : 'asphalt' }]);
          onSelectionChange({ sectionId: section.id, bandIndex: section.bands.length });
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

function nextMapRoadBandId(bands: RoadBand[], kind: RoadBandKind): string {
  const ids = new Set(bands.map((band) => band.id).filter(Boolean));
  let suffix = 1;
  while (ids.has(`${kind}-${suffix}`)) suffix++;
  return `${kind}-${suffix}`;
}

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

function MapRoadBandIcon({
  kind,
  sourceType,
}: {
  kind: string;
  sourceType?: string;
}) {
  const label = mapRoadBandLabel(kind, sourceType);
  const props = { size: 15, strokeWidth: 2, 'aria-hidden': true } as const;
  if (label === 'Bike') return <Bike {...props} />;
  if (label === 'Bus') return <BusFront {...props} />;
  if (label === 'Sidewalk' || label === 'Footway') return <Footprints {...props} />;
  if (label === 'Parking') return <CircleParking {...props} />;
  if (label === 'Rail') return <TrainFront {...props} />;
  return <CarFront {...props} />;
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
  mapColorMode,
  onMapColorModeChange,
  texturesEnabled,
  onTexturesEnabledChange,
  lod3Visible,
  detailLabel,
  focusActive,
  obscuredByInspector,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basemap: BasemapMode;
  onBasemapChange?: (basemap: BasemapMode) => void;
  satelliteOpacity: number;
  onSatelliteOpacityChange?: (opacity: number) => void;
  roadOverlayOpacity: number;
  onRoadOverlayOpacityChange?: (opacity: number) => void;
  mapColorMode: 'roof' | 'usage';
  onMapColorModeChange: (mode: 'roof' | 'usage') => void;
  texturesEnabled: boolean;
  onTexturesEnabledChange: (enabled: boolean) => void;
  lod3Visible: boolean;
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
          <div
            className="map-layer-control__segment map-layer-control__segment--two"
            role="group"
            aria-label="Basemap"
          >
            <button
              type="button"
              className={basemap === 'topplus' ? 'is-active' : ''}
              onClick={() => onBasemapChange?.('topplus')}
            >
              <MapIcon aria-hidden="true" /> TopPlus
            </button>
            <button
              type="button"
              className={basemap === 'satellite' ? 'is-active' : ''}
              onClick={() => onBasemapChange?.('satellite')}
            >
              <Satellite aria-hidden="true" /> Satellite
            </button>
          </div>
          <div className="map-layer-control__option">
            <span>Building colours</span>
            <div
              className="map-layer-control__segment map-layer-control__segment--two"
              role="group"
              aria-label="Building colours"
            >
              <button
                type="button"
                className={mapColorMode === 'usage' ? 'is-active' : ''}
                onClick={() => onMapColorModeChange('usage')}
              >
                Usage
              </button>
              <button
                type="button"
                className={mapColorMode === 'roof' ? 'is-active' : ''}
                onClick={() => onMapColorModeChange('roof')}
              >
                Roof type
              </button>
            </div>
          </div>
          <label className="map-layer-control__switch">
            <span>
              <b>Photo textures</b>
              <small>
                {lod3Visible
                  ? texturesEnabled
                    ? 'On for bundled LoD3; geometry stays on'
                    : 'Off; untextured LoD3 stays on'
                  : texturesEnabled
                    ? 'Will turn on when LoD3 appears'
                    : 'Will stay off when LoD3 appears'}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Photo textures"
              checked={texturesEnabled}
              onChange={(event) => onTexturesEnabledChange(event.target.checked)}
            />
          </label>
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

function nearestRoadSnapCandidate<T extends RoadSnapCandidate>(
  map: maplibregl.Map,
  candidates: T[],
  activeSectionId: string,
  pointer: [number, number],
  radiusPixels: number
): T | null {
  let nearest: T | null = null;
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
