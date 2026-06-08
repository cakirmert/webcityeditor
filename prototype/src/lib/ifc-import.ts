/**
 * IFC import — parses an IFC file via web-ifc (WASM), extracts both:
 *   - the metadata the editor needs to surface in the placement banner
 *     (bbox, storey count, IfcSite RefLatitude / RefLongitude),
 *   - and the full triangulated mesh, transformed into a single coordinate
 *     system anchored at the bbox's XY centre. The caller then translates
 *     that mesh to a user-clicked map location and emits it as the
 *     building's LoD 3 MultiSurface — the actual IFC shape, not a box.
 *
 * Per-triangle normals are computed during the stream so the conversion
 * step can tag faces with their CityJSON 2.0 semantic surface
 * (`GroundSurface` / `RoofSurface` / `WallSurface`) based on orientation.
 */

import {
  IfcAPI,
  IFCSITE,
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCWALLELEMENTEDCASE,
  IFCCURTAINWALL,
  IFCSLAB,
  IFCSLABSTANDARDCASE,
  IFCSLABELEMENTEDCASE,
  IFCROOF,
  IFCWINDOW,
  IFCWINDOWSTANDARDCASE,
  IFCDOOR,
  IFCDOORSTANDARDCASE,
  IFCSTAIR,
  IFCSTAIRFLIGHT,
  IFCRAMP,
  IFCRAMPFLIGHT,
  IFCCOLUMN,
  IFCCOLUMNSTANDARDCASE,
  IFCBEAM,
  IFCBEAMSTANDARDCASE,
  IFCRAILING,
  IFCMEMBER,
  IFCMEMBERSTANDARDCASE,
  IFCPLATE,
  IFCPLATESTANDARDCASE,
  IFCFOOTING,
  IFCBUILDINGELEMENTPROXY,
  IFCCOVERING,
  IFCCHIMNEY,
} from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';

/**
 * IFC entity-type IDs that contribute geometry we want to keep. We
 * deliberately EXCLUDE site terrain (IfcSite, IfcGeographicElement),
 * vegetation, and furniture — they bloat the building bbox and aren't part
 * of the building shell we care about. Any future "include site terrain"
 * mode would expand this list.
 */
const BUILDING_ELEMENT_TYPES = [
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCWALLELEMENTEDCASE,
  IFCCURTAINWALL,
  IFCSLAB,
  IFCSLABSTANDARDCASE,
  IFCSLABELEMENTEDCASE,
  IFCROOF,
  IFCWINDOW,
  IFCWINDOWSTANDARDCASE,
  IFCDOOR,
  IFCDOORSTANDARDCASE,
  IFCSTAIR,
  IFCSTAIRFLIGHT,
  IFCRAMP,
  IFCRAMPFLIGHT,
  IFCCOLUMN,
  IFCCOLUMNSTANDARDCASE,
  IFCBEAM,
  IFCBEAMSTANDARDCASE,
  IFCRAILING,
  IFCMEMBER,
  IFCMEMBERSTANDARDCASE,
  IFCPLATE,
  IFCPLATESTANDARDCASE,
  IFCFOOTING,
  IFCCOVERING,
  IFCCHIMNEY,
  IFCBUILDINGELEMENTPROXY,
];

/**
 * Map IFC entity-type IDs to a coarse class string we use downstream for
 * semantic-surface tagging. The mapping is deliberately lossy — CityJSON
 * 2.0 only has GroundSurface / WallSurface / RoofSurface / Window / Door
 * / OuterCeilingSurface / OuterFloorSurface, so finer-grained IFC classes
 * (IfcStair, IfcColumn, IfcBeam) collapse into 'wall' which renders as
 * generic envelope.
 *
 * IfcSlab is special: the IFC standard puts roofs, foundations, and
 * intermediate floors all under IfcSlab, distinguished only by the
 * `PredefinedType` attribute (`.ROOF.`, `.BASESLAB.`, `.FLOOR.`, etc.).
 * The KIT FZK-Haus reference fixture, e.g., has no IfcRoof at all — the
 * gable roof is two `IfcSlab` instances tagged `.ROOF.`. So when we see
 * an IfcSlab we read PredefinedType in `parseIfc` and refine 'slab' to
 * 'roof' / 'ground' / 'slab' before stashing it on the triangle.
 */
