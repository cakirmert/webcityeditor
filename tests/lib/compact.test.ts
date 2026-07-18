import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from '../../src/lib/cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from '../../src/lib/generator';
import { regenerateBuilding } from '../../src/lib/regenerate';
import { compactVertices } from '../../src/lib/compact';
import { checkIntegrity } from '../../src/lib/integrity';
import { extractFootprints } from '../../src/lib/footprints';
import '../../src/lib/projection';

const FP_A: [number, number][] = [
  [4.3571, 52.0116],
  [4.35725, 52.0116],
  [4.35725, 52.01172],
  [4.3571, 52.01172],
];
const FP_B: [number, number][] = [
  [4.3573, 52.0116],
  [4.35745, 52.0116],
  [4.35745, 52.01172],
  [4.3573, 52.01172],
];

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const r = generateBuilding(doc, {
    targetCrs: 'EPSG:28992',
    footprintWgs84: FP_A,
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  });
  const id = insertBuilding(doc, r);
  return { doc, id };
}

describe('compactVertices', () => {
  it('is a no-op on a clean doc with zero orphans', () => {
    const doc = buildSampleCube();
    const before = doc.vertices.length;
    const r = compactVertices(doc);
    expect(r.changed).toBe(false);
    expect(r.reclaimed).toBe(0);
    expect(r.before).toBe(before);
    expect(r.after).toBe(before);
    expect(doc.vertices.length).toBe(before);
  });

  it('reclaims vertices orphaned by regenerateBuilding', () => {
    const { doc, id } = makeBuilding();
    const beforeRegen = doc.vertices.length;

    const reg = regenerateBuilding(doc, id, FP_B);
    expect(reg.ok).toBe(true);
    const beforeCompact = doc.vertices.length;
    expect(beforeCompact).toBeGreaterThan(beforeRegen); // grew (new verts appended)

    const r = compactVertices(doc);
    expect(r.changed).toBe(true);
    expect(r.reclaimed).toBeGreaterThan(0);
    expect(r.after).toBe(doc.vertices.length);
    expect(doc.vertices.length).toBeLessThan(beforeCompact);

    // After compaction, integrity check should report 0 orphans.
    const integ = checkIntegrity(doc);
    expect(integ.summary.orphanedVertices).toBe(0);
  });

  it('preserves all geometry references after remapping', () => {
    const { doc, id } = makeBuilding();
    regenerateBuilding(doc, id, FP_B);
    compactVertices(doc);

    // Every vertex index in the doc should still resolve to an in-range vertex.
    const integ = checkIntegrity(doc);
    expect(integ.ok).toBe(true);
    expect(integ.counts.error).toBe(0);
  });

  it('preserves the visible footprint shape after compaction', () => {
    const { doc, id } = makeBuilding();
    regenerateBuilding(doc, id, FP_B);

    const fpsBefore = extractFootprints(doc);
    const polyBefore = fpsBefore.find((f) => f.id === id)!.polygon;

    compactVertices(doc);

    const fpsAfter = extractFootprints(doc);
    const polyAfter = fpsAfter.find((f) => f.id === id)!.polygon;
    expect(polyAfter.length).toBe(polyBefore.length);
    for (let i = 0; i < polyBefore.length; i++) {
      expect(polyAfter[i][0]).toBeCloseTo(polyBefore[i][0], 6);
      expect(polyAfter[i][1]).toBeCloseTo(polyBefore[i][1], 6);
    }
  });

  it('survives JSON.stringify → parse round-trip after compaction', () => {
    const { doc, id } = makeBuilding();
    regenerateBuilding(doc, id, FP_B);
    compactVertices(doc);

    const parsed = parseCityJson(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.doc.CityObjects[id]).toBeDefined();
    const integ = checkIntegrity(parsed.doc);
    expect(integ.ok).toBe(true);
  });

  it('handles multiple regeneration cycles cleanly', () => {
    const { doc, id } = makeBuilding();
    // Three regenerations — each leaves orphans behind.
    regenerateBuilding(doc, id, FP_B);
    regenerateBuilding(doc, id, FP_A);
    regenerateBuilding(doc, id, FP_B);
    const integBefore = checkIntegrity(doc);
    expect(integBefore.summary.orphanedVertices).toBeGreaterThan(0);

    const r = compactVertices(doc);
    expect(r.changed).toBe(true);

    const integAfter = checkIntegrity(doc);
    expect(integAfter.summary.orphanedVertices).toBe(0);
    expect(integAfter.ok).toBe(true);
  });

  it('idempotent — running compact twice has no further effect', () => {
    const { doc, id } = makeBuilding();
    regenerateBuilding(doc, id, FP_B);
    const r1 = compactVertices(doc);
    expect(r1.changed).toBe(true);
    const after1 = doc.vertices.length;

    const r2 = compactVertices(doc);
    expect(r2.changed).toBe(false);
    expect(r2.reclaimed).toBe(0);
    expect(doc.vertices.length).toBe(after1);
  });

  it('handles a doc with no geometry without crashing', () => {
    const doc = buildSampleCube();
    delete (doc.CityObjects.Building_A as { geometry?: unknown }).geometry;
    const r = compactVertices(doc);
    // Every vertex is now orphaned, so they all get removed.
    expect(r.reclaimed).toBe(8);
    expect(doc.vertices.length).toBe(0);
  });

  it('compacts multi-tile-scale vertex arrays without overflowing the call stack', () => {
    const count = 120_000;
    const vertices = Array.from(
      { length: count + 1 },
      (_, index) => [index, 0, 0] as [number, number, number]
    );
    const doc = {
      type: 'CityJSON' as const,
      version: '2.0',
      CityObjects: {
        BigBuilding: {
          type: 'Building',
          geometry: [{ type: 'MultiSurface', boundaries: [[[...Array(count).keys()]]] }],
        },
      },
      vertices,
    };
    const originalArray = doc.vertices;

    const r = compactVertices(doc);

    expect(r.reclaimed).toBe(1);
    expect(doc.vertices).toBe(originalArray);
    expect(doc.vertices).toHaveLength(count);
  });
});
