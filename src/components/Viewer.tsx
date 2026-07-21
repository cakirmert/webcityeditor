import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CityJSONLoader, CityJSONParser } from 'cityjson-threejs-loader';
import type { CityJsonDocument, SelectionInfo } from '../types';
import type { FloorPlanDivision } from '../lib/subdivision';
import { normalizeUsage, USAGE_OBJECT_COLORS } from '../lib/footprint-tint';
import { buildCityJsonMapMesh } from '../lib/cityjson-map-mesh';

/**
 * Warm architectural surface palette. Replaces the loader's default Window=
 * pure-blue / RoofSurface=pure-red defaults with something less playground.
 * Hex values are 0xRRGGBB, the format the loader expects.
 */
const SURFACE_COLORS_ARCH = {
  GroundSurface: 0x6e6358, // sandy mid-gray, slightly warm
  WallSurface: 0xd9cfbf, // cream
  RoofSurface: 0x8e3a2c, // terracotta
  TrafficArea: 0x5a5a5a,
  AuxiliaryTrafficArea: 0x4a7a3a,
  Window: 0x3d6f8f, // muted teal-blue
  Door: 0x4a2f1f, // walnut
};

/** Distinct CityObject palette — used in "by type" mode. */
const OBJECT_COLORS_DISTINCT = {
  Building: 0x7497df,
  BuildingPart: 0x9bb4e0,
  BuildingInstallation: 0x6a87c2,
  Bridge: 0x999999,
  CityObjectGroup: 0xffe9a3,
  PlantCover: 0x5fa85f,
  SolitaryVegetationObject: 0x5fa85f,
  TINRelief: 0xd4b58a,
  Road: 0x7a7a7a,
  WaterBody: 0x4a8fbf,
};

type ColorMode = 'surface' | 'object' | 'usage';

/** Live-preview info from the visual division editor. When set, the viewer
 *  draws horizontal accent rings at each cumulative split height around the
 *  selected building's footprint. */
export interface SplitPreviewInfo {
  buildingId: string;
  /** Per-floor wall heights in metres (in floor order, ground up). */
  heights: number[];
  /** Optional footprint sections for each floor. */
  floorPlans?: FloorPlanDivision[];
}

interface Props {
  cityjson: CityJsonDocument;
  reloadToken: number;
  onSelect: (info: SelectionInfo | null) => void;
  lod?: 'highest' | 'lod2' | 'lod3';
  texturesEnabled?: boolean;
  /** Already-centred geometry for a streamed LoD3 building that is not
   * embedded in the active CityJSON document. */
  externalModel?: THREE.Group | null;
  externalModelKey?: string;
  splitPreview?: SplitPreviewInfo | null;
  /** Drag handler — fires while the user is dragging a split-line ring in 3D.
   *  `ringIndex` is the ring's position in `splitPreview.heights` (0-based);
   *  `deltaZ` is the requested vertical movement in metres since the previous
   *  callback (positive = up). The parent decides whether to apply, clamp, or
   *  reject the delta (e.g. to enforce MIN_STOREY_HEIGHT on both adjacent
   *  floors). */
  onAdjustSplit?: (ringIndex: number, deltaZ: number) => void;
}

