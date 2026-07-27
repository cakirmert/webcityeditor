import { describe, expect, it } from 'vitest';
import {
  ROAD_CONNECTION_ACTIVE,
  ROAD_CONNECTION_CYAN,
  ROAD_CONNECTION_HALO,
} from '../../src/lib/road-connection-style';

function relativeLuminance([red, green, blue]: readonly number[]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(
  foreground: readonly number[],
  background: readonly number[]
): number {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background)
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background)
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe('road connection palette', () => {
  it('keeps the cyan stroke distinct over common junction and road colors', () => {
    const representativeBackgrounds = [
      [45, 49, 57],
      [190, 45, 55],
      [37, 99, 235],
      [100, 105, 115],
    ];

    for (const background of representativeBackgrounds) {
      expect(contrastRatio(ROAD_CONNECTION_CYAN, background)).toBeGreaterThanOrEqual(3);
    }
  });

  it('pairs pale-map visibility with a dark halo and a bright active stroke', () => {
    expect(contrastRatio(ROAD_CONNECTION_HALO, [245, 245, 245])).toBeGreaterThan(12);
    expect(contrastRatio(ROAD_CONNECTION_ACTIVE, ROAD_CONNECTION_HALO)).toBeGreaterThan(12);
  });
});
