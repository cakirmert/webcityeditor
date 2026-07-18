import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto } from '../../src/lib/cityjson';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';
import { commitBuildingTransformFromEditor } from '../../src/lib/editor-actions';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import { extractFootprints, filterToBuilding } from '../../src/lib/footprints';
import { mergeCityJson } from '../../src/lib/merge';
import { extractTransportationAreas } from '../../src/lib/transportation';

const HAMBURG_BUILDINGS_PATH =
  'public/data/hamburg/hamburg-city-center-buildings.city.jsonl';
const HAMBURG_ROADS_CITYJSON_PATH =
  'public/data/hamburg/hamburg-city-center-roads.city.json';
const HAMBURG_ROADS_OSM_PATH = 'public/data/hamburg/hamburg-city-center-roads.osm';
const DEMO_BBOX: [number, number, number, number] = [9.978, 53.5395, 10.0035, 53.5545];

const text = readFileSync(HAMBURG_BUILDINGS_PATH, 'utf8');
const roadText = readFileSync(HAMBURG_ROADS_CITYJSON_PATH, 'utf8');
const osmText = readFileSync(HAMBURG_ROADS_OSM_PATH, 'utf8');
const parsed = parseCityJsonAuto(text);
if (!parsed.ok) throw new Error(parsed.error);
const parsedRoads = parseCityJsonAuto(roadText);
if (!parsedRoads.ok) throw new Error(parsedRoads.error);

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

  it('starts from editable osm2streets road surfaces stored in CityJSON', () => {
    const roadIds = Object.entries(parsedRoads.doc.CityObjects)
      .filter(([, object]) => object.type === 'Road')
      .map(([id]) => id);
    const areas = extractTransportationAreas(parsedRoads.doc);

    expect(roadIds).toHaveLength(1_608);
    expect(areas).toHaveLength(6_555);
    expect(areas.every((area) => area.geometryMode === 'exact')).toBe(true);
    expect(areas.some((area) => area.function === 'driving_lane')).toBe(true);
    expect(areas.some((area) => area.function === 'bike_lane')).toBe(true);
    expect(areas.some((area) => area.function === 'sidewalk')).toBe(true);
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

    expect(result).toMatchObject({ ok: true, added: 1_608, renamed: 0 });
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