export default function Viewer({
  cityjson,
  reloadToken,
  onSelect,
  lod = 'highest',
  texturesEnabled = false,
  externalModel = null,
  externalModelKey,
  splitPreview,
  onAdjustSplit,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const splitOverlayRef = useRef<THREE.Group | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('surface');
  const sceneRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    modelGroup: THREE.Group;
    raycaster: THREE.Raycaster;
    parser: CityJSONParser;
    loader: CityJSONLoader | null;
    resizeObserver: ResizeObserver;
    rafId: number;
    disposed: boolean;
  } | null>(null);

  // 1. Init Three.js scene once on mount
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d0d);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      60,
      host.clientWidth / host.clientHeight,
      0.0001,
      10000
    );
    camera.up.set(0, 0, 1);
    camera.position.set(1, 1, 1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.screenSpacePanning = false;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(1, 2, 3);
    scene.add(dir);
    const hemi = new THREE.HemisphereLight(0xaaccff, 0x3a2a1a, 0.35);
    scene.add(hemi);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const raycaster = new THREE.Raycaster();
    const parser = new CityJSONParser();
    // Use the warm-architectural palette by default. resetMaterial() will
    // re-read these in the load effect below. The loader's .d.ts is
    // incomplete; cast through unknown so we can set the runtime fields.
    setParserPalette(parser);

    const state = {
      scene,
      renderer,
      camera,
      controls,
      modelGroup,
      raycaster,
      parser,
      loader: null as CityJSONLoader | null,
      resizeObserver: new ResizeObserver(() => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }),
      rafId: 0,
      disposed: false,
    };
    state.resizeObserver.observe(host);
    sceneRef.current = state;

    const tick = () => {
      if (state.disposed) return;
      controls.update();
      renderer.render(scene, camera);
      state.rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      state.disposed = true;
      cancelAnimationFrame(state.rafId);
      state.resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // 2. Load / reload citymodel whenever cityjson or reloadToken changes
  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !cityjson) return;

    // Clear previous geometry from modelGroup
    while (state.modelGroup.children.length > 0) {
      const child = state.modelGroup.children[0];
      state.modelGroup.remove(child);
      child.traverse?.((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    }
    if (externalModel) {
      state.loader = null;
      const model = cloneExternalModel(externalModel);
      state.modelGroup.add(model);
      const meshBbox = new THREE.Box3().setFromObject(model);
      if (!meshBbox.isEmpty()) fitCameraToBox(state.camera, state.controls, meshBbox);
      return;
    }
    // Re-apply custom palette & color mode each load — resetMaterial() builds
    // fresh material instances and they default to objectColors-by-type unless
    // we explicitly pin showSemantics.
    let docToLoad = documentAtLod(cityjson, lod);
    let objectColors: Record<string, number> = OBJECT_COLORS_DISTINCT;
    if (colorMode === 'usage') {
      const cloned = JSON.parse(JSON.stringify(docToLoad)) as CityJsonDocument;
      for (const id of Object.keys(cloned.CityObjects)) {
        const obj = cloned.CityObjects[id];
        obj.type = normalizeUsage(obj.attributes?.function) ?? 'unknown';
      }
      docToLoad = cloned;
      objectColors = {
        ...OBJECT_COLORS_DISTINCT,
        ...USAGE_OBJECT_COLORS,
      };
    }
    const texturedGroup = texturesEnabled ? buildTexturedViewerGroup(docToLoad) : null;
    if (texturedGroup) {
      state.loader = null;
      state.modelGroup.add(texturedGroup);
      const meshBbox = new THREE.Box3().setFromObject(texturedGroup);
      if (!meshBbox.isEmpty()) fitCameraToBox(state.camera, state.controls, meshBbox);
      return;
    }
    docToLoad = texturesEnabled
      ? withoutUnsupportedSolidTextures(docToLoad)
      : withoutTextures(docToLoad);

    setParserPalette(state.parser, objectColors);
    state.parser.resetMaterial();
    applyColorMode(state.parser, colorMode);

    const loader = new CityJSONLoader(state.parser);
    state.loader = loader;
    loader.load(docToLoad);
    state.modelGroup.add(loader.scene);

    // Fit camera to the actually-rendered meshes (not loader.boundingBox,
    // which is computed over the ENTIRE vertex array even when the doc was
    // filtered to a single building — it would otherwise frame empty space).
    try {
      const meshBbox = new THREE.Box3().setFromObject(loader.scene);
      if (!meshBbox.isEmpty()) {
        fitCameraToBox(state.camera, state.controls, meshBbox);
      } else {
        const fallback = loader.boundingBox.clone().applyMatrix4(loader.matrix);
        if (!fallback.isEmpty()) fitCameraToBox(state.camera, state.controls, fallback);
      }
    } catch (e) {
      console.warn('Could not fit camera:', e);
    }
  }, [cityjson, reloadToken, colorMode, lod, texturesEnabled, externalModel, externalModelKey]);

  // 2b. Toggle showSemantics live without re-loading the whole model.
  // resetMaterial() → loader.load() rebuilds vertex buffers, which is wasteful
  // when only the per-pixel color path needs to flip.
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    applyColorMode(state.parser, colorMode);
  }, [colorMode]);

  // 2c. Split-line preview overlay. When the user is in custom-heights mode
  // for the selected building, draw N-1 horizontal rings around the building
  // outline at each cumulative split height. Rebuilds whenever the heights
  // change so the user sees live feedback as they edit.
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    // Drop the previous overlay if any.
    if (splitOverlayRef.current) {
      state.modelGroup.remove(splitOverlayRef.current);
      disposeGroup(splitOverlayRef.current);
      splitOverlayRef.current = null;
    }

    if (!splitPreview || !cityjson || externalModel) return;
    const overlay = buildSplitOverlay(cityjson, splitPreview, state.loader);
    if (!overlay) return;
    splitOverlayRef.current = overlay;
    state.modelGroup.add(overlay);
  }, [cityjson, splitPreview, reloadToken, externalModel]);

  // 3. Double-click picking
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const el = state.renderer.domElement;

    const onDblClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      state.raycaster.setFromCamera(mouse, state.camera);
      const hits = state.raycaster.intersectObject(state.modelGroup, true);
      if (hits.length === 0) {
        onSelect(null);
        return;
      }
      // Walk hits to find one with a resolvable intersection info
      for (const hit of hits) {
        const obj = hit.object as THREE.Object3D & {
          resolveIntersectionInfo?: (h: unknown) => {
            objectId: string;
            surfaceTypeIndex?: number;
            geometryIndex?: number;
            boundaryIndex?: number;
            lodIndex?: number;
          } | null;
        };
        if (typeof obj.resolveIntersectionInfo === 'function') {
          const info = obj.resolveIntersectionInfo(hit);
          if (info && info.objectId) {
            onSelect({
              objectId: info.objectId,
              geometryIndex: info.geometryIndex,
              boundaryIndex: info.boundaryIndex,
              lodIndex: info.lodIndex,
            });
            return;
          }
        }
        const texturedObjectId = obj.userData?.cityJsonObjectId;
        if (typeof texturedObjectId === 'string' && texturedObjectId) {
          onSelect({ objectId: texturedObjectId });
          return;
        }
      }
      onSelect(null);
    };

    el.addEventListener('dblclick', onDblClick);
    return () => el.removeEventListener('dblclick', onDblClick);
  }, [onSelect, cityjson]);

  // 4. Drag split-line rings — mousedown on a ring, drag up/down, ring's
  // height in the heights[] array changes (with the floor above taking the
  // opposite delta so the total building height is preserved).
  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !onAdjustSplit) return;
    const el = state.renderer.domElement;
    const overlay = splitOverlayRef.current;
    if (!overlay) return;

    // 1 metre line-picking threshold — without this, the thin Line geometry
    // is essentially impossible to click.
    const prevLineThreshold = state.raycaster.params.Line?.threshold;
    state.raycaster.params.Line = { ...(state.raycaster.params.Line ?? {}), threshold: 1.0 };

    let drag: {
      ringIndex: number;
      plane: THREE.Plane;
      lastZ: number;
    } | null = null;
    const mouseNdc = new THREE.Vector2();
    const planeNormal = new THREE.Vector3();
    const hitPoint = new THREE.Vector3();

    const ndcFromEvent = (e: MouseEvent): void => {
      const rect = el.getBoundingClientRect();
      mouseNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left-click only
      ndcFromEvent(e);
      state.raycaster.setFromCamera(mouseNdc, state.camera);
      // Restrict to the overlay group; ignores the building mesh underneath.
      const hits = state.raycaster.intersectObject(overlay, true);
      for (const hit of hits) {
        const ud = hit.object.userData as {
          splitRingIndex?: number;
          ringCenterLocal?: [number, number, number];
        } | undefined;
        if (typeof ud?.splitRingIndex !== 'number' || !ud.ringCenterLocal) continue;
        // Build a vertical plane through the ring's centre, oriented so its
        // normal is horizontal and roughly faces the camera. Raycasting this
        // plane on every mouse move gives a stable world-Z under the cursor.
        const local = new THREE.Vector3(...ud.ringCenterLocal);
        const world = local.clone().applyMatrix4(overlay.matrixWorld);
        state.camera.getWorldDirection(planeNormal);
        planeNormal.z = 0;
        if (planeNormal.lengthSq() < 1e-6) planeNormal.set(1, 0, 0);
        planeNormal.normalize();
        const plane = new THREE.Plane(planeNormal, -planeNormal.dot(world));
        if (!state.raycaster.ray.intersectPlane(plane, hitPoint)) continue;
        drag = { ringIndex: ud.splitRingIndex, plane, lastZ: hitPoint.z };
        state.controls.enabled = false; // suspend orbit/pan/zoom during drag
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      ndcFromEvent(e);
      state.raycaster.setFromCamera(mouseNdc, state.camera);
      if (!state.raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
      const delta = hitPoint.z - drag.lastZ;
      if (Math.abs(delta) < 1e-4) return; // ignore sub-mm jitter
      drag.lastZ = hitPoint.z;
      onAdjustSplit(drag.ringIndex, delta);
    };
    const onMouseUp = () => {
      if (drag) {
        drag = null;
        state.controls.enabled = true;
      }
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (drag) state.controls.enabled = true;
      if (prevLineThreshold !== undefined) {
        state.raycaster.params.Line = { ...state.raycaster.params.Line, threshold: prevLineThreshold };
      }
    };
    // splitPreview re-runs this effect so the new overlay's rings are picked up.
  }, [onAdjustSplit, splitPreview, cityjson]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {!externalModel && <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 0,
          background: 'rgba(20, 20, 24, 0.7)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          overflow: 'hidden',
          fontSize: 11,
          userSelect: 'none',
        }}
        title="Switch between coloring by CityObject type, semantic surface, or usage"
      >
        <ColorModeButton
          active={colorMode === 'surface'}
          onClick={() => setColorMode('surface')}
          label="By surface"
        />
        <ColorModeButton
          active={colorMode === 'object'}
          onClick={() => setColorMode('object')}
          label="By object"
        />
        <ColorModeButton
          active={colorMode === 'usage'}
          onClick={() => setColorMode('usage')}
          label="By usage"
        />
      </div>}
    </div>
  );
}

