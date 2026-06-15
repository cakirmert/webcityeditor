import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import { generateBuilding, insertBuilding } from '../../src/lib/generator';
import { extractOpenings, moveOpening } from '../../src/lib/opening-edit';
import { checkIntegrity } from '../../src/lib/integrity';
import '../../src/lib/projection';

/**
 * Build a fresh doc and run the parametric generator with windows + door
 * enabled. Returns the doc and the new building's id so tests can call
 * extractOpenings/moveOpening against a known-good Window/Door layout.
 */
function docWithOpenings(): { doc: CityJsonDocument; buildingId: string } {
  const doc: CityJsonDocument = {
    type: 'CityJSON',
    version: '2.0',
    metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/28992' },
    transform: { scale: [0.001, 0.001, 0.001], translate: [85000, 446000, 0] },
    CityObjects: {},
    vertices: [],
  };
  // A 10 × 6 m flat-roof box in Dutch RD (EPSG:28992) at roughly The Hague.
  // proj4 maps the lng/lat back to ~ (85000, 446000) which matches our
  // transform.translate so the integer-encoded vertices stay small.
  const footprintWgs84: [number, number][] = [
    [4.3571, 52.0116],
    [4.3573, 52.0116],
    [4.3573, 52.0117],
    [4.3571, 52.0117],
  ];
  const result = generateBuilding(doc, {
    targetCrs: 'EPSG:28992',
    footprintWgs84,
    storeys: 1,
    eaveHeight: 3,
    ridgeHeight: 3,
    roofType: 'flat',
    attributes: { function: 'residential' },
    openings: { windows: true, door: true },
  });
  insertBuilding(doc, result);
  return { doc, buildingId: result.id };
}

describe('extractOpenings', () => {
  it('returns empty for a building without openings', () => {
    const doc: CityJsonDocument = {
      type: 'CityJSON',
      version: '2.0',
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/28992' },
      transform: { scale: [0.001, 0.001, 0.001], translate: [85000, 446000, 0] },
      CityObjects: {},
      vertices: [],
    };
    const result = generateBuilding(doc, {
      targetCrs: 'EPSG:28992',
      footprintWgs84: [
        [4.3571, 52.0116],
        [4.3573, 52.0116],
        [4.3573, 52.0117],
        [4.3571, 52.0117],
      ],
      storeys: 1,
      eaveHeight: 3,
      ridgeHeight: 3,
      roofType: 'flat',
      attributes: { function: 'residential' },
      // No openings parameter
    });
    insertBuilding(doc, result);

    const openings = extractOpenings(doc, result.id);

    expect(openings).toEqual([]);
  });

  it('finds Window and Door surfaces in a building with openings', () => {
    const { doc, buildingId } = docWithOpenings();

    const openings = extractOpenings(doc, buildingId);

    expect(openings.length).toBeGreaterThan(0);
    const windows = openings.filter((o) => o.type === 'Window');
    const doors = openings.filter((o) => o.type === 'Door');
    expect(windows.length).toBeGreaterThan(0);
    expect(doors.length).toBe(1); // generator emits exactly one door
  });

  it('reports plausible dimensions for window openings (1.4 × 1.5 m)', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);
    const windows = openings.filter((o) => o.type === 'Window');

    // generator emits 1.4 m wide × 1.5 m tall windows
    for (const w of windows) {
      expect(w.width).toBeGreaterThan(1.0);
      expect(w.width).toBeLessThan(2.0);
      expect(w.height).toBeGreaterThan(1.0);
      expect(w.height).toBeLessThan(2.0);
    }
  });

  it('door height is approximately 2.1 m', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);
    const door = openings.find((o) => o.type === 'Door');

    expect(door).toBeDefined();
    expect(door!.height).toBeGreaterThan(1.8);
    expect(door!.height).toBeLessThan(2.5);
  });

  it('returns empty for nonexistent building id', () => {
    const { doc } = docWithOpenings();
    expect(extractOpenings(doc, 'nonexistent')).toEqual([]);
  });
});

describe('moveOpening', () => {
  it('translates opening vertices by the given dx/dy/dz', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);
    const before = openings[0];

    const ok = moveOpening(doc, buildingId, before, 0, 0, 0.5);
    expect(ok).toBe(true);

    const after = extractOpenings(doc, buildingId)[0];
    expect(after.center[2]).toBeCloseTo(before.center[2] + 0.5, 2);
  });

  it('keeps the doc structurally valid after the move', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);

    moveOpening(doc, buildingId, openings[0], 0.5, 0, 0);

    const report = checkIntegrity(doc);
    expect(report.counts.error).toBe(0);
  });

  it('survives JSON round-trip after editing', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);

    moveOpening(doc, buildingId, openings[0], 0, 0, 0.3);
    const text = JSON.stringify(doc);
    const re = JSON.parse(text) as CityJsonDocument;

    const reOpenings = extractOpenings(re, buildingId);
    expect(reOpenings.length).toBe(openings.length);
  });

  it('returns false for a nonexistent building', () => {
    const { doc, buildingId } = docWithOpenings();
    const openings = extractOpenings(doc, buildingId);

    const ok = moveOpening(doc, 'nonexistent', openings[0], 1, 0, 0);

    expect(ok).toBe(false);
  });
});
