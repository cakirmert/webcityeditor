import { describe, expect, it } from 'vitest';
import {
  parseHamburgCityTrees,
  treePositionOnFlatGround,
} from '../../src/lib/hamburg-trees';

describe('Hamburg street-tree display grounding', () => {
  it('keeps the surveyed elevation in the source data but renders at z=0', () => {
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
    expect(treePositionOnFlatGround(tree)).toEqual([9.99, 53.55, 0]);
  });
});
