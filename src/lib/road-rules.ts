import type { RoadBand, RoadBandKind, RoadDraft, RoadSectionDraft } from './transportation';

export interface RoadWidthRule {
  minimumM: number;
  recommendedM: number;
  twoWayMinimumM?: number;
  twoWayRecommendedM?: number;
  source: string;
  note: string;
}

/** A versioned project policy, stored with the layout for reproducible exports. */
export interface RoadRuleProfile {
  id: string;
  name: string;
  version: string;
  widths: Record<RoadBandKind, RoadWidthRule>;
}

const RESTRA = 'https://www.hamburg.de/politik-und-verwaltung/behoerden/bvm/die-themen-der-behoerde/grundlagen-strassenwesen/restra-193078';
const CURRENT_RESTRA = 'https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf';

export const HAMBURG_ROAD_RULES: RoadRuleProfile = {
  id: 'hamburg-concept',
  name: 'Hamburg · concept design',
  version: '2026-09-06',
  widths: {
    car_lane: { minimumM: 2.75, recommendedM: 3.25, twoWayMinimumM: 5.5, twoWayRecommendedM: 6.5,
      source: 'Project design policy', note: 'Per motor lane; a band carrying both directions needs two lanes of space. Review bus, freight and speed requirements.' },
    bike_lane: { minimumM: 2, recommendedM: 2.5, twoWayMinimumM: 3, twoWayRecommendedM: 3.5,
      source: CURRENT_RESTRA, note: 'ReStra 23.03.2026, pp. 94–96: one-way clear cycling space 2.00/2.50 m; add markings or protection separately (marked lane total 2.25/2.75 m). Two-way defaults assume provision on one side only: 3.00/3.50 m; provision on both sides can use 2.50/3.00 m.' },
    sidewalk: { minimumM: 1.8, recommendedM: 2.65,
      source: RESTRA, note: '1.80 m clear pedestrian space; 2.65 m is the total side-space reference at 50 km/h, including safety space. Tree pits and furniture do not count as clear walking width.' },
    parking: { minimumM: 2, recommendedM: 2.1,
      source: RESTRA, note: 'Parallel parking: 2.10 m standard materials; 2.00 m with other surfaces. 2.30 m recommended beside heavily used main roads. Add a separate door buffer; accessible spaces need separate dimensions.' },
    median: { minimumM: 0.1, recommendedM: 0.5,
      source: 'Project design policy', note: 'Kerb or separator only; this is not a pedestrian refuge minimum.' },
    green: { minimumM: 0.5, recommendedM: 1.5,
      source: 'Project design policy', note: 'Landscape strip only; tree rooting volume requires its own design.' },
  },
};

export function roadWidthRule(band: RoadBand, profile = HAMBURG_ROAD_RULES): RoadWidthRule {
  const rule = profile.widths[band.kind];
  if (band.direction !== 'both') return rule;
  return { ...rule, minimumM: rule.twoWayMinimumM ?? rule.minimumM,
    recommendedM: rule.twoWayRecommendedM ?? rule.recommendedM };
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
    const desired = section.bands.map((band, i) => Math.max(floors[i], band.widthM));
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
  }
  return structuredClone(profile);
}
