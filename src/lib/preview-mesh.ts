import proj4 from 'proj4';
import type { RoofType } from './generator';

export interface PreviewMeshParams {
  /** Footprint ring in WGS84 [lng, lat], optionally closed. */
  footprintWgs84: [number, number][];
  /** Target CRS for intermediate metric work (must be supported by proj4). */
  targetCrs: string;
  /** Wall top height, in metres. */
  eaveHeight: number;
  /** Roof peak height, in metres (== eaveHeight for flat). */
  ridgeHeight: number;
  /** Roof shape. Same family as `generator.ts` — flat, pyramid, gable, hip. */
  roofType: RoofType;
  /** Number of storeys above ground. Used to space window rows when openings
   *  are requested. Defaults to 1 if omitted. */
  storeys?: number;
  /** Optional procedural openings preview. When present, the mesh emits
   *  small overlay quads (offset 5 cm out from each wall, hard-coloured blue
   *  for windows / brown for doors) so the user can see where openings will
   *  land before clicking Create. The actual generator output uses semantic
   *  hole-cut surfaces; the preview is z-fight-safe and earcut-free. */
  openings?: {
    windows: boolean;
    door: boolean;
  };
  /** Flat roof eave overhang in metres. Pitched preview overhangs are disabled. */
  eaveOverhang?: number;
}

export interface PreviewMesh {
  /** Float32 positions (x, y, z triples) in metres, centred at the anchor lng/lat. */
  positions: Float32Array;
  /** Uint32 triangle indices into positions. */
  indices: Uint32Array;
  /** Anchor point in WGS84 [lng, lat], matching the CRS centroid of the footprint. */
  anchorLngLat: [number, number];
  /** RGB 0-255 per vertex, matched to positions. GroundSurface=brown, RoofSurface=amber, WallSurface=grey, Window=blue, Door=brown. */
  colors: Uint8Array;
}

function offsetPreviewRing(
  ring: [number, number][],
  distance: number
): [number, number][] | null {
  const result: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const curr = ring[i];
    const next = ring[(i + 1) % ring.length];
    const prevDir: [number, number] = [curr[0] - prev[0], curr[1] - prev[1]];
    const nextDir: [number, number] = [next[0] - curr[0], next[1] - curr[1]];
    const prevLen = Math.hypot(prevDir[0], prevDir[1]);
    const nextLen = Math.hypot(nextDir[0], nextDir[1]);
    if (prevLen < 1e-9 || nextLen < 1e-9) return null;
    const prevNormal: [number, number] = [prevDir[1] / prevLen, -prevDir[0] / prevLen];
    const nextNormal: [number, number] = [nextDir[1] / nextLen, -nextDir[0] / nextLen];
    const p1: [number, number] = [
      prev[0] + prevNormal[0] * distance,
      prev[1] + prevNormal[1] * distance,
    ];
    const p2: [number, number] = [
      curr[0] + nextNormal[0] * distance,
      curr[1] + nextNormal[1] * distance,
    ];
    const intersection = intersectPreviewLines(p1, prevDir, p2, nextDir);
    if (!intersection) return null;
    result.push(intersection);
  }
  return result;
}

function intersectPreviewLines(
  p: [number, number],
  r: [number, number],
  q: [number, number],
  s: [number, number]
): [number, number] | null {
  const denom = crossPreview(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const qp: [number, number] = [q[0] - p[0], q[1] - p[1]];
  const t = crossPreview(qp, s) / denom;
  const out: [number, number] = [p[0] + t * r[0], p[1] + t * r[1]];
  return Number.isFinite(out[0]) && Number.isFinite(out[1]) ? out : null;
}

function hasPreviewSelfIntersection(ring: [number, number][]): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % ring.length];
    for (let j = i + 1; j < ring.length; j++) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === ring.length - 1) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % ring.length];
      if (previewSegmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function previewSegmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number]
): boolean {
  const ab: [number, number] = [b[0] - a[0], b[1] - a[1]];
  const ac: [number, number] = [c[0] - a[0], c[1] - a[1]];
  const ad: [number, number] = [d[0] - a[0], d[1] - a[1]];
  const cd: [number, number] = [d[0] - c[0], d[1] - c[1]];
  const ca: [number, number] = [a[0] - c[0], a[1] - c[1]];
  const cb: [number, number] = [b[0] - c[0], b[1] - c[1]];
  return (
    crossPreview(ab, ac) * crossPreview(ab, ad) < -1e-9 &&
    crossPreview(cd, ca) * crossPreview(cd, cb) < -1e-9
  );
}

