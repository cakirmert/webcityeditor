import { describe, expect, it } from 'vitest';
import { buildLaneConnectorSurface } from '../../src/lib/road-connection-surfaces';

describe('lane connector surfaces', () => {
  it('builds a closed tapered polygon without mutating the movement path', () => {
    const path: [number, number][] = [
      [9.99, 53.55],
      [9.9901, 53.55003],
      [9.9902, 53.55],
    ];
    const original = structuredClone(path);
    const polygon = buildLaneConnectorSurface({
      path,
      sourceWidthM: 3,
      targetWidthM: 4,
    });

    expect(path).toEqual(original);
    expect(polygon.length).toBe(7);
    expect(polygon[0]).toEqual(polygon.at(-1));
    expect(polygon.flat().every(Number.isFinite)).toBe(true);
  });

  it('rejects collapsed paths and invalid widths', () => {
    expect(
      buildLaneConnectorSurface({
        path: [[9.99, 53.55], [9.99, 53.55]],
        sourceWidthM: 3,
        targetWidthM: 3,
      })
    ).toEqual([]);
    expect(
      buildLaneConnectorSurface({
        path: [[9.99, 53.55], [9.991, 53.55]],
        sourceWidthM: 0,
        targetWidthM: 3,
      })
    ).toEqual([]);
  });
});
