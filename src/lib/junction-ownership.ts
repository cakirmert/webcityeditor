import type { Polygon, MultiPolygon } from 'polygon-clipping';
import type { RoadArea, RoadDraft } from './transportation';
import { difference, intersection, union } from './polygon-boolean';
import { junctionApproachMouth, junctionPolygonArea, type JunctionPoint } from './junction-footprint';
import { roadVerticalRelation } from './road-fit';

/** Unchanged roads keep their pavement. Only fit newly generated surfaces;
 * a drawn boundary still goes through the ordinary blocking validation. */
export function fitGeneratedJunctionEdges(generated: RoadArea[], areas: RoadArea[], replaced: Set<string>, project: (point: JunctionPoint) => JunctionPoint, unproject: (point: number[]) => JunctionPoint, approaches: RoadArea[] = []) {
  const points = generated.flatMap(area => area.polygon);
  const bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  const neighbours = areas.filter(area => !replaced.has(area.roadId) && roadVerticalRelation(generated[0]?.vertical, area.vertical) === 'collision' &&
    Math.min(...area.polygon.map(p => p[0])) <= bounds[2] && Math.max(...area.polygon.map(p => p[0])) >= bounds[0] &&
    Math.min(...area.polygon.map(p => p[1])) <= bounds[3] && Math.max(...area.polygon.map(p => p[1])) >= bounds[1]);
  if (!neighbours.length) return { areas: generated, fittedRoads: 0 };
  const occupied = neighbours.map(area => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))]);
  const mask = union(occupied[0], ...occupied.slice(1));
  const motorApproaches = approaches.filter(area => /driving|car|bus|parking/i.test(String(area.attributes.sourceType ?? area.function)))
    .map(area => ({id:area.roadId,polygon:[area.polygon.map(project),...(area.holes??[]).map(ring=>ring.map(project))]}));
  const approachIds = (polygon: Polygon) => new Set(motorApproaches.filter(area => junctionPolygonArea(intersection(polygon,area.polygon)) > .01).map(area => area.id));
  const fitted = new Set<string>();
  let error: string | undefined;
  const result = generated.flatMap(area => {
    const polygon = [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))];
    if (junctionPolygonArea(intersection(polygon, mask)) < .001) return [area];
    for (let i = 0; i < neighbours.length; i++) if (junctionPolygonArea(intersection(polygon, occupied[i])) > .001) fitted.add(neighbours[i].roadId);
    let parts = difference(polygon, mask).filter(part => junctionPolygonArea([part]) > .001);
    if (/driving|car|bus/i.test(String(area.attributes.sourceType ?? area.function)) && junctionPolygonArea([polygon]) > .04) {
      const required = approachIds(polygon);
      const connected = parts.filter(part => {
        const reached = approachIds(part);
        return required.size > 0 && [...required].every(id => reached.has(id));
      }).sort((a,b)=>junctionPolygonArea([b])-junctionPolygonArea([a]));
      // If one component reaches all original road mouths, extra islands are
      // redundant scraps of this new corner, not another road to retain.
      if (parts.length > 1 && connected.length) parts = [connected[0]];
      if (parts.length === 0 || (required.size > 0 && connected.length === 0) || parts.filter(part => junctionPolygonArea([part]) > .04).length > 1) {
        error = 'A neighbouring road cuts through this junction. The connected surface is retained to avoid detached pieces. Review the highlighted overlap; combine the connected pieces or save with warnings.';
        return [area];
      }
    }
    return parts.map((part, i) => ({ ...area, id: `${area.id}-fit-${i}`, polygon: part[0].map(unproject), holes: part.slice(1).map(ring => ring.map(unproject)) }));
  });
  return { areas: result, fittedRoads: fitted.size, error };
}

/** Use the same cross-section as the new kerb, so the old rectangular tip
 * cannot survive beside it. The mask is local to the selected road end. */
export function junctionApproachEndMask(road: RoadDraft, endpoint: 'start' | 'end', project: (point: JunctionPoint) => JunctionPoint): Polygon | undefined {
  const mouth = junctionApproachMouth(road, endpoint, project);
  if (!mouth) return undefined;
  const { point, tangent, total, setback } = mouth, normal = [-tangent[1], tangent[0]];
  const width = Math.max(total * 2, 2);
  return [[[-setback - width, -width], [0, -width], [0, width], [-setback - width, width]].map(([x,y]) => [point[0] + tangent[0] * x + normal[0] * y, point[1] + tangent[1] * x + normal[1] * y])];
}

/** A curved cut may split the source band into the real approach and detached
 * pieces at its old tip. Keep pieces reaching beyond the generated mouth. */
export function removeJunctionTipFragments(parts: MultiPolygon, endMask: Polygon | undefined): MultiPolygon {
  if (!endMask || parts.length < 2) return parts;
  return parts.filter(part => junctionPolygonArea(difference(part, endMask)) > .001);
}

/** Internal source segments are often tiny, disconnected rectangles after a
 * junction merge. Only keep cycle paving connected to a full-width approach;
 * decide ownership before cutting it out of the motor/walking surfaces. */
export function connectedCyclewayComponents(network: MultiPolygon, approaches: Polygon[]): MultiPolygon {
  return network.filter(part => approaches.some(approach => junctionPolygonArea(intersection(part, approach)) > .001));
}
