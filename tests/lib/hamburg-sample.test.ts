import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto } from '../../src/lib/cityjson';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';
import { commitBuildingTransformFromEditor } from '../../src/lib/editor-actions';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import { extractFootprints, filterToBuilding } from '../../src/lib/footprints';

const HAMBURG_BUILDINGS_PATH =
  'public/data/hamburg/hamburg-city-center-buildings.city.jsonl';
const HAMBURG_ROADS_PATH = 'public/data/hamburg/hamburg-city-center-roads.osm';
const DEMO_BBOX: [number, number, number, number] = [9.978, 53.5395, 10.0035, 53.5545];

const text = readFileSync(HAMBURG_BUILDINGS_PATH, 'utf8');
const osmText = readFileSync(HAMBURG_ROADS_PATH, 'utf8');
const parsed = parseCityJsonAuto(text);
if (!parsed.ok) throw new Error(parsed.error);

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

  it('contains a compact OSM road crop in the same shape as Fetch Roads', () => {
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
