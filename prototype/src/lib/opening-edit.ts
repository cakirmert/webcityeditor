import type { CityJsonDocument, CityObject } from '../types';

export interface OpeningInfo {
  type: 'Window' | 'Door';
  surfaceIndex: number;
  shellIndex: number;
  faceIndex: number;
  vertexIndices: number[];
  center: [number, number, number];
  width: number;
  height: number;
}

export function extractOpenings(
  doc: CityJsonDocument,
  buildingId: string
): OpeningInfo[] {
  const obj = doc.CityObjects[buildingId];
  if (!obj?.geometry) return [];
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const decode = (idx: number): [number, number, number] => {
    const v = doc.vertices[idx];
    return [
      v[0] * t.scale[0] + t.translate[0],
      v[1] * t.scale[1] + t.translate[1],
      v[2] * t.scale[2] + t.translate[2],
    ];
  };

  const results: OpeningInfo[] = [];

  for (const geomRaw of obj.geometry) {
    const g = geomRaw as {
      type?: string;
      boundaries?: number[][][][];
      semantics?: { surfaces?: Array<{ type?: string }>; values?: number[][] };
    };
    if (!g.boundaries || !g.semantics?.surfaces) continue;

    const openingSurfaceIndices = new Map<number, 'Window' | 'Door'>();
    g.semantics.surfaces.forEach((s, i) => {
      if (s?.type === 'Window') openingSurfaceIndices.set(i, 'Window');
      if (s?.type === 'Door') openingSurfaceIndices.set(i, 'Door');
    });

    if (openingSurfaceIndices.size === 0) continue;

    const shells = g.boundaries;
    for (let s = 0; s < shells.length; s++) {
      const faceSem = g.semantics.values?.[s];
      if (!faceSem) continue;
      const shell = shells[s];
      for (let f = 0; f < shell.length; f++) {
        const semIdx = faceSem[f];
        const openingType = openingSurfaceIndices.get(semIdx);
        if (!openingType) continue;
        const outerRing = shell[f][0];
        if (!outerRing || outerRing.length < 3) continue;
        const decoded = outerRing.map(decode);
        const cx = decoded.reduce((a, v) => a + v[0], 0) / decoded.length;
        const cy = decoded.reduce((a, v) => a + v[1], 0) / decoded.length;
        const cz = decoded.reduce((a, v) => a + v[2], 0) / decoded.length;
        let minZ = Infinity, maxZ = -Infinity;
        for (const [, , z] of decoded) { if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
        let maxDist = 0;
        for (let i = 0; i < decoded.length; i++) {
          for (let j = i + 1; j < decoded.length; j++) {
            const dx = decoded[i][0] - decoded[j][0];
            const dy = decoded[i][1] - decoded[j][1];
            const d = Math.hypot(dx, dy);
            if (d > maxDist) maxDist = d;
          }
        }

        results.push({
          type: openingType,
          surfaceIndex: semIdx,
          shellIndex: s,
          faceIndex: f,
          vertexIndices: [...outerRing],
          center: [cx, cy, cz],
          width: maxDist,
          height: maxZ - minZ,
        });
      }
    }
  }
  return results;
}

export function moveOpening(
  doc: CityJsonDocument,
  buildingId: string,
  opening: OpeningInfo,
  dx: number,
  dy: number,
  dz: number
): boolean {
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const obj = doc.CityObjects[buildingId];
  if (!obj?.geometry) return false;

  const encode = (real: [number, number, number]): [number, number, number] => [
    Math.round((real[0] - t.translate[0]) / t.scale[0]),
    Math.round((real[1] - t.translate[1]) / t.scale[1]),
    Math.round((real[2] - t.translate[2]) / t.scale[2]),
  ];
  const decode = (idx: number): [number, number, number] => {
    const v = doc.vertices[idx];
    return [
      v[0] * t.scale[0] + t.translate[0],
      v[1] * t.scale[1] + t.translate[1],
      v[2] * t.scale[2] + t.translate[2],
    ];
  };

  const movedIndices = new Set<number>();
  for (const idx of opening.vertexIndices) {
    if (movedIndices.has(idx)) continue;
    movedIndices.add(idx);
    const real = decode(idx);
    const newIdx = doc.vertices.length;
    doc.vertices.push(encode([real[0] + dx, real[1] + dy, real[2] + dz]));
    replaceVertexInObject(obj, idx, newIdx);
  }

  // Also move the matching hole ring in the parent wall face
  for (const geomRaw of obj.geometry) {
    const g = geomRaw as { boundaries?: number[][][][] };
    if (!g.boundaries) continue;
    for (const shell of g.boundaries) {
      for (const face of shell) {
        for (let r = 1; r < face.length; r++) {
          const ring = face[r];
          const hasMatch = ring.some((idx) => movedIndices.has(idx));
          if (hasMatch) {
            for (let i = 0; i < ring.length; i++) {
              if (movedIndices.has(ring[i])) {
                const real = decode(ring[i]);
                const newIdx = doc.vertices.length;
                doc.vertices.push(encode([real[0] + dx, real[1] + dy, real[2] + dz]));
                ring[i] = newIdx;
              }
            }
          }
        }
      }
    }
  }

  return true;
}

function replaceVertexInObject(obj: CityObject, oldIdx: number, newIdx: number): void {
  if (!obj.geometry) return;
  for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
    if (g.boundaries) g.boundaries = rewrite(g.boundaries, oldIdx, newIdx);
  }
}

function rewrite(node: unknown, oldIdx: number, newIdx: number): unknown {
  if (!Array.isArray(node)) return node;
  return node.map((item) => {
    if (typeof item === 'number') return item === oldIdx ? newIdx : item;
    return rewrite(item, oldIdx, newIdx);
  });
}
