# Intersection generation, cycle lanes and crossing order

10 September 2026 — follow-up to the [Rödingsmarkt implementation](intersection-consolidation-2026-09-10.md).

The editor now uses the same Generate and connection tools for loaded junctions throughout the network. It proposes ordinary rounded junctions on selection when checks pass; larger consolidations remain explicit previews followed by Save. The two Data study cards and the satellite boundary-tracing button are removed. Satellite comparison, Shape, Generate, islands and optional boundary handles remain.

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

## Automatic previews and limits

An unedited junction with up to four approaches can open with a rounded proposal if construction, overlap and available surroundings checks pass. A custom outline or previously generated junction stays as saved. Previewing does not mutate CityJSON. Turn permissions and Shape generation remain available when the original surface must be retained.

The ten-location comparison was rerun: seven candidates pass the road-overlap check; Kajen / Hohe Brücke, Meßberg / Dovenfleet / Willy-Brandt-Straße, and Rathausmarkt / Große Johannisstraße / Rathausstraße remain blocked because their generated surfaces intersect neighbouring pavement. An additional check of 5,605 CityObjects in two streamed citywide tiles found three complex Rödingsmarkt source junctions that also require their original geometry or further boundary/approach work. These cases are not silently merged. The full citywide import contains more separate footways, stairs and junction pieces than the smaller study crop.

![Built-in imagery, original import and rounded candidate at Kurze Mühren](../assets/readme/junction-generation-review.jpg)

Checks cover **loaded** buildings, roads and trees. A roads-only crop contains no building footprints to test against. Existing geometry and its retained overlaps are not treated as newly created collisions. The imagery's capture date is unknown, and generated kerbs remain approximations. Neither connectivity curves nor schematic heights certify vehicle turning clearance or bridge engineering.

## Verification and reproduction

The automated suite passes **740 tests**, with five pre-existing skips. Regression coverage includes actual Altmannbrücke ordering, true tunnels versus open cuttings, translucent bridge occlusion and holes, full bicycle pavement coverage after save/reload, an island cut through a preserved cycle lane, both merge sizes, underground profile persistence, mixed-level rejection, and blocking new pavement through a building. The browser was used to generate, save and reopen the larger Rödingsmarkt junction, inspect its connections, and compare Altmannbrücke, Kurze Mühren and Große Bleichen against the built-in satellite imagery. The blocked Kajen candidate was also visually reviewed.

```powershell
npm test
npm run build:pages
node scripts/build-roedingsmarkt-example.mjs
node scripts/build-altmannbruecke-example.mjs
npm run review:intersections
```

The optional Docker storage service is unchanged and still prepared for later hosting. GitHub Pages serves the editor and static data; it does not host a shared database.
