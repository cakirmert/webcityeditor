import { describe, expect, it } from 'vitest';
import { parseCityJsonSeq } from './cityjson';
import { extractFootprints } from './footprints';

/**
 * Regression: Hamburg LoD 2 CityJSONSeq has BuildingParts whose `parents` id
 * is only declared at the feature level and NOT in the feature's CityObjects.
 * Without intervention, extractFootprints would return nothing and the map
 * would never focus on the dataset.
 *
 * These tests pin the workaround in place.
 */
describe('CityJSONSeq: synthesized Building parent', () => {
  const hamburgLike = [
    {
      type: 'CityJSON',
      version: '2.0',
      transform: { scale: [0.001, 0.001, 0.001], translate: [565794.556, 5936653.983, 18.807] },
      CityObjects: {},
      vertices: [],
      metadata: { referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832' },
    },
    {
      type: 'CityJSONFeature',
      id: 'DEHH_implicit_parent_A',
      CityObjects: {
        DEHH_part_1: {
          type: 'BuildingPart',
          parents: ['DEHH_implicit_parent_A'],
          attributes: { measuredHeight: 16.5, storeysAboveGround: 3, roofType: '2100' },
          geometry: [
            {
              type: 'Solid',
              lod: '2',
              boundaries: [[[[0, 1, 2, 3]], [[4, 5, 6, 7]], [[0, 1, 5, 4]]]],
              semantics: {
                surfaces: [
                  { type: 'GroundSurface' },
                  { type: 'RoofSurface' },
                  { type: 'WallSurface' },
                ],
                values: [[0, 1, 2]],
              },
            },
          ],
        },
      },
      vertices: [
        [0, 0, 0],
        [10000, 0, 0],
        [10000, 8000, 0],
        [0, 8000, 0],
        [0, 0, 10000],
        [10000, 0, 10000],
        [10000, 8000, 10000],
        [0, 8000, 10000],
      ],
    },
  ]
    .map((x) => JSON.stringify(x))
    .join('\n');

  it('synthesizes a Building parent when the feature id is not in CityObjects', () => {
    const result = parseCityJsonSeq(hamburgLike);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parent = result.doc.CityObjects.DEHH_implicit_parent_A;
    expect(parent).toBeDefined();
    expect(parent.type).toBe('Building');
    expect(parent.children).toEqual(['DEHH_part_1']);
  });

  it('inherits attributes from child parts (so click-edit shows something useful)', () => {
    const result = parseCityJsonSeq(hamburgLike);
    if (!result.ok) throw new Error(result.error);
    const parent = result.doc.CityObjects.DEHH_implicit_parent_A;
    expect(parent.attributes?.measuredHeight).toBe(16.5);
    expect(parent.attributes?.storeysAboveGround).toBe(3);
    expect(parent.attributes?.roofType).toBe('2100');
  });

  it('extractFootprints now returns a footprint for the synthesized parent', () => {
    const result = parseCityJsonSeq(hamburgLike);
    if (!result.ok) throw new Error(result.error);
    const fps = extractFootprints(result.doc);
    expect(fps).toHaveLength(1);
    expect(fps[0].id).toBe('DEHH_implicit_parent_A');
    // Coords in Hamburg (near 10°E, 53.6°N)
    const [lng, lat] = fps[0].polygon[0];
    expect(lng).toBeGreaterThan(9);
    expect(lng).toBeLessThan(11);
    expect(lat).toBeGreaterThan(53);
    expect(lat).toBeLessThan(54);
  });

  it('does not synthesize when the Building parent is already present (regular CityJSONSeq)', () => {
    const normalSeq = [
      {
        type: 'CityJSON',
        version: '2.0',
        transform: { scale: [1, 1, 1], translate: [0, 0, 0] },
        CityObjects: {},
        vertices: [],
      },
      {
        type: 'CityJSONFeature',
        id: 'Building_1',
        CityObjects: {
          Building_1: {
            type: 'Building',
            children: ['Part_1'],
            attributes: { measuredHeight: 5 },
          },
          Part_1: {
            type: 'BuildingPart',
            parents: ['Building_1'],
            attributes: {},
          },
        },
        vertices: [],
      },
    ]
      .map((x) => JSON.stringify(x))
      .join('\n');

    const result = parseCityJsonSeq(normalSeq);
    if (!result.ok) throw new Error(result.error);
    // The original Building_1 entry isn't overwritten with a stub
    expect(result.doc.CityObjects.Building_1.attributes?.measuredHeight).toBe(5);
    expect(result.doc.CityObjects.Building_1.children).toEqual(['Part_1']);
  });
});
