export interface ParcelZone {
  id: string;
  polygon: [number, number][];
  allowedTypes: string[];
  label: string;
  color: [number, number, number, number];
}

const ZONE_RESIDENTIAL: ParcelZone = {
  id: 'zone-residential-1',
  polygon: [],
  allowedTypes: ['residential', 'mixed'],
  label: 'Residential Zone',
  color: [100, 180, 100, 80],
};

const ZONE_COMMERCIAL: ParcelZone = {
  id: 'zone-commercial-1',
  polygon: [],
  allowedTypes: ['commercial', 'mixed', 'public'],
  label: 'Commercial Zone',
  color: [100, 120, 200, 80],
};

const ZONE_INDUSTRIAL: ParcelZone = {
  id: 'zone-industrial-1',
  polygon: [],
  allowedTypes: ['industrial'],
  label: 'Industrial Zone',
  color: [200, 140, 80, 80],
};

export function generateZonesAroundCenter(
  center: [number, number],
  radiusDeg = 0.003
): ParcelZone[] {
  const [lng, lat] = center;
  const r = radiusDeg;
  const hr = r / 2;

  return [
    {
      ...ZONE_RESIDENTIAL,
      id: 'zone-residential-1',
      polygon: [
        [lng - r, lat - r],
        [lng - r, lat],
        [lng, lat],
        [lng, lat - r],
      ],
    },
    {
      ...ZONE_COMMERCIAL,
      id: 'zone-commercial-1',
      polygon: [
        [lng, lat - r],
        [lng, lat],
        [lng + r, lat],
        [lng + r, lat - r],
      ],
    },
    {
      ...ZONE_INDUSTRIAL,
      id: 'zone-industrial-1',
      polygon: [
        [lng - r, lat],
        [lng - r, lat + r],
        [lng + r, lat + r],
        [lng + r, lat],
      ],
    },
  ];
}

export function findZoneForPoint(
  zones: ParcelZone[],
  point: [number, number]
): ParcelZone | null {
  for (const zone of zones) {
    if (pointInPolygon(point, zone.polygon)) return zone;
  }
  return null;
}

export function validateBuildingType(
  zone: ParcelZone | null,
  buildingFunction: string
): { allowed: boolean; reason?: string } {
  if (!zone) return { allowed: true };
  if (zone.allowedTypes.includes(buildingFunction)) return { allowed: true };
  return {
    allowed: false,
    reason: `"${buildingFunction}" buildings are not allowed in ${zone.label}. Allowed: ${zone.allowedTypes.join(', ')}.`,
  };
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function getZoneCenter(zones: ParcelZone[]): [number, number] | null {
  if (zones.length === 0) return null;
  let sx = 0, sy = 0, n = 0;
  for (const z of zones) {
    for (const [x, y] of z.polygon) {
      sx += x; sy += y; n++;
    }
  }
  return n > 0 ? [sx / n, sy / n] : null;
}
