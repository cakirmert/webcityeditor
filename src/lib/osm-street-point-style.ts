import type { OsmPointFeature } from './transportation';

export interface OsmStreetPointIcon {
  url: string;
  width: number;
  height: number;
  anchorY: number;
  mask: false;
}

const ICON_SIZE = 48;

function svgIcon(svg: string): OsmStreetPointIcon {
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: ICON_SIZE,
    height: ICON_SIZE,
    anchorY: ICON_SIZE / 2,
    mask: false,
  };
}

const YIELD_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M24 42 4 7h40Z" fill="#fff" stroke="#d92929" stroke-width="6" stroke-linejoin="round"/></svg>'
);

const STOP_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="m15 3 18 0 12 12 0 18-12 12-18 0L3 33V15Z" fill="#d92929" stroke="#fff" stroke-width="2"/><path d="M12 21h24v6H12Z" fill="#fff"/></svg>'
);

const GENERIC_SIGN_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#fff" stroke="#d92929" stroke-width="6"/><circle cx="24" cy="24" r="5" fill="#347de8"/></svg>'
);

/**
 * Returns a small inline SVG sprite for the best-known sign in an OSM
 * `traffic_sign` value. German sign ids are common in the Hamburg demo; all
 * unknown or combined values retain a visible generic sign rather than
 * disappearing from the context layer.
 */
export function osmTrafficSignIcon(feature: OsmPointFeature): OsmStreetPointIcon {
  const signIds = (feature.tags.traffic_sign ?? '')
    .toUpperCase()
    .split(/[;,]/)
    .map((value) => value.trim());

  if (signIds.some((value) => value === 'DE:205' || value.endsWith(':205'))) {
    return YIELD_ICON;
  }
  if (signIds.some((value) => value === 'DE:206' || value.endsWith(':206'))) {
    return STOP_ICON;
  }
  return GENERIC_SIGN_ICON;
}
