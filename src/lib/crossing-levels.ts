import type { RoadArea } from './transportation';
import { pointInRing } from './road-lane-geometry';

export interface RailwayContext {
  id: string;
  path: [number, number][];
  layer: number;
  placement: 'elevated' | 'underground' | 'ground';
  bounds: [number, number, number, number];
}

/** Relative OSM layers are not measured elevations. These heights belong only
 * to the explicitly labelled schematic viewer and never enter CityJSON. */
export function schematicRoadHeight(area?: RoadArea): number {
  return roadCrossingLayer(area) * 6;
}

/** Both roads and railways use this same relative ordering. A bridge is not
 * automatically above another bridge, and rail has no special priority. */
export function roadCrossingLayer(area?: RoadArea): number {
  if (!area) return 0;
  const vertical = area.vertical;
  if (Number.isFinite(vertical?.osmLayer)) return vertical!.osmLayer!;
  if (vertical?.placement === 'elevated') return 1;
  if (vertical?.placement === 'underground') return -1;
  return 0;
}

export function readRailwayContext(value: unknown): RailwayContext[] {
  const features = (value as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((item: any) => {
    const path = item?.geometry?.coordinates;
    if (item?.geometry?.type !== 'LineString' || !Array.isArray(path) || path.length < 2 || !path.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return [];
    const tags = item.properties ?? {}, tagged = (value: unknown) => !!value && !['no', 'false', '0'].includes(String(value));
    const explicit = typeof tags.layer === 'number' || (typeof tags.layer === 'string' && tags.layer.trim()) ? Number(tags.layer) : NaN;
    const layer = Number.isFinite(explicit) ? explicit : (tagged(tags.bridge) ? 1 : tagged(tags.tunnel) ? -1 : 0);
    return [{ id: String(item.id), path, layer,
      // Negative layers also describe open railway cuttings. Only a tunnel
      // tag hides a railway underground; the layer still controls its depth.
      placement: tagged(tags.tunnel) ? 'underground' as const : tagged(tags.bridge) || layer > 0 ? 'elevated' as const : 'ground' as const,
      bounds: [Math.min(...path.map((p: number[]) => p[0])), Math.min(...path.map((p: number[]) => p[1])), Math.max(...path.map((p: number[]) => p[0])), Math.max(...path.map((p: number[]) => p[1]))] as [number, number, number, number] }];
  });
}

export function railwayInBounds(railway: RailwayContext, bounds: [number, number, number, number]): boolean {
  const b = railway.bounds;
  return b[0] <= bounds[2] && b[2] >= bounds[0] && b[1] <= bounds[3] && b[3] >= bounds[1];
}

/** Opaque occlusion in the flat viewer, even when the road overlay itself is
 * translucent over imagery. Otherwise the sleepers bleed through the bridge.
 * This only cuts display paths; source railway geometry remains untouched. */
export function visibleRailwaySegments(railways: RailwayContext[], roads: RoadArea[]): RailwayContext[] {
  if (!railways.length) return [];
  const masks = roads.filter(a => a.polygon.length >= 3).map(a => ({layer:roadCrossingLayer(a), key:`${roadCrossingLayer(a)}:${a.attributes.roadName || a.roadId}`, rings:[a.polygon,...(a.holes??[])],
    bounds:[Math.min(...a.polygon.map(p=>p[0])),Math.min(...a.polygon.map(p=>p[1])),Math.max(...a.polygon.map(p=>p[0])),Math.max(...a.polygon.map(p=>p[1]))] as [number,number,number,number]}));
  return railways.flatMap(rail => {
    const above=masks.filter(m=>m.layer>rail.layer&&railwayInBounds(rail,m.bounds));
    if (!above.length) return [rail];
    const pieces: [number,number][][]=[];
    for(let i=1;i<rail.path.length;i++) {
      const a=rail.path[i-1],b=rail.path[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const cuts=[0,1];
      for(const mask of above) for(const ring of mask.rings) for(let j=0;j<ring.length;j++) {
        const c=ring[j],d=ring[(j+1)%ring.length],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;
        if(Math.abs(det)<1e-20)continue;
        const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/det;
        if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);
      const at=(t:number):[number,number]=>[a[0]+dx*t,a[1]+dy*t];
      for(let j=1;j<cuts.length;j++) {
        if(cuts[j]-cuts[j-1]<1e-9)continue;
        const middle=at((cuts[j]+cuts[j-1])/2);
        if(above.some(mask=>pointInRing(middle,mask.rings[0])&&!mask.rings.slice(1).some(hole=>pointInRing(middle,hole))))continue;
        const start=at(cuts[j-1]),end=at(cuts[j]),last=pieces.at(-1)?.at(-1);
        if(last&&Math.hypot(last[0]-start[0],last[1]-start[1])<1e-12)pieces.at(-1)!.push(end);
        else pieces.push([start,end]);
      }
    }
    // Split carriageways leave narrow, unmodelled median gaps in the imported
    // surfaces. They are not holes in the bridge deck. Close only a short gap
    // bounded by the same named road at the same level; retain explicit holes.
    const visible = pieces.filter(path => {
      const sx=111320*Math.cos(path[0][1]*Math.PI/180),sy=111320;
      const length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot((p[0]-path[i][0])*sx,(p[1]-path[i][1])*sy),0);
      if(length>4 || above.some(m=>m.rings.slice(1).some(hole=>path.some(p=>pointInRing(p,hole)))))return true;
      const probe=(p:[number,number],toward:[number,number]):[number,number]=>{
        const dx=(p[0]-toward[0])*sx,dy=(p[1]-toward[1])*sy,length=Math.hypot(dx,dy)||1;
        return [p[0]+dx/length*.05/sx,p[1]+dy/length*.05/sy];
      };
      const before=probe(path[0],path[1]),after=probe(path.at(-1)!,path.at(-2)!);
      const startKeys=new Set(above.filter(m=>pointInRing(before,m.rings[0])&&!m.rings.slice(1).some(h=>pointInRing(before,h))).map(m=>m.key));
      return !above.some(m=>startKeys.has(m.key)&&pointInRing(after,m.rings[0])&&!m.rings.slice(1).some(h=>pointInRing(after,h)));
    });
    return visible.map((path,i)=>({...rail,id:`${rail.id}-visible-${i}`,path}));
  });
}
