import proj4 from 'proj4';
import type { CityJsonDocument, CityObject } from '../types';
import {
  classifyTriangleSurface,
  type CitySurfaceType,
  type IfcImportResult,
} from './ifc-import';
import { detectCrs } from './projection';

export interface IfcConversionResult {
  /** Stable id assigned to the new CityObject. */
  id: string;
  /** The CityObject to insert into doc.CityObjects. */
  cityObject: CityObject;
  /** New vertices (integer-encoded per doc.transform) to append to doc.vertices. */
  newVertices: [number, number, number][];
  /** Vertex offset where the new vertices start. */
  vertexOffset: number;
}

/**
 * Convert a parsed IFC into a CityJSON Building, anchored at a user-clicked
 * lng/lat. The result keeps the IFC's full triangulated geometry — it's
 * emitted as an LoD 3 MultiSurface with each triangle tagged
 * GroundSurface / RoofSurface / WallSurface based on its face normal.
 *
 * A **separate LoD 1 footprint face** is emitted FIRST in the geometry array.
 * This is a single rectangular GroundSurface (the IFC's XY bbox) that
 * `extractFootprints` will pick up to render the map outline. Without it, the
 * map's footprint extractor would land on a tiny triangle from the LoD 3
 * mesh and the building wouldn't show as a clean rectangle on the map.
 *
 * Coordinate handling:
 *   - The IFC mesh comes in centred on its XY bbox-centre (per parseIfc).
 *   - We project the user's clicked WGS84 → the doc's CRS to get a metric
 *     anchor point in the same space the doc's vertices live in.
 *   - We add the IFC's local (centred) X/Y to that anchor; Z is shifted so
 *     the IFC's `minZ` lands at z = 0 (sitting on the ground).
 *   - Finally each (X, Y, Z) is integer-encoded via doc.transform so the
 *     existing renderer pipeline picks it up unchanged.
 */
