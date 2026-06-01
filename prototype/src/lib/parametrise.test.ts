import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../types';
import { buildSampleCube } from './cityjson';
import {
  inferParametricAttrs,
  parametriseBuilding,
  normaliseRoofType,
} from './parametrise';
import { regenerateBuilding } from './regenerate';
import { checkIntegrity } from './integrity';
import './projection';

function findBuildingId(doc: CityJsonDocument): string {
  return Object.keys(doc.CityObjects).find(
    (k) => doc.CityObjects[k].type === 'Building'
  )!;
}

describe('normaliseRoofType', () => {
  it('passes through known string values', () => {
    expect(normaliseRoofType('flat')).toBe('flat');
    expect(normaliseRoofType('gable')).toBe('gable');
    expect(normaliseRoofType('hip')).toBe('hip');
    expect(normaliseRoofType('pyramid')).toBe('pyramid');
  });

  it('lowercases input strings', () => {
    expect(normaliseRoofType('Gable')).toBe('gable');
    expect(normaliseRoofType('FLAT')).toBe('flat');
  });

  it('maps the CityGML/3DBAG integer codes', () => {
    expect(normaliseRoofType(1000)).toBe('flat');
    expect(normaliseRoofType(3100)).toBe('gable');
    expect(normaliseRoofType(3200)).toBe('hip');
    expect(normaliseRoofType(3400)).toBe('pyramid');
  });

  it("normalises 'pyramidal' to 'pyramid'", () => {
    expect(normaliseRoofType('pyramidal')).toBe('pyramid');
  });

  it('falls back to flat for unknown values', () => {
    expect(normaliseRoofType(null)).toBe('flat');
    expect(normaliseRoofType(undefined)).toBe('flat');
    expect(normaliseRoofType('weird-string')).toBe('flat');
    expect(normaliseRoofType(9999)).toBe('flat');
  });
});

describe('inferParametricAttrs', () => {
  it('infers footprint + base/eave/ridge from the sample-cube doc', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    const r = inferParametricAttrs(doc, id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.footprintWgs84.length).toBeGreaterThanOrEqual(3);
    expect(r.params.baseElevation).toBeCloseTo(0, 2); // sample-cube ground at Z=0
    expect(r.params.eaveHeight).toBeGreaterThan(0);
    expect(r.params.ridgeHeight).toBeGreaterThan(0);
    expect(r.params.ridgeHeight).toBeGreaterThanOrEqual(r.params.eaveHeight);
  });

  it('returns ok: false when the object id does not exist', () => {
    const doc = buildSampleCube();
    const r = inferParametricAttrs(doc, 'no-such-id');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/not found/i);
  });

  it("respects the building's roofType attribute (CityGML int code → enum)", () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    doc.CityObjects[id].attributes = {
      ...(doc.CityObjects[id].attributes ?? {}),
      roofType: 3100, // gable
    };
    const r = inferParametricAttrs(doc, id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.params.roofType).toBe('gable');
  });

  it("respects the building's roofType string attribute", () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    doc.CityObjects[id].attributes = {
      ...(doc.CityObjects[id].attributes ?? {}),
      roofType: 'hip',
    };
    const r = inferParametricAttrs(doc, id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.params.roofType).toBe('hip');
  });

  it('uses measuredHeight attribute over vertex analysis when present', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    // The sample cube is 10 m tall; force a much taller measuredHeight to
    // prove the attribute is preferred.
    doc.CityObjects[id].attributes = {
      ...(doc.CityObjects[id].attributes ?? {}),
      measuredHeight: 25,
    };
    const r = inferParametricAttrs(doc, id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.params.ridgeHeight).toBeCloseTo(25, 1);
  });

  it('uses storeysAboveGround attribute when present, else estimates', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    doc.CityObjects[id].attributes = {
      ...(doc.CityObjects[id].attributes ?? {}),
      storeysAboveGround: 7,
    };
    const r = inferParametricAttrs(doc, id);
    if (!r.ok) throw new Error(r.reason);
    expect(r.params.storeys).toBe(7);
  });
});

