import type { Rgba } from './osm2streets-style';

/**
 * Connection overlays use a bright cyan stroke over a near-black navy halo.
 * Cyan stays distinct from red road surfaces and neutral junctions; the halo
 * preserves the edge over pale maps and blue road fills.
 */
export const ROAD_CONNECTION_HALO: Rgba = [4, 18, 30, 242];
export const ROAD_CONNECTION_CYAN: Rgba = [45, 240, 210, 255];
export const ROAD_CONNECTION_ACTIVE: Rgba = [238, 254, 255, 255];
