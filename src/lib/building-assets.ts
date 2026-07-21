import proj4 from 'proj4';
import type { CityJsonDocument, CityObject } from '../types';
import { detectCrs } from './projection';
import { estimateTerrainElevationAtPoint } from './terrain';
import { publicAssetUrl } from './public-assets';

export interface BuildingAssetDefinition {
  id: string;
  name: string;
  description: string;
  size: string;
  cityJsonPath: string;
  previewImagePath: string;
  sourceObjectId: string;
}

export const BUILDING_ASSETS: BuildingAssetDefinition[] = [
  {
    id: 'hamburg-lod3-gabled-townhouse',
    name: 'Gabled townhouse',
    description: 'Narrow historic city house with a detailed pitched roof.',
    size: '16 × 11 × 24 m',
    cityJsonPath: 'data/assets/hamburg-lod3/gabled-townhouse.city.json',
    previewImagePath: 'data/assets/hamburg-lod3/previews/hamburg-lod3-gabled-townhouse.png',
    sourceObjectId: 'DEHHALKAJ0000pIJ',
  },
  {
    id: 'hamburg-lod3-urban-corner-house',
    name: 'Urban corner house',
    description: 'Tall corner building with dormers and a complex roofline.',
    size: '22 × 18 × 30 m',
    cityJsonPath: 'data/assets/hamburg-lod3/urban-corner-house.city.json',
    previewImagePath: 'data/assets/hamburg-lod3/previews/hamburg-lod3-urban-corner-house.png',
    sourceObjectId: 'DEHHALKAJ0000p7C',
  },
  {
    id: 'hamburg-lod3-courtyard-office',
    name: 'Courtyard office',
    description: 'Larger office block with a varied roof and facade installations.',
    size: '27 × 39 × 32 m',
    cityJsonPath: 'data/assets/hamburg-lod3/courtyard-office.city.json',
    previewImagePath: 'data/assets/hamburg-lod3/previews/hamburg-lod3-courtyard-office.png',
    sourceObjectId: 'DEHHALKAJ0000p29',
  },
  {
    id: 'hamburg-lod3-civic-building',
    name: 'Civic building',
    description: 'Highly detailed public-scale building with multiple roof forms.',
    size: '38 × 29 × 30 m',
    cityJsonPath: 'data/assets/hamburg-lod3/civic-building.city.json',
    previewImagePath: 'data/assets/hamburg-lod3/previews/hamburg-lod3-civic-building.png',
    sourceObjectId: 'DEHHALKAJ0000opW',
  },
];

export async function loadBuildingAsset(
  definition: BuildingAssetDefinition
): Promise<CityJsonDocument> {
  const response = await fetch(publicAssetUrl(definition.cityJsonPath));
  if (!response.ok) throw new Error(`Could not load ${definition.name}: HTTP ${response.status}`);
  return response.json() as Promise<CityJsonDocument>;
}

