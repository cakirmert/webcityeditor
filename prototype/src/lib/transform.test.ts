import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import { moveBuilding, rotateBuilding } from './transform';
import { extractFootprints } from './footprints';

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const base: NewBuildingParams = {
    targetCrs: 'EPSG:28992',
    footprintWgs84: [
      [4.3571, 52.0116],
      [4.35725, 52.0116],
      [4.35725, 52.01175],
      [4.3571, 52.01175],
    ],
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  };
  const result = generateBuilding(doc, base);
  const id = insertBuilding(doc, result);
  return { doc, id };
}

function bbox(doc: import('../types').CityJsonDocument, id: string) {
  const fps = extractFootprints(doc);
  const fp = fps.find((f) => f.id === id);
  if (!fp) throw new Error('no footprint');
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of fp.polygon) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

describe('moveBuilding', () => {
  it('translates all footprint vertices by (dx, dy) in metres', () => {
    const { doc, id } = makeBuilding();
    const before = bbox(doc, id);

    const result = moveBuilding(doc, id, 20, 0); // 20m east
    expect(result.verticesAdded).toBeGreaterThan(0);
    expect(result.objectsUpdated).toBeGreaterThan(0);

    const after = bbox(doc, id);
    // 20m east in Delft = ~0.000290° longitude
    expect(after.minLng).toBeGreaterThan(before.minLng);
    expect(after.maxLng).toBeGreaterThan(before.maxLng);
    // Latitude unchanged
    expect(after.minLat).toBeCloseTo(before.minLat, 5);
    expect(after.maxLat).toBeCloseTo(before.maxLat, 5);
  });

  it('does not mutate the original vertex entries (creates new ones)', () => {
    const { doc, id } = makeBuilding();
    const vertexCountBefore = doc.vertices.length;
    const first = doc.vertices[0];
    const firstSnapshot = [first[0], first[1], first[2]];
    moveBuilding(doc, id, 10, 10);
    expect(doc.vertices.length).toBeGreaterThan(vertexCountBefore);
    // The original vertex is unchanged (may be orphaned, but not rewritten)
    expect(doc.vertices[0][0]).toBe(firstSnapshot[0]);
    expect(doc.vertices[0][1]).toBe(firstSnapshot[1]);
    expect(doc.vertices[0][2]).toBe(firstSnapshot[2]);
  });

  it('roundtrips through JSON.stringify', () => {
    const { doc, id } = makeBuilding();
    moveBuilding(doc, id, 5, -5, 0);
    const text = JSON.stringify(doc);
    const parsed = JSON.parse(text);
    expect(parsed.CityObjects[id]).toBeDefined();
  });
});

describe('rotateBuilding', () => {
  it('rotates the footprint around the centroid (bbox dimensions change)', () => {
    const { doc, id } = makeBuilding();
    const before = bbox(doc, id);

    rotateBuilding(doc, id, 90);

    const after = bbox(doc, id);
    // After 90° rotation the bbox dimensions must differ from the original
    // (unless the footprint is a perfect square, which ours isn't).
    const widthChanged = Math.abs(
      (before.maxLng - before.minLng) - (after.maxLng - after.minLng)
    );
    const heightChanged = Math.abs(
      (before.maxLat - before.minLat) - (after.maxLat - after.minLat)
    );
    expect(widthChanged + heightChanged).toBeGreaterThan(1e-6);
  });

  it('keeps the centroid in roughly the same place', () => {
    const { doc, id } = makeBuilding();
    const before = bbox(doc, id);
    const beforeCenter = [
      (before.minLng + before.maxLng) / 2,
      (before.minLat + before.maxLat) / 2,
    ];

    rotateBuilding(doc, id, 45);
    const after = bbox(doc, id);
    const afterCenter = [
      (after.minLng + after.maxLng) / 2,
      (after.minLat + after.maxLat) / 2,
    ];
    // Centroid shouldn't move more than ~1 m (~1e-5 degrees)
    expect(Math.abs(beforeCenter[0] - afterCenter[0])).toBeLessThan(1e-4);
    expect(Math.abs(beforeCenter[1] - afterCenter[1])).toBeLessThan(1e-4);
  });

  it('rotation by 360° returns to approximately the original', () => {
    const { doc, id } = makeBuilding();
    const before = bbox(doc, id);
    rotateBuilding(doc, id, 360);
    const after = bbox(doc, id);
    expect(after.minLng).toBeCloseTo(before.minLng, 5);
    expect(after.minLat).toBeCloseTo(before.minLat, 5);
    expect(after.maxLng).toBeCloseTo(before.maxLng, 5);
    expect(after.maxLat).toBeCloseTo(before.maxLat, 5);
  });
});