/** Give the viewer ownership of its own GPU resources. It can dispose this
 * copy when the selection changes without invalidating the cached source. */
function cloneExternalModel(source: THREE.Group): THREE.Group {
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) mesh.material = material.map((item) => item.clone());
    else if (material) mesh.material = material.clone();
  });
  return clone;
}

/** Keep one geometry tier per CityObject so the inspector never stacks LoD2
 * and LoD3 shells. Children without geometry in the requested tier remain as
 * lightweight hierarchy nodes, which preserves selection metadata. */
function documentAtLod(
  doc: CityJsonDocument,
  lod: 'highest' | 'lod2' | 'lod3'
): CityJsonDocument {
  if (lod === 'highest') return doc;
  const clone = structuredClone(doc);
  for (const object of Object.values(clone.CityObjects)) {
    const geometries = object.geometry ?? [];
    const candidates = geometries
      .map((geometry, index) => ({
        geometry,
        index,
        lod: Number.parseFloat(String((geometry as { lod?: string | number }).lod ?? '')),
      }))
      .filter((candidate) =>
        Number.isFinite(candidate.lod) &&
        (lod === 'lod3' ? candidate.lod >= 3 : candidate.lod < 3)
      );
    if (candidates.length === 0) {
      object.geometry = [];
      continue;
    }
    const highest = Math.max(...candidates.map((candidate) => candidate.lod));
    object.geometry = candidates
      .filter((candidate) => candidate.lod === highest)
      .map((candidate) => candidate.geometry);
  }
  return clone;
}

