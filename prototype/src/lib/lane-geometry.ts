import {
  parseOsmRoadsFromXml,
  type RoadBand,
  type RoadDraft,
  type OsmRoadFeature,
} from './transportation';

export interface LaneGeometryResult {
  lanes: GeoJsonFeatureCollection;
  laneMarkings: GeoJsonFeatureCollection;
  intersectionMarkings: GeoJsonFeatureCollection;
  warnings: string[];
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type: 'Feature';
  id?: string;
  properties: Record<string, unknown>;
  geometry:
    | {
        type: 'Polygon';
        coordinates: [number, number][][]; // GeoJSON [lng, lat]
      }
    | {
        type: 'LineString';
        coordinates: [number, number][];
      };
}

interface LocalPoint {
  x: number;
  y: number;
}

interface LocalProjection {
  toLocal: (point: [number, number]) => LocalPoint;
  toLngLat: (point: LocalPoint) => [number, number];
}

const METERS_PER_DEGREE_LAT = 111_320;

export function buildLaneGeometryFromOsmXml(osmXml: string): LaneGeometryResult {
  return buildLaneGeometryFromOsmRoads(parseOsmRoadsFromXml(osmXml));
}

export function buildLaneGeometryFromOsmRoads(roads: OsmRoadFeature[]): LaneGeometryResult {
  return buildLaneGeometryFromDrafts(
    roads.map((road) => road.inferredDraft),
    roads.map((road) => road.id)
  );
}

