# osm2streets Street Explorer Parity Plan

## Purpose

The prototype calls the local `osm2streets-js` WASM fork and now implements the
core Street Explorer parity path: intersection/lane polygons, polygon and line
markings, shared semantic styling, lane/intersection inspection, connected-road
highlighting, and exact CityJSON surface insertion. Optional dynamic debug
layers and a fresh live Hamburg viewport verification remain.

This plan is intentionally detailed so the work can be resumed later without rediscovering the same code paths.

## Reference Files Studied

In `vendor/osm2streets/web`:

- `src/street-explorer/App.svelte`
  - Assembles the explorer map layers in a deliberate z-order.
  - Renders lane polygons, intersection polygons, lane markings, intersection markings, debug layers, block tracing, basemap/theme controls, and popups.
- `src/common/layers/RenderLanePolygons.svelte`
  - Calls `network.toLanePolygonsGeojson()`.
  - Colors lanes by osm2streets lane enum strings such as `Driving`, `Biking`, `Sidewalk`, `SharedUse`, `Bus`, and `Parking(Parallel)`.
- `src/common/layers/RenderIntersectionPolygons.svelte`
  - Calls `network.toGeojsonPlain()`.
  - Filters `properties.type == "intersection"`.
  - Styles by `intersection_kind`: `MapEdge`, `Terminus`, `Connection`, `Fork`, `Intersection`.
- `src/common/layers/RenderLaneMarkings.svelte`
  - Calls `network.toLaneMarkingsGeojson()`.
  - Treats markings as filled polygons, not just stroked lines.
  - Styles by marking `type`: `center line`, `lane separator`, `lane arrow`, `buffer edge`, `vehicle stop line`, `bike stop line`, etc.
- `src/common/layers/RenderIntersectionMarkings.svelte`
  - Calls `network.toIntersectionMarkingsGeojson()`.
  - Styles `sidewalk corner`, `marked crossing line`, and `unmarked crossing outline`.
- `src/common/utils.ts`
  - Defines stable layer ordering:
    `boundary`, `lane-polygons`, `intersection-polygons`, `lane-markings`, `intersection-markings`, then debug/interactive overlays.
- `src/street-explorer/IntersectionPopup.svelte`
  - Shows intersection kind, control, movements, crossing details, and OSM node IDs.
- `src/street-explorer/LanePopup.svelte`
  - Shows lane type, direction, width, speed limit, allowed turns, layer, OSM way IDs, and Muv JSON.

In `vendor/osm2streets/osm2streets`:

- `src/render/mod.rs`
  - `to_geojson()` emits both road polygons and intersection polygons.
  - `to_lane_polygons_geojson()` emits one polygon per lane with lane enum `type`, `road`, `index`, `width`, `direction`, `allowed_turns`, and OSM way IDs.
- `src/render/intersection_markings.rs`
  - Generates sidewalk corner polygons and crossing polygons from intersection geometry.

In this prototype:

- `prototype/src/lib/osm2streets.ts`
  - Returns `plain`, `lanes`, `laneMarkings`, and `intersectionMarkings` from
    the source-built fork.
- `prototype/src/components/MapView.tsx`
  - Renders lane/intersection polygons plus polygon and line marking layers in
    explorer-style order through shared layer/style helpers.
- `prototype/src/hooks/useRoadEditor.ts`
  - Limits OSM queries in the active metric CRS, exposes inspection/highlight
    state, and validates both editable and exact-surface insertion previews.
- `prototype/src/lib/transportation.ts`
  - Projects editable `RoadDraft` ribbons into the document CRS and carries
    vertical-placement metadata for road-fit decisions.
- `prototype/src/lib/osm2streets-draft.ts`
  - Normalizes exact lane polygons into the metric `TrafficAreaPolygonAsset`
    export contract before CityJSON insertion.

## Original Gaps And Current Resolution

1. **Intersection polygons — delivered.** The wrapper returns `plain`, and the
   map filters/renders explorer-style intersection surfaces separately from
   intersection markings.
2. **Lane colors — delivered.** Shared `osm2streets-style.ts` helpers understand
   Rust enum display values such as `Biking`, `Driving`, `Sidewalk`, parking,
   buffer, bus, and shared-use types.
3. **Lane/intersection markings — delivered.** Polygon markings retain their
   fill geometry, while line features receive dedicated stroked layers.
