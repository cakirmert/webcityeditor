import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import {
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  type RoadBand,
} from '../../src/lib/transportation';
import {
  compatibleRoadBandPairs,
  deriveImportedRoadMovements,
  isRoadBandConnectable,
  synchronizeRoadMovementMetadata,
  updateRoadMovementStatus,
} from '../../src/lib/road-movements';

const fixturePath = 'public/data/transportation/osm2streets-hamburg-short-intersection.city.json';

function fixtureDocument(): CityJsonDocument {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as CityJsonDocument;
}

function fixtureDraft(doc: CityJsonDocument, roadId = 'osm2streets-road-0') {
  const areas = extractTransportationAreas(doc);
  return {
    areas,
    draft: deriveEditableRoadDraftFromAreas(areas, roadId),
  };
}

describe('imported road lane movements', () => {
  it('derives through, turn, and pedestrian crossing proposals from the committed Hamburg fixture', () => {
    const doc = fixtureDocument();
    const { areas, draft } = fixtureDraft(doc);
    const movements = deriveImportedRoadMovements(areas, draft);

    expect(movements.length).toBeGreaterThan(0);
    expect(movements.every((movement) => movement.status === 'proposed')).toBe(true);
    expect(movements.every((movement) => movement.provenance === 'osm2streets')).toBe(true);
    expect(movements.some((movement) => movement.sourceMode === 'car' && movement.turn === 'through')).toBe(true);
    expect(movements.some((movement) => movement.sourceMode === 'car' && ['left', 'right'].includes(movement.turn))).toBe(true);
    expect(movements.some((movement) => movement.sourceMode === 'pedestrian' && movement.turn === 'crossing')).toBe(true);
    expect(movements.every((movement) => movement.sourceMode === movement.targetMode)).toBe(true);
    expect(movements.every((movement) => !!movement.sourceDirection && !!movement.targetDirection)).toBe(true);
  });

  it('honours one-way lane direction at the source endpoint', () => {
    const doc = fixtureDocument();
    const { areas, draft } = fixtureDraft(doc);
    const incomingEndpoint = deriveImportedRoadMovements(areas, draft).find(
      (movement) => movement.sourceMode === 'car'
    )?.sourceEndpoint;
    expect(incomingEndpoint).toBeDefined();
    for (const section of draft.sections) {
      for (const band of section.bands) {
        if (band.kind === 'car_lane') {
          band.direction = incomingEndpoint === 'end' ? 'forward' : 'backward';
        }
      }
    }

    const carMovements = deriveImportedRoadMovements(areas, draft).filter(
      (movement) => movement.sourceMode === 'car'
    );

    expect(carMovements.length).toBeGreaterThan(0);
    expect(carMovements.every((movement) => movement.sourceEndpoint === incomingEndpoint)).toBe(true);
  });

  it('uses retained turn metadata before geometry fallback', () => {
    const doc = fixtureDocument();
    const { areas, draft } = fixtureDraft(doc);
    for (const area of areas.filter((candidate) => candidate.roadId === draft.id)) {
      if (String(area.attributes.transportationUsage) !== 'car_lane') continue;
      const parsed = JSON.parse(String(area.attributes.osm2streetsPropertiesJson));
      parsed.allowed_turns = ['straight'];
      area.attributes.osm2streetsPropertiesJson = JSON.stringify(parsed);
    }

    const carMovements = deriveImportedRoadMovements(areas, draft).filter(
      (movement) => movement.sourceMode === 'car'
    );

    expect(carMovements.length).toBeGreaterThan(0);
    expect(carMovements.every((movement) => movement.turn === 'through')).toBe(true);
    expect(carMovements.every((movement) => movement.semanticEvidence)).toBe(true);
  });

  it('pairs bicycle/shared-use bands but never pairs incompatible car, bus, and pedestrian modes', () => {
    const shared: RoadBand = {
      id: 'shared',
      kind: 'sidewalk',
      widthM: 3,
      direction: 'both',
      allowedModes: ['pedestrian', 'bicycle'],
    };
    const bicycle: RoadBand = {
      id: 'bike',
      kind: 'bike_lane',
      widthM: 2,
      direction: 'both',
      allowedModes: ['bicycle'],
    };
    const bus: RoadBand = {
      id: 'bus',
      kind: 'car_lane',
      widthM: 3.2,
      direction: 'both',
      allowedModes: ['bus'],
    };
    const car: RoadBand = {
      id: 'car',
      kind: 'car_lane',
      widthM: 3.2,
      direction: 'both',
      allowedModes: ['car'],
    };
    const parking: RoadBand = {
      id: 'parking',
      kind: 'parking',
      widthM: 2.2,
      allowedModes: ['car'],
    };

    expect(compatibleRoadBandPairs(
      [{ band: shared, index: 0 }],
      [{ band: bicycle, index: 0 }]
    )).toEqual([expect.objectContaining({ mode: 'bicycle' })]);
    expect(compatibleRoadBandPairs(
      [{ band: car, index: 0 }],
      [{ band: bus, index: 0 }, { band: shared, index: 1 }]
    )).toEqual([]);
    expect(isRoadBandConnectable(parking)).toBe(false);
  });

  it('persists confirmed/rejected decisions reciprocally without touching exact polygons', () => {
    const doc = fixtureDocument();
    const { areas, draft } = fixtureDraft(doc);
    const proposals = deriveImportedRoadMovements(areas, draft);
    const rejected = proposals.find((movement) => movement.turn === 'left') ?? proposals[0];
    const decided = updateRoadMovementStatus(
      { ...draft, movements: proposals },
      rejected.id,
      'rejected'
    );
    const verticesBefore = JSON.stringify(doc.vertices);

    const changedTargets = synchronizeRoadMovementMetadata(doc, draft.id!, decided);

    expect(changedTargets).toContain(rejected.targetRoadId);
    expect(doc.CityObjects[draft.id!].attributes?._roadMovements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: rejected.id, status: 'rejected' })])
    );
    expect(doc.CityObjects[rejected.targetRoadId].attributes?._roadMovements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: rejected.id, status: 'rejected' })])
    );
    expect(JSON.stringify(doc.vertices)).toBe(verticesBefore);

    const reloaded = fixtureDraft(doc);
    const rederived = deriveImportedRoadMovements(reloaded.areas, reloaded.draft);
    expect(rederived.find((movement) => movement.id === rejected.id)?.status).toBe('rejected');
  });
});