export function insertBuildingAsset(
  doc: CityJsonDocument,
  assetDoc: CityJsonDocument,
  definition: BuildingAssetDefinition,
  placementWgs84: [number, number]
): string {
  const sourceEntry = assetDoc.CityObjects[definition.sourceObjectId]
    ? ([definition.sourceObjectId, assetDoc.CityObjects[definition.sourceObjectId]] as const)
    : Object.entries(assetDoc.CityObjects)[0];
  if (!sourceEntry) throw new Error(`${definition.name} has no CityObject`);
  const [sourceRootId] = sourceEntry;
  const crs = detectCrs(doc);
  if (!crs.supported) throw new Error(`Cannot place asset in unsupported CRS ${crs.code}`);
  const [anchorX, anchorY] = proj4('EPSG:4326', crs.code, placementWgs84) as [number, number];
  const terrainZ = estimateTerrainElevationAtPoint(doc, placementWgs84);
  const targetTransform = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const sourceTransform = assetDoc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const vertexOffset = doc.vertices.length;
  for (const vertex of assetDoc.vertices) {
    const local = vertex.map(
      (value, axis) => value * sourceTransform.scale[axis] + sourceTransform.translate[axis]
    );
    const metric = [anchorX + local[0], anchorY + local[1], terrainZ + local[2]];
    doc.vertices.push(metric.map((value, axis) =>
      Math.round((value - targetTransform.translate[axis]) / targetTransform.scale[axis])
    ) as [number, number, number]);
  }

  const idBase = `asset-${definition.id}-${Date.now().toString(36)}`;
  let id = idBase;
  let suffix = 2;
  while (doc.CityObjects[id]) id = `${idBase}-${suffix++}`;
  const sourceIds = collectObjectTree(assetDoc, sourceRootId);
  const idMap = new Map<string, string>([[sourceRootId, id]]);
  sourceIds.slice(1).forEach((sourceId, index) => {
    let childId = `${id}-detail-${index + 1}`;
    let childSuffix = 2;
    while (doc.CityObjects[childId] || [...idMap.values()].includes(childId)) {
      childId = `${id}-detail-${index + 1}-${childSuffix++}`;
    }
    idMap.set(sourceId, childId);
  });

  const objects = sourceIds.map((sourceId) => {
    const object = structuredClone(assetDoc.CityObjects[sourceId]) as CityObject;
    object.geometry = (object.geometry ?? []).map((geometry) => {
      const cloned = structuredClone(geometry) as any;
      cloned.boundaries = offsetNumbers(cloned.boundaries, vertexOffset);
      return cloned;
    }) as any;
    object.children = object.children
      ?.filter((childId) => idMap.has(childId))
      .map((childId) => idMap.get(childId)!);
    object.parents = object.parents
      ?.filter((parentId) => idMap.has(parentId))
      .map((parentId) => idMap.get(parentId)!);
    return object;
  });
  mergeAppearance(doc, assetDoc, objects, definition);
  objects[0].attributes = {
    ...(objects[0].attributes ?? {}),
    name: definition.name,
    _assetId: definition.id,
    _createdBy: 'city-editor',
    _createdAt: new Date().toISOString(),
    _sourceUrl: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg17',
  };
  sourceIds.forEach((sourceId, index) => {
    doc.CityObjects[idMap.get(sourceId)!] = objects[index];
  });
  return id;
}

function mergeAppearance(
  doc: CityJsonDocument,
  assetDoc: CityJsonDocument,
  objects: CityObject[],
  definition: BuildingAssetDefinition
): void {
  const sourceAppearance = assetDoc.appearance as any;
  if (!sourceAppearance?.textures?.length) return;
  const target = ((doc as any).appearance ??= { textures: [], 'vertices-texture': [] });
  target.textures ??= [];
  target['vertices-texture'] ??= [];
  const textureOffset = target.textures.length;
  const uvOffset = target['vertices-texture'].length;
  const assetBase = definition.cityJsonPath.split('/').slice(0, -1).join('/');
  target.textures.push(
    ...sourceAppearance.textures.map((texture: { image?: string }) => ({
      ...structuredClone(texture),
      image: resolveAssetImage(assetBase, String(texture.image ?? '')),
    }))
  );
  target['vertices-texture'].push(...structuredClone(sourceAppearance['vertices-texture'] ?? []));
  for (const object of objects) {
    for (const geometry of object.geometry ?? []) {
      const candidate = geometry as any;
      if (candidate.texture) {
        candidate.texture = offsetTexture(candidate.texture, textureOffset, uvOffset);
      }
    }
  }
}

function collectObjectTree(doc: CityJsonDocument, rootId: string): string[] {
  const result: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id) || !doc.CityObjects[id]) continue;
    seen.add(id);
    result.push(id);
    queue.push(...(doc.CityObjects[id].children ?? []));
  }
  return result;
}

function resolveAssetImage(assetBase: string, image: string): string {
  if (/^(?:https?:|data:)/i.test(image)) return image;
  if (image.startsWith('/')) return publicAssetUrl(image);
  return publicAssetUrl(`${assetBase}/${image}`);
}

function offsetNumbers(value: unknown, offset: number): unknown {
  if (Number.isInteger(value)) return Number(value) + offset;
  return Array.isArray(value) ? value.map((item) => offsetNumbers(item, offset)) : value;
}

function offsetTexture(value: unknown, textureOffset: number, uvOffset: number): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (!Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, offsetTexture(item, textureOffset, uvOffset)])
    );
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    return [
      Number(value[0]) + textureOffset,
      ...value.slice(1).map((index) => Number.isInteger(index) ? Number(index) + uvOffset : index),
    ];
  }
  return value.map((item) => offsetTexture(item, textureOffset, uvOffset));
}
