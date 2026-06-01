import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../types';
import {
  commitBuildingTransformFromEditor,
  createBuildingFromEditor,
  runStructurallyGuardedMutation,
} from './editor-actions';
import { prepareValidatedCityJsonExport } from './export-validation';
import { splitBuildingByFloorPlans } from './subdivision';

const executable = path.resolve(
  '..',
  'tools',
  'val3dity-2.6.0',
  'bin',
  process.platform === 'win32' ? 'val3dity.exe' : 'val3dity'
);
const describeWithVal3dity = existsSync(executable) ? describe : describe.skip;
const RECTANGLE: [number, number][] = [
  [9.989, 53.55],
  [9.9892, 53.55],
  [9.9892, 53.5501],
  [9.989, 53.5501],
];

describeWithVal3dity('browser editor actions with val3dity', () => {
  it('keeps created, moved, and independently subdivided buildings primitive-valid', () => {
    const doc = emptyHamburgDocument();
    for (const roofType of ['flat', 'pyramid', 'gable', 'hip'] as const) {
      const created = createBuildingFromEditor(doc, {
        targetCrs: 'EPSG:25832',
        footprintWgs84: offsetFootprint(RECTANGLE, doc.vertices.length / 1_000_000),
        storeys: 3,
        eaveHeight: roofType === 'flat' ? 9 : 7,
        ridgeHeight: 9,
        roofType,
      });
      commitBuildingTransformFromEditor(doc, {
        id: created.id,
        dx: 1.25,
        dy: -0.75,
        angle: 3,
      });
    }

    const floorPlanBuilding = createBuildingFromEditor(doc, {
      targetCrs: 'EPSG:25832',
      footprintWgs84: offsetFootprint(RECTANGLE, 0.002),
      storeys: 2,
      eaveHeight: 6,
      ridgeHeight: 6,
      roofType: 'flat',
    });
    runStructurallyGuardedMutation(doc, 'Splitting test floor plans', () =>
      splitBuildingByFloorPlans(
        doc,
        floorPlanBuilding.id,
        [3, 3],
        [
          { partCount: 1, axis: 'auto' },
          { partCount: 2, axis: 'longer', cutFractions: [0.5] },
        ]
      )
    );

    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const file = path.join(os.tmpdir(), `webcityeditor-ui-actions-${process.pid}.city.json`);
    try {
      writeFileSync(file, prepared.text, 'utf8');
      const output = execFileSync(executable, [file], { encoding: 'utf8' });
      expect(output).toContain('VALID :)');
    } finally {
      rmSync(file, { force: true });
    }
  });
});

function emptyHamburgDocument(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [0.001, 0.001, 0.001], translate: [565000, 5936000, 0] },
    metadata: { referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832' },
    CityObjects: {},
    vertices: [],
  };
}

function offsetFootprint(
  footprint: [number, number][],
  offset: number
): [number, number][] {
  return footprint.map(([lng, lat]) => [lng + offset, lat]);
}
