import earcut from 'earcut';
import type { CityJsonDocument } from '../types';
import { applyVertexTransform, detectCrs, projectToWgs84 } from './projection';

export interface CityJsonMapMesh {
  positions: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
  textures: CityJsonTextureMesh[];
  anchorLngLat: [number, number];
  /** Projected source coordinate represented by local [0,0,0]. */
  originProjected: [number, number, number];
  triangleCount: number;
  objectCount: number;
  maxLod: number | null;
  texturedSurfaceCount: number;
  availableTexturedSurfaceCount: number;
  explicitOpeningSurfaceCount: number;
  surfaceCount: number;
  rootObjectCount: number;
  installationObjectCount: number;
  objectCountByLod: Record<string, number>;
  droppedObjectCount: number;
  truncated: boolean;
  /** Canonical per-root anchors computed from all source LoDs, never the active camera subset. */
  objectAnchors: CityJsonObjectMapAnchor[];
}

export interface CityJsonObjectMapAnchor {
  rootId: string;
  projected: [number, number, number];
  lngLat: [number, number];
}

export interface CityJsonTextureMesh {
  image: string;
  positions: Float32Array;
  indices: Uint32Array;
  texCoords: Float32Array;
}

export interface CityJsonMapBuildOptions {
  /** Only include these CityObject ids (usually the current close viewport). */
  objectIds?: ReadonlySet<string>;
  /** Select the highest source geometry at or below this LoD. */
  maxLod?: number;
  /** Output safety cap; unlike the old gate this does not reject a large source document. */
  maxOutputVertices?: number;
  /** Backwards-compatible alias for maxOutputVertices. */
  maxInputVertices?: number;
  /** Place each root object group on the flat map ground without changing its relative heights. */
  groundObjectGroups?: boolean;
  /** Bind source photographs. False keeps the same highest-LoD geometry but
   * colours every face from its semantic surface type. */
  texturesEnabled?: boolean;
  /** Optional normalized RGB override by CityObject id. Descendants inherit
   * the colour assigned to their root object. */
  objectColors?: ReadonlyMap<string, readonly [number, number, number]>;
  /** Stable projected origin shared by every LoD/texture representation. */
  originProjected?: readonly [number, number, number];
}

const DEFAULT_MAX_OUTPUT_VERTICES = 80_000;

const SURFACE_COLORS: Record<string, [number, number, number]> = {
  GroundSurface: [0.36, 0.33, 0.3],
  WallSurface: [0.78, 0.74, 0.67],
  RoofSurface: [0.56, 0.23, 0.18],
  OuterCeilingSurface: [0.42, 0.38, 0.34],
  Window: [0.24, 0.44, 0.56],
  Door: [0.29, 0.18, 0.12],
};

/**
 * Build one combined highest-available triangle mesh from CityJSON surfaces.
 * The map still uses footprint polygons for picking; this mesh owns the
 * camera-independent LoD2/LoD3 semantic and photo-textured representation.
 */
