import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto } from './cityjson';
import { detectCrs } from './projection';
import { extractFootprints } from './footprints';
import { tintByRoofType } from './footprint-tint';
import { SYNTHETIC_3DBAG_SEQ } from './__fixtures__/3dbag-sample';

/**
 * Smoke tests against a synthetic 3DBAG-flavoured CityJSONSeq sample.
 * Validates the parser/loader/extractor pipeline end-to-end on the dataset
 * shape we expect to standardise on per the onay dökümanı (3DBAG = primary
 * test data). Runs offline — no real download required.
 */
describe('3DBAG dataset shape — synthetic smoke test', () => {
  it('parses CityJSONSeq with EPSG:7415 compound CRS without error', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.type).toBe('CityJSON');
    expect(result.doc.version).toBe('2.0');
    // Two features merged into the doc's CityObjects table.
    const ids = Object.keys(result.doc.CityObjects);
    expect(ids).toContain('NL.IMBAG.Pand.0599100000000001');
    expect(ids).toContain('NL.IMBAG.Pand.0599100000000002');
  });

  it('detects EPSG:7415 from the OGC URL form', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const crs = detectCrs(result.doc);
    expect(crs.supported).toBe(true);
    expect(crs.code).toBe('EPSG:7415');
  });

  it('preserves 3DBAG-specific b3_* attributes through parsing', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.doc.CityObjects['NL.IMBAG.Pand.0599100000000001'];
    expect(a.attributes?.b3_h_dak_50p).toBe(8.45);
    expect(a.attributes?.b3_h_dak_70p).toBe(9.1);
    expect(a.attributes?.b3_h_dak_max).toBe(9.85);
    expect(a.attributes?.b3_h_maaiveld).toBe(-0.35);
    expect(a.attributes?.b3_dak_type).toBe('multiple horizontal');
    expect(a.attributes?.b3_pand_deel_id).toBe(1);
    expect(a.attributes?.b3_kas_warenhuis).toBe(false);
    expect(a.attributes?.b3_volume_lod22).toBe(159.1);
    expect(a.attributes?.identificatie).toBe('NL.IMBAG.Pand.0599100000000001');
    expect(a.attributes?.oorspronkelijk_bouwjaar).toBe(1925);
  });

  it('keeps multi-LoD geometry array intact (LoD 1.2, 1.3, 2.2 all present)', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.doc.CityObjects['NL.IMBAG.Pand.0599100000000001'];
    expect(a.geometry).toHaveLength(3);
    const lods = (a.geometry as Array<{ lod?: string }>).map((g) => g.lod);
    expect(lods).toEqual(['1.2', '1.3', '2.2']);
  });

  it('extractFootprints projects to WGS84 inside the Netherlands', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fps = extractFootprints(result.doc);
    expect(fps.length).toBe(2);
    // RD New origin (84500, 447500) is at TU Delft → ≈ (4.36, 52.01).
    for (const fp of fps) {
      const [lng, lat] = fp.polygon[0];
      expect(lng).toBeGreaterThan(4.3);
      expect(lng).toBeLessThan(4.4);
      expect(lat).toBeGreaterThan(52.0);
      expect(lat).toBeLessThan(52.1);
    }
  });

  it('vertex indices in feature geometries are rewritten to the merged global doc range', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Feature B was the second feature; its vertices were appended after
    // feature A's 8 verts → indices 8..15 in the merged doc.
    const b = result.doc.CityObjects['NL.IMBAG.Pand.0599100000000002'];
    const geom = (b.geometry as Array<{ boundaries: number[][][][] }>)[0];
    const allIndices = new Set<number>();
    for (const shell of geom.boundaries) {
      for (const face of shell) {
        for (const ring of face) {
          for (const idx of ring) allIndices.add(idx);
        }
      }
    }
    // All used indices should fall within the merged vertex array.
    const vertexCount = result.doc.vertices.length;
    for (const idx of allIndices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(vertexCount);
    }
    // Feature B's indices must NOT collide with feature A's indices.
    expect([...allIndices].every((idx) => idx >= 8)).toBe(true);
  });

  it('roofType integer code 1000 (CityGML "flat") maps to the flat-tint colour', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fps = extractFootprints(result.doc);
    const a = fps.find((f) => f.id === 'NL.IMBAG.Pand.0599100000000001');
    const b = fps.find((f) => f.id === 'NL.IMBAG.Pand.0599100000000002');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // Feature A has roofType: 1000 (integer), B has roofType: "flat" (string).
    // Both must resolve to identical tint.
    expect(tintByRoofType(a!, 230)).toEqual(tintByRoofType(b!, 230));
  });

  it('LoD 2.2 semantics survive parsing — surfaces match expected types', () => {
    const result = parseCityJsonAuto(SYNTHETIC_3DBAG_SEQ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.doc.CityObjects['NL.IMBAG.Pand.0599100000000001'];
    const lod22 = (a.geometry as Array<{ lod?: string; semantics?: { surfaces?: Array<{ type?: string }> } }>)
      .find((g) => g.lod === '2.2');
    expect(lod22?.semantics?.surfaces?.map((s) => s?.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
    ]);
  });
});
