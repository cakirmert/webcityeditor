import proj4 from 'proj4';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import type { CityJsonDocument, JsonValue } from '../types';
import { detectCrs } from './projection';
import { buildRoadConnectionIndex, buildSelectedRoadConnections, roadMovementKey, type RoadLaneContinuation } from './road-lane-continuations';
import { deriveEditableRoadDraftFromAreas } from './transportation';
import type { RoadArea, RoadBandKind } from './transportation';
import { buildAutomaticJunctionFootprint, junctionFootprintFromAreas, junctionPolygonArea, localJunctionProjection, validateJunctionFootprint, type JunctionFootprint } from './junction-footprint';
import { union, difference, intersection } from './polygon-boolean';
import { isLaneTransition } from './junction-presentation';
import { buildJunctionLaneGuides } from './junction-lane-guides';

export interface RoadJunctionDraft {
  id: string;
  name: string;
  roadIds: string[];
  endpoints: Record<string, 'start' | 'end'>;
  disabledMovements: string[];
  surfaceMode: 'preserve' | 'rebuild';
  curveFactor: number;
  footprint?: JunctionFootprint;
  allowedLaneMovements?: string[];
  mergedFrom?: { junctionIds: string[]; internalRoadIds: string[] };
  retainedIslands?: Array<{ polygon: [number, number][]; holes: [number, number][][]; sourceType: string }>;
}

export interface RoadJunctionPlan {
  areas: RoadArea[];
  replacedRoadIds: string[];
  movements: RoadLaneContinuation[];
  baseApproaches?: RoadArea[];
  error?: string;
  footprint?: JunctionFootprint;
  warnings?: string[];
  removedRoadIds?: string[];
}

export function readRoadJunction(areas: RoadArea[], id: string): RoadJunctionDraft {
  const index = buildRoadConnectionIndex(areas);
  const junction = index.junctions.find((item) => item.roadId === id);
  if (!junction) throw new Error('Select an intersection to edit.');
  const area = index.areasByRoadId.get(id)?.[0];
  const authoredIds = area?.attributes.connectedCityRoadIds;
  if (area?.attributes.junctionFootprint) {
    const error = validateJunctionFootprint(area.attributes.junctionFootprint);
    if (error) throw new Error(`Invalid saved intersection outline: ${error}`);
  }
  const roadIds = Array.isArray(authoredIds) ? [...new Set(authoredIds.map(String))].sort() : junction.roadIds;
  const endpoints = { ...junction.roadEndpoints };
  const { project } = localJunctionProjection(junction.position);
  for (const roadId of roadIds) {
    if (endpoints[roadId]) continue;
    try {
      const road = index.editableDraftsByRoadId.get(roadId) ?? deriveEditableRoadDraftFromAreas(areas, roadId);
      const start = road.sections[0]?.centerlineWgs84[0];
      const end = road.sections.at(-1)?.centerlineWgs84.at(-1);
      if (start && end) endpoints[roadId] = Math.hypot(...project(start)) <= Math.hypot(...project(end)) ? 'start' : 'end';
    } catch { /* Unsupported source geometry remains available in preserve mode. */ }
  }
  return { id, name: String(area?.attributes.roadName ?? 'Intersection'), roadIds,
    endpoints, disabledMovements: [...(junction.disabledMovements ?? [])],
    surfaceMode: 'preserve', curveFactor: Number(area?.attributes.junctionCurveFactor) || 1 / 3,
    ...(Array.isArray(area?.attributes.junctionAllowedLaneMovements) ? { allowedLaneMovements: area.attributes.junctionAllowedLaneMovements.map(String) } : {}),
    ...(area?.attributes.junctionMergedFrom ? { mergedFrom: area.attributes.junctionMergedFrom as unknown as RoadJunctionDraft['mergedFrom'] } : {}),
    ...(Array.isArray(area?.attributes.junctionRetainedIslands) ? { retainedIslands: area.attributes.junctionRetainedIslands as unknown as RoadJunctionDraft['retainedIslands'] } : {}),
    ...(area?.attributes.junctionFootprint ? { footprint: area.attributes.junctionFootprint as unknown as JunctionFootprint } : {}) };
}

