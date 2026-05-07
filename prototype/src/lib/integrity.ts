import type { CityJsonDocument, CityObject } from '../types';

export type IntegritySeverity = 'error' | 'warning' | 'info';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  /** Short, machine-readable code (e.g. 'vertex-index-out-of-range'). */
  code: string;
  /** One-line human-readable description suitable for direct UI display. */
  message: string;
  /** Optional location info — CityObject id, geometry index, etc. */
  location?: {
    objectId?: string;
    geometryIndex?: number;
    faceIndex?: number;
    vertexIndex?: number;
  };
}

export interface IntegrityReport {
  /** True iff there are zero `error`-severity issues. Warnings/info don't
   *  block — they're advisory (e.g. orphaned vertices after regeneration). */
  ok: boolean;
  issues: IntegrityIssue[];
  counts: { error: number; warning: number; info: number };
  /** Summary counts of what was scanned. */
  summary: {
    cityObjects: number;
    vertices: number;
    referencedVertices: number;
    orphanedVertices: number;
  };
}

/**
 * Walk a CityJsonDocument and report every structural inconsistency we can
 * find without a network call. Designed for "light schema validation" — fast,
 * deterministic, focused on the kinds of damage that actually break our
 * downstream tools (vertex-index bounds, semantics-index bounds, parent/
 * child reference loops, orphaned vertices, missing transforms).
 *
 * For full CityJSON 2.0 spec validation, use `cjio validate` server-side.
 * This is the in-browser equivalent that catches what matters for the
 * editor's interactive workflow.
 */
export function checkIntegrity(doc: CityJsonDocument): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  const referenced = new Set<number>();

  // ── Top-level shape ──────────────────────────────────────────────────────
  if (doc.type !== 'CityJSON') {
    issues.push({
      severity: 'error',
      code: 'wrong-type',
      message: `Document type is "${String(doc.type)}", expected "CityJSON"`,
    });
  }
  if (typeof doc.version !== 'string') {
    issues.push({
      severity: 'error',
      code: 'missing-version',
      message: 'Missing or non-string `version` field',
    });
  } else if (!/^[12]\./.test(doc.version)) {
    issues.push({
      severity: 'warning',
      code: 'unusual-version',
      message: `CityJSON version "${doc.version}" is unusual — supported are 1.x and 2.x`,
    });
  }
  if (!doc.transform) {
    issues.push({
      severity: 'warning',
      code: 'missing-transform',
      message:
        'No `transform` block — vertices are assumed to be in absolute coords. ' +
        'Most CityJSON 2.0 files use integer encoding via transform.',
    });
  } else {
    if (!Array.isArray(doc.transform.scale) || doc.transform.scale.length !== 3) {
      issues.push({
        severity: 'error',
        code: 'invalid-transform',
        message: '`transform.scale` must be a 3-element array of numbers',
      });
    }
    if (!Array.isArray(doc.transform.translate) || doc.transform.translate.length !== 3) {
      issues.push({
        severity: 'error',
        code: 'invalid-transform',
        message: '`transform.translate` must be a 3-element array of numbers',
      });
    }
  }
  if (!doc.metadata?.referenceSystem) {
    issues.push({
      severity: 'info',
      code: 'no-crs',
      message:
        'No `metadata.referenceSystem` declared — CRS will be inferred from coord magnitudes ' +
        'on load, which is best-effort.',
    });
  }

  // ── Vertices ─────────────────────────────────────────────────────────────
  if (!Array.isArray(doc.vertices)) {
    issues.push({
      severity: 'error',
      code: 'missing-vertices',
      message: '`vertices` must be an array',
    });
  } else {
    for (let i = 0; i < doc.vertices.length; i++) {
      const v = doc.vertices[i];
      if (
        !Array.isArray(v) ||
        v.length !== 3 ||
        !Number.isFinite(v[0]) ||
        !Number.isFinite(v[1]) ||
        !Number.isFinite(v[2])
      ) {
        issues.push({
          severity: 'error',
          code: 'invalid-vertex',
          message: `vertices[${i}] is not a valid [x, y, z] number triple`,
          location: { vertexIndex: i },
        });
      }
    }
  }

  // ── CityObjects ──────────────────────────────────────────────────────────
  const ids = Object.keys(doc.CityObjects);
  const idSet = new Set(ids);
  for (const id of ids) {
    const obj = doc.CityObjects[id];
    if (!obj || typeof obj.type !== 'string') {
      issues.push({
        severity: 'error',
        code: 'invalid-cityobject',
        message: `CityObject "${id}" has no "type" field`,
        location: { objectId: id },
      });
      continue;
    }

    // Parent / child cross-references
    if (obj.parents) {
      for (const p of obj.parents) {
        if (!idSet.has(p)) {
          issues.push({
            severity: 'error',
            code: 'dangling-parent',
            message: `CityObject "${id}" references missing parent "${p}"`,
            location: { objectId: id },
          });
        } else {
          // Parent should list this id as a child (best-effort symmetry check)
          const parent = doc.CityObjects[p];
          if (!parent.children || !parent.children.includes(id)) {
            issues.push({
              severity: 'warning',
              code: 'asymmetric-parent-link',
              message: `CityObject "${id}" lists "${p}" as parent, but "${p}" doesn't list "${id}" as child`,
              location: { objectId: id },
            });
          }
        }
      }
    }
    if (obj.children) {
      for (const c of obj.children) {
        if (!idSet.has(c)) {
          issues.push({
            severity: 'error',
            code: 'dangling-child',
            message: `CityObject "${id}" references missing child "${c}"`,
            location: { objectId: id },
          });
        }
      }
    }

    // Geometry validity
    if (Array.isArray(obj.geometry)) {
      for (let g = 0; g < obj.geometry.length; g++) {
        validateGeometry(obj, id, g, doc.vertices.length, referenced, issues);
      }
    }
  }

  // ── Orphaned vertices (referenced.size < vertices.length) ─────────────────
  const totalVerts = Array.isArray(doc.vertices) ? doc.vertices.length : 0;
  const orphans = totalVerts - referenced.size;
  if (orphans > 0) {
    const pct = ((orphans / totalVerts) * 100).toFixed(1);
    issues.push({
      severity: orphans > totalVerts * 0.1 ? 'warning' : 'info',
      code: 'orphaned-vertices',
      message:
        `${orphans} of ${totalVerts} vertices (${pct}%) are not referenced by any geometry. ` +
        'Often the result of in-place edits like footprint regeneration; safe to ignore, ' +
        'or re-export to compact.',
    });
  }

  const counts = {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
  return {
    ok: counts.error === 0,
    issues,
    counts,
    summary: {
      cityObjects: ids.length,
      vertices: totalVerts,
      referencedVertices: referenced.size,
      orphanedVertices: orphans,
    },
  };
}

