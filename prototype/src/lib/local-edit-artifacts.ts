import type { AttrDiff } from './cityjson';
import { diffAttributes } from './cityjson';
import { prepareValidatedCityJsonExport } from './export-validation';
import { applyVertexTransform, detectCrs, projectToWgs84 } from './projection';
import type { CityJsonDocument, CityObject, JsonValue } from '../types';

export type CityJsonObjectChangeStatus = 'added' | 'removed' | 'modified';

export interface CityJsonSemanticSurfaceSummary {
  geometryIndex: number;
  surfaceIndex: number;
  type?: string;
  function?: JsonValue;
  usage?: JsonValue;
  trafficDirection?: JsonValue;
  allowedModes?: JsonValue;
  sectionId?: JsonValue;
  bandId?: JsonValue;
}

export interface CityJsonGeometrySummary {
  geometryCount: number;
  referencedVertices: number;
  bbox?: [number, number, number, number, number, number];
}

export interface CityJsonObjectChange {
  objectId: string;
  status: CityJsonObjectChangeStatus;
  typeBefore?: string;
  typeAfter?: string;
  attributeChanges: AttrDiff[];
  geometry: {
    changed: boolean;
    before: CityJsonGeometrySummary | null;
    after: CityJsonGeometrySummary | null;
  };
  semantics: {
    changed: boolean;
    before: CityJsonSemanticSurfaceSummary[];
    after: CityJsonSemanticSurfaceSummary[];
  };
}

export interface CityJsonChangeReport {
  schemaVersion: 'webcityeditor-local-change-report-v1';
  generatedAt: string;
  sourceName?: string;
  totals: {
    cityObjectsBefore: number;
    cityObjectsAfter: number;
    verticesBefore: number;
    verticesAfter: number;
    addedObjects: number;
    removedObjects: number;
    modifiedObjects: number;
    attributeChanges: number;
    geometryChanges: number;
    semanticChanges: number;
  };
  objects: CityJsonObjectChange[];
}

export interface VisualDiffFeature {
  type: 'Feature';
  properties: {
    objectId: string;
    state: 'before' | 'after';
    status: CityJsonObjectChangeStatus;
    objectType: string;
    geometryIndex: number;
    surfaceIndex: number;
    surfaceType: string | null;
    surfaceFunction: JsonValue;
    semanticIndex: number | null;
    geometryChanged: boolean;
    semanticsChanged: boolean;
    attributeChangeCount: number;
  };
  geometry: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>;
  };
}

export interface VisualDiffGeoJson {
  type: 'FeatureCollection';
  features: VisualDiffFeature[];
}

export interface LocalEditArtifact {
  kind: 'cityjson' | 'change-report' | 'visual-diff';
  fileName: string;
  mediaType: string;
  text: string;
}

export interface LocalEditArtifactBundle {
  report: CityJsonChangeReport;
  visualDiff: VisualDiffGeoJson;
  artifacts: LocalEditArtifact[];
}

export interface LocalEditArtifactOptions {
  baseName?: string;
  sourceName?: string;
  generatedAt?: string;
}

export function buildCityJsonChangeReport(
  before: CityJsonDocument,
  after: CityJsonDocument,
  options: Pick<LocalEditArtifactOptions, 'sourceName' | 'generatedAt'> = {}
): CityJsonChangeReport {
  const attributeChanges = diffAttributes(before, after);
  const attributesByObject = groupAttributeDiffs(attributeChanges);
  const objectIds = [...new Set([...Object.keys(before.CityObjects), ...Object.keys(after.CityObjects)])].sort();
  const objects: CityJsonObjectChange[] = [];

  for (const objectId of objectIds) {
    const beforeObj = before.CityObjects[objectId];
    const afterObj = after.CityObjects[objectId];
    const status: CityJsonObjectChangeStatus = beforeObj
      ? afterObj
        ? 'modified'
        : 'removed'
      : 'added';
    const beforeSemantics = beforeObj ? summarizeSemantics(beforeObj) : [];
    const afterSemantics = afterObj ? summarizeSemantics(afterObj) : [];
    const geometryChanged =
      stableJson(beforeObj?.geometry ?? null) !== stableJson(afterObj?.geometry ?? null);
    const semanticsChanged = stableJson(beforeSemantics) !== stableJson(afterSemantics);
    const typeChanged = beforeObj?.type !== afterObj?.type;
    const attrChanges = attributesByObject.get(objectId) ?? [];

    if (
      status === 'modified' &&
      !typeChanged &&
      attrChanges.length === 0 &&
      !geometryChanged &&
      !semanticsChanged
    ) {
      continue;
    }

    objects.push({
      objectId,
      status,
      typeBefore: beforeObj?.type,
      typeAfter: afterObj?.type,
      attributeChanges: attrChanges,
      geometry: {
        changed: geometryChanged,
        before: beforeObj ? summarizeGeometry(before, beforeObj) : null,
        after: afterObj ? summarizeGeometry(after, afterObj) : null,
      },
      semantics: {
        changed: semanticsChanged,
        before: beforeSemantics,
        after: afterSemantics,
      },
    });
  }

  return {
    schemaVersion: 'webcityeditor-local-change-report-v1',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceName: options.sourceName,
    totals: {
      cityObjectsBefore: Object.keys(before.CityObjects).length,
      cityObjectsAfter: Object.keys(after.CityObjects).length,
      verticesBefore: before.vertices.length,
      verticesAfter: after.vertices.length,
      addedObjects: objects.filter((change) => change.status === 'added').length,
      removedObjects: objects.filter((change) => change.status === 'removed').length,
      modifiedObjects: objects.filter((change) => change.status === 'modified').length,
      attributeChanges: attributeChanges.length,
      geometryChanges: objects.filter((change) => change.geometry.changed).length,
      semanticChanges: objects.filter((change) => change.semantics.changed).length,
    },
    objects,
  };
}

