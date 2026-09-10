import type { CityJsonDocument } from '../types';
import type { RoadFitConflict } from './road-fit';

export interface RoadFitReview {
  checkedAt: string;
  warnings: Array<{ id: string; label: string; severity: 'error' | 'warning' }>;
}

export function writeRoadFitReview(doc: CityJsonDocument, id: string, conflicts: RoadFitConflict[], notes: string[] = []) {
  const object = doc.CityObjects[id];
  if (!object) return;
  object.attributes ??= {};
  const warnings = [...conflicts.map(({ id, label, severity }) => ({ id, label, severity })), ...notes.map((label, i) => ({ id: `generation-${i}`, label, severity: 'warning' as const }))];
  if (warnings.length) object.attributes._roadFitReview = { checkedAt: new Date().toISOString(), warnings };
  else delete object.attributes._roadFitReview;
}

export function readRoadFitReview(doc: CityJsonDocument | null, id?: string | null): RoadFitReview | null {
  const review = id && doc?.CityObjects[id]?.attributes?._roadFitReview;
  if (!review || typeof review !== 'object' || Array.isArray(review) || !Array.isArray(review.warnings) || typeof review.checkedAt !== 'string') return null;
  return review as unknown as RoadFitReview;
}
