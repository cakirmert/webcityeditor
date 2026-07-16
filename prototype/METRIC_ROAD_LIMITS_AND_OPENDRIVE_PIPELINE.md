# Metric Road Limits and OpenDRIVE Pipeline Plan

> **Status**: Road-fit baseline, metric clearance, query limiting, and vertical
> profiles are implemented. Corridor normalization/fitting remains tested as a
> pure library, but its manual upload UI was removed pending an authoritative
> automatic source. The pinned r:trån runner now covers OpenDRIVE validation and
> CityGML-conversion orchestration; a real fixture and importer remain.
> **Date**: 2026-06-25  
> **Scope**: `webcityeditor/prototype` road editor, Hamburg building/planning context, OpenDRIVE trial import path

This companion plan adds the missing detail behind two related decisions:

1. Road geometry must move to a metric editing base, with EPSG:25832 as the Hamburg default.
2. Building and planning data should constrain roads, so road surfaces cannot silently cut through buildings or exceed the intended corridor.
3. OpenDRIVE import should be tried as a backend/data pipeline through `r:trån`, then normalized into the same editable road model used by the browser.

Related documents:

- [`CITYGML_TRANSPORTATION_PLAN.md`](CITYGML_TRANSPORTATION_PLAN.md)
- [`OSM2STREETS_STREET_EXPLORER_PARITY_PLAN.md`](OSM2STREETS_STREET_EXPLORER_PARITY_PLAN.md)
- [`OSM2STREETS_FORK_PLAN.md`](OSM2STREETS_FORK_PLAN.md)

## Assumption About "tron"

This plan assumes "tron" refers to TUM GIS `r:trån` / `rtron`, the OpenDRIVE-to-CityGML road-space transformer. If a different TRON tool was meant, keep the metric constraint model below and swap only the OpenDRIVE conversion adapter.

## Current Baseline

The prototype already has the important pieces to build on:

- Hamburg CityJSONSeq building tiles stream by camera viewport.
- Building footprints are extracted from the loaded CityJSON working set.
- Hamburg planning polygons are fetched by viewport from the planning overlay.
- `RoadDraft` is the editable road model.
- `insertRoadIntoCityJson()` generates CityJSON Transportation `Road` surfaces.
- `validateRoadFit()` checks generated road preview polygons against building footprints and planning/land polygons.
- `useRoadEditor()` blocks insertion for hard building-overlap conflicts and shows warning conflicts on the map.

Road-fit overlap, difference, clearance, and corridor-fit geometry now runs in
the active metric CRS and returns precise WGS84 highlight polygons. The pure
corridor parser and fit algorithm still find the largest safe proportional band
width and refuse to move a centerline or shrink a band below 0.40 m. The app no
longer asks users to load a supposedly trusted file: those controls and their
blocking behavior were removed on 2026-07-14 until a project-authoritative
automatic corridor source is available.

## Metric Editing Principle

WGS84 should be treated as an exchange format for the map, Overpass, and GeoJSON display. All geometry that needs distances, offsets, widths, snapping, clipping, or collision checks should use a projected metric CRS.

For Hamburg:

- Default active CRS: `EPSG:25832` (ETRS89 / UTM zone 32N).
- Existing source support: `prototype/src/lib/projection.ts` already registers EPSG:25832 and detects it for common UTM-like CityJSON documents.
- Road editor target: convert road centerlines, osm2streets polygons, planning polygons, and building footprints to the active metric CRS before fit checks.

For other cities:

- Prefer the loaded CityJSON `metadata.referenceSystem` when it is supported and metric.
- Fall back to a UTM zone derived from the map center.
- Keep `RoadDraft` numeric widths in metres, never in degrees.

## Road Limit Model

The road limit should be an explicit geometric constraint context:

```ts
interface RoadConstraintContext {
  crs: string;
  roadAreasM: MetricPolygonFeature[];
  buildingBlockersM: MetricPolygonFeature[];
  allowedCorridorsM: MetricPolygonFeature[];
  affectedLandM: MetricPolygonFeature[];
  softPlanningZonesM: MetricPolygonFeature[];
  verticalPolicy: 'unknown-2d' | 'surface-only' | 'z-aware';
}
```

Hard blockers:

