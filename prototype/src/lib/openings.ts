/**
 * Procedural windows + door placement on rectangular wall faces.
 *
 * Adds CityJSON 2.0 `Window` and `Door` semantic surfaces to a generated
 * building. Each opening is represented as:
 *   - An inner ring (hole) added to the parent wall's outer face, so the wall
 *     mesh has a literal hole where the opening sits.
 *   - A separate co-planar face at the same position with `Window` or `Door`
 *     semantics, filling the hole.
 *
 * This matches how cityjson-threejs-loader and most CityJSON viewers handle
 * openings: the hole keeps the wall geometry watertight semantically, and the
 * opening face can be tinted differently in the renderer.
 *
 * Geometry-wise, all walls in the parametric generator are vertical, so window
 * and door corners are computed from a 2D (u, v) parameterisation along the
 * wall's ground edge × vertical axis.
 */
import type { BuildOut, RectangularWall } from './generator-internal';

export interface OpeningsConfig {
  /** Add evenly-spaced windows on each rectangular wall, per storey. */
  windows: boolean;
  /** Add one ground-floor door on the first rectangular wall. */
  door: boolean;
  /** Number of storeys above ground (used to space windows vertically). */
  storeys: number;
  /** Ground-level Z (in projected CRS metres). */
  baseZ: number;
  /** Wall-top Z = baseZ + eaveHeight (the height the wall meets the roof). */
  eaveZ: number;
}

export interface OpeningsResult {
  /** Extra surface entries to append to the geometry's `semantics.surfaces`. */
  extraSurfaces: Array<{ type: string }>;
  /** Index in the new combined surfaces array for Window (or -1 if no windows). */
  windowSurfaceIdx: number;
  /** Index in the new combined surfaces array for Door (or -1 if no door). */
  doorSurfaceIdx: number;
  /** Number of opening faces added (for caller's bookkeeping). */
  openingFacesAdded: number;
}

/** Window dimensions and placement parameters. */
const WINDOW_WIDTH = 1.4; // metres
const WINDOW_SILL = 0.9; // metres above floor
const WINDOW_HEIGHT = 1.5; // metres
const WINDOW_MIN_SIDE_MARGIN = 0.4; // metres from wall edge to nearest window edge
const WINDOW_TARGET_SPACING = 3.0; // metres between window centres (target)

/** Door dimensions and placement parameters. */
const DOOR_WIDTH = 1.0;
const DOOR_HEIGHT = 2.1;

/**
 * Mutate `out.shell` and `out.semanticsValues` to add openings on every
 * rectangular wall. Appends new vertices to `vertexSink` (caller's
 * `newVertices` array) and uses `toGlobal` to translate local indices.
 *
 * Returns metadata so the caller can update `surfaces` and the LoD label.
 */
export function applyOpenings(
  out: BuildOut,
  cfg: OpeningsConfig,
  vertexSink: [number, number, number][],
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): OpeningsResult {
  if (!cfg.windows && !cfg.door) {
    return { extraSurfaces: [], windowSurfaceIdx: -1, doorSurfaceIdx: -1, openingFacesAdded: 0 };
  }

  const baseSurfaceCount = 3; // ground=0, roof=1, wall=2 (existing layout)
  const extraSurfaces: Array<{ type: string }> = [];
  let windowSurfaceIdx = -1;
  let doorSurfaceIdx = -1;
  if (cfg.windows) {
    windowSurfaceIdx = baseSurfaceCount + extraSurfaces.length;
    extraSurfaces.push({ type: 'Window' });
  }
  if (cfg.door) {
    doorSurfaceIdx = baseSurfaceCount + extraSurfaces.length;
    extraSurfaces.push({ type: 'Door' });
  }

  const wallHeight = cfg.eaveZ - cfg.baseZ;
  const storeyHeight = wallHeight / Math.max(1, cfg.storeys);

  let openingFacesAdded = 0;
  let doorPlaced = false;

  for (const wall of out.walls) {
    const skipGroundStoreyWindows = cfg.door && !doorPlaced;

    if (cfg.windows) {
      const winFaces = placeWindowsOnWall(
        wall,
        cfg,
        storeyHeight,
        skipGroundStoreyWindows,
        vertexSink,
        toInt,
        toGlobal
      );
      // Append window holes to the wall outer ring; append window faces to shell.
      for (const wf of winFaces) {
        out.shell[wall.shellIndex].push(wf.holeRing);
        out.shell.push([wf.outerRing]);
        out.semanticsValues.push(windowSurfaceIdx);
        openingFacesAdded++;
      }
    }

    if (cfg.door && !doorPlaced) {
      const door = placeDoorOnWall(wall, cfg, vertexSink, toInt, toGlobal);
      if (door) {
        out.shell[wall.shellIndex].push(door.holeRing);
        out.shell.push([door.outerRing]);
        out.semanticsValues.push(doorSurfaceIdx);
        openingFacesAdded++;
        doorPlaced = true;
      }
    }
  }

  return { extraSurfaces, windowSurfaceIdx, doorSurfaceIdx, openingFacesAdded };
}

interface OpeningRings {
  /** CW from outside — the inner ring (hole) added to the parent wall face. */
  holeRing: number[];
  /** CCW from outside — the standalone Window/Door face filling the hole. */
  outerRing: number[];
}

/**
 * Place windows along one rectangular wall, per storey.
 *
 * Wall corners arrive as:
 *   corners3D[0] = ground at footprint vertex i  (3D)
 *   corners3D[1] = ground at footprint vertex j  (3D)
 *   corners3D[2] = eave at footprint vertex j
 *   corners3D[3] = eave at footprint vertex i
 *
 * Windows are placed in (u, v) wall-local coords with u running along the
 * ground edge i→j and v running upward. We compute 4 new vertex positions in
 * 3D for each window's corners, register them with the caller's vertex sink,
 * and emit two rings: a CW hole ring inside the wall, and a CCW outer ring
 * for the Window face that fills it.
 */
