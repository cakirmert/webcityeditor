import { describe, expect, it } from 'vitest';
import { osmTrafficSignIcon } from '../../src/lib/osm-street-point-style';
import type { OsmPointFeature } from '../../src/lib/transportation';

function sign(value: string): OsmPointFeature {
  return {
    id: 'osm-node-1',
    osmNodeId: '1',
    kind: 'traffic_sign',
    position: [9.99, 53.55],
    tags: { traffic_sign: value },
  };
}

describe('OSM street-point styles', () => {
  it('uses distinct inline sprites for yield, stop, and unknown signs', () => {
    const yieldIcon = osmTrafficSignIcon(sign('DE:205'));
    const stopIcon = osmTrafficSignIcon(sign('DE:206'));
    const genericIcon = osmTrafficSignIcon(sign('DE:250'));

    expect(yieldIcon.url).toMatch(/^data:image\/svg\+xml/);
    expect(stopIcon.url).toMatch(/^data:image\/svg\+xml/);
    expect(genericIcon.url).toMatch(/^data:image\/svg\+xml/);
    expect(new Set([yieldIcon.url, stopIcon.url, genericIcon.url])).toHaveLength(3);
    expect(yieldIcon).toMatchObject({ width: 48, height: 48, anchorY: 24, mask: false });
  });

  it('recognizes sign ids inside combined and country-prefixed values', () => {
    expect(osmTrafficSignIcon(sign('DE:1000;DE:205'))).toBe(
      osmTrafficSignIcon(sign('AT:205'))
    );
    expect(osmTrafficSignIcon(sign('DE:1000,DE:206'))).toBe(
      osmTrafficSignIcon(sign('AT:206'))
    );
  });
});
