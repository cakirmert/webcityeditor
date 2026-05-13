import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../types';
import { buildSampleCube } from './cityjson';
import { deleteBuildings } from './delete';

function docWithParts(): CityJsonDocument {
  const doc = buildSampleCube();
  // Add two BuildingPart children to the sample cube's Building
  const buildingId = Object.keys(doc.CityObjects).find(
    (id) => doc.CityObjects[id].type === 'Building'
  )!;
  doc.CityObjects[buildingId].children = ['part-A', 'part-B'];
  doc.CityObjects['part-A'] = {
    type: 'BuildingPart',
    parents: [buildingId],
    attributes: { storeysAboveGround: 1 },
  };
  doc.CityObjects['part-B'] = {
    type: 'BuildingPart',
    parents: [buildingId],
    attributes: { storeysAboveGround: 2 },
  };
  return doc;
}

describe('deleteBuildings', () => {
  it('removes a single standalone Building from CityObjects', () => {
    const doc = buildSampleCube();
    const buildingId = Object.keys(doc.CityObjects).find(
      (id) => doc.CityObjects[id].type === 'Building'
    )!;
    const before = Object.keys(doc.CityObjects).length;

    const { deletedIds } = deleteBuildings(doc, [buildingId]);

    expect(deletedIds).toContain(buildingId);
    expect(doc.CityObjects[buildingId]).toBeUndefined();
    expect(Object.keys(doc.CityObjects).length).toBe(before - 1);
  });

  it('cascades into BuildingPart children when deleting a parent Building', () => {
    const doc = docWithParts();
    const buildingId = Object.keys(doc.CityObjects).find(
      (id) => doc.CityObjects[id].type === 'Building'
    )!;

    const { deletedIds } = deleteBuildings(doc, [buildingId]);

    expect(deletedIds).toEqual(expect.arrayContaining([buildingId, 'part-A', 'part-B']));
    expect(doc.CityObjects[buildingId]).toBeUndefined();
    expect(doc.CityObjects['part-A']).toBeUndefined();
    expect(doc.CityObjects['part-B']).toBeUndefined();
  });

  it('removes deleted-child references from a surviving parent', () => {
    const doc = docWithParts();
    const buildingId = Object.keys(doc.CityObjects).find(
      (id) => doc.CityObjects[id].type === 'Building'
    )!;

    deleteBuildings(doc, ['part-A']);

    expect(doc.CityObjects[buildingId]?.children).toEqual(['part-B']);
    expect(doc.CityObjects['part-A']).toBeUndefined();
    expect(doc.CityObjects['part-B']).toBeDefined();
  });

  it('handles multi-delete of mixed Building + BuildingPart in one call', () => {
    const doc = docWithParts();
    const buildingId = Object.keys(doc.CityObjects).find(
      (id) => doc.CityObjects[id].type === 'Building'
    )!;

    const { deletedIds } = deleteBuildings(doc, [buildingId, 'part-A']);

    // The Building cascades into BOTH parts even though one was also
    // requested directly — set semantics, no duplicates.
    expect(new Set(deletedIds)).toEqual(new Set([buildingId, 'part-A', 'part-B']));
    expect(Object.keys(doc.CityObjects).length).toBe(0);
  });

  it('ignores ids that do not exist', () => {
    const doc = buildSampleCube();
    const before = Object.keys(doc.CityObjects).length;

    const { deletedIds } = deleteBuildings(doc, ['nonexistent-id']);

    expect(deletedIds).toEqual([]);
    expect(Object.keys(doc.CityObjects).length).toBe(before);
  });

  it('tolerates self-referential children without looping forever', () => {
    const doc = buildSampleCube();
    const buildingId = Object.keys(doc.CityObjects).find(
      (id) => doc.CityObjects[id].type === 'Building'
    )!;
    // Pathological case — shouldn't happen in real data, but the bounded
    // queue must terminate if it does.
    doc.CityObjects[buildingId].children = [buildingId];

    const { deletedIds } = deleteBuildings(doc, [buildingId]);

    expect(deletedIds).toContain(buildingId);
    expect(doc.CityObjects[buildingId]).toBeUndefined();
  });
});
