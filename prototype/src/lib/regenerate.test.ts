import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import { regenerateBuilding } from './regenerate';
import { extractFootprints } from './footprints';
import { prepareValidatedCityJsonExport } from './export-validation';
import './projection'; // side-effect: register EPSG defs

const FP_DELFT_A: [number, number][] = [
  [4.3571, 52.0116],
  [4.35725, 52.0116],
  [4.35725, 52.01172],
  [4.3571, 52.01172],
];
const FP_DELFT_B_SHIFTED: [number, number][] = [
  // Same shape but shifted ~14 m east — visibly different, well past the
  // 4-decimal tolerance used in the test.
  [4.3573, 52.0116],
  [4.35745, 52.0116],
  [4.35745, 52.01172],
  [4.3573, 52.01172],
];

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const r = generateBuilding(doc, {
    targetCrs: 'EPSG:28992',
    footprintWgs84: FP_DELFT_A,
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  });
  const id = insertBuilding(doc, r);
  return { doc, id, vertexOffsetBefore: r.vertexOffset };
}

describe('regenerateBuilding', () => {
  it('rebuilds an editor-created building with a new footprint, preserving roof type & height', () => {
    const { doc, id } = makeBuilding();
    const heightBefore = doc.CityObjects[id].attributes?.measuredHeight;
    const fpsBefore = extractFootprints(doc);
    const polyBefore = fpsBefore.find((f) => f.id === id)!.polygon;

    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(true);

    // Same id, same height, same roofType
    expect(doc.CityObjects[id]).toBeDefined();
    expect(doc.CityObjects[id].attributes?.measuredHeight).toBe(heightBefore);
    expect(doc.CityObjects[id].attributes?.roofType).toBe('flat');

    // Footprint must have changed
    const fpsAfter = extractFootprints(doc);
    const polyAfter = fpsAfter.find((f) => f.id === id)!.polygon;
    expect(polyAfter[0][0]).not.toBeCloseTo(polyBefore[0][0], 4);
  });

  it('preserves user-facing attributes (function, year, etc.)', () => {
    const { doc, id } = makeBuilding();
    doc.CityObjects[id].attributes!.function = 'commercial';
    doc.CityObjects[id].attributes!.yearOfConstruction = 1992;
    doc.CityObjects[id].attributes!.notes = 'corner shop';

    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(true);

    const a = doc.CityObjects[id].attributes;
    expect(a?.function).toBe('commercial');
    expect(a?.yearOfConstruction).toBe(1992);
    expect(a?.notes).toBe('corner shop');
  });

  it('preserves opening choices across regeneration', () => {
    const { doc, id } = makeBuilding({
      openings: { windows: true, door: true },
    });
    const before = doc.CityObjects[id].geometry as Array<{ lod?: string }>;
    expect(before[0].lod).toBe('2.2');

    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(true);

    const after = doc.CityObjects[id].geometry as Array<{
      lod?: string;
      semantics?: { surfaces?: Array<{ type?: string }> };
    }>;
    // Still LoD 2.2 with Window/Door entries.
    expect(after[0].lod).toBe('2.2');
    const types = after[0].semantics?.surfaces?.map((s) => s?.type) ?? [];
    expect(types).toContain('Window');
    expect(types).toContain('Door');
  });

  it('preserves validated flat eave overhangs across regeneration', () => {
    const { doc, id } = makeBuilding();
    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED, { eaveOverhang: 0.4 });

    expect(res.ok).toBe(true);
    expect(doc.CityObjects[id].attributes?._eaveOverhang).toBe(0.4);
    const geometry = doc.CityObjects[id].geometry?.[0] as {
      lod?: string;
      semantics?: { surfaces?: Array<{ type?: string }> };
    };
    expect(geometry.lod).toBe('2.2');
    expect(geometry.semantics?.surfaces?.map((surface) => surface.type)).toContain(
      'OuterCeilingSurface'
    );
    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
  });

  it('rejects regeneration of an imported (non-editor) building with a friendly reason', () => {
    const doc = buildSampleCube();
    // The sample-cube's Building_A has no _createdBy — treat as imported.
    const res = regenerateBuilding(doc, 'Building_A', FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/only available for buildings created in the editor/);
  });

  it('rejects regeneration when the new footprint is degenerate', () => {
    const { doc, id } = makeBuilding();
    const res = regenerateBuilding(doc, id, [
      [4.3571, 52.0116],
      [4.35725, 52.0116],
    ]);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/at least 3/);
  });

  it('rejects regeneration of an already-split building', () => {
    const { doc, id } = makeBuilding();
    doc.CityObjects[id].children = ['fake-part-id'];
    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/split/);
  });

  it('rejects gable regeneration with a non-rectangular footprint', () => {
    const { doc, id } = makeBuilding({ roofType: 'gable', eaveHeight: 6, ridgeHeight: 9 });
    const triangle: [number, number][] = [
      [4.3571, 52.0116],
      [4.35725, 52.0116],
      [4.357175, 52.01172],
    ];
    const res = regenerateBuilding(doc, id, triangle);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/rectangular|4-vertex/);
  });

  it('reports the orphaned vertex range so a future compact pass can reclaim it', () => {
    const { doc, id } = makeBuilding();
    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(true);
    expect(res.orphanedVertexRange).toBeDefined();
    expect(res.orphanedVertexRange!.start).toBeGreaterThanOrEqual(0);
    expect(res.orphanedVertexRange!.end).toBeGreaterThan(res.orphanedVertexRange!.start);
  });

  it('survives JSON.stringify → parse round-trip after regeneration', () => {
    const { doc, id } = makeBuilding();
    const res = regenerateBuilding(doc, id, FP_DELFT_B_SHIFTED);
    expect(res.ok).toBe(true);
    const parsed = parseCityJson(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const reloaded = parsed.doc.CityObjects[id];
    expect(reloaded).toBeDefined();
    // All vertex indices in the new geometry are valid in the reloaded doc.
    const total = parsed.doc.vertices.length;
    const geom = reloaded.geometry![0] as { boundaries: number[][][][] };
    for (const shell of geom.boundaries) {
      for (const face of shell) {
        for (const ring of face) {
          for (const v of ring) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(total);
          }
        }
      }
    }
  });

  it('honours `overrides.roofType` to switch from flat to pitched', () => {
    const { doc, id } = makeBuilding({ roofType: 'flat', eaveHeight: 9, ridgeHeight: 9 });
    const res = regenerateBuilding(doc, id, FP_DELFT_A, { roofType: 'gable' });
    expect(res.ok).toBe(true);
    expect(doc.CityObjects[id].attributes?.roofType).toBe('gable');
    // Ridge must now be strictly greater than the auto-adjusted eave.
    const eave = Number(doc.CityObjects[id].attributes?._eaveHeight);
    const ridge = Number(doc.CityObjects[id].attributes?._ridgeHeight);
    expect(ridge).toBeGreaterThan(eave);
  });

  it('honours `overrides.ridgeHeight` to raise the ridge in place', () => {
    const { doc, id } = makeBuilding({ roofType: 'gable', eaveHeight: 6, ridgeHeight: 9 });
    const res = regenerateBuilding(doc, id, FP_DELFT_A, { ridgeHeight: 14 });
    expect(res.ok).toBe(true);
    expect(doc.CityObjects[id].attributes?._ridgeHeight).toBe(14);
    expect(doc.CityObjects[id].attributes?.measuredHeight).toBe(14);
  });

  it('honours `overrides.addWindows / addDoor` to add openings on reshape', () => {
    const { doc, id } = makeBuilding({ roofType: 'flat' });
    expect(doc.CityObjects[id].attributes?._addWindows).toBeFalsy();
    const res = regenerateBuilding(doc, id, FP_DELFT_A, {
      addWindows: true,
      addDoor: true,
    });
    expect(res.ok).toBe(true);
    expect(doc.CityObjects[id].attributes?._addWindows).toBe(true);
    expect(doc.CityObjects[id].attributes?._addDoor).toBe(true);
  });

  it('switching roofType to flat clamps eave to ridge automatically', () => {
    const { doc, id } = makeBuilding({ roofType: 'gable', eaveHeight: 6, ridgeHeight: 9 });
    const res = regenerateBuilding(doc, id, FP_DELFT_A, { roofType: 'flat' });
    expect(res.ok).toBe(true);
    const eave = Number(doc.CityObjects[id].attributes?._eaveHeight);
    const ridge = Number(doc.CityObjects[id].attributes?._ridgeHeight);
    expect(eave).toBe(ridge);
    expect(doc.CityObjects[id].attributes?.roofType).toBe('flat');
  });
});
