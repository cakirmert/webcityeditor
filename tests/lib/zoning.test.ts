import { describe, expect, it, vi } from 'vitest';
import {
  buildHamburgFnpNutzungUrl,
  buildHamburgXPlanBaugebietUrl,
  fetchHamburgFnpZones,
  fetchPlanningZones,
  fetchHamburgPlanningZones,
  fetchHamburgXPlanZones,
  findNearestZoneForPoint,
  findZoneForPoint,
  getPlanningProviderForBbox,
  getZoneCenter,
  isPlanningBboxSupported,
  isPlanningBboxLoadable,
  isBboxNearHamburg,
  limitPlanningBboxSpan,
  planningBboxSizeMeters,
  planningCoverageSummary,
  planningSourceLabel,
  validateBuildingType,
  zonesFromPlanningGeoJson,
  type ParcelZone,
} from '../../src/lib/zoning';

const HAMBURG_BBOX: [number, number, number, number] = [9.98, 53.54, 10.02, 53.57];

function planningFeature(
  id: string,
  properties: Record<string, unknown>,
  x = 10
): Record<string, unknown> {
  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, 53.5],
          [x + 0.005, 53.5],
          [x + 0.005, 53.505],
          [x, 53.505],
          [x, 53.5],
        ],
      ],
    },
    properties,
  };
}

