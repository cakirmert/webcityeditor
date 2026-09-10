import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSampleCube } from '../../src/lib/cityjson';
import { checkIntegrity } from '../../src/lib/integrity';
import { createManualRoadDraft, extractTransportationAreas, insertRoadIntoCityJson } from '../../src/lib/transportation';
import { extractFootprints } from '../../src/lib/footprints';
import { checkProjectRoadResetExtent, prepareProjectRoadReplacement, projectRoadResetExtent } from '../../src/lib/project-road-reset';
import { roadDraftSource } from '../../src/lib/road-draft-source';
import { compactVertices } from '../../src/lib/compact';
import type { CityJsonDocument } from '../../src/types';

describe('project-wide OSM reset', () => {
  it('prepares a complete replacement without mutation and preserves buildings across CRS conversion', () => {
    const doc = buildSampleCube();
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]]), { id: 'old-edited-road' });
    const replacement = JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt-source.json', 'utf8')) as CityJsonDocument;
    const before = JSON.stringify(doc), incoming = JSON.stringify(replacement), buildings = extractFootprints(doc);
    const plan = prepareProjectRoadReplacement(doc, replacement, 'test OSM snapshot');
    expect(JSON.stringify(doc)).toBe(before); expect(JSON.stringify(replacement)).toBe(incoming);
    expect(plan.removedIds).toEqual(['old-edited-road']); expect(plan.document.CityObjects['old-edited-road']).toBeUndefined();
    expect(plan.addedIds).toHaveLength(Object.keys(replacement.CityObjects).length);
    expect(extractFootprints(plan.document)).toEqual(buildings); expect(checkIntegrity(plan.document).ok).toBe(true);
    const roads = extractTransportationAreas(plan.document);
    expect(roads.some(area => area.function === 'intersection')).toBe(true);
    expect(roads[0].polygon[0][0]).toBeCloseTo(9.986, 2);
  });
  it('uses all project roads and buildings, and refuses oversized queries instead of cropping the view', () => {
    const doc = buildSampleCube();
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]]));
    const bbox = projectRoadResetExtent(doc), building = extractFootprints(doc)[0].polygon[0];
    expect(bbox[0]).toBeLessThan(building[0]); expect(bbox[2]).toBeGreaterThan(4.401);
    expect(() => checkProjectRoadResetExtent([9.9, 53.5, 10.2, 53.8])).toThrow(/25 km²/);
    expect(() => checkProjectRoadResetExtent([9.99, 53.54, 10, 53.55])).not.toThrow();
  });
  it('rejects an empty replacement or an ID collision without changing anything', () => {
    const doc = buildSampleCube(), before = JSON.stringify(doc);
    expect(() => prepareProjectRoadReplacement(doc, { ...doc, CityObjects: {} }, 'test')).toThrow(/non-empty/);
    const roads = buildSampleCube(); roads.CityObjects = {};
    insertRoadIntoCityJson(roads, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]]), { id: Object.keys(doc.CityObjects)[0] });
    expect(() => prepareProjectRoadReplacement(doc, roads, 'test')).toThrow(/conflicts/);
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('keeps parked draft signatures stable across vertex compaction and detects actual changes', () => {
    const doc = buildSampleCube(); doc.vertices.push([0, 0, 0]);
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]]), { id: 'road' });
    const signature = roadDraftSource(doc, ['road']);
    compactVertices(doc); expect(roadDraftSource(doc, ['road'])).toBe(signature);
    doc.CityObjects.road.attributes!.name = 'changed'; expect(roadDraftSource(doc, ['road'])).not.toBe(signature);
  });
});
