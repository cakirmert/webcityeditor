import type { Footprint } from './footprints';

/**
 * Compound filter for the building list. Every active filter is AND-ed —
 * a building must match all of them to be included. Empty / undefined
 * fields are no-ops (matches everything).
 *
 * Designed to drive both the toolbar search box (text only, simplest case)
 * and a richer FilterPanel sidebar (multi-criteria). Both feed the same
 * `applyFilter` function so the matching semantics stay consistent.
 */
export interface BuildingFilter {
  /** Free-text search. Substring-matched (case-insensitive) against
   *  CityObject id + every string/number attribute value. Empty string =
   *  no filter. */
  text?: string;
  /** Roof types to include. Empty / undefined = include all. Recognises
   *  both human strings ("gable") and CityGML/3DBAG integer codes (3100). */
  roofTypes?: Set<string>;
  /** Inclusive yearOfConstruction range. Buildings without the attribute
   *  are excluded when either bound is set. */
  yearMin?: number;
  yearMax?: number;
  /** Inclusive measuredHeight range (metres). Buildings without the
   *  attribute are excluded when either bound is set. */
  heightMin?: number;
  heightMax?: number;
}

/** Returns true iff the filter has no active criteria. Used to short-circuit
 *  the map's dimming layer (no point recomputing the predicate per-feature
 *  if every feature passes). */
export function isFilterEmpty(f: BuildingFilter | null | undefined): boolean {
  if (!f) return true;
  if (f.text && f.text.trim().length > 0) return false;
  if (f.roofTypes && f.roofTypes.size > 0) return false;
  if (f.yearMin !== undefined || f.yearMax !== undefined) return false;
  if (f.heightMin !== undefined || f.heightMax !== undefined) return false;
  return true;
}

/** Test a single Footprint against the filter. */
export function matchesFilter(fp: Footprint, f: BuildingFilter): boolean {
  if (f.text) {
    const needle = f.text.trim().toLowerCase();
    if (needle.length > 0 && !textMatches(fp, needle)) return false;
  }
  if (f.roofTypes && f.roofTypes.size > 0) {
    const rt = fp.attributes?.roofType;
    const key =
      typeof rt === 'string'
        ? rt.toLowerCase()
        : typeof rt === 'number'
          ? String(rt)
          : null;
    if (key === null || !f.roofTypes.has(key)) return false;
  }
  if (f.yearMin !== undefined || f.yearMax !== undefined) {
    const y = readNumber(fp.attributes?.yearOfConstruction);
    if (y === null) return false;
    if (f.yearMin !== undefined && y < f.yearMin) return false;
    if (f.yearMax !== undefined && y > f.yearMax) return false;
  }
  if (f.heightMin !== undefined || f.heightMax !== undefined) {
    const h =
      readNumber(fp.attributes?.measuredHeight) ?? readNumber(fp.height);
    if (h === null) return false;
    if (f.heightMin !== undefined && h < f.heightMin) return false;
    if (f.heightMax !== undefined && h > f.heightMax) return false;
  }
  return true;
}

/** Apply a filter to a list of Footprints. Returns the matching ones. */
export function applyFilter(footprints: Footprint[], f: BuildingFilter): Footprint[] {
  if (isFilterEmpty(f)) return footprints;
  return footprints.filter((fp) => matchesFilter(fp, f));
}

/** Return the set of CityObject ids that match a filter — convenient for
 *  the map's "dim non-matches" overlay (faster than O(N) lookups). */
export function matchingIds(footprints: Footprint[], f: BuildingFilter): Set<string> {
  if (isFilterEmpty(f)) return new Set(footprints.map((fp) => fp.id));
  const out = new Set<string>();
  for (const fp of footprints) if (matchesFilter(fp, f)) out.add(fp.id);
  return out;
}

/** Available roof types in the dataset (with human-string + integer-code
 *  duplicates merged) — used to populate the FilterPanel's roof-type
 *  multi-select. Returned in stable insertion order. */
export function uniqueRoofTypes(footprints: Footprint[]): string[] {
  const seen = new Set<string>();
  for (const fp of footprints) {
    const rt = fp.attributes?.roofType;
    const key =
      typeof rt === 'string'
        ? rt.toLowerCase()
        : typeof rt === 'number'
          ? String(rt)
          : null;
    if (key) seen.add(key);
  }
  return [...seen];
}

/** Min/max yearOfConstruction across the dataset, or null if nobody has it. */
export function yearRange(footprints: Footprint[]): { min: number; max: number } | null {
  let min = Infinity,
    max = -Infinity;
  for (const fp of footprints) {
    const y = readNumber(fp.attributes?.yearOfConstruction);
    if (y === null) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (min === Infinity) return null;
  return { min, max };
}

/** Min/max measuredHeight across the dataset, or null if nobody has it. */
export function heightRange(footprints: Footprint[]): { min: number; max: number } | null {
  let min = Infinity,
    max = -Infinity;
  for (const fp of footprints) {
    const h = readNumber(fp.attributes?.measuredHeight) ?? readNumber(fp.height);
    if (h === null) continue;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (min === Infinity) return null;
  return { min, max };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function readNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function textMatches(fp: Footprint, needle: string): boolean {
  if (fp.id.toLowerCase().includes(needle)) return true;
  if (!fp.attributes) return false;
  for (const v of Object.values(fp.attributes)) {
    if (typeof v === 'string' && v.toLowerCase().includes(needle)) return true;
    if (typeof v === 'number' && String(v).includes(needle)) return true;
  }
  return false;
}