export function roadJunctionCandidateAreas(draft: RoadJunctionDraft, areas: RoadArea[]): RoadArea[] {
  const existing = areas.filter((area) => area.roadId === draft.id);
  const endpoints = draft.roadIds.flatMap((id) => {
    try {
      const road = areas.find((area) => area.roadId === id && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, id);
      return road.sections.flatMap((section) => {
        const point = draft.endpoints[id] === 'start' ? section.centerlineWgs84[0] : section.centerlineWgs84.at(-1);
        return point ? [point] : [];
      });
    } catch { return []; }
  });
  const center: [number, number] = endpoints.length ? [endpoints.reduce((sum, p) => sum + p[0], 0) / endpoints.length, endpoints.reduce((sum, p) => sum + p[1], 0) / endpoints.length] : [0, 0];
  const base: RoadArea[] = existing.length ? existing : [{
    id: `${draft.id}-surface-0`, roadId: draft.id, sectionId: '', bandId: '', surfaceIndex: 0,
    surfaceType: 'TrafficArea', function: 'intersection', polygon: [center], attributes: { transportationUsage: 'intersection' },
  }];
  return [...areas.filter((area) => area.roadId !== draft.id), ...base.map((area) => ({ ...area, attributes: {
    ...area.attributes, connectedCityRoadIds: draft.roadIds, cityRoadEndpoints: draft.endpoints,
    disabledMovements: [], junctionCurveFactor: draft.curveFactor,
    junctionAllowedLaneMovements: draft.allowedLaneMovements ?? null,
    ...(draft.allowedLaneMovements ? { allowedRoadMovements: null, junctionAllowedLaneMovements: draft.allowedLaneMovements } : {}),
  } }))];
}

export function createRoadJunctionAtEndpoint(areas: RoadArea[], roadId: string, sectionId: string, endpoint: 'start' | 'end'): RoadJunctionDraft {
  const road = areas.find((area) => area.roadId === roadId && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, roadId);
  const section = road.sections.find((item) => item.id === sectionId);
  const connection = section?.connections?.[endpoint];
  if (!connection || connection.target !== 'cityjson' || !connection.targetEndpoint || connection.targetEndpoint === 'node') throw new Error('Save a confirmed join to another CityJSON road first.');
  const existingIds = new Set(areas.map((area) => area.roadId));
  let suffix = 1; while (existingIds.has(`junction-${suffix}`)) suffix++;
  return { id: `junction-${suffix}`, name: 'New intersection', roadIds: [roadId, connection.targetId],
    endpoints: { [roadId]: endpoint, [connection.targetId]: connection.targetEndpoint }, disabledMovements: [], surfaceMode: 'rebuild', curveFactor: 1 / 3 };
}

