import { usageRgb } from './footprint-tint';

export const HAMBURG_LOD1_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD1/tileset.json';

export const HAMBURG_LOD2_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD2/tileset.json';

export const HAMBURG_LOD3_UNTEXTURED_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD3_untexturiert/tileset.json';

export const HAMBURG_LOD3_TEXTURED_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/LoD3_tex20cm/tileset.json';

export function hamburgLod3TilesetUrl(texturesEnabled: boolean): string {
  return texturesEnabled
    ? HAMBURG_LOD3_TEXTURED_TILESET_URL
    : HAMBURG_LOD3_UNTEXTURED_TILESET_URL;
}

export const HAMBURG_LOD3_ATTRIBUTION =
  'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung';

const GROUNDED_MARKER = Symbol('hamburg-lod3-grounded');
const COLOR_MODE_MARKER = Symbol('hamburg-building-color-mode');

type MutableNumericArray = { length: number; [index: number]: number };
type NumericAttribute = {
  value?: MutableNumericArray;
  componentType?: number;
  count?: number;
  normalized?: boolean;
  type?: string;
  id?: string;
  bytesPerComponent?: number;
  components?: number;
  bytesPerElement?: number;
};
type TileMaterial = {
  id?: string;
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
type TilePrimitive = {
  attributes?: Record<string, NumericAttribute | undefined>;
  indices?: NumericAttribute;
  material?: TileMaterial;
  mode?: number;
};
type TileContent = {
  [GROUNDED_MARKER]?: boolean;
  [COLOR_MODE_MARKER]?: 'roof' | 'usage';
  batchTableJson?: { attributes?: unknown[] };
  gltf?: {
    meshes?: Array<{ primitives?: TilePrimitive[] }>;
  };
};

export interface HamburgLod3GroundingResult {
  featureCount: number;
  shiftedVertexCount: number;
}

export interface HamburgBuildingTileStylingResult {
  primitiveCount: number;
  coloredVertexCount: number;
  roofTriangleCount: number;
  wallTriangleCount: number;
  groundTriangleCount: number;
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

/**
 * Restore the editor's semantic surface palette on Hamburg's neutral-grey
 * LoD1/LoD2/untextured-LoD3 glTF meshes. deck.gl's ScenegraphLayer does not
 * consume glTF COLOR_0 attributes, so triangles are grouped into a small set
 * of primitives with semantic PBR materials. Geometry and batch IDs remain
 * untouched, preserving both streamed picking and the CityJSON handoff.
 */
export function styleHamburgBuildingTile(
  tile: { content?: TileContent } | TileContent,
  colorMode: 'roof' | 'usage'
): HamburgBuildingTileStylingResult {
  const content = 'content' in tile && tile.content ? tile.content : tile as TileContent;
  if (content[COLOR_MODE_MARKER] === colorMode) {
    return emptyStylingResult();
  }

  const metadata = content.batchTableJson?.attributes ?? [];
  const result = emptyStylingResult();
  let materialSerial = 0;
  for (const mesh of content.gltf?.meshes ?? []) {
    const styledPrimitives: TilePrimitive[] = [];
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) {
        styledPrimitives.push(primitive);
        continue;
      }
      const positions = primitive.attributes?.POSITION?.value;
      const batchIds = readBatchIds(primitive);
      if (!positions || !batchIds) {
        styledPrimitives.push(primitive);
        continue;
      }
      const normals = primitive.attributes?.NORMAL?.value;
      const indices = primitive.indices?.value;
      const vertexCount = Math.min(
        Math.floor(positions.length / 3),
        batchIds.length
      );
      if (vertexCount < 3) {
        styledPrimitives.push(primitive);
        continue;
      }

      const groups = new Map<
        string,
        {
          color: readonly [number, number, number];
          indices: number[];
        }
      >();
      const indexCount = indices?.length ?? vertexCount;
      for (let offset = 0; offset + 2 < indexCount; offset += 3) {
        const triangle = [
          Math.round(Number(indices ? indices[offset] : offset)),
          Math.round(Number(indices ? indices[offset + 1] : offset + 1)),
          Math.round(Number(indices ? indices[offset + 2] : offset + 2)),
        ];
        if (triangle.some((index) => index < 0 || index >= vertexCount)) continue;

        const batchId = Math.round(Number(batchIds[triangle[0]]));
        const sameFeature = triangle.every(
          (index) => Math.round(Number(batchIds[index])) === batchId
        );
        if (!Number.isFinite(batchId) || !sameFeature) continue;

        let groupKey: string;
        let color: readonly [number, number, number];
        if (colorMode === 'usage') {
          const attributes = readAttributes(metadata[batchId]);
          const usage = attributes.function ?? attributes.citygml_function;
          const [red, green, blue] = usageRgb(usage);
          groupKey = `usage-${red}-${green}-${blue}`;
          color = [red / 255, green / 255, blue / 255];
        } else {
          const surface = classifyTriangleSurface(
            positions,
            normals,
            triangle
          );
          groupKey = surface;
          color = semanticColor(surface);
          if (surface === 'roof') result.roofTriangleCount++;
          else if (surface === 'ground') result.groundTriangleCount++;
          else result.wallTriangleCount++;
        }

        let group = groups.get(groupKey);
        if (!group) {
          group = { color, indices: [] };
          groups.set(groupKey, group);
        }
        group.indices.push(...triangle);
      }

      if (groups.size === 0) {
        styledPrimitives.push(primitive);
        continue;
      }

      const attributes = { ...(primitive.attributes ?? {}) };
      delete attributes.COLOR_0;
      for (const [groupKey, group] of groups) {
        const id = `hamburg-${colorMode}-${groupKey}-${materialSerial++}`;
        styledPrimitives.push({
          ...primitive,
          attributes,
          indices: triangleIndexAccessor(group.indices, vertexCount, id),
          material: semanticMaterial(primitive.material, group.color, id),
        });
      }
      result.primitiveCount++;
      result.coloredVertexCount += vertexCount;
    }
    mesh.primitives = styledPrimitives;
  }
  content[COLOR_MODE_MARKER] = colorMode;
  return result;
}

