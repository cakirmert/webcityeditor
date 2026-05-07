import proj4 from 'proj4';
import type { CityJsonDocument, CityObject } from '../types';
import type { BuildOut, RectangularWall } from './generator-internal';
import { applyOpenings } from './openings';

export type RoofType = 'flat' | 'pyramid' | 'gable' | 'hip';

export interface OpeningOptions {
  /** Add procedurally placed windows on every rectangular wall, per storey. */
  windows: boolean;
  /** Add a single ground-floor door on the first rectangular wall. */
  door: boolean;
}

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
  /** Optional procedural openings (windows + door). Bumps the geometry's LoD
   *  label from `2.0` to `2.2` when any opening is requested. */
  openings?: OpeningOptions;
  /** LoD 2.2 eave overhang in metres (default 0 = no overhang). When > 0, flat
   *  roofs extend outward by this distance and the underside is emitted as
   *  `OuterCeilingSurface` (soffit) faces. Only flat roofs support overhang
   *  in this version; pitched roofs ignore the value. */
  eaveOverhang?: number;
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
  const vertexOffset = doc.vertices.length;
  const toGlobal = (local: number) => vertexOffset + local;

  let out: BuildOut;
  const eaveOverhang = Math.max(0, params.eaveOverhang ?? 0);
  if (params.roofType === 'flat') {
    out = buildFlat(projected, baseZ, eaveZAbs, toInt, toGlobal, eaveOverhang);
  } else if (params.roofType === 'pyramid') {
    out = buildPyramid(projected, baseZ, eaveZAbs, ridgeZAbs, toInt, toGlobal, eaveOverhang);
  } else if (params.roofType === 'gable') {
    if (projected.length !== 4) {
      throw new Error(
        'Gable roof currently requires a 4-vertex (rectangular) footprint. ' +
          'Use pyramid for N-sided polygons, or flat.'
      );
    }
    out = buildGable(projected, baseZ, eaveZAbs, ridgeZAbs, toInt, toGlobal);
  } else if (params.roofType === 'hip') {
    if (projected.length !== 4) {
      throw new Error(
        'Hip roof currently requires a 4-vertex (rectangular) footprint. ' +
          'Use pyramid for N-sided polygons.'
      );
    }
    out = buildHip(projected, baseZ, eaveZAbs, ridgeZAbs, toInt, toGlobal, eaveOverhang);
  } else {
    throw new Error(`Unknown roof type: ${params.roofType}`);
  }

  // Assemble Solid geometry
  const surfaces: Array<{ type: string }> = [
    { type: 'GroundSurface' },
    { type: 'RoofSurface' },
    { type: 'WallSurface' },
  ];
  let lodLabel = '2.0';

  // LoD 2.2 eave overhang adds OuterCeilingSurface (soffit) faces. The
  // builder marks them with semantics index 3 when it emits them; the surface
  // entry must match that index, so push it BEFORE the openings pass which
  // assigns its own indices on top. Flat / pyramid / hip honour overhang;
  // gable still ignores it (rake-vs-eave overhang complicates the gable end).
  const overhangSupported =
    params.roofType === 'flat' ||
    params.roofType === 'pyramid' ||
    params.roofType === 'hip';
  const hasSoffits = overhangSupported && eaveOverhang > 0;
  if (hasSoffits) {
    surfaces.push({ type: 'OuterCeilingSurface' });
    lodLabel = '2.2';
  }

  // Procedural openings pass — adds Window/Door semantics + extra faces, and
  // bumps LoD to 2.2 because openings are an LoD ≥ 2.2 concept.
  if (params.openings && (params.openings.windows || params.openings.door)) {
    const openingsRes = applyOpenings(
      out,
      {
        windows: params.openings.windows,
        door: params.openings.door,
        storeys: params.storeys,
        baseZ,
        eaveZ: eaveZAbs,
        baseSurfaceCount: surfaces.length,
      },
      out.newVertices,
      toInt,
      toGlobal
    );
    if (openingsRes.openingFacesAdded > 0) {
      surfaces.push(...openingsRes.extraSurfaces);
      lodLabel = '2.2';
    }
  }

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
        lod: lodLabel,
        boundaries: [out.shell],
        semantics: {
          surfaces,
          values: [out.semanticsValues],
        },
      } as unknown,
    ] as unknown[],
  };

  return { id, cityObject, newVertices: out.newVertices, vertexOffset };
}

// ---------- roof builders ----------

