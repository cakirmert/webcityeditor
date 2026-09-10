import { buildRoadJunctionPlan, type RoadJunctionDraft } from './road-junctions';
import { validateRoadFit, type RoadFitValidationContext } from './road-fit';
import type { RoadArea } from './transportation';

/** A reversible proposal for ordinary junctions throughout the loaded network.
 * Complex merges and custom/saved shapes require the explicit Generate action.
 * Returning the original draft is intentional when geometry or fit is unsafe. */
export function automaticJunctionPreview(draft: RoadJunctionDraft, areas: RoadArea[], surroundings: Omit<RoadFitValidationContext, 'roadAreas' | 'existingRoadAreas' | 'removedRoadIds'> = {}): RoadJunctionDraft {
  if (draft.footprint || draft.mergedFrom || draft.roadIds.length > 4 ||
    areas.some(area => area.roadId === draft.id && area.attributes.junctionSurfaceMode === 'generated')) return draft;
  const candidate = {...draft, surfaceMode:'rebuild' as const};
  const plan = buildRoadJunctionPlan(candidate, areas);
  if (plan.error) return draft;
  const conflicts = validateRoadFit({...surroundings, roadAreas:plan.areas, existingRoadAreas:areas, removedRoadIds:plan.removedRoadIds});
  if (conflicts.some(c => c.severity === 'error' || c.kind === 'vertical_uncertainty')) return draft;
  return candidate;
}
