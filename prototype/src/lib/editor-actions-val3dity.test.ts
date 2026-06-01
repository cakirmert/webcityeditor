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
  it('keeps every creator roof and detail variant primitive-valid', () => {
    const creatorCases = [
      { roofType: 'flat' as const, eaveHeight: 9 },
      { roofType: 'pyramid' as const, eaveHeight: 7 },
      { roofType: 'gable' as const, eaveHeight: 7 },
      { roofType: 'hip' as const, eaveHeight: 7 },
      {
        roofType: 'flat' as const,
        eaveHeight: 9,
        openings: { windows: true, door: true },
      },
    ];
    for (const [index, creator] of creatorCases.entries()) {
      const doc = emptyHamburgDocument();
      const created = createBuildingFromEditor(doc, {
        targetCrs: 'EPSG:25832',
        footprintWgs84: offsetFootprint(
          index === 1 ? [...RECTANGLE].reverse() : RECTANGLE,
          index * 0.00035
        ),
        storeys: 3,
        eaveHeight: creator.eaveHeight,
        ridgeHeight: 9,
        roofType: creator.roofType,
        openings: creator.openings,
      });
      expectVal3dityValid(doc, `${creator.roofType}-${index}-created`);
      commitBuildingTransformFromEditor(doc, {
        id: created.id,
        dx: 1.25,
        dy: -0.75,
        angle: 3,
      });
      expectVal3dityValid(doc, `${creator.roofType}-${index}-moved`);
    }
  });

  it('keeps moved and independently subdivided buildings primitive-valid', () => {
    const doc = emptyHamburgDocument();
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
    expectVal3dityValid(doc, 'floor-plans');
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

function expectVal3dityValid(doc: CityJsonDocument, label: string): void {
  const prepared = prepareValidatedCityJsonExport(doc);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) return;
  const file = path.join(os.tmpdir(), `webcityeditor-ui-actions-${process.pid}-${label}.city.json`);
  try {
    writeFileSync(file, prepared.text, 'utf8');
    const output = execFileSync(executable, [file, '--ignore204'], { encoding: 'utf8' });
    expect(output, label).toContain('VALID :)');
  } finally {
    rmSync(file, { force: true });
  }
}