4. **Interactive inspection — delivered.** Lanes and intersections expose ids,
   direction, width, turns, OSM provenance, draft creation, exact insertion,
   and connected-road highlighting.
5. **Metric boundary — delivered for distance/export work.** Map/API exchange
   stays WGS84, Overpass limits are computed in the active projected CRS, and
   exact traffic-area assets are projected into the active metric CRS before
   CityJSON insertion.
6. **Semantic render drift — substantially addressed.** Reference and inserted
   road layers reuse shared semantic colors and real Hamburg fixtures. Editable
   `RoadDraft` ribbons remain a deliberate separate geometry representation,
   with shared styling rather than pretending to retain exact polygons.

Remaining parity work is a fresh live Hamburg Overpass/browser pass, optional
dynamic debug layers, and a schema decision for persisted intersections.

## Target Architecture

### Principle

Use osm2streets as the authoritative lane/intersection geometry preview, but use our CityJSON Transportation model as the editable/persisted representation.

That means:

- osm2streets layers are the "reference/explorer" visualization.
- RoadDraft and CityJSON Transportation remain the "edit/export" model.
- The bridge between the two must preserve IDs and dimensions so an osm2streets lane or road can seed an editable RoadDraft without losing provenance.
- Rendering helpers are shared across initial preview and edit mode, so lane semantics do not change just because a road becomes editable.

### Data Flow

1. User opens road editor and fetches OSM for the current map bbox.
2. OSM XML is passed into `osm2streets-js`.
3. WASM result returns:
   - lane polygons
   - plain road/intersection polygons
   - lane markings
   - intersection markings
   - diagnostics
   - source bbox
   - source projection metadata used by the app
4. Map renders these layers in explorer-like z-order.
5. Clicking a lane or intersection opens an inspector.
6. User can:
   - keep osm2streets as visual reference
   - create/edit a RoadDraft from selected osm2streets road/lane data
   - export/insert CityJSON Transportation surfaces in the document CRS
   - produce final JSON/CityJSON and CityGML outputs from the normalized road model

## Metric and CRS Plan

### Required Direction

Use a projected metric CRS for all distance-sensitive geometry operations,
offsets, widths, snapping, CityJSON creation, and clearance validation. For
Hamburg this should be EPSG:25832, ETRS89 / UTM zone 32N. `RoadDraft` retains a
WGS84 centerline for map editing, then projects it at the computation boundary.

### Boundary Rules

- WGS84:
  - MapLibre camera.
  - Overpass/OSM API bbox.
  - osm2streets public GeoJSON output, unless we extend the WASM API.
- Metric CRS:
  - Temporary projected `RoadDraft` geometry used for offsets/insertion.
  - Exact `TrafficAreaPolygonAsset` surface polygons and centerlines.
  - Lane offsets and widths.
  - CityJSON vertices.
  - Collision/fit checks against buildings and zoning.
  - Transform handles and numeric move values.
- Conversion boundary:
  - Keep map-edited centerlines in WGS84 and convert to the active metric CRS
    before any distance, width, fit, or persistence calculation.
  - Convert metric CRS to WGS84 only for map display and external OSM/API calls.

### Concrete Work

1. Add an `activeMetricCrs` helper.
   - Preferred source: `detectCrs(cityjson)` when supported and metric.
   - Hamburg default: `EPSG:25832`.
   - Fallback: derive UTM zone from map center and register/use an EPSG code when possible.

2. Replace remaining meters-per-degree approximations.
   - Done for `useRoadEditor.ts` query sizing: the viewport is clamped through
     the active metric CRS and unprojected for Overpass.
   - `BuildingCreator.tsx` contains small local meter approximations for preview metrics. These can remain temporarily for UI estimation, but the long-term goal is the same metric CRS helper.

3. Add road geometry conversion utilities.
   - `lngLatLineToMetric(line, crs)`
   - `metricLineToLngLat(line, crs)`
   - `metricPolygonToLngLat(ring, crs)`
   - `bboxWgs84ToMetric(bbox, crs)`
   - `metricBboxToWgs84(bbox, crs)`

4. Store metric provenance in RoadDraft.
   - Add optional `sourceCrs`, `sourceOsmWayIds`, `sourceOsm2StreetsRoadId`, `sourceLaneIndex`.
   - Do not store editable road widths in degrees.

## Implementation Plan

### Phase 1 - Return the Full osm2streets Visual Contract

