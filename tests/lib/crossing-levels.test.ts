import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { railwayInBounds, readRailwayContext, schematicRoadHeight } from '../../src/lib/crossing-levels';
import { extractTransportationAreas } from '../../src/lib/transportation';

describe('railway crossing context', () => {
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
