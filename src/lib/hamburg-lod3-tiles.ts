import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const HAMBURG_UNTEXTURED_LOD3_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD3_untexturiert/tileset.json';

// Official service extent from its root 3D Tiles bounding region.
const HAMBURG_LOD3_BOUNDS = {
  west: 9.7336,
  south: 53.3934,
  east: 10.3211,
  north: 53.7285,
};

interface TilesetNode {
  boundingVolume?: { region?: number[] | string };
  content?: { uri?: string; url?: string };
  children?: TilesetNode[];
}

interface TilesetJson {
  root: TilesetNode;
}

export interface HamburgLod3BuildingModel {
  group: THREE.Group;
  triangleCount: number;
  tileUrl: string;
}

let rootTilesetPromise: Promise<TilesetJson> | null = null;
const externalTilesetPromises = new Map<string, Promise<TilesetJson>>();

export function isHamburgOfficialBuildingId(objectId: string): boolean {
  return /^DEHH[A-Z0-9_-]+$/i.test(objectId);
}

export function hamburgLod3CoversPoint(point: [number, number]): boolean {
  return point[0] >= HAMBURG_LOD3_BOUNDS.west &&
    point[0] <= HAMBURG_LOD3_BOUNDS.east &&
    point[1] >= HAMBURG_LOD3_BOUNDS.south &&
    point[1] <= HAMBURG_LOD3_BOUNDS.north;
}

/** Convert the official glTF Y-up axes into the editor inspector's Z-up axes. */
export function hamburgLod3YUpToEditorZUp(
  coordinate: readonly [number, number, number]
): [number, number, number] {
  return [coordinate[0], -coordinate[2], coordinate[1]];
}

/**
 * Load and isolate one official untextured LoD3 building from Hamburg's
 * browser-accessible 3D Tiles service. Tile and batch-table IDs are the same
 * DEHH identifiers used by the local LoD2 context for almost all buildings.
 */
export async function loadHamburgLod3Building(
  buildingId: string,
  point: [number, number],
  signal?: AbortSignal
): Promise<HamburgLod3BuildingModel | null> {
  if (!isHamburgOfficialBuildingId(buildingId) || !hamburgLod3CoversPoint(point)) {
    return null;
  }
  const rootTileset = await loadRootTileset(signal);
  const externalNode = closestContentNode(rootTileset.root, point);
  const externalUri = contentUri(externalNode);
  if (!externalUri) return null;
  const externalUrl = new URL(externalUri, HAMBURG_UNTEXTURED_LOD3_TILESET_URL).href;
  const externalTileset = await externalTilesetAt(externalUrl, signal);
  const tileNodes = contentNodesByDistance(externalTileset.root, point).slice(0, 4);

  for (const node of tileNodes) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const uri = contentUri(node);
    if (!uri) continue;
    const tileUrl = new URL(uri, externalUrl).href;
    const response = await fetch(tileUrl, { signal });
    if (!response.ok) {
      throw new Error(`Hamburg LoD3 tile returned HTTP ${response.status}.`);
    }
    const model = await isolateBuildingFromB3dm(
      await response.arrayBuffer(),
      buildingId,
      tileUrl
    );
    if (model) return model;
  }
  return null;
}

async function loadRootTileset(signal?: AbortSignal): Promise<TilesetJson> {
  rootTilesetPromise ??= fetchTileset(HAMBURG_UNTEXTURED_LOD3_TILESET_URL);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return rootTilesetPromise;
}

