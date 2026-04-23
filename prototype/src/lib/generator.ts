import proj4 from 'proj4';
import type { CityJsonDocument, CityObject } from '../types';

export type RoofType = 'flat' | 'pyramid' | 'gable' | 'hip';

export interface NewBuildingParams {
  /** Target CRS for the new building (must match existing doc's CRS). */
  targetCrs: string;
  /** Footprint polygon in WGS84 [lng, lat] pairs, outer ring, optionally closed. */
  footprintWgs84: [number, number][];
  /** Number of storeys above ground (stored on attributes, not used for geometry). */
  storeys: number;
  /** Height of the top of the walls (where the roof starts), in metres. */
  eaveHeight: number;
  /** Height of the roof's highest point above the ground. For `flat`, must equal eaveHeight. */
  ridgeHeight: number;
  /** Roof geometry strategy. */
  roofType: RoofType;
  /** Ground elevation in projected CRS z units (usually metres). Default 0. */
  baseElevation?: number;
  /** Optional attributes to attach to the generated CityObject. */
  attributes?: Record<string, string | number | boolean | null>;
}

export interface GenerateResult {
  /** New building's assigned id. */
  id: string;
  /** The CityObject to insert into CityJSON.CityObjects. */
  cityObject: CityObject;
  /** Flat list of new vertices (in UNSCALED integer form matching the doc's transform). */
  newVertices: [number, number, number][];
  /** The vertex index offset these new vertices start at. */
  vertexOffset: number;
}

/**
 * Generate an LoD2 Building from a user-drawn footprint + parameters.
 *
 * Roof strategies:
 *   - flat:    Ground + flat roof at eaveHeight + rectangular walls.
 *   - pyramid: Ground + eave perimeter + single apex over centroid at ridgeHeight.
 *              Produces one triangular roof face per footprint edge. Works for
 *              any convex footprint (not just rectangles).
 *   - gable:   Requires a 4-vertex rectangular footprint. Ridge runs along the
 *              longer axis; two sloped roof rectangles + two pentagonal gable-
 *              end walls. Non-rectangular gable roofs need straight-skeleton
 *              WASM (not yet integrated).
 *
 * Every output has semantic surfaces (GroundSurface / WallSurface / RoofSurface)
 * and vertices compacted into the host document's transform integer space so
 * JSON.stringify → JSON.parse round-trips cleanly.
 */