export function buildVisualDiffGeoJson(
  before: CityJsonDocument,
  after: CityJsonDocument,
  report: CityJsonChangeReport
): VisualDiffGeoJson {
  const features: VisualDiffFeature[] = [];
  for (const change of report.objects) {
    if (change.status !== 'added') {
      features.push(...extractVisualDiffFeatures(before, change, 'before'));
    }
    if (change.status !== 'removed') {
      features.push(...extractVisualDiffFeatures(after, change, 'after'));
    }
  }
  return { type: 'FeatureCollection', features };
}

export function prepareLocalEditArtifacts(
  before: CityJsonDocument,
  after: CityJsonDocument,
  options: LocalEditArtifactOptions = {}
): LocalEditArtifactBundle {
  const exported = prepareValidatedCityJsonExport(after);
  if (!exported.ok) {
    throw new Error(`Cannot prepare local edit artifacts: ${exported.error}`);
  }

  const baseName = normalizeBaseName(options.baseName ?? 'cityjson-edit');
  const report = buildCityJsonChangeReport(before, after, options);
  const visualDiff = buildVisualDiffGeoJson(before, after, report);

  return {
    report,
    visualDiff,
    artifacts: [
      {
        kind: 'cityjson',
        fileName: `${baseName}.modified.city.json`,
        mediaType: 'application/city+json',
        text: exported.text,
      },
      {
        kind: 'change-report',
        fileName: `${baseName}.change-report.json`,
        mediaType: 'application/json',
        text: JSON.stringify(report, null, 2),
      },
      {
        kind: 'visual-diff',
        fileName: `${baseName}.visual-diff.geojson`,
        mediaType: 'application/geo+json',
        text: JSON.stringify(visualDiff, null, 2),
      },
    ],
  };
}

function groupAttributeDiffs(diffs: AttrDiff[]): Map<string, AttrDiff[]> {
  const grouped = new Map<string, AttrDiff[]>();
  for (const diff of diffs) {
    const current = grouped.get(diff.objectId) ?? [];
    current.push(diff);
    grouped.set(diff.objectId, current);
  }
  for (const values of grouped.values()) {
    values.sort((a, b) => a.key.localeCompare(b.key));
  }
  return grouped;
}

function summarizeGeometry(
  doc: CityJsonDocument,
  object: CityObject
): CityJsonGeometrySummary | null {
  if (!Array.isArray(object.geometry)) return null;
  const referenced = collectVertexIndices(object.geometry);
  return {
    geometryCount: object.geometry.length,
    referencedVertices: referenced.size,
    bbox: computeReferencedBbox(doc, referenced),
  };
}

function summarizeSemantics(object: CityObject): CityJsonSemanticSurfaceSummary[] {
  const surfaces: CityJsonSemanticSurfaceSummary[] = [];
  for (let geometryIndex = 0; geometryIndex < (object.geometry?.length ?? 0); geometryIndex++) {
    const geometry = object.geometry?.[geometryIndex] as {
      semantics?: {
        surfaces?: Array<Record<string, JsonValue | undefined>>;
      };
    };
    const semanticSurfaces = geometry.semantics?.surfaces ?? [];
    for (let surfaceIndex = 0; surfaceIndex < semanticSurfaces.length; surfaceIndex++) {
      const surface = semanticSurfaces[surfaceIndex];
      surfaces.push({
        geometryIndex,
        surfaceIndex,
        type: typeof surface.type === 'string' ? surface.type : undefined,
        function: surface.function,
        usage: surface.usage,
        trafficDirection: surface.trafficDirection,
        allowedModes: surface.allowedModes,
        sectionId: surface.sectionId,
        bandId: surface.bandId,
      });
    }
  }
  return surfaces;
}

