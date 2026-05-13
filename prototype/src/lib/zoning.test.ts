import { describe, expect, it } from 'vitest';
import {
  generateZonesAroundCenter,
  findZoneForPoint,
  validateBuildingType,
  getZoneCenter,
  type ParcelZone,
} from './zoning';

describe('generateZonesAroundCenter', () => {
  it('produces three demo zones with non-empty polygons', () => {
    const zones = generateZonesAroundCenter([4.3571, 52.0116]);
    expect(zones).toHaveLength(3);
    for (const z of zones) {
      expect(z.polygon.length).toBeGreaterThanOrEqual(4);
      expect(z.allowedTypes.length).toBeGreaterThan(0);
      expect(z.label).toBeTruthy();
    }
  });

  it('zones have distinct ids and labels', () => {
    const zones = generateZonesAroundCenter([0, 0]);
    const ids = new Set(zones.map((z) => z.id));
    const labels = new Set(zones.map((z) => z.label));
    expect(ids.size).toBe(zones.length);
    expect(labels.size).toBe(zones.length);
  });

  it('the residential zone allows mixed-use buildings', () => {
    const zones = generateZonesAroundCenter([0, 0]);
    const residential = zones.find((z) => z.label.toLowerCase().includes('residential'));
    expect(residential).toBeDefined();
    expect(residential!.allowedTypes).toContain('residential');
    expect(residential!.allowedTypes).toContain('mixed');
  });
});

describe('findZoneForPoint', () => {
  it('returns the matching zone when the point is inside', () => {
    const zones = generateZonesAroundCenter([0, 0], 0.01);
    // Point in lower-left quadrant (residential per generator layout)
    const z = findZoneForPoint(zones, [-0.005, -0.005]);
    expect(z).not.toBeNull();
  });

  it('returns null when no zone contains the point', () => {
    const zones = generateZonesAroundCenter([0, 0], 0.001);
    // Far outside any zone
    const z = findZoneForPoint(zones, [10, 10]);
    expect(z).toBeNull();
  });

  it('a point on the residential side maps to residential', () => {
    const zones = generateZonesAroundCenter([0, 0], 0.01);
    const z = findZoneForPoint(zones, [-0.003, -0.003]);
    expect(z?.label.toLowerCase()).toContain('residential');
  });

  it('a point on the commercial side maps to commercial', () => {
    const zones = generateZonesAroundCenter([0, 0], 0.01);
    const z = findZoneForPoint(zones, [0.003, -0.003]);
    expect(z?.label.toLowerCase()).toContain('commercial');
  });
});

describe('validateBuildingType', () => {
  function makeZone(allowed: string[], label = 'Test Zone'): ParcelZone {
    return {
      id: 'test',
      polygon: [],
      allowedTypes: allowed,
      label,
      color: [0, 0, 0, 0],
    };
  }

  it('allows when zone is null (no zoning constraints)', () => {
    expect(validateBuildingType(null, 'residential').allowed).toBe(true);
  });

  it('allows when the building function is in the zone allow-list', () => {
    const zone = makeZone(['residential', 'mixed']);
    expect(validateBuildingType(zone, 'residential').allowed).toBe(true);
    expect(validateBuildingType(zone, 'mixed').allowed).toBe(true);
  });

  it('rejects with a reason when the building function is not allowed', () => {
    const zone = makeZone(['residential'], 'Residential Zone');
    const result = validateBuildingType(zone, 'industrial');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('industrial');
    expect(result.reason).toContain('Residential Zone');
  });
});

describe('getZoneCenter', () => {
  it('returns null for empty zone array', () => {
    expect(getZoneCenter([])).toBeNull();
  });

  it('returns the centroid across all zone polygons', () => {
    const zones = generateZonesAroundCenter([4.3571, 52.0116], 0.001);
    const c = getZoneCenter(zones);
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(4.3571, 3);
    expect(c![1]).toBeCloseTo(52.0116, 3);
  });
});
