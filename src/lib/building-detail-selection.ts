import type { CityJsonDocument } from '../types';

export interface BuildingDetailSelectionOptions {
  /** Root/part ids ordered by current viewport priority (usually nearest first). */
  visibleObjectIds: Iterable<string>;
  /** Dirty, generated, or otherwise editable ids that must win the mesh budget. */
  priorityObjectIds?: Iterable<string> | null;
  selectedObjectId?: string | null;
  maxRootObjects: number;
}

/**
 * Resolve one logical close-detail object set independently of LoD or texture
 * state. Insertion order is significant: the mesh builder consumes this Set
 * in order when its vertex safety budget is reached.
 */
export function selectBuildingDetailObjectIds(
  doc: CityJsonDocument,
  options: BuildingDetailSelectionOptions
): Set<string> | null {
  const ids = new Set<string>();
  const roots = new Set<string>();

  const addRoot = (objectId: string | null | undefined, priority: boolean) => {
    if (!objectId || !isBuildingCityObject(doc, objectId)) return;
    const rootId = rootBuildingObjectId(doc, objectId);
    if (!isBuildingCityObject(doc, rootId) || roots.has(rootId)) return;
    if (!priority && roots.size >= Math.max(0, options.maxRootObjects)) return;
    roots.add(rootId);
    addObjectWithDescendants(doc, rootId, ids);
  };

  addRoot(options.selectedObjectId, true);
  for (const objectId of options.priorityObjectIds ?? []) addRoot(objectId, true);
  for (const objectId of options.visibleObjectIds) {
    if (roots.size >= Math.max(0, options.maxRootObjects)) break;
    addRoot(objectId, false);
  }

  return ids.size > 0 ? ids : null;
}

export function rootBuildingObjectId(doc: CityJsonDocument, id: string): string {
  let currentId = id;
  const visited = new Set<string>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = doc.CityObjects[currentId]?.parents?.[0];
    if (!parentId || !doc.CityObjects[parentId]) break;
    currentId = parentId;
  }
  return currentId;
}

export function isBuildingCityObject(doc: CityJsonDocument, id: string): boolean {
  const type = doc.CityObjects[id]?.type;
  return type === 'Building' || type === 'BuildingPart' || type === 'BuildingInstallation';
}

function addObjectWithDescendants(
  doc: CityJsonDocument,
  id: string,
  target: Set<string>
): void {
  if (target.has(id)) return;
  const object = doc.CityObjects[id];
  if (!object) return;
  target.add(id);
  for (const child of object.children ?? []) addObjectWithDescendants(doc, child, target);
}