function withoutTextures(doc: CityJsonDocument): CityJsonDocument {
  const clone = structuredClone(doc);
  delete clone.appearance;
  for (const object of Object.values(clone.CityObjects)) {
    for (const geometry of object.geometry ?? []) {
      delete (geometry as { texture?: unknown }).texture;
    }
  }
  return clone;
}

/**
 * cityjson-threejs-loader currently indexes texture values as if every
 * geometry were a flat MultiSurface. A valid textured Solid has one extra
 * shell level and crashes that parser. The main map has its own Solid-aware
 * texture renderer, so the close-up inspector keeps the complete LoD3 shape
 * and semantics while omitting only the unsupported texture binding.
 */
function withoutUnsupportedSolidTextures(doc: CityJsonDocument): CityJsonDocument {
  const hasTexturedSolid = Object.values(doc.CityObjects).some((object) =>
    (object.geometry ?? []).some((geometry) => {
      const candidate = geometry as { type?: string; texture?: unknown };
      return candidate.type === 'Solid' && candidate.texture != null;
    })
  );
  if (!hasTexturedSolid) return doc;

  const clone = structuredClone(doc);
  for (const object of Object.values(clone.CityObjects)) {
    for (const geometry of object.geometry ?? []) {
      const candidate = geometry as { type?: string; texture?: unknown };
      if (candidate.type === 'Solid') delete candidate.texture;
    }
  }
  return clone;
}

/** Render valid textured Solids in the close-up inspector without sending
 * their nested texture indices through cityjson-threejs-loader's flat-surface
 * texture path. This is the same highest-LoD mesh/UV path used by the map. */