Files:

- `prototype/src/lib/osm2streets.ts`
- `prototype/tests/lib/osm2streets.test.ts`

Tasks:

1. Extend `Osm2StreetsResult`:

   ```ts
   export interface Osm2StreetsResult {
     plain: GeoJSON.FeatureCollection;
     lanes: GeoJSON.FeatureCollection;
     laneMarkings: GeoJSON.FeatureCollection;
     intersectionMarkings: GeoJSON.FeatureCollection;
     engine: 'fork';
     diagnostics: Osm2StreetsDiagnostic[];
   }
   ```

2. In `readOsm2StreetsResult`, call:
   - `network.toGeojsonPlain()`
   - `network.toLanePolygonsGeojson()`
   - `network.toLaneMarkingsGeojson()`
   - `network.toIntersectionMarkingsGeojson()`

3. Add validation helpers:
   - Ensure every parsed value is a FeatureCollection.
   - Log feature counts for diagnostics.
   - Treat empty intersection layers as a warning, not a hard failure, because small OSM extracts can legitimately contain only map-edge or degenerate features.

4. Test expectations:
   - Existing fixture must assert `plain.type == "FeatureCollection"`.
   - Assert `plain.features.some(f => f.properties?.type === "intersection")` when using a fixture that contains a real intersection.
   - Add/adjust a fixture if the current fixture is too simple.

Acceptance:

- `processOsmXml` returns the full explorer data contract.
- The test fixture proves intersection polygons are available before touching rendering.

### Phase 2 - Render Explorer-Like Layers

Files:

- `prototype/src/components/MapView.tsx`
- Optional extraction: `prototype/src/lib/osm2streets-style.ts`
- Tests: `prototype/tests/lib/osm2streets-style.test.ts`

Tasks:

1. Add explicit style functions:

   - `osm2streetsLaneFillColor(type: string): Rgba`
   - `osm2streetsIntersectionFillColor(kind: string): Rgba`
   - `osm2streetsLaneMarkingFillColor(type: string): Rgba`
   - `osm2streetsIntersectionMarkingFillColor(type: string): Rgba`
   - `roadBandFillColor(kind: RoadBandKind, sourceType?: string): Rgba`

   These helpers must be used by both the initial osm2streets layers and the editing/preview layers. Do not copy lane-color switches into `MapView.tsx` branches.

2. Match the explorer's lane color semantics:

   - `Driving`: dark asphalt.
   - `Biking`: green.
   - `Sidewalk`, `Shoulder`: light grey.
   - `Footway`: pale pedestrian grey.
   - `SharedUse`: muted yellow-green.
   - `Bus`: red.
   - `LightRail`: brown.
   - `Construction`: orange.
   - `Parking(Parallel)`, `Parking(Diagonal)`, `Parking(Perpendicular)`: dark grey.
   - `Buffer(Curb)`: white.
   - `Buffer(Planters)`: dark buffer/planter grey.
   - Unknown: obvious debug color during development, then restrained fallback.

3. Add intersection polygon layer:

   - Data: `osm2streetsResult.plain`.
   - Filter: `properties.type === "intersection"`.
   - Draw after lane polygons, before lane markings.
   - Style by `intersection_kind`.
   - Make it optionally pickable for inspector.

4. Render lane markings as filled polygons.

   - Use deck.gl `GeoJsonLayer` with `filled: true`, `stroked: false` for polygon markings.
   - If a marking is a LineString in future output, either use a companion PathLayer or pre-normalize to polygon-only.
   - Use type colors:
     - `center line`: yellow.
     - `lane separator`, `lane arrow`, `buffer edge`, `buffer stripe`, `parking hatch`, `vehicle stop line`: white.
     - `sidewalk line`: grey.
     - `bike stop line`: green.
     - `path outline`: black.

5. Render intersection markings after lane markings.

   - `sidewalk corner`: sidewalk grey.
   - `marked crossing line`: white.
   - `unmarked crossing outline`: white or dashed-outline equivalent if deck.gl supports it.

6. Z-order target:

   1. OSM/satellite basemap.
   2. CityJSON/building base layers.
   3. osm2streets lane polygons.
   4. osm2streets intersection polygons.
   5. osm2streets lane markings.
   6. osm2streets intersection markings.
   7. editable RoadDraft handles and selected overlays.
   8. warnings/conflicts/bbox outlines.

