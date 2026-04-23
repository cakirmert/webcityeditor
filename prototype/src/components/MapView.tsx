import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PolygonLayer, SolidPolygonLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { CityJsonDocument, SelectionInfo } from '../types';
import { detectCrs } from '../lib/projection';
import { extractFootprints, type Footprint } from '../lib/footprints';

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
  /** Live preview for the new-building dialog; shows a ghost extrusion of the pending building. */
  preview?: {
    polygon: [number, number][];
    height: number;
  } | null;
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
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
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

    // Fit the camera to the dataset's bounding box ONLY on first load of a
    // given document (not on every selection or edit). Clicking a building
    // must not reset the user's zoom/pitch. fitBounds auto-picks a zoom that
    // frames everything, so this works for a small sample cube and a full
    // city tile alike — no hardcoded zoom or centre.
    if (footprints.length > 0 && flownForDocRef.current !== cityjson) {
      flownForDocRef.current = cityjson;
      const bbox = computeFootprintBounds(footprints);
      if (bbox) {
        map.fitBounds(bbox, {
          padding: 60,
          maxZoom: 18,
          pitch: 55,
          bearing: map.getBearing(),
          duration: 700,
        });
      }
    }

    const layers: Array<
      | SolidPolygonLayer<Footprint>
      | PolygonLayer<Footprint>
      | SolidPolygonLayer<{ polygon: [number, number][]; height: number }>
    > = [];

    // LoD0 — outlines on the ground. Always on; at low zoom this is the only
    // thing drawn, at high zoom it still fires picking when clicking a roof edge.
    layers.push(
      new PolygonLayer<Footprint>({
        id: 'building-outlines',
        data: footprints,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) =>
          d.id === selectedId ? [255, 150, 40, 140] : [160, 170, 185, 120],
        getLineColor: (d) =>
          d.id === selectedId ? [255, 120, 10, 255] : [60, 70, 85, 220],
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        extruded: false,
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedId],
          getLineColor: [selectedId],
        },
        onClick: (info: PickingInfo<Footprint>) => {
          if (info.object) onSelect({ objectId: info.object.id });
          else onSelect(null);
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
          getFillColor: (d) =>
            d.id === selectedId ? [255, 150, 40, 240] : [200, 200, 210, 230],
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
            getFillColor: [selectedId],
          },
          onClick: (info: PickingInfo<Footprint>) => {
            if (info.object) onSelect({ objectId: info.object.id });
            else onSelect(null);
          },
        })
      );
    }

    // Preview layer for the in-progress new building (visible while the
    // NewBuildingDialog is open and the user adjusts height).
    if (preview && preview.polygon.length >= 3) {
      layers.push(
        new SolidPolygonLayer<{ polygon: [number, number][]; height: number }>({
          id: 'new-building-preview',
          data: [preview],
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

    overlay.setProps({ layers });
  }, [footprints, selectedId, onSelect, zoom, preview]);

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