- Existing building footprints, buffered by a configurable clearance.
- Edited but unsaved building footprints in the current working set.
- Optional protected objects when they become available, such as trees, monuments, utilities, or water boundaries.

Allowed corridors:

- Future cadastral or right-of-way polygons.
- Official road-space polygons when available.
- OSM `area:highway` polygons as a weak source.
- A generated corridor around existing OSM/osm2streets road geometry as a fallback, clearly marked as inferred.

Soft planning constraints:

- Hamburg XPlan/FNP polygons already fetched by viewport.
- Land-use polygons that are relevant to road-space impact but are not precise enough to hard-block edits.
- Parcel/lot polygons once a reliable source is added.

## Constraint Rules

The validator should return structured conflicts, not only booleans:

```ts
type RoadLimitSeverity = 'error' | 'warning' | 'info';

interface RoadLimitConflict {
  id: string;
  severity: RoadLimitSeverity;
  kind:
    | 'building_overlap'
    | 'building_clearance'
    | 'outside_corridor'
    | 'affected_planning_area'
    | 'vertical_uncertainty'
    | 'missing_corridor_data';
  roadAreaId: string;
  affectedId?: string;
  areaM2?: number;
  clearanceM?: number;
  verticalSeparationM?: number;
  label: string;
  polygonWgs84: [number, number][];
  polygonMetric: [number, number][];
}
```

Default rule behavior:

- `building_overlap`: error, blocks insertion/export.
- `building_clearance`: error or warning depending on configured clearance policy.
- `outside_corridor`: warning until a trusted corridor source exists; then error.
- `affected_planning_area`: warning, with an override path.
- `vertical_uncertainty`: warning when a 2D overlap might be valid because the road is underground, covered, tunneled, on a bridge, or otherwise vertically separated.
- `missing_corridor_data`: info, shown only when corridor checks are requested but no source is loaded.

## 3D and Underground Roads Caveat

Planning/building footprint limits must not become a naive "2D overlap means illegal road" rule. Some roads are below grade, covered, or tunneled and can legitimately pass underneath buildings or building footprints. Other road segments can be elevated above land parcels or cross over lower infrastructure.

Validation should therefore be conservative:

- If the road is known to be at surface level and overlaps a building footprint, treat it as a blocking `building_overlap`.
- If the road has evidence of being underground or vertically separated, such as `tunnel=yes`, `covered=yes`, `layer=-1`, OpenDRIVE elevation, CityGML Tunnel/Transportation elevation, or a reliable z profile, do a z-aware clearance check before blocking.
- If the road overlaps a building footprint in 2D but vertical data is missing, report `vertical_uncertainty` as a warning instead of silently deleting or clamping the road.
- Portal, ramp, and cut-and-cover entrances should still be checked at surface level where they emerge.
- Planning polygons can still be affected by underground construction, but that is a different warning than "road surface hits building".

The first implementation can stay 2D for visible surface-road editing, but the API and conflict model should leave room for z-aware checks before corridor limits become hard blockers.

## Building and Planning Data as Road Limits

The loaded building and planning data should constrain streets in three stages.

### Stage 1: Visibility and Blocking

Use existing `validateRoadFit()` behavior, but project all input polygons to the active metric CRS before intersection tests.

Tasks:

- Add projection helpers for WGS84 rings and bboxes.
- Convert `RoadArea.polygon`, building footprints, and planning polygons to EPSG:25832 for Hamburg.
- Compute overlap polygons where possible, not only "these two polygons intersect".
- Inspect road vertical hints from OSM tags, OpenDRIVE import metadata, or CityJSON semantics before escalating a 2D footprint overlap to a hard blocker.
- Keep rendering conflict polygons in WGS84 so deck.gl can draw them.

Acceptance:

- A surface-level road preview that crosses a loaded building is blocked.
- A road preview marked as underground or vertically separated is reported as `vertical_uncertainty` or checked with z clearance instead of automatically blocked by the building footprint above.
- The map highlights the affected building/overlap area.
- The conflict list names the road surface and affected building id.