function buildFlat(
  projected: [number, number][],
  baseZ: number,
  roofZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number,
  eaveOverhang: number
): BuildOut {
  const n = projected.length;
  const hasOverhang = eaveOverhang > 0;

  // Layout:
  //   0 .. n-1     ground vertices       (proj[i], baseZ)
  //   n .. 2n-1    wall-top vertices     (proj[i], roofZ) — walls anchor here
  //   2n .. 3n-1   roof-edge vertices    (proj[i] + outward * overhang, roofZ)
  //                — only when hasOverhang. The roof and soffit faces use
  //                these; walls + openings stay on wall-top.
  const newVertices: [number, number, number][] = [];
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], roofZ));

  const groundStart = 0;
  const wallTopStart = n;
  let roofEdgeStart = wallTopStart; // collapses onto wall-top when no overhang

  if (hasOverhang) {
    roofEdgeStart = 2 * n;
    for (let i = 0; i < n; i++) {
      const out = vertexOutwardDir(projected, i);
      const ox = projected[i][0] + out[0] * eaveOverhang;
      const oy = projected[i][1] + out[1] * eaveOverhang;
      newVertices.push(toInt(ox, oy, roofZ));
    }
  }

  const groundRing: number[] = [];
  for (let i = 0; i < n; i++) groundRing.push(toGlobal(groundStart + i));
  groundRing.reverse(); // CW from below = CCW from outside (ground viewed from below)

  // Roof ring uses roof-edge verts when overhang, wall-top otherwise.
  const roofRing: number[] = [];
  for (let i = 0; i < n; i++) roofRing.push(toGlobal(roofEdgeStart + i));

  // Walls: ground → wall-top, vertical (independent of overhang).
  const wallRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    wallRings.push([
      toGlobal(groundStart + i),
      toGlobal(groundStart + j),
      toGlobal(wallTopStart + j),
      toGlobal(wallTopStart + i),
    ]);
  }

  // Soffits: wall-top → roof-edge, horizontal at roofZ. Order
  // [wallTopI, roofEdgeI, roofEdgeJ, wallTopJ] gives a normal pointing -Z,
  // which is what we want — the underside is what the user sees from below.
  const soffitRings: number[][] = [];
  if (hasOverhang) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      soffitRings.push([
        toGlobal(wallTopStart + i),
        toGlobal(roofEdgeStart + i),
        toGlobal(roofEdgeStart + j),
        toGlobal(wallTopStart + j),
      ]);
    }
  }

  // Shell + semantics, in this order so face indices line up with WallInfo's
  // shellIndex below:
  //   [0]        ground          → semantics 0
  //   [1]        roof            → semantics 1
  //   [2..1+n]   walls           → semantics 2
  //   [2+n..]    soffits (opt)   → semantics 3 (OuterCeilingSurface)
  const shell: number[][][] = [
    [groundRing],
    [roofRing],
    ...wallRings.map((w) => [w]),
    ...soffitRings.map((s) => [s]),
  ];
  const semanticsValues: number[] = [
    0,
    1,
    ...new Array(n).fill(2),
    ...new Array(soffitRings.length).fill(3),
  ];

  // Wall metadata for the openings pass. Walls live at shellIndex 2..n+1.
  const walls: RectangularWall[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    walls.push({
      shellIndex: 2 + i,
      globalCorners: [
        toGlobal(groundStart + i),
        toGlobal(groundStart + j),
        toGlobal(wallTopStart + j),
        toGlobal(wallTopStart + i),
      ],
      corners3D: [
        [projected[i][0], projected[i][1], baseZ],
        [projected[j][0], projected[j][1], baseZ],
        [projected[j][0], projected[j][1], roofZ],
        [projected[i][0], projected[i][1], roofZ],
      ],
    });
  }
  return { newVertices, shell, semanticsValues, walls };
}

/**
 * Outward normal at footprint vertex i. Averages the outward normals of the
 * two adjacent edges (i-1, i) and (i, i+1). For a CCW polygon (standard math
 * orientation) the outward normal of edge (a→b) is (b.y-a.y, -(b.x-a.x))
 * normalised. For convex polygons this gives the correct bisector direction;
 * for concave vertices it can produce a degenerate direction at near-180°
 * angles, but for typical building footprints this is fine.
 */
function vertexOutwardDir(
  projected: [number, number][],
  i: number
): [number, number] {
  const n = projected.length;
  const prev = projected[(i - 1 + n) % n];
  const curr = projected[i];
  const next = projected[(i + 1) % n];
  const n1: [number, number] = [curr[1] - prev[1], -(curr[0] - prev[0])];
  const n2: [number, number] = [next[1] - curr[1], -(next[0] - curr[0])];
  const len1 = Math.hypot(n1[0], n1[1]) || 1;
  const len2 = Math.hypot(n2[0], n2[1]) || 1;
  const ax = n1[0] / len1 + n2[0] / len2;
  const ay = n1[1] / len1 + n2[1] / len2;
  const al = Math.hypot(ax, ay) || 1;
  return [ax / al, ay / al];
}

