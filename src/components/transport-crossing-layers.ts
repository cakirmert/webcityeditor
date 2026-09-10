import type { Layer } from '@deck.gl/core';
import type { RoadArea } from '../lib/transportation';
import { roadCrossingLayer, type RailwayContext } from '../lib/crossing-levels';
import { railwayContextLayers } from './railway-context-layers';

const physicalRoadLayers = new Set([
  'cityjson-road-areas', 'road-draft-preview',
  'cityjson-road-lane-markings', 'cityjson-road-direction-arrow-shafts', 'cityjson-road-direction-arrows',
  'road-connection-network-halo', 'road-connection-network',
  'road-connection-junctions-halo', 'road-connection-junctions',
  'road-selected-band-highlight', 'junction-overview-approaches', 'junction-active-road-or-lane',
]);

/** Compose the whole road surface (including its paint and selection) at its
 * crossing level. Flat mode uses painter order; Levels also uses depth, so a
 * bridge can occlude tracks regardless of which overlay was added last. */
export function orderTransportCrossings(layers: Layer[], areas: RoadArea[], railways: RailwayContext[], levels: boolean, opacity: number): Layer[] {
  const byRoad = new Map(areas.map(area => [area.roadId, roadCrossingLayer(area)]));
  const roadLayers = layers.filter(layer => physicalRoadLayers.has(layer.id));
  if (!roadLayers.length && !railways.length) return layers;
  const orders = [...new Set([...byRoad.values(), ...railways.map(r => r.layer)])].sort((a, b) => a - b);
  const composed: Layer[] = [];
  for (const order of orders) {
    for (const layer of roadLayers) {
      const data = (layer.props.data as Array<{ roadId: string }>).filter(d => (byRoad.get(d.roadId) ?? 0) === order);
      if (!data.length) continue;
      // Highlight layers originally have 2D geometry. Lift these with their
      // road too; never leave a bridge's lane paint on the ground below it.
      const props: Record<string, unknown> = { id: `${layer.id}-level-${order}`, data,
        parameters: { depthTest: levels, depthWriteEnabled: levels }, getPolygonOffset: () => [0, 0] };
      if (levels && ['cityjson-road-areas','road-draft-preview'].includes(layer.id)) {
        const fill = (layer.props as unknown as {getFillColor:number[]|((d:unknown,info:unknown)=>number[])}).getFillColor;
        props.getFillColor = (d:unknown,info:unknown) => [...(typeof fill === 'function' ? fill(d,info) : fill).slice(0,3),Math.round(255*opacity)];
      }
      for (const key of ['getPolygon', 'getPath']) {
        const accessor = (layer.props as unknown as Record<string, unknown>)[key];
        if (typeof accessor === 'function') props[key] = (d: unknown, info: unknown) => liftCoordinates(accessor(d, info), levels ? order * 6 + .02 : 0);
      }
      props.updateTriggers = { ...layer.props.updateTriggers, getFillColor:[levels,opacity,layer.props.updateTriggers], getPolygon: [levels, order, layer.props.updateTriggers], getPath: [levels, order, layer.props.updateTriggers] };
      composed.push(layer.clone(props));
    }
    composed.push(...railwayContextLayers(railways.filter(r => r.layer === order), levels, opacity, `level-${order}`));
  }
  const first = layers.findIndex(layer => physicalRoadLayers.has(layer.id));
  if (first < 0) return [...layers, ...composed];
  return [...layers.slice(0, first), ...composed, ...layers.slice(first).filter(layer => !physicalRoadLayers.has(layer.id))];
}

function liftCoordinates(value: unknown, height: number): unknown {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === 'number') return [value[0], value[1], height];
  return value.map(child => liftCoordinates(child, height));
}
