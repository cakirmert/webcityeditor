import { describe, expect, it } from 'vitest';
import {
  buildFootprintFromIfc,
  classifySurfaceFromNormal,
} from './ifc-import';

function meta(width: number, depth: number) {
  return { width, depth };
}

describe('buildFootprintFromIfc', () => {
  it('produces a 4-vertex rectangle centred on the placement point', () => {
    const fp = buildFootprintFromIfc(meta(20, 12), [4.3571, 52.0116]);
    expect(fp).toHaveLength(4);
    // First and third corners are diagonal — their average ≈ centre
    const cx = (fp[0][0] + fp[2][0]) / 2;
    const cy = (fp[0][1] + fp[2][1]) / 2;
    expect(cx).toBeCloseTo(4.3571, 4);
    expect(cy).toBeCloseTo(52.0116, 4);
  });

  it('rectangle dimensions in metres ≈ IFC width × depth', () => {
    const lat = 52.0116;
    const fp = buildFootprintFromIfc(meta(20, 12), [4.3571, lat]);
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
    const widthMetres = (fp[1][0] - fp[0][0]) * mPerDegLng;
    const depthMetres = (fp[2][1] - fp[1][1]) * mPerDegLat;
    expect(widthMetres).toBeCloseTo(20, 1);
    expect(depthMetres).toBeCloseTo(12, 1);
  });

  it('CCW winding in WGS84 (matches generator expectation)', () => {
    const fp = buildFootprintFromIfc(meta(10, 8), [4.3571, 52.0116]);
    // Shoelace area should be positive for CCW polygons in standard coords.
    let area = 0;
    for (let i = 0; i < fp.length; i++) {
      const j = (i + 1) % fp.length;
      area += fp[i][0] * fp[j][1] - fp[j][0] * fp[i][1];
    }
    expect(area).toBeGreaterThan(0);
  });

  it('returns 4 distinct corner points', () => {
    const fp = buildFootprintFromIfc(meta(10, 8), [4.3571, 52.0116]);
    const seen = new Set(fp.map((p) => p.join(',')));
    expect(seen.size).toBe(4);
  });

  it('width and depth are symmetric around the placement point', () => {
    const placement: [number, number] = [4.3571, 52.0116];
    const fp = buildFootprintFromIfc(meta(20, 12), placement);
    const minX = Math.min(...fp.map((p) => p[0]));
    const maxX = Math.max(...fp.map((p) => p[0]));
    const minY = Math.min(...fp.map((p) => p[1]));
    const maxY = Math.max(...fp.map((p) => p[1]));
    expect(maxX - placement[0]).toBeCloseTo(placement[0] - minX, 6);
    expect(maxY - placement[1]).toBeCloseTo(placement[1] - minY, 6);
  });
});

describe('classifySurfaceFromNormal', () => {
  it('strongly downward normal → GroundSurface', () => {
    expect(classifySurfaceFromNormal(-0.95)).toBe('GroundSurface');
    expect(classifySurfaceFromNormal(-1.0)).toBe('GroundSurface');
  });

  it('strongly upward normal → RoofSurface', () => {
    expect(classifySurfaceFromNormal(0.95)).toBe('RoofSurface');
    expect(classifySurfaceFromNormal(1.0)).toBe('RoofSurface');
  });

  it('horizontal-ish normal → WallSurface', () => {
    expect(classifySurfaceFromNormal(0)).toBe('WallSurface');
    expect(classifySurfaceFromNormal(0.5)).toBe('WallSurface');
    expect(classifySurfaceFromNormal(-0.5)).toBe('WallSurface');
  });

  it('the 0.7 threshold matches a 45° pitch — anything steeper is wall', () => {
    expect(classifySurfaceFromNormal(0.71)).toBe('RoofSurface');
    expect(classifySurfaceFromNormal(0.69)).toBe('WallSurface');
    expect(classifySurfaceFromNormal(-0.71)).toBe('GroundSurface');
    expect(classifySurfaceFromNormal(-0.69)).toBe('WallSurface');
  });
});
