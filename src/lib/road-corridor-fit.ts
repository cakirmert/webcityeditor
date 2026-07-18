import type { CityJsonDocument } from '../types';
import { activeMetricCrsForCityJson } from './projection';
import type { RoadAllowedCorridor } from './road-corridor';
import { validateRoadFit } from './road-fit';
import {
  insertRoadIntoCityJson,
  type RoadDraft,
  type RoadSectionDraft,
} from './transportation';

export const MIN_CORRIDOR_FIT_BAND_WIDTH_M = 0.4;

export interface RoadCorridorSectionFit {
  sectionId: string;
  originalWidthM: number;
  fittedWidthM: number;
  scale: number;
}

export interface RoadCorridorFitResult {
  status: 'fitted' | 'unchanged' | 'unfit';
  draft: RoadDraft;
  sections: RoadCorridorSectionFit[];
  reason?: string;
}

interface CorridorFitOptions {
  metricCrs?: string;
  minBandWidthM?: number;
  iterations?: number;
}

/**
 * Fit each editable road section to the union of trusted corridor polygons by
 * scaling all of that section's band widths by one common factor. The action
 * deliberately never moves a centerline, changes band order, or clips away a
 * semantic surface: if proportional width reduction cannot fit, it refuses the
 * draft and lets the user redraw the centerline or edit bands manually.
 */
export function fitRoadDraftWidthsToCorridors(
  doc: CityJsonDocument,
  draft: RoadDraft,
  corridors: RoadAllowedCorridor[],
  options: CorridorFitOptions = {}
): RoadCorridorFitResult {
  if (corridors.length === 0) {
    return {
      status: 'unfit',
      draft: cloneDraft(draft),
      sections: [],
      reason: 'Load at least one trusted corridor before fitting road widths.',
    };
  }

  const minBandWidthM = finitePositive(options.minBandWidthM)
    ? options.minBandWidthM
    : MIN_CORRIDOR_FIT_BAND_WIDTH_M;
  const iterations = Number.isInteger(options.iterations) && (options.iterations ?? 0) > 0
    ? options.iterations ?? 24
    : 24;
  const metricCrs = options.metricCrs ?? activeMetricCrsForCityJson(doc);
  const fittedDraft = cloneDraft(draft);
  const sectionFits: RoadCorridorSectionFit[] = [];

  for (let index = 0; index < fittedDraft.sections.length; index++) {
    const section = fittedDraft.sections[index];
    const result = fitSection(doc, fittedDraft, section, corridors, {
      metricCrs,
      minBandWidthM,
      iterations,
    });
    if (!result.ok) {
      return {
        status: 'unfit',
        draft: cloneDraft(draft),
        sections: sectionFits,
        reason: result.reason,
      };
    }
    fittedDraft.sections[index] = result.section;
    sectionFits.push(result.summary);
  }

  const changed = sectionFits.some((section) => section.scale < 1 - 1e-9);
  return {
    status: changed ? 'fitted' : 'unchanged',
    draft: fittedDraft,
    sections: sectionFits,
  };
}

