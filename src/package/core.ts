/** Data helpers: no React, DOM, map renderer or WebAssembly initialization. */
export { parseCityJson, parseCityJsonAuto, parseCityJsonSeq, validateCityJson } from '../lib/cityjson.js';
export type { ValidationResult } from '../lib/cityjson.js';
export { checkIntegrity } from '../lib/integrity.js';
export type { IntegrityIssue, IntegrityReport } from '../lib/integrity.js';
export {
  HAMBURG_ROAD_RULES, validateRoadRules, fitRoadDraftToRules,
  parseRoadRuleProfile, roadSectionExtents, roadWidthRule,
} from '../lib/road-rules.js';
export type { RoadRuleIssue, RoadRuleProfile, RoadWidthRule } from '../lib/road-rules.js';
export type { RoadBand, RoadBandKind, RoadDraft, RoadSectionDraft } from '../lib/road-types.js';
export type { CityJsonDocument, CityObject, CityJsonTransform } from '../types-cityjson.js';