function classFromIfcType(typeId: number): IfcSourceClass {
  switch (typeId) {
    case IFCWALL:
    case IFCWALLSTANDARDCASE:
    case IFCWALLELEMENTEDCASE:
    case IFCCURTAINWALL:
      return 'wall';
    case IFCSLAB:
    case IFCSLABSTANDARDCASE:
    case IFCSLABELEMENTEDCASE:
      return 'slab';
    case IFCROOF:
      return 'roof';
    case IFCWINDOW:
    case IFCWINDOWSTANDARDCASE:
      return 'window';
    case IFCDOOR:
    case IFCDOORSTANDARDCASE:
      return 'door';
    default:
      return 'other';
  }
}

/**
 * Refine an IfcSlab into its CityJSON-friendly subtype using its
 * PredefinedType. Returns the IfcSourceClass to assign per-triangle.
 *   .ROOF.                → 'roof'    (gable / flat roof slab)
 *   .BASESLAB. / .LANDING.→ 'ground'  (foundation, sits on the ground)
 *   .FLOOR. / others      → 'slab'    (intermediate floor — not visible
 *                                       from outside; tagged as wall by
 *                                       the surface classifier so it
 *                                       blends into the envelope colour)
 */
function refineSlabClass(predefinedType: string | null): IfcSourceClass {
  if (!predefinedType) return 'slab';
  const t = predefinedType.toUpperCase();
  if (t === 'ROOF') return 'roof';
  if (t === 'BASESLAB' || t === 'LANDING') return 'ground';
  return 'slab';
}

export type IfcSourceClass =
  | 'wall'
  | 'slab'
  | 'roof'
  | 'ground'
  | 'window'
  | 'door'
  | 'other';

export interface IfcImportResult {
  /** IFC IfcBuilding GlobalId (UUID-like). */
  globalId: string | null;
  /** Building name from IfcBuilding.Name, if present. */
  name: string | null;
  /** Bounding box of the FINAL mesh (after centring on XY-centre, Z left
   *  in IFC's local frame). minX/minY are equal-and-opposite to maxX/maxY. */
  bbox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  width: number;
  depth: number;
  height: number;
  storeyCount: number;
  refLat: number | null;
  refLon: number | null;
  refElevation: number | null;
  entityCount: number;
  parseMs: number;

  // ── Triangulated mesh ────────────────────────────────────────────────
  /** Vertex positions, flat XYZ XYZ XYZ … in IFC-local metres,
   *  centred on the XY bbox-centre (so X∈[-w/2, w/2], Y∈[-d/2, d/2]).
   *  Z is left as the IFC's local Z, with `minZ` reported separately so
   *  the caller can ground the building at z=0 if it wants. */
  vertices: Float32Array;
  /** Triangle indices (3 per triangle). */
  indices: Uint32Array;
  /** Per-triangle face normal (3 floats per triangle, normalised). */
  triangleNormals: Float32Array;
  /** Per-triangle source IFC class. Used by the converter to assign
   *  CityJSON semantic surfaces (IfcWall→Wall, IfcWindow→Window, …) — this
   *  is far more reliable than guessing from the triangle normal alone. */
  triangleSourceClass: IfcSourceClass[];
  /** Storey elevations from the IFC's IfcBuildingStorey entries. Used to
   *  decide whether an IfcSlab triangle is a roof (top storey) or ground
   *  (bottom storey) when the normal is ambiguous. */
  storeyElevations: number[];
}

let apiPromise: Promise<IfcAPI> | null = null;

async function getIfcApi(): Promise<IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new IfcAPI();
      const wasmDir = wasmUrl.substring(0, wasmUrl.lastIndexOf('/') + 1);
      api.SetWasmPath(wasmDir);
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

/**
 * Parse an IFC file. Streams every PlacedGeometry, applies its 4×4 placement
 * matrix, accumulates a single global mesh + per-triangle normals, and
 * returns everything alongside the bbox / georef metadata.
 *
 * The vertex array is centred on the XY bbox-centre at the end of the pass,
 * so a placement step on the caller's side just adds an offset to land the
 * IFC at any lng/lat.
 */
