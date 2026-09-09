import { describe, expect, it } from 'vitest';
import { validateRoadFit } from '../../src/lib/road-fit';
import { projectToWgs84 } from '../../src/lib/projection';
import type { RoadArea } from '../../src/lib/transportation';

function road(id: string, x: number, y: number, w: number, h: number): RoadArea {
  return { id: `${id}-surface`, roadId: id, sectionId: 'section-1', bandId: 'car', surfaceIndex: 0,
    surfaceType: 'TrafficArea', function: 'driving_lane', attributes: { roadName: id },
    polygon: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([east, north]) => projectToWgs84('EPSG:25832', { x: 565000 + east, y: 5935000 + north, z: 0 })) };
}
const check = (roadAreas: RoadArea[], existingRoadAreas: RoadArea[]) => validateRoadFit({ roadAreas, existingRoadAreas, metricCrs: 'EPSG:25832' });

describe('road encroachment', () => {
  it('blocks widening into a neighbouring road and reports the actual overlap area', () => {
    const before = road('edited', 0, 0, 20, 3), peer = road('Neighbour street', 0, 5, 20, 3);
    expect(check([road('edited', 0, 0, 20, 6)], [before, peer])).toEqual([expect.objectContaining({ kind: 'road_overlap', severity: 'error', affectedId: 'Neighbour street', overlapAreaM2: expect.closeTo(20, 3) })]);
  });
  it('blocks an unconstructed crossing even when metadata says the roads are connected', () => {
    const a = road('a', 0, 0, 20, 4), b = road('b', 8, -10, 4, 24);
    a.attributes.connectedCityRoadIds = ['b'];
    expect(check([a], [b]).some((issue) => issue.kind === 'road_overlap')).toBe(true);
  });
  it('checks roads changed together, while allowing a trimmed junction with shared edges', () => {
    expect(check([road('a', 0, 0, 20, 4), road('b', 8, -10, 4, 24)], [])).toHaveLength(1);
    expect(check([road('west', -20, 0, 20, 4), road('junction', 0, 0, 4, 4), road('east', 4, 0, 20, 4)], [])).toEqual([]);
  });
  it('retains pre-existing source overlap but blocks enlargement or relocation of it', () => {
    const a = road('a', 0, 0, 20, 4), b = road('b', 10, 3, 20, 4);
    expect(check([{ ...a, id: 'renumbered-surface' }], [a, b])).toEqual([]);
    expect(check([road('a', 0, 0, 20, 5)], [a, b])[0]?.overlapAreaM2).toBeCloseTo(10, 3);
    expect(check([road('a', 0, 1, 20, 4)], [a, b])[0]?.overlapAreaM2).toBeCloseTo(10, 3);
  });
  it('respects holes but blocks pavement extending across their kerbs', () => {
    const ring = road('junction', 0, 0, 20, 20); ring.holes = [road('hole', 5, 5, 10, 10).polygon];
    expect(check([road('island-path', 6, 6, 8, 8)], [ring])).toEqual([]);
    expect(check([road('island-path', 4, 6, 8, 8)], [ring])[0]?.overlapAreaM2).toBeCloseTo(8, 3);
  });
  it('does not block an unchanged approach tree, but blocks converting sidewalk around a tree into traffic', () => {
    const saved = road('approach', 0, 0, 20, 4), treeRoad = road('tree-position', 10, 2, 1, 1);
    const tree = { id: 'tree', position: [...treeRoad.polygon[0], 0] as [number, number, number], trunkRadius: .2 };
    expect(validateRoadFit({ roadAreas: [saved], existingRoadAreas: [saved], trees: [tree], metricCrs: 'EPSG:25832' })).toEqual([]);
    const sidewalk = { ...saved, function: 'sidewalk', attributes: { transportationUsage: 'sidewalk' } };
    expect(validateRoadFit({ roadAreas: [saved], existingRoadAreas: [sidewalk], trees: [tree], metricCrs: 'EPSG:25832' })).toEqual([expect.objectContaining({ kind: 'tree_overlap', severity: 'error' })]);
  });
  it('allows documented grade separation and requests elevations for an uncertain crossing', () => {
    const surface = road('surface', 0, 0, 20, 4), bridge = road('bridge', 8, -10, 4, 24);
    surface.vertical = { placement: 'surface', source: 'user', elevationM: 0 };
    bridge.vertical = { placement: 'elevated', source: 'user', elevationM: 7 };
    expect(check([bridge], [surface])).toEqual([]);
    delete bridge.vertical.elevationM;
    expect(check([bridge], [surface])).toEqual([expect.objectContaining({ kind: 'vertical_uncertainty', severity: 'warning' })]);
    bridge.vertical = { placement: 'surface', source: 'user', elevationM: 0 };
    expect(check([bridge], [surface])[0]?.severity).toBe('error');
  });
});