export function generateBuilding(
  doc: CityJsonDocument,
  params: NewBuildingParams
): GenerateResult {
  const baseZ = params.baseElevation ?? 0;
  const eaveZAbs = baseZ + params.eaveHeight;
  const ridgeZAbs = baseZ + params.ridgeHeight;

  // Input validation
  if (params.footprintWgs84.length < 3) {
    throw new Error('Footprint must have at least 3 vertices');
  }
  if (params.eaveHeight <= 0) throw new Error('Eave height must be > 0');
  if (params.ridgeHeight < params.eaveHeight) {
    throw new Error('Ridge height must be >= eave height');
  }
  if (params.roofType === 'flat' && params.ridgeHeight !== params.eaveHeight) {
    throw new Error('Flat roof requires ridgeHeight === eaveHeight');
  }
  if (params.roofType !== 'flat' && params.ridgeHeight <= params.eaveHeight) {
    throw new Error(`${params.roofType} roof requires ridgeHeight > eaveHeight`);
  }

  // Drop closing vertex if present
  const open = params.footprintWgs84.slice();
  const [first, last] = [open[0], open[open.length - 1]];
  if (first[0] === last[0] && first[1] === last[1]) open.pop();

  // Project WGS84 ring → target CRS (metres)
  const projected = open.map(([lng, lat]) => {
    const [x, y] = proj4('EPSG:4326', params.targetCrs, [lng, lat]) as [number, number];
    return [x, y] as [number, number];
  });

  // Integer encoding that matches the doc's transform
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const toInt = (x: number, y: number, z: number): [number, number, number] => [
    Math.round((x - t.translate[0]) / t.scale[0]),
    Math.round((y - t.translate[1]) / t.scale[1]),
    Math.round((z - t.translate[2]) / t.scale[2]),
  ];

  // Dispatch to the roof-specific builder. Each fills in newVertices and builds
  // the solid boundaries with correctly-ordered rings.
  let newVertices: [number, number, number][];
  let shell: number[][][]; // [face][ring][vertexIdxIntoFinalDocVertices]
  let semanticsValues: number[];

  const vertexOffset = doc.vertices.length;
  const toGlobal = (local: number) => vertexOffset + local;

  if (params.roofType === 'flat') {
    ({ newVertices, shell, semanticsValues } = buildFlat(
      projected,
      baseZ,
      eaveZAbs,
      toInt,
      toGlobal
    ));
  } else if (params.roofType === 'pyramid') {
    ({ newVertices, shell, semanticsValues } = buildPyramid(
      projected,
      baseZ,
      eaveZAbs,
      ridgeZAbs,
      toInt,
      toGlobal
    ));
  } else if (params.roofType === 'gable') {
    if (projected.length !== 4) {
      throw new Error(
        'Gable roof currently requires a 4-vertex (rectangular) footprint. ' +
          'Use pyramid for N-sided polygons, or flat.'
      );
    }
    ({ newVertices, shell, semanticsValues } = buildGable(
      projected,
      baseZ,
      eaveZAbs,
      ridgeZAbs,
      toInt,
      toGlobal
    ));
  } else if (params.roofType === 'hip') {
    if (projected.length !== 4) {
      throw new Error(
        'Hip roof currently requires a 4-vertex (rectangular) footprint. ' +
          'Use pyramid for N-sided polygons.'
      );
    }
    ({ newVertices, shell, semanticsValues } = buildHip(
      projected,
      baseZ,
      eaveZAbs,
      ridgeZAbs,
      toInt,
      toGlobal
    ));
  } else {
    throw new Error(`Unknown roof type: ${params.roofType}`);
  }

  // Assemble Solid geometry
  const surfaces = [
    { type: 'GroundSurface' },
    { type: 'RoofSurface' },
    { type: 'WallSurface' },
  ];

  const id = `bld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const cityObject: CityObject = {
    type: 'Building',
    attributes: {
      measuredHeight: params.ridgeHeight,
      storeysAboveGround: params.storeys,
      roofType: params.roofType,
      function: 'residential',
      _createdBy: 'city-editor-prototype',
      _createdAt: new Date().toISOString(),
      ...(params.attributes ?? {}),
    },
    geometry: [
      {
        type: 'Solid',
        lod: '2.0',
        boundaries: [shell],
        semantics: {
          surfaces,
          values: [semanticsValues],
        },
      } as unknown,
    ] as unknown[],
  };

  return { id, cityObject, newVertices, vertexOffset };
}

// ---------- roof builders ----------

interface BuildOut {
  newVertices: [number, number, number][];
  /** One "face" per entry; each face is [outerRing, hole1, hole2, …]. */
  shell: number[][][];
  /** Semantic surface index for each face. 0=ground, 1=roof, 2=wall. */
  semanticsValues: number[];
}

function buildFlat(
  projected: [number, number][],
  baseZ: number,
  roofZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): BuildOut {
  const n = projected.length;
  const newVertices: [number, number, number][] = [];
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], roofZ));

  const groundStart = 0;
  const roofStart = n;

  const groundRing: number[] = [];
  for (let i = 0; i < n; i++) groundRing.push(toGlobal(groundStart + i));
  groundRing.reverse();

  const roofRing: number[] = [];
  for (let i = 0; i < n; i++) roofRing.push(toGlobal(roofStart + i));

  const wallRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    wallRings.push([
      toGlobal(groundStart + i),
      toGlobal(groundStart + j),
      toGlobal(roofStart + j),
      toGlobal(roofStart + i),
    ]);
  }

  const shell: number[][][] = [[groundRing], [roofRing], ...wallRings.map((w) => [w])];
  const semanticsValues: number[] = [0, 1, ...new Array(n).fill(2)];
  return { newVertices, shell, semanticsValues };
}

function buildPyramid(
  projected: [number, number][],
  baseZ: number,
  eaveZ: number,
  ridgeZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): BuildOut {
  const n = projected.length;
  const newVertices: [number, number, number][] = [];

  // Ground (z=baseZ)
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  // Eave (z=eaveZ)
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], eaveZ));
  // Apex at centroid, z=ridgeZ
  let cx = 0,
    cy = 0;
  for (const [x, y] of projected) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;
  newVertices.push(toInt(cx, cy, ridgeZ));

  const groundStart = 0;
  const eaveStart = n;
  const apexLocal = 2 * n;

  const groundRing: number[] = [];
  for (let i = 0; i < n; i++) groundRing.push(toGlobal(groundStart + i));
  groundRing.reverse();

  // Walls — rectangular ground→eave
  const wallRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    wallRings.push([
      toGlobal(groundStart + i),
      toGlobal(groundStart + j),
      toGlobal(eaveStart + j),
      toGlobal(eaveStart + i),
    ]);
  }

  // Roof — n triangles sharing the apex
  const roofRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    roofRings.push([toGlobal(eaveStart + i), toGlobal(eaveStart + j), toGlobal(apexLocal)]);
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
  ];
  const semanticsValues: number[] = [0, ...new Array(n).fill(1), ...new Array(n).fill(2)];
  return { newVertices, shell, semanticsValues };
}

function buildGable(
  projected: [number, number][],
  baseZ: number,
  eaveZ: number,
  ridgeZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): BuildOut {
  // 4 corners in order: v0, v1, v2, v3 (forming a quad).
  // Edges: e0=(v0-v1), e1=(v1-v2), e2=(v2-v3), e3=(v3-v0).
  const [v0, v1, v2, v3] = projected;
  const lenSq = (a: [number, number], b: [number, number]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const e0 = lenSq(v0, v1);
  const e1 = lenSq(v1, v2);
  const e2 = lenSq(v2, v3);
  const e3 = lenSq(v3, v0);

  // Ridge runs along the direction of the longer-edge pair.
  // "ridgeOnE0" means ridge midpoints sit on e1 and e3 (the short edges).
  const ridgeOnE0 = e0 + e2 > e1 + e3;

  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  // Local indices:
  //   0-3: ground verts v0-v3
  //   4-7: eave verts over v0-v3
  //   8, 9: ridge endpoints (midpoints of the two short edges, at ridgeZ)
  const newVertices: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) {
    newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  }
  for (let i = 0; i < 4; i++) {
    newVertices.push(toInt(projected[i][0], projected[i][1], eaveZ));
  }
  let ridgeA: [number, number], ridgeB: [number, number];
  if (ridgeOnE0) {
    // Short edges are e1 and e3: ridge endpoints over midpoints of e1 (v1-v2) and e3 (v3-v0)
    ridgeA = mid(v1, v2);
    ridgeB = mid(v3, v0);
  } else {
    // Short edges are e0 and e2: ridge endpoints over midpoints of e0 (v0-v1) and e2 (v2-v3)
    ridgeA = mid(v0, v1);
    ridgeB = mid(v2, v3);
  }
  newVertices.push(toInt(ridgeA[0], ridgeA[1], ridgeZ));
  newVertices.push(toInt(ridgeB[0], ridgeB[1], ridgeZ));

  const G = (local: number) => toGlobal(local);
  const g0 = G(0),
    g1 = G(1),
    g2 = G(2),
    g3 = G(3);
  const e0v = G(4),
    e1v = G(5),
    e2v = G(6),
    e3v = G(7);
  const rA = G(8),
    rB = G(9);

  // Ground face, CW (reversed from footprint CCW)
  const groundRing = [g3, g2, g1, g0];

  // Walls + roof depend on ridge orientation
  let wallRings: number[][];
  let roofRings: number[][];

  if (ridgeOnE0) {
    // Long walls under e0 and e2 (rectangular)
    // Gable walls under e1 and e3 (pentagon with apex ridge midpoint)
    wallRings = [
      // long wall e0: v0-v1-v1'-v0'
      [g0, g1, e1v, e0v],
      // gable wall e1: v1-v2-v2'-rA-v1'
      [g1, g2, e2v, rA, e1v],
      // long wall e2: v2-v3-v3'-v2'
      [g2, g3, e3v, e2v],
      // gable wall e3: v3-v0-v0'-rB-v3'
      [g3, g0, e0v, rB, e3v],
    ];
    // Two sloped roof rectangles. e0 side: goes from e0v, e1v, rA, rB
    roofRings = [
      [e0v, e1v, rA, rB],
      [e2v, e3v, rB, rA],
    ];
  } else {
    // Long walls under e1 and e3 (rectangular)
    // Gable walls under e0 and e2 (pentagon)
    wallRings = [
      // gable wall e0: v0-v1-v1'-rA-v0'
      [g0, g1, e1v, rA, e0v],
      // long wall e1: v1-v2-v2'-v1'
      [g1, g2, e2v, e1v],
      // gable wall e2: v2-v3-v3'-rB-v2'
      [g2, g3, e3v, rB, e2v],
      // long wall e3: v3-v0-v0'-v3'
      [g3, g0, e0v, e3v],
    ];
    // Two sloped roof rectangles along e1 and e3 sides
    roofRings = [
      [e1v, e2v, rB, rA],
      [e3v, e0v, rA, rB],
    ];
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
  ];
  // Order: 1 ground, 2 roof, 4 walls
  const semanticsValues: number[] = [0, 1, 1, 2, 2, 2, 2];
  return { newVertices, shell, semanticsValues };
}

function buildHip(
  projected: [number, number][],
  baseZ: number,
  eaveZ: number,
  ridgeZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): BuildOut {
  // Same corner layout as gable: v0-v3 with long axis along e0/e2 or e1/e3.
  // Unlike gable, the hip roof has no gable-end walls (all walls rectangular)
  // and the ridge is a line segment *inset* from both short edges by the
  // short-edge half-width — giving the classic "4 sloped faces meet at a
  // ridge, 2 triangular hip ends" geometry. As the short edge grows
  // relative to the long edge, the ridge length shrinks; at the degenerate
  // limit (square), the ridge collapses to a point and the shape becomes a
  // pyramid (see the fallback below).
  const [v0, v1, v2, v3] = projected;
  const lenSq = (a: [number, number], b: [number, number]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const e0 = lenSq(v0, v1);
  const e1 = lenSq(v1, v2);
  const e2 = lenSq(v2, v3);
  const e3 = lenSq(v3, v0);

  // Long axis direction & lengths
  const ridgeOnE0 = e0 + e2 > e1 + e3;
  const longLen = Math.sqrt(ridgeOnE0 ? Math.min(e0, e2) : Math.min(e1, e3));
  const shortLen = Math.sqrt(ridgeOnE0 ? Math.min(e1, e3) : Math.min(e0, e2));
  const ridgeLen = Math.max(0, longLen - shortLen);

  const cx = (v0[0] + v1[0] + v2[0] + v3[0]) / 4;
  const cy = (v0[1] + v1[1] + v2[1] + v3[1]) / 4;

  // Ridge direction = along the longer axis
  const [pa, pb] = ridgeOnE0 ? [v0, v1] : [v1, v2];
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const norm = Math.sqrt(dx * dx + dy * dy) || 1;
  const rdx = dx / norm;
  const rdy = dy / norm;

  // Ridge endpoints along the centerline, symmetric around centroid.
  // When ridgeLen === 0 (square), both collapse to the centroid — the hip
  // roof becomes a pyramid. We still emit 2 ridge verts (coincident) so the
  // topology stays identical and the loader/renderer doesn't special-case.
  const rA: [number, number] = [cx - rdx * (ridgeLen / 2), cy - rdy * (ridgeLen / 2)];
  const rB: [number, number] = [cx + rdx * (ridgeLen / 2), cy + rdy * (ridgeLen / 2)];

  const newVertices: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  for (let i = 0; i < 4; i++) newVertices.push(toInt(projected[i][0], projected[i][1], eaveZ));
  newVertices.push(toInt(rA[0], rA[1], ridgeZ));
  newVertices.push(toInt(rB[0], rB[1], ridgeZ));

  const G = (local: number) => toGlobal(local);
  const g0 = G(0),
    g1 = G(1),
    g2 = G(2),
    g3 = G(3);
  const e0v = G(4),
    e1v = G(5),
    e2v = G(6),
    e3v = G(7);
  const ra = G(8),
    rb = G(9);

  // Ground (reversed)
  const groundRing = [g3, g2, g1, g0];

  // 4 rectangular walls (no gable-ends; hip has all rectangular walls)
  const wallRings = [
    [g0, g1, e1v, e0v],
    [g1, g2, e2v, e1v],
    [g2, g3, e3v, e2v],
    [g3, g0, e0v, e3v],
  ];

  // 4 roof faces. rA is the ridge endpoint nearer the (v0, v3) short edge;
  // rB is nearer (v1, v2) when ridgeOnE0 is true, and correspondingly when false.
  let roofRings: number[][];
  if (ridgeOnE0) {
    // Ridge runs between midpoints above e3 (v3-v0) and e1 (v1-v2).
    // rA ≈ over mid(v3,v0), rB ≈ over mid(v1,v2).
    roofRings = [
      // long slope on e0 side: eave v0, eave v1, rB, rA
      [e0v, e1v, rb, ra],
      // long slope on e2 side: eave v2, eave v3, rA, rB
      [e2v, e3v, ra, rb],
      // hip triangle on e1 side: eave v1, eave v2, rB
      [e1v, e2v, rb],
      // hip triangle on e3 side: eave v3, eave v0, rA
      [e3v, e0v, ra],
    ];
  } else {
    // Ridge runs between midpoints above e0 (v0-v1) and e2 (v2-v3).
    roofRings = [
      [e1v, e2v, rb, ra],
      [e3v, e0v, ra, rb],
      [e0v, e1v, ra],
      [e2v, e3v, rb],
    ];
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
  ];
  // 1 ground + 4 roof (2 trapezoids + 2 triangles) + 4 walls
  const semanticsValues: number[] = [0, 1, 1, 1, 1, 2, 2, 2, 2];
  return { newVertices, shell, semanticsValues };
}

/**
 * Apply the result of generateBuilding to a CityJSON document, in place.
 * Returns the new building id.
 */
export function insertBuilding(doc: CityJsonDocument, result: GenerateResult): string {
  if (result.vertexOffset !== doc.vertices.length) {
    throw new Error(
      `Vertex offset mismatch: expected ${doc.vertices.length}, got ${result.vertexOffset}`
    );
  }
  doc.vertices.push(...result.newVertices);
  doc.CityObjects[result.id] = result.cityObject;
  return result.id;
}

// ---------- validation helpers exposed to the UI ----------

/** DIN 18065-inspired residential habitable storey guidance. */
export interface StoreyValidation {
  storeyHeight: number;
  warnings: string[];
}

export function validateStoreyHeight(
  totalHeight: number,
  storeys: number,
  roofHeight: number
): StoreyValidation {
  const wallHeight = totalHeight - roofHeight;
  const storeyHeight = wallHeight / Math.max(1, storeys);
  const warnings: string[] = [];
  if (storeys < 1) warnings.push('Must have at least 1 storey');
  if (storeyHeight < 2.4)
    warnings.push(
      `Storey height ${storeyHeight.toFixed(2)} m is below 2.4 m (typical habitable minimum per DIN 18065 / local code).`
    );
  if (storeyHeight > 5)
    warnings.push(
      `Storey height ${storeyHeight.toFixed(2)} m is unusually tall; verify intent (industrial/warehouse OK).`
    );
  if (wallHeight <= 0) warnings.push('Roof height exceeds total height — no walls will fit.');
  return { storeyHeight, warnings };
}
