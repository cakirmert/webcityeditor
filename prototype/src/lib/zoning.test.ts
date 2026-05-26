import { describe, expect, it, vi } from 'vitest';
import {
  buildHamburgFnpNutzungUrl,
  buildHamburgXPlanBaugebietUrl,
  fetchHamburgPlanningZones,
  findZoneForPoint,
  getZoneCenter,
  isBboxNearHamburg,
  validateBuildingType,
  zonesFromPlanningGeoJson,
  type ParcelZone,
} from './zoning';

const HAMBURG_BBOX: [number, number, number, number] = [9.98, 53.54, 10.02, 53.57];

describe('Hamburg planning URL builders', () => {
  it('builds the XPlan Baugebiet OGC API URL with bbox and limit', () => {
    const url = new URL(buildHamburgXPlanBaugebietUrl(HAMBURG_BBOX, 25));
    expect(url.hostname).toBe('api.hamburg.de');
    expect(url.pathname).toContain('/xplan/collections/bp_baugebietsteilflaeche/items');
    expect(url.searchParams.get('f')).toBe('json');
    expect(url.searchParams.get('bbox')).toBe(HAMBURG_BBOX.join(','));
    expect(url.searchParams.get('limit')).toBe('25');
  });

  it('builds a WFS FNP GeoJSON URL with encoded output format', () => {
    const url = new URL(buildHamburgFnpNutzungUrl(HAMBURG_BBOX, 50));
    expect(url.hostname).toBe('geodienste.hamburg.de');
    expect(url.searchParams.get('REQUEST')).toBe('GetFeature');
    expect(url.searchParams.get('TYPENAMES')).toBe('de.hh.up:fnp_nutzung');
    expect(url.searchParams.get('OUTPUTFORMAT')).toBe('application/geo+json');
    expect(url.searchParams.get('BBOX')).toBe(`${HAMBURG_BBOX.join(',')},EPSG:4326`);
    expect(url.searchParams.get('COUNT')).toBe('50');
  });

  it('detects whether a query bbox intersects Hamburg', () => {
    expect(isBboxNearHamburg(HAMBURG_BBOX)).toBe(true);
    expect(isBboxNearHamburg([4.3, 52.0, 4.4, 52.1])).toBe(false);
  });
});

describe('zonesFromPlanningGeoJson', () => {
  it('maps XPlan Baugebiet polygons into planning zones', () => {
    const zones = zonesFromPlanningGeoJson(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'xplan-1',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [10, 53.5],
                  [10.01, 53.5],
                  [10.01, 53.51],
                  [10, 53.51],
                  [10, 53.5],
                ],
              ],
            },
            properties: {
              xpPlanName: 'Altstadt47',
              besondereArtDerBaulNutzungWert: 'Kerngebiet',
              GRZ: 1,
              rechtsstandWert: 'Festsetzung',
            },
          },
        ],
      },
      'hamburg-xplan-baugebiet'
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe('xplan-1');
    expect(zones[0].label).toBe('Kerngebiet');
    expect(zones[0].allowedTypes).toEqual(['mixed', 'commercial', 'residential', 'public']);
    expect(zones[0].source).toBe('hamburg-xplan-baugebiet');
    expect(zones[0].details).toContain('Altstadt47');
  });

  it('maps FNP land-use polygons into planning zones', () => {
    const zones = zonesFromPlanningGeoJson(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'fnp-1',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [10, 53.5],
                  [10.01, 53.5],
                  [10.01, 53.51],
                  [10, 53.51],
                  [10, 53.5],
                ],
              ],
            },
            properties: {
              nutzung: 'Wohnbauflächen',
            },
          },
        ],
      },
      'hamburg-fnp-nutzung'
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].label).toBe('Wohnbauflächen');
    expect(zones[0].allowedTypes).toEqual(['residential', 'mixed']);
  });

  it('splits MultiPolygon features and closes open rings', () => {
    const zones = zonesFromPlanningGeoJson(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [10, 53.5],
                    [10.01, 53.5],
                    [10.01, 53.51],
                    [10, 53.51],
                  ],
                ],
                [
                  [
                    [10.02, 53.5],
                    [10.03, 53.5],
                    [10.03, 53.51],
                    [10.02, 53.51],
                  ],
                ],
              ],
            },
            properties: { nutzung: 'Gewerbliche Bauflächen' },
          },
        ],
      },
      'hamburg-fnp-nutzung'
    );

    expect(zones).toHaveLength(2);
    expect(zones[0].polygon.at(-1)).toEqual(zones[0].polygon[0]);
    expect(zones[0].allowedTypes).toEqual(['commercial', 'mixed']);
  });

  it('returns no zones for non-GeoJSON or unsupported geometry', () => {
    expect(zonesFromPlanningGeoJson({ type: 'FeatureCollection', features: [] }, 'hamburg-fnp-nutzung')).toEqual([]);
    expect(
      zonesFromPlanningGeoJson(
        {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [10, 53] } }],
        },
        'hamburg-fnp-nutzung'
      )
    ).toEqual([]);
  });
});

