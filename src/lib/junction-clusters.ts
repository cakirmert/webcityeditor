import { buildRoadConnectionIndex, buildSelectedRoadConnections, roadMovementKey, type RoadLaneContinuation } from './road-lane-continuations';
import { readRoadJunction, roadJunctionCandidateAreas, type RoadJunctionDraft } from './road-junctions';
import { deriveEditableRoadDraftFromAreas, type RoadArea } from './transportation';
import { buildAutomaticJunctionFootprint, junctionPolygonArea, localJunctionProjection, openJunctionRing, type JunctionFootprint } from './junction-footprint';
import { intersection, union } from './polygon-boolean';
import type { Polygon } from 'polygon-clipping';

export interface JunctionClusterSuggestion { junctionIds: string[]; internalRoadIds: string[]; roadIds: string[]; }

/** Connected short segments, never proximity alone. Keep the search local and
 * refuse bridges, tunnels and ambiguous connections across distinct levels. */
export function suggestJunctionCluster(areas: RoadArea[], id: string): JunctionClusterSuggestion | null {
  const index = buildRoadConnectionIndex(areas), selected = index.junctions.find(j => j.roadId === id);
  if (!selected) return null;
  const { project } = localJunctionProjection(selected.position);
  const junctions = index.junctions.filter(j => Math.hypot(...project(j.position)) < 65);
  const members = new Set([id]);
  const eligible = new Set<string>();
  for (const [roadId, list] of index.areasByRoadId) {
    const ends = junctions.filter(j => j.roadIds.includes(roadId));
    if (ends.length !== 2 || ends.some(j => j.roadId === roadId)) continue;
    if (Math.hypot(...localJunctionProjection(ends[0].position).project(ends[1].position)) > 35) continue;
    if (list.some(a => a.vertical?.placement === 'underground' || a.vertical?.placement === 'elevated' || (a.vertical?.osmLayer ?? 0) !== 0 || /rail|tram/i.test(String(a.attributes.sourceType)))) continue;
    try {
      const layout = list[0].editableDraft ?? deriveEditableRoadDraftFromAreas(list, roadId);
      const line = layout.sections.flatMap(s => s.centerlineWgs84).map(project);
      const length = line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
      if (length <= 20) eligible.add(roadId);
    } catch { /* Unsupported approaches stay separate. */ }
  }
  let changed = true;
  while (changed && members.size < 12) {
    changed = false;
    for (const roadId of eligible) {
      const ends = junctions.filter(j => j.roadIds.includes(roadId));
      if (ends.some(j => members.has(j.roadId)) && ends.some(j => !members.has(j.roadId))) {
        ends.forEach(j => members.add(j.roadId)); changed = true;
      }
    }
  }
  if (members.size < 2 || members.size > 12) return null;
  const group = junctions.filter(j => members.has(j.roadId));
  const allRoads = [...new Set(group.flatMap(j => j.roadIds))];
  const internalRoadIds = allRoads.filter(roadId => {
    const owners = index.junctions.filter(j => j.roadIds.includes(roadId));
    return owners.length === 2 && owners.every(j => members.has(j.roadId));
  });
  const roadIds = allRoads.filter(roadId => !internalRoadIds.includes(roadId));
  if (roadIds.length < 2) return null;
  const heights = areas.filter(a => allRoads.includes(a.roadId)).map(a => a.vertical?.elevationM).filter((h): h is number => Number.isFinite(h));
  if (heights.length && Math.max(...heights) - Math.min(...heights) > .01) return null;
  return { junctionIds: [...members].sort(), internalRoadIds: internalRoadIds.sort(), roadIds: roadIds.sort() };
}

/** Build one editable ownership boundary while retaining the source network's
 * reachable lane pairs. The caller previews and validates before applying it. */
