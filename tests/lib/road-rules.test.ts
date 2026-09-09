import { describe, expect, it } from 'vitest';
import { HAMBURG_ROAD_RULES, fitRoadDraftToRules, parseRoadRuleProfile, roadSectionExtents, roadWidthRule, validateRoadRules } from '../../src/lib/road-rules';
import { createManualRoadDraft, insertRoadIntoCityJson, extractTransportationAreas, roadDraftPreservesExactGeometry, type RoadDraft } from '../../src/lib/transportation';
import { buildSampleCube } from '../../src/lib/cityjson';

function draft(): RoadDraft {
  const value = createManualRoadDraft([[4.357, 52.01], [4.358, 52.01]]);
  value.sections[0].bands = [
    { id: 'walk', kind: 'sidewalk', widthM: 3 },
    { id: 'car', kind: 'car_lane', widthM: 4, direction: 'forward' },
    { id: 'bike', kind: 'bike_lane', widthM: 3, direction: 'forward' },
  ];
  return value;
}

describe('city road design policy', () => {
  it('applies width guardrails to older saved profiles and honors explicit overrides', () => {
    const value = draft();
    for (const rule of Object.values(value.ruleProfile!.widths)) { delete rule.maximumM; delete rule.twoWayMaximumM; }
    value.sections[0].bands[1].widthM = 100;
    expect(validateRoadRules(value).some(issue => issue.bandIndex === 1 && issue.severity === 'error')).toBe(true);
    value.ruleProfile!.widths.car_lane.maximumM = 7;
    value.sections[0].bands[1].widthM = 6;
    expect(validateRoadRules(value).some(issue => issue.bandIndex === 1 && issue.severity === 'error')).toBe(false);
  });
  it('blocks absurd widths, retains existing source widths, and fits to explicit project limits', () => {
    const value = draft(); value.sections[0].bands[1].widthM = 100;
    expect(validateRoadRules(value).find((issue) => issue.bandIndex === 1)?.severity).toBe('error');
    expect(validateRoadRules(value, value).find((issue) => issue.bandIndex === 1)?.severity).toBe('warning');
    expect(fitRoadDraftToRules(value).draft.sections[0].bands[1].widthM).toBe(5);
    value.sections[0].bands[1].direction = 'both'; value.sections[0].bands[1].widthM = 6.5;
    expect(validateRoadRules(value).filter((issue) => issue.severity === 'error')).toEqual([]);
    const profile = structuredClone(HAMBURG_ROAD_RULES); profile.widths.car_lane.maximumM = 1;
    expect(() => parseRoadRuleProfile(profile)).toThrow(/maximum/);
  });
  it('creates new roads at the current profile targets and persists the policy on export', () => {
    const value = createManualRoadDraft([[4.357, 52.01], [4.358, 52.01]]);
    expect(validateRoadRules(value)).toEqual([]);
    const doc = buildSampleCube(); insertRoadIntoCityJson(doc, value, { id: 'new' });
    expect(extractTransportationAreas(doc).find((area) => area.roadId === 'new')?.editableDraft?.ruleProfile).toEqual(HAMBURG_ROAD_RULES);
  });
  it('distinguishes a one-way lane from a two-way cycling facility', () => {
    expect(roadWidthRule({ kind: 'bike_lane', widthM: 2, direction: 'forward' }).minimumM).toBe(2);
    expect(roadWidthRule({ kind: 'bike_lane', widthM: 2, direction: 'both' }).minimumM).toBe(3);
  });
  it('retains an existing narrow imported lane but blocks making it narrower', () => {
    const original = draft(); original.sections[0].bands[1].widthM = 2;
    expect(validateRoadRules(original, original).find((issue) => issue.bandIndex === 1)?.severity).toBe('warning');
    const edited = structuredClone(original); edited.sections[0].bands[1].widthM = 1.9;
    expect(validateRoadRules(edited, original).find((issue) => issue.bandIndex === 1)?.severity).toBe('error');
  });
  it('fits an asymmetric envelope without violating any band minimum', () => {
    const value = draft(); value.sections[0].extentLimits = { left: 5, right: 2 };
    const fitted = fitRoadDraftToRules(value);
    expect(fitted.error).toBeUndefined();
    expect(validateRoadRules(fitted.draft).filter((issue) => issue.severity === 'error')).toEqual([]);
    const extents = roadSectionExtents(fitted.draft.sections[0]);
    expect(extents.leftM).toBeLessThanOrEqual(5.00001); expect(extents.rightM).toBeLessThanOrEqual(2.00001);
    expect(fitted.draft.sections[0].centerlineWgs84).toEqual(value.sections[0].centerlineWgs84);
  });
  it('refuses an impossible envelope without changing the draft', () => {
    const value = draft(); value.sections[0].extentLimits = { left: 2, right: 2 };
    const fitted = fitRoadDraftToRules(value);
    expect(fitted.error).toMatch(/at least/); expect(fitted.draft).toBe(value);
  });
  it('treats changing offset as a geometry edit', () => {
    const value = draft(); const edited = structuredClone(value); edited.sections[0].offsetM = 1;
    expect(roadDraftPreservesExactGeometry(value, edited)).toBe(false);
  });
  it('round-trips asymmetric extents and offsets with the saved layout', () => {
    const value = draft(); value.sections[0].offsetM = 0.75; value.sections[0].extentLimits = { left: 8, right: 6 };
    const doc = buildSampleCube(); insertRoadIntoCityJson(doc, value, { id: 'offset-road' });
    const section = extractTransportationAreas(doc).find((area) => area.roadId === 'offset-road')!.editableDraft!.sections[0];
    expect(section.offsetM).toBe(0.75); expect(section.extentLimits).toEqual({ left: 8, right: 6 });
  });
  it('rejects malformed custom rules instead of letting NaN bypass constraints', () => {
    const profile = structuredClone(HAMBURG_ROAD_RULES); profile.widths.car_lane.minimumM = NaN;
    expect(() => parseRoadRuleProfile(profile)).toThrow(/car_lane/);
    expect(() => parseRoadRuleProfile({})).toThrow();
  });
});
