# Demo changes since 2026-07-03

This comparison uses the verified end-of-day July 3 road workflow as the
baseline. That baseline already included exact osm2streets lane-polygon
insertion into CityJSON, the real Hamburg road sample, and the tested CityJSON
to CityGML bridge. Those are useful setup steps, but they are deliberately not
claimed as new below.

## What is genuinely new after July 3

1. **Projected Overpass query limiting**
   - Large road fetch windows are capped in the active metric CRS (Hamburg:
     EPSG:25832), then converted back to WGS84 for Overpass.
   - This replaces the earlier metres-per-degree sizing and makes the cap stable
     at Hamburg latitudes.

2. **A full metric exact-surface asset contract**
   - Each selected osm2streets lane now exposes its closed metric surface,
     metric centerline, CRS URI, width, direction, semantic function/usage,
     ids, lane type, and provenance before CityJSON insertion.
   - Exact lane geometry and editable `RoadDraft` ribbons remain intentionally
     separate paths.

3. **Vertical-aware road editing and collision decisions**
   - The road panel now has `Vertical position` and optional absolute elevation.
   - OSM `tunnel`, `covered`, `bridge`, `location`, and `layer` hints survive
     draft creation and CityJSON round-trip.
   - A 2D building overlap can now be a blocking surface collision, a
     `vertical_uncertainty` warning, or no conflict when known z separation is
     sufficient.

4. **Metric building clearance and precise conflict geometry**
   - Under 0.50 m clearance blocks insertion; 0.50-1.00 m warns.
   - Building, planning-land, and corridor conflicts use projected polygon
     intersection/difference. The red map overlay is the actual overlap or
     overflow shape, not the entire building/parcel.

5. **Editable CityJSON road layouts after reopen**
   - Roads inserted from an editable draft persist `_roadLayout` metadata.
   - After export/reload, selecting one of those road surfaces offers
     `Edit saved layout`; exact imported surfaces without that metadata stay
     inspect-only.

6. **Corridor algorithms retained, incomplete UI removed**
   - WGS84 corridor normalization, fit validation, and proportional fitting
     remain covered as pure infrastructure.
   - The manual `Trusted road corridor` upload/blocking workflow was removed on
     2026-07-14 because it was neither automatic nor backed by an authoritative
     project source. It can return only with an automatic trusted dataset.

8. **Cleaner advanced road workflow**
   - Insert, payload export, backend POST, and payload preview live in one closed
     `CityJSON Export & Backend` disclosure.
   - The main band/fit workflow stays visible without the backend controls
     crowding the demo.

## Fastest demo: stable semantic road rendering

1. From `prototype`, run `npm run dev:frontend` and open the printed local URL.
2. In **Data**, load **Hamburg osm2streets roads - real fixture**. This positions
   the map over the committed Hamburg intersection.
3. Open **Roads**, pick a dark driving surface, and create its editable draft.
   The exact polygon stays visible with the same semantic fill; only its outline
   and centerline handles indicate selection/editing.
4. Fetch/recalculate a central Hamburg view and pick a red lane. The inspector
   identifies it as **Bus**, so red is semantic rather than a random car-lane
   state.
5. Toggle **Satellite** to show imagery beneath the translucent roads. Mark a
   draft **Underground** to apply the additional half-opacity treatment.
6. Click **Planning** once; both paginated sources load for the bounded current
   view, after which the actions become **Refresh Planning** and **Hide**.

## Second demo: vertical and clearance decisions

1. Load the hosted Hamburg building sample and open **Roads**.
2. Draw a surface road across a building. The actual overlap polygon is red and
   insertion is blocked.
3. Change **Vertical position** to underground without entering a trusted
   elevation. The overlap becomes a vertical-uncertainty warning instead of a
   silently accepted road.
4. Enter an absolute elevation clearly separated from the building's vertical
   range. The 3D-aware collision clears.
5. Draw or drag a road just beside a building: under 0.50 m blocks, while
   0.50-1.00 m produces a warning.

## Third demo: editable CityJSON round-trip

1. Create and insert an editable road, then export the CityJSON.
2. Reload that exported file through **Data**.
3. Click a road surface and choose **Edit saved layout**.
4. Reorder bands, change widths, or split the section, then insert the revised
   road. The exact osm2streets sample remains inspect-only because it preserves
   exact source polygons instead of pretending they are editable ribbons.

## Verification snapshot

- `npm test`: 56 files, 508 tests passed.
- `npm run build:pages`: TypeScript and the Vite Pages production build passed.
- `git diff --check`: clean.
