import { describe, expect, it } from 'vitest';
import {
  buildSampleCube,
  diffAttributes,
  parseCityJson,
  setAttribute,
} from './cityjson';

/**
 * These tests validate the core promise of the prototype:
 * CityJSON → edit in memory → serialize → parse → changes persist.
 * If these pass, the save-and-reopen loop in the UI is guaranteed to work.
 */

describe('CityJSON edit round-trip', () => {
  it('preserves attribute edits through JSON.stringify → parseCityJson', () => {
    const doc = buildSampleCube();
    setAttribute(doc, 'Building_A', 'measuredHeight', 25.5);
    setAttribute(doc, 'Building_A', 'yearOfConstruction', 2026);

    const text = JSON.stringify(doc);
    const parsed = parseCityJson(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(25.5);
    expect(parsed.doc.CityObjects.Building_A.attributes?.yearOfConstruction).toBe(2026);
  });

  it('preserves geometry untouched when only attributes are edited', () => {
    const doc = buildSampleCube();
    const originalGeom = JSON.stringify(doc.CityObjects.Building_A.geometry);
    const originalVertices = JSON.stringify(doc.vertices);

    setAttribute(doc, 'Building_A', 'measuredHeight', 12.3);

    const text = JSON.stringify(doc);
    const parsed = parseCityJson(text);
    if (!parsed.ok) throw new Error(parsed.error);

    expect(JSON.stringify(parsed.doc.CityObjects.Building_A.geometry)).toBe(originalGeom);
    expect(JSON.stringify(parsed.doc.vertices)).toBe(originalVertices);
  });

  it('preserves version and CRS metadata after round-trip', () => {
    const doc = buildSampleCube();
    const expectedCrs = doc.metadata?.referenceSystem;
    const text = JSON.stringify(doc);
    const parsed = parseCityJson(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.doc.version).toBe('2.0');
    expect(parsed.doc.metadata?.referenceSystem).toBe(expectedCrs);
    // Sample cube should land in an EPSG:289xx (RD New) — sanity-check pattern
    expect(parsed.doc.metadata?.referenceSystem).toMatch(/EPSG\/0\/28992/);
  });

  it('handles adding brand new attributes that were not in the original', () => {
    const doc = buildSampleCube();
    setAttribute(doc, 'Building_A', 'customAttr', 'hello world');
    setAttribute(doc, 'Building_A', 'numericNew', 3.14);

    const text = JSON.stringify(doc);
    const parsed = parseCityJson(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.doc.CityObjects.Building_A.attributes?.customAttr).toBe('hello world');
    expect(parsed.doc.CityObjects.Building_A.attributes?.numericNew).toBe(3.14);
  });

  it('diffAttributes reports exactly the changes made', () => {
    const original = buildSampleCube();
    const modified = JSON.parse(JSON.stringify(original));

    setAttribute(modified, 'Building_A', 'measuredHeight', 50);
    setAttribute(modified, 'Building_A', 'function', 'commercial');

    const diffs = diffAttributes(original, modified);
    expect(diffs).toHaveLength(2);
    const keys = diffs.map((d) => d.key).sort();
    expect(keys).toEqual(['function', 'measuredHeight']);
  });

  it('handles the "edit, save, re-open, edit again" cycle', () => {
    // Round 1: edit and serialize
    let doc = buildSampleCube();
    setAttribute(doc, 'Building_A', 'measuredHeight', 20);
    const round1Text = JSON.stringify(doc);

    // Simulate user downloading and re-uploading
    const parsed1 = parseCityJson(round1Text);
    if (!parsed1.ok) throw new Error(parsed1.error);
    doc = parsed1.doc;

    // Round 2: edit again and serialize
    setAttribute(doc, 'Building_A', 'measuredHeight', 30);
    setAttribute(doc, 'Building_A', 'storeysAboveGround', 5);
    const round2Text = JSON.stringify(doc);

    const parsed2 = parseCityJson(round2Text);
    if (!parsed2.ok) throw new Error(parsed2.error);
    expect(parsed2.doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(30);
    expect(parsed2.doc.CityObjects.Building_A.attributes?.storeysAboveGround).toBe(5);
  });
});