Implemented slice (2026-07-10): `RoadDraft` and `RoadArea` carry optional
vertical profiles. Manual roads default to surface; OSM `tunnel`, `covered`,
`bridge`, `location`, and `layer` tags are retained as vertical evidence; exact
osm2streets surfaces use the same path. Missing z becomes a warning, known
separation clears the conflict, and known in-range elevation remains blocking.
The 2026-07-12 slice added robust metric overlap/difference polygons for the
highlight layer.

### Stage 2: Clearance and Fit

Road surfaces should not merely avoid buildings; they should respect a small clearance.

Recommended initial defaults:

- `0.50 m` hard minimum around buildings for editing feedback.
- `1.00 m` warning threshold for future sidewalk/building-face comfort checks.
- Per-project settings later, because legal clearances are jurisdiction and context specific.

Tasks:

- Buffer building footprints in metric CRS.
- Test road surfaces against both raw footprints and buffered footprints.
- Distinguish direct overlap from clearance violation in the UI.
- Add tests for roads just inside and just outside the clearance buffer.

Acceptance:

- Direct building overlap stays a blocking error.
- Near-building clearance violations are reported separately.
- WGS84 precision does not create false positives because the work happens in metres.

Implemented slices:

- 2026-07-10: `validateRoadFit()` accepts a metric CRS and a
  building-clearance warning threshold. The road editor passes the active metric
  CRS with a 1 m warning threshold, and focused tests cover road polygons just
  inside and just outside that clearance.
- 2026-07-11: `validateRoadFit()` also accepts a 0.5 m hard building-clearance
  threshold. The road editor passes that threshold for editable draft previews
  and exact osm2streets insert previews, so direct footprint overlap and
  sub-0.5 m clearance now block insertion while 0.5-1 m remains warning-only.

### Stage 3: Corridor-Aware Editing

Once a corridor source exists, the editor should use it to guide road creation.

Tasks:

- Add `allowedCorridors` to the road editor state.
- Render the active corridor boundary while editing roads.
- Snap or clamp road-width handles to the corridor only after the warning-only validator is stable.
- Offer "fit to corridor" as an explicit action, not as silent geometry mutation.

Implemented slices (2026-07-14): `useRoadEditor()` owns optional trusted
corridors imported from user-approved WGS84 GeoJSON Polygon/MultiPolygon files.
The road panel exposes load/clear controls, MapView renders the active boundary,
and both editable-draft previews and exact osm2streets insert checks pass the
corridors into `validateRoadFit()` as blocking trusted constraints. The editor
also exposes `Fit draft widths to corridor`: it binary-searches projected
preview geometry for the largest safe proportional width per section, presents
the proposed before/after widths for confirmation, and refuses centerline moves
or bands narrower than 0.40 m.

Acceptance:

- The user can see why a street is considered too wide.
- The editor does not silently shrink lanes without confirmation.
- All conflict polygons are recomputed when buildings, planning data, or the road draft changes.

## Recommended Geometry Library Work

The original pure TypeScript polygon checks were sufficient only for coarse
feedback. Metric conflict highlighting and corridor fitting required robust
projected polygon operations.

Evaluate:

- `martinez-polygon-clipping` for intersection, difference, and union.
- `polygon-clipping` for similar Boolean operations with GeoJSON-like arrays.
- Turf only for light helper work; do not rely on WGS84-area functions for metric fit.

Selection criteria:

- Works in browser and tests.
- Accepts projected metre coordinates.
- Handles MultiPolygon output.
- Has deterministic output for small fixtures.
- Does not force a large GIS stack into the browser bundle.

Implemented slice (2026-07-12): `polygon-clipping` is now used inside
`validateRoadFit()` for projected intersection/difference conflict geometry.
The validator converts road, building, planning, and corridor rings into metres,
computes overlap or overflow polygons, then converts the highlighted polygon
back to WGS84 for the existing deck.gl conflict layer.

## Road Limit Implementation Order

1. ✅ Add active metric CRS helpers.
2. ✅ Replace road-query meters-per-degree math with metric bbox clipping.
3. ✅ Project road/building/planning/corridor operations at the validator boundary; a separate `projectRoadFitContext()` wrapper was unnecessary.
4. ✅ Add robust polygon intersection/difference output, not only intersection tests.
5. ✅ Split conflicts into hard blockers and warnings.
6. ✅ Add metric building-clearance warnings plus the separate 0.5 m hard buffer.
7. ✅ Add OSM/manual vertical profiles, known-z separation, and `vertical_uncertainty` handling.
8. ✅ Implement and test corridor import/fit algorithms, then remove the manual
   editor workflow when no authoritative automatic source was available.