function buildPyramid(
  projected: [number, number][],
  baseZ: number,
  eaveZ: number,
  ridgeZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number,
  eaveOverhang: number = 0
): BuildOut {
  const n = projected.length;
  const newVertices: [number, number, number][] = [];
  const hasOverhang = eaveOverhang > 0;

  // Ground (z=baseZ)
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  // Wall-top / eave (z=eaveZ) — at the original footprint corners. Walls
  // anchor here regardless of overhang.
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
  const wallTopStart = n;
  const apexLocal = 2 * n;

  // Roof-edge ring (only when hasOverhang). Roof triangles connect roof-edge
  // segments to the apex; wall-top stays inside, soffits fill the gap.
  let roofEdgeStart = wallTopStart;
  if (hasOverhang) {
    roofEdgeStart = 2 * n + 1; // skip past apex local index
    for (let i = 0; i < n; i++) {
      const out = vertexOutwardDir(projected, i);
      const ox = projected[i][0] + out[0] * eaveOverhang;
      const oy = projected[i][1] + out[1] * eaveOverhang;
      newVertices.push(toInt(ox, oy, eaveZ));
    }
  }

  const groundRing: number[] = [];
  for (let i = 0; i < n; i++) groundRing.push(toGlobal(groundStart + i));
  groundRing.reverse();

  // Walls — rectangular ground→wall-top (no slope)
  const wallRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    wallRings.push([
      toGlobal(groundStart + i),
      toGlobal(groundStart + j),
      toGlobal(wallTopStart + j),
      toGlobal(wallTopStart + i),
    ]);
  }

  // Roof — n triangles sharing the apex, anchored to roof-edge (or wall-top
  // when no overhang — they're the same vertices in that case).
  const roofRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    roofRings.push([
      toGlobal(roofEdgeStart + i),
      toGlobal(roofEdgeStart + j),
      toGlobal(apexLocal),
    ]);
  }

  // Soffits — only when hasOverhang. n quads filling the underside.
  const soffitRings: number[][] = [];
  if (hasOverhang) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      soffitRings.push([
        toGlobal(wallTopStart + i),
        toGlobal(roofEdgeStart + i),
        toGlobal(roofEdgeStart + j),
        toGlobal(wallTopStart + j),
      ]);
    }
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
    ...soffitRings.map((s) => [s]),
  ];
  const semanticsValues: number[] = [
    0,
    ...new Array(n).fill(1),
    ...new Array(n).fill(2),
    ...new Array(soffitRings.length).fill(3),
  ];

  // Pyramid walls are rectangular (ground→wall-top) for every footprint edge.
  // They live at shellIndex 1+n .. 1+n+n-1 (after ground + n roof triangles).
  const walls: RectangularWall[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    walls.push({
      shellIndex: 1 + n + i,
      globalCorners: [
        toGlobal(groundStart + i),
        toGlobal(groundStart + j),
        toGlobal(wallTopStart + j),
        toGlobal(wallTopStart + i),
      ],
      corners3D: [
        [projected[i][0], projected[i][1], baseZ],
        [projected[j][0], projected[j][1], baseZ],
        [projected[j][0], projected[j][1], eaveZ],
        [projected[i][0], projected[i][1], eaveZ],
      ],
    });
  }
  return { newVertices, shell, semanticsValues, walls };
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

  // Gable has two long rectangular walls and two pentagonal gable-end walls.
  // Only the long walls are eligible for openings. Walls live at shellIndex
  // 3..6 (after ground + 2 roof slopes). The wall order in `wallRings` is:
  //   ridgeOnE0:  [long e0, gable e1, long e2, gable e3]
  //   else:       [gable e0, long e1, gable e2, long e3]
  const walls: RectangularWall[] = [];
  const wallEdges: Array<{ shellIndex: number; edgeStart: 0 | 1 | 2 | 3 }> = ridgeOnE0
    ? [
        { shellIndex: 3, edgeStart: 0 }, // long wall under e0 (v0→v1)
        { shellIndex: 5, edgeStart: 2 }, // long wall under e2 (v2→v3)
      ]
    : [
        { shellIndex: 4, edgeStart: 1 }, // long wall under e1 (v1→v2)
        { shellIndex: 6, edgeStart: 3 }, // long wall under e3 (v3→v0)
      ];
  for (const w of wallEdges) {
    const i = w.edgeStart;
    const j = (i + 1) % 4;
    walls.push({
      shellIndex: w.shellIndex,
      globalCorners: [G(i), G(j), G(4 + j), G(4 + i)],
      corners3D: [
        [projected[i][0], projected[i][1], baseZ],
        [projected[j][0], projected[j][1], baseZ],
        [projected[j][0], projected[j][1], eaveZ],
        [projected[i][0], projected[i][1], eaveZ],
      ],
    });
  }
  return { newVertices, shell, semanticsValues, walls };
}