export function buildRoadJunctionPlan(draft: RoadJunctionDraft, areas: RoadArea[]): RoadJunctionPlan {
  const empty = (error: string): RoadJunctionPlan => ({ areas: [], replacedRoadIds: [], movements: [], error });
  if (!Number.isFinite(draft.curveFactor) || draft.curveFactor < 0.15 || draft.curveFactor > 0.65) return empty('Curve reach must be between 0.15 and 0.65.');
  const candidateAreas = roadJunctionCandidateAreas(draft, areas);
  const index = buildRoadConnectionIndex(candidateAreas);
  const selected = candidateAreas.find((area) => area.roadId === draft.id);
  const movements = buildSelectedRoadConnections(index, selected?.id ?? null).continuations
    .filter((item) => item.id.startsWith(`junction-continuation:${draft.id}:`));
  const junctionAreas = areas.filter((area) => area.roadId === draft.id);
  if (draft.mergedFrom) {
    const originals = buildRoadConnectionIndex(areas).junctions;
    const members = new Set(draft.mergedFrom.junctionIds);
    for (const id of draft.mergedFrom.internalRoadIds.filter(id => areas.some(area => area.roadId === id))) {
      const owners = originals.filter(junction => junction.roadIds.includes(id));
      if (!owners.length || owners.some(junction => !members.has(junction.roadId))) return empty('A road marked for consolidation is connected outside this group. Reopen the source junction and build a fresh combined preview.');
    }
    for (const id of draft.mergedFrom.junctionIds.filter(id => id !== draft.id && areas.some(area => area.roadId === id))) {
      const original = originals.find(junction => junction.roadId === id);
      if (!original || original.roadIds.some(roadId => !draft.roadIds.includes(roadId) && !draft.mergedFrom!.internalRoadIds.includes(roadId))) return empty('The saved junction group no longer matches its approach roads. Build a fresh combined preview.');
    }
  }
  if (draft.surfaceMode === 'preserve') return junctionAreas.length ? {
    areas: junctionAreas, replacedRoadIds: [draft.id], movements,
    footprint: draft.footprint ?? junctionFootprintFromAreas(areas, draft.id) ?? buildAutomaticJunctionFootprint(draft.roadIds, draft.endpoints, areas, draft.curveFactor),
  } : empty('Construct the new junction surface before saving.');
  if (draft.roadIds.length < (draft.footprint ? 1 : 2)) return empty('Connect at least two approach roads, or trace the boundary of an existing road end.');
  if (draft.roadIds.some((id) => !areas.some((area) => area.roadId === id))) return empty('Load every connected approach before changing this intersection boundary.');
  let approaches: RoadArea[];
  try { approaches = restoreApproachSurfaces(areas, draft.roadIds); }
  catch (error) { return empty(String(error)); }
  const levels = new Set(approaches.map((area) => area.vertical?.osmLayer).filter((value) => value !== undefined));
  const placements = new Set(approaches.map((area) => area.vertical?.placement).filter((value) => value && value !== 'unknown'));
  const elevations = approaches.map((area) => area.vertical?.elevationM).filter((value): value is number => Number.isFinite(value));
  if (levels.size > 1 || placements.size > 1 || (elevations.length > 0 && Math.max(...elevations) - Math.min(...elevations) > 0.01)) return empty('These approaches are at different levels. Surface rebuilding needs a shared, flat elevation; preserve the surface to edit movements.');
  if (approaches.some((area) => Number(area.attributes.elevationRangeM ?? 0) > 0.01 || (area.vertical?.placement === 'elevated' && !Number.isFinite(area.vertical.elevationM)))) return empty('Surface rebuilding currently needs flat approaches with known elevation. Preserve this junction surface to edit its movements.');
  const origin = movements[0]?.path[0] ?? draft.footprint?.polygon[0] ?? selected?.polygon[0] ?? approaches[0]?.polygon[0];
  if (!origin) return empty('Load the approach surfaces before constructing this intersection.');
  const { project, unproject } = localJunctionProjection(origin);
  const footprintError = draft.footprint && validateJunctionFootprint(draft.footprint);
  if (footprintError) return empty(footprintError);
  const endpoints = { ...draft.endpoints };
  for (const movement of movements) {
    endpoints[movement.sourceRoadId] ??= movement.sourceEndpoint;
    endpoints[movement.targetRoadId] ??= movement.targetEndpoint;
  }
  let layouts;
  try { layouts = draft.roadIds.map((id) => approaches.find((area) => area.roadId === id && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(approaches, id)); }
  catch { return empty('An approach cannot be reconstructed from its imported surfaces. Keep the current intersection or edit that road layout first.'); }
  const hasKind = (kinds: RoadBandKind[]) => layouts.some((road) => road.sections.some((section) => section.bands.some((band) => kinds.includes(band.kind))));
  const primaryKinds: RoadBandKind[] = hasKind(['car_lane', 'parking']) ? ['car_lane', 'parking'] : hasKind(['bike_lane']) ? ['bike_lane'] : ['sidewalk'];
  const automaticOutline = (kinds: RoadBandKind[]) => buildAutomaticJunctionFootprint(draft.roadIds, endpoints, approaches, draft.curveFactor, kinds);
  let footprint = draft.footprint ?? automaticOutline(primaryKinds);
  // Rebuilding must not pave over existing island openings. Include explicit
  // planting/median surfaces and holes in imported junction/approach pavement.
  const protectedIslands = junctionAreas.filter(area => /median|green|plant|island/i.test(String(area.attributes.sourceType ?? area.attributes.transportationUsage ?? area.function)));
  const sourceOpenings: Polygon[] = [...(draft.retainedIslands ?? []).map(island => [island.polygon.map(project), ...island.holes.map(ring => ring.map(project))]), ...(draft.footprint ? [] : [
    ...[...junctionAreas, ...approaches].flatMap(area => (area.holes ?? []).map(ring => [ring.map(project)])),
    ...protectedIslands.map(area => [area.polygon.map(project), ...(area.holes ?? []).map(ring => ring.map(project))]),
  ])];
  const warnings: string[] = [];
  if (movements.some((movement) => movement.path.some((point) => Math.hypot(...project(point)) > 120))) return empty('Approaches are too far apart for a local junction. Move their ends closer first.');
  try {
    if (footprint && sourceOpenings.length) {
      const kept = difference([footprint.polygon.map(project), ...footprint.holes.map(ring => ring.map(project))], ...sourceOpenings);
      if (kept.length !== 1 && !draft.mergedFrom) return empty('The source islands divide this junction into separate carriageways. Keep the imported surface or trace each connected junction boundary.');
      // A consolidated junction is one CityObject with several semantic
      // surfaces. A median may legitimately divide its carriageways.
      if (kept.length === 1 && !draft.retainedIslands?.length) footprint = { ...footprint, polygon: kept[0][0].map(unproject), holes: kept[0].slice(1).map(ring => ring.map(unproject)) };
    }
    if (draft.footprint) {
      const shape: Polygon = [draft.footprint.polygon.map(project), ...draft.footprint.holes.map((ring) => ring.map(project))];
      for (const id of draft.roadIds) {
        const traffic = approaches.filter((area) => area.roadId === id && /driving|parking|car|bus/i.test(String(area.attributes.sourceType ?? area.function)));
        if (traffic.length && !traffic.some((area) => junctionPolygonArea(intersection(shape, [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))])) > .01)) {
          return empty(`The boundary does not reach ${String(traffic[0].attributes.roadName ?? id)}. Extend it slightly into each approach so the pavement joins without a gap.`);
        }
      }
      const blocked = movements.filter((movement) => !draft.disabledMovements.includes(roadMovementKey(movement)) && draft.footprint!.holes.some((ring) => junctionPolygonArea(intersection([movement.polygon.map(project)], [ring.map(project)])) > .01));
      if (blocked.length) warnings.push(`${blocked.length} permitted lane connections cross an island. Review Turns and restrict these movements. Connection curves are guides, not vehicle swept-path checks.`);
    }
    let occupied: MultiPolygon = [];
    const generated: RoadArea[] = [];
    // Physical kerbs are independent of movement paths. Build nested kerb
    // outlines, then subtract the inner modes to make disjoint semantic areas.
    // Turning ribbons can self-cross and must never define the pavement.
    const groups = ['motor', 'cycle', 'walk'] as const;
    const kinds: RoadBandKind[] = ['car_lane', 'parking'];
    for (const group of groups) {
      if (group === 'cycle') kinds.push('bike_lane');
      if (group === 'walk') kinds.push('sidewalk');
      if (!hasKind(group === 'motor' ? ['car_lane', 'parking'] : group === 'cycle' ? ['bike_lane'] : ['sidewalk'])) continue;
      const outline = !generated.length ? footprint : automaticOutline(kinds);
      if (!outline) return empty('The approach kerbs do not form a simple outline. Trace the visible boundary or adjust the road ends before generating this junction.');
      let joined: MultiPolygon = [[outline.polygon.map(project), ...outline.holes.map((ring) => ring.map(project))]];
      if (sourceOpenings.length) joined = difference(joined, ...sourceOpenings);
      if (footprint?.holes.length && group !== 'motor') joined = difference(joined, ...footprint.holes.map((ring): Polygon => [ring.map(project)]));
      const visible = occupied.length ? difference(joined, occupied) : joined;
      occupied = occupied.length ? union(occupied, joined) : joined;
      for (const polygon of visible) {
        const n = generated.length;
        generated.push({ id: `${draft.id}-surface-${n}`, roadId: draft.id, sectionId: 'junction', bandId: `junction-${group}-${n}`, surfaceIndex: n,
          surfaceType: 'TrafficArea', function: 'intersection', polygon: polygon[0].map(unproject), holes: polygon.slice(1).map((ring) => ring.map(unproject)),
          vertical: approaches[0]?.vertical, geometryMode: 'generated', attributes: {
            connectedCityRoadIds: draft.roadIds, cityRoadEndpoints: draft.endpoints, junctionSurfaceMode: 'generated',
            junctionCurveFactor: draft.curveFactor, disabledMovements: draft.disabledMovements, roadName: draft.name,
            transportationUsage: 'intersection', sourceType: group === 'motor' ? 'Driving' : group === 'cycle' ? 'Biking' : 'Sidewalk',
            surfaceMaterial: group === 'walk' ? 'paving_stones' : 'asphalt', allowedModes: group === 'walk' ? ['pedestrian'] : group === 'cycle' ? ['bicycle'] : ['car', 'bus'],
          } });
      }
    }
    if (!generated.length) return empty('No valid junction surface could be constructed.');
    for (const island of draft.retainedIslands ?? []) {
      const clipped = intersection([island.polygon.map(project), ...island.holes.map(ring => ring.map(project))], [footprint!.polygon.map(project)]);
      for (const polygon of clipped) {
        const n = generated.length;
        generated.push({ id: `${draft.id}-surface-${n}`, roadId: draft.id, sectionId: 'junction', bandId: `junction-island-${n}`, surfaceIndex: n,
          surfaceType: 'AuxiliaryTrafficArea', function: 'traffic_island', polygon: polygon[0].map(unproject), holes: polygon.slice(1).map(ring => ring.map(unproject)), vertical: approaches[0]?.vertical,
          attributes: { transportationUsage: 'intersection', sourceType: island.sourceType, junctionSurfaceMode: 'generated', connectedCityRoadIds: draft.roadIds, cityRoadEndpoints: draft.endpoints } });
      }
    }
    if (isLaneTransition(draft,approaches)) {
      const guides = buildJunctionLaneGuides(movements,approaches);
      for (const area of generated) area.attributes.junctionLaneGuides = JSON.parse(JSON.stringify(guides));
    }
    // Give the junction ownership of the connector footprint, trimming the
    // approach surfaces atomically. Preserve holes and per-band semantics.
    const otherJunctions = areas.filter((area) => area.roadId !== draft.id && !draft.mergedFrom?.junctionIds.includes(area.roadId) && area.attributes.junctionSurfaceMode === 'generated' && Array.isArray(area.attributes.connectedCityRoadIds) && area.attributes.connectedCityRoadIds.some((id) => draft.roadIds.includes(String(id))));
    // Islands also remove pavement from the underlying approaches.
    const islandPolygons: Polygon[] = [...(footprint?.holes ?? []).map((ring): Polygon => [ring.map(project)]), ...sourceOpenings];
    const otherPolygons: Polygon[] = otherJunctions.map((area) => [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))]);
    const trimFootprint = islandPolygons.length || otherPolygons.length ? union(occupied, ...islandPolygons, ...otherPolygons) : occupied;
    const trimmed = approaches.flatMap((area) => {
      const polygon: Polygon = [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))];
      return difference(polygon, trimFootprint).map((part, i) => ({ ...area, id: `${area.id}-trim-${i}`, polygon: part[0].map(unproject), holes: part.slice(1).map((ring) => ring.map(unproject)) }));
    });
    if (draft.roadIds.some((id) => !trimmed.some((area) => area.roadId === id))) return empty('The junction would consume an entire short approach. Extend that road before rebuilding.');
    const removedRoadIds = draft.mergedFrom ? [...draft.mergedFrom.junctionIds, ...draft.mergedFrom.internalRoadIds].filter(id => id !== draft.id && areas.some(a => a.roadId === id)) : [];
    return { areas: [...generated, ...(!draft.footprint && !draft.retainedIslands ? protectedIslands : []), ...trimmed], replacedRoadIds: [draft.id, ...draft.roadIds], removedRoadIds, movements, baseApproaches: approaches, footprint, warnings };
  } catch (error) { return empty(`Unable to construct a valid junction: ${error instanceof Error ? error.message : String(error)}`); }
}

