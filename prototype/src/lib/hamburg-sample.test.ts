import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto } from './cityjson';
import { buildCityJsonMapMesh } from './cityjson-map-mesh';
import { commitBuildingTransformFromEditor, createBuildingFromEditor } from './editor-actions';
import { prepareValidatedCityJsonExport } from './export-validation';
import { extractFootprints, filterToBuilding } from './footprints';
import { detectCrs } from './projection';

const HAMBURG_SAMPLE_PATH = 'public/data/hamburg/hamburg-center-alkis.city.jsonl';

describe('Hamburg hosted ALKIS sample', () => {
  it('contains procedural roof geometry instead of only flat LoD1 caps', () => {
    const text = readFileSync(HAMBURG_SAMPLE_PATH, 'utf8');
    const [headerLine, ...featureLines] = text.trim().split(/\r?\n/);
    const header = JSON.parse(headerLine) as {
      transform: { scale: [number, number, number] };
    };

    let buildings = 0;
    let roofFaces = 0;
    let pitchedBuildingsWithRoofRise = 0;
    let buildingsWithMoreThanTwoZLevels = 0;
    const lods = new Set<string>();

    for (const line of featureLines) {
      const feature = JSON.parse(line) as {
        CityObjects: Record<
          string,
          {
            attributes?: Record<string, unknown>;
            geometry?: Array<{
              lod?: string;
              boundaries?: number[][][][];
              semantics?: {
                surfaces?: Array<{ type?: string }>;
                values?: number[][];
              };
            }>;
          }
        >;
        vertices: [number, number, number][];
      };
      const obj = Object.values(feature.CityObjects)[0];
      if (!obj) continue;
      buildings++;

      for (const geom of obj.geometry ?? []) {
        if (geom.lod) lods.add(geom.lod);
        const shell = geom.boundaries?.[0] ?? [];
        const semanticValues = geom.semantics?.values?.[0] ?? [];
        const surfaces = geom.semantics?.surfaces ?? [];
        for (let i = 0; i < shell.length; i++) {
          if (surfaces[semanticValues[i]]?.type === 'RoofSurface') roofFaces++;
        }
      }

      const roofRise = Number(obj.attributes?.roofRise ?? 0);
      if (roofRise > 0) pitchedBuildingsWithRoofRise++;

      const zLevels = new Set(
        feature.vertices.map((v) => Number((v[2] * header.transform.scale[2]).toFixed(3)))
      );
      if (zLevels.size > 2) buildingsWithMoreThanTwoZLevels++;
    }

    expect(buildings).toBeGreaterThan(0);
    expect([...lods]).toEqual(['2.0']);
    expect(roofFaces).toBeGreaterThan(buildings);
    expect(pitchedBuildingsWithRoofRise).toBeGreaterThan(0);
    expect(buildingsWithMoreThanTwoZLevels).toBeGreaterThan(0);
  });

  it('can build a small map detail mesh with roof triangles', () => {
    const parsed = parseCityJsonAuto(readFileSync(HAMBURG_SAMPLE_PATH, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const mesh = buildCityJsonMapMesh(parsed.doc);
    expect(mesh).not.toBeNull();
    expect(mesh!.triangleCount).toBeGreaterThan(1_000);
    expect(mesh!.positions.length).toBeGreaterThan(0);
    expect(mesh!.indices.length).toBeGreaterThan(0);
  });

  it('can add a new building and prepare the Hamburg sample for export', () => {
    const parsed = parseCityJsonAuto(readFileSync(HAMBURG_SAMPLE_PATH, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const doc = parsed.doc;
    const crs = detectCrs(doc);
    expect(crs.supported).toBe(true);

    const firstFootprint = extractFootprints(doc)[0]?.polygon;
    expect(firstFootprint?.length).toBeGreaterThan(0);
    if (!firstFootprint) return;

    const lng = firstFootprint.reduce((sum, p) => sum + p[0], 0) / firstFootprint.length;
    const lat = firstFootprint.reduce((sum, p) => sum + p[1], 0) / firstFootprint.length;
    const newFootprint: [number, number][] = [
      [lng + 0.00035, lat + 0.00035],
      [lng + 0.00045, lat + 0.00035],
      [lng + 0.00045, lat + 0.00043],
      [lng + 0.00035, lat + 0.00043],
    ];

    const created = createBuildingFromEditor(doc, {
      targetCrs: crs.code,
      footprintWgs84: newFootprint,
      storeys: 2,
      eaveHeight: 6,
      ridgeHeight: 6,
      roofType: 'flat',
    });
    const prepared = prepareValidatedCityJsonExport(doc);

    expect(created.id).toBeTruthy();
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
  });

  it('can move the reported Hamburg building without flattening Solid semantics', () => {
    const parsed = parseCityJsonAuto(readFileSync(HAMBURG_SAMPLE_PATH, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const doc = parsed.doc;
    const id = 'hamburg-alkis-219845';
    const building = doc.CityObjects[id];
    expect(building).toBeDefined();

    const geometry = building.geometry?.[0] as {
      type?: string;
      boundaries?: number[][][][];
      semantics?: { values?: unknown };
    };
    expect(geometry.type).toBe('Solid');
    expect(Array.isArray(geometry.semantics?.values)).toBe(true);
    expect((geometry.semantics?.values as unknown[]).length).toBe(1);

    const filtered = filterToBuilding(doc, id);
    const filteredGeometry = filtered.CityObjects[id].geometry?.[0] as {
      semantics?: { values?: unknown };
    };
    filteredGeometry.semantics!.values = (filteredGeometry.semantics!.values as number[][])[0];
    expect((geometry.semantics?.values as unknown[]).length).toBe(1);

    const moved = commitBuildingTransformFromEditor(doc, {
      id,
      dx: 4.5,
      dy: -2.25,
      dz: 0,
      angle: 0,
    });
    const movedGeometry = doc.CityObjects[id].geometry?.[0] as {
      boundaries?: number[][][][];
      semantics?: { values?: unknown };
    };
    const prepared = prepareValidatedCityJsonExport(doc);

    expect(moved.changed).toBe(true);
    expect((movedGeometry.semantics?.values as unknown[]).length).toBe(1);
    expect((movedGeometry.semantics?.values as number[][])[0]).toHaveLength(
      movedGeometry.boundaries?.[0]?.length ?? 0
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.error);
  });
});
