/**
 * IFC import — parses an IFC file via web-ifc (WASM), extracts the
 * IfcBuilding's bounding box and any IfcSite geo-reference, and surfaces
 * just enough metadata for the editor to drop a parametric LoD 2 box
 * onto the map at the caller's chosen location.
 *
 * v1 scope: the IFC's actual triangulated geometry is NOT preserved in
 * the resulting CityJSON Building. Instead we extract:
 *   - bbox dimensions (width × depth × height)
 *   - storey count (from IfcBuildingStorey lines)
 *   - rough footprint orientation (long-axis bearing) for rectangle
 *     placement
 *   - IfcSite RefLatitude / RefLongitude / RefElevation if present
 *
 * The editor then uses its existing parametric generator to produce a
 * CityJSON Building with those dimensions, which renders cleanly on the
 * map and can be edited like any other parametric building. The original
 * IFC is referenced by `_ifcSource` (filename) and `_ifcGlobalId` so a
 * future v2 can pull in the full mesh as an LoD 3 sidecar.
 */

import { IfcAPI, IFCSITE, IFCBUILDING, IFCBUILDINGSTOREY } from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';

export interface IfcImportMetadata {
  /** IFC IfcBuilding GlobalId (UUID-like). */
  globalId: string | null;
  /** Building name from IfcBuilding.Name, if present. */
  name: string | null;
  /** Bounding box in IFC's local CRS (metres typically; some files use mm
   *  but web-ifc normalises units). */
  bbox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  /** Width (X), depth (Y), height (Z) in metres derived from the bbox. */
  width: number;
  depth: number;
  height: number;
  /** Number of IfcBuildingStorey entities — used as the editor's
   *  default `storeys` value. */
  storeyCount: number;
  /** IfcSite reference latitude (decimal degrees) if present. */
  refLat: number | null;
  /** IfcSite reference longitude (decimal degrees) if present. */
  refLon: number | null;
  /** IfcSite reference elevation (metres) if present. */
  refElevation: number | null;
  /** Number of IFC entities scanned — debug / progress info. */
  entityCount: number;
  /** Time spent parsing in ms. */
  parseMs: number;
}

let apiPromise: Promise<IfcAPI> | null = null;

/** Lazily initialise the web-ifc WASM module. The module is ~2 MB so we
 *  defer loading until the user actually imports an IFC. */
async function getIfcApi(): Promise<IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new IfcAPI();
      // Vite resolves `?url` imports to a final asset path; web-ifc's
      // SetWasmPath wants the directory, so we strip the filename.
      const wasmDir = wasmUrl.substring(0, wasmUrl.lastIndexOf('/') + 1);
      api.SetWasmPath(wasmDir);
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

/**
 * Parse an IFC file and extract the metadata listed above. Throws with a
 * friendly message if the file is malformed, has no IfcBuilding, or uses
 * an unsupported IFC schema (web-ifc covers IFC2x3 and IFC4 — anything
 * older is rare in modern files).
 */
export async function parseIfcMetadata(file: File): Promise<IfcImportMetadata> {
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

    // ── IfcSite georef ────────────────────────────────────────────────
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

    // ── Storey count ──────────────────────────────────────────────────
    const storeys = api.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);
    const storeyCount = Math.max(1, storeys.size());

    // ── Bounding box from streamed geometry ───────────────────────────
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    api.StreamAllMeshes(modelID, (flatMesh) => {
      const placedGeoms = flatMesh.geometries;
      const n = placedGeoms.size();
      for (let i = 0; i < n; i++) {
        const placed = placedGeoms.get(i);
        const geom = api.GetGeometry(modelID, placed.geometryExpressID);
        const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const m = placed.flatTransformation;
        // verts is interleaved: pos(3) + normal(3) per vertex = 6 floats.
        for (let v = 0; v < verts.length; v += 6) {
          const x = verts[v];
          const y = verts[v + 1];
          const z = verts[v + 2];
          // Apply the placement matrix (column-major 4x4).
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          if (wx < minX) minX = wx;
          if (wy < minY) minY = wy;
          if (wz < minZ) minZ = wz;
          if (wx > maxX) maxX = wx;
          if (wy > maxY) maxY = wy;
          if (wz > maxZ) maxZ = wz;
        }
        geom.delete();
      }
    });

    if (minX === Infinity) {
      throw new Error('IFC file contained no triangulatable geometry');
    }

    const entityCount = api.GetAllLines(modelID).size();
    api.CloseModel(modelID);

    return {
      globalId,
      name,
      bbox: { minX, minY, minZ, maxX, maxY, maxZ },
      width: maxX - minX,
      depth: maxY - minY,
      height: maxZ - minZ,
      storeyCount,
      refLat,
      refLon,
      refElevation,
      entityCount,
      parseMs: Math.round(performance.now() - t0),
    };
  } catch (e) {
    api.CloseModel(modelID);
    throw e;
  }
}

/**
 * Convert an IFC's bbox metadata + a placement (centre lng/lat) into a
 * footprint rectangle in WGS84. The footprint is axis-aligned in WGS84 —
 * for v1 we don't try to preserve the IFC's local rotation. Rotating after
 * placement is the user's job (they have the editor's transform tool).
 *
 * The rectangle is centred on `placement` and sized to (width × depth) in
 * metres, projected via small equirectangular approximations. For
 * building-scale (≤ 1 km) this is plenty accurate.
 */
export function buildFootprintFromIfc(
  metadata: IfcImportMetadata,
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

/**
 * IFC stores RefLatitude / RefLongitude as `[degrees, minutes, seconds,
 * (microseconds optional)]`. Convert to a single signed decimal degree.
 * Returns null if the input isn't a usable list.
 */
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
