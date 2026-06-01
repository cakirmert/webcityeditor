import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { generateBuilding, type NewBuildingParams } from './generator';
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

  it.each(['flat', 'pyramid', 'gable', 'hip'] as const)(
    'rejects the previous zero-thickness %s eave-overhang Solid',
    (roofType) => {
      expect(() =>
        generateBuilding(
          buildSampleCube(),
          baseParams({
            roofType,
            eaveHeight: roofType === 'flat' ? 9 : 6,
            ridgeHeight: 9,
            eaveOverhang: 0.4,
          })
        )
      ).toThrow(/temporarily disabled.*ISO 19107/i);
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
    ).toThrow(/temporarily disabled.*roof-slab/i);
  });
});
