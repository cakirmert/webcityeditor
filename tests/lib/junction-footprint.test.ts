import { describe, expect, it } from 'vitest';
import { validateJunctionFootprint, type JunctionFootprint, type JunctionPoint } from '../../src/lib/junction-footprint';

const ring = (points: number[][]): JunctionPoint[] => points.map(([x, y]) => [10 + x / 66000, 53.5 + y / 110540]);
const shape = (holes: number[][][] = []): JunctionFootprint => ({ polygon: ring([[0, 0], [20, 0], [20, 20], [0, 20]]), holes: holes.map(ring), source: 'drawn' });

describe('traced intersection outlines', () => {
  it('accepts a simple kerb with separate enclosed islands', () => {
    expect(validateJunctionFootprint(shape([[[2, 2], [5, 2], [5, 5], [2, 5]], [[12, 12], [15, 12], [15, 15]]]))).toBeUndefined();
  });
  it('rejects a crossing boundary, repeated edge and oversized trace', () => {
    expect(validateJunctionFootprint({ ...shape(), polygon: ring([[0, 0], [20, 20], [20, 0], [0, 20]]) })).toMatch(/crosses itself/);
    expect(validateJunctionFootprint({ ...shape(), polygon: ring([[0, 0], [20, 0], [20, 0], [0, 20]]) })).toMatch(/repeats a point/);
    expect(validateJunctionFootprint({ ...shape(), polygon: ring([[0, 0], [300, 0], [300, 20]]) })).toMatch(/240 metres/);
  });
  it('refuses islands outside or touching the kerb, and overlapping islands', () => {
    expect(validateJunctionFootprint(shape([[[18, 18], [25, 18], [18, 25]]]))).toMatch(/entirely inside/);
    expect(validateJunctionFootprint(shape([[[0, 1], [3, 1], [3, 3]]]))).toMatch(/without touching/);
    expect(validateJunctionFootprint(shape([[[2, 2], [8, 2], [8, 8], [2, 8]], [[6, 6], [10, 6], [10, 10]]]))).toMatch(/overlap/);
  });
  it('validates closed imported rings and rejects malformed coordinates', () => {
    const closed = shape(); closed.polygon.push(closed.polygon[0]);
    expect(validateJunctionFootprint(closed)).toBeUndefined();
    expect(validateJunctionFootprint({ ...closed, holes: null })).toBeDefined();
    expect(validateJunctionFootprint({ ...closed, polygon: [[NaN, 1], [0, 0], [0, 1]] })).toBeDefined();
  });
});
