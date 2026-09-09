import type { RoadArea, RoadDraft } from './transportation';

export function roadDisplayName(areas: RoadArea[], id: string): string {
  const area = areas.find((item) => item.roadId === id);
  const name = String(area?.attributes.roadName ?? area?.attributes.name ?? '').trim();
  if (name && !/^osm2streets road \d+$/i.test(name)) return name;
  const kind = area?.attributes.highwayType ?? 'road';
  const number = area?.attributes.osm2streetsRoadId ?? id.split('-').at(-1);
  return `Unnamed ${String(kind).replaceAll('_', ' ')} · ${number}`;
}

/** Compass side gives identical street names and the two ends distinct labels. */
export function roadEndpointBearing(road: RoadDraft, endpoint: 'start' | 'end'): string {
  const section = endpoint === 'start' ? road.sections[0] : road.sections.at(-1);
  if (!section || section.centerlineWgs84.length < 2) return '';
  const points = endpoint === 'start' ? section.centerlineWgs84 : [...section.centerlineWgs84].reverse();
  const [a, b] = points;
  const angle = Math.atan2((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][(Math.round(angle / 45) + 8) % 8];
}