function buildHip(
  projected: [number, number][],
  baseZ: number,
  eaveZ: number,
  ridgeZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number,
  eaveOverhang: number = 0
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

  const hasOverhang = eaveOverhang > 0;
  const newVertices: [number, number, number][] = [];
  // Layout (local indices):
  //   0..3   ground
  //   4..7   wall-top (eave Z, footprint corners — walls anchor here)
  //   8, 9   ridge endpoints rA, rB
  //   10..13 roof-edge (eave Z, offset outward) — only when hasOverhang
  for (let i = 0; i < 4; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  for (let i = 0; i < 4; i++) newVertices.push(toInt(projected[i][0], projected[i][1], eaveZ));
  newVertices.push(toInt(rA[0], rA[1], ridgeZ));
  newVertices.push(toInt(rB[0], rB[1], ridgeZ));
  if (hasOverhang) {
    for (let i = 0; i < 4; i++) {
      const out = vertexOutwardDir(projected, i);
      const ox = projected[i][0] + out[0] * eaveOverhang;
      const oy = projected[i][1] + out[1] * eaveOverhang;
      newVertices.push(toInt(ox, oy, eaveZ));
    }
  }

  const G = (local: number) => toGlobal(local);
  const g0 = G(0),
    g1 = G(1),
    g2 = G(2),
    g3 = G(3);
  // Wall-top vertices (where walls meet the eave). When no overhang,
  // these are also the roof-edge — re-bind below.
  const wt0 = G(4),
    wt1 = G(5),
    wt2 = G(6),
    wt3 = G(7);
  const ra = G(8),
    rb = G(9);
  // Roof-edge: offset outward when hasOverhang, else collapsed onto wall-top.
  const re0 = hasOverhang ? G(10) : wt0;
  const re1 = hasOverhang ? G(11) : wt1;
  const re2 = hasOverhang ? G(12) : wt2;
  const re3 = hasOverhang ? G(13) : wt3;

  // Ground (reversed)
  const groundRing = [g3, g2, g1, g0];

  // 4 rectangular walls go from ground to wall-top (independent of overhang).
  const wallRings = [
    [g0, g1, wt1, wt0],
    [g1, g2, wt2, wt1],
    [g2, g3, wt3, wt2],
    [g3, g0, wt0, wt3],
  ];

  // 4 roof faces use roof-edge vertices (offset outward when overhang).
  let roofRings: number[][];
  if (ridgeOnE0) {
    roofRings = [
      [re0, re1, rb, ra],
      [re2, re3, ra, rb],
      [re1, re2, rb],
      [re3, re0, ra],
    ];
  } else {
    roofRings = [
      [re1, re2, rb, ra],
      [re3, re0, ra, rb],
      [re0, re1, ra],
      [re2, re3, rb],
    ];
  }

  // 4 soffits — only when hasOverhang. Each connects wall-top edge to
  // roof-edge edge with normal pointing -Z (visible from below).
  const soffitRings: number[][] = [];
  if (hasOverhang) {
    soffitRings.push(
      [wt0, re0, re1, wt1],
      [wt1, re1, re2, wt2],
      [wt2, re2, re3, wt3],
      [wt3, re3, re0, wt0]
    );
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
    ...soffitRings.map((s) => [s]),
  ];
  // 1 ground + 4 roof (2 trapezoids + 2 triangles) + 4 walls + 0|4 soffits
  const semanticsValues: number[] = [
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    ...new Array(soffitRings.length).fill(3),
  ];

  // All 4 hip walls are rectangular. They live at shellIndex 5..8 (after
  // ground + 4 roof faces). Wall order matches edge order: e0, e1, e2, e3.
  const walls: RectangularWall[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    walls.push({
      shellIndex: 5 + i,
      globalCorners: [G(i), G(j), G(4 + j), G(4 + i)],
      corners3D: [
        [projected[i][0], projected[i][1], baseZ],
        [projected[j][0], projected[j][1], baseZ],
        [projected[j][0], projected[j][1], eaveZ],
        [projected[i][0], projected[i][1], eaveZ],
      ],
    });
  }
  return { newVertices, shell, semanticsValues, walls };
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