7. Keep render-mode parity explicit:

   - Initial osm2streets result render: uses the same `Biking`, `Sidewalk`, `Bus`, parking, and buffer color mapping as edit mode.
   - Selected osm2streets road render: may add an outline or highlight, but must not replace semantic fill colors.
   - RoadDraft preview: maps draft band kinds back to the same visual vocabulary, especially bike lanes and sidewalks.
   - Inserted CityJSON `Road` surfaces: reuse the same TrafficArea/AuxiliaryTrafficArea style mapping so inserted roads do not visually regress after save.

Acceptance:

- A bike lane from osm2streets appears green.
- The same bike lane remains green before selection, while selected, while used as an edit draft, and after insertion as a CityJSON road preview.
- Intersection polygons are visible.
- Crossing and stop-line markings have filled width, not just thin strokes.
- Existing RoadDraft editing remains usable above the osm2streets preview.

### Phase 3 - Add Street Explorer Inspection UX

Files:

- New: `prototype/src/components/Osm2StreetsInspector.tsx`
- `prototype/src/components/MapView.tsx`
- `prototype/src/hooks/useRoadEditor.ts`

Tasks:

1. Track selected osm2streets feature:

   ```ts
   type Osm2StreetsSelection =
     | { kind: 'lane'; feature: GeoJSON.Feature }
     | { kind: 'intersection'; feature: GeoJSON.Feature }
     | null;
   ```

2. Lane inspector fields:

   - lane type
   - road ID
   - lane index
   - direction
   - width
   - speed limit
   - allowed turns
   - OSM way IDs
   - Muv JSON if present

3. Intersection inspector fields:

   - intersection ID
   - kind
   - control
   - crossing kind/island
   - movements
   - OSM node IDs

4. Actions:

   - "Create editable road draft from this road" for lane selections.
   - "Highlight connected roads" for intersection selections.
   - Keep destructive osm2streets transformations such as `collapseIntersection` out of the first pass unless we decide the app should edit the osm2streets network live.

Acceptance:

- Clicking a lane or intersection surfaces the same core information as the Street Explorer.
- User can turn a selected osm2streets road into a local RoadDraft without manually retracing the centerline.

### Phase 4 - Bridge osm2streets Geometry to CityJSON/CityGML Transportation

Files:

- `prototype/src/lib/transportation.ts`
- `prototype/src/lib/osm2streets.ts`
- `prototype/src/hooks/useRoadEditor.ts`

Tasks:

1. Decide what should be persisted:

   - Lane polygons from osm2streets can seed CityJSON Transportation surfaces.
   - Intersection polygons should become CityJSON Road/Intersection surfaces only if we have a clear semantic mapping.
   - CityJSON may need separate `Road`, `Intersection`, `TrafficArea`, and `AuxiliaryTrafficArea` objects depending on desired LoD and schema profile.

2. Preserve osm2streets provenance:

   - `osm2streets_road_id`
   - `osm2streets_lane_index`
   - `osm_way_ids`
   - lane type
   - direction
   - allowed turns

3. Convert WGS84 GeoJSON polygons into active metric CRS before insertion.

4. Validate:

   - Ring closure.
   - No self-intersection.
   - Correct semantic class.
   - No uncontrolled overlap with building footprints unless explicitly allowed.

5. Define the final export contract:

   - Strictly speaking, osm2streets consumes OSM XML and emits GeoJSON-like lane/intersection feature collections; it is not the canonical exporter.
   - The durable export path should be:

     ```text
     OSM XML / Overpass data
       -> osm2streets lane + intersection geometry
       -> RoadDraft with OSM/osm2streets provenance
       -> CityJSON Transportation Road
       -> optional CityGML Transportation export via citygml-tools
     ```

   - JSON output should include both the existing road-edit payload JSON and CityJSON Transportation objects.
   - CityGML output should use CityJSON -> CityGML conversion with `citygml-tools from-cityjson` after semantic preservation is tested.
   - Raw osm2streets GeoJSON can still be exported for debugging, but it should not be the long-term interchange format.