function crossPreview(a: [number, number], b: [number, number]): number {
  return a[0] * b[1] - a[1] * b[0];
}

// Window / door geometry constants — must match openings.ts exactly so the
// preview matches what the generator produces on Create.
const WINDOW_W = 1.4;
const WINDOW_H = 1.5;
const WINDOW_SILL = 0.9;
const WINDOW_MIN_MARGIN = 0.4;
const WINDOW_TARGET_SPACING = 3.0;
const DOOR_W = 1.0;
const DOOR_H = 2.1;

/**
 * Build a triangle mesh that matches one of the four roof types in generator.ts,
 * suitable for a deck.gl SimpleMeshLayer living at anchorLngLat.
 *
 * This is a preview-only builder. It bypasses the CityJSON integer encoding
 * and works directly in metre space, which keeps the arithmetic crisp and the
 * resulting geometry decoupled from the host document's transform.
 *
 * Returns null if the CRS isn't projectable or if the roof requires a
 * rectangular footprint and the input isn't one.
 */
export function buildPreviewMesh(params: PreviewMeshParams): PreviewMesh | null {
  if (params.footprintWgs84.length < 3) return null;

  // Open the ring
  const open = params.footprintWgs84.slice();
  const f = open[0];
  const l = open[open.length - 1];
  if (f[0] === l[0] && f[1] === l[1]) open.pop();
  if (open.length < 3) return null;

  // Project WGS84 → target CRS (metres)
  let projected: [number, number][];
  try {
    projected = open.map(
      ([lng, lat]) => proj4('EPSG:4326', params.targetCrs, [lng, lat]) as [number, number]
    );
  } catch {
    return null;
  }

  // Centre the footprint on (0, 0) in metric space; remember the centroid so
  // deck.gl can place the mesh at the right lng/lat.
  let cx = 0;
  let cy = 0;
  for (const [x, y] of projected) {
    cx += x;
    cy += y;
  }
  cx /= projected.length;
  cy /= projected.length;
  const local = projected.map(([x, y]) => [x - cx, y - cy] as [number, number]);

  const anchorLngLat = proj4(params.targetCrs, 'EPSG:4326', [cx, cy]) as [number, number];

  const roofZ = params.ridgeHeight;
  const eaveZ = params.eaveHeight;
  const eaveOverhang = params.roofType === 'flat' ? Math.max(0, params.eaveOverhang ?? 0) : 0;
  const wallTopZ = eaveOverhang > 0 ? eaveZ - 0.25 : eaveZ;

  // Per-surface colours (RGB, 0-255). Matching what extractFootprints / the
  // loader use, so the preview visually corresponds to the final building.
  const GROUND: [number, number, number] = [139, 69, 19];
  const ROOF: [number, number, number] = [184, 134, 11];
  const WALL: [number, number, number] = [200, 200, 210];
  // Distinct hi-vis colours for the openings preview. The actual viewer uses
  // a softer teal-blue / walnut palette; the preview goes a bit louder so the
  // openings remain unambiguously visible at the dialog's small map zoom.
  const WINDOW_COL: [number, number, number] = [56, 132, 200];
  const DOOR_COL: [number, number, number] = [82, 50, 30];

  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  // Mesh-building helpers (written inside so we can close over the arrays).
  const pushVert = (x: number, y: number, z: number, c: [number, number, number]) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    colors.push(c[0], c[1], c[2]);
    return idx;
  };
  const pushTri = (a: number, b: number, c: number) => {
    indices.push(a, b, c);
  };
  /**
   * Fan-triangulate a convex polygon by emitting unique vertex copies per
   * triangle (so per-face colouring works without cross-face bleeding).
   */
  const faceFan = (ring: [number, number, number][], colour: [number, number, number]) => {
    if (ring.length < 3) return;
    for (let i = 1; i < ring.length - 1; i++) {
      const a = pushVert(ring[0][0], ring[0][1], ring[0][2], colour);
      const b = pushVert(ring[i][0], ring[i][1], ring[i][2], colour);
      const c = pushVert(ring[i + 1][0], ring[i + 1][1], ring[i + 1][2], colour);
      pushTri(a, b, c);
    }
  };

  const n = local.length;

  // Ground ring (z = 0). Normal points down, so flip winding relative to the
  // input's CCW order.
  const ground: [number, number, number][] = [];
  for (let i = n - 1; i >= 0; i--) ground.push([local[i][0], local[i][1], 0]);
  faceFan(ground, GROUND);

  // Walls (eaveZ) — always rectangular quads from ground to eave.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faceFan(
      [
        [local[i][0], local[i][1], 0],
        [local[j][0], local[j][1], 0],
        [local[j][0], local[j][1], wallTopZ],
        [local[i][0], local[i][1], wallTopZ],
      ],
      WALL
    );
  }

  // Roof, by type
  if (params.roofType === 'flat') {
    const outer = eaveOverhang > 0 ? offsetPreviewRing(local, eaveOverhang) : local;
    if (!outer || hasPreviewSelfIntersection(outer)) return null;
    const roof: [number, number, number][] = outer.map(([x, y]) => [x, y, roofZ]);
    faceFan(roof, ROOF);
    if (eaveOverhang > 0) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        faceFan(
          [
            [outer[i][0], outer[i][1], wallTopZ],
            [outer[j][0], outer[j][1], wallTopZ],
            [outer[j][0], outer[j][1], roofZ],
            [outer[i][0], outer[i][1], roofZ],
          ],
          WALL
        );
        faceFan(
          [
            [local[i][0], local[i][1], wallTopZ],
            [local[j][0], local[j][1], wallTopZ],
            [outer[j][0], outer[j][1], wallTopZ],
            [outer[i][0], outer[i][1], wallTopZ],
          ],
          ROOF
        );
      }
    }
  } else if (params.roofType === 'pyramid') {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faceFan(
        [
          [local[i][0], local[i][1], eaveZ],
          [local[j][0], local[j][1], eaveZ],
          [0, 0, roofZ],
        ],
        ROOF
      );
    }
  } else if (params.roofType === 'gable' || params.roofType === 'hip') {
    if (n !== 4) return null;
    const [v0, v1, v2, v3] = local;
    const lenSq = (a: [number, number], b: [number, number]) =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const e0 = lenSq(v0, v1);
    const e1 = lenSq(v1, v2);
    const e2 = lenSq(v2, v3);
    const e3 = lenSq(v3, v0);
    const ridgeOnE0 = e0 + e2 > e1 + e3;

    const mid = (a: [number, number], b: [number, number]): [number, number] => [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
    ];

    if (params.roofType === 'gable') {
      const [rA, rB] = ridgeOnE0 ? [mid(v1, v2), mid(v3, v0)] : [mid(v0, v1), mid(v2, v3)];
      // Replace the two gable walls with taller pentagons up to the ridge
      // midpoint, then draw two sloped roof rectangles.
      // Rewrite the eave walls we already pushed is painful; simpler: emit the
      // roof + pentagonal gable caps as additional faces so the silhouette looks right.
      // (For preview fidelity this is enough — the walls-up-to-eave we already have
      //  render as the flat rectangles, and the roof overlays them.)
      if (ridgeOnE0) {
        faceFan(
          [
            [v0[0], v0[1], eaveZ],
            [v1[0], v1[1], eaveZ],
            [rA[0], rA[1], roofZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v2[0], v2[1], eaveZ],
            [v3[0], v3[1], eaveZ],
            [rB[0], rB[1], roofZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
        // Gable triangles (visible pentagon tops) on the short sides.
        faceFan(
          [
            [v1[0], v1[1], eaveZ],
            [v2[0], v2[1], eaveZ],
            [rA[0], rA[1], roofZ],
          ],
          WALL
        );
        faceFan(
          [
            [v3[0], v3[1], eaveZ],
            [v0[0], v0[1], eaveZ],
            [rB[0], rB[1], roofZ],
          ],
          WALL
        );
      } else {
        faceFan(
          [
            [v1[0], v1[1], eaveZ],
            [v2[0], v2[1], eaveZ],
            [rB[0], rB[1], roofZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v3[0], v3[1], eaveZ],
            [v0[0], v0[1], eaveZ],
            [rA[0], rA[1], roofZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v0[0], v0[1], eaveZ],
            [v1[0], v1[1], eaveZ],
            [rA[0], rA[1], roofZ],
          ],
          WALL
        );
        faceFan(
          [
            [v2[0], v2[1], eaveZ],
            [v3[0], v3[1], eaveZ],
            [rB[0], rB[1], roofZ],
          ],
          WALL
        );
      }
    } else {
      // hip
      const longLen = Math.sqrt(ridgeOnE0 ? Math.min(e0, e2) : Math.min(e1, e3));
      const shortLen = Math.sqrt(ridgeOnE0 ? Math.min(e1, e3) : Math.min(e0, e2));
      const ridgeLen = Math.max(0, longLen - shortLen);
      const [pa, pb] = ridgeOnE0 ? [v0, v1] : [v1, v2];
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const norm = Math.sqrt(dx * dx + dy * dy) || 1;
      const rdx = dx / norm;
      const rdy = dy / norm;
      const rA: [number, number] = [-rdx * (ridgeLen / 2), -rdy * (ridgeLen / 2)];
      const rB: [number, number] = [rdx * (ridgeLen / 2), rdy * (ridgeLen / 2)];

      if (ridgeOnE0) {
        faceFan(
          [
            [v0[0], v0[1], eaveZ],
            [v1[0], v1[1], eaveZ],
            [rB[0], rB[1], roofZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v2[0], v2[1], eaveZ],
            [v3[0], v3[1], eaveZ],
            [rA[0], rA[1], roofZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v1[0], v1[1], eaveZ],
            [v2[0], v2[1], eaveZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v3[0], v3[1], eaveZ],
            [v0[0], v0[1], eaveZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
      } else {
        faceFan(
          [
            [v1[0], v1[1], eaveZ],
            [v2[0], v2[1], eaveZ],
            [rB[0], rB[1], roofZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v3[0], v3[1], eaveZ],
            [v0[0], v0[1], eaveZ],
            [rA[0], rA[1], roofZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v0[0], v0[1], eaveZ],
            [v1[0], v1[1], eaveZ],
            [rA[0], rA[1], roofZ],
          ],
          ROOF
        );
        faceFan(
          [
            [v2[0], v2[1], eaveZ],
            [v3[0], v3[1], eaveZ],
            [rB[0], rB[1], roofZ],
          ],
          ROOF
        );
      }
    }
  }

  // Procedural openings overlay (windows + door). Emitted as small co-planar
  // quads offset 5 cm outward from the parent wall to avoid Z-fighting. We
  // do NOT cut holes here — the preview is for shape feedback, the generator
  // produces the real LoD 2.2 semantic surfaces on Create.
  if (params.openings && (params.openings.windows || params.openings.door)) {
    const storeys = Math.max(1, params.storeys ?? 1);
    const storeyHeight = wallTopZ / storeys;

    // Identify gable-end walls (pentagonal in the actual generator) so we
    // don't decorate them with windows. Same logic as buildGable.
    const gableEndWalls = new Set<number>();
    if (params.roofType === 'gable' && n === 4) {
      const [v0, v1, v2, v3] = local;
      const lenSq = (a: [number, number], b: [number, number]) =>
        (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
      const e0 = lenSq(v0, v1);
      const e1 = lenSq(v1, v2);
      const e2 = lenSq(v2, v3);
      const e3 = lenSq(v3, v0);
      const ridgeOnE0 = e0 + e2 > e1 + e3;
      // Gable-end walls are perpendicular to the ridge: e1, e3 when ridgeOnE0,
      // else e0, e2.
      if (ridgeOnE0) {
        gableEndWalls.add(1);
        gableEndWalls.add(3);
      } else {
        gableEndWalls.add(0);
        gableEndWalls.add(2);
      }
    }

    let doorPlaced = false;
    for (let i = 0; i < n; i++) {
      if (gableEndWalls.has(i)) continue;
      const j = (i + 1) % n;
      const a: [number, number] = [local[i][0], local[i][1]];
      const b: [number, number] = [local[j][0], local[j][1]];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const wallLen = Math.hypot(dx, dy);
      if (wallLen < WINDOW_W + 2 * WINDOW_MIN_MARGIN) continue;
      const ux = dx / wallLen;
      const uy = dy / wallLen;
      // Outward normal of edge i→j on a CCW polygon = rotate (ux, uy) by -90°
      // → (uy, -ux). 5 cm offset to keep the quad in front of the wall mesh.
      const ox = uy * 0.05;
      const oy = -ux * 0.05;

      const skipGroundStorey = params.openings.door && !doorPlaced && i === 0;

      if (params.openings.windows) {
        const usableLen = wallLen - 2 * WINDOW_MIN_MARGIN;
        const maxByFit = Math.floor(
          (usableLen + (WINDOW_TARGET_SPACING - WINDOW_W)) / WINDOW_TARGET_SPACING
        );
        const targetCount = Math.max(
          1,
          Math.min(maxByFit, Math.round(wallLen / WINDOW_TARGET_SPACING))
        );
        for (let storey = 0; storey < storeys; storey++) {
          if (storey === 0 && skipGroundStorey) continue;
          const floorZ = storey * storeyHeight;
          const sillZ = floorZ + WINDOW_SILL;
          const topZ = sillZ + WINDOW_H;
          if (topZ > wallTopZ - 0.3) continue;
          for (let w = 0; w < targetCount; w++) {
            const centreU = ((w + 0.5) / targetCount) * wallLen;
            const leftU = centreU - WINDOW_W / 2;
            const rightU = centreU + WINDOW_W / 2;
            const blX = a[0] + ux * leftU + ox;
            const blY = a[1] + uy * leftU + oy;
            const brX = a[0] + ux * rightU + ox;
            const brY = a[1] + uy * rightU + oy;
            faceFan(
              [
                [blX, blY, sillZ],
                [brX, brY, sillZ],
                [brX, brY, topZ],
                [blX, blY, topZ],
              ],
              WINDOW_COL
            );
          }
        }
      }

      if (params.openings.door && !doorPlaced && wallLen >= DOOR_W + 0.6) {
        const doorTopZ = Math.min(DOOR_H, wallTopZ - 0.3);
        if (doorTopZ >= 1.8) {
          const centreU = wallLen / 2;
          const leftU = centreU - DOOR_W / 2;
          const rightU = centreU + DOOR_W / 2;
          const blX = a[0] + ux * leftU + ox;
          const blY = a[1] + uy * leftU + oy;
          const brX = a[0] + ux * rightU + ox;
          const brY = a[1] + uy * rightU + oy;
          // Lift the door 1 mm off the ground so it doesn't z-fight the
          // ground polygon when the camera is at zero zenith.
          faceFan(
            [
              [blX, blY, 0.001],
              [brX, brY, 0.001],
              [brX, brY, doorTopZ],
              [blX, blY, doorTopZ],
            ],
            DOOR_COL
          );
          doorPlaced = true;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    colors: new Uint8Array(colors),
    anchorLngLat,
  };
}