export function consolidateJunctionCluster(areas: RoadArea[], draft: RoadJunctionDraft, suggestion: JunctionClusterSuggestion): RoadJunctionDraft {
  const index = buildRoadConnectionIndex(areas);
  const members = suggestion.junctionIds.map(id => readRoadJunction(areas, id));
  const endpoints: Record<string, 'start' | 'end'> = {};
  for (const member of members) for (const id of suggestion.roadIds) if (member.endpoints[id]) endpoints[id] = member.endpoints[id];
  const movements = suggestion.junctionIds.flatMap(id => buildSelectedRoadConnections(index, index.areasByRoadId.get(id)?.[0]?.id ?? null).continuations);
  const internal = new Set(suggestion.internalRoadIds), external = new Set(suggestion.roadIds);
  const allowed = new Set<string>();
  for (const start of movements.filter(m => external.has(m.sourceRoadId))) {
    const queue = [start], visited = new Set<string>();
    while (queue.length) {
      const end = queue.shift()!;
      if (visited.has(end.id)) continue;
      visited.add(end.id);
      if (external.has(end.targetRoadId)) {
        const complete: RoadLaneContinuation = { ...start, targetRoadId: end.targetRoadId, targetSectionId: end.targetSectionId,
          targetEndpoint: end.targetEndpoint, targetBandId: end.targetBandId, targetBandIndex: end.targetBandIndex };
        allowed.add(roadMovementKey(complete));
      } else if (internal.has(end.targetRoadId)) {
        queue.push(...movements.filter(next => next.sourceRoadId === end.targetRoadId && next.sourceEndpoint !== end.targetEndpoint && next.mode === end.mode &&
          (next.sourceBandId && end.targetBandId ? next.sourceBandId === end.targetBandId : next.sourceBandIndex === end.targetBandIndex)));
      }
    }
  }
  // An arrow at an external approach describes the whole intersection, not
  // just the first tiny source node. Reallocate those lanes against the final
  // exits; otherwise a locally-left route may loop around to a right-hand exit.
  // Keep the source graph's reachable road pairs as a hard topology boundary.
  const withArrows = new Set(suggestion.roadIds.filter(id => {
    const road = index.editableDraftsByRoadId.get(id) ?? deriveEditableRoadDraftFromAreas(areas,id);
    return road.sections.some(section => section.bands.some(band => band.kind === 'car_lane' && band.allowedTurns?.length));
  }));
  if (withArrows.size) {
    const pairs = [...allowed].map(key => { const fields=JSON.parse(key); return [fields[0],fields[4]]; });
    const combined = roadJunctionCandidateAreas({...draft,roadIds:suggestion.roadIds,endpoints,allowedLaneMovements:undefined},areas).map(area => area.roadId === draft.id
      ? {...area,attributes:{...area.attributes,allowedCityRoadMovements:pairs,junctionAllowedLaneMovements:null}} : area);
    const combinedIndex=buildRoadConnectionIndex(combined);
    const reassigned=buildSelectedRoadConnections(combinedIndex,combined.find(a=>a.roadId===draft.id)!.id).continuations;
    for (const key of allowed) if (withArrows.has(JSON.parse(key)[0])) allowed.delete(key);
    for (const movement of reassigned) if (withArrows.has(movement.sourceRoadId)) allowed.add(roadMovementKey(movement));
  }
  const owned = areas.filter(a => suggestion.junctionIds.includes(a.roadId) || internal.has(a.roadId));
  const traffic = owned.filter(a => !/sidewalk|footway|bike|biking|median|green|buffer|plant/i.test(String(a.attributes.sourceType ?? a.function)));
  if (!traffic.length) throw new Error('This group has no connected carriageway. Trace its boundary after loading all approaches.');
  const { project, unproject } = localJunctionProjection(traffic[0].polygon[0]);
  const polygons: Polygon[] = traffic.map(a => [a.polygon.map(project), ...(a.holes ?? []).map(h => h.map(project))]);
  // A metre of each external mouth makes the shared boundary robust to the
  // import's millimetre quantization, without extending the whole approach.
  for (const id of suggestion.roadIds) {
    const road = areas.find(a => a.roadId === id)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, id);
    const endpoint = endpoints[id], section = endpoint === 'start' ? road.sections[0] : road.sections.at(-1)!;
    const line = section.centerlineWgs84.map(project); if (endpoint === 'end') line.reverse();
    const p = line[0], q = line[1], length = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!length) continue;
    const t = [(q[0] - p[0]) / length, (q[1] - p[1]) / length], n = [-t[1], t[0]], width = section.bands.reduce((sum, b) => sum + b.widthM, 0) * 2;
    const cap: Polygon = [[[-1, -width], [1, -width], [1, width], [-1, width]].map(([x,y]) => [p[0] + t[0] * x + n[0] * y, p[1] + t[1] * x + n[1] * y])];
    for (const area of areas.filter(a => a.roadId === id && /driving|car|bus|parking/i.test(String(a.attributes.sourceType ?? a.function)))) polygons.push(...intersection(cap, [area.polygon.map(project), ...(area.holes ?? []).map(h => h.map(project))]));
  }
  const joined = union(polygons[0], ...polygons.slice(1));
  const footprint: JunctionFootprint | undefined = joined.length === 1
    ? { polygon: openJunctionRing(joined[0][0].map(unproject)), holes: joined[0].slice(1).map(r => openJunctionRing(r.map(unproject))), source: 'generated', reference: 'Consolidated from connected source junctions and short internal roads; review against imagery.' }
    : buildAutomaticJunctionFootprint(suggestion.roadIds, endpoints, areas, draft.curveFactor);
  if (!footprint) throw new Error('The combined road ends do not form a valid boundary. Keep these intersections separate and adjust their approaches first.');
  const shape: Polygon = [footprint.polygon.map(project), ...footprint.holes.map(ring => ring.map(project))];
  // Sidewalk fragments along absorbed road ends are regenerated at the outer
  // kerb. They are not evidence of an island in the middle of a carriageway.
  const retainedIslands = owned.filter(a => /median|green|plant|island/i.test(String(a.attributes.sourceType ?? a.function))).flatMap(area =>
    intersection([area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))], shape)
      .filter(polygon => junctionPolygonArea([polygon]) > .25)
      .map(polygon => ({ polygon: openJunctionRing(polygon[0].map(unproject)), holes: polygon.slice(1).map(ring => openJunctionRing(ring.map(unproject))), sourceType: String(area.attributes.sourceType ?? 'Sidewalk') })));
  for (const area of traffic) for (const hole of area.holes ?? []) {
    for (const polygon of intersection([hole.map(project)],shape)) if (junctionPolygonArea([polygon]) > .25) retainedIslands.push({ polygon: openJunctionRing(polygon[0].map(unproject)), holes: polygon.slice(1).map(ring => openJunctionRing(ring.map(unproject))), sourceType: 'Median' });
  }
  return { ...draft, roadIds: suggestion.roadIds, endpoints, surfaceMode: 'rebuild', footprint, retainedIslands,
    allowedLaneMovements: [...allowed], mergedFrom: { junctionIds: suggestion.junctionIds, internalRoadIds: suggestion.internalRoadIds } };
}
