import type { MultiPolygon } from 'polygon-clipping';
import { deriveEditableRoadDraftFromAreas, sampleRoadSectionCenterlineWgs84, type RoadArea, type RoadBandKind, type RoadDraft } from './transportation';
import { difference, intersection, union } from './polygon-boolean';

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

/** Share one sampled cross-section between the generated kerb and road trim. */
export function junctionApproachMouth(draft: RoadDraft, endpoint: 'start' | 'end', project: (point: JunctionPoint) => JunctionPoint) {
  const section = endpoint === 'start' ? draft.sections[0] : draft.sections.at(-1);
  if (!section) return undefined;
  const line = sampleRoadSectionCenterlineWgs84(section).map(project);
  if (endpoint === 'end') line.reverse();
  const total = section.bands.reduce((sum, band) => sum + band.widthM, 0);
  const lengths = line.slice(1).map((point, i) => Math.hypot(point[0] - line[i][0], point[1] - line[i][1]));
  const roadLength = lengths.reduce((sum, length) => sum + length, 0);
  const setback = Math.min(total * .65, 12, roadLength * .4);
  const at = (distance: number): JunctionPoint => {
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] && lengths[i] > 0) return [0, 1].map((axis) => line[i][axis] + (line[i + 1][axis] - line[i][axis]) * distance / lengths[i]) as JunctionPoint;
      distance -= lengths[i];
    }
    return line.at(-1)!;
  };
  if (!roadLength) return undefined;
  const point = at(setback), away = at(setback + .25);
  const length = Math.hypot(away[0] - point[0], away[1] - point[1]);
  if (!length) return undefined;
  const tangent: JunctionPoint = [(away[0] - point[0]) / length, (away[1] - point[1]) / length];
  return { section, line, point, tangent, total, setback };
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
      const mouth = endpoint && junctionApproachMouth(draft, endpoint, project);
      if (!mouth) return [];
      const { section, line, total, point, tangent } = mouth;
      const normal: JunctionPoint = [-tangent[1], tangent[0]];
      let cursor = total / 2 + (section.offsetM ?? 0);
      let left = -Infinity, right = Infinity;
      for (const band of section.bands) {
        if (kinds.includes(band.kind)) { left = Math.max(left, cursor); right = Math.min(right, cursor - band.widthM); }
        cursor -= band.widthM;
      }
      if (!Number.isFinite(left)) return [];
      if (endpoint === 'end') [left, right] = [-right, -left];
      // Imported lane polygons can be asymmetric or tapered. Read their real
      // kerb at this cross-section instead of assuming centred, uniform bands.
      const edges = areas.filter((area) => area.roadId === id && (area.geometryMode === 'exact' || area.attributes.source === 'osm2streets') && kinds.includes(areaBandKind(area))).flatMap((area) => {
        const ring = openJunctionRing(area.polygon).map(project);
        return ring.flatMap((a, i) => {
          const b = ring[(i + 1) % ring.length];
          const da = (a[0] - point[0]) * tangent[0] + (a[1] - point[1]) * tangent[1];
          const db = (b[0] - point[0]) * tangent[0] + (b[1] - point[1]) * tangent[1];
          if (da * db > 0 || Math.abs(da - db) < 1e-8) return [];
          const t = da / (da - db);
          const lateral = (a[0] + t * (b[0] - a[0]) - point[0]) * normal[0] + (a[1] + t * (b[1] - a[1]) - point[1]) * normal[1];
          return Math.abs(lateral) <= total * 2 ? [lateral] : [];
        });
      });
      if (edges.length >= 2) { left = Math.max(...edges); right = Math.min(...edges); }
      const offset = (value: number): JunctionPoint => [point[0] + normal[0] * value, point[1] + normal[1] * value];
      return [{ left: offset(left), right: offset(right), tangent, tip: line[0], point, angle: Math.atan2(tangent[1], tangent[0]) }];
    } catch { return []; }
  }).sort((a, b) => a.angle - b.angle);
  if (mouths.length < 2) return undefined;
  const hub: JunctionPoint = [0, 1].map((axis) => mouths.reduce((sum, mouth) => sum + mouth.tip[axis], 0) / mouths.length) as JunctionPoint;
  // A curved approach's tangent may point past its neighbour. Order mouths by
  // their actual position around the hub, rather than the road's heading.
  mouths.sort((a, b) => Math.atan2(a.point[1] - hub[1], a.point[0] - hub[0]) - Math.atan2(b.point[1] - hub[1], b.point[0] - hub[0]));
  const polygon: JunctionPoint[] = [];
  mouths.forEach((mouth, i) => {
    const next = mouths[(i + 1) % mouths.length];
    polygon.push(mouth.right, mouth.left);
    let reach = Math.hypot(next.right[0] - mouth.left[0], next.right[1] - mouth.left[1]) * curveFactor;
    const delta: JunctionPoint = [next.right[0] - mouth.left[0], next.right[1] - mouth.left[1]];
    const det = mouth.tangent[0] * next.tangent[1] - mouth.tangent[1] * next.tangent[0];
    if (Math.abs(det) > .01) {
      const s = -(delta[0] * next.tangent[1] - delta[1] * next.tangent[0]) / det;
      const t = -(delta[0] * mouth.tangent[1] - delta[1] * mouth.tangent[0]) / det;
      // A control point beyond the kerb-line intersection creates a cusp at
      // skew or short approaches. Keep the corner inside its tangent wedge.
      if (s > 0 && t > 0) reach = Math.min(reach, .95 * s, .95 * t);
    }
    const a = mouth.left.map((value, axis) => value - mouth.tangent[axis] * reach);
    const b = next.right.map((value, axis) => value - next.tangent[axis] * reach);
    for (let j = 1; j < 12; j++) {
      const t = j / 12, u = 1 - t;
      polygon.push([0, 1].map((axis) => u ** 3 * mouth.left[axis] + 3 * u ** 2 * t * a[axis] + 3 * u * t ** 2 * b[axis] + t ** 3 * next.right[axis]) as JunctionPoint);
    }
  });
  const footprint: JunctionFootprint = { polygon: polygon.map(unproject), holes: [], source: 'generated' };
  if (!validateJunctionFootprint(footprint)) return footprint;
  // Overlapping mouths can make a single perimeter wind back on itself. Unite
  // its local fans around the hub so short, skewed arms cannot leave bow-ties.
  // Only generated geometry is repaired; a user's traced kerb stays authoritative.
  try {
    const fans = polygon.map((point, i) => [[hub, point, polygon[(i + 1) % polygon.length]]]);
    const joined = union(fans[0], ...fans.slice(1));
    if (joined.length !== 1) return undefined;
    const resolved: JunctionFootprint = { polygon: openJunctionRing(joined[0][0].map(unproject)), holes: [], source: 'generated' };
    return validateJunctionFootprint(resolved) ? undefined : resolved;
  } catch { return undefined; }
}

function areaBandKind(area: RoadArea): RoadBandKind {
  const kind = String(area.attributes.transportationUsage ?? area.function).toLowerCase();
  if (/sidewalk|footway|pedestrian/.test(kind)) return 'sidewalk';
  if (/bik|cycl/.test(kind)) return 'bike_lane';
  if (/park/.test(kind)) return 'parking';
  if (/green|plant|verge/.test(kind)) return 'green';
  if (/median|buffer|shoulder/.test(kind)) return 'median';
  return 'car_lane';
}