export function buildCityJsonMapMesh(
  doc: CityJsonDocument,
  options: CityJsonMapBuildOptions = {}
): CityJsonMapMesh | null {
  const maxOutputVertices =
    options.maxOutputVertices ?? options.maxInputVertices ?? DEFAULT_MAX_OUTPUT_VERTICES;
  if (doc.vertices.length === 0) return null;

  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  const queued: Array<{
    rings: number[][];
    surfaceType: string;
    texture: SurfaceTexture | null;
    availableTexture: boolean;
    groundZ: number | null;
    color: readonly [number, number, number] | null;
    lod: number | null;
  }> = [];
  const referenced = new Set<number>();
  let queuedVertexCount = 0;
  let objectCount = 0;
  let maxLod: number | null = null;
  const queuedObjectIds = new Set<string>();
  const droppedObjectIds = new Set<string>();
  const queuedRootIds = new Set<string>();
  const objectCountByLod: Record<string, number> = {};
  let installationObjectCount = 0;
  let truncated = false;
  // `objectIds` is an insertion-ordered Set assembled nearest-first by the
  // map. Honour that order so the output cap cannot be exhausted by farther
  // LoD2 context before the close LoD3 buildings and their installations are
  // reached later in the CityJSON object's original document order.
  const orderedObjectIds = options.objectIds
    ? [...options.objectIds].filter((objectId) => !!doc.CityObjects[objectId])
    : Object.keys(doc.CityObjects);

  const selectedGeometries = new Map<string, unknown[]>();
  for (const objectId of orderedObjectIds) {
    const object = doc.CityObjects[objectId];
    selectedGeometries.set(
      objectId,
      highestAvailableGeometries(object.geometry ?? [], options.maxLod)
    );
  }
  const selectedRootIds = new Set(orderedObjectIds.map((objectId) => rootObjectId(doc, objectId)));
  const groupMetrics = computeObjectGroupMetrics(doc, selectedRootIds);
  const groundByGroup = options.groundObjectGroups
    ? new Map([...groupMetrics].map(([groupId, metrics]) => [groupId, metrics.minZ]))
    : new Map<string, number>();

  for (const objectId of orderedObjectIds) {
    const obj = doc.CityObjects[objectId];
    const geometries = selectedGeometries.get(objectId) ?? [];
    if (geometries.length === 0) continue;
    const groupId = rootObjectId(doc, objectId);
    const groundZ = groundByGroup.get(groupId) ?? null;
    const objectColor =
      options.objectColors?.get(objectId) ?? options.objectColors?.get(groupId) ?? null;
    let objectQueued = false;
    let objectMaxLod: number | null = null;
    for (const geomRaw of geometries) {
      const geom = geomRaw as {
        type?: string;
        lod?: string | number;
        boundaries?: unknown;
        semantics?: {
          surfaces?: Array<{ type?: string }>;
          values?: unknown;
        };
        texture?: unknown;
      };
      const lod = numericLod(geom.lod);
      forEachSurface(geom, (rings, surfaceType, path) => {
        const count = rings.reduce((sum, ring) => sum + ring.length, 0);
        if (count < 3) return;
        if (queuedVertexCount + count > maxOutputVertices) {
          truncated = true;
          droppedObjectIds.add(objectId);
          return;
        }
        const availableTexture = readSurfaceTexture(doc, geom, path, rings);
        queued.push({
          rings,
          surfaceType: surfaceType ?? obj.type,
          texture:
            options.texturesEnabled === false
              ? null
              : availableTexture,
          availableTexture: availableTexture !== null,
          groundZ,
          color: objectColor,
          lod,
        });
        queuedVertexCount += count;
        objectQueued = true;
        if (lod !== null) {
          maxLod = Math.max(maxLod ?? lod, lod);
          objectMaxLod = Math.max(objectMaxLod ?? lod, lod);
        }
        for (const ring of rings) for (const index of ring) referenced.add(index);
      });
    }
    if (objectQueued) {
      objectCount++;
      queuedObjectIds.add(objectId);
      queuedRootIds.add(groupId);
      if (obj.type === 'BuildingInstallation') installationObjectCount++;
      const lodKey = objectMaxLod === null ? 'unknown' : String(objectMaxLod);
      objectCountByLod[lodKey] = (objectCountByLod[lodKey] ?? 0) + 1;
    }
  }

  if (queued.length === 0 || referenced.size === 0) return null;

  const canonicalOrigin = options.originProjected ?? canonicalCityJsonMapOrigin(doc);
  if (!canonicalOrigin) return null;
  const origin = {
    x: canonicalOrigin[0],
    y: canonicalOrigin[1],
    z: options.groundObjectGroups ? 0 : canonicalOrigin[2],
  };
  const anchorLngLat = projectToWgs84(crs.code, origin);

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const textured = new Map<
    string,
    { image: string; positions: number[]; indices: number[]; texCoords: number[] }
  >();

  const localVertex = (idx: number, groundZ: number | null): [number, number, number] | null => {
    const v = doc.vertices[idx];
    if (!v) return null;
    const c = applyVertexTransform(v, doc);
    const lngLat = projectToWgs84(crs.code, c);
    const [east, north] = localMapMetersFromLngLat(anchorLngLat, lngLat);
    return [east, north, c.z - (groundZ ?? origin.z)];
  };

  for (const surface of queued) {
    if (surface.texture) {
      let target = textured.get(surface.texture.image);
      if (!target) {
        target = { image: surface.texture.image, positions: [], indices: [], texCoords: [] };
        textured.set(surface.texture.image, target);
      }
      addTexturedSurface(
        surface.rings,
        surface.texture.uvRings,
        (idx) => localVertex(idx, surface.groundZ),
        target
      );
    } else {
      addSurface(
        surface.rings,
        surface.surfaceType,
        surface.color,
        (idx) => localVertex(idx, surface.groundZ),
        positions,
        colors,
        indices
      );
    }
  }

  const textures = [...textured.values()]
    .filter((mesh) => mesh.positions.length > 0 && mesh.indices.length > 0)
    .map((mesh) => ({
      image: mesh.image,
      positions: new Float32Array(mesh.positions),
      indices: new Uint32Array(mesh.indices),
      texCoords: new Float32Array(mesh.texCoords),
    }));
  if ((positions.length === 0 || indices.length === 0) && textures.length === 0) return null;
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    colors: new Float32Array(colors),
    textures,
    anchorLngLat,
    originProjected: [origin.x, origin.y, origin.z],
    triangleCount:
      indices.length / 3 + textures.reduce((sum, texture) => sum + texture.indices.length / 3, 0),
    objectCount,
    maxLod,
    texturedSurfaceCount: queued.filter((surface) => surface.texture !== null).length,
    availableTexturedSurfaceCount: queued.filter((surface) => surface.availableTexture).length,
    explicitOpeningSurfaceCount: queued.filter(
      (surface) => surface.surfaceType === 'Window' || surface.surfaceType === 'Door'
    ).length,
    surfaceCount: queued.length,
    rootObjectCount: queuedRootIds.size,
    installationObjectCount,
    objectCountByLod,
    droppedObjectCount: [...droppedObjectIds].filter((objectId) => !queuedObjectIds.has(objectId)).length,
    truncated,
    objectAnchors: [...queuedRootIds].flatMap((rootId) => {
      const metrics = groupMetrics.get(rootId);
      if (!metrics) return [];
      const projected: [number, number, number] = [
        (metrics.minX + metrics.maxX) / 2,
        (metrics.minY + metrics.maxY) / 2,
        metrics.minZ,
      ];
      return [{ rootId, projected, lngLat: projectToWgs84(crs.code, {
        x: projected[0], y: projected[1], z: projected[2],
      }) }];
    }),
  };
}

