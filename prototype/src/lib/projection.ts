import proj4 from 'proj4';
import type { CityJsonDocument } from '../types';

// Common CRS definitions. proj4 has WGS84 (EPSG:4326) built-in but every other
// projected or geocentric CRS must be registered. We keep these in code so the
// app works without any external network call and tests are deterministic.
//
// Scope: everything a European 3D-city-model prototype is likely to encounter.
// Add more as needed — each entry is small.

// Dutch RD New — 3DBAG primary CRS
proj4.defs(
  'EPSG:28992',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs'
);
// RD New + NAP height (compound CRS — 2D identical to EPSG:28992, also widely
// used for CityJSON published with elevation).
proj4.defs(
  'EPSG:7415',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +vunits=m +no_defs'
);
// WGS84 geocentric (ECEF) — used by Cesium-oriented publishers and by some
// CityJSON sample files. Coordinates are 3D Cartesian from Earth centre.
proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs');
// Web Mercator (tile system)
proj4.defs(
  'EPSG:3857',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'
);
// ETRS89 UTM zones covering Germany and surroundings
proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:25834', '+proj=utm +zone=34 +ellps=GRS80 +units=m +no_defs');
// Belgium Lambert 2008
proj4.defs(
  'EPSG:3812',
  '+proj=lcc +lat_1=49.83333333333334 +lat_2=51.16666666666666 +lat_0=50.797815 +lon_0=4.359215833333333 +x_0=649328 +y_0=665262 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);
// Swiss CH1903+
proj4.defs(
  'EPSG:2056',
  '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'
);
// Austria MGI / Austria Lambert
proj4.defs(
  'EPSG:31287',
  '+proj=lcc +lat_1=49 +lat_2=46 +lat_0=47.5 +lon_0=13.33333333333333 +x_0=400000 +y_0=400000 +datum=hermannskogel +units=m +no_defs'
);
// Czech Republic S-JTSK / Krovak East North
proj4.defs(
  'EPSG:5514',
  '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs'
);

/**
 * Codes for CRS that we classify as 3-dimensional (geocentric or compound with
 * vertical). For these we must pass the Z coordinate through proj4, otherwise
 * the horizontal conversion is wrong or returns junk values.
 */
const GEOCENTRIC_OR_COMPOUND_3D = new Set(['EPSG:4978', 'EPSG:7415']);

export interface CrsInfo {
  /** Canonical "EPSG:XXXX" identifier */
  code: string;
  /** true if proj4 has a registered definition for this code */
  supported: boolean;
  /** true if the CRS was guessed from coordinate magnitudes rather than declared */
  inferred?: boolean;
}

/**
 * Detect the projected CRS declared in a CityJSON document. If the metadata
 * doesn't declare one (some citygml-tools output, some hand-authored files),
 * fall back to inferring from the magnitude of transform.translate — works
 * for the most common European CRS we see in practice.
 */
export function detectCrs(doc: CityJsonDocument): CrsInfo {
  const raw = doc.metadata?.referenceSystem;
  if (typeof raw === 'string') {
    const match = raw.match(/EPSG\/\d+\/(\d+)|EPSG:(\d+)/);
    if (match) {
      const code = `EPSG:${match[1] ?? match[2]}`;
      return { code, supported: proj4.defs(code) !== undefined };
    }
  }
  // Heuristic fallback based on transform.translate (the common "origin" of
  // the dataset). These ranges are deliberately loose; if you hit a false
  // positive, set metadata.referenceSystem explicitly in your source file.
  const t = doc.transform?.translate;
  if (t && Number.isFinite(t[0]) && Number.isFinite(t[1])) {
    const [x, y] = t;
    // UTM 32N (most of Germany, Austria, northern Italy)
    if (x > 300_000 && x < 900_000 && y > 5_000_000 && y < 6_400_000) {
      return { code: 'EPSG:25832', supported: true, inferred: true };
    }
    // UTM 33N (eastern Germany, Poland)
    if (x > 200_000 && x < 900_000 && y > 5_800_000 && y < 7_300_000) {
      return { code: 'EPSG:25833', supported: true, inferred: true };
    }
    // Dutch RD New
    if (x > -7_000 && x < 300_000 && y > 300_000 && y < 620_000) {
      return { code: 'EPSG:28992', supported: true, inferred: true };
    }
  }
  return { code: 'UNKNOWN', supported: false };
}

export interface CityCoord {
  /** Projected meters in the source CRS */
  x: number;
  y: number;
  z: number;
}

/** Apply CityJSON vertex transform: real = int * scale + translate */
export function applyVertexTransform(
  vertex: [number, number, number],
  doc: CityJsonDocument
): CityCoord {
  const t = doc.transform;
  if (!t) return { x: vertex[0], y: vertex[1], z: vertex[2] };
  return {
    x: vertex[0] * t.scale[0] + t.translate[0],
    y: vertex[1] * t.scale[1] + t.translate[1],
    z: vertex[2] * t.scale[2] + t.translate[2],
  };
}

/** Compute the CityJSON dataset's bounding box in projected CRS. */
export function computeBbox(doc: CityJsonDocument) {
  if (doc.vertices.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const v of doc.vertices) {
    const c = applyVertexTransform(v as [number, number, number], doc);
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.z < minZ) minZ = c.z;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
    if (c.z > maxZ) maxZ = c.z;
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

export interface CrsOrigin {
  /** Projected CRS coords of the dataset centroid */
  projected: CityCoord;
  /** WGS84 lng/lat of the same point, only present if CRS is supported */
  lngLat: [number, number] | null;
}

export function computeOrigin(doc: CityJsonDocument): CrsOrigin {
  const bbox = computeBbox(doc);
  const projected: CityCoord = {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: bbox.min.z, // ground level of the dataset
  };
  const crs = detectCrs(doc);
  if (!crs.supported) return { projected, lngLat: null };
  try {
    const lngLat = projectToWgs84(crs.code, projected);
    return { projected, lngLat };
  } catch {
    return { projected, lngLat: null };
  }
}

/**
 * Convert a point from its projected CRS to WGS84 (lng, lat).
 * For geocentric or compound-3D CRS (EPSG:4978, 7415) the Z coordinate is passed
 * through proj4, which matters a lot — ECEF coords require all three axes.
 */
export function projectToWgs84(code: string, coord: CityCoord): [number, number] {
  if (GEOCENTRIC_OR_COMPOUND_3D.has(code)) {
    const result = proj4(code, 'EPSG:4326', [coord.x, coord.y, coord.z]) as
      | [number, number]
      | [number, number, number];
    return [result[0], result[1]];
  }
  const [lng, lat] = proj4(code, 'EPSG:4326', [coord.x, coord.y]) as [number, number];
  return [lng, lat];
}

/** Bulk convert all CityJSON vertices to lng/lat/elev (in WGS84). Slow but simple. */
export function verticesToLngLat(
  doc: CityJsonDocument
): { lng: number; lat: number; elev: number }[] | null {
  const crs = detectCrs(doc);
  if (!crs.supported) return null;
  return doc.vertices.map((v) => {
    const c = applyVertexTransform(v as [number, number, number], doc);
    const [lng, lat] = projectToWgs84(crs.code, c);
    return { lng, lat, elev: c.z };
  });
}
