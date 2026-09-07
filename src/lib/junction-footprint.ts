import { difference, intersection, union, type MultiPolygon } from 'polygon-clipping';
import { deriveEditableRoadDraftFromAreas, sampleRoadSectionCenterlineWgs84, type RoadArea, type RoadBandKind } from './transportation';

export type JunctionPoint = [number, number];
export interface JunctionFootprint {
  polygon: JunctionPoint[];
  holes: JunctionPoint[][];
  source: 'drawn' | 'imported' | 'generated';
  reference?: string;
}
export type JunctionEditTool = 'none' | 'vertices' | 'trace-boundary' | 'trace-island';

export function localJunctionProjection(origin: JunctionPoint) {
  const xScale = 111320 * Math.cos(origin[1] * Math.PI / 180);
  return {
    project: ([x, y]: JunctionPoint): JunctionPoint => [Math.round((x - origin[0]) * xScale * 1000) / 1000, Math.round((y - origin[1]) * 110540 * 1000) / 1000],
    unproject: ([x, y]: number[]): JunctionPoint => [origin[0] + x / xScale, origin[1] + y / 110540],
  };
}

export function openJunctionRing(ring: JunctionPoint[]): JunctionPoint[] {
  return ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : [...ring];
}

export function junctionPolygonArea(polygons: MultiPolygon): number {
  return polygons.reduce((total, polygon) => total + polygon.reduce((sum, ring, i) => {
    const area = Math.abs(ring.reduce((a, p, j) => { const q = ring[(j + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    return sum + (i ? -area : area);
  }, 0), 0);
}

/** A traced kerb is authoritative; reject invalid geometry instead of repairing it silently. */
export function validateJunctionFootprint(value: unknown): string | undefined {
  const shape = value as JunctionFootprint | undefined;
  const validRing = (ring: unknown): ring is JunctionPoint[] => Array.isArray(ring) && ring.length >= 3 && ring.length <= 500 && ring.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) < 85);
  if (!shape || !validRing(shape.polygon) || !Array.isArray(shape.holes) || shape.holes.length > 30 || !shape.holes.every(validRing)) return 'Draw at least three boundary points. Every coordinate must be valid.';
  const { project } = localJunctionProjection(shape.polygon[0]);
  const rings = [shape.polygon, ...shape.holes].map((ring) => openJunctionRing(ring).map(project));
  if (rings.some((ring) => ring.some((p) => Math.hypot(...p) > 240))) return 'Keep the traced intersection within 240 metres. Edit long approaches as roads.';
  for (const [index, ring] of rings.entries()) {
    if (ring.length < 3 || hasCrossing(ring) || junctionPolygonArea([[ring]]) < .04) return `${index ? `Island ${index}` : 'Boundary'} crosses itself, repeats a point, or has no usable area. Move or remove the highlighted points.`;
  }
  try {
    for (let i = 1; i < rings.length; i++) {
      if (ringsIntersect(rings[0], rings[i]) || junctionPolygonArea(difference([rings[i]], [rings[0]])) > .0001) return `Island ${i} must sit entirely inside the boundary without touching its kerb.`;
      for (let j = 1; j < i; j++) {
        if (ringsIntersect(rings[i], rings[j]) || junctionPolygonArea(intersection([rings[i]], [rings[j]])) > .0001) return `Islands ${j} and ${i} overlap. Keep their outlines separate.`;
      }
    }
  } catch { return 'The traced outline cannot form a valid surface. Check its corners and islands.'; }
  return undefined;
}

const cross = (a: JunctionPoint, b: JunctionPoint, c: JunctionPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segmentsTouch(a: JunctionPoint, b: JunctionPoint, c: JunctionPoint, d: JunctionPoint) {
  const on = (p: JunctionPoint, q: JunctionPoint, r: JunctionPoint) => Math.abs(cross(p, q, r)) < 1e-8 && r[0] >= Math.min(p[0], q[0]) - 1e-8 && r[0] <= Math.max(p[0], q[0]) + 1e-8 && r[1] >= Math.min(p[1], q[1]) - 1e-8 && r[1] <= Math.max(p[1], q[1]) + 1e-8;
  return (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
function hasCrossing(ring: JunctionPoint[]) {
  for (let i = 0; i < ring.length; i++) {
    const next = (i + 1) % ring.length;
    if (Math.hypot(ring[i][0] - ring[next][0], ring[i][1] - ring[next][1]) < .001) return true;
    for (let j = i + 1; j < ring.length; j++) {
      if (j === next || (j + 1) % ring.length === i) continue;
      if (segmentsTouch(ring[i], ring[next], ring[j], ring[(j + 1) % ring.length])) return true;
    }
  }
  return false;
}
function ringsIntersect(a: JunctionPoint[], b: JunctionPoint[]) {
  return a.some((p, i) => b.some((q, j) => segmentsTouch(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}

/** Capture existing pavement for direct editing, keeping actual source islands. */
export function junctionFootprintFromAreas(areas: RoadArea[], id: string): JunctionFootprint | undefined {
  const selected = areas.filter((area) => area.roadId === id && !/sidewalk|footway|biking|bike|green|median/i.test(String(area.attributes.sourceType ?? area.attributes.transportationUsage ?? '')));
  if (!selected.length) return undefined;
  const { project, unproject } = localJunctionProjection(selected[0].polygon[0]);
  const polygons = selected.map((area) => [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))]);
  try {
    const joined = union(polygons[0], ...polygons.slice(1));
    if (joined.length !== 1) return undefined;
    return { polygon: openJunctionRing(joined[0][0].map(unproject)), holes: joined[0].slice(1).map((ring) => openJunctionRing(ring.map(unproject))), source: 'imported' };
  } catch { return undefined; }
}

/** Order the road mouths around the junction and connect their kerbs, independently of permitted turns. */
export function buildAutomaticJunctionFootprint(roadIds: string[], endpoints: Record<string, 'start' | 'end'>, areas: RoadArea[], curveFactor: number, kinds: RoadBandKind[] = ['car_lane', 'parking']): JunctionFootprint | undefined {
  const anchor = areas.find((area) => roadIds.includes(area.roadId))?.polygon[0];
  if (!anchor) return undefined;
  const { project, unproject } = localJunctionProjection(anchor);
  const mouths = roadIds.flatMap((id) => {
    try {
      const draft = areas.find((area) => area.roadId === id && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, id);
      const endpoint = endpoints[id];
      const section = endpoint === 'start' ? draft.sections[0] : draft.sections.at(-1);
      if (!section || !endpoint) return [];
      const line = sampleRoadSectionCenterlineWgs84(section).map(project);
      if (endpoint === 'end') line.reverse();
      const total = section.bands.reduce((sum, band) => sum + band.widthM, 0);
      const lengths = line.slice(1).map((point, i) => Math.hypot(point[0] - line[i][0], point[1] - line[i][1]));
      const roadLength = lengths.reduce((sum, length) => sum + length, 0);
      // Set the mouth back into the approach so wide neighbouring kerbs have
      // room to meet. Sample the actual curved centreline, not an extended ray.
      const setback = Math.min(total * .65, 12, roadLength * .4);
      const at = (distance: number): JunctionPoint => {
        for (let i = 0; i < lengths.length; i++) {
          if (distance <= lengths[i] && lengths[i] > 0) return [0, 1].map((axis) => line[i][axis] + (line[i + 1][axis] - line[i][axis]) * distance / lengths[i]) as JunctionPoint;
          distance -= lengths[i];
        }
        return line.at(-1)!;
      };
      const point = at(setback);
      const away = at(setback + .25);
      const length = Math.hypot(away[0] - point[0], away[1] - point[1]);
      if (!length) return [];
      const tangent: JunctionPoint = [(away[0] - point[0]) / length, (away[1] - point[1]) / length];
      const normal: JunctionPoint = [-tangent[1], tangent[0]];
      let cursor = total / 2 + (section.offsetM ?? 0);
      let left = -Infinity, right = Infinity;
      for (const band of section.bands) {
        if (kinds.includes(band.kind)) { left = Math.max(left, cursor); right = Math.min(right, cursor - band.widthM); }
        cursor -= band.widthM;
      }
      if (!Number.isFinite(left)) return [];
      if (endpoint === 'end') [left, right] = [-right, -left];
      const offset = (value: number): JunctionPoint => [point[0] + normal[0] * value, point[1] + normal[1] * value];
      return [{ left: offset(left), right: offset(right), tangent, angle: Math.atan2(tangent[1], tangent[0]) }];
    } catch { return []; }
  }).sort((a, b) => a.angle - b.angle);
  if (mouths.length < 2) return undefined;
  const polygon: JunctionPoint[] = [];
  mouths.forEach((mouth, i) => {
    const next = mouths[(i + 1) % mouths.length];
    polygon.push(mouth.right, mouth.left);
    const reach = Math.hypot(next.right[0] - mouth.left[0], next.right[1] - mouth.left[1]) * curveFactor;
    const a = mouth.left.map((value, axis) => value - mouth.tangent[axis] * reach);
    const b = next.right.map((value, axis) => value - next.tangent[axis] * reach);
    for (let j = 1; j < 12; j++) {
      const t = j / 12, u = 1 - t;
      polygon.push([0, 1].map((axis) => u ** 3 * mouth.left[axis] + 3 * u ** 2 * t * a[axis] + 3 * u * t ** 2 * b[axis] + t ** 3 * next.right[axis]) as JunctionPoint);
    }
  });
  const footprint: JunctionFootprint = { polygon: polygon.map(unproject), holes: [], source: 'generated' };
  if (!validateJunctionFootprint(footprint)) return footprint;
  // Wide mouths can overlap at short junctions. Resolve their generated loops
  // before exposing editable handles; never perform this repair on a traced kerb.
  try {
    const joined = union([polygon]);
    if (joined.length !== 1) return undefined;
    const resolved: JunctionFootprint = { polygon: openJunctionRing(joined[0][0].map(unproject)), holes: [], source: 'generated' };
    return validateJunctionFootprint(resolved) ? undefined : resolved;
  } catch { return undefined; }
}
