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
  /** LoD 2.2 eave overhang in metres (default 0 = no overhang). Flat roofs
   *  support a validated finite roof slab; pitched roof overhangs remain
   *  disabled until they have their own validated slab topology. */
  eaveOverhang?: number;
  /** LoD 2.2 gable rake overhang in metres (default 0 = no overhang). Only
   *  applies to `roofType: 'gable'`; ignored otherwise. When > 0, the ridge
   *  and the roof slopes extend past each gable wall along the ridge axis,
   *  and a small "rake gable triangle" closes each extreme end. The gable
   *  walls themselves are unchanged. */
  rakeOverhang?: number;
}

const FLAT_ROOF_SLAB_THICKNESS = 0.25;

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
  let projected = open.map(([lng, lat]) => {
    const [x, y] = proj4('EPSG:4326', params.targetCrs, [lng, lat]) as [number, number];
    return [x, y] as [number, number];
  });
  // Roof builders emit outward-facing shells for counter-clockwise footprint
  // rings. Terra Draw and geometry extracted from an existing GroundSurface
  // can supply either order, so normalise before generating any faces.
  if (signedArea(projected) < 0) projected = projected.reverse();

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
  const rakeOverhang = Math.max(0, params.rakeOverhang ?? 0);
  if (rakeOverhang > 0) {
    throw new Error(
      'Rake overhang geometry is temporarily disabled until a validated pitched roof-slab model is available.'
    );
  }
  if (eaveOverhang > 0 && params.roofType !== 'flat') {
    throw new Error(
      'Pitched roof eave overhang geometry is temporarily disabled until a validated roof-slab model is available. Flat roofs support eave overhangs.'
    );
  }
  if (params.roofType === 'flat' && eaveOverhang > 0 && params.eaveHeight <= FLAT_ROOF_SLAB_THICKNESS) {
    throw new Error(
      `Flat roof overhang requires eaveHeight > ${FLAT_ROOF_SLAB_THICKNESS} m so the roof slab has finite thickness.`
    );
  }
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
    out = buildGable(projected, baseZ, eaveZAbs, ridgeZAbs, toInt, toGlobal, eaveOverhang, rakeOverhang);
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

  // Flat eave overhang adds a finite 0.25m slab with soffit faces tagged as
  // OuterCeilingSurface. Pitched/rake overhangs stay blocked above.
  const hasSoffits = params.roofType === 'flat' && eaveOverhang > 0;
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
        eaveZ: hasSoffits ? eaveZAbs - FLAT_ROOF_SLAB_THICKNESS : eaveZAbs,
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
      // Stash the parametric inputs as private attributes so a future
      // `regenerateBuilding` (footprint-edit, etc.) can re-run the same
      // generator with the same shape choices. Keys are `_`-prefixed so the
      // editor's "official" attribute view can hide them by convention.
      _eaveHeight: params.eaveHeight,
      _ridgeHeight: params.ridgeHeight,
      _baseElevation: params.baseElevation ?? 0,
      _eaveOverhang: params.eaveOverhang ?? 0,
      _rakeOverhang: params.rakeOverhang ?? 0,
      _addWindows: params.openings?.windows ?? false,
      _addDoor: params.openings?.door ?? false,
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

