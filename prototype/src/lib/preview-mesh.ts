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
}

export interface PreviewMesh {
  /** Float32 positions (x, y, z triples) in metres, centred at the anchor lng/lat. */
  positions: Float32Array;
  /** Uint32 triangle indices into positions. */
  indices: Uint32Array;
  /** Anchor point in WGS84 [lng, lat], matching the CRS centroid of the footprint. */
  anchorLngLat: [number, number];
  /** RGB 0-255 per vertex, matched to positions. GroundSurface=brown, RoofSurface=amber, WallSurface=grey. */
  colors: Uint8Array;
}

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

  // Per-surface colours (RGB, 0-255). Matching what extractFootprints / the
  // loader use, so the preview visually corresponds to the final building.
  const GROUND: [number, number, number] = [139, 69, 19];
  const ROOF: [number, number, number] = [184, 134, 11];
  const WALL: [number, number, number] = [200, 200, 210];

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
        [local[j][0], local[j][1], eaveZ],
        [local[i][0], local[i][1], eaveZ],
      ],
      WALL
    );
  }

  // Roof, by type
  if (params.roofType === 'flat') {
    const roof: [number, number, number][] = local.map(([x, y]) => [x, y, roofZ]);
    faceFan(roof, ROOF);
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

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    colors: new Uint8Array(colors),
    anchorLngLat,
  };
}
