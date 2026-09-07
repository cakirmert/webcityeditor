import proj4 from 'proj4';
import { union, difference, intersection, type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { CityJsonDocument, JsonValue } from '../types';
import { detectCrs } from './projection';
import { buildRoadConnectionIndex, buildSelectedRoadConnections, roadMovementKey, type RoadLaneContinuation } from './road-lane-continuations';
import { deriveEditableRoadDraftFromAreas } from './transportation';
import type { RoadArea, RoadBandKind } from './transportation';
import { buildAutomaticJunctionFootprint, junctionFootprintFromAreas, junctionPolygonArea, localJunctionProjection, validateJunctionFootprint, type JunctionFootprint } from './junction-footprint';

export interface RoadJunctionDraft {
  id: string;
  name: string;
  roadIds: string[];
  endpoints: Record<string, 'start' | 'end'>;
  disabledMovements: string[];
  surfaceMode: 'preserve' | 'rebuild';
  curveFactor: number;
  footprint?: JunctionFootprint;
}

export interface RoadJunctionPlan {
  areas: RoadArea[];
  replacedRoadIds: string[];
  movements: RoadLaneContinuation[];
  baseApproaches?: RoadArea[];
  error?: string;
  footprint?: JunctionFootprint;
  warnings?: string[];
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
  if (draft.roadIds.length < 2) return empty('An intersection needs at least two loaded approach roads.');
  if (draft.roadIds.some((id) => !areas.some((area) => area.roadId === id))) return empty('Load every connected approach before editing this intersection.');
  if (!Number.isFinite(draft.curveFactor) || draft.curveFactor < 0.15 || draft.curveFactor > 0.65) return empty('Curve reach must be between 0.15 and 0.65.');
  const candidateAreas = roadJunctionCandidateAreas(draft, areas);
  const index = buildRoadConnectionIndex(candidateAreas);
  const selected = candidateAreas.find((area) => area.roadId === draft.id);
  const movements = buildSelectedRoadConnections(index, selected?.id ?? null).continuations
    .filter((item) => item.id.startsWith(`junction-continuation:${draft.id}:`));
  const junctionAreas = areas.filter((area) => area.roadId === draft.id);
  if (draft.surfaceMode === 'preserve') return junctionAreas.length ? { areas: junctionAreas, replacedRoadIds: [draft.id], movements, footprint: draft.footprint ?? junctionFootprintFromAreas(areas, draft.id) } : empty('Construct the new junction surface before saving.');
  if (movements.length === 0) return empty('No compatible approach lanes. Check direction, mode and loaded road data before constructing a surface.');
  let approaches: RoadArea[];
  try { approaches = restoreApproachSurfaces(areas, draft.roadIds); }
  catch (error) { return empty(String(error)); }
  const levels = new Set(approaches.map((area) => area.vertical?.osmLayer).filter((value) => value !== undefined));
  const placements = new Set(approaches.map((area) => area.vertical?.placement).filter((value) => value && value !== 'unknown'));
  const elevations = approaches.map((area) => area.vertical?.elevationM).filter((value): value is number => Number.isFinite(value));
  if (levels.size > 1 || placements.size > 1 || (elevations.length > 0 && Math.max(...elevations) - Math.min(...elevations) > 0.01)) return empty('These approaches are at different levels. Surface rebuilding needs a shared, flat elevation; preserve the surface to edit movements.');
  if (approaches.some((area) => Number(area.attributes.elevationRangeM ?? 0) > 0.01 || (area.vertical?.placement === 'elevated' && !Number.isFinite(area.vertical.elevationM)))) return empty('Surface rebuilding currently needs flat approaches with known elevation. Preserve this junction surface to edit its movements.');
  const origin = movements[0].path[0];
  const { project, unproject } = localJunctionProjection(origin);
  const footprintError = draft.footprint && validateJunctionFootprint(draft.footprint);
  if (footprintError) return empty(footprintError);
  const endpoints = { ...draft.endpoints };
  for (const movement of movements) {
    endpoints[movement.sourceRoadId] ??= movement.sourceEndpoint;
    endpoints[movement.targetRoadId] ??= movement.targetEndpoint;
  }
  const footprint = draft.footprint ?? buildAutomaticJunctionFootprint(draft.roadIds, endpoints, approaches, draft.curveFactor);
  const warnings: string[] = [];
  if (movements.some((movement) => movement.path.some((point) => Math.hypot(...project(point)) > 120))) return empty('Approaches are too far apart for a local junction. Move their ends closer first.');
  try {
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
      const selectedMovements = movements.filter((movement) => (movement.mode === 'pedestrian' ? 'walk' : movement.mode === 'bicycle' ? 'cycle' : 'motor') === group);
      if (group === 'cycle') kinds.push('bike_lane');
      if (group === 'walk') kinds.push('sidewalk');
      if (!selectedMovements.length) continue;
      const outline = group === 'motor' ? footprint : buildAutomaticJunctionFootprint(draft.roadIds, endpoints, approaches, draft.curveFactor, kinds);
      if (!outline) return empty('The approach kerbs do not form a simple outline. Trace the visible boundary or adjust the road ends before generating this junction.');
      let joined: MultiPolygon = [[outline.polygon.map(project), ...outline.holes.map((ring) => ring.map(project))]];
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
    // Give the junction ownership of the connector footprint, trimming the
    // approach surfaces atomically. Preserve holes and per-band semantics.
    const otherJunctions = areas.filter((area) => area.roadId !== draft.id && area.attributes.junctionSurfaceMode === 'generated' && Array.isArray(area.attributes.connectedCityRoadIds) && area.attributes.connectedCityRoadIds.some((id) => draft.roadIds.includes(String(id))));
    // Islands also remove pavement from the underlying approaches.
    const islandPolygons: Polygon[] = (footprint?.holes ?? []).map((ring) => [ring.map(project)]);
    const otherPolygons: Polygon[] = otherJunctions.map((area) => [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))]);
    const trimFootprint = islandPolygons.length || otherPolygons.length ? union(occupied, ...islandPolygons, ...otherPolygons) : occupied;
    const trimmed = approaches.flatMap((area) => {
      const polygon: Polygon = [area.polygon.map(project), ...(area.holes ?? []).map((ring) => ring.map(project))];
      return difference(polygon, trimFootprint).map((part, i) => ({ ...area, id: `${area.id}-trim-${i}`, polygon: part[0].map(unproject), holes: part.slice(1).map((ring) => ring.map(unproject)) }));
    });
    if (draft.roadIds.some((id) => !trimmed.some((area) => area.roadId === id))) return empty('The junction would consume an entire short approach. Extend that road before rebuilding.');
    return { areas: [...generated, ...trimmed], replacedRoadIds: [draft.id, ...draft.roadIds], movements, baseApproaches: approaches, footprint, warnings };
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
  object.attributes = { ...object.attributes, name: draft.name, class: 'intersection', _transportationKind: 'intersection', _connectedCityRoadIds: draft.roadIds,
    _cityRoadEndpoints: draft.endpoints, _disabledMovements: draft.disabledMovements.filter((key) => plan.movements.some((movement) => roadMovementKey(movement) === key)),
    _junctionCurveFactor: draft.curveFactor, _junctionSurfaceMode: draft.surfaceMode === 'rebuild' ? 'generated' : object.attributes?._junctionSurfaceMode ?? 'source',
    _junctionFootprint: draft.footprint ? JSON.parse(JSON.stringify(draft.footprint)) : null,
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
      allowedModes: area.attributes.allowedModes ?? null });
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
