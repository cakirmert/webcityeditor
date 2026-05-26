import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PolygonLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { COORDINATE_SYSTEM, type PickingInfo } from '@deck.gl/core';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import proj4 from 'proj4';
import type { CityJsonDocument, SelectionInfo } from '../types';
import { detectCrs } from '../lib/projection';
import { extractFootprints, type Footprint } from '../lib/footprints';
import { tintByRoofType } from '../lib/footprint-tint';
import type { ParcelZone } from '../lib/zoning';

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

interface Props {
  cityjson: CityJsonDocument;
  selectedId: string | null;
  onSelect: (info: SelectionInfo | null) => void;
  /** Bump to force layer rebuild with current in-memory edits */
  reloadToken: number;
  /** When 'polygon', Terra Draw is active and the user can draw a footprint. */
  drawMode: 'none' | 'polygon';
  /** Called once the user double-clicks to finish a polygon, with outer ring in WGS84. */
  onFootprintDrawn: (ringWgs84: [number, number][]) => void;
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const flownForDocRef = useRef<CityJsonDocument | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(16);

  const footprints = useMemo(
    () => extractFootprints(cityjson),
    // reloadToken is intentionally a dep so "Reload view" after an edit
    // (e.g. changed measuredHeight) rebuilds the deck.gl data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityjson, reloadToken]
  );

  // Detect CRS support and surface a warning if unsupported
  useEffect(() => {
    const crs = detectCrs(cityjson);
    if (!crs.supported) {
      setWarning(
        `Reference system ${crs.code} is not yet supported. Add a proj4 definition ` +
          `in src/lib/projection.ts, or use CityJSON in EPSG:28992 / 25832 / 25833.`
      );
    } else if (footprints.length === 0) {
      setWarning(
        'No buildings with extractable footprints found. Data may lack GroundSurface semantics.'
      );
    } else {
      setWarning(null);
    }
  }, [cityjson, footprints]);

  // Init map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [4.3571, 52.0116], // Delft fallback
      zoom: 16,
      pitch: 55,
      bearing: 20,
      antialias: true,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
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

  // Fly to data + rebuild deck.gl layer when data or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    // Fit the camera to the dataset ONLY on first load of a given document
    // (not on every selection or edit).
    //
    // IMPORTANT: MapLibre can drop the camera move if we call fitBounds before
    // its style has loaded — the initial center/zoom from the Map constructor
    // settles AFTER our effect runs. We detect that and defer the move until
    // the `load` event fires.
    if (flownForDocRef.current !== cityjson) {
      flownForDocRef.current = cityjson;
      const footprintBbox = computeFootprintBounds(footprints);
      const metaBbox = computeMetadataBounds(cityjson);
      const centre = computeTranslateCentre(cityjson);
      // eslint-disable-next-line no-console
      console.log('[MapView auto-fit]', {
        footprints: footprints.length,
        footprintBbox,
        metaBbox,
        centre,
        styleLoaded: map.isStyleLoaded(),
      });

      const bbox = footprintBbox ?? metaBbox;
      const doFit = () => {
        if (bbox && isFiniteBbox(bbox)) {
          map.fitBounds(bbox, {
            padding: 60,
            maxZoom: 18,
            pitch: 55,
            bearing: map.getBearing(),
            duration: 700,
          });
        } else if (centre && Number.isFinite(centre[0]) && Number.isFinite(centre[1])) {
          map.flyTo({
            center: centre,
            zoom: 16,
            pitch: 55,
            bearing: map.getBearing(),
            duration: 700,
          });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            '[MapView auto-fit] No focus location found (no footprints, no extent, unsupported CRS).'
          );
        }
      };

