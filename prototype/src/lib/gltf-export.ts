import earcut from 'earcut';
import type { CityJsonDocument, CityObject } from '../types';

/**
 * Export a CityJsonDocument to a binary glTF (`.glb`) buffer that any glTF
 * viewer (Blender, Sketchfab, three.js, Cesium, Babylon.js, …) can load
 * directly. Useful for sharing edited city models without requiring the
 * recipient to install a CityJSON-aware tool.
 *
 * Scope decisions for v1:
 *  - One mesh per CityObject (Building / BuildingPart / Bridge / …).
 *  - Each face is triangulated via earcut, on the projected 2D plane
 *    perpendicular to its dominant normal axis.
 *  - Per-triangle flat shading: each triangle gets its own 3 unique vertices
 *    (no shared positions). Avoids needing a smoothing-group inference and
 *    works correctly for hard-edged building geometry.
 *  - Vertex colour from semantic surface type — Wall=cream, Roof=terracotta,
 *    Window=teal-blue, Door=walnut, OuterCeiling=warm beige, no-semantic =
 *    grey. Mirrors the viewer's `By surface` palette so the .glb looks
 *    visually consistent with what the user sees in the prototype.
 *  - Coordinates are centred on the bounding-box centroid before being
 *    written as Float32, so we don't lose precision on large coordinates
 *    (UTM coords like (565000, 5936000) would otherwise round badly).
 *
 * Out of scope for v1 (could come later):
 *  - Textures / appearance/material from CityJSON
 *  - Multiple LoDs as separate scenes
 *  - Instanced trees / vegetation
 *  - extras with the original CRS metadata (caller can wrap if needed)
 */
