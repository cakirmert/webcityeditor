import { describe, expect, it } from 'vitest';
import {
  buildSampleCube,
  diffAttributes,
  parseCityJson,
  rootBuildingIds,
  setAttribute,
  shortCrs,
  validateCityJson,
} from './cityjson';
import type { CityJsonDocument } from '../types';

describe('validateCityJson', () => {
  it('accepts a valid CityJSON 2.0 document', () => {
    const result = validateCityJson(buildSampleCube());
    expect(result.ok).toBe(true);
  });

  it('rejects null', () => {
    const result = validateCityJson(null);
    expect(result.ok).toBe(false);
  });

  it('rejects a plain object without the CityJSON type', () => {
    const result = validateCityJson({ foo: 'bar' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CityJSON/);
  });

  it('rejects missing version', () => {
    const { version: _v, ...rest } = buildSampleCube() as CityJsonDocument & {
      version: string;
    };
    const result = validateCityJson(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/);
  });

  it('rejects missing CityObjects', () => {
    const doc = buildSampleCube() as unknown as Record<string, unknown>;
    delete doc.CityObjects;
    const result = validateCityJson(doc);
    expect(result.ok).toBe(false);
  });

  it('rejects missing vertices', () => {
    const doc = buildSampleCube() as unknown as Record<string, unknown>;
    delete doc.vertices;
    const result = validateCityJson(doc);
    expect(result.ok).toBe(false);
  });

  it('rejects non-array vertices', () => {
    const doc = buildSampleCube() as unknown as Record<string, unknown>;
    doc.vertices = 'not-an-array';
    const result = validateCityJson(doc);
    expect(result.ok).toBe(false);
  });
});

describe('parseCityJson', () => {
  it('parses valid JSON text', () => {
    const text = JSON.stringify(buildSampleCube());
    const result = parseCityJson(text);
    expect(result.ok).toBe(true);
  });

  it('reports a meaningful error on invalid JSON', () => {
    const result = parseCityJson('{ this is not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON parse/);
  });

  it('reports a meaningful error on non-CityJSON shapes', () => {
    const result = parseCityJson('{"type":"Feature","geometry":null}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CityJSON/);
  });
});

describe('rootBuildingIds', () => {
  it('returns the sample cube root Building', () => {
    const ids = rootBuildingIds(buildSampleCube());
    expect(ids).toEqual(['Building_A']);
  });

  it('excludes BuildingParts that have parents', () => {
    const doc = buildSampleCube();
    doc.CityObjects.BuildingPart_1 = {
      type: 'BuildingPart',
      parents: ['Building_A'],
    };
    const ids = rootBuildingIds(doc);
    expect(ids).toEqual(['Building_A']);
  });

  it('includes Bridges and Tunnels alongside Buildings', () => {
    const doc = buildSampleCube();
    doc.CityObjects.Bridge_1 = { type: 'Bridge' };
    doc.CityObjects.Tunnel_1 = { type: 'Tunnel' };
    const ids = rootBuildingIds(doc);
    expect(ids).toContain('Building_A');
    expect(ids).toContain('Bridge_1');
    expect(ids).toContain('Tunnel_1');
  });
});

describe('setAttribute', () => {
  it('mutates the document in place and returns true', () => {
    const doc = buildSampleCube();
    const changed = setAttribute(doc, 'Building_A', 'measuredHeight', 99);
    expect(changed).toBe(true);
    expect(doc.CityObjects.Building_A.attributes?.measuredHeight).toBe(99);
  });

  it('returns false when the value is identical', () => {
    const doc = buildSampleCube();
    const h = doc.CityObjects.Building_A.attributes?.measuredHeight;
    const changed = setAttribute(doc, 'Building_A', 'measuredHeight', h);
    expect(changed).toBe(false);
  });

  it('adds an attributes object if one does not exist', () => {
    const doc = buildSampleCube();
    delete doc.CityObjects.Building_A.attributes;
    const changed = setAttribute(doc, 'Building_A', 'newAttr', 'value');
    expect(changed).toBe(true);
    expect(doc.CityObjects.Building_A.attributes).toEqual({ newAttr: 'value' });
  });

  it('returns false when the object does not exist', () => {
    const doc = buildSampleCube();
    const changed = setAttribute(doc, 'nonexistent', 'x', 1);
    expect(changed).toBe(false);
  });
});

describe('diffAttributes', () => {
  it('reports no diffs for identical docs', () => {
    const a = buildSampleCube();
    const b = buildSampleCube();
    expect(diffAttributes(a, b)).toHaveLength(0);
  });

  it('reports a single-attribute change', () => {
    const a = buildSampleCube();
    const b = buildSampleCube();
    setAttribute(b, 'Building_A', 'measuredHeight', 42);
    const diffs = diffAttributes(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      objectId: 'Building_A',
      key: 'measuredHeight',
      before: 10.0,
      after: 42,
    });
  });

  it('reports additions of new attributes', () => {
    const a = buildSampleCube();
    const b = buildSampleCube();
    setAttribute(b, 'Building_A', 'brandNew', 'val');
    const diffs = diffAttributes(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].key).toBe('brandNew');
    expect(diffs[0].before).toBeUndefined();
    expect(diffs[0].after).toBe('val');
  });
});

describe('shortCrs', () => {
  it('extracts EPSG code from OGC URL', () => {
    expect(shortCrs('https://www.opengis.net/def/crs/EPSG/0/4978')).toBe('EPSG:4978');
    expect(shortCrs('https://www.opengis.net/def/crs/EPSG/0/28992')).toBe('EPSG:28992');
  });

  it('passes short strings through', () => {
    expect(shortCrs('EPSG:4326')).toBe('EPSG:4326');
  });

  it('truncates unrecognized long strings', () => {
    const s = 'x'.repeat(50);
    expect(shortCrs(s).length).toBeLessThan(s.length);
  });
});
