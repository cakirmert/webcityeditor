export interface HamburgCityTree {
  id: string;
  position: [number, number, number];
  height: number;
  crownDiameter: number;
  trunkRadius: number;
  species: string;
  genus: string;
  plantingYear: number | null;
  street: string;
}

export interface TreeMesh {
  attributes: {
    positions: { value: Float32Array; size: 3 };
    normals: { value: Float32Array; size: 3 };
  };
  indices: { value: Uint16Array; size: 1 };
}

export type TreeCrownForm = 'rounded' | 'spreading' | 'columnar' | 'conical';

export const TREE_CROWN_FORMS: TreeCrownForm[] = [
  'rounded',
  'spreading',
  'columnar',
  'conical',
];

export const TREE_TRUNK_MESH = createRingMesh([
  { z: 0, radius: 1 },
  { z: 0.08, radius: 1.08 },
  { z: 0.7, radius: 0.82 },
  { z: 1, radius: 0.62 },
], 14);

export const TREE_CROWN_MESHES: Record<TreeCrownForm, TreeMesh> = {
  rounded: createCrownMesh([
    { z: 0, radius: 0.16, offsetX: -0.02 },
    { z: 0.1, radius: 0.58, offsetX: -0.06, offsetY: 0.03 },
    { z: 0.25, radius: 0.9, offsetX: 0.02, offsetY: 0.02 },
    { z: 0.45, radius: 1, offsetX: 0.04, offsetY: -0.03 },
    { z: 0.64, radius: 0.92, offsetX: -0.01, offsetY: -0.02 },
    { z: 0.82, radius: 0.62, offsetX: -0.04, offsetY: 0.02 },
    { z: 0.95, radius: 0.28, offsetX: 0.01 },
    { z: 1, radius: 0.05 },
  ]),
  spreading: createCrownMesh([
    { z: 0, radius: 0.18, offsetX: -0.03 },
    { z: 0.12, radius: 0.62, offsetX: -0.07, offsetY: 0.04 },
    { z: 0.28, radius: 0.96, offsetX: 0.03, offsetY: 0.04 },
    { z: 0.46, radius: 1, offsetX: 0.07, offsetY: -0.03 },
    { z: 0.63, radius: 0.94, offsetX: -0.02, offsetY: -0.04 },
    { z: 0.79, radius: 0.73, offsetX: -0.06, offsetY: 0.02 },
    { z: 0.92, radius: 0.38, offsetX: 0.02 },
    { z: 1, radius: 0.06 },
  ]),
  columnar: createCrownMesh([
    { z: 0, radius: 0.12 },
    { z: 0.08, radius: 0.42, offsetX: -0.02 },
    { z: 0.24, radius: 0.72, offsetX: 0.03, offsetY: 0.02 },
    { z: 0.48, radius: 0.82, offsetX: -0.02, offsetY: -0.01 },
    { z: 0.69, radius: 0.7, offsetX: 0.02 },
    { z: 0.85, radius: 0.48, offsetY: 0.02 },
    { z: 0.96, radius: 0.22 },
    { z: 1, radius: 0.04 },
  ]),
  conical: createCrownMesh([
    { z: 0, radius: 0.12 },
    { z: 0.08, radius: 1, offsetX: -0.02 },
    { z: 0.22, radius: 0.88, offsetX: 0.02 },
    { z: 0.38, radius: 0.73, offsetY: -0.02 },
    { z: 0.55, radius: 0.58, offsetX: -0.01 },
    { z: 0.72, radius: 0.4, offsetY: 0.01 },
    { z: 0.88, radius: 0.22 },
    { z: 1, radius: 0.03 },
  ]),
};

export function parseHamburgCityTrees(value: unknown): HamburgCityTree[] {
  if (!isRecord(value) || value.type !== 'HamburgCityCenterTrees' || !Array.isArray(value.trees)) {
    throw new Error('Hamburg street-tree data has an unexpected format.');
  }
  return value.trees.filter(isHamburgCityTree);
}