export function exportToGltf(doc: CityJsonDocument): Uint8Array {
  if (!doc.transform) {
    throw new Error('Cannot export glTF: document has no transform');
  }
  const t = doc.transform;
  const decode = (idx: number): [number, number, number] => {
    const v = doc.vertices[idx];
    return [
      v[0] * t.scale[0] + t.translate[0],
      v[1] * t.scale[1] + t.translate[1],
      v[2] * t.scale[2] + t.translate[2],
    ];
  };

  // Pass 1: walk all CityObjects, triangulate every face, accumulate raw
  // (position, color, normal) triples into per-mesh arrays.
  interface MeshData {
    objectId: string;
    positions: number[]; // flat Float32-bound, length = 3 * triCount * 3
    colors: number[]; // flat Uint8-bound, length = 4 * triCount * 3
    normals: number[]; // flat Float32-bound, length = 3 * triCount * 3
  }

  const meshes: MeshData[] = [];
  let totalTris = 0;

  for (const [id, obj] of Object.entries(doc.CityObjects)) {
    if (!obj.geometry || (obj.geometry as unknown[]).length === 0) continue;
    const md: MeshData = { objectId: id, positions: [], colors: [], normals: [] };
    triangulateObject(obj, decode, md);
    if (md.positions.length === 0) continue;
    meshes.push(md);
    totalTris += md.positions.length / 9; // 9 floats per triangle
  }

  if (meshes.length === 0) {
    throw new Error('Cannot export glTF: no triangulatable geometry found');
  }

  // Pass 2: compute global centroid for centring + collect global min/max for accessors.
  let cx = 0,
    cy = 0,
    cz = 0,
    n = 0;
  for (const m of meshes) {
    for (let i = 0; i < m.positions.length; i += 3) {
      cx += m.positions[i];
      cy += m.positions[i + 1];
      cz += m.positions[i + 2];
      n++;
    }
  }
  cx /= n || 1;
  cy /= n || 1;
  cz /= n || 1;

  // Subtract centroid in place so Float32 has enough precision.
  for (const m of meshes) {
    for (let i = 0; i < m.positions.length; i += 3) {
      m.positions[i] -= cx;
      m.positions[i + 1] -= cy;
      m.positions[i + 2] -= cz;
    }
  }

  // Pass 3: build the binary buffer. Layout per mesh:
  //   indices (Uint32) | positions (Float32 vec3) | normals (Float32 vec3) | colors (Uint8 vec4 normalized)
  // glTF requires bufferView byteOffset to be a multiple of the largest
  // component byte size in the view (4 for Float32/Uint32, 1 for Uint8).
  const ALIGN = 4;
  const align = (n: number) => (n + ALIGN - 1) & ~(ALIGN - 1);

  type BufferView = { byteOffset: number; byteLength: number; target?: number };
  type Accessor = {
    bufferView: number;
    componentType: number; // 5121=u8, 5125=u32, 5126=f32
    count: number;
    type: 'SCALAR' | 'VEC3' | 'VEC4';
    normalized?: boolean;
    min?: number[];
    max?: number[];
  };
  const bufferViews: BufferView[] = [];
  const accessors: Accessor[] = [];
  const meshDescriptors: Array<{
    name: string;
    indicesAcc: number;
    positionsAcc: number;
    normalsAcc: number;
    colorsAcc: number;
  }> = [];

  // First sweep: compute total byte length so we can allocate one ArrayBuffer.
  let totalBytes = 0;
  for (const m of meshes) {
    const triCount = m.positions.length / 9;
    const vertCount = triCount * 3;
    const idxBytes = vertCount * 4; // u32
    const posBytes = vertCount * 12; // f32 vec3
    const normBytes = vertCount * 12; // f32 vec3
    const colBytes = vertCount * 4; // u8 vec4 (padded to 4 bytes)
    totalBytes = align(totalBytes) + idxBytes;
    totalBytes = align(totalBytes) + posBytes;
    totalBytes = align(totalBytes) + normBytes;
    totalBytes = align(totalBytes) + colBytes;
  }
  totalBytes = align(totalBytes); // glb requires 4-byte-aligned BIN chunk

  const binBuffer = new ArrayBuffer(totalBytes);
  const u32 = new Uint32Array(binBuffer);
  const f32 = new Float32Array(binBuffer);
  const u8 = new Uint8Array(binBuffer);

  let cursor = 0;
  for (const m of meshes) {
    const triCount = m.positions.length / 9;
    const vertCount = triCount * 3;

    // Indices: 0..vertCount-1 (since we emit one unique vertex per triangle corner).
    cursor = align(cursor);
    const idxOffset = cursor;
    for (let i = 0; i < vertCount; i++) u32[(idxOffset + i * 4) >> 2] = i;
    bufferViews.push({
      byteOffset: idxOffset,
      byteLength: vertCount * 4,
      target: 34963, // ELEMENT_ARRAY_BUFFER
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5125, // u32
      count: vertCount,
      type: 'SCALAR',
    });
    const indicesAcc = accessors.length - 1;
    cursor = idxOffset + vertCount * 4;

    // Positions
    cursor = align(cursor);
    const posOffset = cursor;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < m.positions.length; i++) {
      f32[(posOffset + i * 4) >> 2] = m.positions[i];
      const v = m.positions[i];
      const ax = i % 3;
      if (ax === 0) {
        if (v < minX) minX = v;
        if (v > maxX) maxX = v;
      } else if (ax === 1) {
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
      } else {
        if (v < minZ) minZ = v;
        if (v > maxZ) maxZ = v;
      }
    }
    bufferViews.push({
      byteOffset: posOffset,
      byteLength: m.positions.length * 4,
      target: 34962, // ARRAY_BUFFER
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126, // f32
      count: vertCount,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });
    const positionsAcc = accessors.length - 1;
    cursor = posOffset + m.positions.length * 4;

    // Normals
    cursor = align(cursor);
    const normOffset = cursor;
    for (let i = 0; i < m.normals.length; i++) {
      f32[(normOffset + i * 4) >> 2] = m.normals[i];
    }
    bufferViews.push({
      byteOffset: normOffset,
      byteLength: m.normals.length * 4,
      target: 34962,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: vertCount,
      type: 'VEC3',
    });
    const normalsAcc = accessors.length - 1;
    cursor = normOffset + m.normals.length * 4;

    // Colors (Uint8 RGBA normalized)
    cursor = align(cursor);
    const colOffset = cursor;
    for (let i = 0; i < m.colors.length; i++) {
      u8[colOffset + i] = m.colors[i];
    }
    bufferViews.push({
      byteOffset: colOffset,
      byteLength: m.colors.length,
      target: 34962,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5121, // u8
      count: vertCount,
      type: 'VEC4',
      normalized: true,
    });
    const colorsAcc = accessors.length - 1;
    cursor = colOffset + m.colors.length;

    meshDescriptors.push({
      name: m.objectId,
      indicesAcc,
      positionsAcc,
      normalsAcc,
      colorsAcc,
    });
  }

  // Build glTF JSON
  const gltf = {
    asset: { version: '2.0', generator: 'webcityeditor' },
    scene: 0,
    scenes: [{ name: 'CityJSON export', nodes: meshDescriptors.map((_, i) => i) }],
    nodes: meshDescriptors.map((m, i) => ({ mesh: i, name: m.name })),
    meshes: meshDescriptors.map((m) => ({
      name: m.name,
      primitives: [
        {
          attributes: {
            POSITION: m.positionsAcc,
            NORMAL: m.normalsAcc,
            COLOR_0: m.colorsAcc,
          },
          indices: m.indicesAcc,
          material: 0,
        },
      ],
    })),
    materials: [
      {
        name: 'building',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
        doubleSided: true,
      },
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBytes }],
    extras: {
      cityjson: {
        // Stash the centroid we subtracted, plus the source CRS, so a smart
        // consumer can reproject if needed.
        centroid: [cx, cy, cz],
        referenceSystem: doc.metadata?.referenceSystem ?? null,
        objectCount: meshes.length,
      },
    },
  };

  // Pack as .glb (binary glTF v2)
  const jsonStr = JSON.stringify(gltf);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  // JSON chunk must be 4-byte aligned, padded with spaces (0x20).
  const jsonPad = (4 - (jsonBytes.length & 3)) & 3;
  const jsonAligned = new Uint8Array(jsonBytes.length + jsonPad);
  jsonAligned.set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) jsonAligned[jsonBytes.length + i] = 0x20;

  // Header (12) + JSON chunk header (8) + JSON + BIN chunk header (8) + BIN
  const totalLen = 12 + 8 + jsonAligned.length + 8 + totalBytes;
  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);

  // glb header
  dv.setUint32(0, 0x46546c67, true); // magic 'glTF'
  dv.setUint32(4, 2, true); // version
  dv.setUint32(8, totalLen, true); // total length

  // JSON chunk
  dv.setUint32(12, jsonAligned.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonAligned, 20);

  // BIN chunk
  const binChunkOffset = 20 + jsonAligned.length;
  dv.setUint32(binChunkOffset, totalBytes, true);
  dv.setUint32(binChunkOffset + 4, 0x004e4942, true); // 'BIN\0'
  out.set(new Uint8Array(binBuffer), binChunkOffset + 8);

  return out;
}

