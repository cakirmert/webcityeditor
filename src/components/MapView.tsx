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
import {
  COORDINATE_SYSTEM,
  WebMercatorViewport,
  type PickingInfo,
} from '@deck.gl/core';
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
import { createAnimationFrameDragDeltaBatcher } from '../lib/animation-frame-drag-deltas';
import {
  extractFootprints,
  groundFootprintsForFlatMap,
  type Footprint,
} from '../lib/footprints';
import { tintByRoofType, tintByUsage, usageRgb } from '../lib/footprint-tint';
import { findNearestZoneForPoint, findZoneForPoint, type ParcelZone } from '../lib/zoning';
import type {
  OsmPointFeature,
  OsmRoadFeature,
  RoadArea,
  RoadBandKind,
  RoadDraft,
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
  buildRoadDraftHandles,
  buildRoadDraftPaths,
  insertRoadDraftPoint,
  updateRoadDraftPoint,
  type RoadDraftHandle,
  type RoadDraftPath,
  type RoadSnapCandidate,
} from '../lib/road-draft-edit';
import { osmTrafficSignIcon } from '../lib/osm-street-point-style';
import {
  buildCityJsonMapMesh,
  type CityJsonMapMesh,
} from '../lib/cityjson-map-mesh';
import { editorPlacedAssetObjectIds } from '../lib/building-assets';
import { buildRoadVisuals } from '../lib/road-visuals';
import {
  buildRoadConnectionIndex,
  buildSelectedRoadConnections,
  type RoadConnectionNode,
  type RoadLaneContinuation,
} from '../lib/road-lane-continuations';
import {
  roadAreaMatchesDraftBand,
  roadLaneContinuationMatchesDraftBand,
} from '../lib/road-selection';
import {
  ROAD_CONNECTION_ACTIVE,
  ROAD_CONNECTION_CYAN,
  ROAD_CONNECTION_HALO,
} from '../lib/road-connection-style';
import {
  BUILDING_BLOCK_FULL_ZOOM,
  BUILDING_BLOCK_MIN_ZOOM,
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MIN_ZOOM,
  HAMBURG_TREE_MIN_ZOOM,
  buildingMapDetailMode,
  buildingDetailObjectLimit,
  capBuildingMapDetailForRoadEditing,
  editorAssetMapDetailMode,
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
  treePositionOnFlatGround,
  treeTrunkScale,
  type HamburgCityTree,
} from '../lib/hamburg-trees';
import type { BasemapMode } from '../lib/basemap';
import {
  groundHamburgLod3Tile,
  hamburgLod3TilesetUrl,
  HAMBURG_LOD1_TILESET_URL,
  HAMBURG_LOD2_TILESET_URL,
  styleHamburgBuildingTile,
} from '../lib/hamburg-lod3-tiles';
import {
  convertHamburgTileFeatureToCityJson,
  hamburgTransientTileKey,
  hideHamburgTileBuildings,
  HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE,
  HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE,
  pickHamburgBuildingForEditing,
  pickHamburgBuildingFromTilesForEditing,
  type HamburgBuildingHandoff,
  type HamburgBuildingSourceLod,
  type HamburgTile,
  type HamburgTilePickCandidate,
} from '../lib/hamburg-3d-tiles-edit';
import { Layers3, Map as MapIcon, Satellite } from 'lucide-react';

/**
 * deck.gl skips a 3D tile during picking when the tile content origin is more
 * than a quarter viewport away from the pointer. Hamburg's large b3dm cells
 * can still cover the pointer beyond that heuristic, making visibly rendered
 * buildings impossible to select. Preserve normal render culling but consider
 * every selected viewport tile for the explicit click pick.
 */
class HamburgTile3DLayer extends Tile3DLayer {
  static override layerName = 'HamburgTile3DLayer';

  override filterSubLayer(context: any): boolean {
    return super.filterSubLayer(
      context.isPicking ? { ...context, cullRect: null } : context
    );
  }
}

/** Zoom stages keep LoD0, source LoD2, and close untextured-first LoD3 distinct. */
const DATA_FIT_PADDING = 56;
const DATA_FIT_MAX_ZOOM = 14.25;
const ROAD_DATA_FIT_MAX_ZOOM = 18;
const OSM_ROAD_HIT_WIDTH_PIXELS = 20;
const DEFAULT_INITIAL_ZOOM = 12;
const EDIT_FOCUS_PADDING_DEGREES = 0.0038;
const ROAD_SNAP_RADIUS_PIXELS = 30;
const HAMBURG_CITY_CENTER_TREES_URL = 'data/hamburg/hamburg-city-center-trees.json';
const CITYJSON_MAP_MESH_VERTEX_BUDGET = 280_000;
const HAMBURG_STARTUP_SEED_ATTRIBUTE = '_webcityeditorHamburgSeed';
const HAMBURG_BUILDING_FOOTPRINT_WMS_URL =
  'https://geodienste.hamburg.de/HH_WMS_INSPIRE_Gebaeude_2D_ALKIS?' +
  'SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0' +
  '&LAYERS=BU.Building%2CBU.BuildingPart&STYLES=' +
  '&FORMAT=image%2Fpng&TRANSPARENT=true&CRS=EPSG%3A3857' +
  '&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';
function shortStableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cityJsonMeshLayers(
  id: string,
  mesh: CityJsonMapMesh,
  options: { textures?: boolean } = {}
): any[] {
  const layers: any[] = [];
  if (mesh.indices.length > 0) {
    layers.push(
      new SimpleMeshLayer<{ position: [number, number, number] }>({
        id,
        data: [{ position: [0, 0, 0] }],
        getPosition: (datum: { position: [number, number, number] }) =>
          datum.position,
        getColor: [255, 255, 255, 255],
        mesh: {
          attributes: {
            positions: { value: mesh.positions, size: 3 },
            colors: { value: mesh.colors, size: 3 },
          },
          indices: { value: mesh.indices, size: 1 },
        } as unknown as never,
        _instanced: false,
        opacity: 1,
        sizeScale: 1,
        coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
        coordinateOrigin: [mesh.anchorLngLat[0], mesh.anchorLngLat[1], 0],
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
  if (options.textures !== false) {
    mesh.textures.forEach((textureMesh, index) => {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: `${id}-texture-${index}`,
          data: [{ position: [0, 0, 0] }],
          getPosition: (datum: { position: [number, number, number] }) =>
            datum.position,
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
          coordinateOrigin: [mesh.anchorLngLat[0], mesh.anchorLngLat[1], 0],
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
  return layers;
}

function createHamburgTreeLayers(
  trees: HamburgCityTree[],
  opacity: number,
  conflictingTreeIds: ReadonlySet<string>
): any[] {
  const layers: any[] = [
    new SimpleMeshLayer<HamburgCityTree>({
      id: 'hamburg-official-tree-trunks',
      data: trees,
      mesh: TREE_TRUNK_MESH as unknown as never,
      getPosition: treePositionOnFlatGround,
      getScale: treeTrunkScale,
      getColor: (tree) =>
        conflictingTreeIds.has(tree.id)
          ? [255, 126, 42, 255]
          : [104, 74, 50, 255],
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      pickable: false,
      opacity,
      material: { ambient: 0.48, diffuse: 0.72, shininess: 5 },
      updateTriggers: { getColor: [conflictingTreeIds] },
    }),
  ];
  for (const form of TREE_CROWN_FORMS) {
    const matchingTrees = trees.filter((tree) => treeCrownForm(tree) === form);
    if (matchingTrees.length === 0) continue;
    layers.push(
      new SimpleMeshLayer<HamburgCityTree>({
        id: `hamburg-official-tree-crowns-${form}`,
        data: matchingTrees,
        mesh: TREE_CROWN_MESHES[form] as unknown as never,
        getPosition: treePositionOnFlatGround,
        getTranslation: treeCrownTranslation,
        getScale: treeCrownScale,
        getColor: (tree) =>
          conflictingTreeIds.has(tree.id)
            ? [255, 166, 64, 255]
            : treeCrownColor(tree),
        coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
        pickable: false,
        opacity,
        material: { ambient: 0.52, diffuse: 0.82, shininess: 7 },
        updateTriggers: { getColor: [conflictingTreeIds] },
      })
    );
  }
  return layers;
}

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

function rootCityObjectId(doc: CityJsonDocument, id: string): string {
  let currentId = id;
  const visited = new Set<string>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = doc.CityObjects[currentId]?.parents?.[0];
    if (!parentId || !doc.CityObjects[parentId]) break;
    currentId = parentId;
  }
  return currentId;
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
  if (isSelectedOsm2StreetsFeature(feature, selection, kind)) return ROAD_CONNECTION_ACTIVE;
  if (highlighted) return ROAD_CONNECTION_CYAN;
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
  /** When set, drag on the map moves the building through incremental,
   *  frame-coalesced CRS-metre deltas. */
  dragTransformId?: string | null;
  /** Frame-coalesced incremental movement in CRS metres. */
  onDragMove?: (dx: number, dy: number) => void;
  /** Called once after the final movement delta is flushed. */
  onDragEnd?: () => void;
  /** Multi-selection: set of building IDs highlighted in addition to selectedId. */
  multiSelectedIds?: Set<string> | null;
  /** Planning overlay polygons. */
  zones?: ParcelZone[];
  /** Called when a planning polygon is clicked. */
  onZoneSelect?: (zone: ParcelZone) => void;
  /** While Planning is open, only the 2D planning polygons receive clicks. */
  planningInteractionOnly?: boolean;
  /** Shared photo-texture preference for the map and selected-building panel. */
  texturesEnabled: boolean;
  onTexturesEnabledChange: (enabled: boolean) => void;
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
  selectedRoadBand?: { sectionId: string; bandIndex: number } | null;
  onSelectedRoadBandChange?: (
    selection: { sectionId: string; bandIndex: number } | null
  ) => void;
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
  onHamburgTreesLoaded?: (trees: HamburgCityTree[]) => void;
  initialView?: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
    disableDataFit?: boolean;
  };
  precomputedFootprints?: Footprint[];
  /** Show Hamburg's official citywide LoD1/LoD2/close-range LoD3 streams. */
  hamburgBuildingTilesEnabled?: boolean;
  /** Materialize a picked remote batch feature as a local editable building. */
  onHamburgBuildingHandoff?: (
    handoff: HamburgBuildingHandoff
  ) => string | null;
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
  onDragEnd,
  multiSelectedIds = null,
  zones = [],
  onZoneSelect,
  planningInteractionOnly = false,
  texturesEnabled,
  onTexturesEnabledChange,
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
  selectedRoadBand,
  onSelectedRoadBandChange,
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
  onHamburgTreesLoaded,
  initialView,
  precomputedFootprints,
  hamburgBuildingTilesEnabled = false,
  onHamburgBuildingHandoff,
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
  const treeLoadStartedRef = useRef(false);
  const [hamburgTrees, setHamburgTrees] = useState<HamburgCityTree[] | null>(null);
  const [treeDataError, setTreeDataError] = useState<string | null>(null);
  const [officialLod3Status, setOfficialLod3Status] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [officialLod3LoadedTiles, setOfficialLod3LoadedTiles] = useState(0);
  const [officialLod1Status, setOfficialLod1Status] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [officialLod1LoadedTiles, setOfficialLod1LoadedTiles] = useState(0);
  const [officialLod2Status, setOfficialLod2Status] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [officialLod2LoadedTiles, setOfficialLod2LoadedTiles] = useState(0);
  const [mapColorMode, setMapColorMode] = useState<'roof' | 'usage'>('roof');
  const zoomBuildingDetailMode = buildingMapDetailMode(
    zoom,
    texturesEnabled
  );
  const buildingDetailMode = capBuildingMapDetailForRoadEditing(
    zoomBuildingDetailMode,
    roadWorkspaceOpen
  );
  // Local edits can be LoD3-only, so Roads removes their photo textures but
  // keeps their highest geometry visible while the remote city drops to LoD2.
  const localBuildingDetailMode =
    roadWorkspaceOpen && zoomBuildingDetailMode === 'lod3-textured'
      ? 'lod3-untextured'
      : zoomBuildingDetailMode;
  const localAssetDetailMode = editorAssetMapDetailMode(
    zoom,
    texturesEnabled,
    roadWorkspaceOpen
  );
  const officialLoadedTilesRef = useRef<
    Record<
      HamburgBuildingSourceLod,
      Map<string, { tile: HamburgTile; generation: string }>
    >
  >({
    1: new Map(),
    2: new Map(),
    3: new Map(),
  });
  const officialLayerGenerationRef = useRef<
    Record<HamburgBuildingSourceLod, string>
  >({
    1: '',
    2: '',
    3: '',
  });
  const autoUpgradedHamburgProxyKeysRef = useRef(new Set<string>());
  const [buildingDragActive, setBuildingDragActive] = useState(false);
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [detailFocusPoint, setDetailFocusPoint] = useState<[number, number] | null>(null);
  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [internalSelectedRoadBand, setInternalSelectedRoadBand] = useState<{
    sectionId: string;
    bandIndex: number;
  } | null>(null);
  const selectedDraftBand =
    selectedRoadBand === undefined ? internalSelectedRoadBand : selectedRoadBand;
  const setSelectedDraftBand = useCallback(
    (selection: { sectionId: string; bandIndex: number } | null) => {
      if (selectedRoadBand === undefined) setInternalSelectedRoadBand(selection);
      onSelectedRoadBandChange?.(selection);
    },
    [onSelectedRoadBandChange, selectedRoadBand]
  );

  useEffect(() => {
    if (!roadDraft) {
      setSelectedDraftBand(null);
      return;
    }
    if (
      selectedDraftBand &&
      roadDraft.sections.some(
        (section) =>
          section.id === selectedDraftBand.sectionId &&
          !!section.bands[selectedDraftBand.bandIndex]
      )
    ) {
      return;
    }
    const currentSection = selectedDraftBand
      ? roadDraft.sections.find(
          (section) => section.id === selectedDraftBand.sectionId
        )
      : undefined;
    const fallbackSection =
      currentSection?.bands.length ? currentSection : roadDraft.sections[0];
    setSelectedDraftBand(
      fallbackSection?.bands.length
        ? {
            sectionId: fallbackSection.id,
            bandIndex: Math.min(
              selectedDraftBand?.bandIndex ?? 0,
              fallbackSection.bands.length - 1
            ),
          }
        : null
    );
  }, [roadDraft, selectedDraftBand, setSelectedDraftBand]);

  useEffect(() => {
    // Keep this compact control behind its button whenever another map tool
    // opens. Satellite/road blending is also available directly in Roads.
    if (roadWorkspaceOpen || zones.length > 0 || drawMode !== 'none') {
      setLayerControlOpen(false);
    }
  }, [drawMode, roadWorkspaceOpen, zones.length]);

  useEffect(() => {
    roadDraftRef.current = roadDraft;
  }, [roadDraft]);

  useEffect(() => {
    onRoadDraftChangeRef.current = onRoadDraftChange;
  }, [onRoadDraftChange]);

  useEffect(() => {
    if ((zoom < HAMBURG_TREE_MIN_ZOOM && !roadWorkspaceOpen) || treeLoadStartedRef.current) {
      return;
    }
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
  }, [roadWorkspaceOpen, zoom]);

  useEffect(() => {
    if (hamburgTrees) onHamburgTreesLoaded?.(hamburgTrees);
  }, [hamburgTrees, onHamburgTreesLoaded]);

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

  const localFootprints = useMemo(
    () => {
      const extracted = precomputedFootprints ?? extractFootprints(cityjson);
      if (!hamburgBuildingTilesEnabled) return extracted;
      // The startup CityJSON center is only an editable fallback. Leaving it
      // in the map produced the early rectangular center patch and also hid
      // the official textured LoD3 features with matching IDs.
      return extracted.filter(
        (footprint) => {
          if (
            footprint.attributes[HAMBURG_STARTUP_SEED_ATTRIBUTE] === true
          ) {
            return false;
          }
          const isSelectionProxy =
            footprint.attributes[
              HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE
            ] === true;
          const isGeometryOverride =
            footprint.attributes[
              HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE
            ] === true;
          return !isSelectionProxy || isGeometryOverride;
        }
      );
    },
    // reloadToken is intentionally a dep so "Reload view" after an edit
    // (e.g. changed measuredHeight) rebuilds the deck.gl data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityjson, hamburgBuildingTilesEnabled, reloadToken, precomputedFootprints]
  );

  const hiddenHamburgBuildingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const object of Object.values(cityjson.CityObjects)) {
      const sourceId = object.attributes?._hamburgTileFeatureId;
      if (typeof sourceId !== 'string' || !sourceId) continue;
      const isPassiveSelectionProxy =
        object.attributes?.[HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE] === true &&
        object.attributes?.[HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE] !== true;
      if (!isPassiveSelectionProxy) ids.add(sourceId);
    }
    return ids;
  }, [cityjson, reloadToken]);
  const hiddenHamburgBuildingGenerationKey = useMemo(
    () =>
      shortStableHash(
        [...hiddenHamburgBuildingIds].sort().join('\u001f')
      ),
    [hiddenHamburgBuildingIds]
  );
  const selectedPassiveHamburgProxy = useMemo(() => {
    if (!selectedId) return null;
    const object = cityjson.CityObjects[selectedId];
    const sourceFeatureId = object?.attributes?._hamburgTileFeatureId;
    const sourceLod = Number(object?.attributes?._hamburgTileLod ?? 0);
    if (
      typeof sourceFeatureId !== 'string' ||
      object?.attributes?.[HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE] !== true ||
      object?.attributes?.[HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE] === true
    ) {
      return null;
    }
    return {
      sourceFeatureId,
      sourceLod: Number.isFinite(sourceLod) ? sourceLod : 0,
    };
  }, [cityjson, reloadToken, selectedId]);

  const footprints = localFootprints;

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
    if (!buildingDragActive && preview?.polygon?.length) {
      return expandLngLatBbox(pointsBbox(preview.polygon), EDIT_FOCUS_PADDING_DEGREES);
    }
    if (dragTransformId && selectedId) {
      const selectedPoints = footprints
        .filter((footprint) => footprint.id === selectedId || footprint.parentId === selectedId)
        .flatMap((footprint) => footprint.polygon.map(([lng, lat]) => [lng, lat] as [number, number]));
      return expandLngLatBbox(pointsBbox(selectedPoints), EDIT_FOCUS_PADDING_DEGREES);
    }
    return null;
  }, [
    roadDraft,
    footprintEdit,
    preview?.polygon,
    buildingDragActive,
    dragTransformId,
    selectedId,
    footprints,
  ]);

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
    () => groundFootprintsForFlatMap(renderedFootprints),
    [renderedFootprints]
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
  const roadConnectionIndex = useMemo(
    () => buildRoadConnectionIndex(roadAreas),
    [roadAreas]
  );
  const selectedRoadConnections = useMemo(
    () =>
      buildSelectedRoadConnections(
        roadConnectionIndex,
        roadWorkspaceOpen ? selectedRoadAreaId : null,
        roadWorkspaceOpen ? roadDraft : null
      ),
    [roadConnectionIndex, roadDraft, roadWorkspaceOpen, selectedRoadAreaId]
  );
  const roadLaneContinuations = selectedRoadConnections.continuations;
  const connectionRoadAreas = useMemo(
    () =>
      renderedRoadAreas.filter(
        (area) =>
          roadAreaKind(area).toLowerCase() !== 'intersection' &&
          selectedRoadConnections.roadIds.has(area.roadId) &&
          !(roadDraft && area.roadId === selectedRoadConnections.focusRoadId)
      ),
    [renderedRoadAreas, roadDraft, selectedRoadConnections]
  );
  const connectionJunctionAreas = useMemo(
    () =>
      renderedRoadAreas.filter((area) =>
        selectedRoadConnections.junctionAreaIds.has(area.id)
      ),
    [renderedRoadAreas, selectedRoadConnections]
  );
  const selectedHighlightBand = roadDraft?.sections
    .find((section) => section.id === selectedDraftBand?.sectionId)
    ?.bands[selectedDraftBand?.bandIndex ?? -1];
  const roadSelectionHighlightKey = [
    roadDraft?.id ?? 'none',
    selectedDraftBand?.sectionId ?? 'none',
    selectedDraftBand?.bandIndex ?? -1,
    selectedHighlightBand?.id ??
      `${selectedHighlightBand?.kind ?? 'none'}:${selectedHighlightBand?.sourceType ?? ''}`,
    roadPreviewAreas.length > 0 ? 'preview' : 'saved',
  ].join(':');
  const selectedRoadBandAreas = useMemo(
    () =>
      roadWorkspaceOpen
        ? (roadPreviewAreas.length > 0 ? roadPreviewAreas : renderedRoadAreas).filter(
            (area) => roadAreaMatchesDraftBand(area, roadDraft, selectedDraftBand)
          )
        : [],
    [
      renderedRoadAreas,
      roadDraft,
      roadPreviewAreas,
      roadWorkspaceOpen,
      roadSelectionHighlightKey,
      selectedDraftBand,
    ]
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
    if (!hamburgTrees || (zoom < HAMBURG_TREE_MIN_ZOOM && !editFocusBbox)) return [];
    const scope = editFocusBbox ?? viewportBbox;
    return scope
      ? hamburgTrees.filter((tree) =>
          pointInsideBbox([tree.position[0], tree.position[1]], scope)
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
  const officialDetailLod: 'lod2' | 'lod3' =
    buildingDetailMode === 'lod3-untextured' ||
    buildingDetailMode === 'lod3-textured'
      ? 'lod3'
      : 'lod2';
  const localDetailLod: 'lod2' | 'lod3' =
    localBuildingDetailMode === 'lod3-untextured' ||
    localBuildingDetailMode === 'lod3-textured'
      ? 'lod3'
      : 'lod2';
  const roadEditingCapsBuildingDetail =
    roadWorkspaceOpen && officialDetailLod !== localDetailLod;
  const officialLod1Requested =
    hamburgBuildingTilesEnabled && buildingDetailMode === 'lod1';
  const officialLod1Ready =
    officialLod1Requested && officialLod1Status === 'ready';
  const officialLod1Active =
    officialLod1Requested && officialLod1Status !== 'error';
  const officialLod3Requested =
    hamburgBuildingTilesEnabled &&
    (buildingDetailMode === 'lod3-untextured' ||
      buildingDetailMode === 'lod3-textured');
  const officialLod3Variant = officialLod3Requested
    ? buildingDetailMode
    : 'idle';
  const officialLod3TilesetUrl = hamburgLod3TilesetUrl(
    buildingDetailMode === 'lod3-textured'
  );
  const officialLod3Active =
    officialLod3Requested && officialLod3Status !== 'error';
  const officialLod3Ready =
    officialLod3Active && officialLod3Status === 'ready';
  // Stream Hamburg's native lightweight LoD1 blocks in the same zoom range as
  // the old local footprint extrusions. They stay native on the GPU; only one
  // clicked feature is converted into an editable CityJSON proxy.
  const officialLod2Requested =
    hamburgBuildingTilesEnabled &&
    (buildingDetailMode === 'lod2' ||
      buildingDetailMode === 'lod3-untextured' ||
      buildingDetailMode === 'lod3-textured');
  const officialLod2Ready =
    officialLod2Requested && officialLod2Status === 'ready';
  const officialLod2Active =
    officialLod2Requested && officialLod2Status !== 'error';
  const officialLod1Generation =
    `lod1:${mapColorMode}:${hiddenHamburgBuildingGenerationKey}`;
  // LoD2 becomes a lighter fallback once the raw zoom tier reaches LoD3.
  // Deriving the profile from the raw tier keeps it stable while Roads is
  // open, so the already-loaded fallback can become foreground immediately.
  const officialLod2Profile =
    zoomBuildingDetailMode === 'lod3-untextured' ||
    zoomBuildingDetailMode === 'lod3-textured'
      ? 'fallback'
      : 'foreground';
  const officialLod2Generation =
    `lod2:${officialLod2Profile}:${mapColorMode}:${hiddenHamburgBuildingGenerationKey}`;
  const officialLod3Generation =
    `lod3:${officialLod3Variant}:${mapColorMode}:${hiddenHamburgBuildingGenerationKey}`;
  officialLayerGenerationRef.current[1] = officialLod1Generation;
  officialLayerGenerationRef.current[2] = officialLod2Generation;
  officialLayerGenerationRef.current[3] = officialLod3Generation;

  useEffect(() => {
    officialLoadedTilesRef.current[1].clear();
    setOfficialLod1LoadedTiles(0);
    if (!officialLod1Requested) {
      setOfficialLod1Status('idle');
      return;
    }
    setOfficialLod1Status('loading');
  }, [
    officialLod1Generation,
    officialLod1Requested,
  ]);

  useEffect(() => {
    officialLoadedTilesRef.current[2].clear();
    setOfficialLod2LoadedTiles(0);
    if (!officialLod2Requested) {
      setOfficialLod2Status('idle');
      return;
    }
    setOfficialLod2Status('loading');
  }, [
    officialLod2Generation,
    officialLod2Requested,
  ]);

  useEffect(() => {
    if (!officialLod1Requested) return;
    const controller = new AbortController();
    void fetch(HAMBURG_LOD1_TILESET_URL, {
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (
          officialLayerGenerationRef.current[1] !==
          officialLod1Generation
        ) {
          return;
        }
        setOfficialLod1Status('error');
        setWarning(
          `Official Hamburg LoD1 tileset is unavailable; ALKIS footprints remain visible: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    return () => controller.abort();
  }, [officialLod1Generation, officialLod1Requested]);

  useEffect(() => {
    officialLoadedTilesRef.current[3].clear();
    setOfficialLod3LoadedTiles(0);
    if (!officialLod3Requested) {
      setOfficialLod3Status('idle');
      return;
    }
    setOfficialLod3Status('loading');
  }, [
    officialLod3Generation,
    officialLod3Requested,
  ]);

  useEffect(() => {
    if (!officialLod2Requested) return;
    const controller = new AbortController();
    void fetch(HAMBURG_LOD2_TILESET_URL, {
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (
          officialLayerGenerationRef.current[2] !==
          officialLod2Generation
        ) {
          return;
        }
        setOfficialLod2Status('error');
        setWarning(
          `Official Hamburg LoD2 tileset is unavailable; ALKIS footprints remain visible: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    return () => controller.abort();
  }, [officialLod2Generation, officialLod2Requested]);

  useEffect(() => {
    if (!officialLod3Requested) return;
    const controller = new AbortController();
    void fetch(officialLod3TilesetUrl, {
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (
          officialLayerGenerationRef.current[3] !==
          officialLod3Generation
        ) {
          return;
        }
        setOfficialLod3Status('error');
        setWarning(
          `Official Hamburg LoD3 tileset is unavailable; LoD2 remains visible: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    return () => controller.abort();
  }, [
    officialLod3Generation,
    officialLod3Requested,
    officialLod3TilesetUrl,
  ]);

  const trackOfficialTileLoad = useCallback(
    (
      tile: HamburgTile,
      sourceLod: HamburgBuildingSourceLod,
      generation: string
    ) => {
      if (officialLayerGenerationRef.current[sourceLod] !== generation) {
        return;
      }
      const tiles = officialLoadedTilesRef.current[sourceLod];
      tiles.set(hamburgTransientTileKey(tile, sourceLod), {
        tile,
        generation,
      });
      if (sourceLod === 1) {
        setOfficialLod1LoadedTiles(tiles.size);
        setOfficialLod1Status('ready');
      } else if (sourceLod === 2) {
        setOfficialLod2LoadedTiles(tiles.size);
        setOfficialLod2Status('ready');
      } else {
        setOfficialLod3LoadedTiles(tiles.size);
        setOfficialLod3Status('ready');
      }
    },
    []
  );

  const trackOfficialTileUnload = useCallback(
    (
      tile: HamburgTile,
      sourceLod: HamburgBuildingSourceLod,
      generation: string
    ) => {
      const tiles = officialLoadedTilesRef.current[sourceLod];
      const key = hamburgTransientTileKey(tile, sourceLod);
      const tracked = tiles.get(key);
      if (
        !tracked ||
        tracked.tile !== tile ||
        tracked.generation !== generation
      ) {
        return;
      }
      tiles.delete(key);
      if (sourceLod === 1) {
        setOfficialLod1LoadedTiles(tiles.size);
        if (tiles.size === 0 && officialLod1Requested) {
          setOfficialLod1Status('loading');
        }
      } else if (sourceLod === 2) {
        setOfficialLod2LoadedTiles(tiles.size);
        if (tiles.size === 0 && officialLod2Requested) {
          setOfficialLod2Status('loading');
        }
      } else {
        setOfficialLod3LoadedTiles(tiles.size);
        if (tiles.size === 0 && officialLod3Requested) {
          setOfficialLod3Status('loading');
        }
      }
    },
    [officialLod1Requested, officialLod2Requested, officialLod3Requested]
  );

  const handleOfficialLod1TileLoad = useCallback(
    (tile: HamburgTile) => {
      if (
        !officialLod1Requested ||
        officialLayerGenerationRef.current[1] !==
          officialLod1Generation
      ) {
        return;
      }
      try {
        groundHamburgLod3Tile(tile);
        styleHamburgBuildingTile(tile, mapColorMode);
        hideHamburgTileBuildings(tile, hiddenHamburgBuildingIds);
      } catch (error) {
        setWarning(
          `One official Hamburg LoD1 tile could not be prepared: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      trackOfficialTileLoad(tile, 1, officialLod1Generation);
    },
    [
      hiddenHamburgBuildingIds,
      mapColorMode,
      officialLod1Generation,
      officialLod1Requested,
      trackOfficialTileLoad,
    ]
  );
  const handleOfficialLod1TileUnload = useCallback(
    (tile: HamburgTile) =>
      trackOfficialTileUnload(tile, 1, officialLod1Generation),
    [officialLod1Generation, trackOfficialTileUnload]
  );
  const handleOfficialLod1TileError = useCallback(
    (_tile: unknown, firstMessage: string, secondMessage: string) => {
      if (
        !officialLod1Requested ||
        officialLayerGenerationRef.current[1] !==
          officialLod1Generation
      ) {
        return;
      }
      setOfficialLod1Status(
        officialLoadedTilesRef.current[1].size > 0 ? 'ready' : 'loading'
      );
      setWarning(
        `One official Hamburg LoD1 tile failed; ALKIS footprints remain visible there: ${
          firstMessage || 'unknown error'
        }${secondMessage ? ` (${secondMessage})` : ''}`
      );
    },
    [officialLod1Generation, officialLod1Requested]
  );

  const handleOfficialLod3TileLoad = useCallback(
    (tile: HamburgTile) => {
      if (
        officialLayerGenerationRef.current[3] !==
        officialLod3Generation
      ) {
        return;
      }
      try {
        groundHamburgLod3Tile(tile);
        if (officialLod3Variant !== 'lod3-textured') {
          styleHamburgBuildingTile(tile, mapColorMode);
        }
        hideHamburgTileBuildings(tile, hiddenHamburgBuildingIds);
        if (
          selectedPassiveHamburgProxy &&
          selectedPassiveHamburgProxy.sourceLod < 3 &&
          onHamburgBuildingHandoff
        ) {
          const upgradeKey =
            `${officialLod3Generation}:` +
            selectedPassiveHamburgProxy.sourceFeatureId;
          if (!autoUpgradedHamburgProxyKeysRef.current.has(upgradeKey)) {
            const handoff = convertHamburgTileFeatureToCityJson(
              tile,
              selectedPassiveHamburgProxy.sourceFeatureId,
              { sourceLod: 3, texturesAvailable: true }
            );
            if (handoff) {
              autoUpgradedHamburgProxyKeysRef.current.add(upgradeKey);
              const upgradedId = onHamburgBuildingHandoff(handoff);
              if (upgradedId) {
                setWarning(
                  `Building ${upgradedId} edit geometry upgraded to LoD3.`
                );
              }
            }
          }
        }
      } catch (error) {
        setWarning(
          `One official Hamburg LoD3 tile could not be prepared: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      trackOfficialTileLoad(tile, 3, officialLod3Generation);
    },
    [
      hiddenHamburgBuildingIds,
      mapColorMode,
      officialLod3Generation,
      officialLod3Variant,
      onHamburgBuildingHandoff,
      selectedPassiveHamburgProxy,
      trackOfficialTileLoad,
    ]
  );
  const handleOfficialLod3TileUnload = useCallback(
    (tile: HamburgTile) =>
      trackOfficialTileUnload(tile, 3, officialLod3Generation),
    [officialLod3Generation, trackOfficialTileUnload]
  );

  const handleOfficialLod3TileError = useCallback(
    (_tile: unknown, firstMessage: string, secondMessage: string) => {
      if (
        officialLayerGenerationRef.current[3] !==
        officialLod3Generation
      ) {
        return;
      }
      setOfficialLod3Status(
        officialLoadedTilesRef.current[3].size > 0 ? 'ready' : 'loading'
      );
      setWarning(
        `One official Hamburg LoD3 tile failed; LoD2 remains visible there: ${
          firstMessage || 'unknown error'
        }${secondMessage ? ` (${secondMessage})` : ''}`
      );
    },
    [officialLod3Generation]
  );
  const handleOfficialLod2TileLoad = useCallback(
    (tile: HamburgTile) => {
      if (
        !officialLod2Requested ||
        officialLayerGenerationRef.current[2] !==
          officialLod2Generation
      ) {
        return;
      }
      try {
        groundHamburgLod3Tile(tile);
        styleHamburgBuildingTile(tile, mapColorMode);
        hideHamburgTileBuildings(tile, hiddenHamburgBuildingIds);
        if (
          selectedPassiveHamburgProxy &&
          selectedPassiveHamburgProxy.sourceLod < 2 &&
          onHamburgBuildingHandoff
        ) {
          const upgradeKey =
            `${officialLod2Generation}:` +
            selectedPassiveHamburgProxy.sourceFeatureId;
          if (!autoUpgradedHamburgProxyKeysRef.current.has(upgradeKey)) {
            const handoff = convertHamburgTileFeatureToCityJson(
              tile,
              selectedPassiveHamburgProxy.sourceFeatureId,
              { sourceLod: 2 }
            );
            if (handoff) {
              autoUpgradedHamburgProxyKeysRef.current.add(upgradeKey);
              const upgradedId = onHamburgBuildingHandoff(handoff);
              if (upgradedId) {
                setWarning(
                  `Building ${upgradedId} edit geometry upgraded to LoD2.`
                );
              }
            }
          }
        }
      } catch (error) {
        setWarning(
          `One official Hamburg LoD2 tile could not be prepared: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      trackOfficialTileLoad(tile, 2, officialLod2Generation);
    },
    [
      hiddenHamburgBuildingIds,
      mapColorMode,
      officialLod2Generation,
      officialLod2Requested,
      onHamburgBuildingHandoff,
      selectedPassiveHamburgProxy,
      trackOfficialTileLoad,
    ]
  );
  const handleOfficialLod2TileUnload = useCallback(
    (tile: HamburgTile) =>
      trackOfficialTileUnload(tile, 2, officialLod2Generation),
    [officialLod2Generation, trackOfficialTileUnload]
  );
  const handleOfficialLod2TileError = useCallback(
    (_tile: unknown, firstMessage: string, secondMessage: string) => {
      if (
        !officialLod2Requested ||
        officialLayerGenerationRef.current[2] !==
          officialLod2Generation
      ) {
        return;
      }
      setOfficialLod2Status(
        officialLoadedTilesRef.current[2].size > 0 ? 'ready' : 'loading'
      );
      setWarning(
        `One official Hamburg LoD2 tile failed; ALKIS footprints remain visible there: ${
          firstMessage || 'unknown error'
        }${secondMessage ? ` (${secondMessage})` : ''}`
      );
    },
    [officialLod2Generation, officialLod2Requested]
  );
  const treeDetailLabel =
    zoom < HAMBURG_TREE_MIN_ZOOM && !editFocusBbox
      ? 'official street trees at zoom 16.5'
      : treeDataError
        ? 'street-tree data unavailable'
        : hamburgTrees
          ? `${renderedHamburgTrees.length} official street trees ${
              editFocusBbox ? 'around this edit' : 'in view'
            }`
          : 'official street trees loading';
  const officialTileColorLabel =
    mapColorMode === 'usage'
      ? 'building usage colors'
      : 'semantic roof and wall colors';
  const officialBuildingDetailLabel =
    buildingDetailMode === 'lod0'
      ? 'Official Hamburg ALKIS footprint overview · lightweight raster tiles'
      : buildingDetailMode === 'lod1'
        ? officialLod1Status === 'error'
          ? 'Official Hamburg LoD1 unavailable · ALKIS footprint fallback'
          : officialLod1Ready
            ? `Official Hamburg lightweight LoD1 blocks · ${officialLod1LoadedTiles} streamed tiles · citywide low-detail context · tap a building to edit locally`
            : 'Streaming official Hamburg LoD1 blocks · ALKIS footprints remain visible while loading'
        : buildingDetailMode === 'lod2'
          ? officialLod2Status === 'error'
            ? 'Official Hamburg LoD2 unavailable · ALKIS footprint fallback'
            : officialLod2Ready
              ? `Official Hamburg citywide LoD2 · ${officialLod2LoadedTiles} streamed tiles · ${officialTileColorLabel}${
                  roadEditingCapsBuildingDetail
                    ? ' · road editing temporarily keeps remote buildings at LoD2'
                    : ' · tap a building to edit locally'
                }`
              : 'Streaming official Hamburg LoD2 · ALKIS footprints remain visible while loading'
          : officialLod3Status === 'error'
            ? `Official ${
                buildingDetailMode === 'lod3-textured' ? 'textured' : 'untextured'
              } LoD3 unavailable · LoD2 fallback`
            : officialLod3Ready
              ? `Official Hamburg ${
                  buildingDetailMode === 'lod3-textured'
                    ? '20 cm textured'
                    : mapColorMode === 'usage'
                      ? 'usage-color untextured'
                      : 'semantic-color untextured'
                } LoD3 · ${officialLod3LoadedTiles} streamed tiles · tap a building to edit locally`
              : `Streaming official Hamburg ${
                  buildingDetailMode === 'lod3-textured'
                    ? '20 cm textured LoD3'
                    : 'untextured LoD3 geometry'
                } · LoD2 remains visible while loading`;
  const localAssetObjectIds = useMemo(
    () => editorPlacedAssetObjectIds(cityjson),
    [cityjson, reloadToken]
  );
  const detailScopeBbox = editFocusBbox ?? viewportBbox;
  const detailFocus = editFocusBbox
    ? [
        (editFocusBbox[0] + editFocusBbox[2]) / 2,
        (editFocusBbox[1] + editFocusBbox[3]) / 2,
      ] as [number, number]
    : detailFocusPoint;
  const detailSelection = useMemo(() => {
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
    const localIds = new Set<string>();
    const detailedFootprintIds = new Set<string>();
    // More buildings switch to their highest source geometry progressively as
    // the view closes in. Each building swaps once; two LoDs are never drawn
    // on top of one another, avoiding z-fighting and doubled walls.
    const detailLimit = buildingDetailObjectLimit(detailOpacity);
    for (const footprint of visible.slice(0, detailLimit)) {
      detailedFootprintIds.add(footprint.id);
      if (footprint.parentId) detailedFootprintIds.add(footprint.parentId);
      addCityObjectWithDescendants(cityjson, footprint.id, localIds);
      if (footprint.parentId) {
        addCityObjectWithDescendants(cityjson, footprint.parentId, localIds);
      }
    }
    if (selectedId) {
      const selectedAttributes = cityjson.CityObjects[selectedId]?.attributes;
      const isPassiveSelectionProxy =
        selectedAttributes?.[HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE] === true &&
        selectedAttributes?.[HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE] !== true;
      if (!isPassiveSelectionProxy) {
        addCityObjectWithDescendants(cityjson, selectedId, localIds);
      }
    }
    // Editor-created assets have no LoD2 geometry. They use their dedicated
    // local overlay throughout the detail zoom range instead of entering the
    // source LoD selector and disappearing before official LoD3 activates.
    for (const localAssetId of localAssetObjectIds) localIds.delete(localAssetId);
    return {
      localIds,
      detailedFootprintIds,
    };
  }, [
    cityjson,
    detailEnabled,
    detailFocus,
    detailOpacity,
    detailScopeBbox,
    localAssetObjectIds,
    renderedFootprints,
    selectedId,
  ]);
  const detailObjectIds =
    detailSelection && detailSelection.localIds.size > 0
      ? detailSelection.localIds
      : null;

  const detailObjectColors = useMemo(() => {
    if (mapColorMode !== 'usage' || !detailObjectIds) return undefined;
    const colors = new Map<string, readonly [number, number, number]>();
    for (const objectId of detailObjectIds) {
      const rootId = rootCityObjectId(cityjson, objectId);
      if (colors.has(rootId)) continue;
      const [red, green, blue] = usageRgb(cityjson.CityObjects[rootId]?.attributes?.function);
      colors.set(rootId, [red / 255, green / 255, blue / 255]);
    }
    return colors;
  }, [cityjson, detailObjectIds, mapColorMode]);

  const detailMesh = useMemo(
    () =>
      detailObjectIds
        ? buildCityJsonMapMesh(cityjson, {
          objectIds: detailObjectIds,
            maxOutputVertices: CITYJSON_MAP_MESH_VERTEX_BUDGET,
          maxLod: localDetailLod === 'lod3' ? 3.9 : 2.9,
          groundObjectGroups: true,
          texturesEnabled:
            localDetailLod === 'lod3' &&
            localBuildingDetailMode === 'lod3-textured',
          objectColors: detailObjectColors,
          })
        : null,
    [
      cityjson,
      localDetailLod,
      localBuildingDetailMode,
      detailObjectColors,
      detailObjectIds,
      reloadToken,
    ]
  );
  const localAssetOverlayMesh = useMemo(
    () =>
      localAssetDetailMode !== 'block' && localAssetObjectIds.size > 0
        ? buildCityJsonMapMesh(cityjson, {
            objectIds: localAssetObjectIds,
            maxOutputVertices: CITYJSON_MAP_MESH_VERTEX_BUDGET,
            maxLod: 3.9,
            groundObjectGroups: true,
            texturesEnabled: localAssetDetailMode === 'lod3-textured',
          })
        : null,
    [
      cityjson,
      localAssetDetailMode,
      localAssetObjectIds,
      reloadToken,
    ]
  );
  const blockFootprints = useMemo(
    () =>
      groundedRenderedFootprints.filter((footprint) => {
        const inDetailMesh =
          detailSelection?.detailedFootprintIds.has(footprint.id) ||
          (!!footprint.parentId &&
            detailSelection?.detailedFootprintIds.has(footprint.parentId));
        const inLocalAssetMesh =
          !!localAssetOverlayMesh &&
          (localAssetObjectIds.has(footprint.id) ||
            (!!footprint.parentId && localAssetObjectIds.has(footprint.parentId)));
        return !inDetailMesh && !inLocalAssetMesh;
      }),
    [
      groundedRenderedFootprints,
      detailSelection,
      localAssetObjectIds,
      localAssetOverlayMesh,
    ]
  );
  const blockOpacity = smoothZoomStep(
    BUILDING_BLOCK_MIN_ZOOM,
    BUILDING_BLOCK_FULL_ZOOM,
    zoom
  );

  const inspectedBuildingFootprints = useMemo<Footprint[]>(
    () => {
      const previewPolygon = preview?.polygon ?? footprintEdit?.footprintWgs84;
      if (previewPolygon && previewPolygon.length >= 3) {
        return [
          {
            id: preview?.polygon ? '__building_preview__' : footprintEdit!.buildingId,
            type: 'Building',
            polygon: previewPolygon.map(
              ([lng, lat]) => [lng, lat, 0] as [number, number, number]
            ),
            height: preview?.height ?? 10,
            baseElevation: 0,
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
    [footprintEdit, footprints, preview?.height, preview?.polygon, selectedId]
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
  const conflictingTreeIds = useMemo(
    () =>
      new Set(
        visibleRoadFitConflicts
          .filter((conflict) => conflict.kind === 'tree_overlap')
          .flatMap((conflict) => (conflict.affectedId ? [conflict.affectedId] : []))
      ),
    [visibleRoadFitConflicts]
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
  const buildingSelectionEnabled =
    !mapSelectionLocked && !planningInteractionOnly;
  const roadSelectionEnabled =
    !mapSelectionLocked && roadWorkspaceOpen && !planningInteractionOnly;
  const planningSelectionEnabled =
    !mapSelectionLocked && planningInteractionOnly;
  const streamedBuildingSelectionEnabled =
    buildingSelectionEnabled &&
    !roadWorkspaceOpen &&
    !!onHamburgBuildingHandoff;
  const acceptHamburgBuildingHandoff = useCallback(
    (handoff: HamburgBuildingHandoff | null): boolean => {
      if (!handoff) {
        setWarning(
          'Could not isolate that streamed Hamburg building. Try a clearer roof or wall.'
        );
        return true;
      }
      if (handoff.sourceLod === 3) {
        for (const entry of officialLoadedTilesRef.current[2].values()) {
          if (entry.generation !== officialLod2Generation) continue;
          const lowerHandoff = convertHamburgTileFeatureToCityJson(
            entry.tile,
            handoff.sourceFeatureId,
            { sourceLod: 2 }
          );
          if (!lowerHandoff) continue;
          onHamburgBuildingHandoff?.(lowerHandoff);
          break;
        }
      }
      const localId = onHamburgBuildingHandoff?.(handoff);
      if (!localId) return true;
      setWarning(
        `Building ${localId} is ready to edit locally. Its streamed LoD remains visible until a geometry change is saved.`
      );
      return true;
    },
    [officialLod2Generation, onHamburgBuildingHandoff]
  );
  const handleOfficialBuildingClick = useCallback(
    (
      info: PickingInfo<any>,
      sourceLod: HamburgBuildingSourceLod
    ) => {
      if (
        !streamedBuildingSelectionEnabled ||
        !info.object ||
        !info.viewport
      ) {
        return false;
      }
      try {
        return acceptHamburgBuildingHandoff(
          pickHamburgBuildingForEditing(
            info.object,
            {
              x: info.x,
              y: info.y,
              viewport: info.viewport,
            },
            {
              sourceLod,
              texturesAvailable: sourceLod === 3,
            }
          )
        );
      } catch (error) {
        setWarning(
          `Could not convert the streamed building: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return true;
    },
    [
      acceptHamburgBuildingHandoff,
      streamedBuildingSelectionEnabled,
    ]
  );

  const handleBuildingFootprintClick = useCallback(
    (info: PickingInfo<Footprint>, event: unknown) => {
      if (!buildingSelectionEnabled || !info.object) {
        if (buildingSelectionEnabled) onSelect(null);
        return;
      }
      const sourceEvent = (
        event as { srcEvent?: { ctrlKey?: boolean; metaKey?: boolean } }
      )?.srcEvent;
      onSelect({
        objectId: info.object.id,
        ctrlKey: !!(sourceEvent?.ctrlKey || sourceEvent?.metaKey),
      });
    },
    [
      buildingSelectionEnabled,
      onSelect,
    ]
  );

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
          hamburgBuildingFootprints: {
            type: 'raster',
            tiles: [HAMBURG_BUILDING_FOOTPRINT_WMS_URL],
            tileSize: 256,
            attribution:
              'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
            minzoom: 7,
            maxzoom: 16,
          },
        },
        layers: [
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
          {
            id: 'hamburg-building-footprints',
            type: 'raster',
            source: 'hamburgBuildingFootprints',
            layout: { visibility: 'none' },
            paint: {
              'raster-opacity': 0.72,
              'raster-fade-duration': 0,
            },
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

    // Keep deck.gl on its own foreground canvas above MapLibre's raster
    // basemap. Interleaving puts the raster and z=0 road polygons in one
    // depth buffer, where they can z-fight and the raster can obscure roads.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);

    let liveZoomFrame: number | null = null;
    const syncLiveZoom = () => {
      if (liveZoomFrame !== null) return;
      liveZoomFrame = window.requestAnimationFrame(() => {
        liveZoomFrame = null;
        // A twentieth of a zoom level is visually continuous but avoids
        // rebuilding React/deck.gl layer props on every wheel/trackpad frame.
        setZoom(Math.round(map.getZoom() * 20) / 20);
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
      const canvas = map.getCanvas();
      const pitchProgress = Math.max(0, Math.min(1, map.getPitch() / 75));
      const nearScreenPoint = map.unproject([
        canvas.clientWidth / 2,
        canvas.clientHeight * (0.5 + pitchProgress * 0.17),
      ]);
      setDetailFocusPoint([nearScreenPoint.lng, nearScreenPoint.lat]);
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

  // Tile3DLayer's composite-layer click callback is not consistently forwarded
  // by MapboxOverlay in overlaid mode. Pick the active official tier directly
  // from MapLibre's click event instead. Restricting the pick to the exact
  // generation also prevents roads, local edits, or a stale fallback layer
  // from stealing the building handoff.
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (
      !map ||
      !overlay ||
      !streamedBuildingSelectionEnabled ||
      (!officialLod1Active && !officialLod2Active && !officialLod3Active)
    ) {
      return;
    }

    const pickOfficialTier = (
      event: maplibregl.MapMouseEvent,
      layerId: string,
      sourceLod: HamburgBuildingSourceLod
    ): boolean => {
      const picked = overlay.pickObject({
        x: event.point.x,
        y: event.point.y,
        radius: 4,
        layerIds: [layerId],
      });
      const sourceTile =
        (picked as (PickingInfo<any> & { sourceTile?: unknown }) | null)
          ?.sourceTile ?? picked?.object;
      if (!picked || !sourceTile) return false;
      return handleOfficialBuildingClick(
        { ...picked, object: sourceTile } as PickingInfo<any>,
        sourceLod
      );
    };

    const handler = (event: maplibregl.MapMouseEvent) => {
      if (
        officialLod3Active &&
        pickOfficialTier(
          event,
          `hamburg-official-${officialLod3Generation}`,
          3
        )
      ) {
        return;
      }
      if (officialLod2Active) {
        if (
          pickOfficialTier(
            event,
            `hamburg-official-${officialLod2Generation}`,
            2
          )
        ) {
          return;
        }
      }
      if (officialLod1Active) {
        if (
          pickOfficialTier(
            event,
            `hamburg-official-${officialLod1Generation}`,
            1
          )
        ) {
          return;
        }
      }

      // Some Hamburg b3dm payloads do not expose a GPU-pickable scenegraph
      // instance through Tile3DLayer. Fall back to a bounded screen-space
      // search over only the currently loaded tiles. Feature extraction is
      // cached and CityJSON is still created for the one winning building.
      const candidates: HamburgTilePickCandidate[] = [];
      if (officialLod3Active) {
        for (const entry of officialLoadedTilesRef.current[3].values()) {
          if (entry.generation === officialLod3Generation) {
            candidates.push({
              tile: entry.tile,
              sourceLod: 3 as const,
              texturesAvailable: true,
            });
          }
        }
      }
      if (officialLod2Active) {
        for (const entry of officialLoadedTilesRef.current[2].values()) {
          if (entry.generation === officialLod2Generation) {
            candidates.push({ tile: entry.tile, sourceLod: 2 as const });
          }
        }
      }
      if (officialLod1Active) {
        for (const entry of officialLoadedTilesRef.current[1].values()) {
          if (entry.generation === officialLod1Generation) {
            candidates.push({ tile: entry.tile, sourceLod: 1 as const });
          }
        }
      }
      if (candidates.length === 0) return;

      const center = map.getCenter();
      const canvas = map.getCanvas();
      const deckViewport = (
        overlay as unknown as {
          _deck?: { getViewports?: () => WebMercatorViewport[] };
        }
      )._deck?.getViewports?.()[0];
      const viewport =
        deckViewport ??
        new WebMercatorViewport({
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          padding: map.getPadding(),
        });
      candidates.sort((left, right) => {
        const originDistance = (candidate: (typeof candidates)[number]) => {
          const origin = (
            candidate.tile.content as
              | { cartographicOrigin?: ArrayLike<number> }
              | undefined
          )?.cartographicOrigin;
          if (!origin || origin.length < 2) return Infinity;
          const projected = viewport.project([
            Number(origin[0]),
            Number(origin[1]),
            Number(origin[2] ?? 0),
          ]);
          return Math.hypot(
            projected[0] - event.point.x,
            projected[1] - event.point.y
          );
        };
        return originDistance(left) - originDistance(right);
      });
      const pick = {
        x: event.point.x,
        y: event.point.y,
        viewport,
      };
      let handoff: HamburgBuildingHandoff | null = null;
      // The nearest cell wins in the common case, avoiding geometry extraction
      // for every visible tile. Continue through a small six-cell halo only
      // when the click falls close to a tile edge.
      for (const candidate of candidates.slice(0, 6)) {
        handoff = pickHamburgBuildingFromTilesForEditing(
          [candidate],
          pick,
          18
        );
        if (handoff) break;
      }
      if (handoff) acceptHamburgBuildingHandoff(handoff);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [
    acceptHamburgBuildingHandoff,
    handleOfficialBuildingClick,
    officialLod1Active,
    officialLod1Generation,
    officialLod2Active,
    officialLod2Generation,
    officialLod3Active,
    officialLod3Generation,
    streamedBuildingSelectionEnabled,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (
        !map.getLayer('topplus') ||
        !map.getLayer('satellite') ||
        !map.getLayer('hamburg-building-footprints')
      ) {
        return;
      }
      // Keep TopPlus under imagery so the opacity slider becomes a true
      // compare/blend control rather than a binary source switch.
      map.setLayoutProperty('topplus', 'visibility', 'visible');
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
      const detailedTierReady =
        buildingDetailMode === 'lod1'
          ? officialLod1Ready
          : buildingDetailMode === 'lod2'
            ? officialLod2Ready
            : buildingDetailMode === 'lod3-untextured' ||
                buildingDetailMode === 'lod3-textured'
              ? officialLod2Ready || officialLod3Ready
              : false;
      const waitingForDetailedTier =
        buildingDetailMode !== 'lod0' && !detailedTierReady;
      const footprintFade = waitingForDetailedTier
        ? 0
        : smoothZoomStep(15.4, 16.2, zoom);
      map.setLayoutProperty(
        'hamburg-building-footprints',
        'visibility',
        hamburgBuildingTilesEnabled ? 'visible' : 'none'
      );
      map.setPaintProperty(
        'hamburg-building-footprints',
        'raster-opacity',
        // Keep a citywide ALKIS safety net under opaque native tiles. A
        // cached tile elsewhere must not make newly panned areas go blank.
        Math.max(0, 0.72 * (1 - 0.35 * footprintFade))
      );
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [
    basemap,
    buildingDetailMode,
    hamburgBuildingTilesEnabled,
    officialLod1Ready,
    officialLod2Ready,
    officialLod3Ready,
    satelliteOpacity,
    zoom,
  ]);

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
    let deferredTexturedLod3Layer: any | null = null;
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

    // Keep the official b3dm/glTF payload native. Converting every visible tile
    // to CityJSON on the UI thread doubled projection and mesh work while
    // zooming. Only a clicked feature is converted for editing.
    if (officialLod1Active) {
      layers.push(
        new HamburgTile3DLayer({
          id: `hamburg-official-${officialLod1Generation}`,
          data: HAMBURG_LOD1_TILESET_URL,
          loadOptions: {
            gltf: { loadImages: false },
            tileset: {
              maximumScreenSpaceError: 12,
              maximumMemoryUsage: 96,
              throttleRequests: true,
            },
          },
          opacity: blockOpacity,
          pickable: streamedBuildingSelectionEnabled,
          onTileLoad: handleOfficialLod1TileLoad,
          onTileUnload: handleOfficialLod1TileUnload,
          onTileError: handleOfficialLod1TileError,
        })
      );
    }

    if (officialLod2Active) {
      layers.push(
        new HamburgTile3DLayer({
          id: `hamburg-official-${officialLod2Generation}`,
          data: HAMBURG_LOD2_TILESET_URL,
          loadOptions: {
            gltf: { loadImages: false },
            tileset: {
              maximumScreenSpaceError:
                officialLod2Profile === 'fallback' ? 16 : 8,
              maximumMemoryUsage:
                officialLod2Profile === 'fallback' ? 96 : 192,
              throttleRequests: true,
            },
          },
          parameters: {
            depthWriteEnabled: !officialLod3Requested,
          } as any,
          opacity: 1,
          pickable: streamedBuildingSelectionEnabled,
          onTileLoad: handleOfficialLod2TileLoad,
          onTileUnload: handleOfficialLod2TileUnload,
          onTileError: handleOfficialLod2TileError,
        })
      );
    }

    if (officialLod3Active) {
      const lod3Props = {
          id: `hamburg-official-${officialLod3Generation}`,
          data: officialLod3TilesetUrl,
          loadOptions: {
            gltf: {
              loadImages: buildingDetailMode === 'lod3-textured',
            },
            tileset: {
              maximumScreenSpaceError: 4,
              maximumMemoryUsage: 192,
              throttleRequests: true,
            },
          },
          onTileLoad: handleOfficialLod3TileLoad,
          onTileUnload: handleOfficialLod3TileUnload,
          onTileError: handleOfficialLod3TileError,
      };
      if (buildingDetailMode === 'lod3-textured') {
        deferredTexturedLod3Layer = new HamburgTile3DLayer({
          ...lod3Props,
          opacity: 1,
          pickable: streamedBuildingSelectionEnabled,
        });
      } else {
        layers.push(
          new HamburgTile3DLayer({
              ...lod3Props,
              opacity: 1,
              pickable: streamedBuildingSelectionEnabled,
            })
        );
      }
    }

    // The official ALKIS footprint WMS supplies uniform citywide context at
    // overview zoom. Keep the local vector layer mounted too so user-created
    // or materialized edits remain visible over that lightweight raster tier.
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
          onClick: handleBuildingFootprintClick,
        })
    );

    if (detailMesh) {
      layers.push(...cityJsonMeshLayers('building-highest-detail', detailMesh));
    }

    // Remote Hamburg tiles cannot contain buildings created in this editor,
    // and these assets have no lower LoD fallback. Keep them in one small
    // local overlay across both source-detail and official-LoD3 zoom ranges.
    if (localAssetOverlayMesh && localAssetOverlayMesh.indices.length > 0) {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: 'building-local-assets-overlay',
          data: [{ position: [0, 0, 0] }],
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getColor: [255, 255, 255, 255],
          mesh: {
            attributes: {
              positions: { value: localAssetOverlayMesh.positions, size: 3 },
              colors: { value: localAssetOverlayMesh.colors, size: 3 },
            },
            indices: { value: localAssetOverlayMesh.indices, size: 1 },
          } as unknown as never,
          _instanced: false,
          opacity: 1,
          sizeScale: 1,
          coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
          coordinateOrigin: [
            localAssetOverlayMesh.anchorLngLat[0],
            localAssetOverlayMesh.anchorLngLat[1],
            0,
          ],
          pickable: false,
          material: {
            ambient: 0.58,
            diffuse: 0.7,
            shininess: 16,
            specularColor: [65, 68, 76],
          },
        } as any)
      );
    }
    localAssetOverlayMesh?.textures.forEach((textureMesh, index) => {
      layers.push(
        new SimpleMeshLayer<{ position: [number, number, number] }>({
          id: `building-local-assets-texture-${index}`,
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
          coordinateOrigin: [
            localAssetOverlayMesh.anchorLngLat[0],
            localAssetOverlayMesh.anchorLngLat[1],
            0,
          ],
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
          onClick: handleBuildingFootprintClick,
        })
      );
    }

    // Draw native photo geometry after semantic fallbacks. Until the textured
    // tile is ready those fallbacks remain useful; once it arrives, later draw
    // order prevents coincident LoD2 surfaces from covering the photographs.
    if (deferredTexturedLod3Layer) {
      layers.push(deferredTexturedLod3Layer);
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
              roadWorkspaceOpen ? osm2streetsSelection : null,
              'lane',
              roadWorkspaceOpen &&
                highlightedOsm2StreetsRoadIds.has(feature?.properties?.road)
            ),
          getLineWidth: (feature: any) =>
            osm2streetsSelectionLineWidth(
              feature,
              roadWorkspaceOpen ? osm2streetsSelection : null,
              'lane',
              roadWorkspaceOpen &&
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
            getLineColor: [
              roadWorkspaceOpen,
              osm2streetsSelection,
              highlightedOsm2StreetsRoadIds,
            ],
            getLineWidth: [
              roadWorkspaceOpen,
              osm2streetsSelection,
              highlightedOsm2StreetsRoadIds,
            ],
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
                roadWorkspaceOpen ? osm2streetsSelection : null,
                'intersection'
              ),
            getLineWidth: (feature: any) =>
              osm2streetsSelectionLineWidth(
                feature,
                roadWorkspaceOpen ? osm2streetsSelection : null,
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
              getLineColor: [roadWorkspaceOpen, osm2streetsSelection],
              getLineWidth: [roadWorkspaceOpen, osm2streetsSelection],
            },
          })
        );
      }
    }

    if (
      roadWorkspaceOpen &&
      highlightedOsm2StreetsRoadIds.size > 0 &&
      renderedOsm2StreetsResult?.plain
    ) {
      const connectedRoads = renderedOsm2StreetsResult.plain.features.filter(
        (feature) =>
          feature?.properties?.type === 'road' &&
          highlightedOsm2StreetsRoadIds.has(feature.properties.id)
      );
      if (connectedRoads.length > 0) {
        const connectedRoadData = {
          ...renderedOsm2StreetsResult.plain,
          features: connectedRoads,
        } as any;
        layers.push(
          new GeoJsonLayer({
            id: 'osm2streets-connected-roads-halo',
            data: connectedRoadData,
            filled: false,
            stroked: true,
            pickable: false,
            getLineColor: ROAD_CONNECTION_HALO,
            getLineWidth: 7,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 7,
            parameters: { depthTest: false } as unknown as never,
          }),
          new GeoJsonLayer({
            id: 'osm2streets-connected-roads',
            data: connectedRoadData,
            filled: false,
            stroked: true,
            pickable: false,
            getLineColor: ROAD_CONNECTION_CYAN,
            getLineWidth: 3.5,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 3.5,
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
            roadAreaLineColor(d, basemap, false, false, roadOverlayOpacity),
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: roadSelectionEnabled,
          extruded: false,
          parameters: { depthTest: !roadWorkspaceOpen } as unknown as never,
          updateTriggers: {
            getFillColor: [basemap, roadOverlayOpacity],
            getLineColor: [basemap, roadOverlayOpacity],
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

    if (connectionRoadAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'road-connection-network-halo',
          data: connectionRoadAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: [0, 0, 0, 0],
          getLineColor: ROAD_CONNECTION_HALO,
          getLineWidth: (area) =>
            area.roadId === selectedRoadConnections.focusRoadId ? 7 : 6,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 6,
          stroked: true,
          filled: false,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getLineWidth: [selectedRoadConnections.focusRoadId],
          },
        }),
        new PolygonLayer<RoadArea>({
          id: 'road-connection-network',
          data: connectionRoadAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: (area) =>
            roadOverlayColor(
              area.roadId === selectedRoadConnections.focusRoadId
                ? withAlpha(ROAD_CONNECTION_CYAN, 82)
                : withAlpha(ROAD_CONNECTION_CYAN, 44),
              { basemap, opacity: roadOverlayOpacity }
            ),
          getLineColor: (area) =>
            roadOverlayColor(
              area.roadId === selectedRoadConnections.focusRoadId
                ? ROAD_CONNECTION_ACTIVE
                : ROAD_CONNECTION_CYAN,
              { basemap, opacity: roadOverlayOpacity }
            ),
          getLineWidth: (area) =>
            area.roadId === selectedRoadConnections.focusRoadId ? 4 : 3,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 3,
          stroked: true,
          filled: true,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getFillColor: [
              basemap,
              roadOverlayOpacity,
              selectedRoadConnections.focusRoadId,
            ],
            getLineColor: [
              basemap,
              roadOverlayOpacity,
              selectedRoadConnections.focusRoadId,
            ],
            getLineWidth: [selectedRoadConnections.focusRoadId],
          },
        })
      );
    }

    if (connectionJunctionAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'road-connection-junctions-halo',
          data: connectionJunctionAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: [0, 0, 0, 0],
          getLineColor: ROAD_CONNECTION_HALO,
          getLineWidth: 7,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 7,
          stroked: true,
          filled: false,
          pickable: false,
          extruded: false,
          parameters: { depthTest: false } as unknown as never,
        }),
        new PolygonLayer<RoadArea>({
          id: 'road-connection-junctions',
          data: connectionJunctionAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: roadOverlayColor(withAlpha(ROAD_CONNECTION_CYAN, 102), {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineColor: roadOverlayColor(ROAD_CONNECTION_ACTIVE, {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineWidth: 3.5,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 3.5,
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

    if (selectedRoadBandAreas.length > 0) {
      layers.push(
        new PolygonLayer<RoadArea>({
          id: 'road-selected-band-highlight',
          data: selectedRoadBandAreas,
          getPolygon: (area) => area.polygon,
          getFillColor: roadOverlayColor([60, 176, 255, 122], {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineColor: roadOverlayColor([188, 235, 255, 255], {
            basemap,
            opacity: roadOverlayOpacity,
          }),
          getLineWidth: 3,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 3,
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

    // Render nearby street trees after road surfaces so Roads mode cannot
    // paint depth-disabled road polygons over them. Conflict rings and edit
    // handles are appended after the trees and remain clearly visible.
    if (renderedHamburgTrees.length > 0) {
      const treeOpacity = editFocusBbox
        ? 1
        : smoothZoomStep(
            HAMBURG_TREE_MIN_ZOOM,
            HAMBURG_TREE_MIN_ZOOM + 0.75,
            zoom
          );
      layers.push(
        ...createHamburgTreeLayers(
          renderedHamburgTrees,
          treeOpacity,
          conflictingTreeIds
        )
      );
    }

    if (roadLaneContinuations.length > 0) {
      layers.push(
        new PathLayer<RoadLaneContinuation>({
          id: 'cityjson-road-lane-connection-guide-halos',
          data: roadLaneContinuations,
          getPath: (continuation: RoadLaneContinuation) => continuation.path,
          getColor: ROAD_CONNECTION_HALO,
          getWidth: (continuation: RoadLaneContinuation) =>
            roadLaneContinuationMatchesDraftBand(
              continuation,
              roadDraft,
              selectedDraftBand
            )
              ? 7
              : 5.5,
          widthUnits: 'pixels',
          widthMinPixels: 5.5,
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getWidth: [roadSelectionHighlightKey],
          },
        }),
        new PathLayer<RoadLaneContinuation>({
          id: 'cityjson-road-lane-connection-guides',
          data: roadLaneContinuations,
          getPath: (continuation: RoadLaneContinuation) => continuation.path,
          getColor: (continuation: RoadLaneContinuation) =>
            roadLaneContinuationMatchesDraftBand(
              continuation,
              roadDraft,
              selectedDraftBand
            )
              ? roadOverlayColor(ROAD_CONNECTION_ACTIVE, {
                  basemap,
                  opacity: roadOverlayOpacity,
                })
              : roadOverlayColor(ROAD_CONNECTION_CYAN, {
                  basemap,
                  opacity: roadOverlayOpacity,
                }),
          getWidth: (continuation: RoadLaneContinuation) =>
            roadLaneContinuationMatchesDraftBand(
              continuation,
              roadDraft,
              selectedDraftBand
            )
              ? 3.8
              : 2.8,
          widthUnits: 'pixels',
          widthMinPixels: 2.8,
          getDashArray: [1, 1.35],
          dashJustified: true,
          extensions: [new PathStyleExtension({ dash: true })],
          jointRounded: true,
          capRounded: true,
          pickable: false,
          parameters: { depthTest: false } as unknown as never,
          updateTriggers: {
            getColor: [
              basemap,
              roadOverlayOpacity,
              roadSelectionHighlightKey,
            ],
            getWidth: [roadSelectionHighlightKey],
          },
        } as any)
      );
    }

    if (selectedRoadConnections.nodes.length > 0) {
      layers.push(
        new ScatterplotLayer<RoadConnectionNode>({
          id: 'road-connection-nodes',
          data: selectedRoadConnections.nodes,
          getPosition: (node) => node.position,
          getFillColor: (node) =>
            node.kind === 'junction'
              ? withAlpha(ROAD_CONNECTION_CYAN, 235)
              : withAlpha(ROAD_CONNECTION_ACTIVE, 235),
          getLineColor: ROAD_CONNECTION_HALO,
          getLineWidth: 3,
          getRadius: (node) => (node.kind === 'junction' ? 9 : 7),
          radiusUnits: 'pixels',
          radiusMinPixels: 7,
          radiusMaxPixels: 11,
          stroked: true,
          filled: true,
          pickable: false,
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
          // Placement is a temporary x-ray preview. Keeping it visible over
          // official tiles lets the user notice collisions before confirming.
          parameters: { depthTest: false } as unknown as never,
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
          getPolygon: (d) =>
            d.holes?.length ? [d.polygon, ...d.holes] : d.polygon,
          getFillColor: (d) => d.color,
          getLineColor: (d) => [d.color[0], d.color[1], d.color[2], 230],
          getLineWidth: zoom < 12 ? 0.75 : 2,
          lineWidthMinPixels: zoom < 12 ? 0.75 : 2,
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
    blockFootprints,
    blockOpacity,
    renderedZones,
    detailMesh,
    localAssetOverlayMesh,
    selectedId,
    onSelect,
    zoom,
    preview,
    multiSelectedIds,
    filteredIds,
    onZoneSelect,
    roadPreviewAreas,
    roadVisuals,
    selectedRoadBandAreas,
    connectionRoadAreas,
    connectionJunctionAreas,
    selectedRoadConnections,
    roadLaneContinuations,
    roadSelectionHighlightKey,
    roadDraft,
    onRoadDraftChange,
    drawMode,
    conflictingSavedRoadAreas,
    conflictingTreeIds,
    visibleRoadFitConflicts,
    selectedRoadAreaId,
    onRoadAreaSelect,
    renderedOsmRoads,
    renderedOsmPointFeatures,
    renderedHamburgTrees,
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
    hamburgBuildingTilesEnabled,
    buildingDetailMode,
    officialLod1Active,
    officialLod1Generation,
    officialLod2Active,
    officialLod2Generation,
    officialLod3Active,
    officialLod3Generation,
    officialLod3Requested,
    officialLod3TilesetUrl,
    hiddenHamburgBuildingIds,
    handleOfficialLod1TileLoad,
    handleOfficialLod1TileUnload,
    handleOfficialLod1TileError,
    handleOfficialLod2TileLoad,
    handleOfficialLod2TileUnload,
    handleOfficialLod2TileError,
    handleOfficialLod3TileLoad,
    handleOfficialLod3TileUnload,
    handleOfficialLod3TileError,
    handleOfficialBuildingClick,
    handleBuildingFootprintClick,
    streamedBuildingSelectionEnabled,
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

  // ── Interactive placement mode (used by assets and IFC import) ───────────
  // While `onPlacementClick` is set, every map tap reports its lng/lat. Asset
  // previews can therefore be repositioned repeatedly; IFC clears its pending
  // callback after the first tap. The cursor gives a visual cue. Selection
  // clicks are blocked because
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

    const dragDeltas = createAnimationFrameDragDeltaBatcher(
      onDragMove,
      onDragEnd
    );
    let dragPanWasEnabled = false;

    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = 'move';

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      const position = proj4('EPSG:4326', crs.code, [
        e.lngLat.lng,
        e.lngLat.lat,
      ]) as [number, number];
      if (!dragDeltas.start(position)) return;
      dragPanWasEnabled = map.dragPan.isEnabled();
      if (dragPanWasEnabled) map.dragPan.disable();
      setBuildingDragActive(true);
    };
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!dragDeltas.isActive()) return;
      const position = proj4('EPSG:4326', crs.code, [
        e.lngLat.lng,
        e.lngLat.lat,
      ]) as [number, number];
      dragDeltas.move(position);
    };
    const finishDrag = () => {
      if (!dragDeltas.finish()) return;
      if (dragPanWasEnabled) map.dragPan.enable();
      dragPanWasEnabled = false;
      setBuildingDragActive(false);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', finishDrag);
    window.addEventListener('mouseup', finishDrag);
    window.addEventListener('blur', finishDrag);
    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', finishDrag);
      window.removeEventListener('mouseup', finishDrag);
      window.removeEventListener('blur', finishDrag);
      canvas.style.cursor = prevCursor;
      finishDrag();
    };
  }, [dragTransformId, onDragMove, onDragEnd, cityjson]);

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
        onTexturesEnabledChange={onTexturesEnabledChange}
        lod3Visible={officialDetailLod === 'lod3'}
        detailLabel={
          hamburgBuildingTilesEnabled
            ? `${officialBuildingDetailLabel} · ${treeDetailLabel}`
            : detailMesh
              ? `${(detailMesh.maxLod ?? 0) >= 3 ? 'Untextured source LoD3' : 'Source LoD2'} · ${
                  detailMesh.objectCount
                } nearby objects · ${
                  mapColorMode === 'usage'
                    ? 'building usage colours'
                    : detailMesh.explicitOpeningSurfaceCount > 0
                      ? `${detailMesh.explicitOpeningSurfaceCount} explicit window/door surfaces`
                      : 'semantic roof, window, and wall colours'
                } · ${treeDetailLabel}`
              : zoom >= BUILDING_DETAIL_MIN_ZOOM
                ? `Source geometry unavailable here · ${treeDetailLabel}`
                : `LoD0 footprints · lightweight LoD1 at 14 · source LoD2 at 15.25 · textured LoD3 at 18 · ${treeDetailLabel}`
        }
        focusActive={!!editFocusBbox}
        obscuredByInspector={roadWorkspaceOpen}
      />
    </>
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
  selection,
  onSelectionChange,
}: {
  draft: RoadDraft;
  onChange: (draft: RoadDraft) => void;
  selection: { sectionId: string; bandIndex: number } | null;
  onSelectionChange: (
    selection: { sectionId: string; bandIndex: number }
  ) => void;
}) {
  const [newBandKind, setNewBandKind] = useState<RoadBandKind>('car_lane');
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

  return (
    <section className="map-road-cross-section" aria-label="Road cross-section quick editor">
      <header>
        <div><b>Road on the map</b><span>Tap a band, then adjust it with large controls.</span></div>
        {draft.sections.length > 1 && (
          <label className="map-road-cross-section__section">
            <span>Section</span>
            <select
              value={section.id}
              aria-label="Active road section"
              onChange={(event) =>
                onSelectionChange({
                  sectionId: event.target.value,
                  bandIndex: 0,
                })
              }
            >
              {draft.sections.map((candidate, index) => (
                <option key={candidate.id} value={candidate.id}>
                  Part {index + 1}
                </option>
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
              style={{
                flexGrow: Math.max(0.75, band.widthM),
                background: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`,
                color: lightBand ? '#17202a' : '#ffffff',
                textShadow: lightBand ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.75)',
              }}
              onClick={() =>
                onSelectionChange({ sectionId: section.id, bandIndex: index })
              }
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
          onSelectionChange({
            sectionId: section.id,
            bandIndex: effectiveBandIndex - 1,
          });
          replaceBands(bands);
        }}>Move left</button>
        <button type="button" disabled={effectiveBandIndex === section.bands.length - 1} onClick={() => {
          const bands = section.bands.slice();
          [bands[effectiveBandIndex], bands[effectiveBandIndex + 1]] = [bands[effectiveBandIndex + 1], bands[effectiveBandIndex]];
          onSelectionChange({
            sectionId: section.id,
            bandIndex: effectiveBandIndex + 1,
          });
          replaceBands(bands);
        }}>Move right</button>
        <button type="button" className="is-destructive" disabled={section.bands.length <= 1} onClick={() => {
          replaceBands(section.bands.filter((_, index) => index !== effectiveBandIndex));
          onSelectionChange({
            sectionId: section.id,
            bandIndex: Math.max(0, effectiveBandIndex - 1),
          });
        }}>Remove</button>
        </div>
      </div>
      <div className="map-road-cross-section__add">
        <label><span>Add a band</span><select value={newBandKind} onChange={(event) => setNewBandKind(event.target.value as RoadBandKind)}>{MAP_ROAD_BAND_KINDS.map((kind) => <option key={kind} value={kind}>{mapRoadBandLabel(kind)}</option>)}</select></label>
        <button type="button" onClick={() => {
          replaceBands([...section.bands, { kind: newBandKind, widthM: MAP_ROAD_DEFAULT_WIDTH[newBandKind], direction: newBandKind === 'car_lane' || newBandKind === 'bike_lane' ? 'forward' : 'none', surface: newBandKind === 'green' ? 'grass' : 'asphalt' }]);
          onSelectionChange({
            sectionId: section.id,
            bandIndex: section.bands.length,
          });
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
          <label
            className={`map-layer-control__switch ${
              !lod3Visible ? 'is-disabled' : ''
            }`}
          >
            <span>
              <b>Photo textures</b>
              <small>
                {lod3Visible
                  ? texturesEnabled
                    ? '20 cm textures on; uncheck for untextured LoD3'
                    : 'LoD3 geometry is on; enable to download 20 cm textures'
                  : texturesEnabled
                    ? 'Zoom in; 20 cm photo textures load with LoD3'
                    : 'Zoom in; untextured LoD3 is selected'}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Photo textures"
              checked={texturesEnabled}
              disabled={!lod3Visible}
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