      if (map.isStyleLoaded()) {
        doFit();
      } else {
        // Defer until the map is ready, else the initial center/zoom from the
        // Map constructor wins. Use `once` so we don't leak a listener.
        map.once('load', doFit);
      }
    }

    // deck.gl's Layer base type is the lowest common denominator; listing the
    // specific parameterised Layer subclasses here is fine and keeps the
    // type-check honest about which layer classes we feed to MapboxOverlay.
    const layers: Array<
      | SolidPolygonLayer<Footprint>
      | PolygonLayer<Footprint>
      | PolygonLayer<ParcelZone>
      | SolidPolygonLayer<{ polygon: [number, number][]; height: number }>
      | SimpleMeshLayer<{ position: [number, number] }>
    > = [];

    // LoD0 — outlines on the ground. Always on; at low zoom this is the only
    // thing drawn, at high zoom it still fires picking when clicking a roof edge.
    layers.push(
      new PolygonLayer<Footprint>({
        id: 'building-outlines',
        data: footprints,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => {
          if (d.id === selectedId) return [255, 150, 40, 140];
          if (multiSelectedIds?.has(d.id)) return [255, 180, 80, 120];
          const matched = !filteredIds || filteredIds.has(d.id);
          if (!matched) return [120, 120, 130, 35]; // dimmed
          return tintByRoofType(d, 120);
        },
        getLineColor: (d) => {
          if (d.id === selectedId) return [255, 120, 10, 255];
          if (multiSelectedIds?.has(d.id)) return [255, 150, 40, 200];
          const matched = !filteredIds || filteredIds.has(d.id);
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
          getFillColor: [selectedId, filteredIds, multiSelectedIds],
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

    // LoD1 — extruded flat-roof blocks. Only render at mid/high zoom to avoid
    // overdraw and fill rate cost at city-wide scales.
    if (zoom > LOD_OUTLINE_MAX && zoom <= LOD_EXTRUDE_MAX) {
      layers.push(
        new SolidPolygonLayer<Footprint>({
          id: 'building-blocks',
          data: footprints,
          getPolygon: (d) => d.polygon,
          getElevation: (d) => d.height,
          getFillColor: (d) => {
            if (d.id === selectedId) return [255, 150, 40, 240];
            if (multiSelectedIds?.has(d.id)) return [255, 180, 80, 200];
            const matched = !filteredIds || filteredIds.has(d.id);
            if (!matched) return [120, 120, 130, 60]; // dimmed
            return tintByRoofType(d, 230);
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
            getFillColor: [selectedId, filteredIds, multiSelectedIds],
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
              // No action needed, just tooltip-like feedback
            }
          },
        })
      );
    }

    overlay.setProps({ layers });
  }, [footprints, selectedId, onSelect, zoom, preview, multiSelectedIds, filteredIds, zones]);

  // Terra Draw lifecycle — activate/deactivate based on drawMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode === 'polygon') {
      if (drawRef.current) return; // already active

      // Flatten every existing footprint's vertices into one array, so the
      // custom snap can do a linear nearest-vertex search. For a 3DBAG tile
      // with ~500 buildings × ~6 vertices = 3000 points this is fine in a
      // pointermove callback.
      const SNAP_PX = 20;
      const allVertices: [number, number][] = [];
      for (const fp of footprints) {
        for (const v of fp.polygon) allVertices.push(v);
      }

      const start = () => {
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes: [
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
          ],
        });
        draw.start();
        draw.setMode('polygon');
        draw.on('finish', (id) => {
          const snapshot = draw.getSnapshot();
          const feature = snapshot.find((f) => String(f.id) === String(id));
          if (
            feature &&
            feature.geometry.type === 'Polygon' &&
            Array.isArray(feature.geometry.coordinates?.[0])
          ) {
            const ring = feature.geometry.coordinates[0] as [number, number][];
            onFootprintDrawn(ring);
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
      if (e.key === 'Escape' && drawRef.current) {
        drawRef.current.stop();
        drawRef.current = null;
        onDrawCanceled?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode, onFootprintDrawn, onDrawCanceled, footprints]);

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
    </>
  );
}

function averageCenter(footprints: Footprint[]): [number, number] | null {
  if (footprints.length === 0) return null;
  let sx = 0,
    sy = 0,
    n = 0;
  for (const fp of footprints) {
    for (const [lng, lat] of fp.polygon) {
      sx += lng;
      sy += lat;
      n++;
    }
  }
  return n === 0 ? null : [sx / n, sy / n];
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

/**
 * Fallback #2: read `metadata.geographicalExtent` (a 6-element bbox in the
 * dataset's own CRS: [minX, minY, minZ, maxX, maxY, maxZ]) and reproject the
 * 2D corners to WGS84. Works for files where extractFootprints returned
 * nothing (for instance, because CityObjects lack GroundSurfaces we can
 * detect).
 */
function computeMetadataBounds(doc: CityJsonDocument): maplibregl.LngLatBoundsLike | null {
  const ext = doc.metadata?.geographicalExtent;
  if (!Array.isArray(ext) || ext.length < 4) return null;
  const [minX, minY, , maxX, maxY] = ext as number[];
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

/**
 * Fallback #3: project `transform.translate` — the document's local origin —
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
