# CityGML Transportation & OpenDRIVE Integration Plan

> **Status**: Research plan, ready to split into implementation tasks  
> **Author**: Codex documentation pass from transport-module discussion (2026-06-09)  
> **Target**: `webcityeditor/prototype` road editor, CityJSON Transportation output, future backend importer

---

## 1. Why This Exists

The current prototype already writes edited roads as CityJSON 2.0
Transportation `Road` objects. OSM is only a reference and seed source. The
next planning question is how to connect three related but different worlds:

- **OSM / muv-osm**: semantic and rule-oriented interpretation of tags. This
  answers questions like "what is here?", "who can use it?", "what is the speed
  limit?", and "how does this change affect a bike route?"
- **osm2streets**: visual lane geometry from OSM. This answers "what should the
  road look like on the map?"
- **OpenDRIVE / r:trån / CityGML Transportation**: high-detail road-network
  models used by simulation and GIS tools. This answers "how do we convert an
  OpenDRIVE road space model into CityGML Transportation?"

The important architectural decision: do **not** create a second road model in
the app. Every importer should feed the existing `RoadDraft` shape, then reuse
`prototype/src/lib/transportation.ts` to generate CityJSON Transportation
surfaces.

This also changes the osm2streets framing. The goal is not "use osm2streets at
all costs." The goal is reliable lane-level road geometry. osm2streets is the
best first candidate because it already produces lane, marking, and intersection
GeoJSON, but it can be replaced or narrowed if the current WASM package cannot
handle our data cleanly.

Related focused plan: [`OSM2STREETS_FORK_PLAN.md`](OSM2STREETS_FORK_PLAN.md)
covers the osm2streets fork, WASM rebuild, crosswalks, dual carriageway merging,
and the lane-strip UI. This document covers the broader transport-module path.

---

## 2. External Tools And Roles

### 2.1 r:trån

TUM's r:trån project is a road-space processing library for ASAM OpenDRIVE. It
supports OpenDRIVE validation and conversion into OGC CityGML 2.0 and 3.0. Its
documentation notes that OpenDRIVE lane topology is converted to CityGML 3.0
Transportation, including predecessor/successor relations between traffic
spaces.

Use r:trån when the source is already OpenDRIVE (`.xodr`) or when a simulation
workflow requires OpenDRIVE validation before GIS import.

Do not use r:trån as the first step for normal OSM editing. OSM -> OpenDRIVE ->
CityGML is a heavier chain and can introduce avoidable semantic loss unless the
project explicitly needs OpenDRIVE as an exchange format.

References:
- <https://rtron.io/>
- <https://rtron.io/docs/opendrive-feature-support>
- <https://www.asg.ed.tum.de/en/gis/software/rtron/>
- <https://tum-gis.github.io/road2citygml3/guideline/guideline.html>

### 2.2 Muv / muv-osm

Muv is a Rust workspace for geo, OSM, transit, vector-tile, and related data
libraries. The project README says it is used by the in-development Muv App and
osm2streets. The `muv-osm` crate focuses on parsing OpenStreetMap tags, with lane
data extraction as a flagship feature. Its package metadata exposes a
`wasm-bindgen` feature, so it is worth evaluating for browser or worker usage.

Use `muv-osm` to replace or strengthen hand-written OSM tag heuristics in
`prototype/src/lib/transportation.ts`. It is especially relevant for lanes,
access rules, maxspeed, turn restrictions, conditional restrictions, surfaces,
and mode hierarchy.

References:
- <https://gitlab.com/LeLuxNet/Muv>
- <https://gitlab.com/LeLuxNet/Muv/-/raw/main/README.md>
- <https://leluxnet.gitlab.io/Muv/muv_osm/>
- <https://gitlab.com/LeLuxNet/Muv/-/raw/main/muv-osm/Cargo.toml>

### 2.3 osm2streets

osm2streets remains the best current candidate for visual lane polygons,
intersection polygons, and crosswalk markings from OSM. It currently has a
practical blocker: the published `osm2streets-js` WASM is old and noisy, and real
Hamburg OSM data can trigger many non-fatal errors or parser edge cases.

Acceptable outcomes:

1. **Repair and rebuild**: fork osm2streets, patch the Rust source and
   osm2lanes edge cases, then compile a local WASM package.
2. **Replace narrowly**: implement a TypeScript/JavaScript lane geometry engine
   that handles our editing cases and emits the same GeoJSON/RoadDraft-style
   output the UI needs.
