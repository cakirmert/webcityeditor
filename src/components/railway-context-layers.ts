import { PathLayer, TextLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import type { RailwayContext } from '../lib/crossing-levels';
import { localJunctionProjection } from '../lib/junction-footprint';

export function railwayContextLayers(railways: RailwayContext[], levels: boolean, opacity: number) {
  const above = railways.filter(r => r.placement !== 'underground');
  const height = (r: RailwayContext) => levels ? r.layer * 6 : .2;
  const withZ = (r: RailwayContext): [number,number,number][] => r.path.map(p => [p[0],p[1],height(r)]);
  const rails = above.flatMap(r => {
    const { project, unproject } = localJunctionProjection(r.path[0]), line = r.path.map(project);
    return [-.72, .72].map(offset => ({ id: `${r.id}-${offset}`, path: line.map((p, i) => {
      const a = line[Math.max(0, i-1)], b = line[Math.min(line.length-1, i+1)], length = Math.hypot(b[0]-a[0],b[1]-a[1]) || 1;
      return [...unproject([p[0]-(b[1]-a[1])/length*offset,p[1]+(b[0]-a[0])/length*offset]),height(r)+.05];
    }) }));
  });
  const alpha = Math.round(255 * opacity), flat = { depthTest: false } as unknown as never;
  const labels = railways.filter(r => r.placement !== 'ground').map(r => ({ ...r, position: r.path[Math.floor(r.path.length/2)] }));
  return [
    new PathLayer({ id: 'road-railway-bridge-shadow', data: above.filter(r=>r.placement==='elevated'), getPath: r=>r.path, getWidth: 5.5, widthUnits: 'meters', getColor: [0,0,0,Math.round(alpha*.5)], pickable:false, parameters:flat }),
    new PathLayer({ id: 'road-railway-decks', data: above, getPath: withZ, getWidth: 3.2, widthUnits: 'meters', getColor: [137,126,103,alpha], pickable:false, parameters:flat }),
    new PathLayer({ id: 'road-railway-sleepers', data: above, getPath: withZ, getWidth: 2.6, widthUnits: 'meters', getColor: [66,63,58,alpha], getDashArray:[.15,.45], extensions:[new PathStyleExtension({dash:true})], pickable:false, parameters:flat }),
    new PathLayer({ id: 'road-railway-rails', data: rails, getPath: r=>r.path, getWidth: .12, widthUnits: 'meters', widthMinPixels:1, getColor: [231,233,235,alpha], pickable:false, parameters:flat }),
    ...(levels ? [new PathLayer({id:'road-railway-tunnels',data:railways.filter(r=>r.placement==='underground'),getPath:withZ,getWidth:3,widthUnits:'pixels',getColor:[122,211,239,210],getDashArray:[3,2],extensions:[new PathStyleExtension({dash:true})],pickable:false,parameters:flat}),
      new TextLayer({id:'road-crossing-level-labels',data:labels,getPosition:r=>[r.position[0],r.position[1],height(r)+.1] as [number,number,number],getText:r=>`Rail ${r.placement==='elevated'?'above':'below'} road · layer ${r.layer>0?'+':''}${r.layer}`,getColor:[255,255,255],getSize:12,getPixelOffset:[0,-20],background:true,getBackgroundColor:[35,45,56,235],backgroundPadding:[6,4],pickable:false,parameters:flat})] : []),
  ];
}
