export interface RoadAllowedCorridor {
  id: string;
  label?: string;
  polygon: [number, number][];
}

type JsonObject = Record<string, unknown>;

/**
 * Read user-approved WGS84 GeoJSON polygons as road editing corridors.
 * Interior rings are intentionally ignored for the first corridor slice: the
 * road-fit validator currently accepts one outer ring per corridor.
 */
export function parseRoadCorridorGeoJson(
  value: unknown,
  sourceName = 'road-corridor.geojson'
): RoadAllowedCorridor[] {
  if (!isObject(value)) {
    throw new Error('Corridor GeoJSON must be a JSON object.');
  }

  const geometries: Array<{ geometry: JsonObject; id?: string; label?: string }> = [];
  if (value.type === 'FeatureCollection') {
    if (!Array.isArray(value.features)) {
      throw new Error('Corridor FeatureCollection must contain a features array.');
    }
    value.features.forEach((feature, index) => {
      geometries.push(readFeature(feature, sourceName, index));
    });
  } else if (value.type === 'Feature') {
    geometries.push(readFeature(value, sourceName, 0));
  } else {
    geometries.push({ geometry: value, label: sourceName });
  }

  const corridors: RoadAllowedCorridor[] = [];
  for (const item of geometries) {
    const rings = outerRings(item.geometry);
    rings.forEach((ring, partIndex) => {
      const sequence = corridors.length + 1;
      const baseId = item.id ?? `corridor-${sequence}`;
      corridors.push({
        id: rings.length > 1 ? `${baseId}-${partIndex + 1}` : baseId,
        label: item.label ?? sourceName,
        polygon: normalizeWgs84Ring(ring),
      });
    });
  }

  if (corridors.length === 0) {
    throw new Error('Corridor GeoJSON does not contain any Polygon or MultiPolygon geometry.');
  }
  return corridors;
}

function readFeature(value: unknown, sourceName: string, index: number) {
  if (!isObject(value) || value.type !== 'Feature' || !isObject(value.geometry)) {
    throw new Error(`Corridor feature ${index + 1} must contain Polygon geometry.`);
  }
  const properties = isObject(value.properties) ? value.properties : {};
  const featureId = scalarString(value.id) ?? scalarString(properties.id);
  const label =
    scalarString(properties.name) ??
    scalarString(properties.label) ??
    featureId ??
    `${sourceName} ${index + 1}`;
  return { geometry: value.geometry, id: featureId, label };
}

function outerRings(geometry: JsonObject): unknown[][] {
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates) || !Array.isArray(geometry.coordinates[0])) {
      throw new Error('Corridor Polygon coordinates are invalid.');
    }
    return [geometry.coordinates[0]];
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) {
      throw new Error('Corridor MultiPolygon coordinates are invalid.');
    }
    return geometry.coordinates.map((polygon, index) => {
      if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) {
        throw new Error(`Corridor MultiPolygon part ${index + 1} is invalid.`);
      }
      return polygon[0];
    });
  }
  throw new Error(`Corridor geometry must be Polygon or MultiPolygon, not ${String(geometry.type)}.`);
}

function normalizeWgs84Ring(value: unknown[]): [number, number][] {
  const ring = value.map((position, index): [number, number] => {
    if (
      !Array.isArray(position) ||
      position.length < 2 ||
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[1])
    ) {
      throw new Error(`Corridor coordinate ${index + 1} must contain finite longitude/latitude.`);
    }
    const longitude = Number(position[0]);
    const latitude = Number(position[1]);
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('Corridor coordinates must use WGS84 longitude/latitude.');
    }
    return [longitude, latitude];
  });

  const unique = new Set(ring.map(([x, y]) => `${x},${y}`));
  if (unique.size < 3) {
    throw new Error('Corridor polygon must contain at least three distinct positions.');
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}

function scalarString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
