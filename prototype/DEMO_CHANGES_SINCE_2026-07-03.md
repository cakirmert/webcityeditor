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

6. **Trusted road corridors**
   - The Roads panel loads user-approved WGS84 GeoJSON Polygon/MultiPolygon
     corridors, renders their boundary, and blocks road insertion outside the
     corridor union.

7. **Explicit, user-confirmed corridor fitting**
   - `Fit draft widths to corridor` finds the largest projected width that fits
     each section and shows exact before/after totals before changing the draft.
   - It scales bands proportionally and preserves centerlines, order,
     directions, and semantics.
   - It refuses to move an off-corridor centerline or shrink any band below
     0.40 m, leaving manual redraw/editing as the safe fallback.

8. **Cleaner advanced road workflow**
   - Insert, payload export, backend POST, and payload preview live in one closed
     `CityJSON Export & Backend` disclosure.
   - The main band/fit workflow stays visible without the backend controls
     crowding the demo.

## Fastest demo: trusted corridor plus proportional fit

1. From `prototype`, run `npm run dev` and open the printed local URL.
2. In **Data**, load **Hamburg osm2streets roads - real fixture**. This positions
   the map over the committed Hamburg intersection.
3. Open **Roads** and load
   `test-fixtures/road-corridors/hamburg-narrow-demo.geojson` under
   **Trusted road corridor**. A narrow corridor boundary appears north-south
   through the intersection.
4. Choose the manual draw/redraw action and draw a north-south centerline inside
   the corridor, roughly along longitude `9.994`.
5. The default road bands are wider than the corridor, so the overflow is red
   and **Insert CityJSON Road** is blocked.
6. Click **Fit draft widths to corridor**. The confirmation lists every changed
   section as `old width -> fitted width`.
7. Confirm. Band widths shrink proportionally; the centerline and band meanings
   do not change, and the corridor overflow clears.
8. Open **CityJSON Export & Backend** and insert the road.

Useful refusal demo: draw the centerline clearly outside the corridor and click
fit. The editor refuses to translate it and tells you to redraw or edit it
manually. You can also use an extremely narrow corridor to demonstrate the
0.40 m per-band floor.

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

- `npm test`: 56 files, 497 tests passed.
- `npm run build`: TypeScript and the Vite production build passed.
- `git diff --check`: clean.
