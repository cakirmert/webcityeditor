import { describe, expect, it } from 'vitest';
import type { Footprint } from '../../src/lib/footprints';
import {
  normalizeUsage,
  tintByRoofType,
  tintByUsage,
  USAGE_OBJECT_COLORS,
} from '../../src/lib/footprint-tint';

function fp(roofType: string | number | null | undefined): Footprint {
  return {
    id: 'test',
    type: 'Building',
    polygon: [[0, 0, 0]],
    height: 5,
    baseElevation: 0,
    attributes: roofType === undefined ? {} : { roofType },
  };
}

function usageFp(value: string | null | undefined): Footprint {
  return {
    id: 'test',
    type: 'Building',
    polygon: [[0, 0, 0]],
    height: 5,
    baseElevation: 0,
    attributes: value === undefined ? {} : { function: value },
  };
}

describe('tintByRoofType', () => {
  it('passes alpha through unchanged', () => {
    const c = tintByRoofType(fp('flat'), 200);
    expect(c[3]).toBe(200);
    const c2 = tintByRoofType(fp('flat'), 50);
    expect(c2[3]).toBe(50);
  });

  it('maps human-readable roof type strings to distinct RGB tints', () => {
    const flat = tintByRoofType(fp('flat'), 255);
    const gable = tintByRoofType(fp('gable'), 255);
    const hip = tintByRoofType(fp('hip'), 255);
    const pyramid = tintByRoofType(fp('pyramid'), 255);
    const colors = [flat, gable, hip, pyramid].map((c) => c.slice(0, 3).join(','));
    // All four must be unique RGB triples — otherwise we can't visually
    // distinguish roof types on the map.
    expect(new Set(colors).size).toBe(4);
  });

  it('is case-insensitive on string keys (matches "Flat", "GABLE", etc.)', () => {
    expect(tintByRoofType(fp('Flat'), 255)).toEqual(tintByRoofType(fp('flat'), 255));
    expect(tintByRoofType(fp('GABLE'), 255)).toEqual(tintByRoofType(fp('gable'), 255));
  });

  it('maps CityGML/3DBAG integer codes 1000, 3100, 3200, 3400 to the same colours as their string aliases', () => {
    expect(tintByRoofType(fp(1000), 255)).toEqual(tintByRoofType(fp('flat'), 255));
    expect(tintByRoofType(fp(3100), 255)).toEqual(tintByRoofType(fp('gable'), 255));
    expect(tintByRoofType(fp(3200), 255)).toEqual(tintByRoofType(fp('hip'), 255));
    expect(tintByRoofType(fp(3400), 255)).toEqual(tintByRoofType(fp('pyramid'), 255));
  });

  it('also maps shed (2100), mansard (3300), barrel (5100) to distinct colours', () => {
    const shed = tintByRoofType(fp(2100), 255);
    const mansard = tintByRoofType(fp(3300), 255);
    const barrel = tintByRoofType(fp(5100), 255);
    const flat = tintByRoofType(fp('flat'), 255);
    // Each is distinct from the four "common" types and from each other.
    expect(shed).not.toEqual(flat);
    expect(mansard).not.toEqual(shed);
    expect(barrel).not.toEqual(mansard);
  });

  it('falls back to neutral grey when roofType is missing or unknown', () => {
    const fallback: [number, number, number, number] = [200, 200, 210, 230];
    expect(tintByRoofType(fp(undefined), 230)).toEqual(fallback);
    expect(tintByRoofType(fp(null), 230)).toEqual(fallback);
    expect(tintByRoofType(fp('exotic-roof'), 230)).toEqual(fallback);
    expect(tintByRoofType(fp(9999), 230)).toEqual(fallback);
  });

  it('handles strings that match the integer-code spelling (so "1000" → flat)', () => {
    expect(tintByRoofType(fp('1000'), 255)).toEqual(tintByRoofType(fp('flat'), 255));
    expect(tintByRoofType(fp('3100'), 255)).toEqual(tintByRoofType(fp('gable'), 255));
  });
});

describe('tintByUsage', () => {
  it('passes alpha through unchanged', () => {
    expect(tintByUsage(usageFp('residential'), 77)[3]).toBe(77);
    expect(tintByUsage(usageFp('office'), 210)[3]).toBe(210);
  });

  it('maps supported usage values and aliases to distinct colors', () => {
    expect(tintByUsage(usageFp('residential'), 255)).toEqual([240, 220, 60, 255]);
    expect(tintByUsage(usageFp('commercial'), 255)).toEqual([60, 120, 240, 255]);
    expect(tintByUsage(usageFp('shops'), 255)).toEqual(tintByUsage(usageFp('commercial'), 255));
    expect(tintByUsage(usageFp('office'), 255)).toEqual([60, 180, 100, 255]);
    expect(tintByUsage(usageFp('business'), 255)).toEqual(tintByUsage(usageFp('office'), 255));
    expect(tintByUsage(usageFp('industrial'), 255)).toEqual([160, 80, 240, 255]);
    expect(tintByUsage(usageFp('public'), 255)).toEqual([220, 60, 60, 255]);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeUsage(' Office ')).toBe('office');
    expect(normalizeUsage('SHOPS')).toBe('commercial');
  });

  it('maps Hamburg ALKIS function codes to useful colour categories', () => {
    expect(normalizeUsage('31001_1010')).toBe('residential');
    expect(normalizeUsage('31001_1120')).toBe('mixed');
    expect(normalizeUsage('31001_2010')).toBe('commercial');
    expect(normalizeUsage('31001_2020')).toBe('office');
    expect(normalizeUsage('31001_2100')).toBe('industrial');
    expect(normalizeUsage('31001_2310')).toBe('mixed');
    expect(normalizeUsage('31001_3020')).toBe('public');
    expect(tintByUsage(usageFp('31001_2010'), 255)).toEqual([60, 120, 240, 255]);
  });

  it('falls back to neutral grey for missing or unknown usage', () => {
    const fallback: [number, number, number, number] = [200, 200, 210, 230];
    expect(tintByUsage(usageFp(undefined), 230)).toEqual(fallback);
    expect(tintByUsage(usageFp(null), 230)).toEqual(fallback);
    expect(tintByUsage(usageFp('museum'), 230)).toEqual(fallback);
    expect(USAGE_OBJECT_COLORS.unknown).toBe(0xc8c8d2);
  });
});
