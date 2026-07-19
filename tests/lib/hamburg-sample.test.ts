import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto } from '../../src/lib/cityjson';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';
import { commitBuildingTransformFromEditor } from '../../src/lib/editor-actions';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import { extractFootprints, filterToBuilding } from '../../src/lib/footprints';
import { mergeCityJson } from '../../src/lib/merge';
import { parseHamburgCityTrees } from '../../src/lib/hamburg-trees';
import { extractTransportationAreas } from '../../src/lib/transportation';

const HAMBURG_BUILDINGS_PATH =
  'public/data/hamburg/hamburg-city-center-buildings.city.jsonl';
const HAMBURG_ROADS_CITYJSON_PATH =
  'public/data/hamburg/hamburg-city-center-roads.city.json';
const HAMBURG_LOD3_PATH = 'public/data/hamburg/hamburg-lod3-showcase.city.json';
const HAMBURG_TREES_PATH = 'public/data/hamburg/hamburg-city-center-trees.json';
const HAMBURG_ROADS_OSM_PATH = 'public/data/hamburg/hamburg-city-center-roads.osm';
const DEMO_BBOX: [number, number, number, number] = [9.978, 53.5395, 10.0035, 53.5545];

const text = readFileSync(HAMBURG_BUILDINGS_PATH, 'utf8');
const roadText = readFileSync(HAMBURG_ROADS_CITYJSON_PATH, 'utf8');
const lod3Text = readFileSync(HAMBURG_LOD3_PATH, 'utf8');
const treeText = readFileSync(HAMBURG_TREES_PATH, 'utf8');
const osmText = readFileSync(HAMBURG_ROADS_OSM_PATH, 'utf8');
const parsed = parseCityJsonAuto(text);
if (!parsed.ok) throw new Error(parsed.error);
const parsedRoads = parseCityJsonAuto(roadText);
if (!parsedRoads.ok) throw new Error(parsedRoads.error);
const parsedLod3 = parseCityJsonAuto(lod3Text);
if (!parsedLod3.ok) throw new Error(parsedLod3.error);
const hamburgTrees = parseHamburgCityTrees(JSON.parse(treeText));

const doc = parsed.doc;
const footprints = extractFootprints(doc);
const buildingIds = Object.entries(doc.CityObjects)
  .filter(([, object]) => object.type === 'Building')
  .map(([id]) => id);

