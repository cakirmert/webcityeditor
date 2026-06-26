import { describe, expect, it } from 'vitest';
import {
  osm2streetsIntersectionFillColor,
  osm2streetsIntersectionMarkingFillColor,
  osm2streetsLaneFillColor,
  osm2streetsLaneMarkingFillColor,
  roadBandFillColor,
} from '../../src/lib/osm2streets-style';

describe('osm2streets style helpers', () => {
  it('maps osm2streets lane enum names to semantic colors', () => {
    expect(osm2streetsLaneFillColor('Driving')).toEqual([55, 56, 62, 240]);
    expect(osm2streetsLaneFillColor('Biking')).toEqual([18, 136, 74, 215]);
    expect(osm2streetsLaneFillColor('Sidewalk')).toEqual([184, 188, 196, 210]);
    expect(osm2streetsLaneFillColor('Shoulder')).toEqual([184, 188, 196, 210]);
    expect(osm2streetsLaneFillColor('Footway')).toEqual([204, 207, 214, 205]);
    expect(osm2streetsLaneFillColor('SharedUse')).toEqual([144, 154, 82, 210]);
    expect(osm2streetsLaneFillColor('Bus')).toEqual([172, 58, 58, 220]);
    expect(osm2streetsLaneFillColor('LightRail')).toEqual([128, 86, 52, 220]);
    expect(osm2streetsLaneFillColor('Construction')).toEqual([218, 132, 52, 215]);
  });

  it('maps parking and buffer lane variants without falling through to fallback', () => {
    expect(osm2streetsLaneFillColor('Parking(Parallel)')).toEqual([104, 107, 114, 225]);
    expect(osm2streetsLaneFillColor('Parking(Diagonal)')).toEqual([104, 107, 114, 225]);
    expect(osm2streetsLaneFillColor('Parking(Perpendicular)')).toEqual([
      104, 107, 114, 225,
    ]);
    expect(osm2streetsLaneFillColor('Buffer(Curb)')).toEqual([242, 244, 248, 210]);
    expect(osm2streetsLaneFillColor('Buffer(Planters)')).toEqual([72, 82, 76, 220]);
  });

  it('keeps RoadDraft and inserted CityJSON road bands visually aligned with lanes', () => {
    expect(roadBandFillColor('car_lane')).toEqual(osm2streetsLaneFillColor('Driving'));
    expect(roadBandFillColor('driving_lane')).toEqual(osm2streetsLaneFillColor('Driving'));
    expect(roadBandFillColor('bike_lane')).toEqual(osm2streetsLaneFillColor('Biking'));
    expect(roadBandFillColor('sidewalk')).toEqual(osm2streetsLaneFillColor('Sidewalk'));
    expect(roadBandFillColor('parking_lane')).toEqual(
      osm2streetsLaneFillColor('Parking(Parallel)')
    );
  });

  it('styles intersection polygons by osm2streets intersection kind', () => {
    expect(osm2streetsIntersectionFillColor('Intersection')).toEqual([74, 76, 84, 184]);
    expect(osm2streetsIntersectionFillColor('Connection')).toEqual([83, 88, 96, 172]);
    expect(osm2streetsIntersectionFillColor('Fork')).toEqual([86, 94, 105, 172]);
    expect(osm2streetsIntersectionFillColor('Terminus')).toEqual([100, 91, 72, 166]);
    expect(osm2streetsIntersectionFillColor('MapEdge')).toEqual([80, 84, 92, 132]);
  });

  it('renders lane and intersection markings as filled semantic polygons', () => {
    expect(osm2streetsLaneMarkingFillColor('center line')).toEqual([246, 203, 78, 235]);
    expect(osm2streetsLaneMarkingFillColor('lane separator')).toEqual([
      248, 250, 252, 232,
    ]);
    expect(osm2streetsLaneMarkingFillColor('bike stop line')).toEqual([64, 178, 103, 232]);
    expect(osm2streetsLaneMarkingFillColor('path outline')).toEqual([22, 24, 28, 225]);

    expect(osm2streetsIntersectionMarkingFillColor('sidewalk corner')).toEqual([
      184, 188, 196, 210,
    ]);
    expect(osm2streetsIntersectionMarkingFillColor('marked crossing line')).toEqual([
      248, 250, 252, 232,
    ]);
    expect(osm2streetsIntersectionMarkingFillColor('unmarked crossing outline')).toEqual([
      248, 250, 252, 185,
    ]);
  });
});