6. Normalize osm2streets output into polygon assets:

   - The end product of the osm2streets path should not be only a centerline or a styled preview feature. It should become one polygon asset per lane, sidewalk, bike lane, parking band, median, or other TrafficArea/AuxiliaryTrafficArea.
   - Each asset should carry enough information to be written directly as CityJSON Transportation and later CityGML Transportation.
   - This is the same shape as the `BikeLaneAsset -> CityJSON Road` converter pattern: a `surfacePolygon` plus semantic and provenance attributes.

   ```ts
   interface TrafficAreaPolygonAsset {
     id: string;
     name?: string;
     source: 'osm2streets';
     crsUri: string;
     roadId: string;
     sectionId: string;
     trafficSpaceId: string;
     trafficAreaId: string;
     laneType: string;
     trafficDirection: 'forward' | 'backward' | 'both' | 'none';
     granularity: 'lane' | 'road_section' | 'intersection';
     centerLineRole: 'derived_from_osm' | 'derived_from_osm2streets' | 'manual';
     centerLine: [number, number, number][];
     widthMeters?: number;
     surfacePolygon: [number, number, number][];
     functionCode: string;
     functionLabel: string;
     usageCode: string;
     usageLabel: string;
     osmWayIds?: string[];
     osmNodeIds?: string[];
     osm2streetsRoadId?: string;
     osm2streetsLaneIndex?: number;
     tags?: Record<string, string>;
   }
   ```

   - `surfacePolygon` is the export-critical geometry. It should be closed, valid, and in the active metric CRS, not degrees.
   - `centerLine` is retained for editing, graph building, and provenance, but the CityJSON surface should come from `surfacePolygon`.
   - Bike lanes must preserve `laneType`, `functionCode`/`functionLabel`, and `usageCode`/`usageLabel`, so they do not degrade into generic road asphalt during export.
   - Intersections can use the same contract with `granularity: 'intersection'` once the CityJSON object/semantic mapping is settled.

Acceptance:

- A selected osm2streets road can become a valid CityJSON Transportation set in EPSG:25832.
- The same osm2streets-derived road can be exported as structured JSON/CityJSON and has a documented path to CityGML Transportation.
- Each exported traffic area is backed by a polygon asset with lane type, direction, width, centerline, function/usage semantics, and OSM/osm2streets provenance.
- Inserted bike lanes remain semantically bike lanes and visually green.
- Intersections can be inserted or at least retained as reference geometry without disappearing.

### Phase 5 - Optional Dynamic Debug Layers

Reference explorer layers:

- `DynamicConnectedRoads.svelte`
- `DynamicMovementArrows.svelte`
- `DynamicRoadOrdering.svelte`
- `DebugIDs.svelte`

Tasks:

1. Add debug toggles to Road Editor, not the main toolbar.
2. Use WASM debug methods only when requested:
   - `debugRoadsConnectedToIntersectionGeojson`
   - `debugClockwiseOrderingForIntersectionGeojson`
   - `debugMovementsFromLaneGeojson`
3. Keep debug layers out of persisted CityJSON.

Acceptance:

- Debug layers help diagnose missing intersections and movement logic.
- Normal editor users are not overwhelmed by internal osm2streets diagnostics.

## Performance Plan

1. Cache osm2streets results by:
   - OSM XML hash.
   - clip bbox.
   - import options.
2. Cancel or ignore stale computations when the user fetches a new bbox.
3. Keep osm2streets fetch manual, unlike building tiles.
   - Roads are heavy semantic processing.
   - Buildings stream by camera movement.
   - The user request explicitly wants these paths separate.
4. Add feature-count status:
   - lane polygons count
   - intersection polygons count
   - lane markings count
   - intersection markings count
5. If feature counts are high:
   - hide markings below a zoom threshold
   - keep lane/intersection polygons visible
   - simplify hover/picking until zoomed in

## Testing Plan

Unit tests:

- `osm2streets.ts`
  - returns `plain`, `lanes`, `laneMarkings`, `intersectionMarkings`.
  - preserves diagnostics.
- `osm2streets-style.ts`
  - `Biking` maps to green.
  - `Driving` maps to asphalt.
  - `Sidewalk` maps to grey.
  - `Parking(Parallel)` maps to parking grey.
  - unknown lane type maps to fallback.
  - marking types map to expected colors.
- `osm2streets-draft.ts` and `osm2streets-cityjson.ts`
  - WGS84 osm2streets polygons project to EPSG:25832 without losing closure.
  - inserted lane surfaces preserve `transportationUsage`.
  - osm2streets-derived drafts export to CityJSON `Road` objects with provenance.
  - `TrafficAreaPolygonAsset.surfacePolygon` becomes a CityJSON `MultiSurface` boundary and preserves function/usage semantics.

