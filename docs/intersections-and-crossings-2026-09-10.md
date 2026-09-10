# Intersection generation, cycle lanes and crossing order

10 September 2026 — follow-up to the [Rödingsmarkt implementation](intersection-consolidation-2026-09-10.md).

The editor uses the same Generate and connection tools for loaded junctions throughout the network. **Opening a junction always preserves its saved geometry.** Both ordinary generation and larger consolidations require an explicit click, followed by Save to apply the preview. The two Data study cards and the satellite boundary-tracing button are removed. Satellite comparison, Shape, Generate, islands and optional boundary handles remain.

## Road-over-rail crossings

Altmannbrücke exposed a rendering error: railway layers were appended after all roads. In the published road catalog, OSM ways `32959523` and `32959524` already have road layer +1. The nearby main-line tracks have layer −1, while the U-Bahn tunnels have tunnel tags and layer −2. A negative layer alone does not make the open station cutting a tunnel.

The renderer now groups road surfaces, markings and selection highlights with railway geometry by relative layer. In flat view, higher road surfaces mask the lower railway display paths, so the sleepers do not bleed through a translucent bridge overlay. Narrow seams between carriageways of the same named bridge are closed for display; explicit holes remain. In Levels, road paint and geometry share their display height and depth ordering. Repeated per-track labels were removed.

![Road bridges above the open station cutting](../assets/readme/road-over-rail-current.jpg)

![The same site in the schematic Levels view](../assets/readme/road-over-rail-levels.jpg)

The [Altmannbrücke crop](../public/examples/hamburg-altmannbruecke.json) contains 183 unchanged CityObjects from published road tiles `hh-road-e566-n5933` and `hh-road-e566-n5934`. Its metadata records the source tiles and crop. The existing static railway context comes from the Geofabrik Hamburg OSM snapshot described in the earlier report. No new service is required. Display heights still use six illustrative metres per relative layer; they never become exported elevations or clearance measurements.

## Bicycle pavement and junction size

The old cycling surface was the difference between an outer bicycle outline and an inner carriageway outline. When the next road had no bicycle lane, these outlines converged and the green strip faded to zero width. A larger carriageway could also consume it.

Generation now reserves the original approach cycleways before constructing motor and walking surfaces. Absorbed internal bicycle pavement is retained in the combined junction. Compatible through or slight-turn bicycle continuations use ribbons with positive widths at both ends. Other turning permissions remain visible as connection guides. An unconnected cycle lane keeps its original full-width end. Shared cycle-lane ends are assigned to the junction once, avoiding overlapping approach polygons. Cycle geometry and metadata survive save, reopen and regeneration.

**Nearby pieces** searches within 65 m, using internal roads up to 20 m and at most 12 junction records. **Larger area** extends these limits to 90 m, 35 m and 18 records. Both follow actual endpoint ownership and reject roads connected outside the selected group. A larger search never weakens the crossing-level check. Consolidation stays at ground level; an individual flat underground junction can be rebuilt without losing its underground profile, while mixed levels are refused.

On the unchanged Rödingsmarkt crop, Nearby combines nine junction records and eleven internal roads, leaving thirteen outside approaches. Larger combines thirteen records and seventeen internal roads, leaving twelve outside approaches. Both pass the overlap and save/reopen checks. The camera reframes when the approach set changes. Saved generated boundaries are labelled accordingly.

## Manual generation, road ownership and limits

The automatic-on-selection proposal was removed after user review. Selecting any junction opens all its incoming roads and turn connections without creating a geometry edit or an Undo entry. **Shape → Generate** prepares the rounded draft; **Keep current** or Undo restores the original. Previewing does not mutate CityJSON.

Generated corners now fit to the boundaries of unchanged neighbouring roads at the same crossing level. The neighbouring objects are not edited. A generated component can be discarded as a redundant scrap only if the remaining component reaches every original driving approach; a road cutting through the carriageway still blocks generation. Drawn outlines retain their blocking fit checks. Grade-separated crossings are not clipped into holes.

Ordinary generation trims each old road tip at the same cross-section used to construct the new kerb. Detached rectangular remnants no longer survive outside that rounded corner. Combined footprints also drop detached tip components; real outward approaches and full-width bicycle ends remain. Short **separate source roads** outside an ordinary junction are intentionally still separate: use **Generate combined intersection** to absorb eligible connected pieces together.

All ten locations in the comparison now pass road-overlap checks, including the previously blocked Kajen / Hohe Brücke, Meßberg / Dovenfleet / Willy-Brandt-Straße, and Rathausmarkt / Große Johannisstraße / Rathausstraße. The three complex Rödingsmarkt checks in 5,605 CityObjects across two streamed tiles also pass road-overlap checks after fitting. This is not a claim that every preview passes every surroundings check: in the browser, a seven-piece Meßberg merge remains blocked at two tree trunks, while the ordinary generated junction saves successfully.

![Built-in imagery, original import and rounded candidate at Kurze Mühren](../assets/readme/junction-generation-review.jpg)

Checks cover **loaded** buildings, roads and trees. A roads-only crop contains no building footprints to test against. Existing geometry and its retained overlaps are not treated as newly created collisions. The imagery's capture date is unknown, and generated kerbs remain approximations. Neither connectivity curves nor schematic heights certify vehicle turning clearance or bridge engineering.

## Verification and reproduction

The frontend suite passes **748 tests**, with five pre-existing skips; the production GitHub Pages build also passes.

Regression coverage includes unchanged selection, imported tip cleanup, fitting and saving the three formerly blocked locations with unchanged neighbours, refusal to split a carriageway across another road, both crossing directions, full-width bicycle ends, islands, merge sizes and existing building/tree validation. The previous crossing review and larger Rödingsmarkt save/reopen checks remain covered. The browser was also used to verify unchanged selection, manually generate and save Meßberg, and compare the cleaned Kajen candidate with the original roads and built-in imagery.

```powershell
npm test
npm run build:pages
node scripts/build-roedingsmarkt-example.mjs
node scripts/build-altmannbruecke-example.mjs
npm run review:intersections
```

The optional Docker storage service is unchanged and still prepared for later hosting. GitHub Pages serves the editor and static data; it does not host a shared database.