3. **Hybrid**: keep osm2streets for cases it handles well, and fall back to a
   local TS/JS geometry path when WASM output is empty, too noisy, or fails.

The editor should compare osm2streets visual output with the semantic lane model
from `muv-osm`, but it should not make osm2streets the only source of road rules
or the only possible lane-geometry backend.

Reference:
- <https://a-b-street.github.io/osm2streets/>

---

## 3. Conceptual Mapping

CityGML Transportation sees roads as structured spaces, not just centerlines.
The editor should preserve that structure even when the source is OSM.

| CityGML concept | Current editor shape | OSM / muv-osm role | osm2streets role | OpenDRIVE / r:trån role |
|---|---|---|---|---|
| `Road` | `RoadDraft` and CityJSON `Road` object | OSM way/relation identity, name, class | Visual road grouping context | OpenDRIVE road converted to CityGML `Road` |
| `Section` / `Intersection` | `RoadSectionDraft` plus future graph nodes | Split by topology, junction tags, restrictions | Intersection polygons and markings | Lane sections, junctions, predecessor/successor topology |
| `TrafficSpace` / `TrafficArea` | `RoadBand` -> `TrafficArea` semantics | Lane tags, access modes, direction, speed | Lane polygons and lane markings | CityGML 3 traffic spaces derived from OpenDRIVE lanes |
| `AuxiliaryTrafficArea` | sidewalk, parking, median, green bands | Sidewalk/parking/verge tags | Visual side paths when available | OpenDRIVE objects, sidewalks, shoulders, road furniture where supported |
| `function`, `usage`, `class` | attributes on generated surfaces | Rule extraction and mode hierarchy | Mostly not semantic enough alone | CityGML attributes from r:trån conversion |
| geometry LoD | 2D polygons lifted into CityJSON surfaces | Centerline and lane-count hints | Lane/intersection polygons | Parametric OpenDRIVE geometry converted to explicit CityGML surfaces |
| topology for routing | future routing graph over sections/bands | Turn restrictions and access constraints | Geometry-only aid | Explicit lane/junction links from OpenDRIVE |

---

## 4. Target Architecture

Keep the browser-facing model simple:

```text
OSM Overpass XML/JSON
  |-- muv-osm semantic parser/evaluator
  |-- osm2streets visual lane/intersection generator
  v
RoadDraft
  v
CityJSON Transportation Road + preview surfaces

OpenDRIVE .xodr
  v
r:trån validate + convert to CityGML 3 Transportation
  v
CityGML Transportation importer
  v
RoadDraft or direct CityJSON Transportation Road
```

The app should treat `RoadDraft` as the editable intermediate contract:

- `source: 'osm'` for OSM-seeded roads.
- `source: 'manual'` for hand-drawn roads.
- `source: 'opendrive'` for future OpenDRIVE/r:trån imports.
- `osmTags` and future `semanticTags` carry source evidence.
- `_roadLayout` metadata on generated CityJSON keeps round-trip editing
  possible.

The OpenDRIVE path can be server-side first. r:trån is a JVM CLI/library
workflow, not a natural browser dependency. The browser can upload or reference
`.xodr`; the backend runs validation/conversion and returns either CityGML,
CityJSON, or normalized `RoadDraft` payloads.

---

## 5. Three Complementary Plans

### Plan A: OSM-first semantics and visual editing

Goal: make Hamburg OSM road edits more trustworthy without requiring OpenDRIVE.

1. Add a small evaluation spike for `muv-osm`:
   - build minimal WASM or Node/Rust CLI proof
   - feed the same Hamburg OSM way tags used by `buildOverpassRoadQuery`
   - compare extracted lanes, access, maxspeed, sidewalks, cycle lanes, and
     restrictions against the current TypeScript inference
2. Extend `OsmRoadFeature.inferredDraft` with confidence/source metadata:
   - `sourceEvidence: 'osm-tags' | 'muv-osm' | 'osm2streets' | 'manual'`
   - per-band warnings for uncertain or conflicting tags
3. Keep osm2streets output as the visual overlay:
   - lane polygons
   - lane markings
   - crosswalk/intersection markings
   - dual-carriageway visual merge experiment
   - fallback to local TS/JS lane geometry if the patched WASM still cannot
     process the target data reliably
4. Add a graph-ready representation:
   - road section nodes
   - allowed modes per band
   - forward/backward edges
   - turn restrictions where known