/**
 * Walk a CityObject's geometry and emit one (position, normal, colour) per
 * triangle vertex into the caller's flat arrays. Faces are triangulated via
 * earcut after projecting onto their dominant 2D plane.
 */
function triangulateObject(
  obj: CityObject,
  decode: (idx: number) => [number, number, number],
  out: { positions: number[]; colors: number[]; normals: number[] }
): void {
  if (!obj.geometry) return;
  for (const geomRaw of obj.geometry as Array<{
    type?: string;
    boundaries?: unknown;
    semantics?: { surfaces?: Array<{ type?: string }>; values?: unknown };
  }>) {
    if (!geomRaw.boundaries) continue;
    const surfaces = geomRaw.semantics?.surfaces ?? [];
    const semValuesRaw = geomRaw.semantics?.values;
    if (geomRaw.type === 'Solid') {
      const shells = geomRaw.boundaries as number[][][][];
      const semShells = (semValuesRaw as number[][]) ?? [];
      for (let s = 0; s < shells.length; s++) {
        const shell = shells[s];
        const semFaces = semShells[s] ?? [];
        for (let f = 0; f < shell.length; f++) {
          const face = shell[f];
          const surfaceType = surfaces[semFaces[f]]?.type ?? null;
          triangulateFace(face, surfaceType, decode, out);
        }
      }
    } else if (geomRaw.type === 'MultiSolid' || geomRaw.type === 'CompositeSolid') {
      const solids = geomRaw.boundaries as number[][][][][];
      const semSolids = (semValuesRaw as number[][][]) ?? [];
      for (let solidIdx = 0; solidIdx < solids.length; solidIdx++) {
        const solid = solids[solidIdx];
        const semSolid = semSolids[solidIdx] ?? [];
        for (let s = 0; s < solid.length; s++) {
          const shell = solid[s];
          const semFaces = semSolid[s] ?? [];
          for (let f = 0; f < shell.length; f++) {
            const face = shell[f];
            const surfaceType = surfaces[semFaces[f]]?.type ?? null;
            triangulateFace(face, surfaceType, decode, out);
          }
        }
      }
    } else {
      // Treat as MultiSurface or CompositeSurface
      const faces = geomRaw.boundaries as number[][][];
      const semFaces = (semValuesRaw as number[]) ?? [];
      for (let f = 0; f < faces.length; f++) {
        const face = faces[f];
        const surfaceType = surfaces[semFaces[f]]?.type ?? null;
        triangulateFace(face, surfaceType, decode, out);
      }
    }
  }
}

