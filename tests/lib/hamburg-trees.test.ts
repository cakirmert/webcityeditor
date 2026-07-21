import { describe, expect, it } from 'vitest';
import {
  parseHamburgCityTrees,
  TREE_CROWN_MESHES,
  treeCrownForm,
  treeCrownScale,
  treePositionOnTerrain,
} from '../../src/lib/hamburg-trees';

describe('Hamburg street-tree display grounding', () => {
  it('renders the surveyed elevation in the Hamburg terrain datum', () => {
    const [tree] = parseHamburgCityTrees({
      type: 'HamburgCityCenterTrees',
      trees: [
        {
          id: 'tree-1',
          position: [9.99, 53.55, 12.75],
          height: 8,
          crownDiameter: 4,
          trunkRadius: 0.2,
          species: 'Tilia',
          genus: 'Tilia',
          plantingYear: 2000,
          street: 'Teststrasse',
        },
      ],
    });

    expect(tree.position).toEqual([9.99, 53.55, 12.75]);
    expect(treePositionOnTerrain(tree)).toEqual([9.99, 53.55, 12.75]);
  });

  it('chooses distinct crown forms from official genus data', () => {
    const base = {
      id: 'tree',
      position: [9.99, 53.55, 0] as [number, number, number],
      height: 14,
      crownDiameter: 8,
      trunkRadius: 0.25,
      species: '',
      plantingYear: 1990,
      street: 'Teststrasse',
    };

    expect(treeCrownForm({ ...base, genus: 'Tilia / Linde' })).toBe('rounded');
    expect(treeCrownForm({ ...base, genus: 'Quercus / Eiche' })).toBe('spreading');
    expect(treeCrownForm({ ...base, genus: 'Betula / Birke' })).toBe('columnar');
    expect(treeCrownForm({ ...base, genus: 'Thuja / Lebensbaum' })).toBe('conical');
    expect(treeCrownScale({ ...base, genus: 'Quercus / Eiche' })[2]).toBeCloseTo(7.56);
  });

  it('uses smoother crown meshes than the old ten-sided five-ring placeholder', () => {
    for (const mesh of Object.values(TREE_CROWN_MESHES)) {
      expect(mesh.attributes.positions.value.length / 3).toBeGreaterThan(100);
      expect(mesh.indices.value.length / 3).toBeGreaterThan(200);
    }
  });
});
