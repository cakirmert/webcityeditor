import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../types';
import { buildSampleCube } from './cityjson';
import { extractFootprints } from './footprints';
import { cloneBuildings } from './clipboard';
import { checkIntegrity } from './integrity';

function findBuildingId(doc: CityJsonDocument): string {
  const id = Object.keys(doc.CityObjects).find(
    (k) => doc.CityObjects[k].type === 'Building'
  );
  if (!id) throw new Error('expected a Building in the sample doc');
  return id;
}

describe('cloneBuildings', () => {
  it('produces one new CityObject per cloned source id', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);
    const beforeKeys = Object.keys(doc.CityObjects).length;

    const { clonedIds } = cloneBuildings(doc, new Set([buildingId]), 5, 5);

    expect(clonedIds).toHaveLength(1);
    expect(Object.keys(doc.CityObjects).length).toBe(beforeKeys + 1);
    expect(doc.CityObjects[clonedIds[0]]).toBeDefined();
    expect(doc.CityObjects[clonedIds[0]].type).toBe('Building');
  });

  it('cloned ids are unique and use the __copy suffix', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);

    const { clonedIds: first } = cloneBuildings(doc, new Set([buildingId]), 5, 0);
    const { clonedIds: second } = cloneBuildings(doc, new Set([buildingId]), 0, 5);

    expect(first[0]).not.toBe(second[0]);
    expect(first[0]).toMatch(/__copy/);
    expect(second[0]).toMatch(/__copy/);
  });

  it('shifts the clone by (dx, dy) metres in the doc CRS', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);
    const beforeFps = extractFootprints(doc);
    const orig = beforeFps.find((f) => f.id === buildingId);
    expect(orig).toBeDefined();

    const { clonedIds } = cloneBuildings(doc, new Set([buildingId]), 10, 0);
    const afterFps = extractFootprints(doc);
    const clone = afterFps.find((f) => f.id === clonedIds[0]);
    expect(clone).toBeDefined();
    // x of every clone vertex should be shifted by > 0 relative to its
    // matching original (we can't compare exactly without projecting, but
    // a 10 m shift should produce a visible delta).
    const origCx = orig!.polygon.reduce((s, p) => s + p[0], 0) / orig!.polygon.length;
    const cloneCx = clone!.polygon.reduce((s, p) => s + p[0], 0) / clone!.polygon.length;
    expect(cloneCx).not.toBeCloseTo(origCx, 6);
  });

  it('leaves the source building intact', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);
    const origGeometry = JSON.stringify(doc.CityObjects[buildingId].geometry);

    cloneBuildings(doc, new Set([buildingId]), 5, 5);

    expect(JSON.stringify(doc.CityObjects[buildingId].geometry)).toBe(origGeometry);
  });

  it('passes structural integrity check after cloning', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);

    cloneBuildings(doc, new Set([buildingId]), 5, 5);
    const report = checkIntegrity(doc);

    expect(report.counts.error).toBe(0);
  });

  it('ignores ids that do not exist in the doc', () => {
    const doc = buildSampleCube();
    const beforeKeys = Object.keys(doc.CityObjects).length;

    const { clonedIds } = cloneBuildings(doc, new Set(['nonexistent-id']), 5, 5);

    expect(clonedIds).toEqual([]);
    expect(Object.keys(doc.CityObjects).length).toBe(beforeKeys);
  });

  it('rewires parent/child relationships when cloning a building with children', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);
    // Wire up a fake child so we can verify the parent/child remap logic
    doc.CityObjects[buildingId].children = ['part-X'];
    doc.CityObjects['part-X'] = {
      type: 'BuildingPart',
      parents: [buildingId],
      attributes: {},
    };

    const { clonedIds } = cloneBuildings(doc, new Set([buildingId]), 5, 5);
    const cloneParent = doc.CityObjects[clonedIds[0]];

    expect(cloneParent.children).toBeDefined();
    expect(cloneParent.children!.length).toBe(1);
    // The clone's child should be a NEW id (not the original 'part-X')
    const newChildId = cloneParent.children![0];
    expect(newChildId).not.toBe('part-X');
    expect(doc.CityObjects[newChildId]).toBeDefined();
    // And the new child's parents must point to the new parent, not the original
    expect(doc.CityObjects[newChildId].parents).toEqual([clonedIds[0]]);
  });

  it('produces multiple distinct clones when called repeatedly', () => {
    const doc = buildSampleCube();
    const buildingId = findBuildingId(doc);

    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const { clonedIds } = cloneBuildings(doc, new Set([buildingId]), i + 1, i + 1);
      seen.add(clonedIds[0]);
    }

    expect(seen.size).toBe(3);
  });
});