Integration tests:

- Use a fixture with a real four-way intersection and bike lane tags.
- Assert:
  - intersection polygons feature count > 0.
  - at least one `Biking` lane exists.
  - at least one crossing/sidewalk corner marking exists when tags support it.
  - exporting the selected osm2streets-derived draft produces JSON/CityJSON with bike-lane semantics intact.
  - the exported bike-lane asset has `surfacePolygon`, `centerLine`, `widthMeters`, `trafficDirection`, `functionCode`, and `usageCode`.

Browser/visual checks:

- Start `npm run dev`.
- Fetch OSM roads in Hamburg.
- Verify:
  - bike lanes are green.
  - bike lanes stay green in the initial osm2streets render, selected-road state, editable RoadDraft preview, and inserted-road render.
  - intersections are visible.
  - lane/intersection markings draw above lane polygons.
  - selected RoadDraft handles draw above osm2streets.

## Risks and Open Questions

1. osm2streets output is WGS84 GeoJSON.
   - For metric editing, either project the output immediately in JS or extend the WASM binding to expose metric coordinates before conversion to GeoJSON.
   - Projecting in JS is fastest to implement.
   - Extending WASM is cleaner long term if we need exact internal geometry and stable IDs.

2. Intersection persistence is a schema decision.
   - Visual intersection polygons are easy.
   - Persisting them into CityJSON Transportation needs an agreed object/semantic mapping.

3. osm2streets transformations are mutable.
   - The explorer exposes operations like collapsing intersections and zipping sidepaths.
   - Our first pass should inspect and seed drafts, not mutate the osm2streets network, unless we add an explicit "advanced cleanup" mode.

4. Layering with buildings can become noisy.
   - At low zoom, buildings should stay 2D and roads/intersections should stay readable.
   - At high zoom, editable road layers and osm2streets markings should draw above building footprints.

5. OSM tags vary by country.
   - Hamburg/Germany should use right-side driving and EPSG:25832.
   - We should keep `buildOsm2StreetsImportOptions` explicit and test Germany-specific lane/cycleway tags.

## Suggested Implementation Order

1. ✅ Add `plain` output from `toGeojsonPlain()` and test it.
2. ✅ Add explorer-style color helpers and tests.
3. ✅ Render intersection polygons.
4. ✅ Fix lane polygon colors for osm2streets enum values.
5. ✅ Render polygon and line lane/intersection markings with appropriate layers.
6. ✅ Add lane/intersection inspector readouts and actions.
7. ✅ Replace road query meters-per-degree math with active-CRS metric bbox conversion.
8. ✅ Add "create RoadDraft from osm2streets road" as the first editable bridge.
9. ✅ Reuse semantic color helpers for reference, draft, and inserted road layers.
10. ✅ Add JSON/CityJSON coverage for editable drafts and selected exact polygons.
11. ✅ Add the full metric `TrafficAreaPolygonAsset` normalization contract in
    `osm2streets-draft.ts`, including surface/centerline geometry, CRS,
    function/usage semantics, ids, width, direction, and provenance.
12. ✅ Use CityJSON -> CityGML through `npm run cityjson:to-citygml`.
13. Decide how intersection polygons should persist in CityJSON Transportation.
14. Add optional debug layers only after the main visual parity path is stable.

## Definition of Done for Explorer Parity

- Fetching OSM roads in Hamburg shows lane polygons, intersection polygons, lane markings, and intersection markings.
- Bike lanes are visually distinct and green.
- Bike lanes remain visually distinct across initial render, selected state, edit preview, and inserted-road rendering.
- Sidewalks, parking lanes, bus lanes, buffers, and shared-use paths have stable colors.
- Intersections are selectable or inspectable.
- Road drafting/editing still works and remains visually on top of the osm2streets reference layers.
- An OSM XML / osm2streets-derived road can become JSON/CityJSON output, with a tested or documented CityGML Transportation export path.
- osm2streets-derived lanes, including bike lanes, are normalized as metric surface polygons with centerline, width, direction, function/usage, and provenance attributes before export.
- Persisted exact road surfaces and all distance-sensitive operations use the
  active metric CRS, preferably EPSG:25832 for Hamburg.
- `RoadDraft.centerlineWgs84` remains the editable map-exchange coordinate
  shape and is projected before width, fit, and insertion calculations.