describe('parametriseBuilding', () => {
  it('rewrites the imported building so regenerate can run on it', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    // Confirm regenerate refuses on the doc as-is — sample cube is imported,
    // has no `_eaveHeight` private attribute.
    const before = regenerateBuilding(doc, id, [
      [4.3571, 52.0116],
      [4.35734, 52.0116],
      [4.35734, 52.0117],
      [4.3571, 52.0117],
    ]);
    expect(before.ok).toBe(false);
    if (before.ok) return;
    // Either the gate rejected on parametric-data missing OR the "imported
    // buildings keep their geometry" message — both are valid "not editable"
    // signals from the regenerate path. The test only cares that it failed.
    expect(before.reason).toBeTruthy();

    // Parametrise → re-attempt regenerate → should now succeed.
    const p = parametriseBuilding(doc, id);
    expect(p.ok).toBe(true);
    const after = regenerateBuilding(doc, id, [
      [4.3571, 52.0116],
      [4.35734, 52.0116],
      [4.35734, 52.0117],
      [4.3571, 52.0117],
    ]);
    expect(after.ok).toBe(true);
  });

  it('appends replacement vertices so promotion is structurally valid immediately', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    const before = doc.vertices.length;

    const r = parametriseBuilding(doc, id);

    expect(r.ok).toBe(true);
    expect(doc.vertices.length).toBeGreaterThan(before);
    expect(checkIntegrity(doc).ok).toBe(true);
  });

  it('preserves the building id while consuming replaced child parts', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    const childId = 'TestChild';
    doc.CityObjects[id].children = [childId];
    doc.CityObjects[childId] = {
      type: 'BuildingPart',
      parents: [id],
      attributes: {},
    };

    const r = parametriseBuilding(doc, id);
    expect(r.ok).toBe(true);
    expect(doc.CityObjects[id]).toBeDefined();
    expect(doc.CityObjects[id].children).toBeUndefined();
    expect(doc.CityObjects[childId]).toBeUndefined();
    expect(checkIntegrity(doc).ok).toBe(true);
  });

  it('promotes an imported hierarchy whose geometry lives only on a BuildingPart', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    const originalGeometry = doc.CityObjects[id].geometry;
    doc.CityObjects[id].geometry = [];
    doc.CityObjects[id].children = ['DelegatedPart'];
    doc.CityObjects[id].attributes = { function: 'residential' };
    doc.CityObjects.DelegatedPart = {
      type: 'BuildingPart',
      parents: [id],
      attributes: {
        measuredHeight: 10,
        storeysAboveGround: 3,
        roofType: 1000,
      },
      geometry: originalGeometry,
    };

    const r = parametriseBuilding(doc, id);

    expect(r.ok).toBe(true);
    expect(doc.CityObjects.DelegatedPart).toBeUndefined();
    expect(doc.CityObjects[id].children).toBeUndefined();
    expect(doc.CityObjects[id].attributes?._createdBy).toBe('city-editor-prototype');
    expect(checkIntegrity(doc).ok).toBe(true);
  });

  it('preserves user-visible attributes (function, year, etc.)', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    doc.CityObjects[id].attributes = {
      ...(doc.CityObjects[id].attributes ?? {}),
      function: 'commercial',
      yearOfConstruction: 1990,
    };
    parametriseBuilding(doc, id);
    expect(doc.CityObjects[id].attributes?.function).toBe('commercial');
    expect(doc.CityObjects[id].attributes?.yearOfConstruction).toBe(1990);
  });

  it('returns ok: false for an unknown id', () => {
    const doc = buildSampleCube();
    const r = parametriseBuilding(doc, 'no-such-id');
    expect(r.ok).toBe(false);
  });

  it('respects roofType override when supplied', () => {
    const doc = buildSampleCube();
    const id = findBuildingId(doc);
    const r = parametriseBuilding(doc, id, { roofType: 'gable' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.roofType).toBe('gable');
  });
});
