import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import './projection'; // side-effect: register EPSG defs

function baseParams(overrides: Partial<NewBuildingParams> = {}): NewBuildingParams {
  return {
    targetCrs: 'EPSG:28992',
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

describe('LoD 2.2 eave overhang (flat roofs)', () => {
  it('zero overhang produces identical topology to before — no soffits, LoD 2.0', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams({ eaveOverhang: 0 }));
    const g = geomOf(r);
    expect(g.lod).toBe('2.0');
    // 1 ground + 1 roof + 4 walls = 6 faces, no soffits
    expect(g.boundaries[0]).toHaveLength(6);
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
    ]);
    // 4 ground + 4 wall-top = 8 vertices (no roof-edge ring)
    expect(r.newVertices).toHaveLength(8);
  });

  it('positive overhang adds 4 soffit faces, OuterCeilingSurface, and bumps LoD to 2.2', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams({ eaveOverhang: 0.4 }));
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    // 1 ground + 1 roof + 4 walls + 4 soffits = 10 faces
    expect(g.boundaries[0]).toHaveLength(10);
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'OuterCeilingSurface',
    ]);
    // 4 ground + 4 wall-top + 4 roof-edge = 12 vertices
    expect(r.newVertices).toHaveLength(12);
    // Last 4 faces should be the soffits (semantics index 3)
    const sem = g.semantics.values[0];
    expect(sem.slice(0, 6)).toEqual([0, 1, 2, 2, 2, 2]);
    expect(sem.slice(6)).toEqual([3, 3, 3, 3]);
  });

  it('overhang offsets roof-edge vertices outward in projected XY space', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams({ eaveOverhang: 0.5 }));
    // Vertices come out as integer-encoded; decode using doc transform.
    const t = doc.transform!;
    const decode = (v: [number, number, number]): [number, number, number] => [
      v[0] * t.scale[0] + t.translate[0],
      v[1] * t.scale[1] + t.translate[1],
      v[2] * t.scale[2] + t.translate[2],
    ];
    const all = r.newVertices.map(decode);
    const ground = all.slice(0, 4);
    const wallTop = all.slice(4, 8);
    const roofEdge = all.slice(8, 12);

    // wall-top sits directly above ground (same XY, higher Z)
    for (let i = 0; i < 4; i++) {
      expect(wallTop[i][0]).toBeCloseTo(ground[i][0], 2);
      expect(wallTop[i][1]).toBeCloseTo(ground[i][1], 2);
      expect(wallTop[i][2]).toBeGreaterThan(ground[i][2]);
    }
    // roof-edge sits at the same Z as wall-top but offset outward by ~0.5 m
    for (let i = 0; i < 4; i++) {
      expect(roofEdge[i][2]).toBeCloseTo(wallTop[i][2], 1);
      const dx = roofEdge[i][0] - wallTop[i][0];
      const dy = roofEdge[i][1] - wallTop[i][1];
      const dist = Math.hypot(dx, dy);
      expect(dist).toBeGreaterThan(0.4);
      expect(dist).toBeLessThan(0.6);
    }
  });

  it('combines cleanly with procedural openings — LoD 2.2 + soffits + windows + door', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        eaveOverhang: 0.3,
        openings: { windows: true, door: true },
      })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    const types = g.semantics.surfaces.map((s) => s.type);
    expect(types).toContain('OuterCeilingSurface');
    expect(types).toContain('Window');
    expect(types).toContain('Door');
    // Surface order must be stable: ground, roof, wall, soffit, window, door
    expect(types.slice(0, 4)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'OuterCeilingSurface',
    ]);
    expect(types.indexOf('Window')).toBe(4);
    expect(types.indexOf('Door')).toBe(5);
    // Every face has a valid semantics index pointing into the surfaces array.
    for (const v of g.semantics.values[0]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(types.length);
    }
  });

  it('round-trips through JSON.stringify with overhang + openings', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        eaveOverhang: 0.3,
        openings: { windows: true, door: true },
      })
    );
    insertBuilding(doc, r);
    const parsed = parseCityJson(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const reloaded = parsed.doc.CityObjects[r.id];
    expect(reloaded).toBeDefined();
    const g = reloaded.geometry![0] as SolidGeom;
    expect(g.lod).toBe('2.2');
    // All vertex indices reference valid positions
    const total = parsed.doc.vertices.length;
    for (const face of g.boundaries[0]) {
      for (const ring of face) {
        for (const idx of ring) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(total);
        }
      }
    }
    // Semantics values still align with face count
    expect(g.semantics.values[0].length).toBe(g.boundaries[0].length);
  });

  it('pyramid overhang adds n soffits + OuterCeilingSurface, bumps LoD to 2.2', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'pyramid',
        eaveHeight: 6,
        ridgeHeight: 9,
        eaveOverhang: 0.5,
      })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'OuterCeilingSurface',
    ]);
    // 1 ground + 4 roof tris + 4 walls + 4 soffits = 13 faces (4-sided footprint)
    expect(g.boundaries[0]).toHaveLength(13);
    // Last 4 semantic indices = OuterCeilingSurface (3)
    const sem = g.semantics.values[0];
    expect(sem.slice(9)).toEqual([3, 3, 3, 3]);
    // 4 ground + 4 wall-top + 1 apex + 4 roof-edge = 13 vertices
    expect(r.newVertices).toHaveLength(13);
  });

  it('pyramid roof faces use roof-edge vertices when overhang > 0 (overhang visible)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'pyramid',
        eaveHeight: 6,
        ridgeHeight: 9,
        eaveOverhang: 0.5,
      })
    );
    const g = geomOf(r);
    // Roof faces are at boundaries[0][1..4]. Their vertex indices should NOT
    // overlap with the wall-top ring (which would mean no overhang). Wall-top
    // vertices live at vertexOffset+4..vertexOffset+7; roof-edge at +9..+12.
    const wallTopIdx = new Set([
      r.vertexOffset + 4,
      r.vertexOffset + 5,
      r.vertexOffset + 6,
      r.vertexOffset + 7,
    ]);
    let roofUsesWallTop = 0;
    for (let f = 1; f <= 4; f++) {
      for (const v of g.boundaries[0][f][0]) {
        if (wallTopIdx.has(v)) roofUsesWallTop++;
      }
    }
    expect(roofUsesWallTop).toBe(0);
  });

  it('hip overhang adds 4 soffits + OuterCeilingSurface, bumps LoD to 2.2', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'hip',
        eaveHeight: 6,
        ridgeHeight: 9,
        eaveOverhang: 0.4,
      })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.2');
    expect(g.semantics.surfaces.map((s) => s.type)).toEqual([
      'GroundSurface',
      'RoofSurface',
      'WallSurface',
      'OuterCeilingSurface',
    ]);
    // 1 ground + 4 roof (2 trap + 2 tri) + 4 walls + 4 soffits = 13 faces
    expect(g.boundaries[0]).toHaveLength(13);
    // Soffits are the last 4 faces
    expect(g.semantics.values[0].slice(9)).toEqual([3, 3, 3, 3]);
    // 4 ground + 4 wall-top + 2 ridge + 4 roof-edge = 14 vertices
    expect(r.newVertices).toHaveLength(14);
  });

  it('hip roof faces use roof-edge vertices (overhang visible) when overhang > 0', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'hip',
        eaveHeight: 6,
        ridgeHeight: 9,
        eaveOverhang: 0.4,
      })
    );
    const g = geomOf(r);
    // Wall-top vertices live at vertexOffset+4..vertexOffset+7. Roof faces
    // (boundaries[0][1..4]) must NOT contain any of those — they should use
    // roof-edge (offset 10..13) plus ridge (8, 9).
    const wallTopIdx = new Set([
      r.vertexOffset + 4,
      r.vertexOffset + 5,
      r.vertexOffset + 6,
      r.vertexOffset + 7,
    ]);
    let roofUsesWallTop = 0;
    for (let f = 1; f <= 4; f++) {
      for (const v of g.boundaries[0][f][0]) {
        if (wallTopIdx.has(v)) roofUsesWallTop++;
      }
    }
    expect(roofUsesWallTop).toBe(0);
  });

  it('overhang ignored on gable — falls back to LoD 2.0 (rake-vs-eave handling deferred)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        roofType: 'gable',
        eaveHeight: 6,
        ridgeHeight: 9,
        eaveOverhang: 0.3,
      })
    );
    const g = geomOf(r);
    expect(g.lod).toBe('2.0');
    expect(g.semantics.surfaces.map((s) => s.type)).not.toContain('OuterCeilingSurface');
  });
});
