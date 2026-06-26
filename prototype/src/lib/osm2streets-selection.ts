import type { Osm2StreetsResult, Osm2StreetsSelection } from './osm2streets';

export function connectedRoadIdsForIntersection(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult | null
): Set<number | string> {
  if (!selection || selection.kind !== 'intersection' || !result) return new Set();
  const intersectionId = selection.feature.properties?.id;
  if (intersectionId === undefined || intersectionId === null) return new Set();

  const ids = new Set<number | string>();
  for (const feature of result.plain.features) {
    const props = feature.properties ?? {};
    if (props.type !== 'road') continue;
    if (props.src_i === intersectionId || props.dst_i === intersectionId) {
      const roadId = props.id;
      if (roadId !== undefined && roadId !== null) ids.add(roadId);
    }
  }
  return ids;
}
