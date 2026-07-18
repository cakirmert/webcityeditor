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
  texturePath: string;
  sourceObjectId: string;
}

export const BUILDING_ASSETS: BuildingAssetDefinition[] = [
  {
    id: 'hamburg-lod3-round-courtyard',
    name: 'Round courtyard',
    description: 'Detailed circular Hamburg structure with a textured roof and facade atlas.',
    size: '28 × 28 × 10 m',
    cityJsonPath: 'data/assets/hamburg-lod3/round-courtyard.city.json',
    texturePath: 'data/assets/hamburg-lod3/round-courtyard.jpg',
    sourceObjectId: 'DEHHALKAJ0000oGL',
  },
  {
    id: 'hamburg-lod3-industrial-hall',
    name: 'Industrial hall',
    description: 'Compact textured Hamburg industrial building with detailed roof equipment.',
    size: '11 × 20 × 8 m',
    cityJsonPath: 'data/assets/hamburg-lod3/industrial-hall.city.json',
    texturePath: 'data/assets/hamburg-lod3/industrial-hall.jpg',
    sourceObjectId: 'DEHHALKAJ0000oWO',
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
  const sourceEntry = Object.entries(assetDoc.CityObjects)[0];
  if (!sourceEntry) throw new Error(`${definition.name} has no CityObject`);
  const [, sourceObject] = sourceEntry;
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

  const object = structuredClone(sourceObject) as CityObject;
  object.geometry = (object.geometry ?? []).map((geometry) => {
    const cloned = structuredClone(geometry) as any;
    cloned.boundaries = offsetNumbers(cloned.boundaries, vertexOffset);
    return cloned;
  }) as any;
  mergeAppearance(doc, assetDoc, object, definition);
  const idBase = `asset-${definition.id}-${Date.now().toString(36)}`;
  let id = idBase;
  let suffix = 2;
  while (doc.CityObjects[id]) id = `${idBase}-${suffix++}`;
  object.attributes = {
    ...(object.attributes ?? {}),
    name: definition.name,
    _assetId: definition.id,
    _createdBy: 'city-editor',
    _createdAt: new Date().toISOString(),
    _sourceUrl: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5',
  };
  doc.CityObjects[id] = object;
  return id;
}

function mergeAppearance(
  doc: CityJsonDocument,
  assetDoc: CityJsonDocument,
  object: CityObject,
  definition: BuildingAssetDefinition
): void {
  const sourceAppearance = assetDoc.appearance as any;
  if (!sourceAppearance?.textures?.length) return;
  const target = ((doc as any).appearance ??= { textures: [], 'vertices-texture': [] });
  target.textures ??= [];
  target['vertices-texture'] ??= [];
  const textureOffset = target.textures.length;
  const uvOffset = target['vertices-texture'].length;
  target.textures.push({
    ...structuredClone(sourceAppearance.textures[0]),
    image: publicAssetUrl(definition.texturePath),
  });
  target['vertices-texture'].push(...structuredClone(sourceAppearance['vertices-texture'] ?? []));
  for (const geometry of object.geometry ?? []) {
    const candidate = geometry as any;
    if (candidate.texture) {
      candidate.texture = offsetTexture(candidate.texture, textureOffset, uvOffset);
    }
  }
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
