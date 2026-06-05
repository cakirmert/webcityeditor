import type { CityJsonDocument } from '../types';
import { compactVertices } from './compact';
import {
  generateBuilding,
  insertBuilding,
  type NewBuildingParams,
} from './generator';
import {
  splitBuildingByFloor,
  splitBuildingBySide,
  type SplitAxis,
} from './subdivision';
import { checkIntegrity, type IntegrityIssue, type IntegrityReport } from './integrity';
import { moveBuilding, rotateBuilding } from './transform';
import type { PendingTransform } from './transform-preview';

export interface EditorCreateSplit {
  mode: 'none' | 'floors' | 'sides';
  count: number;
  axis?: SplitAxis;
}

export interface EditorCreateResult {
  id: string;
  objectIds: string[];
}

export interface EditorTransformResult {
  changed: boolean;
  compactedVertices: number;
}

export class EditorMutationValidationError extends Error {
  readonly issues: IntegrityIssue[];

  constructor(action: string, issues: IntegrityIssue[]) {
    const first = issues[0]?.message ?? 'unknown structural integrity error';
    super(`${action} would make the CityJSON invalid: ${first}`);
    this.name = 'EditorMutationValidationError';
    this.issues = issues;
  }
}

/**
 * Apply an editor mutation transactionally. Existing input defects remain
 * visible, but a browser action is never allowed to introduce a new
 * structural error into the working CityJSON document.
 */
export function runStructurallyGuardedMutation<T>(
  doc: CityJsonDocument,
  action: string,
  mutate: () => T
): { value: T; report: IntegrityReport } {
  const snapshot = clone(doc);
  const before = checkIntegrity(doc);
  try {
    const value = mutate();
    const report = checkIntegrity(doc);
    const introduced = introducedErrors(before, report);
    if (introduced.length > 0) {
      restore(doc, snapshot);
      throw new EditorMutationValidationError(action, introduced);
    }
    return { value, report };
  } catch (error) {
    restore(doc, snapshot);
    throw error;
  }
}

/**
 * Browser action for the new-building dialog. Tests call this same function,
 * so generator acceptance covers the route used by the UI rather than a
 * hand-edited CityJSON fixture.
 */
export function createBuildingFromEditor(
  doc: CityJsonDocument,
  params: NewBuildingParams,
  split: EditorCreateSplit = { mode: 'none', count: 1 }
): EditorCreateResult {
  return runStructurallyGuardedMutation(doc, 'Creating the building', () => {
    const result = generateBuilding(doc, params);
    const id = insertBuilding(doc, result);
    const objectIds = [id];
    if (split.mode === 'floors') {
      objectIds.push(...splitBuildingByFloor(doc, id, split.count).partIds);
    } else if (split.mode === 'sides') {
      objectIds.push(...splitBuildingBySide(doc, id, split.count, split.axis).partIds);
    }
    return { id, objectIds };
  }).value;
}

/**
 * Browser action for the position editor's Save button. Rotation, movement,
 * and compaction happen together so persistence tests exercise the exact
 * coordinate lifecycle used by the application.
 */
export function commitBuildingTransformFromEditor(
  doc: CityJsonDocument,
  transform: PendingTransform
): EditorTransformResult {
  return runStructurallyGuardedMutation(doc, `Moving ${transform.id}`, () => {
    const dz = transform.dz ?? 0;
    const changed = transform.angle !== 0 || transform.dx !== 0 || transform.dy !== 0 || dz !== 0;
    if (!changed) return { changed: false, compactedVertices: 0 };
    if (transform.angle !== 0) rotateBuilding(doc, transform.id, transform.angle);
    if (transform.dx !== 0 || transform.dy !== 0 || dz !== 0) {
      moveBuilding(doc, transform.id, transform.dx, transform.dy, dz);
    }
    const compacted = compactVertices(doc);
    return { changed: true, compactedVertices: compacted.reclaimed };
  }).value;
}

function introducedErrors(before: IntegrityReport, after: IntegrityReport): IntegrityIssue[] {
  const remaining = new Map<string, number>();
  for (const issue of before.issues) {
    if (issue.severity !== 'error') continue;
    const key = issueKey(issue);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return after.issues.filter((issue) => {
    if (issue.severity !== 'error') return false;
    const key = issueKey(issue);
    const count = remaining.get(key) ?? 0;
    if (count <= 0) return true;
    remaining.set(key, count - 1);
    return false;
  });
}

function issueKey(issue: IntegrityIssue): string {
  return JSON.stringify([issue.code, issue.message, issue.location ?? null]);
}

function restore(target: CityJsonDocument, snapshot: CityJsonDocument): void {
  for (const key of Object.keys(target) as Array<keyof CityJsonDocument>) {
    delete target[key];
  }
  Object.assign(target, clone(snapshot));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