interface ObjectGroupMetrics {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/**
 * One camera-independent origin for every viewport subset, LoD, and texture
 * state. Metadata extent is authoritative when present; otherwise all
 * geometry-referenced vertices (not unused tail vertices) define the origin.
 */
export function canonicalCityJsonMapOrigin(
  doc: CityJsonDocument
): [number, number, number] | null {
  const extent = doc.metadata?.geographicalExtent;
  if (
    Array.isArray(extent) &&
    extent.length >= 6 &&
    extent.slice(0, 6).every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    return [
      (extent[0] + extent[3]) / 2,
      (extent[1] + extent[4]) / 2,
      extent[2],
    ];
  }
  const roots = new Set(Object.keys(doc.CityObjects).map((id) => rootObjectId(doc, id)));
  const metrics = [...computeObjectGroupMetrics(doc, roots).values()];
  if (metrics.length === 0) return null;
  return [
    (Math.min(...metrics.map((entry) => entry.minX)) +
      Math.max(...metrics.map((entry) => entry.maxX))) / 2,
    (Math.min(...metrics.map((entry) => entry.minY)) +
      Math.max(...metrics.map((entry) => entry.maxY))) / 2,
    Math.min(...metrics.map((entry) => entry.minZ)),
  ];
}

/** Convert WGS84 positions to stable east/north offsets expected by deck.gl. */
export function localMapMetersFromLngLat(
  anchor: readonly [number, number],
  point: readonly [number, number]
): [number, number] {
  const latitude = ((anchor[1] + point[1]) / 2) * Math.PI / 180;
  return [
    (point[0] - anchor[0]) * 111_320 * Math.max(0.2, Math.cos(latitude)),
    (point[1] - anchor[1]) * 110_540,
  ];
}

function computeObjectGroupMetrics(
  doc: CityJsonDocument,
  selectedRootIds: ReadonlySet<string>
): Map<string, ObjectGroupMetrics> {
  const metricsByGroup = new Map<string, ObjectGroupMetrics>();
  for (const [objectId, object] of Object.entries(doc.CityObjects)) {
    const groupId = rootObjectId(doc, objectId);
    if (!selectedRootIds.has(groupId)) continue;
    for (const geometry of object.geometry ?? []) {
      const indices = collectBoundaryIndices(
        (geometry as { boundaries?: unknown }).boundaries
      );
      for (const index of indices) {
        const vertex = doc.vertices[index];
        if (!vertex) continue;
        const coordinate = applyVertexTransform(vertex, doc);
        if (![coordinate.x, coordinate.y, coordinate.z].every(Number.isFinite)) continue;
        const current = metricsByGroup.get(groupId) ?? {
          minX: Infinity,
          minY: Infinity,
          minZ: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
          maxZ: -Infinity,
        };
        current.minX = Math.min(current.minX, coordinate.x);
        current.minY = Math.min(current.minY, coordinate.y);
        current.minZ = Math.min(current.minZ, coordinate.z);
        current.maxX = Math.max(current.maxX, coordinate.x);
        current.maxY = Math.max(current.maxY, coordinate.y);
        current.maxZ = Math.max(current.maxZ, coordinate.z);
        metricsByGroup.set(groupId, current);
      }
    }
  }
  return metricsByGroup;
}

function rootObjectId(doc: CityJsonDocument, objectId: string): string {
  let currentId = objectId;
  const visited = new Set<string>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = doc.CityObjects[currentId]?.parents?.[0];
    if (!parentId || !doc.CityObjects[parentId]) break;
    currentId = parentId;
  }
  return currentId;
}

