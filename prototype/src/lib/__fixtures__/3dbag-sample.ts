/**
 * Synthetic 3DBAG-flavoured CityJSONSeq sample. Mimics the shape of an actual
 * 3DBAG export (https://3dbag.nl) closely enough that the parser, loader, and
 * footprint extractor can be smoke-tested against the dataset's distinctive
 * quirks without needing a real download.
 *
 * Real 3DBAG quirks captured here:
 *   - CityJSONSeq newline-delimited transport (header + features)
 *   - CityJSON 2.0 version
 *   - Compound CRS EPSG:7415 (RD New 2D + NAP vertical) declared as the OGC URL
 *   - Three geometries per Building, one per LoD: 1.2 (block), 1.3 (LoD 1.3
 *     extruded with roof variation), 2.2 (full semantic surfaces). 3DBAG ships
 *     all three on the root Building so renderers can pick the LoD they need.
 *   - 3DBAG-specific attributes prefixed `b3_` plus the canonical BAG identifier
 *     and the official `roof type` enum string.
 *   - `b3_pand_deel_id` per BuildingPart (when a building is split across
 *     multiple BAG parts — represented here as one feature with no children
 *     since the multi-part case isn't parser-relevant).
 *
 * Coordinates are placed at TU Delft (RD New ≈ 84500/447500) to match the
 * sample-cube anchor used by other tests.
 */
const HEADER = {
  type: 'CityJSON',
  version: '2.0',
  metadata: {
    referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/7415',
    title: 'synthetic 3DBAG sample',
    geographicalExtent: [84500, 447500, 0, 84520, 447520, 12],
  },
  transform: { scale: [0.001, 0.001, 0.001], translate: [84500, 447500, 0] },
  CityObjects: {},
  vertices: [],
};

// Simple flat box with three LoDs. Vertices are referenced from the feature's
// own `vertices` array (CityJSONSeq style) — the parser must rewrite them to
// global indices after the merge.
const FEATURE_A = {
  type: 'CityJSONFeature',
  id: 'NL.IMBAG.Pand.0599100000000001',
  CityObjects: {
    'NL.IMBAG.Pand.0599100000000001': {
      type: 'Building',
      attributes: {
        identificatie: 'NL.IMBAG.Pand.0599100000000001',
        oorspronkelijk_bouwjaar: 1925,
        status: 'Pand in gebruik',
        b3_pand_deel_id: 1,
        b3_h_dak_50p: 8.45,
        b3_h_dak_70p: 9.10,
        b3_h_dak_max: 9.85,
        b3_h_dak_min: 7.50,
        b3_h_maaiveld: -0.35,
        b3_dak_type: 'multiple horizontal',
        b3_kas_warenhuis: false,
        b3_kwaliteit_class: 5,
        b3_volume_lod12: 156.8,
        b3_volume_lod13: 158.2,
        b3_volume_lod22: 159.1,
        roofType: 1000,
      },
      geometry: [
        // LoD 1.2 — single block at the median roof height
        {
          type: 'Solid',
          lod: '1.2',
          boundaries: [[
            [[0, 1, 2, 3]],     // ground (CCW from below)
            [[7, 6, 5, 4]],     // roof (CCW from above)
            [[0, 4, 5, 1]],     // wall e0
            [[1, 5, 6, 2]],     // wall e1
            [[2, 6, 7, 3]],     // wall e2
            [[3, 7, 4, 0]],     // wall e3
          ]],
        },
        // LoD 1.3 — same as 1.2 but with a small roof variation. For test
        // purposes we re-use the same vertex topology.
        {
          type: 'Solid',
          lod: '1.3',
          boundaries: [[
            [[0, 1, 2, 3]],
            [[7, 6, 5, 4]],
            [[0, 4, 5, 1]],
            [[1, 5, 6, 2]],
            [[2, 6, 7, 3]],
            [[3, 7, 4, 0]],
          ]],
        },
        // LoD 2.2 — full semantics. This is the LoD most viewers prefer.
        {
          type: 'Solid',
          lod: '2.2',
          boundaries: [[
            [[0, 1, 2, 3]],
            [[7, 6, 5, 4]],
            [[0, 4, 5, 1]],
            [[1, 5, 6, 2]],
            [[2, 6, 7, 3]],
            [[3, 7, 4, 0]],
          ]],
          semantics: {
            surfaces: [
              { type: 'GroundSurface' },
              { type: 'RoofSurface' },
              { type: 'WallSurface' },
            ],
            values: [[0, 1, 2, 2, 2, 2]],
          },
        },
      ],
    },
  },
  vertices: [
    [0, 0, 0],
    [10000, 0, 0],
    [10000, 8000, 0],
    [0, 8000, 0],
    [0, 0, 8500],
    [10000, 0, 8500],
    [10000, 8000, 8500],
    [0, 8000, 8500],
  ],
};

// Second feature: a different shape and a `multiple horizontal` roof
// (one of the 3DBAG roof-type strings) to exercise the tint mapping.
const FEATURE_B = {
  type: 'CityJSONFeature',
  id: 'NL.IMBAG.Pand.0599100000000002',
  CityObjects: {
    'NL.IMBAG.Pand.0599100000000002': {
      type: 'Building',
      attributes: {
        identificatie: 'NL.IMBAG.Pand.0599100000000002',
        oorspronkelijk_bouwjaar: 1965,
        b3_pand_deel_id: 1,
        b3_h_dak_50p: 6.20,
        b3_h_maaiveld: -0.35,
        b3_dak_type: 'horizontal',
        roofType: 'flat',
      },
      geometry: [
        {
          type: 'Solid',
          lod: '2.2',
          boundaries: [[
            [[0, 1, 2, 3]],
            [[7, 6, 5, 4]],
            [[0, 4, 5, 1]],
            [[1, 5, 6, 2]],
            [[2, 6, 7, 3]],
            [[3, 7, 4, 0]],
          ]],
          semantics: {
            surfaces: [
              { type: 'GroundSurface' },
              { type: 'RoofSurface' },
              { type: 'WallSurface' },
            ],
            values: [[0, 1, 2, 2, 2, 2]],
          },
        },
      ],
    },
  },
  vertices: [
    [12000, 0, 0],
    [18000, 0, 0],
    [18000, 6000, 0],
    [12000, 6000, 0],
    [12000, 0, 6200],
    [18000, 0, 6200],
    [18000, 6000, 6200],
    [12000, 6000, 6200],
  ],
};

export const SYNTHETIC_3DBAG_SEQ = [HEADER, FEATURE_A, FEATURE_B]
  .map((x) => JSON.stringify(x))
  .join('\n');
