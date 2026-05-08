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

export type IfcSourceClass = 'wall' | 'slab' | 'roof' | 'window' | 'door' | 'other';

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
    // IfcGeometricRepresentationContext that puts the model close to
    // origin in a standard orientation. For files where authoring tools
    // exported the building far from origin (Revit's "shared coords",
    // or geo-referenced models that put a building millions of metres
    // out in some projected CRS), this matrix is the only thing that
    // makes the resulting mesh sane to handle. Skipping it leaves
    // vertices in their raw coords and our XY-centring at the end
    // produces tight bboxes anyway, but rotations/scales we miss show
    // up as obviously-wrong orientations. Apply it before placement
    // transforms so the rest of the pipeline operates in the
    // coordinated frame.
    const coordRaw = api.GetCoordinationMatrix(modelID);
    // Some web-ifc builds return a typed array, others a JS array.
    const C = Array.from(coordRaw as ArrayLike<number>);
    const hasCoordMat = C.length === 16 && !isIdentityMatrix(C);

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
      const sourceClass = classFromIfcType(ifcType);
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
        for (let j = 0; j < idx.length; j++) indexBuffer.push(idx[j] + base);
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
 * source class (IfcWall, IfcWindow, IfcDoor, IfcRoof, IfcSlab, …) AND the
 * triangle's vertical normal component / Z position relative to the
 * building's storey elevations. Falls back to normal-only when the IFC
 * class is `other`.
 *
 * Mapping rules:
 *   IfcWindow                 → Window
 *   IfcDoor                   → Door
 *   IfcRoof                   → RoofSurface
 *   IfcWall                   → WallSurface (almost always vertical anyway)
 *   IfcSlab → top-most storey → RoofSurface
 *           → ground-level    → GroundSurface
 *           → mid-storey      → WallSurface (it's an inter-floor partition,
 *                                            not visible exterior; classifying
 *                                            it as wall keeps the cream tint
 *                                            for floor edges that show through
 *                                            staircase voids)
 *   other  → fall back to normal-only classification
 *
 * `nz` is the Z component of the triangle's outward normal.
 * `triCenterZ` is its centroid Z (used to decide top/bottom slab).
 * `topStoreyZ` / `bottomStoreyZ` come from the IFC's IfcBuildingStorey
 * elevations (callers pass null when the IFC has no storeys declared).
 */
export function classifyTriangleSurface(
  cls: IfcSourceClass,
  nz: number,
  triCenterZ: number,
  topStoreyZ: number | null,
  bottomStoreyZ: number | null
): CitySurfaceType {
  if (cls === 'window') return 'Window';
  if (cls === 'door') return 'Door';
  if (cls === 'roof') return 'RoofSurface';
  if (cls === 'wall') return 'WallSurface';
  if (cls === 'slab') {
    if (topStoreyZ !== null && triCenterZ >= topStoreyZ - 0.5) return 'RoofSurface';
    if (bottomStoreyZ !== null && triCenterZ <= bottomStoreyZ + 0.5) {
      return nz < 0 ? 'GroundSurface' : 'WallSurface';
    }
    return 'WallSurface';
  }
  // 'other' — fall back to normal-only.
  return classifySurfaceFromNormal(nz);
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
  const sign = deg < 0 ? -1 : 1;
  const abs =
    Math.abs(deg) + Math.abs(min) / 60 + Math.abs(sec) / 3600 + Math.abs(microSec) / 3_600_000_000;
  return sign * abs;
}