function collectBoundaryIndices(value: unknown, result = new Set<number>()): Set<number> {
  if (Number.isInteger(value)) result.add(Number(value));
  else if (Array.isArray(value)) value.forEach((item) => collectBoundaryIndices(item, result));
  return result;
}

function highestAvailableGeometries<T>(geometries: T[], maxLod?: number): T[] {
  if (geometries.length === 0) return [];
  const lods = geometries.map((geometry) =>
    numericLod((geometry as { lod?: string | number }).lod)
  );
  const numeric = lods.filter((lod): lod is number => lod !== null);
  if (numeric.length === 0) return [geometries.at(-1)!];
  const eligible = maxLod === undefined ? numeric : numeric.filter((lod) => lod <= maxLod);
  if (eligible.length === 0) return [];
  const highest = Math.max(...eligible);
  return geometries.filter((_, index) => lods[index] === highest);
}

function numericLod(value: string | number | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function forEachSurface(
  geom: {
    type?: string;
    boundaries?: unknown;
    semantics?: {
      surfaces?: Array<{ type?: string }>;
      values?: unknown;
    };
    texture?: unknown;
  },
  emit: (rings: number[][], surfaceType: string | null, path: number[]) => void
) {
  const b = geom.boundaries;
  if (!Array.isArray(b)) return;

  const surfaces = geom.semantics?.surfaces ?? [];
  const values = geom.semantics?.values;
  const getType = (...path: number[]): string | null => {
    let cur: unknown = values;
    for (const p of path) {
      if (!Array.isArray(cur)) return null;
      cur = cur[p];
    }
    return typeof cur === 'number' ? surfaces[cur]?.type ?? null : null;
  };

  if (geom.type === 'MultiSurface' || geom.type === 'CompositeSurface') {
    for (let i = 0; i < b.length; i++) {
      emit(readFace(b[i]), getType(i), [i]);
    }
  } else if (geom.type === 'Solid') {
    for (let shellIdx = 0; shellIdx < b.length; shellIdx++) {
      const shell = b[shellIdx];
      if (!Array.isArray(shell)) continue;
      for (let faceIdx = 0; faceIdx < shell.length; faceIdx++) {
        emit(readFace(shell[faceIdx]), getType(shellIdx, faceIdx), [shellIdx, faceIdx]);
      }
    }
  } else if (geom.type === 'MultiSolid' || geom.type === 'CompositeSolid') {
    for (let solidIdx = 0; solidIdx < b.length; solidIdx++) {
      const solid = b[solidIdx];
      if (!Array.isArray(solid)) continue;
      for (let shellIdx = 0; shellIdx < solid.length; shellIdx++) {
        const shell = solid[shellIdx];
        if (!Array.isArray(shell)) continue;
        for (let faceIdx = 0; faceIdx < shell.length; faceIdx++) {
          emit(
            readFace(shell[faceIdx]),
            getType(solidIdx, shellIdx, faceIdx),
            [solidIdx, shellIdx, faceIdx]
          );
        }
      }
    }
  }
}

interface SurfaceTexture {
  image: string;
  uvRings: [number, number][][];
}

function readSurfaceTexture(
  doc: CityJsonDocument,
  geom: { texture?: unknown },
  path: number[],
  rings: number[][]
): SurfaceTexture | null {
  const themes = geom.texture && typeof geom.texture === 'object'
    ? Object.values(geom.texture as Record<string, unknown>)
    : [];
  const appearance = doc.appearance as {
    textures?: Array<{ image?: string }>;
    'vertices-texture'?: number[][];
  } | undefined;
  const textureVertices = appearance?.['vertices-texture'];
  if (!appearance?.textures || !textureVertices) return null;

  for (const theme of themes) {
    let value: unknown = (theme as { values?: unknown })?.values;
    for (const index of path) {
      if (!Array.isArray(value)) {
        value = null;
        break;
      }
      value = value[index];
    }
    if (!Array.isArray(value) || value.length !== rings.length) continue;
    const refs = value as unknown[];
    const first = refs[0];
    if (!Array.isArray(first) || !Number.isInteger(first[0])) continue;
    const textureIndex = Number(first[0]);
    const image = appearance.textures[textureIndex]?.image;
    if (!image) continue;

    const uvRings: [number, number][][] = [];
    let valid = true;
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      const ref = refs[ringIndex];
      if (
        !Array.isArray(ref) ||
        Number(ref[0]) !== textureIndex ||
        ref.length !== rings[ringIndex].length + 1
      ) {
        valid = false;
        break;
      }
      const uvRing = ref.slice(1).map((uvIndex): [number, number] | null => {
        const uv = textureVertices[Number(uvIndex)];
        return Array.isArray(uv) && uv.length >= 2 ? [Number(uv[0]), Number(uv[1])] : null;
      });
      if (uvRing.some((uv) => uv === null)) {
        valid = false;
        break;
      }
      uvRings.push(uvRing as [number, number][]);
    }
    if (valid) return { image, uvRings };
  }
  return null;
}