function buildTexturedViewerGroup(doc: CityJsonDocument): THREE.Group | null {
  const mesh = buildCityJsonMapMesh(doc, { maxOutputVertices: 500_000 });
  if (!mesh || mesh.textures.length === 0) return null;

  const group = new THREE.Group();
  const translate = doc.transform?.translate ?? [0, 0, 0];
  group.position.set(
    mesh.originProjected[0] - translate[0],
    mesh.originProjected[1] - translate[1],
    mesh.originProjected[2] - translate[2]
  );
  const rootId = Object.entries(doc.CityObjects).find(
    ([, object]) => object.type === 'Building' && !(object.parents?.length)
  )?.[0] ?? Object.keys(doc.CityObjects)[0];

  if (mesh.positions.length > 0 && mesh.indices.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0,
    });
    const surfaceMesh = new THREE.Mesh(geometry, material);
    surfaceMesh.userData.cityJsonObjectId = rootId;
    group.add(surfaceMesh);
  }

  const textureLoader = new THREE.TextureLoader();
  for (const textureMesh of mesh.textures) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(textureMesh.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(textureMesh.texCoords, 2));
    geometry.setIndex(new THREE.BufferAttribute(textureMesh.indices, 1));
    geometry.computeVertexNormals();
    const texture = textureLoader.load(textureMesh.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    const texturedMesh = new THREE.Mesh(geometry, material);
    texturedMesh.userData.cityJsonObjectId = rootId;
    group.add(texturedMesh);
  }
  return group;
}

function ColorModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
        color: active ? '#fff' : '#cbd0d8',
        border: 'none',
        padding: '4px 10px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

/** Toggle the parser's mesh material between per-surface and per-object color
 *  paths. Kept tiny because it's called from two places. */
function applyColorMode(parser: CityJSONParser, mode: ColorMode) {
  const mat = (parser as unknown as { meshMaterial?: { showSemantics?: boolean } }).meshMaterial;
  if (mat) mat.showSemantics = mode === 'surface';
}

/** Pin our two custom palettes onto the parser. The loader's .d.ts doesn't
 *  expose these runtime fields, so we cast through unknown — see
 *  cityjson-threejs-loader/src/parsers/CityJSONParser.js. */
function setParserPalette(
  parser: CityJSONParser,
  objectColors: Record<string, number> = OBJECT_COLORS_DISTINCT
) {
  const p = parser as unknown as {
    surfaceColors: Record<string, number>;
    objectColors: Record<string, number>;
  };
  p.surfaceColors = SURFACE_COLORS_ARCH;
  p.objectColors = objectColors;
}

/**
 * Build a Three.js group containing N-1 horizontal Line rings, one per
 * cumulative split height, traced around the selected building's ground-
 * footprint outline. Returns null if the building has no decodable ground
 * ring (BuildingPart children, missing semantics, etc.).
 *
 * The overlay is registered as a child of `modelGroup`, which already has the
 * loader's centring matrix applied — so we apply the same matrix to the
 * overlay before adding so the lines line up with the rendered building.
 */
function buildSplitOverlay(
  doc: CityJsonDocument,
  preview: SplitPreviewInfo,
  loader: CityJSONLoader | null
): THREE.Group | null {
  if (!loader || !doc.transform) return null;
  const ring = readGroundRingMetric(doc, preview.buildingId);
  if (!ring || ring.length < 3) return null;

  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffd84a, // accent yellow
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
  });

  const baseZ = ring.reduce((m, [, , z]) => Math.min(m, z), Infinity);
  let cumH = 0;
  // Draw a ring at every floor boundary EXCEPT the very top (which is the
  // eave — already where the wall ends, no split there).
  // Compute the ring's XY centroid once — useful for drag interaction
  // (we raycast a vertical plane through this point on mousemove).
  const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length;
  const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
  for (let i = 0; i < preview.heights.length - 1; i++) {
    cumH += preview.heights[i];
    const z = baseZ + cumH;
    const pts: THREE.Vector3[] = ring.map(([x, y]) => new THREE.Vector3(x, y, z));
    pts.push(pts[0].clone()); // close
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geom, lineMat);
    line.renderOrder = 999; // draw after the building so depthTest: false sticks
    // userData tags used by the drag interaction in Viewer:
    //   splitRingIndex: which entry in heights[] this ring sits above
    //   ringCenterLocal: XY centroid in pre-matrix (CRS-metric) coords
    line.userData = {
      splitRingIndex: i,
      ringCenterLocal: [cx, cy, z] as [number, number, number],
    };
    group.add(line);
  }
  addFloorPlanDividers(group, ring, baseZ, preview, lineMat);
  group.applyMatrix4(loader.matrix);
  return group;
}