function extractVisualDiffFeatures(
  doc: CityJsonDocument,
  change: CityJsonObjectChange,
  state: 'before' | 'after'
): VisualDiffFeature[] {
  const crs = detectCrs(doc);
  if (!crs.supported) return [];
  const object = doc.CityObjects[change.objectId];
  if (!object?.geometry) return [];
  const features: VisualDiffFeature[] = [];

  for (let geometryIndex = 0; geometryIndex < object.geometry.length; geometryIndex++) {
    const geometry = object.geometry[geometryIndex] as CityJsonGeometryWithSemantics;
    let surfaceIndex = 0;
    forEachSurface(geometry, (rings, semanticIndex) => {
      const outerRing = rings[0];
      if (!outerRing || outerRing.length < 3) {
        surfaceIndex++;
        return;
      }
      const polygon = projectRingToWgs84(doc, crs.code, outerRing);
      if (!polygon || Math.abs(planarArea(polygon)) < 1e-16) {
        surfaceIndex++;
        return;
      }
      const semanticSurface =
        semanticIndex == null ? null : geometry.semantics?.surfaces?.[semanticIndex] ?? null;
      features.push({
        type: 'Feature',
        properties: {
          objectId: change.objectId,
          state,
          status: change.status,
          objectType: object.type,
          geometryIndex,
          surfaceIndex,
          surfaceType:
            typeof semanticSurface?.type === 'string' ? semanticSurface.type : null,
          surfaceFunction: semanticSurface?.function ?? null,
          semanticIndex,
          geometryChanged: change.geometry.changed,
          semanticsChanged: change.semantics.changed,
          attributeChangeCount: change.attributeChanges.length,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygon],
        },
      });
      surfaceIndex++;
    });
  }

  return features;
}

interface CityJsonGeometryWithSemantics {
  type?: string;
  boundaries?: unknown;
  semantics?: {
    surfaces?: Array<Record<string, JsonValue | undefined>>;
    values?: unknown;
  };
}

function forEachSurface(
  geometry: CityJsonGeometryWithSemantics,
  emit: (rings: number[][], semanticIndex: number | null) => void
): void {
  const boundaries = geometry.boundaries;
  if (!Array.isArray(boundaries)) return;

  if (geometry.type === 'MultiSurface' || geometry.type === 'CompositeSurface') {
    for (let faceIndex = 0; faceIndex < boundaries.length; faceIndex++) {
      emit(readFace(boundaries[faceIndex]), semanticIndexAt(geometry.semantics?.values, faceIndex));
    }
    return;
  }

  if (geometry.type === 'Solid') {
    for (let shellIndex = 0; shellIndex < boundaries.length; shellIndex++) {
      const shell = boundaries[shellIndex];
      if (!Array.isArray(shell)) continue;
      for (let faceIndex = 0; faceIndex < shell.length; faceIndex++) {
        emit(
          readFace(shell[faceIndex]),
          semanticIndexAt(geometry.semantics?.values, shellIndex, faceIndex)
        );
      }
    }
    return;
  }

  if (geometry.type === 'MultiSolid' || geometry.type === 'CompositeSolid') {
    for (let solidIndex = 0; solidIndex < boundaries.length; solidIndex++) {
      const solid = boundaries[solidIndex];
      if (!Array.isArray(solid)) continue;
      for (let shellIndex = 0; shellIndex < solid.length; shellIndex++) {
        const shell = solid[shellIndex];
        if (!Array.isArray(shell)) continue;
        for (let faceIndex = 0; faceIndex < shell.length; faceIndex++) {
          emit(
            readFace(shell[faceIndex]),
            semanticIndexAt(geometry.semantics?.values, solidIndex, shellIndex, faceIndex)
          );
        }
      }
    }
  }
}

function readFace(face: unknown): number[][] {
  if (!Array.isArray(face)) return [];
  return face.filter(
    (ring): ring is number[] =>
      Array.isArray(ring) && ring.every((idx) => typeof idx === 'number')
  );
}

function semanticIndexAt(values: unknown, ...path: number[]): number | null {
  let current = values;
  for (const index of path) {
    if (!Array.isArray(current)) return null;
    current = current[index];
  }
  return typeof current === 'number' ? current : null;
}

function projectRingToWgs84(
  doc: CityJsonDocument,
  crsCode: string,
  ring: number[]
): Array<[number, number]> | null {
  const coordinates: Array<[number, number]> = [];
  for (const index of ring) {
    const vertex = doc.vertices[index];
    if (!vertex) return null;
    const projected = applyVertexTransform(vertex, doc);
    coordinates.push(projectToWgs84(crsCode, projected));
  }
  if (coordinates.length < 3) return null;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([first[0], first[1]]);
  }
  return coordinates;
}

function planarArea(ring: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function collectVertexIndices(value: unknown): Set<number> {
  const indices = new Set<number>();
  walk(value);
  return indices;

  function walk(node: unknown): void {
    if (typeof node === 'number') {
      indices.add(node);
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child);
    } else if (node && typeof node === 'object') {
      const maybeGeometry = node as { boundaries?: unknown };
      if (maybeGeometry.boundaries !== undefined) walk(maybeGeometry.boundaries);
    }
  }
}

function computeReferencedBbox(
  doc: CityJsonDocument,
  indices: Set<number>
): [number, number, number, number, number, number] | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const index of indices) {
    const vertex = doc.vertices[index];
    if (!vertex) continue;
    const { x, y, z } = applyVertexTransform(vertex, doc);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return Number.isFinite(minX) ? [minX, minY, minZ, maxX, maxY, maxZ] : undefined;
}

function normalizeBaseName(value: string): string {
  return (
    value
      .trim()
      .replace(/\.city\.json$|\.json$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'cityjson-edit'
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortKeys(child)])
  );
}
