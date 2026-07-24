import { describe, expect, it } from 'vitest';
import { buildLaneConnectorSurface } from '../../src/lib/road-connection-surfaces';

const metresPerLat = 110_540;
const metresPerLng = 111_320 * Math.cos((53.55 * Math.PI) / 180);

function distanceMeters(
  left: [number, number],
  right: [number, number]
): number {
  return Math.hypot(
    (right[0] - left[0]) * metresPerLng,
    (right[1] - left[1]) * metresPerLat
  );
}

describe('confirmed lane connector surfaces', () => {
  it('builds a closed polygon tapered to the source and target lane widths', () => {
    const surface = buildLaneConnectorSurface({
      path: [
        [10, 53.55],
        [10.00008, 53.55],
        [10.00016, 53.55],
      ],
      sourceWidthM: 4,
      targetWidthM: 2,
    });

    expect(surface).toHaveLength(7);
    expect(surface.at(-1)).toEqual(surface[0]);
    expect(distanceMeters(surface[0], surface[5])).toBeCloseTo(4, 1);
    expect(distanceMeters(surface[2], surface[3])).toBeCloseTo(2, 1);
  });

  it('keeps a curved connector finite and non-degenerate', () => {
    const surface = buildLaneConnectorSurface({
      path: [
        [10, 53.55],
        [10.00005, 53.55003],
        [10.00008, 53.5501],
      ],
      sourceWidthM: 3.2,
      targetWidthM: 3.2,
    });

    expect(surface).toHaveLength(7);
    expect(surface.flat().every(Number.isFinite)).toBe(true);
    expect(new Set(surface.map((point) => point.join(','))).size).toBeGreaterThan(4);
  });

  it('rejects missing geometry and invalid widths', () => {
    expect(
      buildLaneConnectorSurface({
        path: [[10, 53.55]],
        sourceWidthM: 3,
        targetWidthM: 3,
      })
    ).toEqual([]);
    expect(
      buildLaneConnectorSurface({
        path: [
          [10, 53.55],
          [10.0001, 53.55],
        ],
        sourceWidthM: 0,
        targetWidthM: 3,
      })
    ).toEqual([]);
  });
});