5. Use that graph to answer workflow questions:
   - "Does this change remove a bike connection?"
   - "Does the speed/access change alter routing?"
   - "Which CityJSON TrafficAreas changed?"

This plan improves the current product directly and fits the in-browser editor.

### Plan B: OpenDRIVE to CityGML bridge

Goal: accept external high-detail OpenDRIVE datasets and convert them into the
same editable road workflow.

1. Add backend script scaffolding:
   - `prototype/scripts/import-opendrive.ps1` or a Node CLI wrapper
   - input `.xodr`
   - r:trån validation report
   - CityGML 3 Transportation output directory
2. Write a CityGML Transportation reader focused on r:trån output:
   - road id/name
   - sections/intersections
   - TrafficSpace/TrafficArea surfaces
   - function/usage/class attributes
   - predecessor/successor links when available
3. Normalize into editor data:
   - either `RoadDraft` for user-editable lanes
   - or direct CityJSON Transportation `Road` objects for read-only reference
4. Add a road import UI entry:
   - "Import OpenDRIVE / CityGML Transportation"
   - show validation report first
   - load as editable or reference layer
5. Defer CityJSON/OSM -> OpenDRIVE export:
   - only implement if a simulator handoff requires `.xodr`
   - the editor's current CityJSON Transportation output is the GIS-first
     canonical export

This plan is the correct route for OpenDRIVE datasets, but it is a backend/data
pipeline task rather than a replacement for the OSM road editor.

### Plan C: Road-fit validation against planning/lot constraints

Goal: make edited roads visibly respect their available physical/planning
envelope. When a road surface exceeds its allowed corridor or overlaps a
building/affected land parcel, the editor should make that conflict obvious.

The validation should run on generated `RoadDraft` surface polygons, not on raw
centerlines. That means it works for OSM-seeded, manual, osm2streets-derived,
TS/JS-derived, and OpenDRIVE-derived roads.

1. Define the road envelope sources:
   - existing Hamburg planning overlay where it gives relevant constraints
   - parcel/lot polygons when available
   - building footprints from the loaded CityJSON working set
   - optional OSM `area:highway`, landuse, or right-of-way hints
2. Build a `validateRoadFit(draft, context)` pure function:
   - generate or reuse the road-band polygons from `transportation.ts`
   - union the full road footprint per section
   - test outside-allowed-corridor area
   - test intersections with buildings and protected/affected land polygons
   - return conflicts with polygon geometry, affected object ids, and severity
3. Render conflicts in the map:
   - road overflow polygons in red
   - affected buildings tinted red or outlined
   - affected planning/lot polygons highlighted
   - side-panel conflict list with "outside corridor", "building overlap", or
     "affected land" labels
4. Gate insertion/export only when appropriate:
   - hard-block direct building intersections
   - warn, but allow override, for planning/lot overflow while data sources are
     still incomplete
5. Persist conflict metadata only as diagnostics:
   - CityJSON output should store the road geometry and source metadata
   - conflict results should be recomputed when planning/lot/building context
     changes

This creates the red-highlight workflow discussed for roads that do not fit
inside their limited space.

---

## 6. Decision Matrix

| Need | Recommended path | Reason |
|---|---|---|
| Better lane/rule inference from OSM | Evaluate `muv-osm` | It is semantic and tag-focused |
| Better visual lane polygons/crosswalks | Fork/rebuild osm2streets, or replace with TS/JS lane geometry | The requirement is reliable lane-level geometry, not a specific dependency |
| Existing `.xodr` import | r:trån -> CityGML Transportation -> importer | r:trån is built for OpenDRIVE validation and CityGML conversion |
| Browser-only Hamburg editing | OSM + muv-osm + osm2streets -> `RoadDraft` | Avoids heavy OpenDRIVE conversion for normal map edits |
| Road exceeds available corridor | Road-fit validator over `RoadDraft` surface polygons | Uses the geometry the editor will actually insert/export |
| Simulation handoff | Future CityJSON/RoadDraft -> OpenDRIVE exporter | Implement only when `.xodr` output is explicitly required |
| CityGML Transportation authoring | Existing `transportation.ts` generator | Keeps one source of truth in the app |

---

## 7. Implementation Tasks

### 7.1 Immediate documentation and code alignment

- [x] Link this plan from `README.md` and `PROTOTYPE_STATUS.md`
- [x] Keep `OSM2STREETS_FORK_PLAN.md` scoped to the fork/WASM/UI work
- [ ] Add comments to `RoadDraft.source` only if future importer code makes the
      meaning unclear

