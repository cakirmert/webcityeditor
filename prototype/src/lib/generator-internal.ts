/**
 * Internal types shared between the parametric generator and helpers (openings,
 * future LoD 2.2 eave overhang). Not exported through the public API surface.
 */

/** A rectangular wall face's metadata, used by the openings pass. */
export interface RectangularWall {
  /** Index in the parent geometry's `shell` array where this wall lives. */
  shellIndex: number;
  /** Global vertex indices of the 4 corners, in CCW order from outside.
   *  Order: [groundI, groundJ, eaveJ, eaveI]. */
  globalCorners: [number, number, number, number];
  /** Same 4 corners as 3D positions in the projected CRS (metres).
   *  Used by openings.ts to compute window/door placements without re-deriving
   *  from vertex indices. */
  corners3D: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
}

/** Output of one of the `buildXxx` roof builders. */
export interface BuildOut {
  /** New vertices to append to `doc.vertices` (integer-encoded per transform). */
  newVertices: [number, number, number][];
  /** One face per entry: each face is [outerRing, hole1, hole2, …]. */
  shell: number[][][];
  /** Semantic surface index per face (0=ground, 1=roof, 2=wall by default). */
  semanticsValues: number[];
  /** Subset of faces that are 4-corner rectangular walls (eligible for
   *  window/door openings). Pentagonal gable-end walls are excluded. */
  walls: RectangularWall[];
}