/** Draw vertical divider outlines for the manual footprint cuts on each floor. */
function addFloorPlanDividers(
  group: THREE.Group,
  sourceRing: [number, number, number][],
  baseZ: number,
  preview: SplitPreviewInfo,
  material: THREE.LineBasicMaterial
): void {
  if (!preview.floorPlans || preview.floorPlans.length !== preview.heights.length) return;
  const ring = sourceRing.slice();
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) ring.pop();
  if (ring.length !== 4) return;

  const lerp = (
    a: [number, number, number],
    b: [number, number, number],
    t: number
  ): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const len0 = Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]);
  const len1 = Math.hypot(ring[2][0] - ring[1][0], ring[2][1] - ring[1][1]);
  let floorBase = baseZ;

  for (let floorIndex = 0; floorIndex < preview.heights.length; floorIndex++) {
    const floorTop = floorBase + preview.heights[floorIndex];
    const plan = preview.floorPlans[floorIndex];
    const splitOnE0 = plan.axis === 'shorter' ? !(len0 >= len1) : len0 >= len1;
    const cuts =
      plan.cutFractions?.length === plan.partCount - 1
        ? plan.cutFractions
        : new Array(Math.max(0, plan.partCount - 1))
            .fill(0)
            .map((_, i) => (i + 1) / plan.partCount);
    for (const cut of cuts) {
      const [ax, ay] = splitOnE0
        ? lerp(ring[0], ring[1], cut)
        : lerp(ring[0], ring[3], cut);
      const [bx, by] = splitOnE0
        ? lerp(ring[3], ring[2], cut)
        : lerp(ring[1], ring[2], cut);
      const points = [
        new THREE.Vector3(ax, ay, floorBase),
        new THREE.Vector3(bx, by, floorBase),
        new THREE.Vector3(bx, by, floorTop),
        new THREE.Vector3(ax, ay, floorTop),
        new THREE.Vector3(ax, ay, floorBase),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        material
      );
      line.renderOrder = 999;
      group.add(line);
    }
    floorBase = floorTop;
  }
}

/**
 * Decode a building's outer GroundSurface ring to projected-CRS metric coords.
 * Walks geometries, finds the face whose semantic surface type is
 * `GroundSurface`, and returns its outer ring with each integer-encoded vertex
 * decoded through doc.transform. Returns null if no GroundSurface is found
 * (e.g. on imported data without semantics).
 */
function readGroundRingMetric(
  doc: CityJsonDocument,
  buildingId: string
): [number, number, number][] | null {
  const obj = doc.CityObjects[buildingId];
  if (!obj?.geometry || !doc.transform) return null;
  const t = doc.transform;
  const decode = (idx: number): [number, number, number] => {
    const v = doc.vertices[idx];
    return [
      v[0] * t.scale[0] + t.translate[0],
      v[1] * t.scale[1] + t.translate[1],
      v[2] * t.scale[2] + t.translate[2],
    ];
  };
  for (const geomRaw of obj.geometry) {
    const g = geomRaw as {
      type?: string;
      boundaries?: number[][][][] | number[][][];
      semantics?: { surfaces?: Array<{ type?: string }>; values?: number[][] };
    };
    if (!g.boundaries || !g.semantics?.surfaces) continue;
    const groundIdx = g.semantics.surfaces.findIndex((s) => s?.type === 'GroundSurface');
    if (groundIdx < 0) continue;
    // For Solid: boundaries is shells[shell[face[ring]]] (4 levels deep).
    const shells = g.boundaries as number[][][][];
    if (!Array.isArray(shells[0]?.[0]?.[0])) continue; // not a Solid layout
    for (let s = 0; s < shells.length; s++) {
      const faceSem = g.semantics.values?.[s];
      if (!faceSem) continue;
      const shell = shells[s];
      for (let f = 0; f < shell.length; f++) {
        if (faceSem[f] === groundIdx) {
          const outer = shell[f][0];
          return outer.map(decode);
        }
      }
    }
  }
  return null;
}

/** Recursive Three.js group disposal helper for the split-line overlay. */
function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    const m = obj as THREE.Mesh & THREE.Line;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
    else if (mat) mat.dispose();
  });
}

function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  box: THREE.Box3
) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = (camera.fov * Math.PI) / 180;
  const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.8;
  const dir = new THREE.Vector3(1, -1, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}
