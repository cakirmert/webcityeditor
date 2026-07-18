import type { CityJsonDocument } from '../types';

/**
 * Delete one or more buildings (and their BuildingPart descendants) from
 * a CityJSON document, in place.
 *
 * Rules followed:
 *   - Deleting a Building also deletes every CityObject it references via
 *     `children` (transitively). BuildingParts can't exist without their
 *     parent Building, so they go too.
 *   - Deleting a child object that has surviving parents leaves the parent
 *     intact but removes the child from the parent's `children` list.
 *   - Vertices the deleted objects referenced become orphans — `compactVertices`
 *     reclaims them later. We don't run that pass here because callers
 *     often delete multiple things in sequence and one compaction at the
 *     end is cheaper.
 *
 * Returns the set of IDs that were actually deleted (including descendants
 * the caller may not have asked for explicitly).
 */
export function deleteBuildings(
  doc: CityJsonDocument,
  ids: Iterable<string>
): { deletedIds: string[] } {
  const requested = new Set(ids);
  const toDelete = new Set<string>();

  // Walk children transitively so deleting a Building also takes its
  // BuildingParts. A bounded queue (max = number of CityObjects) prevents
  // pathological cycles from looping forever.
  const queue: string[] = [];
  for (const id of requested) {
    if (doc.CityObjects[id]) {
      toDelete.add(id);
      queue.push(id);
    }
  }
  const guard = Object.keys(doc.CityObjects).length + 1;
  let steps = 0;
  while (queue.length > 0 && steps < guard) {
    steps++;
    const id = queue.shift()!;
    const obj = doc.CityObjects[id];
    if (!obj?.children) continue;
    for (const childId of obj.children) {
      if (toDelete.has(childId)) continue;
      if (!doc.CityObjects[childId]) continue;
      toDelete.add(childId);
      queue.push(childId);
    }
  }

  // Remove deleted IDs from any surviving objects' `children` arrays.
  for (const obj of Object.values(doc.CityObjects)) {
    if (!obj.children || obj.children.length === 0) continue;
    obj.children = obj.children.filter((c) => !toDelete.has(c));
  }

  // Drop the objects themselves.
  for (const id of toDelete) {
    delete doc.CityObjects[id];
  }

  return { deletedIds: Array.from(toDelete) };
}