export function saveRoadJunction(doc: CityJsonDocument, draft: RoadJunctionDraft, plan: RoadJunctionPlan): string[] {
  if (plan.error) throw new Error(plan.error);
  const existing = doc.CityObjects[draft.id];
  if (draft.surfaceMode === 'rebuild') {
    for (const id of plan.replacedRoadIds) writeRoadSurfaces(doc, id, plan.areas.filter((area) => area.roadId === id));
    for (const id of draft.roadIds) {
      const base = plan.baseApproaches?.filter((area) => area.roadId === id).map(({ editableDraft: _layout, ...area }) => ({ ...area, attributes: { ...area.attributes, junctionBaseSurfaces: null } }));
      if (base?.length) doc.CityObjects[id].attributes!._junctionBaseSurfaces = JSON.parse(JSON.stringify(base));
      if (!doc.CityObjects[id].attributes!._roadLayout && plan.baseApproaches) doc.CityObjects[id].attributes!._roadLayout = JSON.parse(JSON.stringify(deriveEditableRoadDraftFromAreas(plan.baseApproaches, id)));
      doc.CityObjects[id].attributes!._roadGeometryMode = 'generated';
    }
  } else if (!existing) throw new Error('Construct the new junction surface before saving.');
  const object = doc.CityObjects[draft.id];
  const removed = new Set(plan.removedRoadIds ?? []);
  if (removed.size && draft.surfaceMode !== 'rebuild') throw new Error('Consolidation must save the rebuilt surface and removed roads together.');
  const parents = new Set(object.parents ?? []), children = new Set(object.children ?? []);
  for (const id of removed) {
    doc.CityObjects[id]?.parents?.forEach(parent => parents.add(parent));
    doc.CityObjects[id]?.children?.forEach(child => children.add(child));
  }
  if (parents.size) object.parents = [...parents].filter(id => id !== draft.id && !removed.has(id));
  if (children.size) object.children = [...children].filter(id => id !== draft.id && !removed.has(id));
  for (const id of removed) delete doc.CityObjects[id];
  for (const [id,cityObject] of Object.entries(doc.CityObjects)) {
    if (cityObject.children) cityObject.children = [...new Set(cityObject.children.map(id => removed.has(id) ? draft.id : id))].filter(child => child !== id);
    if (cityObject.parents) cityObject.parents = [...new Set(cityObject.parents.map(id => removed.has(id) ? draft.id : id))].filter(parent => parent !== id);
    // Direct endpoint links to absorbed road pieces are superseded by the
    // consolidated junction's external approach membership.
    const layout = cityObject.attributes?._roadLayout as unknown as { sections?: Array<{ connections?: Record<string,{targetId:string}> }> } | undefined;
    for (const section of layout?.sections ?? []) for (const [end,connection] of Object.entries(section.connections ?? {})) if (removed.has(connection.targetId)) delete section.connections![end];
  }
  object.attributes = { ...object.attributes, name: draft.name, class: 'intersection', _transportationKind: 'intersection', _connectedCityRoadIds: draft.roadIds,
    _cityRoadEndpoints: draft.endpoints, _disabledMovements: draft.disabledMovements,
    _junctionCurveFactor: draft.curveFactor, _junctionSurfaceMode: draft.surfaceMode === 'rebuild' ? 'generated' : object.attributes?._junctionSurfaceMode ?? 'source',
    _junctionFootprint: draft.footprint ? JSON.parse(JSON.stringify(draft.footprint)) : null,
    ...(draft.surfaceMode === 'rebuild' ? { _junctionLaneGuides: plan.areas.find(a=>a.roadId===draft.id)?.attributes.junctionLaneGuides ?? null } : {}),
    _junctionAllowedLaneMovements: draft.allowedLaneMovements ?? null,
    ...(draft.allowedLaneMovements ? { _allowedOsm2streetsRoadMovements: null } : {}),
    ...(draft.mergedFrom ? { _junctionMergedFrom: JSON.parse(JSON.stringify(draft.mergedFrom)) } : {}),
    ...(draft.retainedIslands ? { _junctionRetainedIslands: JSON.parse(JSON.stringify(draft.retainedIslands)) } : {}),
    _updatedAt: new Date().toISOString(),
  };
  return plan.replacedRoadIds;
}

