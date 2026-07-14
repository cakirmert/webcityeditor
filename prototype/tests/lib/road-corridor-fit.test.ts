import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import { projectToWgs84 } from '../../src/lib/projection';
import {
  fitRoadDraftWidthsToCorridors,
  MIN_CORRIDOR_FIT_BAND_WIDTH_M,
} from '../../src/lib/road-corridor-fit';
import type { RoadAllowedCorridor } from '../../src/lib/road-corridor';
import type { RoadDraft } from '../../src/lib/transportation';

const ORIGIN_X = 565_000;
const ORIGIN_Y = 5_935_000;

function wgs84(x: number, y: number): [number, number] {
  return projectToWgs84('EPSG:25832', { x, y, z: 0 });
}

function document(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: {
      scale: [0.001, 0.001, 0.001],
      translate: [ORIGIN_X, ORIGIN_Y, 0],
    },
    metadata: {
      referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
      geographicalExtent: [ORIGIN_X, ORIGIN_Y, 0, ORIGIN_X + 100, ORIGIN_Y + 10, 10],
    },
    CityObjects: {},
    vertices: [[0, 0, 0], [100_000, 10_000, 10_000]],
  };
}

function draft(): RoadDraft {
  return {
    id: 'corridor-fit-road',
    source: 'manual',
    userVerified: true,
    sections: [{
      id: 'section-1',
      centerlineWgs84: [wgs84(ORIGIN_X, ORIGIN_Y + 5), wgs84(ORIGIN_X + 100, ORIGIN_Y + 5)],
      bands: [
        { id: 'left', kind: 'sidewalk', widthM: 4, direction: 'none' },
        { id: 'right', kind: 'car_lane', widthM: 4, direction: 'forward' },
      ],
    }],
  };
}

function corridor(widthM: number, y = ORIGIN_Y + 5): RoadAllowedCorridor {
  const half = widthM / 2;
  return {
    id: `corridor-${widthM}`,
    polygon: [
      wgs84(ORIGIN_X - 1, y - half),
      wgs84(ORIGIN_X + 101, y - half),
      wgs84(ORIGIN_X + 101, y + half),
      wgs84(ORIGIN_X - 1, y + half),
      wgs84(ORIGIN_X - 1, y - half),
    ],
  };
}

describe('fitRoadDraftWidthsToCorridors', () => {
  it('proportionally shrinks band widths to the largest corridor-safe width', () => {
    const result = fitRoadDraftWidthsToCorridors(document(), draft(), [corridor(6)]);

    expect(result.status).toBe('fitted');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].originalWidthM).toBe(8);
    expect(result.sections[0].fittedWidthM).toBeGreaterThanOrEqual(5.9);
    expect(result.sections[0].fittedWidthM).toBeLessThanOrEqual(6.01);
    expect(result.draft.sections[0].bands.map((band) => band.widthM)).toEqual([
      result.draft.sections[0].bands[0].widthM,
      result.draft.sections[0].bands[0].widthM,
    ]);
  });

  it('leaves a draft unchanged when every section already fits', () => {
    const source = draft();
    const result = fitRoadDraftWidthsToCorridors(document(), source, [corridor(10)]);

    expect(result.status).toBe('unchanged');
    expect(result.draft).toEqual(source);
    expect(result.sections[0].scale).toBe(1);
  });

  it('refuses to move a centerline that is outside the corridor', () => {
    const result = fitRoadDraftWidthsToCorridors(
      document(),
      draft(),
      [corridor(10, ORIGIN_Y + 30)]
    );

    expect(result.status).toBe('unfit');
    expect(result.reason).toContain('without moving its centerline');
    expect(result.draft).toEqual(draft());
  });

  it('refuses to shrink semantic bands below the editor minimum', () => {
    const result = fitRoadDraftWidthsToCorridors(document(), draft(), [corridor(0.5)]);

    expect(result.status).toBe('unfit');
    expect(result.reason).toContain(`${MIN_CORRIDOR_FIT_BAND_WIDTH_M.toFixed(2)} m`);
  });
});