9. ✅ Preserve proportional fit, centerline, and minimum-width refusal rules as
   dormant pure infrastructure for a future trusted source.

## OpenDRIVE / r:trån Trial Pipeline

The goal is not to make OpenDRIVE the internal model. The goal is to import OpenDRIVE when an external `.xodr` dataset exists, then normalize it into either:

- editable `RoadDraft` sections, or
- read-only CityJSON Transportation road surfaces.

The trial pipeline should be server-side or script-based first.

```text
OpenDRIVE .xodr
  -> r:trån validate-opendrive
  -> r:trån opendrive-to-citygml
  -> CityGML 3 Transportation inspection
  -> citygml-tools to-cityjson trial
  -> prototype normalizer
  -> RoadDraft or read-only CityJSON Transportation overlay
```

## Why r:trån First

Primary sources confirm that `r:trån` supports:

- ASAM OpenDRIVE validation.
- OpenDRIVE to OGC CityGML conversion.
- CityGML 2.0 and 3.0 output.
- Lane topology conversion into the CityGML 3 Transportation module.
- OpenDRIVE geometry, roads, lanes, junctions, objects, signals, and railroads with documented support levels.

That makes it the right first bridge for `.xodr` input. It should not replace osm2streets for normal OSM road visualization.

## Trial Dataset

Start tiny:

- One road with two driving lanes.
- One bike lane or sidewalk if available.
- One simple junction.
- Known georeferencing.

Good candidates:

- A small r:trån sample if the repository includes one.
- A minimal hand-authored `.xodr` fixture generated only for tests.
- A small public sample from an OpenDRIVE example set, if licensing permits committing it.

Do not start with a full city. The first target is semantic preservation, not scale.

## Pipeline Commands to Try

Use pinned tool versions and record them in the output directory.

```powershell
# 1. Validate OpenDRIVE.
java -jar tools\rtron\rtron.jar validate-opendrive `
  data\opendrive\input `
  data\opendrive\reports

# 2. Convert OpenDRIVE to CityGML.
java -jar tools\rtron\rtron.jar opendrive-to-citygml `
  data\opendrive\input `
  data\opendrive\citygml

# 3. Convert CityGML to CityJSON as a trial.
docker run --rm -v ${PWD}\data\opendrive\citygml:/data citygml4j/citygml-tools:v2.5.0 `
  to-cityjson *.gml
```

PowerShell path quoting on Windows will likely need adjustment. Treat these as pipeline shape, not final automation.

## What to Inspect After Conversion

For r:trån CityGML output:

- Does it emit CityGML 3 Transportation classes for lanes and junctions?
- Are lane directions preserved?
- Are predecessor/successor links present?
- Are road markings represented as surfaces or attributes?
- Are sidewalks, bike lanes, parking, shoulders, and medians distinguishable?
- Does CRS/georeferencing survive?
- Are surfaces valid enough for CityJSON conversion?

For citygml-tools CityJSON output:

- Does it produce CityJSON 2.0 `Road`, `Railway`, or `TransportSquare` objects where expected?
- Are `TrafficArea` and `AuxiliaryTrafficArea` semantics preserved?
- Are object ids stable enough to map back to OpenDRIVE ids?
- Are lane topology links lost, and if so can they be carried in private metadata?
- Does the output load in the prototype without breaking building-focused assumptions?

## Normalizer Contract

The importer should not expose raw CityGML details to the UI. It should produce a compact internal shape:

```ts
interface ImportedRoadNetwork {
  source: 'opendrive-rtron-citygml';
  sourceFiles: string[];
  crs: string;
  roads: ImportedRoad[];
  diagnostics: ImportDiagnostic[];
}