/** Walk one geometry — Solid / MultiSurface / CompositeSurface — and report
 *  vertex-index bounds + semantics-index bounds. */
function validateGeometry(
  obj: CityObject,
  objectId: string,
  geometryIndex: number,
  vertexCount: number,
  referenced: Set<number>,
  issues: IntegrityIssue[]
): void {
  const g = (obj.geometry as Array<{
    type?: string;
    boundaries?: unknown;
    semantics?: { surfaces?: Array<{ type?: string }>; values?: unknown };
    lod?: string | number;
  }>)[geometryIndex];
  if (!g) return;
  if (!g.type) {
    issues.push({
      severity: 'error',
      code: 'geometry-missing-type',
      message: `${objectId}.geometry[${geometryIndex}] has no "type" field`,
      location: { objectId, geometryIndex },
    });
    return;
  }
  if (!g.boundaries) return;

  // Walk every leaf integer in `boundaries` and check it's in [0, vertexCount).
  let faceIdx = 0;
  let outOfRange = 0;
  const walk = (node: unknown, depth: number) => {
    if (typeof node === 'number') {
      if (node < 0 || node >= vertexCount) {
        outOfRange++;
        if (outOfRange <= 3) {
          issues.push({
            severity: 'error',
            code: 'vertex-index-out-of-range',
            message: `${objectId}.geometry[${geometryIndex}] references vertex ${node}, outside [0, ${vertexCount})`,
            location: { objectId, geometryIndex, faceIndex: faceIdx, vertexIndex: node },
          });
        }
        return;
      }
      referenced.add(node);
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1);
    }
  };

  // For Solid: shells[shell[face[ring[idx]]]] (4-deep). For MultiSurface:
  // faces[ring[idx]] (3-deep). The depth doesn't matter for index validation,
  // but we'll track face count for semantics validation below.
  const isSolid =
    Array.isArray(g.boundaries) &&
    Array.isArray((g.boundaries as unknown[])[0]) &&
    Array.isArray(((g.boundaries as unknown[][])[0] as unknown[])[0]) &&
    Array.isArray((((g.boundaries as unknown[][])[0] as unknown[][])[0] as unknown[])[0]);

  walk(g.boundaries, 0);

  if (outOfRange > 3) {
    issues.push({
      severity: 'error',
      code: 'vertex-index-out-of-range',
      message: `… and ${outOfRange - 3} more vertex-index issues in ${objectId}.geometry[${geometryIndex}]`,
      location: { objectId, geometryIndex },
    });
  }

  // Semantics-index validity
  if (g.semantics) {
    const surfaces = g.semantics.surfaces;
    if (!Array.isArray(surfaces)) {
      issues.push({
        severity: 'error',
        code: 'invalid-semantics',
        message: `${objectId}.geometry[${geometryIndex}].semantics.surfaces must be an array`,
        location: { objectId, geometryIndex },
      });
    } else {
      const surfaceCount = surfaces.length;
      const checkValue = (val: unknown) => {
        if (val === null) return;
        if (typeof val !== 'number') return;
        if (val < 0 || val >= surfaceCount) {
          issues.push({
            severity: 'error',
            code: 'semantics-index-out-of-range',
            message: `${objectId}.geometry[${geometryIndex}].semantics.values references surface ${val}, outside [0, ${surfaceCount})`,
            location: { objectId, geometryIndex },
          });
        }
      };
      const walkSem = (node: unknown) => {
        if (typeof node === 'number' || node === null) checkValue(node);
        else if (Array.isArray(node)) for (const c of node) walkSem(c);
      };
      walkSem(g.semantics.values);

      // Face count must match. For Solid: values[shell[face]] should match
      // boundaries[shell[face[ring]]] face counts.
      if (isSolid && Array.isArray(g.semantics.values)) {
        const shells = g.boundaries as unknown[][][][];
        const semShells = g.semantics.values as number[][];
        if (shells.length !== semShells.length) {
          issues.push({
            severity: 'error',
            code: 'semantics-shell-mismatch',
            message: `${objectId}.geometry[${geometryIndex}]: semantics.values has ${semShells.length} shells, boundaries has ${shells.length}`,
            location: { objectId, geometryIndex },
          });
        } else {
          for (let s = 0; s < shells.length; s++) {
            if (shells[s].length !== (semShells[s]?.length ?? 0)) {
              issues.push({
                severity: 'error',
                code: 'semantics-face-mismatch',
                message: `${objectId}.geometry[${geometryIndex}].shell[${s}]: semantics has ${
                  semShells[s]?.length ?? 0
                } face entries, boundaries has ${shells[s].length}`,
                location: { objectId, geometryIndex },
              });
            }
          }
        }
      }
    }
  }

  faceIdx++;
}
