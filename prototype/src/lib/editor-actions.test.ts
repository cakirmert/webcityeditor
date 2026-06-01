import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import {
  commitBuildingTransformFromEditor,
  createBuildingFromEditor,
  EditorMutationValidationError,
  runStructurallyGuardedMutation,
} from './editor-actions';
import { prepareValidatedCityJsonExport } from './export-validation';
import { checkIntegrity } from './integrity';

const FOOTPRINT: [number, number][] = [
  [4.3571, 52.0116],
  [4.35724, 52.0116],
  [4.35724, 52.01168],
  [4.3571, 52.01168],
];

describe('browser editor actions', () => {
  it('creates, moves, compacts, and exports through the browser action route', () => {
    const doc = buildSampleCube();
    const created = createBuildingFromEditor(doc, {
      targetCrs: 'EPSG:28992',
      footprintWgs84: FOOTPRINT,
      storeys: 3,
      eaveHeight: 9,
      ridgeHeight: 9,
      roofType: 'flat',
    });

    const transformed = commitBuildingTransformFromEditor(doc, {
      id: created.id,
      dx: 2.5,
      dy: -1.25,
      angle: 15,
    });
    const prepared = prepareValidatedCityJsonExport(doc);

    expect(transformed.changed).toBe(true);
    expect(checkIntegrity(doc).ok).toBe(true);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(JSON.parse(prepared.text).CityObjects[created.id]).toBeDefined();
    }
  });

  it('rolls back a browser mutation that introduces structural corruption', () => {
    const doc = buildSampleCube();
    const before = JSON.stringify(doc);

    expect(() =>
      runStructurallyGuardedMutation(doc, 'Breaking a vertex index', () => {
        const geometry = doc.CityObjects.Building_A.geometry as Array<{
          boundaries: number[][][][];
        }>;
        geometry[0].boundaries[0][0][0][0] = 9999;
      })
    ).toThrow(EditorMutationValidationError);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('refuses to prepare structurally invalid bytes for export', () => {
    const doc = buildSampleCube();
    const geometry = doc.CityObjects.Building_A.geometry as Array<{
      boundaries: number[][][][];
    }>;
    geometry[0].boundaries[0][0][0][0] = 9999;

    const prepared = prepareValidatedCityJsonExport(doc);

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error).toMatch(/failed structural validation/i);
  });
});
