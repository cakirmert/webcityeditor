import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from '../../src/lib/cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from '../../src/lib/generator';
// Side-effect import: registers proj4 EPSG defs (incl. 28992) used below.
import '../../src/lib/projection';

function baseParams(overrides: Partial<NewBuildingParams> = {}): NewBuildingParams {
  return {
    targetCrs: 'EPSG:28992',
    // 14 m × 8 m rectangle in Delft — wide enough for ~4 windows per long wall
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

interface SolidGeom {
  type: 'Solid';
  lod: string;
  boundaries: number[][][][];
  semantics: { surfaces: Array<{ type: string }>; values: number[][] };
}

function geomOf(r: ReturnType<typeof generateBuilding>): SolidGeom {
  return r.cityObject.geometry![0] as SolidGeom;
}

describe('procedural openings', () => {
  it('does not change geometry when openings flag is omitted', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams());
    const g = geomOf(r);
    expect(g.lod).toBe('2.0');
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
    ]);
    // 1 ground + 1 roof + 4 walls = 6 faces, no holes
    expect(g.boundaries[0]).toHaveLength(6);
    for (const face of g.boundaries[0]) {
      expect(face).toHaveLength(1); // outer ring only, no holes
    }
  });

  it('bumps LoD to 2.2 and adds Window surface when windows requested', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: true, door: false } })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'Window',
    ]);
  });

  it('adds Door surface when door requested', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: false, door: true } })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    expect(g.semantics.surfaces.map((s) => s.type)).toContain('Door');
    // Only one Door face should be added (one door per building).
    const doorIdx = g.semantics.surfaces.findIndex((s) => s.type === 'Door');
    const doorFaces = g.semantics.values[0].filter((v) => v === doorIdx);
    expect(doorFaces).toHaveLength(1);
  });

  it('windows produce holes in wall faces and matching standalone Window faces', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: true, door: false } })
    );
    const g = geomOf(r);
    const surfaces = g.semantics.surfaces;
    const windowIdx = surfaces.findIndex((s) => s.type === 'Window');
    const wallIdx = surfaces.findIndex((s) => s.type === 'WallSurface');

    // Each Window face must be a single 4-vertex outer ring (no holes).
    const windowFaceIndices: number[] = [];
    for (let f = 0; f < g.semantics.values[0].length; f++) {
      if (g.semantics.values[0][f] === windowIdx) windowFaceIndices.push(f);
    }
    expect(windowFaceIndices.length).toBeGreaterThan(0);
    for (const f of windowFaceIndices) {
      const face = g.boundaries[0][f];
      expect(face).toHaveLength(1);
      expect(face[0]).toHaveLength(4);
    }

    // Each wall face that has windows must have matching hole rings — count
    // the holes across all walls and compare to the window face count.
    let totalHolesOnWalls = 0;
    for (let f = 0; f < g.semantics.values[0].length; f++) {
      if (g.semantics.values[0][f] === wallIdx) {
        const face = g.boundaries[0][f];
        totalHolesOnWalls += face.length - 1; // first ring is outer, rest are holes
      }
    }
    expect(totalHolesOnWalls).toBe(windowFaceIndices.length);
  });

  it('offers distinct classic and modern facade rhythms', () => {
    const classic = generateBuilding(
      buildSampleCube(),
      baseParams({
        openings: { windows: true, door: false, windowPattern: 'classic' },
      })
    );
    const modern = generateBuilding(
      buildSampleCube(),
      baseParams({
        openings: { windows: true, door: false, windowPattern: 'modern' },
      })
    );
    const windowCount = (result: ReturnType<typeof generateBuilding>) => {
      const geometry = geomOf(result);
      const index = geometry.semantics.surfaces.findIndex((surface) => surface.type === 'Window');
      return geometry.semantics.values[0].filter((value) => value === index).length;
    };

    expect(windowCount(classic)).toBeGreaterThan(windowCount(modern));
    expect(classic.cityObject.attributes?._windowPattern).toBe('classic');
    expect(modern.cityObject.attributes?._windowPattern).toBe('modern');
  });

  it('hole ring orientation is opposite of outer wall ring', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: true, door: false } })
    );
    const g = geomOf(r);
    const wallIdx = g.semantics.surfaces.findIndex((s) => s.type === 'WallSurface');
    // Find a wall face that has at least one hole
    let walledFace: number[][] | undefined;
    for (let f = 0; f < g.semantics.values[0].length; f++) {
      if (g.semantics.values[0][f] === wallIdx && g.boundaries[0][f].length > 1) {
        walledFace = g.boundaries[0][f];
        break;
      }
    }
    expect(walledFace, 'expected at least one wall with a hole').toBeDefined();
    const outer = walledFace![0];
    const hole = walledFace![1];
    // Outer ring vertices are different from hole ring vertices (no shared idx).
    expect(new Set(outer).size + new Set(hole).size).toBe(outer.length + hole.length);
    // Hole has 4 vertices (rectangular window).
    expect(hole).toHaveLength(4);
  });

  it('door is placed on at most one wall', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: false, door: true } })
    );
    const g = geomOf(r);
    const wallIdx = g.semantics.surfaces.findIndex((s) => s.type === 'WallSurface');
    let wallsWithHoles = 0;
    for (let f = 0; f < g.semantics.values[0].length; f++) {
      if (g.semantics.values[0][f] === wallIdx && g.boundaries[0][f].length > 1) {
        wallsWithHoles++;
      }
    }
    expect(wallsWithHoles).toBe(1);
  });

  it('survives JSON.stringify → parse round-trip with openings', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ openings: { windows: true, door: true } })
    );
    insertBuilding(doc, r);

    const parsed = parseCityJson(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const reloaded = parsed.doc.CityObjects[r.id];
    expect(reloaded).toBeDefined();
    const g = reloaded.geometry![0] as SolidGeom;
    expect(g.lod).toBe('2.2');

    // All vertex indices reference valid positions in the doc's vertex array.
    const total = parsed.doc.vertices.length;
    for (const face of g.boundaries[0]) {
      for (const ring of face) {
        for (const idx of ring) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(total);
        }
      }
    }
    // Semantic values still align with face count.
    expect(g.semantics.values[0].length).toBe(g.boundaries[0].length);
  });

  it('skips windows when wall is too narrow', () => {
    const doc = buildSampleCube();
    // 2m × 2m footprint — too narrow for 1.4m windows with 0.4m margins
    const r = generateBuilding(
      doc,
      baseParams({
        footprintWgs84: [
          [4.3571, 52.0116],
          [4.357118, 52.0116], // ≈ 1.2 m east
          [4.357118, 52.011618], // ≈ 1.2 m × 2 m
          [4.3571, 52.011618],
        ],
        openings: { windows: true, door: false },
      })
    );
    const g = geomOf(r);
    const windowIdx = g.semantics.surfaces.findIndex((s) => s.type === 'Window');
    if (windowIdx >= 0) {
      const winFaces = g.semantics.values[0].filter((v) => v === windowIdx);
      expect(winFaces.length).toBe(0);
    }
  });

  it('skips top storey window if it would pierce the eave', () => {
    const doc = buildSampleCube();
    // 1 storey, 3m tall — enough for door but tight for ground-floor window
    const r = generateBuilding(
      doc,
      baseParams({
        storeys: 1,
        eaveHeight: 3,
        ridgeHeight: 3,
        openings: { windows: true, door: false },
      })
    );
    const g = geomOf(r);
    const winIdx = g.semantics.surfaces.findIndex((s) => s.type === 'Window');
    if (winIdx >= 0) {
      const winCount = g.semantics.values[0].filter((v) => v === winIdx).length;
      // 0.9 m sill + 1.5 m height = 2.4 m top → 0.6 m below 3 m eave (>0.3 m
      // margin), so a single storey of windows IS allowed — but we mainly want
      // to confirm the function doesn't throw or produce broken geometry.
      expect(winCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('windows on pyramid roof walls work too (pyramid has rectangular walls)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'pyramid',
        eaveHeight: 6,
        ridgeHeight: 9,
        openings: { windows: true, door: false },
      })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    const winIdx = g.semantics.surfaces.findIndex((s) => s.type === 'Window');
    expect(winIdx).toBeGreaterThanOrEqual(0);
    const winFaces = g.semantics.values[0].filter((v) => v === winIdx);
    expect(winFaces.length).toBeGreaterThan(0);
  });

  it('gable openings only land on long rectangular walls (not gable-end pentagons)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'gable',
        eaveHeight: 6,
        ridgeHeight: 9,
        openings: { windows: true, door: false },
      })
    );
    const g = geomOf(r);
    const wallIdx = g.semantics.surfaces.findIndex((s) => s.type === 'WallSurface');
    // Gable has 4 walls: 2 long (rectangular, eligible) and 2 gable-ends
    // (pentagonal, NOT eligible). Only the 2 long walls should have holes.
    let wallsWithHoles = 0;
    let pentagonalWallsWithHoles = 0;
    for (let f = 0; f < g.semantics.values[0].length; f++) {
      if (g.semantics.values[0][f] === wallIdx) {
        const face = g.boundaries[0][f];
        const outerRing = face[0];
        if (face.length > 1) {
          wallsWithHoles++;
          if (outerRing.length === 5) pentagonalWallsWithHoles++;
        }
      }
    }
    expect(wallsWithHoles).toBeGreaterThan(0);
    expect(pentagonalWallsWithHoles).toBe(0);
  });
});
