import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CityJsonDocument } from '../../src/types';
import { deriveEditableRoadDraftFromAreas, extractTransportationAreas } from '../../src/lib/transportation';
import { suggestJunctionCluster, consolidateJunctionCluster } from '../../src/lib/junction-clusters';
import { buildRoadJunctionPlan, readRoadJunction, saveRoadJunction } from '../../src/lib/road-junctions';
import { roadMovementKey } from '../../src/lib/road-lane-continuations';
import { validateRoadOverlaps } from '../../src/lib/road-fit';
import { compactVertices } from '../../src/lib/compact';
import { checkIntegrity } from '../../src/lib/integrity';
import { buildRoadVisuals } from '../../src/lib/road-visuals';
import { isLaneTransition } from '../../src/lib/junction-presentation';
import { junctionPolygonArea, localJunctionProjection } from '../../src/lib/junction-footprint';
import { intersection } from '../../src/lib/polygon-boolean';

const prefix = 'hh-road-r00-c00-osm2streets-';
const source = () => JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt-source.json','utf8')) as CityJsonDocument;

describe('real Hamburg junction consolidation', () => {
  it('previews without mutations, then saves one junction and all approach trims atomically', () => {
    const doc = source(), before = JSON.stringify(doc), areas = extractTransportationAreas(doc), id = `${prefix}intersection-210`;
    const group = suggestJunctionCluster(areas,id)!;
    expect(group.junctionIds).toHaveLength(9);
    expect(group.internalRoadIds).toHaveLength(11);
    const draft = consolidateJunctionCluster(areas,readRoadJunction(areas,id),group);
    const plan = buildRoadJunctionPlan(draft,areas);
    expect(plan.error).toBeUndefined();
    expect(plan.removedRoadIds).toHaveLength(19);
    expect(plan.movements).toHaveLength(49);
    expect(new Set(plan.movements.map(roadMovementKey))).toEqual(new Set(draft.allowedLaneMovements));
    expect(validateRoadOverlaps(plan.areas,areas,'EPSG:25832',plan.removedRoadIds)).toEqual([]);
    expect(JSON.stringify(doc)).toBe(before);
    saveRoadJunction(doc,draft,plan); compactVertices(doc);
    for (const removed of plan.removedRoadIds!) expect(doc.CityObjects[removed]).toBeUndefined();
    expect(checkIntegrity(doc).ok).toBe(true);
    const saved = extractTransportationAreas(JSON.parse(JSON.stringify(doc)));
    const reopened = buildRoadJunctionPlan(readRoadJunction(saved,id),saved);
    expect(new Set(reopened.movements.map(roadMovementKey))).toEqual(new Set(draft.allowedLaneMovements));
    expect(readRoadJunction(saved,id).roadIds).toHaveLength(13);
  });

  it('never absorbs an elevated railway or road as an internal junction link', () => {
    const areas = extractTransportationAreas(source()), id = `${prefix}intersection-210`;
    const group = suggestJunctionCluster(areas,id)!;
    const elevated = areas.map(a => group.internalRoadIds.includes(a.roadId) ? {...a,vertical:{placement:'elevated' as const,osmLayer:1,elevationM:6,source:'user' as const}} : a);
    expect(suggestJunctionCluster(elevated,id)).toBeNull();
    expect(suggestJunctionCluster(areas,`${prefix}intersection-483`)).toBeNull();
  });

  it('keeps retained islands out of traffic pavement through save and reload', () => {
    const doc = source(), areas=extractTransportationAreas(doc), id=`${prefix}intersection-210`;
    const draft=consolidateJunctionCluster(areas,readRoadJunction(areas,id),suggestJunctionCluster(areas,id)!);
    const {project,unproject}=localJunctionProjection([9.98645,53.54765]);
    const polygon=([[-1,-1],[1,-1],[1,1],[-1,1]] as [number,number][]).map(unproject);
    draft.retainedIslands=[{polygon,holes:[],sourceType:'Median'}];
    const plan=buildRoadJunctionPlan(draft,areas);
    expect(plan.error).toBeUndefined();
    expect(plan.areas.some(a=>a.function==='traffic_island')).toBe(true);
    for (const area of plan.areas.filter(a=>a.attributes.sourceType==='Driving')) {
      expect(junctionPolygonArea(intersection([area.polygon.map(project),...(area.holes??[]).map(r=>r.map(project))],[polygon.map(project)]))).toBeLessThan(.01);
    }
    saveRoadJunction(doc,draft,plan);
    expect(readRoadJunction(extractTransportationAreas(doc),id).retainedIslands).toEqual(draft.retainedIslands);
  });

  it('regenerates a 3-to-6 lane split with separate arrows and all target lanes connected', () => {
    const doc=JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt.json','utf8')) as CityJsonDocument;
    const areas=extractTransportationAreas(doc),id=`${prefix}intersection-483`,draft=readRoadJunction(areas,id);
    expect(isLaneTransition(draft,areas)).toBe(true);
    draft.surfaceMode='rebuild';
    const plan=buildRoadJunctionPlan(draft,areas);
    expect(plan.error).toBeUndefined();
    const driving=plan.movements.filter(m=>m.mode==='car');
    expect(driving).toHaveLength(6);
    expect(new Set(driving.map(m=>`${m.targetRoadId}-${m.targetBandIndex}`)).size).toBe(6);
    expect(validateRoadOverlaps(plan.areas,areas,'EPSG:25832')).toEqual([]);
    saveRoadJunction(doc,draft,plan); compactVertices(doc);
    const saved=extractTransportationAreas(JSON.parse(JSON.stringify(doc)));
    const visuals=buildRoadVisuals(saved.filter(a=>a.roadId===id));
    const left=visuals.directions.filter(a=>a.turn==='left');
    expect(left).toHaveLength(2);
    const {project}=localJunctionProjection(left[0].position);
    expect(Math.hypot(...project(left[1].position))).toBeGreaterThan(1);
    expect(visuals.dividers.length).toBeGreaterThanOrEqual(3);
    expect(checkIntegrity(doc).ok).toBe(true);
  });
  it('matches both left-only approach lanes to left exits after consolidation', () => {
    const doc=source(),roadId=`${prefix}road-469`,id=`${prefix}intersection-210`;
    const layout=deriveEditableRoadDraftFromAreas(extractTransportationAreas(doc),roadId);
    for(const section of layout.sections)for(const band of section.bands)if(band.kind==='car_lane')band.allowedTurns=['left'];
    doc.CityObjects[roadId].attributes!._roadLayout=JSON.parse(JSON.stringify(layout));
    const areas=extractTransportationAreas(doc),draft=consolidateJunctionCluster(areas,readRoadJunction(areas,id),suggestJunctionCluster(areas,id)!);
    const plan=buildRoadJunctionPlan(draft,areas);
    const moves=plan.movements.filter(m=>m.sourceRoadId===roadId);
    expect(moves).toHaveLength(2);
    expect(moves.map(m=>m.turn)).toEqual(['left','left']);
    expect(new Set(moves.map(m=>m.targetRoadId))).toEqual(new Set([`${prefix}road-50`]));
    expect(new Set(moves.map(m=>m.targetBandIndex)).size).toBe(2);
    expect(new Set(moves.map(m=>m.sourceBandIndex)).size).toBe(2);
    saveRoadJunction(doc,draft,plan);
    const reopened=extractTransportationAreas(doc);
    expect(buildRoadJunctionPlan(readRoadJunction(reopened,id),reopened).movements.filter(m=>m.sourceRoadId===roadId).map(m=>m.turn)).toEqual(['left','left']);
  });
});
