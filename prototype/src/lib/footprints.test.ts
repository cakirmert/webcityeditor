import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { extractFootprints, filterToBuilding } from './footprints';
import type { CityJsonDocument } from '../types';

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
    expect(filtered.vertices).toBe(doc.vertices);
    expect(filtered.version).toBe(doc.version);
    expect(filtered.transform).toBe(doc.transform);
  });
});