export async function parseIfc(file: File): Promise<IfcImportResult> {
  const t0 = performance.now();
  const api = await getIfcApi();
  const data = new Uint8Array(await file.arrayBuffer());
  const modelID = api.OpenModel(data);
  try {
    const buildings = api.GetLineIDsWithType(modelID, IFCBUILDING);
    if (buildings.size() === 0) {
      throw new Error('No IfcBuilding entity found in the file');
    }
    const buildingId = buildings.get(0);
    const buildingLine = api.GetLine(modelID, buildingId, true) as {
      GlobalId?: { value?: string } | string;
      Name?: { value?: string } | string | null;
    };
    const globalId = readIfcStringValue(buildingLine.GlobalId);
    const name = readIfcStringValue(buildingLine.Name);

    let refLat: number | null = null;
    let refLon: number | null = null;
    let refElevation: number | null = null;
    const sites = api.GetLineIDsWithType(modelID, IFCSITE);
    if (sites.size() > 0) {
      const siteLine = api.GetLine(modelID, sites.get(0), true) as {
        RefLatitude?: Array<{ value: number } | number> | null;
        RefLongitude?: Array<{ value: number } | number> | null;
        RefElevation?: { value: number } | number | null;
      };
      refLat = readIfcDmsToDecimal(siteLine.RefLatitude);
      refLon = readIfcDmsToDecimal(siteLine.RefLongitude);
      refElevation = readIfcNumber(siteLine.RefElevation);
    }

    const storeys = api.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);
    const storeyCount = Math.max(1, storeys.size());
    // Capture storey elevations — used downstream to decide
    // top-vs-bottom slab classification.
    const storeyElevations: number[] = [];
    for (let i = 0; i < storeys.size(); i++) {
      const st = api.GetLine(modelID, storeys.get(i), true) as { Elevation?: { value: number } | number | null };
      const e = readIfcNumber(st.Elevation);
      if (e !== null) storeyElevations.push(e);
    }
    storeyElevations.sort((a, b) => a - b);

    // ── Coordination matrix ──────────────────────────────────────────
    // web-ifc derives a 4×4 coordination matrix from IfcSite +
    // IfcGeometricRepresentationContext. For files where authoring tools
    // exported the building far from origin (Revit's "shared coords",
    // geo-referenced models that put a building millions of metres out
    // in some projected CRS), this matrix is the only thing that makes
    // the mesh sane to handle. We apply it after the per-mesh placement
    // matrix. For most well-formed IFC4 files (FZK-Haus, IFC reference
    // fixtures) it's identity and the multiply is skipped.
    const coordRaw = api.GetCoordinationMatrix(modelID);
    const C = Array.from(coordRaw as ArrayLike<number>);
    const hasCoordMat = C.length === 16 && !isIdentityMatrix(C);
    const coordDetSign = hasCoordMat ? Math.sign(det3x3ColMajor(C)) : 1;

    // ── Stream BUILDING-ELEMENT meshes only — terrain/site geometry is
    // ── deliberately skipped so the bbox stays tight on the actual
    // ── building shell. Each PlacedGeometry is tagged with its source
    // ── IFC class (wall/slab/roof/window/door/other) for downstream
    // ── semantic-surface assignment.
    const positions: number[] = [];
    const indexBuffer: number[] = [];
    const triClasses: IfcSourceClass[] = [];
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    api.StreamAllMeshesWithTypes(modelID, BUILDING_ELEMENT_TYPES, (flatMesh) => {
      const ifcType = api.GetLineType(modelID, flatMesh.expressID);
      let sourceClass = classFromIfcType(ifcType);
      // IfcSlab covers roofs, foundations, and intermediate floors —
      // refine via PredefinedType so a `.ROOF.` slab tags as `roof`,
      // `.BASESLAB.` as `ground`. Skip the GetLine call for non-slabs;
      // it's the slowest call in this loop.
      if (sourceClass === 'slab') {
        const slabLine = api.GetLine(modelID, flatMesh.expressID, false) as {
          PredefinedType?: { value?: string } | string | null;
        };
        const pt = readIfcStringValue(slabLine.PredefinedType);
        sourceClass = refineSlabClass(pt);
      }
      const placedGeoms = flatMesh.geometries;
      const n = placedGeoms.size();
      for (let i = 0; i < n; i++) {
        const placed = placedGeoms.get(i);
        const geom = api.GetGeometry(modelID, placed.geometryExpressID);
        const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
        const m = placed.flatTransformation;

        const base = positions.length / 3;
        for (let v = 0; v < verts.length; v += 6) {
          const x = verts[v];
          const y = verts[v + 1];
          const z = verts[v + 2];
          // Apply placement matrix (per-instance) first.
          let wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          let wy = m[1] * x + m[5] * y + m[9] * z + m[13];
          let wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          // Then the global coordination matrix (per-model).
          if (hasCoordMat) {
            const cx = C[0] * wx + C[4] * wy + C[8] * wz + C[12];
            const cy = C[1] * wx + C[5] * wy + C[9] * wz + C[13];
            const cz = C[2] * wx + C[6] * wy + C[10] * wz + C[14];
            wx = cx;
            wy = cy;
            wz = cz;
          }
          positions.push(wx, wy, wz);
          if (wx < minX) minX = wx;
          if (wy < minY) minY = wy;
          if (wz < minZ) minZ = wz;
          if (wx > maxX) maxX = wx;
          if (wy > maxY) maxY = wy;
          if (wz > maxZ) maxZ = wz;
        }
        // Detect mirrored geometry: if the combined transform has a negative
        // 3×3 determinant, the triangle winding is reversed. Without
        // correction, backface culling in Three.js hides those faces —
        // typically about half the walls in a real IFC file.
        const flipWinding = (det3x3ColMajor(m) * coordDetSign) < 0;
        for (let j = 0; j < idx.length; j += 3) {
          if (flipWinding) {
            indexBuffer.push(idx[j] + base, idx[j + 2] + base, idx[j + 1] + base);
          } else {
            indexBuffer.push(idx[j] + base, idx[j + 1] + base, idx[j + 2] + base);
          }
        }
        // One class entry per emitted triangle (3 indices = 1 triangle).
        const triCountFromThis = idx.length / 3;
        for (let t = 0; t < triCountFromThis; t++) triClasses.push(sourceClass);
        geom.delete();
      }
    });

    if (positions.length === 0) {
      throw new Error(
        'IFC file has no triangulatable building geometry. (Looked for ' +
          'IfcWall, IfcSlab, IfcRoof, IfcWindow, IfcDoor, IfcStair, IfcColumn, ' +
          'IfcBeam, IfcRailing, IfcMember, IfcPlate, IfcFooting, ' +
          'IfcCovering, IfcChimney, IfcBuildingElementProxy.)'
      );
    }

    // ── Y-up → Z-up rotation ──────────────────────────────────────────
    // The IFC spec puts Z up, but web-ifc's `flatTransformation` matrices
    // bake in a -90° rotation around X — i.e. each per-mesh placement
    // sends IFC's local Z (the up axis, e.g. wall extrusion direction)
    // to world +Y, and IFC's local Y to world -Z. The output mesh ends
    // up Y-up. (You can see it in the matrices web-ifc returns: column 2,
    // the local-Z basis vector in world coords, is consistently
    // (0, 1, 0) regardless of IfcLocalPlacement rotation around the
    // vertical axis.) We undo that by rotating the assembled mesh +90°
    // around X — `(x, y, z) → (x, -z, y)` — so the rest of the pipeline
    // (CityJSON converter, three.js viewer with `camera.up = (0,0,1)`,
    // Three.js loader's surface materials) sees a Z-up mesh.
    //
    // Sanity check on FZK-Haus: pre-rotation Y range = 6.52 (the actual
    // building height, ground at y≈-3.2, gable peak at y≈+3.2);
    // pre-rotation Z range = 11.0 (the building's plan-depth, slab's
    // local Y direction). Post-rotation: Z range = 6.52 (height ✓),
    // Y range = 11.0 (plan-depth ✓).
    for (let i = 0; i < positions.length; i += 3) {
      const oldY = positions[i + 1];
      const oldZ = positions[i + 2];
      positions[i + 1] = -oldZ;
      positions[i + 2] = oldY;
    }
    // After the rotation, X is unchanged but Y and Z are swapped/negated.
    // Recompute the affected min/max.
    {
      const newMinY = -maxZ;
      const newMaxY = -minZ;
      const newMinZ = minY;
      const newMaxZ = maxY;
      minY = newMinY;
      maxY = newMaxY;
      minZ = newMinZ;
      maxZ = newMaxZ;
    }

    // Centre the mesh on the XY bbox-centre — leave Z alone so floor stays
    // at minZ. Caller adds a horizontal offset for placement and we know the
    // IFC's "ground" is at z = minZ if needed.
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const positionsArr = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      positionsArr[i] = positions[i] - cx;
      positionsArr[i + 1] = positions[i + 1] - cy;
      positionsArr[i + 2] = positions[i + 2];
    }
    const indicesArr = new Uint32Array(indexBuffer);

    // Triangle face normals (one per triangle, normalised).
    const triCount = indicesArr.length / 3;
    const normals = new Float32Array(triCount * 3);
    for (let t = 0; t < triCount; t++) {
      const i0 = indicesArr[t * 3] * 3;
      const i1 = indicesArr[t * 3 + 1] * 3;
      const i2 = indicesArr[t * 3 + 2] * 3;
      const ux = positionsArr[i1] - positionsArr[i0];
      const uy = positionsArr[i1 + 1] - positionsArr[i0 + 1];
      const uz = positionsArr[i1 + 2] - positionsArr[i0 + 2];
      const vx = positionsArr[i2] - positionsArr[i0];
      const vy = positionsArr[i2 + 1] - positionsArr[i0 + 1];
      const vz = positionsArr[i2 + 2] - positionsArr[i0 + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals[t * 3] = nx;
      normals[t * 3 + 1] = ny;
      normals[t * 3 + 2] = nz;
    }
    if (triClasses.length !== triCount) {
      throw new Error(
        `Internal error: tri-class array (${triClasses.length}) doesn't match triangle count (${triCount})`
      );
    }

    const entityCount = api.GetAllLines(modelID).size();
    api.CloseModel(modelID);

    // The bbox we report is centred-on-XY (so minX = -width/2, etc.),
    // matching the position layout the caller will operate on.
    const width = maxX - minX;
    const depth = maxY - minY;

    return {
      globalId,
      name,
      bbox: {
        minX: -width / 2,
        minY: -depth / 2,
        minZ,
        maxX: width / 2,
        maxY: depth / 2,
        maxZ,
      },
      width,
      depth,
      height: maxZ - minZ,
      storeyCount,
      refLat,
      refLon,
      refElevation,
      entityCount,
      parseMs: Math.round(performance.now() - t0),
      vertices: positionsArr,
      indices: indicesArr,
      triangleNormals: normals,
      triangleSourceClass: triClasses,
      storeyElevations,
    };
  } catch (e) {
    api.CloseModel(modelID);
    throw e;
  }
}

