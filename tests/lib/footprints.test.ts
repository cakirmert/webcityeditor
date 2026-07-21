import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import {
  clampFootprintsToTerrain,
  extractFootprintForId,
  extractFootprints,
  filterToBuilding,
  groundFootprintsForFlatMap,
} from '../../src/lib/footprints';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import type { CityJsonDocument } from '../../src/types';
import { generateBuilding, insertBuilding, type NewBuildingParams } from '../../src/lib/generator';
import { splitBuildingByFloor } from '../../src/lib/subdivision';

function makeEditableBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const params: NewBuildingParams = {
    targetCrs: 'EPSG:28992',
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
  const result = generateBuilding(doc, params);
  const id = insertBuilding(doc, result);
  return { doc, id };
}

describe('extractFootprints', () => {
  it('extracts one footprint from the sample cube', () => {
    const fps = extractFootprints(buildSampleCube());
    expect(fps).toHaveLength(1);
    expect(fps[0].id).toBe('Building_A');
    expect(fps[0].type).toBe('Building');
  });

  it('footprint polygon is closed (first=last) and lives near Delft', () => {
    const fps = extractFootprints(buildSampleCube());
    const ring = fps[0].polygon;
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Delft is roughly 4.35°E, 52.01°N — assert the footprint is in that region
    const [lng, lat] = ring[0];
    expect(lng).toBeGreaterThan(4);
    expect(lng).toBeLessThan(5);
    expect(lat).toBeGreaterThan(51);
    expect(lat).toBeLessThan(53);
  });

  it('height comes from measuredHeight when available', () => {
    const fps = extractFootprints(buildSampleCube());
    expect(fps[0].height).toBe(10);
  });

  it('returns empty array for unsupported CRS', () => {
    const doc = buildSampleCube();
    doc.metadata = { referenceSystem: 'urn:unknown' };
    // also nuke the transform's translate so the coord-magnitude fallback can't rescue it
    doc.transform = { scale: [1, 1, 1], translate: [1e9, 1e9, 0] };
    const fps = extractFootprints(doc);
    expect(fps).toEqual([]);
  });

  it('extracts split BuildingParts as stacked 3D footprints', () => {
    const { doc, id } = makeEditableBuilding();
    const { partIds } = splitBuildingByFloor(doc, id, 4);

    const parts = extractFootprints(doc).filter((fp) => fp.parentId === id);
    expect(parts.map((fp) => fp.id)).toEqual(partIds);
    expect(parts).toHaveLength(4);

    for (const fp of parts) {
      expect(fp.type).toBe('BuildingPart');
      expect(fp.polygon.length).toBeGreaterThanOrEqual(4);
      expect(fp.polygon[0]).toHaveLength(3);
      expect(fp.polygon[fp.polygon.length - 1]).toEqual(fp.polygon[0]);
      expect(fp.polygon.every((point) => point[2] === fp.baseElevation)).toBe(true);
    }

    expect(parts[0].baseElevation).toBeLessThan(parts[1].baseElevation);
    expect(parts[1].baseElevation).toBeLessThan(parts[2].baseElevation);
    expect(parts[2].baseElevation).toBeLessThan(parts[3].baseElevation);
  });

  it('grounds each map object group while preserving stacked part offsets', () => {
    const { doc, id } = makeEditableBuilding({ baseElevation: 37 });
    splitBuildingByFloor(doc, id, 4);

    const source = extractFootprints(doc).filter((fp) => fp.parentId === id);
    const grounded = groundFootprintsForFlatMap(source);
    const sourceGround = Math.min(...source.map((fp) => fp.baseElevation));

    expect(grounded[0].polygon.every((point) => point[2] === 0)).toBe(true);
    expect(
      grounded.every((footprint) =>
        footprint.polygon.every(
          (point) => point[2] === footprint.baseElevation - sourceGround
        )
      )
    ).toBe(true);
    expect(grounded.map((fp) => fp.baseElevation)).toEqual(
      source.map((fp) => fp.baseElevation)
    );
  });

  it('clamps each group to terrain while preserving stacked part offsets', () => {
    const { doc, id } = makeEditableBuilding({ baseElevation: 37 });
    splitBuildingByFloor(doc, id, 4);

    const source = extractFootprints(doc).filter((fp) => fp.parentId === id);
    const sourceGround = Math.min(...source.map((fp) => fp.baseElevation));
    const clamped = clampFootprintsToTerrain(source, () => 8.5);

    expect(Math.min(...clamped.map((fp) => fp.baseElevation))).toBe(8.5);
    expect(clamped[0].polygon.every((point) => point[2] === 8.5)).toBe(true);
    expect(clamped.map((fp) => fp.baseElevation - 8.5)).toEqual(
      source.map((fp) => fp.baseElevation - sourceGround)
    );
  });

  it('keeps a combined parent footprint available for parametrisation', () => {
    const { doc, id } = makeEditableBuilding();
    splitBuildingByFloor(doc, id, 3);

    const fp = extractFootprintForId(doc, id);
    expect(fp?.id).toBe(id);
    expect(fp?.parentId).toBeUndefined();
    expect(fp?.polygon[0]).toHaveLength(3);
    expect(fp?.height).toBeGreaterThan(9);
  });
});

describe('filterToBuilding', () => {
  it('keeps only the specified building', () => {
    const doc = buildSampleCube();
    // add a second building
    doc.CityObjects.Building_B = { type: 'Building', attributes: {} };
    const filtered = filterToBuilding(doc, 'Building_A');
    expect(Object.keys(filtered.CityObjects)).toEqual(['Building_A']);
  });

  it('keeps BuildingParts when they are children of the target', () => {
    const doc = buildSampleCube() as CityJsonDocument;
    doc.CityObjects.Building_A.children = ['BuildingPart_1'];
    doc.CityObjects.BuildingPart_1 = {
      type: 'BuildingPart',
      parents: ['Building_A'],
    };
    const filtered = filterToBuilding(doc, 'Building_A');
    expect(Object.keys(filtered.CityObjects).sort()).toEqual([
      'BuildingPart_1',
      'Building_A',
    ]);
  });

  it('preserves vertices and metadata', () => {
    const doc = buildSampleCube();
    const filtered = filterToBuilding(doc, 'Building_A');
    expect(filtered.vertices).toEqual(doc.vertices);
    expect(filtered.vertices).not.toBe(doc.vertices);
    expect(filtered.version).toBe(doc.version);
    expect(filtered.transform).toEqual(doc.transform);
    expect(filtered.transform).not.toBe(doc.transform);
    expect(filtered.metadata).toEqual(doc.metadata);
    expect(filtered.metadata).not.toBe(doc.metadata);
  });

  it('isolates the filtered detail document from loader-style mutations', () => {
    const doc = buildSampleCube();
    const filtered = filterToBuilding(doc, 'Building_A');
    const originalGeometry = doc.CityObjects.Building_A.geometry?.[0] as {
      semantics?: { values?: unknown };
    };
    const filteredGeometry = filtered.CityObjects.Building_A.geometry?.[0] as {
      semantics?: { values?: unknown };
    };

    expect(filtered.CityObjects.Building_A).not.toBe(doc.CityObjects.Building_A);
    expect(filteredGeometry).not.toBe(originalGeometry);
    filteredGeometry.semantics!.values = (filteredGeometry.semantics!.values as number[][])[0];

    expect(originalGeometry.semantics?.values).toEqual([[0, 1, 2, 2, 2, 2]]);
    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
  });
});