function readBatchIds(primitive: TilePrimitive): MutableNumericArray | null {
  return (
    primitive.attributes?._BATCHID?.value ??
    primitive.attributes?.BATCHID?.value ??
    primitive.attributes?._FEATURE_ID_0?.value ??
    null
  );
}

function classifyTriangleSurface(
  positions: MutableNumericArray,
  normals: MutableNumericArray | undefined,
  triangle: number[]
): 'roof' | 'wall' | 'ground' {
  const heights = triangle.map((index) => Number(positions[index * 3 + 1]));
  let verticalShare = 0;
  if (normals) {
    const normal = triangle.reduce(
      (sum, index) => [
        sum[0] + Number(normals[index * 3]),
        sum[1] + Number(normals[index * 3 + 1]),
        sum[2] + Number(normals[index * 3 + 2]),
      ],
      [0, 0, 0]
    );
    const length = Math.hypot(normal[0], normal[1], normal[2]);
    if (length > 0) verticalShare = Math.abs(normal[1]) / length;
  } else {
    const [a, b, c] = triangle.map((index) => [
      Number(positions[index * 3]),
      Number(positions[index * 3 + 1]),
      Number(positions[index * 3 + 2]),
    ]);
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(normal[0], normal[1], normal[2]);
    if (length > 0) verticalShare = Math.abs(normal[1]) / length;
  }
  if (verticalShare <= 0.3) return 'wall';
  return Math.max(...heights) <= 0.15 ? 'ground' : 'roof';
}

export const HAMBURG_SEMANTIC_ROOF_COLOR =
  [0.95, 0.22, 0.12] as const;

function semanticColor(
  surface: 'roof' | 'wall' | 'ground'
): readonly [number, number, number] {
  // The official stream is PBR-lit, while local CityJSON uses Phong-lit
  // vertex colours. This brighter factor keeps both paths visually terracotta
  // instead of making streamed roofs read as dark brown.
  if (surface === 'roof') return HAMBURG_SEMANTIC_ROOF_COLOR;
  if (surface === 'ground') return [0.36, 0.33, 0.3];
  return [0.78, 0.74, 0.67];
}

function triangleIndexAccessor(
  indices: number[],
  vertexCount: number,
  id: string
): NumericAttribute {
  const useUint32 =
    vertexCount > 65_535 || indices.some((index) => index > 65_535);
  const value = useUint32
    ? new Uint32Array(indices)
    : new Uint16Array(indices);
  const bytes = useUint32 ? 4 : 2;
  return {
    componentType: useUint32 ? 5125 : 5123,
    count: value.length,
    normalized: false,
    type: 'SCALAR',
    id: `${id}-indices`,
    bytesPerComponent: bytes,
    components: 1,
    bytesPerElement: bytes,
    value,
  };
}

function semanticMaterial(
  source: TileMaterial | undefined,
  color: readonly [number, number, number],
  id: string
): TileMaterial {
  const pbr = source?.pbrMetallicRoughness ?? {};
  return {
    ...(source ?? {}),
    id,
    name: id,
    pbrMetallicRoughness: {
      ...pbr,
      baseColorTexture: undefined,
      baseColorFactor: [color[0], color[1], color[2], 1],
      metallicFactor: 0,
      roughnessFactor: 0.8,
    },
  };
}

function readAttributes(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function emptyStylingResult(): HamburgBuildingTileStylingResult {
  return {
    primitiveCount: 0,
    coloredVertexCount: 0,
    roofTriangleCount: 0,
    wallTriangleCount: 0,
    groundTriangleCount: 0,
  };
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
