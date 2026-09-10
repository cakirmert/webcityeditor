import proj4 from 'proj4';
import type { CityJsonDocument } from '../types';
import { detectCrs, projectWgs84BboxToCrs } from './projection';
import { extractTransportationAreas } from './transportation';
import { extractFootprints, footprintPolygonToWgs84 } from './footprints';
import { compactVertices } from './compact';
import { runStructurallyGuardedMutation } from './editor-actions';
import type { Wgs84Bbox } from './road-query';

export function projectRoadResetExtent(doc: CityJsonDocument): Wgs84Bbox {
  // This is the entire loaded project, never the camera's current viewport.
  const roads = extractTransportationAreas(doc);
  const points = [...roads.flatMap(area => area.polygon), ...extractFootprints(doc).flatMap(area => footprintPolygonToWgs84(area.polygon))];
  if (!points.length) throw new Error('Load a georeferenced project before resetting its roads.');
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of points) { west = Math.min(west, x); south = Math.min(south, y); east = Math.max(east, x); north = Math.max(north, y); }
  if (![west, south, east, north].every(Number.isFinite)) throw new Error('The project extent is invalid.');
  return [west - .0001, south - .0001, east + .0001, north + .0001];
}

export function checkProjectRoadResetExtent(bbox: Wgs84Bbox) {
  const [west, south, east, north] = projectWgs84BboxToCrs(bbox, 'EPSG:3857');
  const scale = Math.cos((bbox[1] + bbox[3]) / 2 * Math.PI / 180);
  if ((east - west) * (north - south) * scale ** 2 > 25_000_000) throw new Error('This project exceeds the 25 km² browser reset limit. Prepare a complete CityJSON road dataset with the repository’s OSM converter and import it as a new project. The current project has not changed.');
}

/** Produce a complete reviewable replacement without touching the project. */
export function prepareProjectRoadReplacement(original: CityJsonDocument, roads: CityJsonDocument, source: string) {
  const crs = detectCrs(original);
  if (!crs.supported || crs.inferred || crs.code === 'EPSG:4978') throw new Error('A declared, supported map CRS is required for a project road reset.');
  const incomingCrs = detectCrs(roads);
  const result = structuredClone(original);
  const removedIds = Object.entries(original.CityObjects).filter(([, object]) => object.type === 'Road').map(([id]) => id);
  const addedIds = Object.keys(roads.CityObjects);
  if (!addedIds.length || addedIds.some(id => roads.CityObjects[id].type !== 'Road')) throw new Error('The replacement must contain a non-empty Road network.');
  const removed = new Set(removedIds);
  runStructurallyGuardedMutation(result, 'Reset project roads', () => {
    for (const id of removed) delete result.CityObjects[id];
    for (const object of Object.values(result.CityObjects)) {
      if (object.parents) object.parents = object.parents.filter(id => !removed.has(id));
      if (object.children) object.children = object.children.filter(id => !removed.has(id));
    }
    const offset = result.vertices.length;
    for (const vertex of roads.vertices) {
      const point = vertex.map((v, i) => v * (roads.transform?.scale[i] ?? 1) + (roads.transform?.translate[i] ?? 0));
      const xy = proj4(incomingCrs.code, crs.code, point.slice(0, 2));
      const target = [xy[0], xy[1], point[2]].map((v, i) => result.transform ? Math.round((v - result.transform.translate[i]) / result.transform.scale[i]) : v);
      if (!target.every(Number.isFinite)) throw new Error('Road coordinates could not be projected into this project.');
      result.vertices.push(target as [number, number, number]);
    }
    const reindex = (value: unknown): unknown => Array.isArray(value) ? value.map(reindex) : typeof value === 'number' ? value + offset : value;
    for (const [id, object] of Object.entries(roads.CityObjects)) {
      if (result.CityObjects[id]) throw new Error(`The replacement road ID ${id} conflicts with a retained object.`);
      const copy = structuredClone(object);
      copy.geometry = copy.geometry?.map(value => { const geometry = value as Record<string, unknown>; return { ...geometry, boundaries: reindex(geometry.boundaries) }; });
      result.CityObjects[id] = copy;
    }
    compactVertices(result);
    result.metadata = { ...result.metadata, roadReset: { source, at: new Date().toISOString(), removed: removedIds.length, added: addedIds.length } };
  });
  return { document: result, removedIds, addedIds };
}
