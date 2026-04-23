import type { AttributeValue, CityJsonDocument, CityObject } from '../types';

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
 * Auto-detect between monolithic CityJSON and CityJSONSeq (one JSON per line,
 * first line = header, subsequent lines = CityJSONFeature) and parse
 * accordingly, assembling into a single in-memory CityJsonDocument.
 *
 * Use this from the FileLoader; it replaces the plain `parseCityJson` call and
 * handles both formats transparently.
 */
export function parseCityJsonAuto(text: string, limitFeatures?: number): ValidationResult {
  // Heuristic: if the first newline-trimmed line parses as a CityJSON header
  // AND there's a second non-empty line, treat as CityJSONSeq.
  const firstNewline = text.indexOf('\n');
  if (firstNewline < 0) return parseCityJson(text);

  const firstLine = text.slice(0, firstNewline).trim();
  const rest = text.slice(firstNewline + 1);
  const restHasLine = rest.trim().length > 0;
  if (!restHasLine) return parseCityJson(text);

  let header: unknown;
  try {
    header = JSON.parse(firstLine);
  } catch {
    // Not valid JSON on line 1 — fall back to treating whole file as monolithic
    return parseCityJson(text);
  }
  if (
    typeof header !== 'object' ||
    header === null ||
    (header as { type?: unknown }).type !== 'CityJSON'
  ) {
    return parseCityJson(text);
  }

  return parseCityJsonSeq(text, limitFeatures);
}

/**
 * Parse a CityJSONSeq file (newline-delimited: header + N CityJSONFeatures)
 * into a single merged CityJsonDocument.
 *
 * Each CityJSONFeature has its own local `vertices` array; we rewrite its
 * geometry boundaries to reference a combined global vertices array. For
 * feature counts into the thousands this is fine in memory; above that,
 * pass `limitFeatures` to load only the first N.
 */
export function parseCityJsonSeq(text: string, limitFeatures?: number): ValidationResult {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    return { ok: false, error: 'Empty file' };
  }

  let header: CityJsonDocument;
  try {
    const parsed = JSON.parse(lines[0]) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { type?: unknown }).type !== 'CityJSON'
    ) {
      return { ok: false, error: 'First line is not a CityJSON header' };
    }
    header = parsed as CityJsonDocument;
  } catch (e) {
    return {
      ok: false,
      error: `Header parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const doc: CityJsonDocument = {
    type: 'CityJSON',
    version: header.version,
    metadata: header.metadata,
    transform: header.transform,
    CityObjects: { ...(header.CityObjects ?? {}) },
    vertices: [...(header.vertices ?? [])],
  };

  let featureCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (limitFeatures !== undefined && featureCount >= limitFeatures) break;
    const raw = lines[i].trim();
    if (!raw) continue;
    let feature: {
      type?: string;
      CityObjects?: Record<string, CityObject>;
      vertices?: [number, number, number][];
    };
    try {
      feature = JSON.parse(raw);
    } catch {
      continue; // Skip malformed lines rather than failing the whole load
    }
    if (feature.type !== 'CityJSONFeature' || !feature.CityObjects) continue;

    const offset = doc.vertices.length;
    if (feature.vertices && feature.vertices.length > 0) {
      for (const v of feature.vertices) doc.vertices.push(v);
    }

    for (const [id, obj] of Object.entries(feature.CityObjects)) {
      if (offset > 0 && obj.geometry) {
        obj.geometry = (obj.geometry as unknown[]).map((g) =>
          shiftGeometryIndices(g, offset)
        );
      }
      doc.CityObjects[id] = obj;
    }
    featureCount++;
  }

  return { ok: true, doc };
}

/**
 * Walk a CityJSON geometry's boundaries (arrays of arrays of numbers) and add
 * `offset` to every leaf number. Used when merging CityJSONSeq features into a
 * single vertex array.
 */
function shiftGeometryIndices(geom: unknown, offset: number): unknown {
  if (geom == null || typeof geom !== 'object') return geom;
  const g = geom as { boundaries?: unknown; [k: string]: unknown };
  if (g.boundaries !== undefined) {
    return { ...g, boundaries: shiftBoundary(g.boundaries, offset) };
  }
  return geom;
}

function shiftBoundary(node: unknown, offset: number): unknown {
  if (!Array.isArray(node)) return node;
  return node.map((item) => (typeof item === 'number' ? item + offset : shiftBoundary(item, offset)));
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
