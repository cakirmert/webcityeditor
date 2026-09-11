import type { RoadBand, RoadBandKind, RoadDraft, RoadSectionDraft } from './road-types.js';

export interface RoadWidthRule {
  minimumM: number;
  recommendedM: number;
  /** Editable project guardrail, not a statutory maximum. */
  maximumM?: number;
  twoWayMinimumM?: number;
  twoWayRecommendedM?: number;
  twoWayMaximumM?: number;
  source: string;
  note: string;
}

/** Versioned design thresholds and source notes, stored with the road layout. */
export interface RoadRuleProfile {
  id: string;
  name: string;
  version: string;
  widths: Record<RoadBandKind, RoadWidthRule>;
}

const CURRENT_RESTRA = 'https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf';

export const HAMBURG_ROAD_RULES: RoadRuleProfile = {
  id: 'hamburg-concept',
  name: 'Hamburg · concept design',
  version: '2026-09-11',
  widths: {
    car_lane: { minimumM: 2.75, recommendedM: 3.25, maximumM: 5, twoWayMinimumM: 5.5, twoWayRecommendedM: 6.5, twoWayMaximumM: 10,
      source: 'Editor fallback; no verified standard clause', note: 'Generic motor-lane thresholds, not a universal regulatory minimum. The two-way values reserve two lanes of space. Select applicable design-vehicle, speed, bus and freight requirements before detailed design.' },
    bike_lane: { minimumM: 2, recommendedM: 2.5, maximumM: 5, twoWayMinimumM: 3, twoWayRecommendedM: 3.5, twoWayMaximumM: 8,
      source: `${CURRENT_RESTRA}#page=107`, note: 'ReStra 23.03.2026, ERA 2.2.1, printed pp. 94–96: one-way clear cycling space 2.00/2.50 m; add markings or protection separately (marked lane total 2.25/2.75 m). Two-way defaults assume provision on one side only: 3.00/3.50 m; provision on both sides uses 2.50/3.00 m.' },
    sidewalk: { minimumM: 1.8, recommendedM: 2.65, maximumM: 30,
      source: `${CURRENT_RESTRA}#page=98`, note: 'ReStra 23.03.2026, RASt 4.7 and EFA 3.2.1, printed pp. 12 and 85: 1.80 m clear pedestrian space; 2.65 m total side-space reference at 50 km/h, including safety space. The band-width check cannot measure clear passage around tree pits or furniture.' },
    parking: { minimumM: 2, recommendedM: 2.1, maximumM: 3.5,
      source: `${CURRENT_RESTRA}#page=91`, note: 'ReStra 23.03.2026, EAR 3.4.3, printed p. 78: parallel parking 2.10 m with standard materials, 2.00 m with other materials; 2.30 m recommended beside heavily used main roads. Door buffers and accessible spaces need separate dimensions.' },
    median: { minimumM: 0.1, recommendedM: 0.5, maximumM: 20,
      source: 'Editor fallback; no verified standard clause', note: 'Generic kerb or separator only; this does not define a pedestrian refuge or a complete protective buffer.' },
    green: { minimumM: 0.5, recommendedM: 1.5, maximumM: 50,
      source: 'Editor fallback; no verified standard clause', note: 'Landscape strip only; tree rooting volume requires its own design.' },
  },
};

export function roadWidthRule(band: RoadBand, profile = HAMBURG_ROAD_RULES): RoadWidthRule {
  const rule = profile.widths[band.kind];
  const fallback = HAMBURG_ROAD_RULES.widths[band.kind];
  // Earlier saved profiles predate maximums. Keep their minimum/target values,
  // but do not accidentally restore an unbounded width control on reload.
  if (band.direction !== 'both') return { ...rule, maximumM: rule.maximumM ?? Math.max(fallback.maximumM!, rule.recommendedM) };
  return { ...rule, minimumM: rule.twoWayMinimumM ?? rule.minimumM,
    recommendedM: rule.twoWayRecommendedM ?? rule.recommendedM,
    maximumM: rule.twoWayMaximumM ?? Math.max(rule.maximumM ?? fallback.twoWayMaximumM ?? fallback.maximumM!, rule.twoWayRecommendedM ?? rule.recommendedM) };
}