function restoreApproachSurfaces(areas: RoadArea[], ids: string[]): RoadArea[] {
  return ids.flatMap((id) => {
    const current = areas.filter((area) => area.roadId === id);
    const stored = current[0]?.attributes.junctionBaseSurfaces;
    if (!Array.isArray(stored) || !stored.length) return current;
    const validRing = (value: unknown): boolean => Array.isArray(value) && value.length >= 3 && value.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
    const bases = stored as unknown as RoadArea[];
    if (!bases.every((area) => area && area.roadId === id && validRing(area.polygon) && (!area.holes || area.holes.every(validRing)) && area.attributes && typeof area.function === 'string')) throw new Error(`Invalid saved junction approach geometry on ${id}.`);
    return bases.map((area) => ({ ...area, editableDraft: current[0]?.editableDraft, attributes: { ...area.attributes, junctionBaseSurfaces: null } }));
  });
}

/** Recompute authored junctions from a changed road, without mutating the document. */
export function buildConnectedJunctionPreview(areas: RoadArea[], replacements: RoadArea[]): { areas: RoadArea[]; plans: Array<{ draft: RoadJunctionDraft; plan: RoadJunctionPlan }>; error?: string } {
  const changed = new Set(replacements.map((area) => area.roadId));
  let working = [...areas.filter((area) => !changed.has(area.roadId)), ...replacements];
  const ids = new Set(areas.filter((area) => area.attributes.junctionSurfaceMode === 'generated' && Array.isArray(area.attributes.connectedCityRoadIds) && area.attributes.connectedCityRoadIds.some((id) => changed.has(String(id)))).map((area) => area.roadId));
  const plans: Array<{ draft: RoadJunctionDraft; plan: RoadJunctionPlan }> = [];
  for (const id of ids) {
    const draft = { ...readRoadJunction(working, id), surfaceMode: 'rebuild' as const };
    const plan = buildRoadJunctionPlan(draft, working);
    if (plan.error) return { areas: replacements, plans: [], error: `${draft.name}: ${plan.error}` };
    plans.push({ draft, plan });
    plan.replacedRoadIds.forEach((roadId) => changed.add(roadId));
    // Carry the untrimmed base through multiple junctions on the same road.
    const updated = plan.areas.map((area) => ({ ...area, attributes: { ...area.attributes, junctionBaseSurfaces: area.roadId === id ? null : JSON.parse(JSON.stringify(plan.baseApproaches?.filter((base) => base.roadId === area.roadId).map(({ editableDraft: _draft, ...base }) => base) ?? [])) as JsonValue } }));
    working = [...working.filter((area) => !plan.replacedRoadIds.includes(area.roadId)), ...updated];
  }
  // A confirmed end-to-end join needs physical pavement ownership as well as
  // a topology link. Construct it in this same transaction, so users never
  // have to save overlapping road ends before they can build the junction.
  const joinedPairs = new Set(buildRoadConnectionIndex(working).junctions.flatMap(junction => junction.roadIds.flatMap(a => junction.roadIds.filter(b => a !== b).map(b => [a, b].sort().join('|')))));
  for (const [roadId, road] of new Map(replacements.filter(area => area.editableDraft).map(area => [area.roadId, area.editableDraft!]))) {
    for (const section of road.sections) for (const endpoint of ['start', 'end'] as const) {
      const connection = section.connections?.[endpoint];
      if (connection?.target !== 'cityjson' || connection.targetId === roadId || !connection.targetEndpoint || connection.targetEndpoint === 'node') continue;
      const pair = [roadId, connection.targetId].sort().join('|');
      if (joinedPairs.has(pair)) continue;
      let target;
      try { target = working.find(area => area.roadId === connection.targetId)?.editableDraft ?? deriveEditableRoadDraftFromAreas(working, connection.targetId); }
      catch { continue; }
      const peerSection = target?.sections.find(item => item.id === connection.targetSectionId) ?? target?.sections[connection.targetEndpoint === 'start' ? 0 : target.sections.length - 1];
      const from = endpoint === 'start' ? section.centerlineWgs84[0] : section.centerlineWgs84.at(-1);
      const to = connection.targetEndpoint === 'start' ? peerSection?.centerlineWgs84[0] : peerSection?.centerlineWgs84.at(-1);
      if (!from || !to || Math.hypot(...localJunctionProjection(from).project(to)) > .05) continue;
      const draft = createRoadJunctionAtEndpoint(working, roadId, section.id, endpoint);
      const plan = buildRoadJunctionPlan(draft, working);
      if (plan.error) return { areas: replacements, plans: [], error: `Connected road ends: ${plan.error}` };
      joinedPairs.add(pair); plans.push({ draft, plan });
      plan.replacedRoadIds.forEach(id => changed.add(id));
      const updated = plan.areas.map(area => ({ ...area, attributes: { ...area.attributes, junctionBaseSurfaces: area.roadId === draft.id ? null : JSON.parse(JSON.stringify(plan.baseApproaches?.filter(base => base.roadId === area.roadId).map(({ editableDraft: _draft, ...base }) => base) ?? [])) as JsonValue } }));
      working = [...working.filter(area => !plan.replacedRoadIds.includes(area.roadId)), ...updated];
    }
  }
  return { areas: working.filter((area) => changed.has(area.roadId)), plans };
}

