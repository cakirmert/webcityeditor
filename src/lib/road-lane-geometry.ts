import type { RoadArea } from './transportation';

type Point = [number, number];

/** Sample the actual lane interior. Boolean trimming can leave an odd number
 * of vertices, so pairing opposite polygon vertices is not a valid centreline. */
export function laneInteriorCenterline(area: Pick<RoadArea, 'polygon' | 'holes'>, axis: Point[] | null): Point[] {
  const origin = area.polygon[0];
  if (!origin || area.polygon.length < 3) return [];
  const sx = 111320 * Math.cos(origin[1] * Math.PI / 180), sy = 111320;
  const project = (p: Point): Point => [(p[0] - origin[0]) * sx, (p[1] - origin[1]) * sy];
  const unproject = (p: Point): Point => [origin[0] + p[0] / sx, origin[1] + p[1] / sy];
  const rings = [area.polygon, ...(area.holes ?? [])].map(r => r.map(project));
  let line = axis?.map(project);
  if (!line || line.length < 2) {
    const ring = rings[0];
    const center: Point = [0, 1].map(i => ring.reduce((sum, p) => sum + p[i], 0) / ring.length) as Point;
    const xx = ring.reduce((s, p) => s + (p[0] - center[0]) ** 2, 0);
    const yy = ring.reduce((s, p) => s + (p[1] - center[1]) ** 2, 0);
    const xy = ring.reduce((s, p) => s + (p[0] - center[0]) * (p[1] - center[1]), 0);
    const angle = .5 * Math.atan2(2 * xy, xx - yy), t: Point = [Math.cos(angle), Math.sin(angle)];
    const lengths = ring.map(p => (p[0] - center[0]) * t[0] + (p[1] - center[1]) * t[1]);
    line = [Math.min(...lengths), Math.max(...lengths)].map(d => [center[0] + t[0] * d, center[1] + t[1] * d]);
  }
  const runs: Point[][] = [[]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < .001) continue;
    const t: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], n: Point = [-t[1], t[0]];
    const steps = Math.max(2, Math.min(240, Math.ceil(length / 1.25)));
    for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
      const p: Point = [a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps];
      const hits = rings.flatMap(ring => ring.flatMap((c, k) => {
        const d = ring[(k + 1) % ring.length];
        const ca = (c[0] - p[0]) * t[0] + (c[1] - p[1]) * t[1], da = (d[0] - p[0]) * t[0] + (d[1] - p[1]) * t[1];
        if (ca * da > 0 || Math.abs(ca - da) < 1e-8) return [];
        const f = ca / (ca - da);
        return [(c[0] + (d[0] - c[0]) * f - p[0]) * n[0] + (c[1] + (d[1] - c[1]) * f - p[1]) * n[1]];
      })).sort((a, b) => a - b).filter((x, k, all) => k === 0 || x - all[k - 1] > .001);
      const intervals = hits.slice(1).flatMap((h, k) => {
        const middle = (h + hits[k]) / 2, point: Point = [p[0] + middle * n[0], p[1] + middle * n[1]];
        return h - hits[k] > .04 && pointInRing(point, rings[0]) && !rings.slice(1).some(r => pointInRing(point, r)) ? [{ point, width: h - hits[k] }] : [];
      }).sort((a, b) => b.width - a.width);
      if (intervals[0]) runs.at(-1)!.push(intervals[0].point);
      else if (runs.at(-1)!.length) runs.push([]);
    }
  }
  return runs.sort((a, b) => pathLength(b) - pathLength(a))[0].map(unproject);
}

export function pointInRing(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function pathLength(line: Point[]) { return line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0); }
