import { describe, expect, it } from 'vitest';
import { parseRoadCorridorGeoJson } from '../../src/lib/road-corridor';

describe('parseRoadCorridorGeoJson', () => {
  it('reads and closes a named Polygon feature', () => {
    const corridors = parseRoadCorridorGeoJson({
      type: 'Feature',
      id: 'approved-1',
      properties: { name: 'Approved road reserve' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9.99, 53.54], [10.01, 53.54], [10.01, 53.55]]],
      },
    });

    expect(corridors).toEqual([
      {
        id: 'approved-1',
        label: 'Approved road reserve',
        polygon: [[9.99, 53.54], [10.01, 53.54], [10.01, 53.55], [9.99, 53.54]],
      },
    ]);
  });

  it('expands MultiPolygon parts into independently validated corridors', () => {
    const corridors = parseRoadCorridorGeoJson({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { id: 'reserve' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[10, 53], [10.01, 53], [10.01, 53.01], [10, 53]]],
            [[[10.02, 53], [10.03, 53], [10.03, 53.01], [10.02, 53]]],
          ],
        },
      }],
    });

    expect(corridors.map((corridor) => corridor.id)).toEqual(['reserve-1', 'reserve-2']);
  });

  it('rejects non-polygon and non-WGS84 corridor input', () => {
    expect(() => parseRoadCorridorGeoJson({ type: 'Point', coordinates: [10, 53] }))
      .toThrow('Polygon or MultiPolygon');
    expect(() => parseRoadCorridorGeoJson({
      type: 'Polygon',
      coordinates: [[[565000, 5934000], [565010, 5934000], [565010, 5934010]]],
    })).toThrow('WGS84');
  });
});
