import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  heightRange,
  isFilterEmpty,
  matchesFilter,
  matchingIds,
  uniqueRoofTypes,
  yearRange,
} from '../../src/lib/filter';
import type { Footprint } from '../../src/lib/footprints';

function fp(id: string, attrs: Record<string, unknown> = {}): Footprint {
  return {
    id,
    type: 'Building',
    polygon: [[0, 0, 0]],
    height: typeof attrs.measuredHeight === 'number' ? attrs.measuredHeight : 5,
    baseElevation: 0,
    attributes: attrs,
  };
}

const FOOTPRINTS: Footprint[] = [
  fp('Building_A', { roofType: 'flat', yearOfConstruction: 1965, measuredHeight: 8, function: 'residential' }),
  fp('Building_B', { roofType: 'gable', yearOfConstruction: 1898, measuredHeight: 12, function: 'residential' }),
  fp('Building_C', { roofType: 1000, yearOfConstruction: 2010, measuredHeight: 24, function: 'commercial' }),
  fp('Cathedral_Old', { roofType: 'hip', yearOfConstruction: 1320, measuredHeight: 70, function: 'public' }),
  fp('Empty', {}),
];

describe('isFilterEmpty', () => {
  it('returns true for null / undefined / all-empty filters', () => {
    expect(isFilterEmpty(null)).toBe(true);
    expect(isFilterEmpty(undefined)).toBe(true);
    expect(isFilterEmpty({})).toBe(true);
    expect(isFilterEmpty({ text: '' })).toBe(true);
    expect(isFilterEmpty({ text: '   ' })).toBe(true);
    expect(isFilterEmpty({ roofTypes: new Set() })).toBe(true);
  });

  it('returns false when any criterion is active', () => {
    expect(isFilterEmpty({ text: 'church' })).toBe(false);
    expect(isFilterEmpty({ roofTypes: new Set(['gable']) })).toBe(false);
    expect(isFilterEmpty({ yearMin: 1900 })).toBe(false);
    expect(isFilterEmpty({ yearMax: 2000 })).toBe(false);
    expect(isFilterEmpty({ heightMin: 10 })).toBe(false);
    expect(isFilterEmpty({ heightMax: 30 })).toBe(false);
  });
});

describe('matchesFilter / applyFilter — text', () => {
  it('substring matches the building id, case-insensitive', () => {
    const r = applyFilter(FOOTPRINTS, { text: 'CATHEDRAL' });
    expect(r.map((f) => f.id)).toEqual(['Cathedral_Old']);
  });

  it('matches string attribute values too', () => {
    const r = applyFilter(FOOTPRINTS, { text: 'commercial' });
    expect(r.map((f) => f.id)).toEqual(['Building_C']);
  });

  it('matches number attribute values stringified', () => {
    const r = applyFilter(FOOTPRINTS, { text: '1898' });
    expect(r.map((f) => f.id)).toEqual(['Building_B']);
  });

  it('empty / whitespace text matches all', () => {
    expect(applyFilter(FOOTPRINTS, { text: '' })).toEqual(FOOTPRINTS);
    expect(applyFilter(FOOTPRINTS, { text: '   ' })).toEqual(FOOTPRINTS);
  });
});

describe('matchesFilter — roofTypes', () => {
  it('matches human-readable strings', () => {
    const r = applyFilter(FOOTPRINTS, { roofTypes: new Set(['flat', 'hip']) });
    expect(r.map((f) => f.id).sort()).toEqual(['Building_A', 'Cathedral_Old']);
  });

  it('matches CityGML integer codes (stored as numbers in 3DBAG)', () => {
    const r = applyFilter(FOOTPRINTS, { roofTypes: new Set(['1000']) });
    // Building_A has "flat" string; Building_C has 1000 integer. Filter set
    // contains "1000", so only C matches.
    expect(r.map((f) => f.id)).toEqual(['Building_C']);
  });

  it('excludes buildings with no roofType when the filter is active', () => {
    const r = applyFilter(FOOTPRINTS, { roofTypes: new Set(['flat']) });
    expect(r.find((f) => f.id === 'Empty')).toBeUndefined();
  });
});

describe('matchesFilter — year range', () => {
  it('inclusive lower bound', () => {
    const r = applyFilter(FOOTPRINTS, { yearMin: 1900 });
    expect(r.map((f) => f.id).sort()).toEqual(['Building_A', 'Building_C']);
  });

  it('inclusive upper bound', () => {
    const r = applyFilter(FOOTPRINTS, { yearMax: 1900 });
    expect(r.map((f) => f.id).sort()).toEqual(['Building_B', 'Cathedral_Old']);
  });

  it('two-sided range', () => {
    const r = applyFilter(FOOTPRINTS, { yearMin: 1900, yearMax: 2000 });
    expect(r.map((f) => f.id)).toEqual(['Building_A']);
  });

  it('excludes buildings with no yearOfConstruction', () => {
    const r = applyFilter(FOOTPRINTS, { yearMin: 1000 });
    expect(r.find((f) => f.id === 'Empty')).toBeUndefined();
  });
});

describe('matchesFilter — height range', () => {
  it('falls back to fp.height when measuredHeight attr is missing', () => {
    const r = matchesFilter(fp('X', {}), { heightMin: 4, heightMax: 6 });
    expect(r).toBe(true);
  });

  it('respects measuredHeight when present', () => {
    const r = applyFilter(FOOTPRINTS, { heightMin: 50 });
    expect(r.map((f) => f.id)).toEqual(['Cathedral_Old']);
  });
});

describe('matchesFilter — multi-criteria AND', () => {
  it('combines roof type, year, and text', () => {
    const r = applyFilter(FOOTPRINTS, {
      text: 'residential',
      roofTypes: new Set(['flat']),
      yearMin: 1950,
    });
    expect(r.map((f) => f.id)).toEqual(['Building_A']);
  });
});

describe('matchingIds', () => {
  it('returns all ids when filter is empty', () => {
    const ids = matchingIds(FOOTPRINTS, {});
    expect(ids.size).toBe(FOOTPRINTS.length);
  });

  it('returns only matching ids when filter is active', () => {
    const ids = matchingIds(FOOTPRINTS, { roofTypes: new Set(['gable']) });
    expect([...ids]).toEqual(['Building_B']);
  });
});

describe('range helpers', () => {
  it('uniqueRoofTypes returns distinct keys (string keys + int codes both)', () => {
    const t = uniqueRoofTypes(FOOTPRINTS);
    expect(t).toContain('flat');
    expect(t).toContain('gable');
    expect(t).toContain('hip');
    expect(t).toContain('1000');
  });

  it('yearRange returns the dataset bounds', () => {
    const r = yearRange(FOOTPRINTS);
    expect(r).toEqual({ min: 1320, max: 2010 });
  });

  it('heightRange returns the dataset bounds (uses fp.height fallback when measuredHeight is missing)', () => {
    // The "Empty" footprint has no measuredHeight attribute but fp.height=5
    // (default in the test helper), so it correctly contributes 5 to the min.
    const r = heightRange(FOOTPRINTS);
    expect(r).toEqual({ min: 5, max: 70 });
  });

  it('returns null when no buildings have the attribute', () => {
    const r = yearRange([fp('X', {})]);
    expect(r).toBeNull();
  });
});
