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

export const TREE_TRUNK_MESH = createRingMesh([
  { z: 0, radius: 1 },
  { z: 1, radius: 0.78 },
]);

export const TREE_CROWN_MESH = createRingMesh([
  { z: 0, radius: 0.2 },
  { z: 0.18, radius: 0.78 },
  { z: 0.5, radius: 1 },
  { z: 0.78, radius: 0.7 },
  { z: 1, radius: 0.08 },
]);

export function parseHamburgCityTrees(value: unknown): HamburgCityTree[] {
  if (!isRecord(value) || value.type !== 'HamburgCityCenterTrees' || !Array.isArray(value.trees)) {
    throw new Error('Hamburg street-tree data has an unexpected format.');
  }
  return value.trees.filter(isHamburgCityTree);
}

export function treeCrownColor(tree: HamburgCityTree): [number, number, number, number] {
  let hash = 0;
  for (const char of tree.genus || tree.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const variation = Math.abs(hash) % 24;
  return [42 + Math.round(variation * 0.35), 116 + variation, 58 + Math.round(variation * 0.5), 245];
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

function createRingMesh(rings: Array<{ z: number; radius: number }>): TreeMesh {
  const segments = 10;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const ring of rings) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(x * ring.radius, y * ring.radius, ring.z);
      const normalLength = Math.hypot(x, y, 0.28);
      normals.push(x / normalLength, y / normalLength, 0.28 / normalLength);
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
      normals: { value: new Float32Array(normals), size: 3 },
    },
    indices: { value: new Uint16Array(indices), size: 1 },
  };
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
