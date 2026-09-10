import type { RoadLaneContinuation } from './road-lane-continuations';
import { deriveEditableRoadDraftFromAreas, type RoadAllowedTurn, type RoadArea } from './transportation';
import { isDrivingMovement } from './junction-presentation';

export interface JunctionLaneGuide {
  sourceRoadId: string; targetRoadId: string;
  sourceBandIndex: number; targetBandIndex: number;
  path: [number,number][]; sourceWidthM: number; targetWidthM: number;
  allowedTurns: RoadAllowedTurn[];
}

export function buildJunctionLaneGuides(movements: RoadLaneContinuation[], areas: RoadArea[]): JunctionLaneGuide[] {
  const guides = new Map<string,JunctionLaneGuide>();
  for (const m of movements.filter(isDrivingMovement)) {
    const key = JSON.stringify([m.sourceRoadId,m.sourceBandIndex,m.targetRoadId,m.targetBandIndex]);
    if (guides.has(key)) continue;
    try {
      const road = areas.find(a=>a.roadId===m.sourceRoadId)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas,m.sourceRoadId);
      const band = road.sections.find(s=>s.id===m.sourceSectionId)?.bands[m.sourceBandIndex];
      const target = areas.find(a=>a.roadId===m.targetRoadId)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas,m.targetRoadId);
      const targetBand = target.sections.find(s=>s.id===m.targetSectionId)?.bands[m.targetBandIndex];
      guides.set(key,{sourceRoadId:m.sourceRoadId,targetRoadId:m.targetRoadId,sourceBandIndex:m.sourceBandIndex,targetBandIndex:m.targetBandIndex,path:m.path,
        sourceWidthM:m.sourceWidthM,targetWidthM:m.targetWidthM,allowedTurns:band?.allowedTurns?.length ? band.allowedTurns : targetBand?.allowedTurns ?? []});
    } catch { /* Incomplete source lanes are reported by the junction plan. */ }
  }
  return [...guides.values()];
}

export function readJunctionLaneGuides(value: unknown): JunctionLaneGuide[] {
  if (!Array.isArray(value) || value.length>150) return [];
  return value.filter((g): g is JunctionLaneGuide => g && typeof g.sourceRoadId==='string' && typeof g.targetRoadId==='string' && Number.isInteger(g.sourceBandIndex) && Number.isInteger(g.targetBandIndex) &&
    Array.isArray(g.path) && g.path.length>=2 && g.path.length<=500 && g.path.every((p: unknown)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)) &&
    Number.isFinite(g.sourceWidthM) && g.sourceWidthM>0 && Number.isFinite(g.targetWidthM) && g.targetWidthM>0 && Array.isArray(g.allowedTurns));
}