function triangulateFace(
  face: number[][],
  surfaceType: string | null,
  decode: (idx: number) => [number, number, number],
  out: { positions: number[]; colors: number[]; normals: number[] }
): void {
  if (face.length === 0 || face[0].length < 3) return;

  // Decode every ring vertex to 3D.
  const rings3D: [number, number, number][][] = face.map((ring) =>
    ring.map((idx) => decode(idx))
  );
  const outer = rings3D[0];
  if (outer.length < 3) return;

  // Compute face normal from first 3 outer vertices (Newell's method would be
  // more robust for non-planar polygons, but our generator output IS planar).
  const a = outer[0];
  const b = outer[1];
  const c = outer[2];
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const nLen = Math.hypot(nx, ny, nz) || 1;
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  // Project to 2D by dropping the dominant normal axis.
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  let dropAxis: 0 | 1 | 2;
  if (ax >= ay && ax >= az) dropAxis = 0;
  else if (ay >= az) dropAxis = 1;
  else dropAxis = 2;

  const project = (p: [number, number, number]): [number, number] => {
    if (dropAxis === 0) return [p[1], p[2]];
    if (dropAxis === 1) return [p[0], p[2]];
    return [p[0], p[1]];
  };

  // earcut wants a flat array + holes index list (each entry is the start
  // vertex index of a hole ring inside the flat array).
  const flat: number[] = [];
  const holeStarts: number[] = [];
  for (let r = 0; r < rings3D.length; r++) {
    if (r > 0) holeStarts.push(flat.length / 2);
    for (const p of rings3D[r]) {
      const [u, v] = project(p);
      flat.push(u, v);
    }
  }

  const indices = earcut(flat, holeStarts.length > 0 ? holeStarts : undefined, 2);

  // Map each earcut index back to its 3D position. earcut indices are into
  // the flat 2D array: flatIdx = vertIdx, where vertIdx counts ALL ring
  // vertices in order (outer + holes).
  const allVerts: [number, number, number][] = [];
  for (const ring of rings3D) for (const p of ring) allVerts.push(p);

  const colour = colorForSurface(surfaceType);

  for (let i = 0; i < indices.length; i += 3) {
    const t0 = allVerts[indices[i]];
    const t1 = allVerts[indices[i + 1]];
    const t2 = allVerts[indices[i + 2]];
    out.positions.push(t0[0], t0[1], t0[2]);
    out.positions.push(t1[0], t1[1], t1[2]);
    out.positions.push(t2[0], t2[1], t2[2]);
    // Flat shading: same normal for all 3 vertices.
    out.normals.push(nx, ny, nz);
    out.normals.push(nx, ny, nz);
    out.normals.push(nx, ny, nz);
    // Same colour for all 3 vertices.
    out.colors.push(colour[0], colour[1], colour[2], colour[3]);
    out.colors.push(colour[0], colour[1], colour[2], colour[3]);
    out.colors.push(colour[0], colour[1], colour[2], colour[3]);
  }
}

/**
 * RGBA (0-255) per CityJSON 2.0 semantic surface type. Mirrors the warm
 * architectural palette used by the in-app viewer.
 */
function colorForSurface(type: string | null): [number, number, number, number] {
  switch (type) {
    case 'GroundSurface':
      return [110, 99, 88, 255];
    case 'WallSurface':
      return [217, 207, 191, 255];
    case 'RoofSurface':
      return [142, 58, 44, 255];
    case 'OuterCeilingSurface':
      return [196, 178, 152, 255];
    case 'Window':
      return [61, 111, 143, 255];
    case 'Door':
      return [74, 47, 31, 255];
    case 'TrafficArea':
      return [90, 90, 90, 255];
    case 'AuxiliaryTrafficArea':
      return [74, 122, 58, 255];
    default:
      return [180, 180, 185, 255];
  }
}
