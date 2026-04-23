import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import {
  canSplitBuilding,
  splitBuildingByFloor,
  splitBuildingBySide,
  MIN_STOREY_HEIGHT,
  MIN_SIDE_WIDTH,
} from './subdivision';

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const base: NewBuildingParams = {
    targetCrs: 'EPSG:28992',
    // 10 m × 20 m rectangle in Delft
    footprintWgs84: [
      [4.3571, 52.0116],
      [4.35725, 52.0116],
      [4.35725, 52.01175],
      [4.3571, 52.01175],
    ],
    storeys: 4,
    eaveHeight: 12,
    ridgeHeight: 12,
    roofType: 'flat',
    ...overrides,
  };
  const result = generateBuilding(doc, base);
  const id = insertBuilding(doc, result);
  return { doc, id };
}

describe('canSplitBuilding', () => {
  it('accepts a building created by the editor', () => {
    const { doc, id } = makeBuilding();
    const gate = canSplitBuilding(doc, id);
    expect(gate.ok).toBe(true);
    expect(gate.params?.storeys).toBe(4);
  });

  it('accepts an imported building without editor-specific attributes', () => {
    const doc = buildSampleCube(); // Building_A has no _createdBy
    const gate = canSplitBuilding(doc, 'Building_A');
    expect(gate.ok).toBe(true);
    expect(gate.params?.storeys).toBe(3); // from attributes.storeysAboveGround
  });

  it('infers storeys from geometry when attribute is missing', () => {
    const doc = buildSampleCube();
    delete doc.CityObjects.Building_A.attributes?.storeysAboveGround;
    const gate = canSplitBuilding(doc, 'Building_A');
    expect(gate.ok).toBe(true);
    // Sample cube eave is 10 m → ~3 storeys at 3 m each
    expect(gate.params?.storeys).toBeGreaterThanOrEqual(3);
  });

  it('rejects a building that is already split', () => {
    const { doc, id } = makeBuilding();
    splitBuildingByFloor(doc, id, 2);
    const gate = canSplitBuilding(doc, id);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/split/);
  });
});

describe('splitBuildingByFloor', () => {
  it('creates N BuildingParts stacked vertically', () => {
    const { doc, id } = makeBuilding();
    const { partIds } = splitBuildingByFloor(doc, id, 4);
    expect(partIds).toHaveLength(4);
    for (const pid of partIds) {
      const part = doc.CityObjects[pid];
      expect(part.type).toBe('BuildingPart');
      expect(part.parents).toEqual([id]);
    }
    expect(doc.CityObjects[id].children).toEqual(partIds);
    expect(doc.CityObjects[id].geometry).toEqual([]);
  });

  it('only applies the roof type to the top part', () => {
    const { doc, id } = makeBuilding({ roofType: 'pyramid', ridgeHeight: 15 });
    const { partIds } = splitBuildingByFloor(doc, id, 3);
    // Top part: measuredHeight should include the pyramid ridge (which is the
    // original ridge). Intermediate parts: flat, shorter.
    const top = doc.CityObjects[partIds[partIds.length - 1]];
    const mid = doc.CityObjects[partIds[0]];
    expect(top.attributes?.roofType).toBe('pyramid');
    expect(mid.attributes?.roofType).toBe('flat');
  });

  it('rejects a split that would violate MIN_STOREY_HEIGHT', () => {
    // 12 m total / 10 floors = 1.2 m per floor — too short
    const { doc, id } = makeBuilding({ eaveHeight: 12, ridgeHeight: 12, storeys: 4 });
    expect(() => splitBuildingByFloor(doc, id, 10)).toThrow(/minimum/i);
    expect(MIN_STOREY_HEIGHT).toBeGreaterThan(0);
  });

  it('produces a doc that survives JSON round-trip', () => {
    const { doc, id } = makeBuilding();
    splitBuildingByFloor(doc, id, 3);
    const text = JSON.stringify(doc);
    const parsed = parseCityJson(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const parent = parsed.doc.CityObjects[id];
    expect(parent.children).toHaveLength(3);
    for (const cid of parent.children!) {
      expect(parsed.doc.CityObjects[cid].type).toBe('BuildingPart');
    }
  });
});

describe('splitBuildingBySide', () => {
  it('creates N side-by-side BuildingParts', () => {
    const { doc, id } = makeBuilding();
    const { partIds } = splitBuildingBySide(doc, id, 3);
    expect(partIds).toHaveLength(3);
    for (const pid of partIds) {
      expect(doc.CityObjects[pid].type).toBe('BuildingPart');
      expect(doc.CityObjects[pid].parents).toEqual([id]);
    }
  });

  it('rejects a split that would violate MIN_SIDE_WIDTH', () => {
    // 10 m × 20 m rectangle; splitting the 20 m axis into 10 parts = 2 m each
    const { doc, id } = makeBuilding();
    expect(() => splitBuildingBySide(doc, id, 10)).toThrow(/minimum/i);
    expect(MIN_SIDE_WIDTH).toBeGreaterThan(0);
  });

  it('rejects non-rectangular footprints', () => {
    const { doc, id } = makeBuilding({
      footprintWgs84: [
        [4.3571, 52.0116],
        [4.35725, 52.0116],
        [4.357175, 52.01175],
      ],
    });
    expect(() => splitBuildingBySide(doc, id, 2)).toThrow(/rectangular|4 corners/i);
  });

  it('keeps the parent accessible with children linkage', () => {
    const { doc, id } = makeBuilding();
    const { partIds } = splitBuildingBySide(doc, id, 2);
    expect(doc.CityObjects[id].children).toEqual(partIds);
  });
});
