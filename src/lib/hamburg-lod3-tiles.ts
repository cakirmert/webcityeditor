export const HAMBURG_LOD3_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD3_tex20cm/tileset.json';

export const HAMBURG_LOD3_ATTRIBUTION =
  'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung';

const GROUNDED_MARKER = Symbol('hamburg-lod3-grounded');

type MutableNumericArray = { length: number; [index: number]: number };
type NumericAttribute = { value?: MutableNumericArray };
type TilePrimitive = {
  attributes?: Record<string, NumericAttribute | undefined>;
};
type TileContent = {
  [GROUNDED_MARKER]?: boolean;
  batchTableJson?: { attributes?: unknown[] };
  gltf?: {
    meshes?: Array<{ primitives?: TilePrimitive[] }>;
  };
};

export interface HamburgLod3GroundingResult {
  featureCount: number;
  shiftedVertexCount: number;
}

/**
 * Hamburg's official b3dm tiles use Y-up glTF positions and carry one
 * surveyed ground height per batch feature. The map editor deliberately uses
 * a flat ground plane, so subtract each feature's own base height before the
 * loader rotates Y-up into deck.gl's Z-up frame. Roofs and installations keep
 * their measured height above ground while every building touches the map.
 */
export function groundHamburgLod3Tile(
  tile: { content?: TileContent } | TileContent
): HamburgLod3GroundingResult {
  const content = 'content' in tile && tile.content ? tile.content : tile as TileContent;
  if (content[GROUNDED_MARKER]) return { featureCount: 0, shiftedVertexCount: 0 };

  const primitives = (content.gltf?.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const minima = new Map<number, number>();
  for (const primitive of primitives) {
    const positions = primitive.attributes?.POSITION?.value;
    const batchIds = readBatchIds(primitive);
    if (!positions || !batchIds) continue;
    const vertexCount = Math.min(Math.floor(positions.length / 3), batchIds.length);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const batchId = Math.round(Number(batchIds[vertex]));
      const y = Number(positions[vertex * 3 + 1]);
      if (!Number.isFinite(batchId) || !Number.isFinite(y)) continue;
      minima.set(batchId, Math.min(minima.get(batchId) ?? Infinity, y));
    }
  }

  const metadata = content.batchTableJson?.attributes ?? [];
  const groundByBatch = new Map<number, number>();
  const featureIds = new Set([...minima.keys(), ...metadata.map((_, index) => index)]);
  for (const batchId of featureIds) {
    const surveyed = readSurveyedGroundHeight(metadata[batchId]);
    const fallback = minima.get(batchId);
    const ground = surveyed ?? fallback;
    if (ground !== undefined && Number.isFinite(ground)) groundByBatch.set(batchId, ground);
  }

  let shiftedVertexCount = 0;
  for (const primitive of primitives) {
    const positions = primitive.attributes?.POSITION?.value;
    const batchIds = readBatchIds(primitive);
    if (!positions || !batchIds) continue;
    const vertexCount = Math.min(Math.floor(positions.length / 3), batchIds.length);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const ground = groundByBatch.get(Math.round(Number(batchIds[vertex])));
      if (ground === undefined) continue;
      positions[vertex * 3 + 1] = Number(positions[vertex * 3 + 1]) - ground;
      shiftedVertexCount++;
    }
  }

  content[GROUNDED_MARKER] = true;
  return { featureCount: groundByBatch.size, shiftedVertexCount };
}

function readBatchIds(primitive: TilePrimitive): MutableNumericArray | null {
  return (
    primitive.attributes?._BATCHID?.value ??
    primitive.attributes?.BATCHID?.value ??
    primitive.attributes?._FEATURE_ID_0?.value ??
    null
  );
}

function readSurveyedGroundHeight(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (
      normalized !== 'grundhohenn' &&
      normalized !== 'grundhohe' &&
      normalized !== 'grundhoehe'
    ) continue;
    const number = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    if (Number.isFinite(number)) return number;
  }
  return null;
}
