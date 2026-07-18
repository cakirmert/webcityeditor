import type { CityJsonDocument, CityObject } from '../types';

export interface ClipboardData {
  buildings: Map<string, CityObject>;
  vertices: [number, number, number][];
  vertexOffset: number;
  indexMapping: Map<number, number>;
}

export function cloneBuildings(
  doc: CityJsonDocument,
  ids: Set<string>,
  offsetDx: number,
  offsetDy: number
): { clonedIds: string[] } {
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const clonedIds: string[] = [];

  for (const id of ids) {
    const obj = doc.CityObjects[id];
    if (!obj) continue;

    const allObjects = [{ id, obj }];
    for (const cid of obj.children ?? []) {
      const child = doc.CityObjects[cid];
      if (child) allObjects.push({ id: cid, obj: child });
    }

    const referenced = new Set<number>();
    for (const { obj: o } of allObjects) {
      visitBoundaries(o, (idx) => referenced.add(idx));
    }

    const oldToNew = new Map<number, number>();
    for (const oldIdx of referenced) {
      const raw = doc.vertices[oldIdx];
      if (!raw) continue;
      const newIdx = doc.vertices.length;
      const realX = raw[0] * t.scale[0] + t.translate[0] + offsetDx;
      const realY = raw[1] * t.scale[1] + t.translate[1] + offsetDy;
      const realZ = raw[2] * t.scale[2] + t.translate[2];
      doc.vertices.push([
        Math.round((realX - t.translate[0]) / t.scale[0]),
        Math.round((realY - t.translate[1]) / t.scale[1]),
        Math.round((realZ - t.translate[2]) / t.scale[2]),
      ]);
      oldToNew.set(oldIdx, newIdx);
    }

    const newParentId = uniqueId(doc, id);
    const childMapping = new Map<string, string>();
    for (const { id: cid } of allObjects) {
      if (cid !== id) childMapping.set(cid, uniqueId(doc, cid));
    }

    for (const { id: origId, obj: origObj } of allObjects) {
      const clone = JSON.parse(JSON.stringify(origObj)) as CityObject;
      rewriteCloneBoundaries(clone, oldToNew);

      if (origId === id) {
        if (clone.children) {
          clone.children = clone.children.map((c) => childMapping.get(c) ?? c);
        }
        delete clone.parents;
        doc.CityObjects[newParentId] = clone;
        clonedIds.push(newParentId);
      } else {
        const newChildId = childMapping.get(origId)!;
        if (clone.parents) {
          clone.parents = clone.parents.map((p) => (p === id ? newParentId : p));
        }
        doc.CityObjects[newChildId] = clone;
      }
    }
  }

  return { clonedIds };
}

function uniqueId(doc: CityJsonDocument, base: string): string {
  let suffix = 1;
  let candidate = `${base}__copy${suffix}`;
  while (doc.CityObjects[candidate]) {
    suffix++;
    candidate = `${base}__copy${suffix}`;
  }
  return candidate;
}

function visitBoundaries(obj: CityObject, emit: (idx: number) => void): void {
  if (!obj.geometry) return;
  for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
    walk(g.boundaries);
  }
  function walk(node: unknown) {
    if (!Array.isArray(node)) return;
    for (const item of node) {
      if (typeof item === 'number') emit(item);
      else walk(item);
    }
  }
}

function rewriteCloneBoundaries(obj: CityObject, mapping: Map<number, number>): void {
  if (!obj.geometry) return;
  for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
    if (g.boundaries) g.boundaries = rewrite(g.boundaries);
  }
  function rewrite(node: unknown): unknown {
    if (!Array.isArray(node)) return node;
    return node.map((item) => {
      if (typeof item === 'number') return mapping.get(item) ?? item;
      return rewrite(item);
    });
  }
}
