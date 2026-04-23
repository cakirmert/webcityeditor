import { describe, expect, it } from 'vitest';
import { detectCrs, projectToWgs84 } from './projection';
import { buildSampleCube } from './cityjson';

describe('detectCrs', () => {
  it('extracts EPSG code from the OGC URL format', () => {
    const crs = detectCrs(buildSampleCube());
    expect(crs.code).toBe('EPSG:28992');
    expect(crs.supported).toBe(true);
  });

  it('supports EPSG:4978 (WGS84 geocentric)', () => {
    const crs = detectCrs({
      ...buildSampleCube(),
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/4978' },
    });
    expect(crs.code).toBe('EPSG:4978');
    expect(crs.supported).toBe(true);
  });

  it('supports EPSG:7415 (RD+NAP)', () => {
    const crs = detectCrs({
      ...buildSampleCube(),
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/7415' },
    });
    expect(crs.code).toBe('EPSG:7415');
    expect(crs.supported).toBe(true);
  });

  it('returns unsupported for unknown CRS', () => {
    const crs = detectCrs({
      ...buildSampleCube(),
      metadata: { referenceSystem: 'urn:something-bogus' },
    });
    expect(crs.supported).toBe(false);
  });
});

describe('projectToWgs84', () => {
  it('converts EPSG:28992 Delft coords to approx 4.35°E 52.01°N', () => {
    const [lng, lat] = projectToWgs84('EPSG:28992', { x: 85000, y: 447000, z: 0 });
    expect(lng).toBeGreaterThan(4.3);
    expect(lng).toBeLessThan(4.4);
    expect(lat).toBeGreaterThan(52.0);
    expect(lat).toBeLessThan(52.05);
  });

  it('converts EPSG:7415 (same horizontal as 28992)', () => {
    const [lng28992] = projectToWgs84('EPSG:28992', { x: 85000, y: 447000, z: 0 });
    const [lng7415] = projectToWgs84('EPSG:7415', { x: 85000, y: 447000, z: 0 });
    expect(lng7415).toBeCloseTo(lng28992, 5);
  });

  it('converts EPSG:4978 geocentric when z is passed through', () => {
    // Earth centre (0,0,0) should not be a valid surface point — that's fine,
    // we just need proj4 to not throw and produce a finite number.
    // A realistic ECEF point near Delft:
    //   lng=4.357, lat=52.012 → x ≈ 3924.4 km, y ≈ 299 km, z ≈ 5001 km
    const near = { x: 3924400, y: 299000, z: 5001000 };
    const [lng, lat] = projectToWgs84('EPSG:4978', near);
    expect(lng).toBeGreaterThan(4);
    expect(lng).toBeLessThan(5);
    expect(lat).toBeGreaterThan(50);
    expect(lat).toBeLessThan(54);
  });

  it('converts EPSG:25832 (UTM 32N, Germany) coords', () => {
    // Munich is roughly x=691000, y=5335000 in UTM 32N
    const [lng, lat] = projectToWgs84('EPSG:25832', { x: 691000, y: 5335000, z: 0 });
    expect(lng).toBeGreaterThan(11);
    expect(lng).toBeLessThan(12);
    expect(lat).toBeGreaterThan(48);
    expect(lat).toBeLessThan(49);
  });
});
