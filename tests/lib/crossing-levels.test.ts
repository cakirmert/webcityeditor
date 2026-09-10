import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { railwayInBounds, readRailwayContext, roadCrossingLayer, schematicRoadHeight, visibleRailwaySegments } from '../../src/lib/crossing-levels';
import { extractTransportationAreas } from '../../src/lib/transportation';
import { PolygonLayer, PathLayer } from '@deck.gl/layers';
import { orderTransportCrossings } from '../../src/components/transport-crossing-layers';

describe('railway crossing context', () => {
  it('puts the real Altmannbrücke road decks and their paint above station tracks in both views', () => {
    const doc=JSON.parse(readFileSync('public/examples/hamburg-altmannbruecke.json','utf8'));
    const areas=extractTransportationAreas(doc).filter(a=>a.attributes.roadName==='Altmannbrücke' && a.vertical?.osmLayer===1);
    expect(areas.length).toBeGreaterThan(10);
    const rails=readRailwayContext(JSON.parse(readFileSync('public/data/hamburg/hamburg-railway-context.json','utf8')))
      .filter(r=>railwayInBounds(r,[10.0069,53.55022,10.0078,53.5505]) && r.layer===-1);
    expect(rails.length).toBeGreaterThan(5);
    expect(rails.every(r=>r.placement==='ground')).toBe(true);
    const road=new PolygonLayer({id:'cityjson-road-areas',data:areas,getPolygon:(a:typeof areas[number])=>a.polygon});
    const paint=new PathLayer({id:'cityjson-road-lane-markings',data:[{roadId:areas[0].roadId,path:areas[0].polygon}],getPath:(d:any)=>d.path});
    for (const levels of [false,true]) {
      const sorted=orderTransportCrossings([road,paint],areas,rails,levels,1);
      const deck=sorted.findIndex(l=>l.id==='cityjson-road-areas-level-1');
      expect(deck).toBeGreaterThan(sorted.findIndex(l=>l.id==='road-railway-rails-level--1'));
      expect(sorted.findIndex(l=>l.id==='cityjson-road-lane-markings-level-1')).toBeGreaterThan(deck);
      const polygon=(sorted[deck].props as any).getPolygon(areas[0]);
      expect(polygon[0][2]).toBe(levels ? 6.02 : 0);
    }
  });
  it('keeps tunnels below roads and respects an explicit zero layer on a bridge', () => {
    const area=extractTransportationAreas(JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json','utf8')))[0];
    expect(roadCrossingLayer({...area,vertical:{placement:'elevated',osmLayer:0,source:'osm_tags'}})).toBe(0);
    const rail=readRailwayContext({features:[{id:'rail',properties:{bridge:'yes',layer:'0'},geometry:{type:'LineString',coordinates:[[10,53],[10.001,53]]}}]});
    expect(rail[0].layer).toBe(0);
    const roads=[{...area,roadId:'tunnel',vertical:{placement:'underground' as const,osmLayer:-1,source:'osm_tags' as const}}, {...area,roadId:'surface'}];
    const result=orderTransportCrossings([new PolygonLayer({id:'cityjson-road-areas',data:roads,getPolygon:a=>a.polygon})],roads,rail,false,1);
    expect(result[0].id).toBe('cityjson-road-areas-level--1');
  });
  it('occludes railway segments beneath a translucent bridge, retains holes and never hides an upper railway', () => {
    const sample=extractTransportationAreas(JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json','utf8')))[0];
    const road={...sample,polygon:[[1,-1],[3,-1],[3,1],[1,1]] as [number,number][],holes:undefined,vertical:{placement:'elevated' as const,osmLayer:1,source:'osm_tags' as const}};
    const rail={id:'test',path:[[0,0],[4,0]] as [number,number][],layer:0,placement:'ground' as const,bounds:[0,0,4,0] as [number,number,number,number]};
    const before=JSON.stringify(rail);
    expect(visibleRailwaySegments([rail],[road]).map(r=>r.path)).toEqual([[[0,0],[1,0]],[[3,0],[4,0]]]);
    expect(visibleRailwaySegments([{...rail,layer:2}],[road])[0].path).toEqual(rail.path);
    const holes=[[[1.5,-.5],[2.5,-.5],[2.5,.5],[1.5,.5]] as [number,number][]];
    expect(visibleRailwaySegments([rail],[{...road,holes}]).map(r=>r.path)).toEqual([[[0,0],[1,0]],[[1.5,0],[2.5,0]],[[3,0],[4,0]]]);
    expect(JSON.stringify(rail)).toBe(before);
    const half={...road,polygon:[[1,-1],[2,-1],[2,1],[1,1]] as [number,number][]};
    const other={...road,roadId:'other-half',polygon:[[2.00001,-1],[3,-1],[3,1],[2.00001,1]] as [number,number][]};
    expect(visibleRailwaySegments([rail],[half,other]).map(r=>r.path)).toEqual([[[0,0],[1,0]],[[3,0],[4,0]]]);
    expect(visibleRailwaySegments([rail],[half,{...other,attributes:{...other.attributes,roadName:'A separate bridge'}}])).toHaveLength(3);
  });
  it('contains both mapped elevated tracks across Rödingsmarkt', () => {
    const rails=readRailwayContext(JSON.parse(readFileSync('public/data/hamburg/hamburg-railway-context.json','utf8')));
    const crossing=rails.filter(r=>railwayInBounds(r,[9.98625,53.54758,9.98653,53.54772]) && r.placement==='elevated');
    expect(crossing.length).toBeGreaterThanOrEqual(2);
    expect(crossing.every(r=>r.layer>0)).toBe(true);
  });
  it('keeps schematic elevations in the viewer without mutating source geometry', () => {
    const doc=JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json','utf8'));
    const area=extractTransportationAreas(doc)[0],before=JSON.stringify(doc);
    expect(schematicRoadHeight({...area,vertical:{placement:'elevated',osmLayer:2,elevationM:14,source:'user'}})).toBe(12);
    expect(schematicRoadHeight({...area,vertical:{placement:'underground',osmLayer:-1,elevationM:-4,source:'user'}})).toBe(-6);
    expect(JSON.stringify(doc)).toBe(before);
    expect(readRailwayContext({features:[{geometry:{type:'LineString',coordinates:[[null,0],[0,1]]}}]})).toEqual([]);
  });
});
