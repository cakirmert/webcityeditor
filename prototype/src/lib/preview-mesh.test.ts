import { describe, expect, it } from 'vitest';
import { buildPreviewMesh } from './preview-mesh';
import './projection'; // side-effect: register EPSG defs

const RECT_DELFT: [number, number][] = [
  [4.3571, 52.0116],
  [4.35734, 52.0116],
  [4.35734, 52.0117],
  [4.3571, 52.0117],
];

function colorTriples(mesh: NonNullable<ReturnType<typeof buildPreviewMesh>>): string[] {
  // Group every 3 colour bytes into a single "r,g,b" string for set-equality.
  const out: string[] = [];
  for (let i = 0; i < mesh.colors.length; i += 3) {
    out.push(`${mesh.colors[i]},${mesh.colors[i + 1]},${mesh.colors[i + 2]}`);
  }
  return out;
}

describe('buildPreviewMesh flat overhang', () => {
  it('adds visible flat roof overhang slab geometry', () => {
    const baseline = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
    });
    const overhang = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      eaveOverhang: 0.4,
    });

    expect(baseline).not.toBeNull();
    expect(overhang).not.toBeNull();
    expect(overhang!.positions.length).toBeGreaterThan(baseline!.positions.length);
    expect(overhang!.anchorLngLat[0]).toBeCloseTo(baseline!.anchorLngLat[0], 6);
    expect(overhang!.anchorLngLat[1]).toBeCloseTo(baseline!.anchorLngLat[1], 6);
  });
});

describe('buildPreviewMesh — openings overlay', () => {
  it('omits window/door colours when openings are not requested', () => {
    const mesh = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
    });
    expect(mesh).not.toBeNull();
    const palette = new Set(colorTriples(mesh!));
    // No window blue, no door brown
    expect(palette.has('56,132,200')).toBe(false);
    expect(palette.has('82,50,30')).toBe(false);
  });

  it('emits window-blue vertices when windows are requested', () => {
    const mesh = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      openings: { windows: true, door: false },
    });
    expect(mesh).not.toBeNull();
    const palette = colorTriples(mesh!);
    const windowVerts = palette.filter((c) => c === '56,132,200').length;
    // Each window quad emits 6 vertices (faceFan splits a quad into 2 triangles
    // with 3 vertices each — 6 unique copies for clean per-face colouring).
    expect(windowVerts).toBeGreaterThan(0);
    expect(windowVerts % 6).toBe(0);
  });

  it('emits exactly one door (6 door-coloured vertices) when door is requested', () => {
    const mesh = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      openings: { windows: false, door: true },
    });
    expect(mesh).not.toBeNull();
    const doorVerts = colorTriples(mesh!).filter((c) => c === '82,50,30').length;
    expect(doorVerts).toBe(6);
  });

  it('emits both windows and door together with no overlap on the door wall', () => {
    const mesh = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      openings: { windows: true, door: true },
    });
    expect(mesh).not.toBeNull();
    const palette = colorTriples(mesh!);
    const winCount = palette.filter((c) => c === '56,132,200').length;
    const doorCount = palette.filter((c) => c === '82,50,30').length;
    expect(winCount).toBeGreaterThan(0);
    expect(doorCount).toBe(6);
  });

  it('skips windows on gable-end walls (preview matches generator behaviour)', () => {
    // 14 m × 8 m rectangle. With ridgeOnE0 = true (long axis = e0/e2),
    // walls 1 and 3 are gable-end pentagons in the real generator and must
    // be skipped by the preview overlay.
    const longRect: [number, number][] = [
      [4.3571, 52.0116],
      [4.357302, 52.0116], // ~14 m east
      [4.357302, 52.011672], // + 8 m north
      [4.3571, 52.011672],
    ];
    const gableMesh = buildPreviewMesh({
      footprintWgs84: longRect,
      targetCrs: 'EPSG:28992',
      eaveHeight: 6,
      ridgeHeight: 9,
      roofType: 'gable',
      storeys: 2,
      openings: { windows: true, door: false },
    });
    const flatMesh = buildPreviewMesh({
      footprintWgs84: longRect,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 2,
      openings: { windows: true, door: false },
    });
    expect(gableMesh).not.toBeNull();
    expect(flatMesh).not.toBeNull();
    const gableWindows = colorTriples(gableMesh!).filter((c) => c === '56,132,200').length;
    const flatWindows = colorTriples(flatMesh!).filter((c) => c === '56,132,200').length;
    // Flat covers 4 walls; gable should cover only the 2 long walls. Same
    // window-per-wall count means gable must produce roughly half.
    expect(gableWindows).toBeLessThan(flatWindows);
    expect(gableWindows).toBeGreaterThan(0);
  });

  it('skips ground-floor windows on the door wall to avoid overlap', () => {
    // With a single storey, the door takes the entire ground level on wall 0.
    // Compare windows-only vs windows+door for the same input — door+windows
    // should have fewer window quads on wall 0 than windows-only.
    const winOnly = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 6,
      ridgeHeight: 6,
      roofType: 'flat',
      storeys: 2,
      openings: { windows: true, door: false },
    });
    const winAndDoor = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 6,
      ridgeHeight: 6,
      roofType: 'flat',
      storeys: 2,
      openings: { windows: true, door: true },
    });
    const a = colorTriples(winOnly!).filter((c) => c === '56,132,200').length;
    const b = colorTriples(winAndDoor!).filter((c) => c === '56,132,200').length;
    expect(b).toBeLessThan(a);
  });

  it('skips windows when wall is too narrow', () => {
    // 1.2 m × 1.2 m — too narrow for a 1.4 m window with 0.4 m margins.
    const tinyRect: [number, number][] = [
      [4.3571, 52.0116],
      [4.357118, 52.0116],
      [4.357118, 52.011611],
      [4.3571, 52.011611],
    ];
    const mesh = buildPreviewMesh({
      footprintWgs84: tinyRect,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      openings: { windows: true, door: false },
    });
    expect(mesh).not.toBeNull();
    const winCount = colorTriples(mesh!).filter((c) => c === '56,132,200').length;
    expect(winCount).toBe(0);
  });

  it('preserves existing wall + roof + ground geometry when openings flag is on', () => {
    const baseline = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
    });
    const withOpenings = buildPreviewMesh({
      footprintWgs84: RECT_DELFT,
      targetCrs: 'EPSG:28992',
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
      storeys: 3,
      openings: { windows: true, door: true },
    });
    expect(baseline).not.toBeNull();
    expect(withOpenings).not.toBeNull();
    // The openings version must have STRICTLY MORE vertices (windows + door
    // are additive overlays, never replacements).
    expect(withOpenings!.positions.length).toBeGreaterThan(baseline!.positions.length);
    // Same anchor (centroid of the same footprint).
    expect(withOpenings!.anchorLngLat[0]).toBeCloseTo(baseline!.anchorLngLat[0], 6);
    expect(withOpenings!.anchorLngLat[1]).toBeCloseTo(baseline!.anchorLngLat[1], 6);
  });
});