async function externalTilesetAt(url: string, signal?: AbortSignal): Promise<TilesetJson> {
  let promise = externalTilesetPromises.get(url);
  if (!promise) {
    promise = fetchTileset(url);
    externalTilesetPromises.set(url, promise);
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return promise;
}

async function fetchTileset(url: string): Promise<TilesetJson> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hamburg LoD3 tileset returned HTTP ${response.status}.`);
  return response.json() as Promise<TilesetJson>;
}

function closestContentNode(root: TilesetNode, point: [number, number]): TilesetNode | null {
  return contentNodesByDistance(root, point)[0] ?? null;
}

function contentNodesByDistance(root: TilesetNode, point: [number, number]): TilesetNode[] {
  const nodes: TilesetNode[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (contentUri(node)) nodes.push(node);
    pending.push(...(node.children ?? []));
  }
  const radians: [number, number] = [
    point[0] * Math.PI / 180,
    point[1] * Math.PI / 180,
  ];
  return nodes.sort((left, right) =>
    regionDistanceSquared(readRegion(left), radians) -
      regionDistanceSquared(readRegion(right), radians) ||
    regionArea(readRegion(left)) - regionArea(readRegion(right))
  );
}

function contentUri(node: TilesetNode | null): string | null {
  return node?.content?.uri ?? node?.content?.url ?? null;
}

function readRegion(node: TilesetNode): number[] | null {
  const value = node.boundingVolume?.region;
  if (Array.isArray(value) && value.length >= 4) return value;
  if (typeof value === 'string') {
    const numbers = value.trim().split(/\s+/).map(Number);
    return numbers.length >= 4 && numbers.every(Number.isFinite) ? numbers : null;
  }
  return null;
}

function regionDistanceSquared(
  region: number[] | null,
  point: [number, number]
): number {
  if (!region) return Infinity;
  const x = Math.max(region[0], Math.min(region[2], point[0]));
  const y = Math.max(region[1], Math.min(region[3], point[1]));
  return (x - point[0]) ** 2 + (y - point[1]) ** 2;
}

function regionArea(region: number[] | null): number {
  return region ? Math.max(0, region[2] - region[0]) * Math.max(0, region[3] - region[1]) : Infinity;
}

async function isolateBuildingFromB3dm(
  buffer: ArrayBuffer,
  buildingId: string,
  tileUrl: string
): Promise<HamburgLod3BuildingModel | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (decodeAscii(bytes, 0, 4) !== 'b3dm' || bytes.byteLength < 28) return null;
  const featureJsonLength = view.getUint32(12, true);
  const featureBinaryLength = view.getUint32(16, true);
  const batchJsonLength = view.getUint32(20, true);
  const batchBinaryLength = view.getUint32(24, true);
  const batchJsonStart = 28 + featureJsonLength + featureBinaryLength;
  const batchJson = parsePaddedJson(bytes, batchJsonStart, batchJsonLength);
  const ids = findBatchIds(batchJson);
  const batchId = ids.indexOf(buildingId);
  if (batchId < 0) return null;

  const glbStart = batchJsonStart + batchJsonLength + batchBinaryLength;
  const glb = buffer.slice(glbStart);
  const parsed = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    new GLTFLoader().parse(glb, tileUrl, resolve, reject);
  });
  parsed.scene.updateMatrixWorld(true);

  const group = new THREE.Group();
  let triangleCount = 0;
  parsed.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.geometry;
    const positions = source.getAttribute('position');
    const normals = source.getAttribute('normal');
    const batches = source.getAttribute('_batchid') ?? source.getAttribute('_BATCHID');
    if (!positions || !batches) return;
    const indices = source.index;
    const selectedPositions: number[] = [];
    const selectedNormals: number[] = [];
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset + 2 < count; offset += 3) {
      const triangle = [0, 1, 2].map((step) =>
        indices ? indices.getX(offset + step) : offset + step
      );
      if (!triangle.every((index) => Math.round(batches.getX(index)) === batchId)) continue;
      triangleCount++;
      for (const index of triangle) {
        position.fromBufferAttribute(positions, index);
        // 3D Tiles/glTF is Y-up; the editor's Three.js inspector is Z-up.
        // The sign change preserves a right-handed coordinate system.
        selectedPositions.push(...hamburgLod3YUpToEditorZUp([
          position.x,
          position.y,
          position.z,
        ]));
        if (normals) {
          normal.fromBufferAttribute(normals, index);
          selectedNormals.push(...hamburgLod3YUpToEditorZUp([
            normal.x,
            normal.y,
            normal.z,
          ]));
        }
      }
    }
    if (selectedPositions.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(selectedPositions, 3));
    if (selectedNormals.length === selectedPositions.length) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(selectedNormals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    const material = Array.isArray(mesh.material)
      ? mesh.material.map((candidate) => candidate.clone())
      : mesh.material.clone();
    const selectedMesh = new THREE.Mesh(geometry, material);
    selectedMesh.userData.cityJsonObjectId = buildingId;
    group.add(selectedMesh);
  });

  if (group.children.length === 0) return null;
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  group.position.set(-center.x, -center.y, -bounds.min.z);
  group.updateMatrixWorld(true);
  return { group, triangleCount, tileUrl };
}

function findBatchIds(value: Record<string, unknown>): string[] {
  for (const key of ['id', 'gml_id', 'objectId', 'identifier']) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.map(String);
  }
  return [];
}

function parsePaddedJson(
  bytes: Uint8Array,
  offset: number,
  length: number
): Record<string, unknown> {
  if (length <= 0) return {};
  const text = new TextDecoder().decode(bytes.subarray(offset, offset + length)).replace(/[\u0000\s]+$/g, '');
  return JSON.parse(text) as Record<string, unknown>;
}

function decodeAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
