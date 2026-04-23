import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CityJSONLoader, CityJSONParser } from 'cityjson-threejs-loader';
import type { CityJsonDocument, SelectionInfo } from '../types';

interface Props {
  cityjson: CityJsonDocument;
  reloadToken: number;
  onSelect: (info: SelectionInfo | null) => void;
}

export default function Viewer({ cityjson, reloadToken, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
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
    state.parser.resetMaterial();

    const loader = new CityJSONLoader(state.parser);
    state.loader = loader;
    loader.load(cityjson);
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
  }, [cityjson, reloadToken]);

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
      }
      onSelect(null);
    };

    el.addEventListener('dblclick', onDblClick);
    return () => el.removeEventListener('dblclick', onDblClick);
  }, [onSelect, cityjson]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
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