function planningResponse(body: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('Hamburg planning URL builders', () => {
  it('builds the XPlan Baugebiet OGC API URL with bbox and limit', () => {
    const url = new URL(buildHamburgXPlanBaugebietUrl(HAMBURG_BBOX, 25));
    expect(url.hostname).toBe('api.hamburg.de');
    expect(url.pathname).toContain('/xplan/collections/bp_baugebietsteilflaeche/items');
    expect(url.searchParams.get('f')).toBe('json');
    expect(url.searchParams.get('bbox')).toBe(HAMBURG_BBOX.join(','));
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.has('offset')).toBe(false);

    const next = new URL(buildHamburgXPlanBaugebietUrl(HAMBURG_BBOX, 25, 50));
    expect(next.searchParams.get('offset')).toBe('50');
  });

  it('builds a WFS FNP GeoJSON URL with encoded output format', () => {
    const url = new URL(buildHamburgFnpNutzungUrl(HAMBURG_BBOX, 50));
    expect(url.hostname).toBe('geodienste.hamburg.de');
    expect(url.searchParams.get('REQUEST')).toBe('GetFeature');
    expect(url.searchParams.get('TYPENAMES')).toBe('de.hh.up:fnp_nutzung');
    expect(url.searchParams.get('OUTPUTFORMAT')).toBe('application/geo+json');
    expect(url.searchParams.get('BBOX')).toBe(`${HAMBURG_BBOX.join(',')},EPSG:4326`);
    expect(url.searchParams.get('COUNT')).toBe('50');
    expect(url.searchParams.has('STARTINDEX')).toBe(false);

    const next = new URL(buildHamburgFnpNutzungUrl(HAMBURG_BBOX, 50, 100));
    expect(next.searchParams.get('STARTINDEX')).toBe('100');
  });

  it('detects whether a query bbox intersects Hamburg', () => {
    expect(isBboxNearHamburg(HAMBURG_BBOX)).toBe(true);
    expect(isBboxNearHamburg([4.3, 52.0, 4.4, 52.1])).toBe(false);
  });

  it('bounds planning requests by projected viewport span', () => {
    const size = planningBboxSizeMeters(HAMBURG_BBOX);
    expect(size.widthMeters).toBeGreaterThan(2_000);
    expect(size.heightMeters).toBeGreaterThan(3_000);
    expect(isPlanningBboxLoadable(HAMBURG_BBOX)).toBe(true);
    expect(isPlanningBboxLoadable([9.7, 53.4, 10.3, 53.7])).toBe(false);
    const overviewQuery = limitPlanningBboxSpan([9.7, 53.4, 10.3, 53.7]);
    expect(isPlanningBboxLoadable(overviewQuery)).toBe(true);
    expect((overviewQuery[0] + overviewQuery[2]) / 2).toBeCloseTo(10, 6);
    expect((overviewQuery[1] + overviewQuery[3]) / 2).toBeCloseTo(53.55, 6);
  });

  it('exposes the current planning coverage through a generic provider API', () => {
    expect(isPlanningBboxSupported(HAMBURG_BBOX)).toBe(true);
    expect(isPlanningBboxSupported([4.3, 52.0, 4.4, 52.1])).toBe(false);
    expect(getPlanningProviderForBbox(HAMBURG_BBOX)?.id).toBe('hamburg');
    expect(planningCoverageSummary()).toBe('Hamburg');
    expect(planningSourceLabel('hamburg-xplan-baugebiet')).toBe('XPlan land-use layer');
    expect(planningSourceLabel('hamburg-fnp-nutzung')).toBe('FNP land-use layer');
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
    expect(zones[0].id).toBe('hamburg-xplan-baugebiet:xplan-1');
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
            id: 'fnp-multi-1',
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
    expect(zones.map((zone) => zone.id)).toEqual([
      'hamburg-fnp-nutzung:fnp-multi-1:polygon-1',
      'hamburg-fnp-nutzung:fnp-multi-1:polygon-2',
    ]);
    expect(new Set(zones.map((zone) => zone.id)).size).toBe(2);
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
    expect(zones).toHaveLength(2);
    expect(zones.at(-1)?.allowedTypes).toEqual(['residential', 'mixed']);
    expect(zones.map((zone) => zone.source)).toEqual([
      'hamburg-fnp-nutzung',
      'hamburg-xplan-baugebiet',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

  it('follows every XPlan next link and deduplicates stable feature ids', async () => {
    const firstUrl = buildHamburgXPlanBaugebietUrl(HAMBURG_BBOX, 2);
    const secondUrl = `${firstUrl}&offset=2`;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === firstUrl) {
        return planningResponse({
          type: 'FeatureCollection',
          numberMatched: 3,
          features: [
            planningFeature('xplan-1', { besondereArtDerBaulNutzungWert: 'AllgWohngebiet' }),
            planningFeature('xplan-2', { besondereArtDerBaulNutzungWert: 'Gewerbegebiet' }, 10.01),
          ],
          links: [{ rel: 'next', href: secondUrl }],
        });
      }
      if (url === secondUrl) {
        return planningResponse({
          type: 'FeatureCollection',
          numberMatched: 3,
          features: [
            planningFeature('xplan-2', { besondereArtDerBaulNutzungWert: 'Gewerbegebiet' }, 10.01),
            planningFeature('xplan-3', { besondereArtDerBaulNutzungWert: 'Industriegebiet' }, 10.02),
          ],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const zones = await fetchHamburgXPlanZones(HAMBURG_BBOX, fetchImpl, { pageSize: 2 });

    expect(zones.map((zone) => zone.id)).toEqual([
      'hamburg-xplan-baugebiet:xplan-1',
      'hamburg-xplan-baugebiet:xplan-2',
      'hamburg-xplan-baugebiet:xplan-3',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('pages FNP with STARTINDEX until a short page is returned', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const startIndex = url.searchParams.get('STARTINDEX');
      if (startIndex === null) {
        return planningResponse({
          type: 'FeatureCollection',
          features: [
            planningFeature('fnp-1', { nutzung: 'Wohnbauflächen' }),
            planningFeature('fnp-2', { nutzung: 'Gewerbliche Bauflächen' }, 10.01),
          ],
        });
      }
      expect(startIndex).toBe('2');
      return planningResponse({
        type: 'FeatureCollection',
        features: [planningFeature('fnp-3', { nutzung: 'Gemischte Bauflächen' }, 10.02)],
      });
    });

    const zones = await fetchHamburgFnpZones(HAMBURG_BBOX, fetchImpl, { pageSize: 2 });

    expect(zones.map((zone) => zone.id)).toEqual([
      'hamburg-fnp-nutzung:fnp-1',
      'hamburg-fnp-nutzung:fnp-2',
      'hamburg-fnp-nutzung:fnp-3',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('loads FNP coverage beneath XPlan and gives XPlan point queries priority', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.hamburg.de/')) {
        return planningResponse({
          type: 'FeatureCollection',
          features: [
            planningFeature('xplan-detail', {
              besondereArtDerBaulNutzungWert: 'AllgWohngebiet',
            }),
          ],
        });
      }
      return planningResponse({
        type: 'FeatureCollection',
        features: [planningFeature('fnp-coverage', { nutzung: 'Gemischte Bauflächen' })],
      });
    });

    const zones = await fetchHamburgPlanningZones(HAMBURG_BBOX, fetchImpl);

    expect(zones.map((zone) => zone.source)).toEqual([
      'hamburg-fnp-nutzung',
      'hamburg-xplan-baugebiet',
    ]);
    expect(findZoneForPoint(zones, [10.002, 53.502])?.id).toBe(
      'hamburg-xplan-baugebiet:xplan-detail'
    );
  });

  it('fails explicitly instead of returning a partial layer at the feature budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      planningResponse({
        type: 'FeatureCollection',
        features: [
          planningFeature('xplan-1', {}),
          planningFeature('xplan-2', {}, 10.01),
          planningFeature('xplan-3', {}, 10.02),
        ],
      })
    );

    await expect(
      fetchHamburgXPlanZones(HAMBURG_BBOX, fetchImpl, { pageSize: 3, maxFeatures: 2 })
    ).rejects.toThrow('no partial planning layer was loaded');
  });
});

describe('fetchPlanningZones', () => {
  it('delegates supported bboxes to the matching provider', async () => {
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
            properties: { besondereArtDerBaulNutzungWert: 'Gewerbegebiet' },
          },
        ],
      }),
    } as Response);

    const zones = await fetchPlanningZones(HAMBURG_BBOX, fetchImpl);

    expect(zones).toHaveLength(2);
    expect(zones.at(-1)?.source).toBe('hamburg-xplan-baugebiet');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects an oversized supported viewport before issuing a network request', async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchPlanningZones([9.7, 53.4, 10.3, 53.7], fetchImpl)
    ).rejects.toThrow('Zoom in below 4.5 km per side');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unsupported bboxes before issuing a network request', async () => {
    const fetchImpl = vi.fn();

    await expect(fetchPlanningZones([4.3, 52.0, 4.4, 52.1], fetchImpl)).rejects.toThrow(
      'No planning provider'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
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

describe('findNearestZoneForPoint', () => {
  it('returns a nearby zone when the point is just outside the polygon', () => {
    const z = findNearestZoneForPoint([makeZone(['residential'])], [1.0005, 0.5], 100);
    expect(z).not.toBeNull();
  });

  it('returns null when the nearest zone is beyond the distance tolerance', () => {
    const z = findNearestZoneForPoint([makeZone(['residential'])], [1.01, 0.5], 100);
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