export function buildLaneGeometryFromDrafts(
  drafts: RoadDraft[],
  sourceIds: string[] = []
): LaneGeometryResult {
  const lanes: GeoJsonFeature[] = [];
  const laneMarkings: GeoJsonFeature[] = [];
  const warnings: string[] = [];

  drafts.forEach((draft, draftIndex) => {
    const sourceId = sourceIds[draftIndex] ?? draft.id ?? `road-${draftIndex + 1}`;
    draft.sections.forEach((section, sectionIndex) => {
      try {
        const projection = makeLocalProjection(section.centerlineWgs84);
        const centerline = cleanLocalLine(section.centerlineWgs84.map(projection.toLocal));
        if (centerline.length < 2) {
          warnings.push(`${sourceId}.${section.id}: centerline has fewer than two usable points.`);
          return;
        }
        if (section.bands.length === 0) {
          warnings.push(`${sourceId}.${section.id}: no road bands to render.`);
          return;
        }

        const totalWidth = section.bands.reduce((sum, band) => sum + validBandWidth(band), 0);
        let offset = totalWidth / 2;
        const boundaryOffsets: number[] = [];

        section.bands.forEach((band, bandIndex) => {
          const width = validBandWidth(band);
          const leftOffset = offset;
          const rightOffset = offset - width;
          offset = rightOffset;
          if (bandIndex < section.bands.length - 1) boundaryOffsets.push(rightOffset);

          const polygon = buildRibbonPolygon(centerline, leftOffset, rightOffset);
          if (Math.abs(signedArea(polygon)) < 0.05) {
            warnings.push(`${sourceId}.${section.id}.${band.id ?? bandIndex}: collapsed band.`);
            return;
          }
          const coordinates = polygon.map(projection.toLngLat);
          closeRing(coordinates);

          lanes.push({
            type: 'Feature',
            id: `${sourceId}-${section.id}-${band.id ?? `band-${bandIndex + 1}`}`,
            properties: {
              source: 'ts-lane-geometry',
              road_id: sourceId,
              section_id: section.id,
              band_id: band.id ?? `band-${bandIndex + 1}`,
              lane_type: laneTypeForBand(band),
              type: laneTypeForBand(band),
              direction: band.direction ?? null,
              width_m: width,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates],
            },
          });
        });

        boundaryOffsets.forEach((boundaryOffset, boundaryIndex) => {
          const line = offsetPolyline(centerline, boundaryOffset).map(projection.toLngLat);
          laneMarkings.push({
            type: 'Feature',
            id: `${sourceId}-${section.id}-marking-${boundaryIndex + 1}`,
            properties: {
              source: 'ts-lane-geometry',
              road_id: sourceId,
              section_id: section.id,
              marking_type: 'lane_boundary',
            },
            geometry: {
              type: 'LineString',
              coordinates: line,
            },
          });
        });

        if (sectionIndex > 0) {
          warnings.push(
            `${sourceId}.${section.id}: fallback geometry keeps section intersections simplified.`
          );
        }
      } catch (error) {
        warnings.push(
          `${sourceId}.${section.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    });
  });

  if (drafts.length === 0) warnings.push('No OSM roads were available for fallback lane geometry.');

  return {
    lanes: featureCollection(lanes),
    laneMarkings: featureCollection(laneMarkings),
    intersectionMarkings: featureCollection([]),
    warnings,
  };
}

function featureCollection(features: GeoJsonFeature[]): GeoJsonFeatureCollection {
  return { type: 'FeatureCollection', features };
}

function laneTypeForBand(band: RoadBand): string {
  if (band.kind === 'car_lane') return 'car_lane';
  if (band.kind === 'bike_lane') return 'bike_lane';
  if (band.kind === 'sidewalk') return 'sidewalk';
  if (band.kind === 'parking') return 'parking';
  if (band.kind === 'green') return 'green_verge';
  return band.kind;
}

function validBandWidth(band: RoadBand): number {
  if (!Number.isFinite(band.widthM) || band.widthM <= 0) {
    throw new Error(`invalid width for ${band.kind}: ${band.widthM}`);
  }
  return band.widthM;
}

function makeLocalProjection(points: [number, number][]): LocalProjection {
  const clean = points.filter(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
  );
  const origin = clean[0] ?? [0, 0];
  const meanLat =
    clean.reduce((sum, point) => sum + point[1], 0) / Math.max(1, clean.length);
  const metersPerDegreeLng = Math.max(
    1,
    METERS_PER_DEGREE_LAT * Math.cos((meanLat * Math.PI) / 180)
  );

  return {
    toLocal: ([lng, lat]) => ({
      x: (lng - origin[0]) * metersPerDegreeLng,
      y: (lat - origin[1]) * METERS_PER_DEGREE_LAT,
    }),
    toLngLat: ({ x, y }) => [
      origin[0] + x / metersPerDegreeLng,
      origin[1] + y / METERS_PER_DEGREE_LAT,
    ],
  };
}

function cleanLocalLine(line: LocalPoint[]): LocalPoint[] {
  const result: LocalPoint[] = [];
  for (const point of line) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const prev = result[result.length - 1];
    if (!prev || distance(prev, point) > 1e-6) result.push(point);
  }
  return result;
}

function buildRibbonPolygon(
  centerline: LocalPoint[],
  leftOffset: number,
  rightOffset: number
): LocalPoint[] {
  const left = offsetPolyline(centerline, leftOffset);
  const right = offsetPolyline(centerline, rightOffset).reverse();
  let polygon = removeConsecutiveDuplicates([...left, ...right]);
  if (signedArea(polygon) < 0) polygon = polygon.reverse();
  return polygon;
}

function offsetPolyline(points: LocalPoint[], offset: number): LocalPoint[] {
  if (points.length < 2) throw new Error('cannot offset fewer than two points');
  if (Math.abs(offset) < 1e-9) return points.map((point) => ({ ...point }));

  const result: LocalPoint[] = [];
  const normals: LocalPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) throw new Error('centerline has duplicate projected points');
    normals.push({ x: -dy / len, y: dx / len });
  }

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      result.push(addNormal(points[i], normals[0], offset));
      continue;
    }
    if (i === points.length - 1) {
      result.push(addNormal(points[i], normals[normals.length - 1], offset));
      continue;
    }

    const prevNormal = normals[i - 1];
    const nextNormal = normals[i];
    const prevA = addNormal(points[i - 1], prevNormal, offset);
    const prevB = addNormal(points[i], prevNormal, offset);
    const nextA = addNormal(points[i], nextNormal, offset);
    const nextB = addNormal(points[i + 1], nextNormal, offset);
    const intersection = lineIntersection(prevA, prevB, nextA, nextB);
    if (intersection && distance(intersection, points[i]) <= Math.max(4, Math.abs(offset) * 6)) {
      result.push(intersection);
    } else {
      const nx = prevNormal.x + nextNormal.x;
      const ny = prevNormal.y + nextNormal.y;
      const len = Math.hypot(nx, ny);
      result.push(
        len < 1e-9
          ? addNormal(points[i], nextNormal, offset)
          : {
              x: points[i].x + (nx / len) * offset,
              y: points[i].y + (ny / len) * offset,
            }
      );
    }
  }
  return result;
}

function addNormal(point: LocalPoint, normal: LocalPoint, offset: number): LocalPoint {
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

function lineIntersection(
  a: LocalPoint,
  b: LocalPoint,
  c: LocalPoint,
  d: LocalPoint
): LocalPoint | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross({ x: c.x - a.x, y: c.y - a.y }, s) / denom;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function removeConsecutiveDuplicates(points: LocalPoint[]): LocalPoint[] {
  const result: LocalPoint[] = [];
  for (const point of points) {
    const prev = result[result.length - 1];
    if (!prev || distance(prev, point) > 1e-6) result.push(point);
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (first && last && distance(first, last) < 1e-6) result.pop();
  return result;
}

function closeRing(ring: [number, number][]): void {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
}

function signedArea(points: LocalPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function cross(a: LocalPoint, b: LocalPoint): number {
  return a.x * b.y - a.y * b.x;
}

function distance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