function signedArea(ring: [number, number][]): number {
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    twiceArea += x1 * y2 - x2 * y1;
  }
  return twiceArea / 2;
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
  if (hasOverhang) {
    return buildFlatWithRoofSlab(projected, baseZ, roofZ, toInt, toGlobal, eaveOverhang);
  }

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

  // Soffits: wall-top → roof-edge, horizontal at roofZ. Keep the winding
  // clockwise from above so the outward normal points down at the visible
  // underside.
  const soffitRings: number[][] = [];
  if (hasOverhang) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      soffitRings.push([
        toGlobal(wallTopStart + i),
        toGlobal(wallTopStart + j),
        toGlobal(roofEdgeStart + j),
        toGlobal(roofEdgeStart + i),
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

function buildFlatWithRoofSlab(
  projected: [number, number][],
  baseZ: number,
  roofZ: number,
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number,
  eaveOverhang: number
): BuildOut {
  const n = projected.length;
  const slabBottomZ = roofZ - FLAT_ROOF_SLAB_THICKNESS;
  const outer = offsetRing(projected, eaveOverhang);
  validateOffsetRing(projected, outer);

  const newVertices: [number, number, number][] = [];
  for (let i = 0; i < n; i++) newVertices.push(toInt(projected[i][0], projected[i][1], baseZ));
  for (let i = 0; i < n; i++) {
    newVertices.push(toInt(projected[i][0], projected[i][1], slabBottomZ));
  }
  for (let i = 0; i < n; i++) newVertices.push(toInt(outer[i][0], outer[i][1], slabBottomZ));
  for (let i = 0; i < n; i++) newVertices.push(toInt(outer[i][0], outer[i][1], roofZ));

  const groundStart = 0;
  const wallTopStart = n;
  const outerBottomStart = 2 * n;
  const outerTopStart = 3 * n;

  const groundRing: number[] = [];
  for (let i = 0; i < n; i++) groundRing.push(toGlobal(groundStart + i));
  groundRing.reverse();

  const roofRing: number[] = [];
  for (let i = 0; i < n; i++) roofRing.push(toGlobal(outerTopStart + i));

  const bodyWallRings: number[][] = [];
  const fasciaRings: number[][] = [];
  const soffitRings: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    bodyWallRings.push([
      toGlobal(groundStart + i),
      toGlobal(groundStart + j),
      toGlobal(wallTopStart + j),
      toGlobal(wallTopStart + i),
    ]);
    fasciaRings.push([
      toGlobal(outerBottomStart + i),
      toGlobal(outerBottomStart + j),
      toGlobal(outerTopStart + j),
      toGlobal(outerTopStart + i),
    ]);
    soffitRings.push([
      toGlobal(wallTopStart + i),
      toGlobal(wallTopStart + j),
      toGlobal(outerBottomStart + j),
      toGlobal(outerBottomStart + i),
    ]);
  }

  const shell: number[][][] = [
    [groundRing],
    [roofRing],
    ...bodyWallRings.map((w) => [w]),
    ...fasciaRings.map((w) => [w]),
    ...soffitRings.map((s) => [s]),
  ];
  const semanticsValues: number[] = [
    0,
    1,
    ...new Array(bodyWallRings.length + fasciaRings.length).fill(2),
    ...new Array(soffitRings.length).fill(3),
  ];

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
        [projected[j][0], projected[j][1], slabBottomZ],
        [projected[i][0], projected[i][1], slabBottomZ],
      ],
    });
  }

  return { newVertices, shell, semanticsValues, walls };
}

function offsetRing(ring: [number, number][], distance: number): [number, number][] {
  const n = ring.length;
  const result: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const curr = ring[i];
    const next = ring[(i + 1) % n];
    const prevDir: [number, number] = [curr[0] - prev[0], curr[1] - prev[1]];
    const nextDir: [number, number] = [next[0] - curr[0], next[1] - curr[1]];
    const prevLen = Math.hypot(prevDir[0], prevDir[1]);
    const nextLen = Math.hypot(nextDir[0], nextDir[1]);
    if (prevLen < 1e-9 || nextLen < 1e-9) {
      throw new Error('Flat roof overhang requires a non-degenerate footprint.');
    }

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
    const intersect = intersectLines(p1, prevDir, p2, nextDir);
    if (intersect) {
      result.push(intersect);
    } else {
      const fallback = vertexOutwardDir(ring, i);
      result.push([curr[0] + fallback[0] * distance, curr[1] + fallback[1] * distance]);
    }
  }
  return result;
}

function intersectLines(
  p: [number, number],
  r: [number, number],
  q: [number, number],
  s: [number, number]
): [number, number] | null {
  const denom = cross2(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const qp: [number, number] = [q[0] - p[0], q[1] - p[1]];
  const t = cross2(qp, s) / denom;
  return [p[0] + t * r[0], p[1] + t * r[1]];
}

function validateOffsetRing(original: [number, number][], outer: [number, number][]): void {
  if (outer.length !== original.length || outer.length < 3) {
    throw new Error('Flat roof overhang produced an invalid offset footprint.');
  }
  for (const [x, y] of outer) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Flat roof overhang produced non-finite offset coordinates.');
    }
  }
  if (signedArea(outer) <= signedArea(original)) {
    throw new Error('Flat roof overhang produced an invalid offset footprint.');
  }
  if (hasSelfIntersection(outer)) {
    throw new Error('Flat roof overhang produced a self-intersecting offset footprint.');
  }
}

