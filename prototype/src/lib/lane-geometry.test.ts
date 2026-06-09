import { describe, expect, it } from 'vitest';
import { createManualRoadDraft } from './transportation';
import {
  buildLaneGeometryFromDrafts,
  buildLaneGeometryFromOsmXml,
} from './lane-geometry';

const simpleOsm = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="53.55000" lon="9.99000" />
  <node id="2" lat="53.55000" lon="9.99100" />
  <way id="42">
    <nd ref="1" />
    <nd ref="2" />
    <tag k="highway" v="residential" />
    <tag k="lanes" v="2" />
    <tag k="sidewalk" v="both" />
    <tag k="maxspeed" v="30" />
  </way>
</osm>`;

describe('TypeScript lane geometry fallback', () => {
  it('builds lane polygons and markings from OSM XML', () => {
    const result = buildLaneGeometryFromOsmXml(simpleOsm);

    expect(result.lanes.type).toBe('FeatureCollection');
    expect(result.lanes.features).toHaveLength(4);
    expect(result.laneMarkings.features).toHaveLength(3);
    expect(result.intersectionMarkings.features).toHaveLength(0);
    expect(result.warnings).toEqual([]);
    expect(result.lanes.features.map((feature) => feature.properties.lane_type)).toEqual([
      'sidewalk',
      'car_lane',
      'car_lane',
      'sidewalk',
    ]);
  });

  it('keeps polygon rings closed and labeled for map rendering', () => {
    const draft = createManualRoadDraft(
      [
        [9.99, 53.55],
        [9.991, 53.55],
      ],
      { maxspeedKmh: 30 }
    );

    const result = buildLaneGeometryFromDrafts([draft], ['manual-test']);
    const firstLane = result.lanes.features[0];

    expect(firstLane.properties.source).toBe('ts-lane-geometry');
    expect(firstLane.properties.road_id).toBe('manual-test');
    expect(firstLane.geometry.type).toBe('Polygon');
    if (firstLane.geometry.type !== 'Polygon') throw new Error('expected polygon');
    const ring = firstLane.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.length).toBeGreaterThanOrEqual(5);
  });

  it('returns warnings instead of throwing when fallback geometry cannot be built', () => {
    const draft = createManualRoadDraft(
      [
        [9.99, 53.55],
        [9.991, 53.55],
      ],
      { maxspeedKmh: 30 }
    );
    draft.sections[0].bands[0].widthM = 0;

    const result = buildLaneGeometryFromDrafts([draft], ['bad-road']);

    expect(result.lanes.features).toHaveLength(0);
    expect(result.warnings.join('\n')).toMatch(/invalid width/);
  });
});
