import type { CityJsonDocument } from '../types';

/** Compare saved geometry independently of vertex compaction. A parked draft
 * must not silently restore roads another saved junction has changed/deleted. */
export function roadDraftSource(doc: CityJsonDocument, ids: string[]): string {
  const coordinates = (value: unknown): unknown => Array.isArray(value) ? value.map(coordinates) : typeof value === 'number' ? doc.vertices[value] : value;
  return JSON.stringify([...new Set(ids)].sort().map(id => {
    const object = doc.CityObjects[id];
    return [id, object ? { ...object, geometry: object.geometry?.map(value => {
      const geometry = value as Record<string, unknown>;
      return { ...geometry, boundaries: coordinates(geometry.boundaries) };
    }) } : null];
  }));
}
