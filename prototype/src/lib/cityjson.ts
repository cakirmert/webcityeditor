import type { AttributeValue, CityJsonDocument } from '../types';

export type ValidationResult =
  | { ok: true; doc: CityJsonDocument }
  | { ok: false; error: string };

/**
 * Validate that a parsed JSON object is a CityJSON document we can handle.
 * Does not run cjio-level schema validation — we check the structural minimums
 * the renderer and edit pipeline need.
 */
export function validateCityJson(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Not an object' };
  }
  const d = data as Record<string, unknown>;
  if (d.type !== 'CityJSON') {
    return {
      ok: false,
      error: `Not a CityJSON document (type is "${String(d.type)}", expected "CityJSON")`,
    };
  }
  if (typeof d.version !== 'string') {
    return { ok: false, error: 'Missing or invalid "version" field' };
  }
  if (!d.CityObjects || typeof d.CityObjects !== 'object') {
    return { ok: false, error: 'Missing "CityObjects"' };
  }
  if (!Array.isArray(d.vertices)) {
    return { ok: false, error: 'Missing "vertices" array' };
  }
  return { ok: true, doc: data as CityJsonDocument };
}

/** Parse raw text and validate in one step. */
export function parseCityJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return validateCityJson(parsed);
}

/**
 * Return the set of IDs that are root top-level buildings (no parent).
 * Filters out BuildingParts and non-building objects.
 */
export function rootBuildingIds(doc: CityJsonDocument): string[] {
  return Object.keys(doc.CityObjects).filter((id) => {
    const o = doc.CityObjects[id];
    return (
      (o.type === 'Building' ||
        o.type === 'Bridge' ||
        o.type === 'CityObjectGroup' ||
        o.type === 'Tunnel') &&
      !o.parents
    );
  });
}

/**
 * Apply an attribute edit in place on a CityJSON document.
 * Returns true if the document was actually mutated.
 */
export function setAttribute(
  doc: CityJsonDocument,
  objectId: string,
  key: string,
  value: AttributeValue
): boolean {
  const obj = doc.CityObjects[objectId];
  if (!obj) return false;
  if (!obj.attributes) obj.attributes = {};
  if (obj.attributes[key] === value) return false;
  obj.attributes[key] = value;
  return true;
}

/**
 * Compute attribute-level diff between two CityJSON snapshots.
 * Used in tests and to surface "what changed" to the user.
 */
export interface AttrDiff {
  objectId: string;
  key: string;
  before: AttributeValue;
  after: AttributeValue;
}

export function diffAttributes(
  before: CityJsonDocument,
  after: CityJsonDocument
): AttrDiff[] {
  const diffs: AttrDiff[] = [];
  const ids = new Set([
    ...Object.keys(before.CityObjects),
    ...Object.keys(after.CityObjects),
  ]);
  for (const id of ids) {
    const b = before.CityObjects[id]?.attributes ?? {};
    const a = after.CityObjects[id]?.attributes ?? {};
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const k of keys) {
      if (b[k] !== a[k]) {
        diffs.push({ objectId: id, key: k, before: b[k], after: a[k] });
      }
    }
  }
  return diffs;
}

/**
 * Build a tiny in-memory CityJSON 2.0 sample (one cube with semantic surfaces).
 * Used by the "sample" button and by tests.
 */
export function buildSampleCube(): CityJsonDocument {
  // A 10 × 8 × 10 m cube placed at TU Delft campus in EPSG:28992 (Dutch RD New).
  // Vertices are stored as millimetre integers (scale 0.001) translated to Delft.
  // translate = [85000, 447000, 0] means vertex 0 sits at (85000m, 447000m) in RD,
  // which projects to roughly lng 4.3571, lat 52.0116 (Delft), lining up with OSM tiles.
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [0.001, 0.001, 0.001], translate: [85000, 447000, 0] },
    metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/28992' },
    CityObjects: {
      Building_A: {
        type: 'Building',
        attributes: {
          measuredHeight: 10.0,
          yearOfConstruction: 1965,
          storeysAboveGround: 3,
          function: 'residential',
        },
        geometry: [
          {
            type: 'Solid',
            lod: '2.2',
            boundaries: [
              [
                [[0, 3, 2, 1]],
                [[4, 5, 6, 7]],
                [[0, 1, 5, 4]],
                [[1, 2, 6, 5]],
                [[2, 3, 7, 6]],
                [[3, 0, 4, 7]],
              ],
            ],
            semantics: {
              surfaces: [
                { type: 'GroundSurface' },
                { type: 'RoofSurface' },
                { type: 'WallSurface' },
              ],
              values: [[0, 1, 2, 2, 2, 2]],
            },
          },
        ],
      },
    },
    vertices: [
      [0, 0, 0],
      [10000, 0, 0],
      [10000, 8000, 0],
      [0, 8000, 0],
      [0, 0, 10000],
      [10000, 0, 10000],
      [10000, 8000, 10000],
      [0, 8000, 10000],
    ],
  };
}

/** Human-friendly short CRS display ("EPSG:4978" from full OGC URL). */
export function shortCrs(crs: string): string {
  const m = crs.match(/EPSG\/\d+\/(\d+)/);
  if (m) return `EPSG:${m[1]}`;
  return crs.length > 30 ? crs.slice(-20) : crs;
}