function readFace(face: unknown): number[][] {
  if (!Array.isArray(face)) return [];
  return face.filter(
    (ring): ring is number[] =>
      Array.isArray(ring) && ring.every((idx) => typeof idx === 'number')
  );
}

function addSurface(
  rings: number[][],
  surfaceType: string,
  colorOverride: readonly [number, number, number] | null,
  localVertex: (idx: number) => [number, number, number] | null,
  positions: number[],
  colors: number[],
  indices: number[]
) {
  if (rings.length === 0 || rings[0].length < 3) return;

  const vertices3d: [number, number, number][] = [];
  const flat2d: number[] = [];
  const holes: number[] = [];
  const color = colorOverride ?? colorForSurface(surfaceType);
  let vertexOffset = 0;

  for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
    const ring = rings[ringIdx];
    if (ring.length < 3) continue;
    if (ringIdx > 0) holes.push(vertices3d.length);
    for (const idx of ring) {
      const p = localVertex(idx);
      if (!p) return;
      vertices3d.push(p);
    }
  }

  if (vertices3d.length < 3) return;
  const projection = projectionForFace(vertices3d);
  for (const p of vertices3d) {
    if (projection === 'yz') flat2d.push(p[1], p[2]);
    else if (projection === 'xz') flat2d.push(p[0], p[2]);
    else flat2d.push(p[0], p[1]);
  }

  vertexOffset = positions.length / 3;
  for (const p of vertices3d) {
    positions.push(p[0], p[1], p[2]);
    colors.push(color[0], color[1], color[2]);
  }

  const tris = earcut(flat2d, holes, 2);
  for (const triIdx of tris) indices.push(vertexOffset + triIdx);
}

