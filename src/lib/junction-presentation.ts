import type { RoadJunctionDraft } from './road-junctions';
import type { RoadLaneContinuation } from './road-lane-continuations';
import { deriveEditableRoadDraftFromAreas, type RoadArea } from './transportation';

const colors: [number, number, number][] = [[16,119,211],[201,84,30],[122,74,191],[0,135,112],[190,52,111],[112,120,31],[37,116,137],[134,91,52]];
export function approachColor(draft: Pick<RoadJunctionDraft,'roadIds'>, id: string): [number, number, number] { return colors[Math.max(0,draft.roadIds.indexOf(id)) % colors.length]; }
export const laneSourceKey = (movement: RoadLaneContinuation) => JSON.stringify([movement.sourceRoadId,movement.sourceSectionId,movement.sourceBandIndex]);
export const turnSymbol = (turn: string) => ({left:'↰',sharp_left:'↰',slight_left:'↖',right:'↱',sharp_right:'↱',slight_right:'↗',through:'↑',uturn:'↶',merge_left:'↖',merge_right:'↗'}[turn] ?? '↑');
export const isDrivingMovement = (movement: RoadLaneContinuation) => !['pedestrian','bicycle','rail','tram'].includes(movement.mode);

/** A local, nearly parallel same-street seam/fork is a lane transition, not a
 * new crossing. It may be proposed automatically, but saving stays explicit. */
export function isLaneTransition(draft: RoadJunctionDraft, areas: RoadArea[]): boolean {
  if (draft.roadIds.length < 2 || draft.roadIds.length > 3 || draft.mergedFrom) return false;
  try {
    const names = draft.roadIds.map(id => String(areas.find(a => a.roadId === id)?.attributes.roadName ?? '').trim());
    if (names.some(name => !name || /^osm2streets /i.test(name)) || new Set(names).size !== 1) return false;
    const tangents = draft.roadIds.map(id => {
      const road = areas.find(a => a.roadId === id)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas,id);
      if (road.vertical?.placement === 'elevated' || road.vertical?.placement === 'underground') throw new Error('Separate levels');
      const end = draft.endpoints[id], section = end === 'start' ? road.sections[0] : road.sections.at(-1)!;
      const line = end === 'start' ? section.centerlineWgs84 : [...section.centerlineWgs84].reverse();
      const x = (line[1][0]-line[0][0])*Math.cos(line[0][1]*Math.PI/180), y=line[1][1]-line[0][1], length=Math.hypot(x,y);
      return [x/length,y/length];
    });
    return tangents.every(t=>Math.abs(t[0]*tangents[0][0]+t[1]*tangents[0][1])>.72) && tangents.some(t=>t[0]*tangents[0][0]+t[1]*tangents[0][1]<-.72);
  } catch { return false; }
}