function placeWindowsOnWall(
  wall: RectangularWall,
  cfg: OpeningsConfig,
  storeyHeight: number,
  skipGroundStorey: boolean,
  vertexSink: [number, number, number][],
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): OpeningRings[] {
  const [g0, g1] = wall.corners3D; // ground corners (i, j)
  const dx = g1[0] - g0[0];
  const dy = g1[1] - g0[1];
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < WINDOW_WIDTH + 2 * WINDOW_MIN_SIDE_MARGIN) return [];

  // Number of windows per storey: aim for ~WINDOW_TARGET_SPACING centre-to-centre,
  // capped by what fits with minimum side margins.
  const usableLen = wallLen - 2 * WINDOW_MIN_SIDE_MARGIN;
  const maxByFit = Math.floor((usableLen + (WINDOW_TARGET_SPACING - WINDOW_WIDTH)) / WINDOW_TARGET_SPACING);
  const targetCount = Math.max(1, Math.min(maxByFit, Math.round(wallLen / WINDOW_TARGET_SPACING)));
  if (targetCount < 1) return [];

  const result: OpeningRings[] = [];
  const ux = dx / wallLen;
  const uy = dy / wallLen;

  for (let storey = 0; storey < cfg.storeys; storey++) {
    if (storey === 0 && skipGroundStorey) continue;
    const floorZ = cfg.baseZ + storey * storeyHeight;
    const sillZ = floorZ + WINDOW_SILL;
    const topZ = sillZ + WINDOW_HEIGHT;
    // Don't pierce the eave: leave at least 0.3m below wall top.
    if (topZ > cfg.eaveZ - 0.3) continue;

    for (let w = 0; w < targetCount; w++) {
      const centreU = ((w + 0.5) / targetCount) * wallLen;
      const leftU = centreU - WINDOW_WIDTH / 2;
      const rightU = centreU + WINDOW_WIDTH / 2;

      // 4 window corners in 3D
      const cornerXY = (u: number): [number, number] => [g0[0] + ux * u, g0[1] + uy * u];
      const [blX, blY] = cornerXY(leftU);
      const [brX, brY] = cornerXY(rightU);

      // Local indices (start of the 4 just appended)
      const localStart = vertexSink.length;
      vertexSink.push(toInt(blX, blY, sillZ)); // BL
      vertexSink.push(toInt(brX, brY, sillZ)); // BR
      vertexSink.push(toInt(brX, brY, topZ)); // TR
      vertexSink.push(toInt(blX, blY, topZ)); // TL

      const BL = toGlobal(localStart);
      const BR = toGlobal(localStart + 1);
      const TR = toGlobal(localStart + 2);
      const TL = toGlobal(localStart + 3);

      // Hole ring: CW from outside (opposite of wall outer CCW)
      // Wall outer goes [g_i, g_j, e_j, e_i] CCW from outside, so a hole inside it
      // must traverse opposite direction: BL→TL→TR→BR.
      const holeRing = [BL, TL, TR, BR];
      // Outer (Window face) ring: CCW from outside, same orientation as wall.
      // Walking from BL toward BR, then up to TR, across to TL, down to BL.
      const outerRing = [BL, BR, TR, TL];
      result.push({ holeRing, outerRing });
    }
  }
  return result;
}

/**
 * Place a single ground-floor door on the given wall, centred horizontally.
 * Returns null if the wall is too narrow.
 */
function placeDoorOnWall(
  wall: RectangularWall,
  cfg: OpeningsConfig,
  vertexSink: [number, number, number][],
  toInt: (x: number, y: number, z: number) => [number, number, number],
  toGlobal: (local: number) => number
): OpeningRings | null {
  const [g0, g1] = wall.corners3D;
  const dx = g1[0] - g0[0];
  const dy = g1[1] - g0[1];
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < DOOR_WIDTH + 0.6) return null;
  const wallHeight = cfg.eaveZ - cfg.baseZ;
  const doorTopZ = cfg.baseZ + Math.min(DOOR_HEIGHT, wallHeight - 0.3);
  if (doorTopZ - cfg.baseZ < 1.8) return null; // wall too short for a real door

  const ux = dx / wallLen;
  const uy = dy / wallLen;
  const centreU = wallLen / 2;
  const leftU = centreU - DOOR_WIDTH / 2;
  const rightU = centreU + DOOR_WIDTH / 2;
  const cornerXY = (u: number): [number, number] => [g0[0] + ux * u, g0[1] + uy * u];
  const [blX, blY] = cornerXY(leftU);
  const [brX, brY] = cornerXY(rightU);

  const localStart = vertexSink.length;
  // Door bottom is at exactly baseZ (sits on the ground). Push slightly above
  // baseZ to avoid coplanar Z-fighting with the GroundSurface.
  const bottomZ = cfg.baseZ + 0.001;
  vertexSink.push(toInt(blX, blY, bottomZ));
  vertexSink.push(toInt(brX, brY, bottomZ));
  vertexSink.push(toInt(brX, brY, doorTopZ));
  vertexSink.push(toInt(blX, blY, doorTopZ));

  const BL = toGlobal(localStart);
  const BR = toGlobal(localStart + 1);
  const TR = toGlobal(localStart + 2);
  const TL = toGlobal(localStart + 3);

  return {
    holeRing: [BL, TL, TR, BR],
    outerRing: [BL, BR, TR, TL],
  };
}
