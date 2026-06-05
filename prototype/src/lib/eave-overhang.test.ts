import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import { prepareValidatedCityJsonExport } from './export-validation';
import './projection';

function baseParams(overrides: Partial<NewBuildingParams> = {}): NewBuildingParams {
  return {
    targetCrs: 'EPSG:28992',
    footprintWgs84: [
      [4.3571, 52.0116],
      [4.35734, 52.0116],
      [4.35734, 52.0117],
      [4.3571, 52.0117],
    ],
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  };
}

describe('roof overhang validity gate', () => {
  it('keeps the validated zero-overhang flat topology', () => {
    const result = generateBuilding(buildSampleCube(), baseParams());
    const geometry = result.cityObject.geometry![0] as {
      lod: string;
      boundaries: number[][][][];
      semantics: { surfaces: Array<{ type: string }> };
    };

    expect(geometry.lod).toBe('2.0');
    expect(geometry.boundaries[0]).toHaveLength(6);
    expect(geometry.semantics.surfaces.map((surface) => surface.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
    ]);
  });

  it('emits a validated finite roof slab for flat eave overhangs', () => {
    const doc = buildSampleCube();
    const result = generateBuilding(
      doc,
      baseParams({
        eaveOverhang: 0.4,
      })
    );
    insertBuilding(doc, result);
    const geometry = result.cityObject.geometry![0] as {
      lod: string;
      boundaries: number[][][][];
      semantics: { surfaces: Array<{ type: string }>; values: number[][] };
    };
    const surfaceTypes = geometry.semantics.surfaces.map((surface) => surface.type);
    const shell = geometry.boundaries[0];

    expect(geometry.lod).toBe('2.2');
    expect(shell).toHaveLength(14);
    expect(surfaceTypes).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'OuterCeilingSurface',
    ]);
    expect(geometry.semantics.values[0]).toHaveLength(shell.length);
    expect(geometry.semantics.values[0].filter((value) => value === 3)).toHaveLength(4);

    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
  });

  it.each(['pyramid', 'gable', 'hip'] as const)(
    'keeps %s eave overhang disabled until pitched roof slabs are validated',
    (roofType) => {
      expect(() =>
        generateBuilding(
          buildSampleCube(),
          baseParams({
            roofType,
            eaveHeight: 6,
            ridgeHeight: 9,
            eaveOverhang: 0.4,
          })
        )
      ).toThrow(/Pitched roof eave overhang.*temporarily disabled/i);
    }
  );

  it('rejects rake overhang until a validated roof-slab model is available', () => {
    expect(() =>
      generateBuilding(
        buildSampleCube(),
        baseParams({
          roofType: 'gable',
          eaveHeight: 6,
          ridgeHeight: 9,
          rakeOverhang: 0.5,
        })
      )
    ).toThrow(/Rake overhang.*temporarily disabled/i);
  });

  it('rejects invalid flat overhang offsets before export', () => {
    expect(() =>
      generateBuilding(
        buildSampleCube(),
        baseParams({
          footprintWgs84: [
            [4.3571, 52.0116],
            [4.3572, 52.0116],
            [4.3572, 52.0116],
            [4.3571, 52.0117],
          ],
          eaveOverhang: 0.4,
        })
      )
    ).toThrow(/non-degenerate|invalid offset/i);
  });
});
