import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import { BUILDING_ASSETS, insertBuildingAsset } from '../../src/lib/building-assets';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';
import { checkIntegrity } from '../../src/lib/integrity';
import type { CityJsonDocument } from '../../src/types';

const files = BUILDING_ASSETS.map((definition) => ({
  definition,
  document: JSON.parse(readFileSync(`public/${definition.cityJsonPath}`, 'utf8')) as CityJsonDocument,
}));

describe('official Hamburg LoD3 building assets', () => {
  it.each(files)('$definition.name ships as textured CityJSON LoD3', ({ definition, document }) => {
    const object = Object.values(document.CityObjects)[0];
    const geometry = object.geometry?.[0] as {
      lod?: string;
      texture?: Record<string, unknown>;
    };
    const appearance = document.appearance as {
      textures?: Array<{ image?: string }>;
      'vertices-texture'?: number[][];
    };

    expect(document.vertices.length).toBeGreaterThan(20);
    expect(geometry.lod).toBe('3');
    expect(geometry.texture).toBeTruthy();
    const textureImage = appearance.textures?.[0].image;
    const assetDirectory = definition.cityJsonPath.split('/').slice(0, -1).join('/');
    expect(textureImage).toMatch(/\.jpg$/);
    expect(existsSync(`public/${assetDirectory}/${textureImage}`)).toBe(true);
    expect(existsSync(`public/${definition.previewImagePath}`)).toBe(true);
    expect(appearance['vertices-texture']?.length).toBeGreaterThan(100);
    expect(object.attributes?._sourceObjectId).toBe(definition.sourceObjectId);
    expect(object.attributes?._license).toContain('Namensnennung');
    expect(checkIntegrity(document).ok).toBe(true);
  });

  it.each(files)(
    'places $definition.name into the editable host without dangling relations',
    ({ definition, document }) => {
    const host = buildSampleCube();
    const originalVertexCount = host.vertices.length;

    const id = insertBuildingAsset(host, document, definition, [4.35722, 52.01165]);
    const inserted = host.CityObjects[id];
    const appearance = host.appearance as {
      textures: Array<{ image: string }>;
      'vertices-texture': number[][];
    };
    const insertedIds = new Set([id, ...(inserted.children ?? [])]);
    const mesh = buildCityJsonMapMesh(host, { objectIds: insertedIds });

    expect(inserted.type).toBe('Building');
    expect((inserted.geometry?.[0] as { lod?: string }).lod).toBe('3');
    expect(inserted.attributes?._assetId).toBe(definition.id);
    expect(host.vertices.length).toBe(originalVertexCount + document.vertices.length);
    const sourceTexture = (
      document.appearance as { textures?: Array<{ image?: string }> }
    ).textures?.[0].image;
    expect(appearance.textures[0].image).toContain(sourceTexture);
    expect(inserted.children?.length ?? 0).toBeGreaterThan(0);
    expect(mesh?.textures).toHaveLength(1);
    expect(mesh?.triangleCount).toBeGreaterThan(10);
    expect(checkIntegrity(host).ok).toBe(true);
    }
  );
});