export function convertIfcToCityJsonBuilding(
  doc: CityJsonDocument,
  ifc: IfcImportResult,
  placementWgs84: [number, number],
  fileName: string
): IfcConversionResult {
  const crs = detectCrs(doc);
  if (!crs.supported) {
    throw new Error(`Cannot place IFC: doc CRS ${crs.code} not supported by proj4`);
  }
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  // Project the placement point → projected metric coords (matches doc's vertices).
  const [anchorX, anchorY] = proj4('EPSG:4326', crs.code, placementWgs84) as [number, number];
  // Shift Z so the IFC's lowest vertex sits at z=0 in the doc's frame.
  const zShift = -ifc.bbox.minZ;

  const toInt = (x: number, y: number, z: number): [number, number, number] => [
    Math.round((x - t.translate[0]) / t.scale[0]),
    Math.round((y - t.translate[1]) / t.scale[1]),
    Math.round((z - t.translate[2]) / t.scale[2]),
  ];

  const newVertices: [number, number, number][] = [];
  const vertexOffset = doc.vertices.length;

  // ── 1. Footprint rectangle (LoD 1, GroundSurface) ─────────────────────
  // 4 corners CCW from above at z=0. extractFootprints picks the FIRST
  // GroundSurface it finds; emitting the rectangle as geometry[0] makes it
  // win over the per-triangle GroundSurfaces in the LoD 3 mesh below.
  const halfW = ifc.width / 2;
  const halfD = ifc.depth / 2;
  const fpCorners: [number, number, number][] = [
    [anchorX - halfW, anchorY - halfD, 0],
    [anchorX + halfW, anchorY - halfD, 0],
    [anchorX + halfW, anchorY + halfD, 0],
    [anchorX - halfW, anchorY + halfD, 0],
  ];
  const fpStart = newVertices.length;
  for (const [x, y, z] of fpCorners) newVertices.push(toInt(x, y, z));
  const fpRing = [0, 1, 2, 3].map((i) => vertexOffset + fpStart + i);
  // Reverse to CCW-from-below = ground orientation per CityJSON convention.
  const groundRing = fpRing.slice().reverse();

  // ── 2. IFC mesh vertices (LoD 3 MultiSurface) ─────────────────────────
  const meshStartLocal = newVertices.length;
  const verts = ifc.vertices;
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i] + anchorX;
    const y = verts[i + 1] + anchorY;
    const z = verts[i + 2] + zShift;
    newVertices.push(toInt(x, y, z));
  }
  const meshOffset = vertexOffset + meshStartLocal;

  // Triangulated faces — one face per triangle, single ring of 3 verts.
  // Each face is tagged with a CityJSON 2.0 semantic surface type derived
  // from BOTH the IFC source class AND the triangle's Z position relative
  // to the mesh's own Z extrema (used for IfcSlab that lacks a useful
  // PredefinedType).
  const triCount = ifc.indices.length / 3;
  const meshFaces: number[][] = [];
  const meshFaceSemantics: number[] = [];
  const surfaceTypeOrder: CitySurfaceType[] = [
    'GroundSurface',
    'RoofSurface',
    'WallSurface',
    'Window',
    'Door',
  ];
  const idxFor: Record<CitySurfaceType, number> = {
    GroundSurface: 0,
    RoofSurface: 1,
    WallSurface: 2,
    Window: 3,
    Door: 4,
  };

  // Mesh-frame Z extrema (post-zShift): floor sits at z=0 by construction,
  // ridge / parapet at z = ifc.height. Pass these to the classifier so a
  // generic IfcSlab whose PredefinedType we couldn't recover still ends up
  // tagged correctly when it sits at one of the building's vertical limits.
  const meshBottomZ = 0;
  const meshTopZ = ifc.height;

  for (let t2 = 0; t2 < triCount; t2++) {
    const i0 = ifc.indices[t2 * 3];
    const i1 = ifc.indices[t2 * 3 + 1];
    const i2 = ifc.indices[t2 * 3 + 2];
    meshFaces.push([meshOffset + i0, meshOffset + i1, meshOffset + i2]);
    const nz = ifc.triangleNormals[t2 * 3 + 2];
    // Triangle centroid Z (in the post-shift frame, where ifc.bbox.minZ → 0).
    const centerZ =
      (ifc.vertices[i0 * 3 + 2] +
        ifc.vertices[i1 * 3 + 2] +
        ifc.vertices[i2 * 3 + 2]) /
        3 +
      zShift;
    const cls = ifc.triangleSourceClass[t2];
    const sem = classifyTriangleSurface(cls, nz, centerZ, meshTopZ, meshBottomZ);
    meshFaceSemantics.push(idxFor[sem]);
  }

  // ── 3. CityObject ─────────────────────────────────────────────────────
  const id = `ifc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const cityObject: CityObject = {
    type: 'Building',
    attributes: {
      function: 'mixed',
      measuredHeight: ifc.height,
      storeysAboveGround: ifc.storeyCount,
      _createdBy: 'city-editor-prototype',
      _createdAt: new Date().toISOString(),
      _ifcSource: fileName,
      _ifcGlobalId: ifc.globalId,
      _ifcName: ifc.name,
      _ifcWidth: ifc.width,
      _ifcDepth: ifc.depth,
      _ifcHeight: ifc.height,
      _ifcStoreyCount: ifc.storeyCount,
      _ifcTriangleCount: triCount,
      ...(ifc.refLat !== null
        ? { _ifcRefLatitude: ifc.refLat, _ifcRefLongitude: ifc.refLon }
        : {}),
    },
    geometry: [
      // [0] LoD 1.0 footprint — single GroundSurface face for the map's
      // extractFootprints to pin onto. No walls/roof, just the rectangle.
      {
        type: 'MultiSurface',
        lod: '1.0',
        boundaries: [[groundRing]],
        semantics: {
          surfaces: [{ type: 'GroundSurface' }],
          values: [0],
        },
      } as unknown,
      // [1] LoD 3.0 — the actual IFC triangulated mesh, semantically tagged
      // using both IFC source class and triangle position (for slabs).
      {
        type: 'MultiSurface',
        lod: '3.0',
        boundaries: meshFaces.map((f) => [f]),
        semantics: {
          surfaces: surfaceTypeOrder.map((t) => ({ type: t })),
          values: meshFaceSemantics,
        },
      } as unknown,
    ] as unknown[],
  };

  return { id, cityObject, newVertices, vertexOffset };
}