export function treeCrownColor(tree: HamburgCityTree): [number, number, number, number] {
  let hash = 0;
  for (const char of tree.genus || tree.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const variation = Math.abs(hash) % 22;
  const form = treeCrownForm(tree);
  const base = form === 'conical' ? [35, 92, 55] : form === 'spreading' ? [45, 111, 53] : [48, 119, 58];
  return [
    base[0] + Math.round(variation * 0.32),
    base[1] + variation,
    base[2] + Math.round(variation * 0.42),
    248,
  ];
}

export function treeCrownForm(tree: HamburgCityTree): TreeCrownForm {
  const botanicalName = `${tree.genus} ${tree.species}`.toLowerCase();
  if (/thuja|taxodium|picea|abies|pinus|larix|sequoia|juniper|zypresse/.test(botanicalName)) {
    return 'conical';
  }
  if (/populus|carpinus|betula|liquidambar|ginkgo|sorbus|pyrus/.test(botanicalName)) {
    return 'columnar';
  }
  if (/platanus|quercus|salix|robinia|gleditsia|sophora|fraxinus|celtis/.test(botanicalName)) {
    return 'spreading';
  }
  return 'rounded';
}

export function treeCrownTranslation(
  tree: HamburgCityTree
): [number, number, number] {
  const form = treeCrownForm(tree);
  const baseRatio = form === 'conical' ? 0.12 : form === 'columnar' ? 0.2 : form === 'spreading' ? 0.42 : 0.34;
  return [0, 0, tree.height * baseRatio];
}

export function treeCrownScale(
  tree: HamburgCityTree
): [number, number, number] {
  const form = treeCrownForm(tree);
  const radius = tree.crownDiameter / 2;
  const heightRatio = form === 'conical' ? 0.86 : form === 'columnar' ? 0.78 : form === 'spreading' ? 0.54 : 0.66;
  const yRatio = form === 'spreading' ? 0.9 : form === 'columnar' ? 0.86 : 0.96;
  return [radius, radius * yRatio, tree.height * heightRatio];
}

export function treeTrunkScale(
  tree: HamburgCityTree
): [number, number, number] {
  const crownBase = treeCrownTranslation(tree)[2];
  return [tree.trunkRadius, tree.trunkRadius, crownBase + tree.height * 0.14];
}

/**
 * The tree source stores absolute ellipsoidal elevations, while the editor's
 * basemap is a flat z=0 plane. Preserve the surveyed value in `tree.position`
 * but render the instance base on the same plane as roads and buildings.
 */
export function treePositionOnFlatGround(
  tree: HamburgCityTree
): [number, number, number] {
  return [tree.position[0], tree.position[1], 0];
}

function createRingMesh(
  rings: Array<{ z: number; radius: number }>,
  segments = 18
): TreeMesh {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const ring of rings) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(x * ring.radius, y * ring.radius, ring.z);
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring++) {
    const current = ring * segments;
    const next = (ring + 1) * segments;
    for (let segment = 0; segment < segments; segment++) {
      const following = (segment + 1) % segments;
      indices.push(
        current + segment,
        current + following,
        next + segment,
        current + following,
        next + following,
        next + segment
      );
    }
  }

  return {
    attributes: {
      positions: { value: new Float32Array(positions), size: 3 },
      normals: { value: vertexNormals(positions, indices), size: 3 },
    },
    indices: { value: new Uint16Array(indices), size: 1 },
  };
}

function createCrownMesh(
  rings: Array<{ z: number; radius: number; offsetX?: number; offsetY?: number }>
): TreeMesh {
  const segments = 18;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const ripple = 1 + 0.045 * Math.sin(angle * 3 + ringIndex * 0.83)
        + 0.025 * Math.cos(angle * 5 - ringIndex * 0.47);
      positions.push(
        (ring.offsetX ?? 0) + Math.cos(angle) * ring.radius * ripple,
        (ring.offsetY ?? 0) + Math.sin(angle) * ring.radius * ripple,
        ring.z
      );
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const current = ring * segments;
    const next = (ring + 1) * segments;
    for (let segment = 0; segment < segments; segment++) {
      const following = (segment + 1) % segments;
      indices.push(
        current + segment,
        current + following,
        next + segment,
        current + following,
        next + following,
        next + segment
      );
    }
  }
  return {
    attributes: {
      positions: { value: new Float32Array(positions), size: 3 },
      normals: { value: vertexNormals(positions, indices), size: 3 },
    },
    indices: { value: new Uint16Array(indices), size: 1 },
  };
}

function vertexNormals(positions: number[], indices: number[]): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index] * 3;
    const ib = indices[index + 1] * 3;
    const ic = indices[index + 2] * 3;
    const ab = [
      positions[ib] - positions[ia],
      positions[ib + 1] - positions[ia + 1],
      positions[ib + 2] - positions[ia + 2],
    ];
    const ac = [
      positions[ic] - positions[ia],
      positions[ic + 1] - positions[ia + 1],
      positions[ic + 2] - positions[ia + 2],
    ];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    for (const offset of [ia, ib, ic]) {
      normals[offset] += normal[0];
      normals[offset + 1] += normal[1];
      normals[offset + 2] += normal[2];
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
    normals[index] /= length;
    normals[index + 1] /= length;
    normals[index + 2] /= length;
  }
  return normals;
}

function isHamburgCityTree(value: unknown): value is HamburgCityTree {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  if (
    !Array.isArray(value.position) ||
    value.position.length !== 3 ||
    !value.position.every((coordinate) => Number.isFinite(Number(coordinate)))
  ) {
    return false;
  }
  return (
    Number.isFinite(Number(value.height)) &&
    Number.isFinite(Number(value.crownDiameter)) &&
    Number.isFinite(Number(value.trunkRadius))
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
