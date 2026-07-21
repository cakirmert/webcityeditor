import { describe, expect, it } from 'vitest';
import {
  hamburgLod3CoversPoint,
  hamburgLod3YUpToEditorZUp,
  isHamburgOfficialBuildingId,
} from '../../src/lib/hamburg-lod3-tiles';

describe('Hamburg untextured LoD3 helpers', () => {
  it('recognises Hamburg object ids and rejects unrelated objects', () => {
    expect(isHamburgOfficialBuildingId('DEHHALKAJ00058sn')).toBe(true);
    expect(isHamburgOfficialBuildingId('building-42')).toBe(false);
  });

  it('limits detail requests to the official Hamburg coverage', () => {
    expect(hamburgLod3CoversPoint([10.01, 53.54])).toBe(true);
    expect(hamburgLod3CoversPoint([13.4, 52.52])).toBe(false);
  });

  it('turns glTF Y-up building height into editor Z-up height', () => {
    expect(hamburgLod3YUpToEditorZUp([12, 7, 80])).toEqual([12, -80, 7]);
  });
});