export type CitySurfaceType =
  | 'GroundSurface'
  | 'RoofSurface'
  | 'WallSurface'
  | 'Window'
  | 'Door';

/**
 * Tag a triangle with its CityJSON 2.0 semantic surface using BOTH the IFC's
 * source class (IfcWall, IfcWindow, IfcDoor, IfcSlab.PredefinedType, …) AND
 * the triangle's vertical normal component / Z position relative to the
 * mesh's overall Z extrema.
 *
 * Mapping rules:
 *   IfcWindow                                          → Window
 *   IfcDoor                                            → Door
 *   IfcRoof / IfcSlab(.ROOF.)                          → RoofSurface
 *   IfcWall                                            → WallSurface
 *   IfcSlab(.BASESLAB. / .LANDING.) ('ground' class):
 *       face normal points down → GroundSurface
 *       face normal points up   → WallSurface (slab top edge — not the
 *                                              ground exterior)
 *   IfcSlab(.FLOOR. / generic) ('slab' class):
 *       at the top of the mesh   → RoofSurface (flat-roof case where
 *                                                the ridge slab is .FLOOR.
 *                                                in some authoring tools)
 *       at the bottom            → GroundSurface (foundation w/o .BASESLAB.)
 *       in between               → WallSurface (intermediate floor)
 *   IfcStair / IfcColumn / IfcBeam / proxies ('other'):
 *       always                   → WallSurface (interior surfaces; tagging
 *                                                them by normal mis-classifies
 *                                                stair undersides as ground
 *                                                across all heights)
 *
 * `nz` is the Z component of the triangle's outward normal.
 * `triCenterZ` is its centroid Z in the mesh frame.
 * `meshTopZ` / `meshBottomZ` are the building's overall Z extrema in the
 *   same frame — the converter passes them after applying its own zShift,
 *   so a "near top" check is just `triCenterZ >= meshTopZ - eps`.
 */