### 7.2 muv-osm spike

- [ ] Clone or vendor-check `LeLuxNet/Muv` in a temporary spike branch
- [ ] Test whether `muv-osm` can compile to WASM with the needed lane features
- [ ] Feed real Hamburg Overpass examples:
  - divided arterial road
  - one-way street with cycle lane
  - road with `sidewalk=both`
  - road with separate cycleway/sidewalk tags
- [ ] Produce a comparison table against current TypeScript inference
- [ ] Decide browser WASM vs server-side parser

### 7.3 osm2streets integration

- [ ] Complete the fork plan in `OSM2STREETS_FORK_PLAN.md`
- [ ] Run the same Hamburg bbox before/after fork rebuild
- [ ] Record counts for lane polygons, lane markings, intersection markings,
      and browser console errors
- [ ] Keep osm2streets as a visual validation layer even after `muv-osm`
      semantic parsing is added
- [ ] Define a fallback interface so WASM and TS/JS lane geometry backends both
      return the same shape:
  - lane polygons
  - lane markings
  - intersection/crosswalk markings
  - warnings/confidence metadata
- [ ] Prototype the minimal TS/JS geometry path for simple road sections:
  - centerline offset bands
  - per-band width/direction/mode
  - intersections initially simplified or marked "needs manual correction"
  - output compatible with the existing deck.gl preview layers

### 7.4 OpenDRIVE/r:trån pipeline

- [ ] Install r:trån CLI/JAR in local tools or document download path
- [ ] Run `validate-opendrive` on a sample `.xodr`
- [ ] Run `opendrive-to-citygml`
- [ ] Inspect generated CityGML 3 Transportation classes and attributes
- [ ] Add a parser/converter from r:trån CityGML output to `RoadDraft` or
      CityJSON Transportation
- [ ] Add tests using a tiny committed or generated sample fixture

### 7.5 Road-fit validation

- [ ] Identify the first corridor/lot source to use in Hamburg:
  - existing planning polygons as a coarse first pass
  - parcel/lot data when available
  - loaded CityJSON building footprints for collision checks
- [ ] Add pure geometry tests for road footprint overflow:
  - inside corridor
  - partially outside corridor
  - building overlap
  - no corridor data available
- [ ] Add deck.gl conflict layers:
  - overflow polygons in red
  - affected buildings outlined or tinted red
  - affected planning/lot polygons highlighted
- [ ] Add editor UX rules:
  - block building intersections by default
  - warn and allow override for uncertain planning/lot overflow
  - show conflict count before inserting/exporting the road

---

## 8. Verification Checklist

- [ ] OSM road selection still creates a valid `RoadDraft`
- [ ] CityJSON Transportation insertion remains structurally valid
- [ ] Existing road editor tests still pass
- [ ] Lane-geometry backend can be swapped between patched WASM and TS/JS without
      changing `RoadDraft` or map-layer consumers
- [ ] `muv-osm` semantic output is compared against current inference before it
      replaces any TypeScript heuristic
- [ ] osm2streets visual output is checked in the browser for Hamburg
- [ ] r:trån conversion produces CityGML 3 Transportation that can be imported
      without losing lane topology
- [ ] Imported OpenDRIVE-derived roads can be previewed on the same deck.gl map
- [ ] Road-fit conflicts highlight overflow areas and affected buildings/land in
      red before insertion/export
- [ ] Exported CityJSON reopens with editable `_roadLayout` metadata where
      edits are allowed

---

## 9. Open Questions

- Should `muv-osm` run in the browser as WASM, in a Web Worker, or as a backend
  service?
- Does `muv-osm` expose enough lane-level structure directly, or do we need an
  adapter around its lower-level tag parsing?
- Which OpenDRIVE sample should become the tiny committed fixture?
- Should OpenDRIVE-derived roads be editable immediately, or first imported as
  read-only reference layers?
- How much CityGML 3 topology should be preserved in CityJSON 2.0 output, and
  what should remain in private metadata until the backend supports richer
  routing/topology?
- Which Hamburg dataset is the right first source for road corridors or lot
  limits: existing planning polygons, cadastral parcel boundaries, OSM
  `area:highway`, or another official layer?
- Should road-fit overflow block edits immediately, or start as a visual warning
  until the corridor/lot data source is proven reliable?
