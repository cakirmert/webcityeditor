import earcut from 'earcut';
import type { CityJsonDocument } from '../types';
import { applyVertexTransform, detectCrs, projectToWgs84 } from './projection';

export interface CityJsonMapMesh {
  positions: Float32Array;
  indices: Uint32Array;
  colors: Float32Array;
  anchorLngLat: [number, number];
  triangleCount: number;
  objectCount: number;
  maxLod: number | null;
}

interface BuildOptions {
  /** Only include these CityObject ids (usually the current close viewport). */
  objectIds?: ReadonlySet<string>;
  /** Output safety cap; unlike the old gate this does not reject a large source document. */
  maxOutputVertices?: number;
  /** Backwards-compatible alias for maxOutputVertices. */
  maxInputVertices?: number;
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
 * Build one combined triangle mesh from CityJSON surfaces for small documents.
 * The map still uses footprint polygons for picking; this mesh is purely a
 * visual LoD2-ish context layer so roof geometry is visible in the map.
 */
export function buildCityJsonMapMesh(
  doc: CityJsonDocument,
  options: BuildOptions = {}
): CityJsonMapMesh | null {
  const maxOutputVertices =
    options.maxOutputVertices ?? options.maxInputVertices ?? DEFAULT_MAX_OUTPUT_VERTICES;
  if (doc.vertices.length === 0) return null;

  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  const queued: Array<{ rings: number[][]; surfaceType: string }> = [];
  const referenced = new Set<number>();
  let queuedVertexCount = 0;
  let objectCount = 0;
  let maxLod: number | null = null;

  for (const [objectId, obj] of Object.entries(doc.CityObjects)) {
    if (options.objectIds && !options.objectIds.has(objectId)) continue;
    const geometries = highestAvailableGeometries(obj.geometry ?? []);
    if (geometries.length === 0) continue;
    let objectQueued = false;
    for (const geomRaw of geometries) {
      const geom = geomRaw as {
        type?: string;
        lod?: string | number;
        boundaries?: unknown;
        semantics?: {
          surfaces?: Array<{ type?: string }>;
          values?: unknown;
        };
      };
      const lod = numericLod(geom.lod);
      if (lod !== null) maxLod = Math.max(maxLod ?? lod, lod);
      forEachSurface(geom, (rings, surfaceType) => {
        const count = rings.reduce((sum, ring) => sum + ring.length, 0);
        if (count < 3 || queuedVertexCount + count > maxOutputVertices) return;
        queued.push({ rings, surfaceType: surfaceType ?? obj.type });
        queuedVertexCount += count;
        objectQueued = true;
        for (const ring of rings) for (const index of ring) referenced.add(index);
      });
    }
    if (objectQueued) objectCount++;
    if (queuedVertexCount >= maxOutputVertices) break;
  }

  if (queued.length === 0 || referenced.size === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of referenced) {
    const vertex = doc.vertices[idx];
    if (!vertex) continue;
    const coordinate = applyVertexTransform(vertex, doc);
    minX = Math.min(minX, coordinate.x);
    minY = Math.min(minY, coordinate.y);
    minZ = Math.min(minZ, coordinate.z);
    maxX = Math.max(maxX, coordinate.x);
    maxY = Math.max(maxY, coordinate.y);
  }
  if (![minX, minY, minZ, maxX, maxY].every(Number.isFinite)) return null;
  const origin = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: minZ,
  };
  const anchorLngLat = projectToWgs84(crs.code, origin);

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const localVertex = (idx: number): [number, number, number] | null => {
    const v = doc.vertices[idx];
    if (!v) return null;
    const c = applyVertexTransform(v, doc);
    return [c.x - origin.x, c.y - origin.y, c.z - origin.z];
  };

  for (const surface of queued) {
    addSurface(
      surface.rings,
      surface.surfaceType,
      localVertex,
      positions,
      colors,
      indices
    );
  }

  if (positions.length === 0 || indices.length === 0) return null;
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    colors: new Float32Array(colors),
    anchorLngLat,
    triangleCount: indices.length / 3,
    objectCount,
    maxLod,
  };
}

function highestAvailableGeometries<T>(geometries: T[]): T[] {
  if (geometries.length <= 1) return geometries;
  const lods = geometries.map((geometry) =>
    numericLod((geometry as { lod?: string | number }).lod)
  );
  const numeric = lods.filter((lod): lod is number => lod !== null);
  if (numeric.length === 0) return [geometries.at(-1)!];
  const highest = Math.max(...numeric);
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
  },
  emit: (rings: number[][], surfaceType: string | null) => void
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
      emit(readFace(b[i]), getType(i));
    }
  } else if (geom.type === 'Solid') {
    for (let shellIdx = 0; shellIdx < b.length; shellIdx++) {
      const shell = b[shellIdx];
      if (!Array.isArray(shell)) continue;
      for (let faceIdx = 0; faceIdx < shell.length; faceIdx++) {
        emit(readFace(shell[faceIdx]), getType(shellIdx, faceIdx));
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
          emit(readFace(shell[faceIdx]), getType(solidIdx, shellIdx, faceIdx));
        }
      }
    }
  }
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
  localVertex: (idx: number) => [number, number, number] | null,
  positions: number[],
  colors: number[],
  indices: number[]
) {
  if (rings.length === 0 || rings[0].length < 3) return;

  const vertices3d: [number, number, number][] = [];
  const flat2d: number[] = [];
  const holes: number[] = [];
  const color = colorForSurface(surfaceType);
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
