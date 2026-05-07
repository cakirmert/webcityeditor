import type { Footprint } from './footprints';

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