function writeRoadSurfaces(doc: CityJsonDocument, id: string, areas: RoadArea[]) {
  const crs = detectCrs(doc); if (!crs.supported) throw new Error('Unsupported coordinate system for junction editing.');
  const transform = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  if (!transform.scale.every((value) => Number.isFinite(value) && value > 0)) throw new Error('Invalid coordinate scale.');
  const object = doc.CityObjects[id];
  const oldGeometry = object?.geometry?.[0] as { semantics?: { surfaces?: Record<string, JsonValue>[]; values?: number[] } } | undefined;
  const surfaces: Record<string, JsonValue>[] = [];
  const boundaries = areas.map((area) => {
    const semanticIndex = oldGeometry?.semantics?.values?.[area.surfaceIndex] ?? area.surfaceIndex;
    surfaces.push({ ...oldGeometry?.semantics?.surfaces?.[semanticIndex], type: area.surfaceType, function: area.function,
      transportationUsage: area.attributes.transportationUsage, sectionId: area.sectionId, bandId: area.bandId,
      surfaceMaterial: area.attributes.surfaceMaterial ?? 'asphalt', sourceType: area.attributes.sourceType ?? null,
      allowedModes: area.attributes.allowedModes ?? null,
      trafficDirection: area.attributes.trafficDirection ?? null, allowedTurns: area.attributes.allowedTurns ?? null,
      widthMeters: area.attributes.widthMeters ?? null, osm2streetsLaneIndex: area.attributes.osm2streetsLaneIndex ?? null,
      osm2streetsPropertiesJson: area.attributes.osm2streetsPropertiesJson ?? null,
      allowedRoadMovements: area.attributes.allowedRoadMovements ?? null });
    return [area.polygon, ...(area.holes ?? [])].map((ring) => {
      const open = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
      return open.map((point) => {
        const xy = proj4('EPSG:4326', crs.code, point);
        const xyz = [xy[0], xy[1], area.vertical?.elevationM ?? 0];
        const vertex = xyz.map((value, axis) => Math.round((value - transform.translate[axis]) / transform.scale[axis])) as [number, number, number];
        const index = doc.vertices.length; doc.vertices.push(vertex); return index;
      });
    });
  });
  doc.CityObjects[id] = { ...object, type: 'Road', attributes: { ...object?.attributes, _roadGeometryMode: object?.attributes?._roadGeometryMode ?? 'generated' }, geometry: [{ type: 'MultiSurface', lod: '2', boundaries, semantics: { surfaces, values: surfaces.map((_, i) => i) } }] };
}