export interface RoadRuleIssue {
  sectionId: string;
  bandIndex?: number;
  severity: 'error' | 'warning';
  code: 'width' | 'recommendation' | 'extent' | 'configuration';
  message: string;
}

export function roadSectionExtents(section: RoadSectionDraft) {
  const widthM = section.bands.reduce((sum, band) => sum + band.widthM, 0);
  const offsetM = section.offsetM ?? 0;
  return { widthM, leftM: widthM / 2 + offsetM, rightM: widthM / 2 - offsetM };
}

/** Explicit acceptance covers design limits, never invalid geometry inputs. */
export function canAcceptRoadRuleWarning(issue: RoadRuleIssue, draft: RoadDraft): boolean {
  if (issue.code === 'configuration') return false;
  if (issue.code !== 'width') return true;
  const band = draft.sections.find(section => section.id === issue.sectionId)?.bands[issue.bandIndex ?? -1];
  return !!band && Number.isFinite(band.widthM) && band.widthM > 0;
}

export function validateRoadRules(draft: RoadDraft, baseline?: RoadDraft | null): RoadRuleIssue[] {
  const profile = draft.ruleProfile ?? HAMBURG_ROAD_RULES;
  const issues: RoadRuleIssue[] = [];
  try { parseRoadRuleProfile(profile); }
  catch (error) { return [{ sectionId: '', code: 'configuration', severity: 'error', message: String(error) }]; }
  for (const section of draft.sections) {
    section.bands.forEach((band, bandIndex) => {
      const rule = roadWidthRule(band, profile);
      const oldSection = baseline?.sections.find((item) => item.id === section.id);
      const oldBand = band.id ? oldSection?.bands.find((item) => item.id === band.id) : oldSection?.bands[bandIndex];
      const unchanged = !!oldBand && oldBand.widthM === band.widthM && oldBand.kind === band.kind && oldBand.direction === band.direction;
      const valid = Number.isFinite(band.widthM) && band.widthM > 0;
      if (!valid || band.widthM < rule.minimumM - 1e-6) {
        issues.push({ sectionId: section.id, bandIndex, code: 'width', severity: valid && unchanged ? 'warning' : 'error',
          message: `Band ${bandIndex + 1}: ${band.kind.replaceAll('_', ' ')} is ${band.widthM.toFixed(2)} m; the project minimum is ${rule.minimumM.toFixed(2)} m.${valid && unchanged ? ' Existing width retained.' : ''}` });
      } else if (rule.maximumM !== undefined && band.widthM > rule.maximumM + 1e-6) {
        issues.push({ sectionId: section.id, bandIndex, code: 'width', severity: unchanged ? 'warning' : 'error',
          message: `Band ${bandIndex + 1}: ${band.widthM.toFixed(2)} m exceeds the ${rule.maximumM.toFixed(2)} m project limit. Add separate lanes or adjust the project rules for an exceptional width.${unchanged ? ' Existing width retained.' : ''}` });
      } else if (band.widthM < rule.recommendedM - 1e-6) {
        issues.push({ sectionId: section.id, bandIndex, code: 'recommendation', severity: 'warning',
          message: `Band ${bandIndex + 1}: ${rule.recommendedM.toFixed(2)} m recommended; review this constrained width.` });
      }
    });
    const extents = roadSectionExtents(section);
    if (!Number.isFinite(section.offsetM ?? 0)) {
      issues.push({ sectionId: section.id, code: 'configuration', severity: 'error', message: 'Road offset must be a finite number.' });
    }
    for (const side of ['left', 'right'] as const) {
      const limit = section.extentLimits?.[side];
      if (limit === undefined) continue;
      if (!Number.isFinite(limit) || limit < 0) {
        issues.push({ sectionId: section.id, code: 'configuration', severity: 'error', message: `${side} extent must be a non-negative distance.` });
      } else if (extents[`${side}M`] > limit + 1e-6) {
        issues.push({ sectionId: section.id, code: 'extent', severity: 'error', message: `${side === 'left' ? 'Left' : 'Right'} edge exceeds the ${limit.toFixed(2)} m limit by ${(extents[`${side}M`] - limit).toFixed(2)} m.` });
      }
    }
  }
  return issues;
}

