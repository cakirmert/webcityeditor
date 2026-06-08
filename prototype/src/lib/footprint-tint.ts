import type { Footprint } from './footprints';

export type UsageKey = 'residential' | 'commercial' | 'office' | 'industrial' | 'public';
type UsageColorKey = UsageKey | 'unknown';

export const USAGE_OPTIONS: UsageKey[] = [
  'residential',
  'commercial',
  'office',
  'industrial',
  'public',
];

const USAGE_RGB: Record<UsageColorKey, [number, number, number]> = {
  residential: [240, 220, 60],
  commercial: [60, 120, 240],
  office: [60, 180, 100],
  industrial: [160, 80, 240],
  public: [220, 60, 60],
  unknown: [200, 200, 210],
};

export const USAGE_OBJECT_COLORS: Record<UsageColorKey, number> = {
  residential: 0xf0dc3c,
  commercial: 0x3c78f0,
  office: 0x3cb464,
  industrial: 0xa050f0,
  public: 0xdc3c3c,
  unknown: 0xc8c8d2,
};

export function normalizeUsage(value: unknown): UsageKey | null {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : null;
  switch (key) {
    case 'residential':
      return 'residential';
    case 'commercial':
    case 'shops':
      return 'commercial';
    case 'office':
    case 'business':
      return 'office';
    case 'industrial':
      return 'industrial';
    case 'public':
      return 'public';
    default:
      return null;
  }
}

/**
 * Pick an RGB-A colour for a footprint based on its `roofType` attribute.
 *
 * Recognises both the human-readable strings the editor emits ("flat",
 * "gable", "hip", "pyramid") and the CityGML / 3DBAG integer codes:
 *   1000 = flat
 *   2100 = shed / pent / single pitched
 *   3100 = gable
 *   3200 = hip
 *   3300 = mansard
 *   3400 = pyramidal
 *   5100 = barrel / vaulted
 *
 * Unknown or missing `roofType` falls back to a neutral grey so the map
 * stays coherent on imported data without semantics.
 *
 * Pure function so we can unit-test the integer-code mapping; MapView calls
 * it from getFillColor.
 */
export function tintByRoofType(
  d: Footprint,
  alpha: number
): [number, number, number, number] {
  const raw = d.attributes?.roofType;
  const key =
    typeof raw === 'string'
      ? raw.toLowerCase()
      : typeof raw === 'number'
        ? String(raw)
        : null;
  switch (key) {
    case 'flat':
    case '1000':
      return [200, 204, 210, alpha]; // cool light gray
    case 'gable':
    case '3100':
      return [184, 74, 44, alpha]; // terracotta
    case 'hip':
    case '3200':
      return [158, 54, 34, alpha]; // deeper terra
    case 'pyramid':
    case 'pyramidal':
    case '3400':
      return [139, 90, 43, alpha]; // walnut brown
    case '2100':
      return [196, 178, 152, alpha]; // shed — sandy
    case '3300':
      return [120, 70, 50, alpha]; // mansard — dark cocoa
    case '5100':
      return [180, 134, 90, alpha]; // barrel / vault
    default:
      return [200, 200, 210, alpha]; // neutral fallback
  }
}

/**
 * Pick an RGB-A colour for a footprint based on its `function` attribute.
 *
 * Mappings:
 *   residential        = yellow  ([240, 220, 60, alpha])
 *   commercial / shops = blue    ([60, 120, 240, alpha])
 *   office / business  = green   ([60, 180, 100, alpha])
 *   industrial         = purple  ([160, 80, 240, alpha])
 *   public             = red     ([220, 60, 60, alpha])
 *
 * Unknown or missing falls back to a neutral grey.
 */
export function tintByUsage(
  d: Footprint,
  alpha: number
): [number, number, number, number] {
  const key = normalizeUsage(d.attributes?.function) ?? 'unknown';
  const [r, g, b] = USAGE_RGB[key];
  return [r, g, b, alpha];
}