describe('fetchHamburgPlanningZones', () => {
  it('uses XPlan results when they are available', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [10, 53.5],
                  [10.01, 53.5],
                  [10.01, 53.51],
                  [10, 53.51],
                  [10, 53.5],
                ],
              ],
            },
            properties: { besondereArtDerBaulNutzungWert: 'AllgWohngebiet' },
          },
        ],
      }),
    } as Response);

    const zones = await fetchHamburgPlanningZones(HAMBURG_BBOX, fetchImpl);
    expect(zones).toHaveLength(1);
    expect(zones[0].allowedTypes).toEqual(['residential', 'mixed']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to FNP when the XPlan viewport has no polygons', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [10, 53.5],
                    [10.01, 53.5],
                    [10.01, 53.51],
                    [10, 53.51],
                    [10, 53.5],
                  ],
                ],
              },
              properties: { nutzung: 'Gemischte Bauflächen' },
            },
          ],
        }),
      } as Response);

    const zones = await fetchHamburgPlanningZones(HAMBURG_BBOX, fetchImpl);
    expect(zones).toHaveLength(1);
    expect(zones[0].source).toBe('hamburg-fnp-nutzung');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('findZoneForPoint', () => {
  it('returns the matching zone when the point is inside', () => {
    const z = findZoneForPoint([makeZone(['residential', 'mixed'])], [0.5, 0.5]);
    expect(z).not.toBeNull();
  });

  it('returns null when no zone contains the point', () => {
    const z = findZoneForPoint([makeZone(['residential'])], [10, 10]);
    expect(z).toBeNull();
  });
});

describe('validateBuildingType', () => {
  it('allows when zone is null (no planning constraints)', () => {
    expect(validateBuildingType(null, 'residential').allowed).toBe(true);
  });

  it('allows when the building function is in the zone allow-list', () => {
    const zone = makeZone(['residential', 'mixed']);
    expect(validateBuildingType(zone, 'residential').allowed).toBe(true);
    expect(validateBuildingType(zone, 'mixed').allowed).toBe(true);
  });

  it('rejects with a reason when the building function is not allowed', () => {
    const zone = makeZone(['residential'], 'Residential Area');
    const result = validateBuildingType(zone, 'industrial');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('industrial');
    expect(result.reason).toContain('Residential Area');
  });

  it('rejects all building functions when the planning class maps to no types', () => {
    const zone = makeZone([], 'Water Area');
    const result = validateBuildingType(zone, 'residential');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('no mapped building types');
  });
});

describe('getZoneCenter', () => {
  it('returns null for empty zone array', () => {
    expect(getZoneCenter([])).toBeNull();
  });

  it('returns the centroid across all zone polygons', () => {
    const c = getZoneCenter([makeZone(['residential'])]);
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(0.4, 3);
    expect(c![1]).toBeCloseTo(0.4, 3);
  });
});

function makeZone(allowed: string[], label = 'Test Zone'): ParcelZone {
  return {
    id: 'test',
    polygon: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    allowedTypes: allowed,
    label,
    color: [0, 0, 0, 0],
  };
}