export function classifyTriangleSurface(
  cls: IfcSourceClass,
  nz: number,
  triCenterZ: number,
  meshTopZ: number,
  meshBottomZ: number
): CitySurfaceType {
  if (cls === 'window') return 'Window';
  if (cls === 'door') return 'Door';
  if (cls === 'roof') return 'RoofSurface';
  if (cls === 'wall') return 'WallSurface';
  // Foundation / landing slab: only the down-facing face is the actual
  // ground; the top of the slab is just a floor edge — keep it as wall
  // so it doesn't render in ground-grey on top.
  if (cls === 'ground') return nz < -0.5 ? 'GroundSurface' : 'WallSurface';
  // Generic slab: position-based, with a tolerance band so floor slabs
  // that happen to sit at the building extremes still get tagged.
  if (cls === 'slab') {
    const eps = 0.5;
    if (triCenterZ >= meshTopZ - eps) return 'RoofSurface';
    if (triCenterZ <= meshBottomZ + eps) return nz < 0 ? 'GroundSurface' : 'WallSurface';
    return 'WallSurface';
  }
  // 'other' — IfcStair, IfcColumn, IfcBeam, IfcBuildingElementProxy etc.
  // These are usually internal and not part of the visible envelope.
  // Tagging them WallSurface keeps the cream colour for the building
  // mass; trying to be clever with the normal mis-classifies stair
  // undersides as GroundSurface at upper-floor heights.
  return 'WallSurface';
}