interface ImportedRoad {
  id: string;
  name?: string;
  openDriveRoadId?: string;
  centerlineM?: [number, number][];
  surfacesM: ImportedTrafficSurface[];
  topology?: ImportedRoadTopology;
}
```

Then choose one of two display modes:

- Reference import: draw surfaces directly, no editing.
- Editable import: convert compatible lane groups into `RoadDraft` sections.

Reference import should come first, because it avoids pretending every OpenDRIVE construct maps cleanly to the current lane-band editor.

## OpenDRIVE Implementation Order

1. [x] Create `prototype/scripts/opendrive/README.md` with pinned r:trån 1.3.0
   setup and a dry-run-capable `scripts/opendrive-rtron.mjs` runner.
2. Add a tiny `.xodr` fixture or document a downloaded sample outside git.
3. Run `validate-opendrive` and commit only the summarized report if licensing prevents fixture commit.
4. Run `opendrive-to-citygml` and inspect the CityGML classes.
5. Run `citygml-tools to-cityjson`.
6. Add a focused parser for the produced Transportation subset.
7. Render the imported surfaces as a read-only road layer.
8. Convert only simple lane groups to `RoadDraft`.
9. Run road-limit validation against imported surfaces.
10. Decide later whether an exporter back to OpenDRIVE is needed.

## Combined Workflow

When both pieces exist, the intended workflow is:

1. Buildings stream from Hamburg CityJSONSeq by camera.
2. Planning polygons stream or refresh for the same viewport.
3. Roads are fetched or imported intentionally.
4. Road surfaces are generated in the active metric CRS.
5. Building/planning/corridor constraints flag invalid roads.
6. Valid roads insert as CityJSON Transportation.
7. Optional OpenDRIVE-derived roads remain traceable back to `.xodr` ids through metadata.

## Testing Checklist

Road limit tests:

- [x] Road fully outside all buildings and inside corridor: no conflict.
- [x] Road overlaps a building: blocking `building_overlap`.
- [x] Road touches only the delivered 1 m warning threshold: `building_clearance`.
- [x] Underground/elevated road overlaps in 2D with known vertical separation: no building conflict.
- [x] Road overlaps in 2D with missing vertical elevation: `vertical_uncertainty` warning unless surface-level.
- [x] Known road elevation inside the building range remains blocking.
- [x] Road leaves corridor: `outside_corridor`.
- [x] Road crosses planning/land polygons: `affected_land`.
- [x] Missing corridor source: no hard block.
- [x] Trusted-corridor normalization and boundary helpers covered as dormant pure-library infrastructure.
- [x] Proportional fit-to-corridor and refusal paths covered in pure helpers; the editor control is removed pending an authoritative source.

OpenDRIVE pipeline tests:

- [x] Pinned r:trån validation/conversion plan resolves without filesystem mutation.
- [ ] r:trån validation report is captured from a real tiny fixture.
- [ ] CityGML output contains expected Transportation objects.
- [ ] CityGML to CityJSON conversion succeeds or failure is documented.
- [ ] Prototype can load/render a small converted road network.
- [ ] Lane/bike/sidewalk semantics are either preserved or explicitly reported as lost.
- [ ] Imported road surfaces run through the same road-limit validator.

## Decisions to Make Later

- Which Hamburg dataset should be the first trusted road corridor source?
- Should corridor overflow become a hard error only after parcel/right-of-way data is loaded?
- What vertical clearance threshold should distinguish true building collision from a valid underground or elevated road?
- Which source should win when OSM `layer`/`tunnel`, OpenDRIVE elevation, and CityGML geometry disagree?
- Should OpenDRIVE-derived roads be editable immediately or start read-only?
- Should lane topology be stored in CityJSON private metadata, a sidecar graph, or both?
- Should we build a custom CityGML Transportation parser before relying on CityJSON conversion?
- Do we need CityJSONSeq output for road networks, or is a single road-layer document enough?

## References Checked

- r:trån project site: <https://rtron.io/>
- r:trån GitHub repository: <https://github.com/tum-gis/rtron>
- r:trån OpenDRIVE feature support: <https://rtron.io/docs/opendrive-feature-support>
- ASAM OpenDRIVE 1.9.0 specification page: <https://publications.pages.asam.net/standards/ASAM_OpenDRIVE/ASAM_OpenDRIVE_Specification/v1.9.0/specification/index.html>
- citygml-tools repository: <https://github.com/citygml4j/citygml-tools>
- CityJSON conversion tutorial: <https://www.cityjson.org/tutorials/conversion/>
- CityJSON specs page: <https://www.cityjson.org/specs/>