function hasSelfIntersection(ring: [number, number][]): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % ring.length];
    for (let j = i + 1; j < ring.length; j++) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === ring.length - 1) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % ring.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function segmentsIntersect(
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
  const o1 = cross2(ab, ac);
  const o2 = cross2(ab, ad);
  const o3 = cross2(cd, ca);
  const o4 = cross2(cd, cb);
  return o1 * o2 < -1e-9 && o3 * o4 < -1e-9;
}

function cross2(a: [number, number], b: [number, number]): number {
  return a[0] * b[1] - a[1] * b[0];
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
        toGlobal(wallTopStart + j),
        toGlobal(roofEdgeStart + j),
        toGlobal(roofEdgeStart + i),
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
  toGlobal: (local: number) => number,
  eaveOverhang: number = 0,
  rakeOverhang: number = 0
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

  // LoD 2.2 eave overhang for gable: only the LONG sides overhang. Each long-
  // side corner gets its own roof-edge vertex offset perpendicular to that
  // long edge (NOT the bisector — at gable corners the rake side has no
  // overhang, so an asymmetric offset is correct). The gable-end pentagons
  // and the ridge are unchanged.
  //
  // The slope's lower-left edge near v0 (when ridgeOnE0 = true) goes from
  // re_v0 (offset) up to rB (no offset). The gable wall's pentagon edge near
  // v0 goes from e0v (no offset) up to rB. These two edges share rB but
  // diverge at the bottom, leaving a small triangular gap. We close it with a
  // "rake-corner-cap" triangle [e0v, re_v0, rB] tagged as OuterCeilingSurface.
  const hasOverhang = eaveOverhang > 0;
  const hasRakeOverhang = rakeOverhang > 0;
  // Long-edge roof-edge vertex globals — only valid when hasOverhang.
  let re0 = -1,
    re1 = -1,
    re2 = -1,
    re3 = -1;
  // Rake-extended vertex globals — only valid when hasRakeOverhang.
  // rA_ext, rB_ext: ridge endpoints extended along the ridge axis past the
  // gable walls. _rake corners: gable-end eave corners extended along the
  // ridge axis (NOT perpendicular to long edges — that's the eaveOverhang).
  let rA_ext = -1,
    rB_ext = -1;
  let re0_rake = -1,
    re1_rake = -1,
    re2_rake = -1,
    re3_rake = -1;
  if (hasOverhang) {
    // For ridgeOnE0=true: long edges are e0 (v0→v1) and e2 (v2→v3).
    //   outwardE0 = perpendicular to (v1-v0), pointing away from polygon
    //   outwardE2 = perpendicular to (v3-v2), pointing away
    // For ridgeOnE0=false: long edges are e1 (v1→v2) and e3 (v3→v0).
    const perpOutward = (a: [number, number], b: [number, number]): [number, number] => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      // CCW polygon outward = rotate (dx,dy) clockwise 90° = (dy, -dx).
      return [dy / len, -dx / len];
    };
    if (ridgeOnE0) {
      const oE0 = perpOutward(v0, v1);
      const oE2 = perpOutward(v2, v3);
      newVertices.push(toInt(v0[0] + oE0[0] * eaveOverhang, v0[1] + oE0[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v1[0] + oE0[0] * eaveOverhang, v1[1] + oE0[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v2[0] + oE2[0] * eaveOverhang, v2[1] + oE2[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v3[0] + oE2[0] * eaveOverhang, v3[1] + oE2[1] * eaveOverhang, eaveZ));
      re0 = G(10);
      re1 = G(11);
      re2 = G(12);
      re3 = G(13);
    } else {
      const oE1 = perpOutward(v1, v2);
      const oE3 = perpOutward(v3, v0);
      newVertices.push(toInt(v1[0] + oE1[0] * eaveOverhang, v1[1] + oE1[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v2[0] + oE1[0] * eaveOverhang, v2[1] + oE1[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v3[0] + oE3[0] * eaveOverhang, v3[1] + oE3[1] * eaveOverhang, eaveZ));
      newVertices.push(toInt(v0[0] + oE3[0] * eaveOverhang, v0[1] + oE3[1] * eaveOverhang, eaveZ));
      // re1, re2 = e1's roof-edge at v1, v2; re3, re0 = e3's roof-edge at v3, v0
      re1 = G(10);
      re2 = G(11);
      re3 = G(12);
      re0 = G(13);
    }
  }

  if (hasRakeOverhang) {
    // Ridge axis direction in plan (from rB toward rA, unit length).
    const ridgeLen =
      Math.hypot(ridgeA[0] - ridgeB[0], ridgeA[1] - ridgeB[1]) || 1;
    const rdx = (ridgeA[0] - ridgeB[0]) / ridgeLen;
    const rdy = (ridgeA[1] - ridgeB[1]) / ridgeLen;

    // Extended ridge endpoints — rA moves away from rB (+ridgeDir), rB the
    // opposite (-ridgeDir). Distance: rakeOverhang.
    newVertices.push(
      toInt(ridgeA[0] + rdx * rakeOverhang, ridgeA[1] + rdy * rakeOverhang, ridgeZ)
    );
    rA_ext = G(newVertices.length - 1);
    newVertices.push(
      toInt(ridgeB[0] - rdx * rakeOverhang, ridgeB[1] - rdy * rakeOverhang, ridgeZ)
    );
    rB_ext = G(newVertices.length - 1);

    // Extended gable-end eave corners. The base XY for each corner is either
    // the perpendicular-offset re_ position (when hasOverhang) or the raw
    // wall corner (when rake-only). Each corner shifts along the ridge axis
    // by rakeOverhang in the direction "away from its gable end".
    //
    // For ridgeOnE0 = true: v0/v3 sit on the rB side (extend -ridgeDir);
    // v1/v2 on the rA side (extend +ridgeDir).
    // For ridgeOnE0 = false: v0/v1 on rA side (+ridgeDir); v2/v3 on rB side
    // (-ridgeDir).
    let baseX0: number, baseY0: number;
    let baseX1: number, baseY1: number;
    let baseX2: number, baseY2: number;
    let baseX3: number, baseY3: number;
    if (hasOverhang) {
      // re0..re3 were just pushed at indices 10..13 — recompute their XYs by
      // running the same perpOutward math we used above. (Storing intermediate
      // results would require a wider refactor; this is one extra cheap pass.)
      const perpOutward = (a: [number, number], b: [number, number]): [number, number] => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        return [dy / len, -dx / len];
      };
      if (ridgeOnE0) {
        const oE0 = perpOutward(v0, v1);
        const oE2 = perpOutward(v2, v3);
        baseX0 = v0[0] + oE0[0] * eaveOverhang;
        baseY0 = v0[1] + oE0[1] * eaveOverhang;
        baseX1 = v1[0] + oE0[0] * eaveOverhang;
        baseY1 = v1[1] + oE0[1] * eaveOverhang;
        baseX2 = v2[0] + oE2[0] * eaveOverhang;
        baseY2 = v2[1] + oE2[1] * eaveOverhang;
        baseX3 = v3[0] + oE2[0] * eaveOverhang;
        baseY3 = v3[1] + oE2[1] * eaveOverhang;
      } else {
        const oE1 = perpOutward(v1, v2);
        const oE3 = perpOutward(v3, v0);
        baseX0 = v0[0] + oE3[0] * eaveOverhang;
        baseY0 = v0[1] + oE3[1] * eaveOverhang;
        baseX1 = v1[0] + oE1[0] * eaveOverhang;
        baseY1 = v1[1] + oE1[1] * eaveOverhang;
        baseX2 = v2[0] + oE1[0] * eaveOverhang;
        baseY2 = v2[1] + oE1[1] * eaveOverhang;
        baseX3 = v3[0] + oE3[0] * eaveOverhang;
        baseY3 = v3[1] + oE3[1] * eaveOverhang;
      }
    } else {
      baseX0 = v0[0]; baseY0 = v0[1];
      baseX1 = v1[0]; baseY1 = v1[1];
      baseX2 = v2[0]; baseY2 = v2[1];
      baseX3 = v3[0]; baseY3 = v3[1];
    }

    // Direction signs per corner: +1 = use +ridgeDir, -1 = use -ridgeDir.
    let s0: 1 | -1, s1: 1 | -1, s2: 1 | -1, s3: 1 | -1;
    if (ridgeOnE0) {
      // v0, v3 on rB side → -ridgeDir; v1, v2 on rA side → +ridgeDir
      s0 = -1; s1 = 1; s2 = 1; s3 = -1;
    } else {
      // v0, v1 on rA side → +ridgeDir; v2, v3 on rB side → -ridgeDir
      s0 = 1; s1 = 1; s2 = -1; s3 = -1;
    }
    newVertices.push(toInt(baseX0 + s0 * rdx * rakeOverhang, baseY0 + s0 * rdy * rakeOverhang, eaveZ));
    re0_rake = G(newVertices.length - 1);
    newVertices.push(toInt(baseX1 + s1 * rdx * rakeOverhang, baseY1 + s1 * rdy * rakeOverhang, eaveZ));
    re1_rake = G(newVertices.length - 1);
    newVertices.push(toInt(baseX2 + s2 * rdx * rakeOverhang, baseY2 + s2 * rdy * rakeOverhang, eaveZ));
    re2_rake = G(newVertices.length - 1);
    newVertices.push(toInt(baseX3 + s3 * rdx * rakeOverhang, baseY3 + s3 * rdy * rakeOverhang, eaveZ));
    re3_rake = G(newVertices.length - 1);
  }

  // Walls + roof depend on ridge orientation. When hasOverhang, roof slopes
  // use roof-edge vertices instead of wall-top eXv on the long-edge corners.
  let wallRings: number[][];
  let roofRings: number[][];
  // Soffits on long sides (wall-top → roof-edge), and rake-corner-caps at
  // each gable corner (small triangles closing the geometric gap).
  const overhangFaces: number[][] = [];

  // When rake overhang is active, the slope quads use the extended ridge
  // endpoints AND extended gable-end eave corners — the slope plane is
  // unchanged (same pitch), just longer along the ridge axis. The original
  // rake-corner-cap triangles no longer make sense (they sat in the gable
  // wall plane and would float "inside" the rake overhang volume), so we
  // replace them with a single triangular "rake gable" face at each extreme
  // end. Long-side soffits are unchanged: they cover the eave overhang
  // perpendicular to the long edges, which is independent of the rake.
  const slopeRA = hasRakeOverhang ? rA_ext : rA;
  const slopeRB = hasRakeOverhang ? rB_ext : rB;
  if (ridgeOnE0) {
    wallRings = [
      [g0, g1, e1v, e0v], // long wall e0
      [g1, g2, e2v, rA, e1v], // gable wall e1 — uses ORIGINAL rA
      [g2, g3, e3v, e2v], // long wall e2
      [g3, g0, e0v, rB, e3v], // gable wall e3 — uses ORIGINAL rB
    ];
    if (hasOverhang || hasRakeOverhang) {
      const slope0 = hasRakeOverhang ? re0_rake : re0;
      const slope1 = hasRakeOverhang ? re1_rake : re1;
      const slope2 = hasRakeOverhang ? re2_rake : re2;
      const slope3 = hasRakeOverhang ? re3_rake : re3;
      const baseE0 = hasOverhang ? re0 : e0v;
      const baseE1 = hasOverhang ? re1 : e1v;
      const baseE2 = hasOverhang ? re2 : e2v;
      const baseE3 = hasOverhang ? re3 : e3v;
      roofRings = [
        [slope0, slope1, slopeRA, slopeRB], // e0 slope
        [slope2, slope3, slopeRB, slopeRA], // e2 slope
      ];
      if (hasOverhang) {
        // Long-side soffits (wall-top → roof-edge), still needed since the
        // eave overhang perpendicular extension is independent of rake.
        overhangFaces.push([e0v, e1v, re1, re0]); // soffit under e0 slope
        overhangFaces.push([e2v, e3v, re3, re2]); // soffit under e2 slope
      }
      if (hasRakeOverhang) {
        // Rake gable triangles at each extreme end. At the rA side (x of rA_ext):
        //   slope1 (rA-side eave on e0) → rA_ext → slope2 (rA-side eave on e2).
        // At rB side: slope3 (rB-side eave on e2) → rB_ext → slope0 (rB-side eave on e0).
        // These three points all share the same projected XY along the ridge
        // axis (offset = ±rakeOverhang), so the triangle is planar.
        overhangFaces.push([slope1, rA_ext, slope2]); // rA-side rake gable
        overhangFaces.push([slope3, rB_ext, slope0]); // rB-side rake gable
      } else {
        // Original rake-corner-cap triangles closing the wedge between the
        // long-side eave overhang and the gable wall at each ground corner.
        overhangFaces.push([baseE0, re0, rB]); // v0 (note: baseE0 == e0v when hasOverhang)
        overhangFaces.push([baseE1, rA, re1]); // v1
        overhangFaces.push([baseE2, re2, rA]); // v2
        overhangFaces.push([baseE3, rB, re3]); // v3
      }
    } else {
      roofRings = [
        [e0v, e1v, rA, rB],
        [e2v, e3v, rB, rA],
      ];
    }
  } else {
    wallRings = [
      [g0, g1, e1v, rA, e0v], // gable wall e0
      [g1, g2, e2v, e1v], // long wall e1
      [g2, g3, e3v, rB, e2v], // gable wall e2
      [g3, g0, e0v, e3v], // long wall e3
    ];
    if (hasOverhang || hasRakeOverhang) {
      const slope0 = hasRakeOverhang ? re0_rake : re0;
      const slope1 = hasRakeOverhang ? re1_rake : re1;
      const slope2 = hasRakeOverhang ? re2_rake : re2;
      const slope3 = hasRakeOverhang ? re3_rake : re3;
      const baseE0 = hasOverhang ? re0 : e0v;
      const baseE1 = hasOverhang ? re1 : e1v;
      const baseE2 = hasOverhang ? re2 : e2v;
      const baseE3 = hasOverhang ? re3 : e3v;
      roofRings = [
        [slope1, slope2, slopeRB, slopeRA], // e1 slope
        [slope3, slope0, slopeRA, slopeRB], // e3 slope
      ];
      if (hasOverhang) {
        overhangFaces.push([e1v, e2v, re2, re1]); // soffit under e1 slope
        overhangFaces.push([e3v, e0v, re0, re3]); // soffit under e3 slope
      }
      if (hasRakeOverhang) {
        // rA side (between e0 gable and ridge): slope0 → rA_ext → slope1
        // rB side (between e2 gable and ridge): slope2 → rB_ext → slope3
        overhangFaces.push([slope0, rA_ext, slope1]); // rA-side rake gable
        overhangFaces.push([slope2, rB_ext, slope3]); // rB-side rake gable
      } else {
        overhangFaces.push([baseE1, re1, rA]); // v1
        overhangFaces.push([baseE2, rB, re2]); // v2
        overhangFaces.push([baseE3, re3, rB]); // v3
        overhangFaces.push([baseE0, rA, re0]); // v0
      }
    } else {
      roofRings = [
        [e1v, e2v, rB, rA],
        [e3v, e0v, rA, rB],
      ];
    }
  }

  const shell: number[][][] = [
    [groundRing],
    ...roofRings.map((r) => [r]),
    ...wallRings.map((w) => [w]),
    ...overhangFaces.map((s) => [s]),
  ];
  // Order: 1 ground, 2 roof, 4 walls, then 6 (or 0) overhang faces (2 soffits
  // + 4 rake-corner caps) all tagged OuterCeilingSurface (semantics index 3).
  const semanticsValues: number[] = [
    0,
    1,
    1,
    2,
    2,
    2,
    2,
    ...new Array(overhangFaces.length).fill(3),
  ];

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
      [wt0, wt1, re1, re0],
      [wt1, wt2, re2, re1],
      [wt2, wt3, re3, re2],
      [wt3, wt0, re0, re3]
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