/** Original simple normal-only classifier, kept for backward compat with
 *  tests + the converter's `other` fallback path. */
export function classifySurfaceFromNormal(
  nz: number
): 'GroundSurface' | 'RoofSurface' | 'WallSurface' {
  if (nz < -0.7) return 'GroundSurface';
  if (nz > 0.7) return 'RoofSurface';
  return 'WallSurface';
}

/**
 * Build a 4-vertex closed CCW WGS84 footprint rectangle centred on
 * `placementWgs84` and sized to (width × depth) in metres. Used both as a
 * fallback for the map's extractFootprints AND as a quick sanity outline.
 */
export function buildFootprintFromIfc(
  metadata: { width: number; depth: number },
  placementWgs84: [number, number]
): [number, number][] {
  const [lng, lat] = placementWgs84;
  const halfW = metadata.width / 2;
  const halfD = metadata.depth / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const dLng = halfW / mPerDegLng;
  const dLat = halfD / mPerDegLat;
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
  ];
}

// ─── helpers for reading web-ifc's flatten=true line shape ───────────────

function readIfcStringValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in (v as object)) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === 'string' ? inner : null;
  }
  return null;
}

function readIfcNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'value' in (v as object)) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === 'number' ? inner : null;
  }
  return null;
}

/** 3×3 determinant of the upper-left sub-matrix of a 4×4 column-major
 *  matrix. Negative means the transform mirrors (reflects) the geometry,
 *  which reverses triangle winding — used to detect when we need to swap
 *  two indices per triangle to keep outward-facing normals. */
function det3x3ColMajor(m: ArrayLike<number>): number {
  return (
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[4] * (m[1] * m[10] - m[2] * m[9]) +
    m[8] * (m[1] * m[6] - m[2] * m[5])
  );
}

/** Identity-matrix detection — skip the per-vertex coordination multiply
 *  when the matrix is identity (most Revit/ArchiCAD exports). Tolerates a
 *  small float epsilon so floating-point noise doesn't force unnecessary
 *  multiplies. */
function isIdentityMatrix(m: number[]): boolean {
  if (m.length !== 16) return false;
  const ε = 1e-9;
  const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = 0; i < 16; i++) {
    if (Math.abs(m[i] - expected[i]) > ε) return false;
  }
  return true;
}

function readIfcDmsToDecimal(v: unknown): number | null {
  if (!Array.isArray(v) || v.length < 3) return null;
  const parts = v.map((entry) => {
    if (typeof entry === 'number') return entry;
    if (entry && typeof entry === 'object' && 'value' in (entry as object)) {
      const inner = (entry as { value: unknown }).value;
      return typeof inner === 'number' ? inner : NaN;
    }
    return NaN;
  });
  if (parts.some((p) => !Number.isFinite(p))) return null;
  const [deg, min, sec, microSec = 0] = parts;
  let sign = 1;
  for (const p of parts) {
    if (p !== 0) {
      sign = p < 0 ? -1 : 1;
      break;
    }
  }
  const abs =
    Math.abs(deg) + Math.abs(min) / 60 + Math.abs(sec) / 3600 + Math.abs(microSec) / 3_600_000_000;
  return sign * abs;
}