function fitSection(
  doc: CityJsonDocument,
  draft: RoadDraft,
  section: RoadSectionDraft,
  corridors: RoadAllowedCorridor[],
  options: Required<Pick<CorridorFitOptions, 'metricCrs' | 'minBandWidthM' | 'iterations'>>
):
  | { ok: true; section: RoadSectionDraft; summary: RoadCorridorSectionFit }
  | { ok: false; reason: string } {
  const originalWidthM = totalWidth(section);
  if (section.bands.length === 0 || !finitePositive(originalWidthM)) {
    return { ok: false, reason: `Section ${section.id} has no valid road-band width to fit.` };
  }
  if (section.bands.some((band) => !finitePositive(band.widthM))) {
    return { ok: false, reason: `Section ${section.id} contains an invalid road-band width.` };
  }
  if (section.bands.some((band) => band.widthM < options.minBandWidthM)) {
    return {
      ok: false,
      reason: `Section ${section.id} already contains a band narrower than the ${options.minBandWidthM.toFixed(2)} m fitting minimum.`,
    };
  }

  if (sectionFits(doc, draft, section, corridors, options.metricCrs)) {
    return {
      ok: true,
      section,
      summary: {
        sectionId: section.id,
        originalWidthM,
        fittedWidthM: originalWidthM,
        scale: 1,
      },
    };
  }

  const minimumScale = Math.max(
    ...section.bands.map((band) => options.minBandWidthM / band.widthM)
  );
  const minimumSection = scaleSection(section, minimumScale, options.minBandWidthM);
  if (!sectionFits(doc, draft, minimumSection, corridors, options.metricCrs)) {
    return {
      ok: false,
      reason: `Section ${section.id} cannot fit without moving its centerline or shrinking a band below ${options.minBandWidthM.toFixed(2)} m.`,
    };
  }

  let low = minimumScale;
  let high = 1;
  for (let iteration = 0; iteration < options.iterations; iteration++) {
    const candidate = (low + high) / 2;
    const candidateSection = scaleSection(section, candidate, options.minBandWidthM);
    if (sectionFits(doc, draft, candidateSection, corridors, options.metricCrs)) {
      low = candidate;
    } else {
      high = candidate;
    }
  }

  // Round down to centimetres so the displayed result remains at or inside the
  // validated scale instead of rounding back over the corridor boundary.
  const fittedSection = scaleSection(section, low, options.minBandWidthM, true);
  if (!sectionFits(doc, draft, fittedSection, corridors, options.metricCrs)) {
    return {
      ok: false,
      reason: `Section ${section.id} reached an unstable corridor boundary; edit it manually instead.`,
    };
  }
  const fittedWidthM = totalWidth(fittedSection);
  return {
    ok: true,
    section: fittedSection,
    summary: {
      sectionId: section.id,
      originalWidthM,
      fittedWidthM,
      scale: fittedWidthM / originalWidthM,
    },
  };
}

function sectionFits(
  doc: CityJsonDocument,
  draft: RoadDraft,
  section: RoadSectionDraft,
  corridors: RoadAllowedCorridor[],
  metricCrs: string
): boolean {
  try {
    const previewDoc = clone(doc);
    const previewDraft: RoadDraft = {
      ...cloneDraft(draft),
      sections: [cloneSection(section)],
    };
    const roadAreas = insertRoadIntoCityJson(previewDoc, previewDraft, {
      id: '__road_corridor_fit_preview__',
    }).areas;
    return !validateRoadFit({
      roadAreas,
      allowedCorridors: corridors,
      corridorSeverity: 'error',
      metricCrs,
    }).some((conflict) => conflict.kind === 'outside_corridor');
  } catch {
    return false;
  }
}

function scaleSection(
  section: RoadSectionDraft,
  scale: number,
  minBandWidthM: number,
  roundDownToCentimetres = false
): RoadSectionDraft {
  return {
    ...section,
    centerlineWgs84: section.centerlineWgs84.map((point) => [...point]),
    bands: section.bands.map((band) => {
      const scaled = band.widthM * scale;
      const widthM = roundDownToCentimetres
        ? Math.max(minBandWidthM, Math.floor((scaled + 1e-9) * 100) / 100)
        : Math.max(minBandWidthM, scaled);
      return {
        ...band,
        widthM,
        allowedModes: band.allowedModes ? [...band.allowedModes] : undefined,
      };
    }),
  };
}

function totalWidth(section: RoadSectionDraft): number {
  return section.bands.reduce((sum, band) => sum + band.widthM, 0);
}

function cloneSection(section: RoadSectionDraft): RoadSectionDraft {
  return {
    ...section,
    centerlineWgs84: section.centerlineWgs84.map((point) => [...point]),
    bands: section.bands.map((band) => ({
      ...band,
      allowedModes: band.allowedModes ? [...band.allowedModes] : undefined,
    })),
  };
}

function cloneDraft(draft: RoadDraft): RoadDraft {
  return {
    ...draft,
    osmTags: draft.osmTags ? { ...draft.osmTags } : undefined,
    vertical: draft.vertical ? { ...draft.vertical } : undefined,
    sections: draft.sections.map(cloneSection),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function finitePositive(value: number | undefined): value is number {
  return Number.isFinite(value) && (value ?? 0) > 0;
}
