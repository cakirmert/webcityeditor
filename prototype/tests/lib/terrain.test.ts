import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from '../../src/lib/generator';
import { estimateTerrainSnap, isTerrainMatched, snapTransformToTerrain } from '../../src/lib/terrain';

const FOOTPRINT: [number, number][] = [
  [4.3571, 52.0116],
  [4.35724, 52.0116],
  [4.35724, 52.01168],
  [4.3571, 52.01168],
];

function addFlatBuilding(doc: ReturnType<typeof buildSampleCube>, baseElevation: number) {
  const params: NewBuildingParams = {
    targetCrs: 'EPSG:28992',
    footprintWgs84: FOOTPRINT,
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    baseElevation,
  };
  return insertBuilding(doc, generateBuilding(doc, params));
}

function makeDocWithTerrainProxy() {
  const doc = buildSampleCube();
  doc.CityObjects = {};
  doc.vertices = [];
  const movedId = addFlatBuilding(doc, 0);
  const terrainId = addFlatBuilding(doc, 4.5);
  return { doc, movedId, terrainId };
}

describe('terrain snap', () => {
  it('uses containing ground surfaces as the terrain elevation proxy', () => {
    const { doc, movedId, terrainId } = makeDocWithTerrainProxy();

    const snap = estimateTerrainSnap(doc, {
      id: movedId,
      dx: 0,
      dy: 0,
      dz: 0,
      angle: 0,
      autoTerrain: true,
    });

    expect(snap).not.toBeNull();
    expect(snap!.matchedBuildingId).toBe(terrainId);
    expect(snap!.terrainElevation).toBeCloseTo(4.5);
    expect(snap!.requiredDz).toBeCloseTo(4.5);
    expect(snap!.difference).toBeCloseTo(4.5);
    expect(isTerrainMatched(snap)).toBe(false);
  });

  it('snaps dZ so the moved building ground matches terrain', () => {
    const { doc, movedId } = makeDocWithTerrainProxy();

    const snapped = snapTransformToTerrain(doc, {
      id: movedId,
      dx: 2,
      dy: -1,
      dz: 0,
      angle: 0,
      autoTerrain: true,
    });
    const snap = estimateTerrainSnap(doc, snapped);

    expect(snapped.dz).toBeCloseTo(4.5);
    expect(snapped.autoTerrain).toBe(true);
    expect(isTerrainMatched(snap)).toBe(true);
  });

  it('falls back to the current building ground when no other terrain sample exists', () => {
    const doc = buildSampleCube();

    const snap = estimateTerrainSnap(doc, {
      id: 'Building_A',
      dx: 5,
      dy: 0,
      dz: 0,
      angle: 0,
      autoTerrain: true,
    });

    expect(snap).not.toBeNull();
    expect(snap!.terrainSource).toBe('current-building-ground');
    expect(snap!.requiredDz).toBeCloseTo(0);
    expect(isTerrainMatched(snap)).toBe(true);
  });
});