function addTexturedSurface(
  rings: number[][],
  uvRings: [number, number][][],
  localVertex: (idx: number) => [number, number, number] | null,
  target: { positions: number[]; indices: number[]; texCoords: number[] },
) {
  if (rings.length === 0 || rings[0].length < 3 || rings.length !== uvRings.length) return;
  const vertices3d: [number, number, number][] = [];
  const flat2d: number[] = [];
  const holes: number[] = [];
  const uvCoordinates: [number, number][] = [];

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    const uvRing = uvRings[ringIndex];
    if (ring.length < 3 || ring.length !== uvRing.length) return;
    if (ringIndex > 0) holes.push(vertices3d.length);
    for (let index = 0; index < ring.length; index++) {
      const point = localVertex(ring[index]);
      const uv = uvRing[index];
      if (!point || !uv) return;
      vertices3d.push(point);
      uvCoordinates.push(uv);
    }
  }

  const projection = projectionForFace(vertices3d);
  for (const point of vertices3d) {
    if (projection === 'yz') flat2d.push(point[1], point[2]);
    else if (projection === 'xz') flat2d.push(point[0], point[2]);
    else flat2d.push(point[0], point[1]);
  }

  const vertexOffset = target.positions.length / 3;
  for (const point of vertices3d) target.positions.push(point[0], point[1], point[2]);
  for (const uv of uvCoordinates) {
    // CityJSON texture coordinates use a lower-left origin, while browser image
    // uploads expose their first row at v=0. Flip once in the shared mesh so
    // deck.gl and Three.js sample the same source texels.
    target.texCoords.push(uv[0], 1 - uv[1]);
  }
  for (const triangle of earcut(flat2d, holes, 2)) target.indices.push(vertexOffset + triangle);
}

function projectionForFace(points: [number, number, number][]): 'xy' | 'xz' | 'yz' {
  const normal = newellNormal(points);
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  if (ax >= ay && ax >= az) return 'yz';
  if (ay >= ax && ay >= az) return 'xz';
  return 'xy';
}

function newellNormal(points: [number, number, number][]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    x += (current[1] - next[1]) * (current[2] + next[2]);
    y += (current[2] - next[2]) * (current[0] + next[0]);
    z += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return [x, y, z];
}

function colorForSurface(surfaceType: string): [number, number, number] {
  return SURFACE_COLORS[surfaceType] ?? [0.5, 0.58, 0.72];
}