/** Fit available surplus, never scale a pedestrian or travel lane below its own floor. */
export function fitRoadDraftToRules(draft: RoadDraft): { draft: RoadDraft; error?: string } {
  const profile = draft.ruleProfile ?? HAMBURG_ROAD_RULES;
  try { parseRoadRuleProfile(profile); }
  catch (error) { return { draft, error: String(error) }; }
  const sections: RoadSectionDraft[] = [];
  for (const section of draft.sections) {
    if (!Number.isFinite(section.offsetM ?? 0) || section.bands.some((band) => !Number.isFinite(band.widthM) || band.widthM <= 0)) return { draft, error: 'Enter finite, positive band widths and a finite offset.' };
    const left = section.extentLimits?.left ?? Infinity;
    const right = section.extentLimits?.right ?? Infinity;
    if (left < 0 || right < 0 || Number.isNaN(left) || Number.isNaN(right)) return { draft, error: 'Enter valid left and right extents.' };
    const floors = section.bands.map((band) => roadWidthRule(band, profile).minimumM);
    const desired = section.bands.map((band, i) => Math.min(roadWidthRule(band, profile).maximumM ?? Infinity, Math.max(floors[i], band.widthM)));
    const minimum = floors.reduce((sum, value) => sum + value, 0);
    const total = desired.reduce((sum, value) => sum + value, 0);
    const available = Math.min(total, left + right);
    if (minimum > available + 1e-6) return { draft, error: `${section.id} needs at least ${minimum.toFixed(2)} m. Remove a band or widen the available extent; its minimum widths cannot fit.` };
    const factor = total === minimum ? 1 : Math.max(0, Math.min(1, (available - minimum) / (total - minimum)));
    const bands = section.bands.map((band, i) => ({ ...band, widthM: Math.max(floors[i], Math.floor((floors[i] + (desired[i] - floors[i]) * factor + 1e-9) * 100) / 100) }));
    const half = bands.reduce((sum, band) => sum + band.widthM, 0) / 2;
    const offsetM = Math.max(half - right, Math.min(left - half, section.offsetM ?? 0));
    sections.push({ ...section, bands, offsetM });
  }
  return { draft: { ...draft, ruleProfile: structuredClone(profile), sections } };
}

/** Strictly validate custom policy files before they can govern generation. */
export function parseRoadRuleProfile(value: unknown): RoadRuleProfile {
  const profile = value as RoadRuleProfile | null;
  if (!profile || typeof profile.id !== 'string' || typeof profile.name !== 'string' || typeof profile.version !== 'string' || !profile.widths) throw new Error('A rule profile needs id, name, version and widths.');
  for (const kind of Object.keys(HAMBURG_ROAD_RULES.widths) as RoadBandKind[]) {
    const rule = profile.widths[kind];
    if (!rule || typeof rule.source !== 'string' || typeof rule.note !== 'string' || !Number.isFinite(rule.minimumM) || rule.minimumM <= 0 || !Number.isFinite(rule.recommendedM) || rule.recommendedM < rule.minimumM) throw new Error(`Invalid width rule for ${kind}.`);
    if ((rule.twoWayMinimumM !== undefined || rule.twoWayRecommendedM !== undefined) && (!Number.isFinite(rule.twoWayMinimumM) || (rule.twoWayMinimumM ?? 0) <= 0 || !Number.isFinite(rule.twoWayRecommendedM) || (rule.twoWayRecommendedM ?? 0) < (rule.twoWayMinimumM ?? 0))) throw new Error(`Invalid two-way width rule for ${kind}.`);
    if (rule.maximumM !== undefined && (!Number.isFinite(rule.maximumM) || rule.maximumM < rule.recommendedM)) throw new Error(`Invalid maximum width for ${kind}.`);
    if (rule.twoWayMaximumM !== undefined && (!Number.isFinite(rule.twoWayMaximumM) || rule.twoWayMaximumM < (rule.twoWayRecommendedM ?? rule.recommendedM))) throw new Error(`Invalid two-way maximum width for ${kind}.`);
  }
  return structuredClone(profile);
}
