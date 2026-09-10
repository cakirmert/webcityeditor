import { describe, expect, it } from 'vitest';
import type { RoadArea } from '../../src/lib/transportation';
import { connectedCyclewayComponents, fitGeneratedJunctionEdges, removeJunctionTipFragments } from '../../src/lib/junction-ownership';
import { difference, intersection } from '../../src/lib/polygon-boolean';
import { junctionPolygonArea, type JunctionPoint } from '../../src/lib/junction-footprint';

const identity = (point: number[]) => point as JunctionPoint;
const box = (x: number, y: number, w: number, h: number): JunctionPoint[] => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const area = (roadId: string, polygon: JunctionPoint[]): RoadArea => ({ id: roadId, roadId, sectionId: '', bandId: '', surfaceIndex: 0, surfaceType: 'TrafficArea', function: 'road', polygon, attributes: {sourceType:'Driving'}, vertical:{placement:'surface',osmLayer:0,source:'osm_tags'} });

describe('junction pavement ownership', () => {
  it('fits a corner to saved neighbours without changing them or cutting out a different crossing level', () => {
    const generated = [area('junction',box(0,0,10,10))];
    const neighbour = area('neighbour',box(9,9,5,5));
    const bridge = {...area('bridge',box(0,4,10,2)),vertical:{placement:'elevated' as const,osmLayer:1,source:'osm_tags' as const}};
    const before = JSON.stringify([generated,neighbour,bridge]);
    const fitted = fitGeneratedJunctionEdges(generated,[neighbour,bridge],new Set(['junction']),identity,identity);
    expect(fitted.error).toBeUndefined();
    expect(fitted.fittedRoads).toBe(1);
    expect(junctionPolygonArea(fitted.areas.map(a=>[a.polygon,...(a.holes??[]) ]))).toBe(99);
    expect(junctionPolygonArea(intersection([fitted.areas[0].polygon],[bridge.polygon]))).toBe(20);
    expect(JSON.stringify([generated,neighbour,bridge])).toBe(before);
  });
  it('refuses to hide an unrelated road by splitting the carriageway around it', () => {
    const result = fitGeneratedJunctionEdges([area('junction',box(0,0,10,10))],[area('crossing',box(0,4,10,2))],new Set(['junction']),identity,identity);
    expect(result.error).toMatch(/cuts through/);
    expect(result.areas).toEqual([area('junction', box(0, 0, 10, 10))]);
  });
  it('drops a detached generated scrap only when the remaining surface still reaches every approach', () => {
    const generated=[area('junction',box(0,0,10,10))],neighbour=area('neighbour',box(8,0,1,10));
    const west=area('west',box(-2,2,3,2)),south=area('south',box(2,-2,2,3));
    const fitted=fitGeneratedJunctionEdges(generated,[neighbour],new Set(['junction']),identity,identity,[west,south]);
    expect(fitted.error).toBeUndefined();
    expect(fitted.areas).toHaveLength(1);
    expect(junctionPolygonArea([[fitted.areas[0].polygon]])).toBe(80);
    const east=area('east',box(9,2,3,2));
    expect(fitGeneratedJunctionEdges(generated,[neighbour],new Set(['junction']),identity,identity,[west,south,east]).error).toMatch(/cuts through/);
  });
  it('does not erase source roads inside a merge or an opening in the neighbouring pavement', () => {
    const generated=[area('junction',box(4,4,2,2))],donut={...area('neighbour',box(0,0,10,10)),holes:[box(3,3,4,4)]};
    const result=fitGeneratedJunctionEdges(generated,[donut,area('internal',box(4,4,2,2))],new Set(['junction','internal']),identity,identity);
    expect(result.fittedRoads).toBe(0);expect(result.areas).toEqual(generated);
  });
  it('removes detached old tip squares while retaining the outward road and its holes', () => {
    const mask=[box(-10,-10,15,20)],outward=[box(6,-2,20,4),box(8,-1,1,1)],tip=[box(1,1,2,2)];
    const result=removeJunctionTipFragments([tip,outward],mask);
    expect(result).toEqual([outward]);
    expect(junctionPolygonArea(difference(outward,...result))).toBe(0);
  });
  it('removes isolated cycling rectangles while keeping a complete approach, regardless of its length', () => {
    const long = [box(0, 0, 2, 50)], short = [box(10, 0, 2, 2)], fragment = [box(5, 5, 2, 3)];
    expect(connectedCyclewayComponents([long, short, fragment], [long, short])).toEqual([long, short]);
  });
});