describe('Hamburg committed city-center demo', () => {
  it('contains the official LoD2 buildings and close startup camera', () => {
    expect(buildingIds).toHaveLength(1_353);
    expect(doc.metadata?.featureCount).toBe(1_353);
    expect(doc.metadata?.webcityeditorInitialView).toEqual({
      center: [9.991, 53.547],
      zoom: 15.1,
      pitch: 48,
      bearing: -12,
    });

    const firstBuilding = doc.CityObjects[buildingIds[0]];
    expect(firstBuilding.geometry?.some((geometry) => (geometry as { lod?: string }).lod === '2')).toBe(
      true
    );
  });

  it('builds the 3D building mesh', () => {
    const mesh = buildCityJsonMapMesh(doc, { maxInputVertices: 100_000 });
    expect(footprints).toHaveLength(1_353);
    expect(mesh).not.toBeNull();
    expect(mesh!.triangleCount).toBeGreaterThan(10_000);
  });

  it('ships a surveyed textured LoD3 district inside the default map area', () => {
    const roots = Object.entries(parsedLod3.doc.CityObjects)
      .filter(([, object]) => object.type === 'Building')
      .map(([id]) => id);
    const installations = Object.values(parsedLod3.doc.CityObjects)
      .filter((object) => object.type === 'BuildingInstallation');
    const selectedIds = new Set(Object.keys(parsedLod3.doc.CityObjects));
    const mesh = buildCityJsonMapMesh(parsedLod3.doc, {
      objectIds: selectedIds,
      maxOutputVertices: 160_000,
    });

    expect(roots).toHaveLength(68);
    expect(roots.every((id) => doc.CityObjects[id]?.type === 'Building')).toBe(true);
    expect(installations).toHaveLength(1_043);
    expect((parsedLod3.doc.appearance as any)?.textures).toHaveLength(68);
    expect(mesh?.maxLod).toBe(3);
    expect(mesh?.textures).toHaveLength(68);
    expect(mesh?.texturedSurfaceCount).toBeGreaterThan(4_000);
    expect(mesh?.explicitOpeningSurfaceCount).toBe(0);
    expect(parsedLod3.doc.metadata?.geographicalExtent).toEqual(
      expect.arrayContaining([
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      ])
    );
  });

  it('ships measured official 3D street trees only for the city-center bbox', () => {
    expect(hamburgTrees).toHaveLength(2_110);
    expect(
      hamburgTrees.every(
        (tree) =>
          tree.position[0] >= DEMO_BBOX[0] &&
          tree.position[0] <= DEMO_BBOX[2] &&
          tree.position[1] >= DEMO_BBOX[1] &&
          tree.position[1] <= DEMO_BBOX[3]
      )
    ).toBe(true);
    expect(hamburgTrees.every((tree) => tree.height > 0 && tree.crownDiameter > 0)).toBe(true);
    expect(hamburgTrees.some((tree) => tree.species.includes('Acer'))).toBe(true);
  });

  it('starts from editable osm2streets road surfaces stored in CityJSON', () => {
    const roadIds = Object.entries(parsedRoads.doc.CityObjects)
      .filter(([, object]) => object.type === 'Road')
      .map(([id]) => id);
    const areas = extractTransportationAreas(parsedRoads.doc);

    expect(roadIds).toHaveLength(2_650);
    expect(areas).toHaveLength(7_597);
    expect(areas.every((area) => area.geometryMode === 'exact')).toBe(true);
    expect(areas.some((area) => area.function === 'driving_lane')).toBe(true);
    expect(areas.some((area) => area.function === 'bike_lane')).toBe(true);
    expect(areas.some((area) => area.function === 'sidewalk')).toBe(true);
    expect(areas.filter((area) => area.function === 'intersection')).toHaveLength(1_042);
    expect(
      areas.some(
        (area) =>
          area.function === 'intersection' && Array.isArray(area.attributes.connectedRoadIds)
      )
    ).toBe(true);
    expect(parsedRoads.doc.metadata?.source).toContain('osm2streets');
    expect(
      parsedRoads.doc.CityObjects['hh-road-r00-c00-osm2streets-road-29']?.attributes
    ).toMatchObject({
      name: 'Steintwietenhof',
      _highwayType: 'residential',
      _createdBy: 'webcityeditor',
      _verticalProfile: {
        placement: 'surface',
        elevationM: 0,
        osmLayer: 0,
      },
    });
  });

  it('merges the default roads into the building document without changing building geometry', () => {
    const combined = structuredClone(doc);
    const originalBuildingVertices = combined.vertices.length;
    const result = mergeCityJson(combined, parsedRoads.doc);

    expect(result).toMatchObject({ ok: true, added: 2_650, renamed: 0 });
    expect(
      Object.values(combined.CityObjects).filter((object) => object.type === 'Building')
    ).toHaveLength(1_353);
    expect(combined.vertices.length).toBe(
      originalBuildingVertices + parsedRoads.doc.vertices.length
    );
  });

  it('keeps the compact OSM crop only as an optional refresh source', () => {
    expect((osmText.match(/<way\b/g) ?? []).length).toBe(1_624);
    expect(osmText).toContain('<tag k="highway" v="primary"');
    expect(osmText).toContain('<tag k="highway" v="secondary"');
    expect(osmText).toContain('<tag k="highway" v="pedestrian"');
    expect(osmText).not.toContain('<tag k="highway" v="footway"');
    expect(DEMO_BBOX).toEqual([9.978, 53.5395, 10.0035, 53.5545]);
  });

  it('can move an imported demo building and prepare it for export', () => {
    const buildingId = footprints[0]?.id;
    expect(buildingId).toBeTruthy();
    if (!buildingId) return;

    const focused = filterToBuilding(doc, buildingId);
    const moved = commitBuildingTransformFromEditor(focused, {
      id: buildingId,
      dx: 4.5,
      dy: -2.25,
      dz: 0,
      angle: 0,
    });
    const prepared = prepareValidatedCityJsonExport(focused);

    expect(moved.changed).toBe(true);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
  });
});
