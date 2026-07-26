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

/**
 * Return the roads sharing either endpoint node with the selected road, or
 * every road entering the selected intersection. This lets map selection
 * reveal the same local connection graph without a separate highlight action.
 */
export function connectedRoadIdsForSelection(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult | null
): Set<number | string> {
  if (!selection || !result) return new Set();
  if (selection.kind === 'intersection') {
    return connectedRoadIdsForIntersection(selection, result);
  }

  const selectedRoadId = selection.feature.properties?.road;
  if (selectedRoadId === undefined || selectedRoadId === null) return new Set();
  const selectedRoad = result.plain.features.find((feature) => {
    const props = feature.properties ?? {};
    return props.type === 'road' && sameId(props.id, selectedRoadId);
  });
  if (!selectedRoad) return new Set([selectedRoadId]);

  const selectedProps = selectedRoad.properties ?? {};
  const endpointIds = [selectedProps.src_i, selectedProps.dst_i].filter(
    (value) => value !== undefined && value !== null
  );
  const ids = new Set<number | string>();
  for (const feature of result.plain.features) {
    const props = feature.properties ?? {};
    if (props.type !== 'road') continue;
    if (
      endpointIds.some(
        (endpointId) =>
          sameId(props.src_i, endpointId) || sameId(props.dst_i, endpointId)
      )
    ) {
      const roadId = props.id;
      if (roadId !== undefined && roadId !== null) ids.add(roadId);
    }
  }
  ids.add(selectedRoadId);
  return ids;
}

function sameId(left: unknown, right: unknown): boolean {
  return (
    left !== undefined &&
    left !== null &&
    right !== undefined &&
    right !== null &&
    String(left) === String(right)
  );
}
