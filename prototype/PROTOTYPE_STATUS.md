# City Editor Prototype — Status

Source of truth for **what was planned, what's delivered now, and what's left**. Complements `LoD2_Editor_Onay_Dokumani.docx` (the 19-question approval document) with a concrete code-aware delta.

**Last updated**: 2026-07-17. **Test suite**: 518 passing across 59 files. **TypeScript**: clean. **Production build**: clean. **Dependency setup**: clean `npm ci`; CityJSON loader pinned to upstream commit `cf8db910`.

---

## 1. What it does today

React editor with a client-side edit model. A lightweight local Hamburg tile-catalog server now supports prepared whole-city LoD2 viewport loading and validated sequence-tile write-back; the full database backend is still pending.

### Load
- **CityJSONSeq** (`.jsonl`, `.city.jsonl`) — preferred city-scale input format, one feature per line; explicit sequence files use strict line parsing so malformed features surface immediately
- **Strict Hamburg CityJSONSeq catalog connection** — load screen connects to the local bbox server, opens a bounded centre viewport, then automatically fetches unseen nearby tiles as the map pans. Differing tile transforms are normalized exactly onto one integer grid; requests above 25 unseen tiles require zooming in first. **Save seq** persists edited source tiles with revision checks, backups, structural validation, and `val3dity`; clean off-screen tiles unload automatically.
- Monolithic CityJSON 2.0 (`.json`, `.city.json`) — retained for small models and modified working-set export
- Drop / file browse / URL fetch / built-in sample cube
- **Immediate committed Hamburg demo**: `hamburg-city-center-buildings.city.jsonl` contains 1,353 official LoD2 buildings, and `hamburg-city-center-roads.osm` is processed at startup through the same browser osm2streets path as **Fetch Roads**, including lane polygons, intersections, and markings. The Elbe waterfront / HafenCity through Rathaus to Jungfernstieg auto-loads for both `npm run dev` and GitHub Pages with no Rust build, Overpass request, catalog server, or data download.
- Whole-city Hamburg editing remains available through the optional local strict CityJSONSeq catalog servers and viewport tile loading.
- Load data is a reopenable modal over the map. The Data toolbar button opens it without discarding the current document; successful loads replace the working document and close the modal.
- Recent-saves list from IndexedDB
- Local edit artifact bundle: modified CityJSON, machine-readable change report, and GeoJSON visual-diff overlay for the current before/after edit state
- Auto-detects CRS, either from `metadata.referenceSystem` OR from the magnitude of `transform.translate` (UTM 32N / 33N / Dutch RD New) as a fallback
- 10 CRS registered via proj4: EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514

### Display
- **MapLibre** basemap (CARTO light raster tiles with OSM attribution; switched away from `tile.openstreetmap.org` after Hamburg tiles returned 404)
- **deck.gl** context layer — LoD by zoom: outlined footprints below 14.5, extruded blocks above
- **Hamburg planning overlay** — the click-driven toolbar action loads both Hamburg XPlan `BP_BaugebietsTeilFlaeche` detail and FNP land-use coverage for the current viewport, follows every advertised page/offset, deduplicates stable feature ids, and gives XPlan priority where both sources overlap. The UI reports incomplete-source failures instead of silently showing a sample, caps oversized viewports, and provides explicit Refresh/Hide actions. Clicking a polygon opens its source, label, mapped building types, and available plan attributes. This is a planning-data aid, not a legal compliance decision.
- **Road editor overlay** — toolbar `Roads` opens exact osm2streets lane/intersection surfaces, OSM reference roads only where exact output is unavailable, satellite checking, manual road redraw, lane/speed controls, and CityJSON Transportation insertion without expanding the main toolbar. Exact selection uses an outline and does not replace the rendered surface with a guessed constant-width ribbon.
- **Satellite basemap** — road mode can switch the MapLibre raster source from CARTO/OSM to Esri World Imagery so OSM lane assumptions can be checked against aerial imagery.
- Click a building → side panel with a per-building Three.js scene
- **Auto-fit on load**: bbox of footprints → imported road-area bounds → `metadata.geographicalExtent` → `transform.translate` as centre — fallbacks so building datasets and roads-only CityJSON both open focused.
- Hamburg data now initializes the map camera from the loaded dataset instead of briefly starting at the Delft fallback.
- Fullscreen toggle on the side panel for focused editing

### Create new buildings
- **＋ New Building** toolbar action activates Terra Draw polygon mode
- **Snap-to-existing-footprints** within 20 px while drawing
- Fullscreen creator overlay with dimensions, locked overhang controls, attributes, openings, and subdivision sections
- Visual roof picker for **flat, pyramid, gable, hip** with DIN-inspired storey-height validation
- **Live 3D preview** while creating — roof shape, **windows, door, and split previews** update as you type
- **Procedural openings (LoD 2.2)** — Windows / Door checkboxes in the dialog. When enabled, the generator emits per-storey window holes (1.4 × 1.5 m, 0.9 m sill, ~3 m spacing) on every rectangular wall and a single 1.0 × 2.1 m door on the first wall. Each opening is both an inner-ring hole on the parent wall AND a separate co-planar `Window`/`Door` semantic surface. Bumps the geometry's LoD label from `2.0` to `2.2`.
- **Roof overhang controls are present but disabled** — the earlier zero-thickness overhang Solid failed ISO 19107 primitive validation. Eave/rake values stay at 0 m until a validated roof-slab/soffit model is implemented and covered by val3dity/cjval tests.
- **Subdivide-on-create**: choose "none / floors / sides" with a count; split applies immediately after insertion
- **Planning compatibility check**: when the Hamburg planning overlay is loaded, new-building creation checks the footprint against the fetched planning polygon's mapped building-use categories.
- The parametric generator produces a proper LoD 2 `Solid` with `GroundSurface` / `RoofSurface` / `WallSurface` (+ optional `OuterCeilingSurface` / `Window` / `Door`) semantics. Round-trip through JSON.stringify tested for every roof type and every opening combination.

### Transportation / road editing
- **Source-of-truth decision for v1**: edited roads are stored as CityJSON 2.0 Transportation `Road` objects. OSM is used only as a reference/seed layer; the editor does not write back to OSM.
- **OSM reference fetch**: Road editor fetches `highway=*` ways from Overpass for the current viewport and runs them through the forked osm2streets engine. Exact lane, intersection, and marking surfaces retain semantic colors while picking/editing; the generic OSM path/hit layer is suppressed wherever exact output exists. Direct pedestrian/path/cycleway features no longer invent underground car lanes. Large query caps are computed in the active metric CRS (Hamburg fallback: EPSG:25832) before converting back to the WGS84 Overpass bbox.
- **OSM street-point context**: the same bounded Overpass request fetches tagged traffic signs, trees, street lamps, traffic signals, and bollards. These nodes bypass osm2streets lane generation and render as category-colored deck.gl markers above the road/building context.
- **User verification step**: clicking an OSM road prompts the user to confirm whether the inferred layout matches reality. Accept uses the OSM-derived draft; cancel keeps it as an editable seed for redraw/manual correction.
- **Manual correction scene**: Terra Draw LineString mode lets the user draw or redraw the road centerline over the basemap/satellite image. Existing draft vertices and midpoints use capture-phase Pointer Events, pointer capture, and a preserved grab offset, so the enlarged selected handle stays attached until pointer release/cancel instead of dropping on unreliable button-state events or becoming a MapLibre pan gesture. The current draft previews as transportation surface polygons before insertion.
- **Lane/band editor**: per-section bands are editable left-to-right as car lane, bike lane, sidewalk, parking, median, or green verge. A proportional colored strip shows width and direction arrows, supports drag-to-reorder, and keeps detailed width/direction/speed controls below it.
- **Precise road segment split**: the active road section can be split at an explicit percentage along the centerline; both child sections preserve the lane/band layout for later per-section edits.
- **CityJSON output and cancellation**: insertion creates one `Road` `MultiSurface` with aligned `TrafficArea` / `AuxiliaryTrafficArea` semantics and private `_roadLayout` metadata. Existing-road Save replaces the same Road id and compacts orphan vertices; Cancel clears the draft and selection without mutating CityJSON, with confirmation for dirty work.
- **Editable reopened and imported road layouts**: Road surfaces created by the editor reopen their `_roadLayout`. Exact imported surfaces without draft metadata can now derive an approximate editable centerline plus semantic lane bands from their CityJSON polygons. The original remains exact until Save; saving a reshaped draft intentionally rebuilds it as editable ribbon surfaces.
- **Exact osm2streets polygon output**: selected osm2streets lane polygons can also be inserted directly as CityJSON Transportation `Road` surfaces, preserving the computed lane/bike/auxiliary polygons instead of regenerating ribbons from a centerline. Before insertion, each lane becomes a full `TrafficAreaPolygonAsset` with a closed active-CRS metric surface, metric centerline, CRS URI, width, direction, function/usage semantics, ids, lane type, and OSM/osm2streets provenance. The re-import/render path is tested against real native Hamburg polygons and semantic colors.
- **Hosted real road sample**: the Data loader exposes `osm2streets-hamburg-short-intersection.city.json`, generated from the committed native `hamburg-short-intersection` osm2streets lane-polygons fixture, for browser inspection of roads-only CityJSON.
- **Complete and portable Hamburg road catalog**: `npm run data:hamburg-roads:prepare` makes a fresh clone self-sufficient: it preflights Rust before the large download, downloads the Hamburg PBF, initializes/builds the patched native osm2streets exporter, runs the proven recursive tiling, validates sequence tiles, and discards successful intermediates and redundant monolithic output. On Windows, `PREPARE_HAMBURG_ROADS.cmd -Serve` performs the prerequisite checks, conversion, and road-catalog/Vite startup from the repo root; `npm run dev:hamburg-roads` restarts an already prepared catalog and frontend together. Preparation and startup validate the preferred catalog and can reuse the newest complete sibling `cityjsonseq-*` proof directory instead of accepting an older partial catalog. Normal edit/save work is CityJSON-only from then on. The ignored complete catalog is about 2.3 GiB and is generated locally rather than committed. The 2026-07-14 hardened proof under `Data/hamburg-roads-osm2streets/cityjsonseq-2026-07-14-hardening/` completed with `failed: 0`: 20 validated non-empty tiles, 47 empty/water tiles, 344,265 roads, 913,927 surfaces, and 4,774,798 vertices.
- **CityGML bridge**: `npm run cityjson:to-citygml -- INPUT.city.json --require-road` converts exported CityJSON roads to CityGML 3.0 Transportation XML with `citygml-tools from-cityjson`, then validates the generated `.gml`.
- **Backend-ready payload**: the same draft can be exported or POSTed as `webcityeditor-road-edit-v1` JSON. Insert/export/backend actions and payload preview live in one closed `CityJSON Export & Backend` disclosure so they do not crowd the main editing flow.
- **Local diff artifacts**: road/building edits can be summarized as a deterministic `webcityeditor-local-change-report-v1` JSON report plus a GeoJSON visual-diff overlay while the prototype remains frontend/local-file based.
- **osm2streets forked-WASM path**: OSM-derived reference and exact-surface lane geometry is generated through the vendored `vendor/osm2streets` Rust fork, rebuilt into `prototype/vendor/osm2streets-js` with `wasm-pack`. Manual/editable `RoadDraft` previews intentionally use the TypeScript ribbon generator; the old npm-wrapper `patch-package` path is removed.
- **Hamburg osm2streets fixtures**: `npm run osm2streets:compare` runs committed Hamburg OSM snippets through both the forked WASM package and the native Rust exporter, checks minimum lane/marking counts, records warnings/errors, writes both outputs to `prototype/test-output/osm2streets-comparison/`, and fails if normalized outputs or diagnostics diverge.
- **OpenDRIVE boundary**: Hamburg OpenDRIVE / Road2CityGML-style import is not implemented in-browser yet. The pinned r:trån 1.3.0 runner (`npm run opendrive:rtron`) now preflights Java/JAR/input requirements and executes validation plus OpenDRIVE-to-CityGML conversion, with a non-mutating `--dry-run` plan for setup. A real `.xodr` fixture, conversion inspection, and browser import remain pending. The intended importer maps compatible lanes/roads into the same `RoadDraft` model, then reuses the existing CityJSON Transportation generator and preview. The broader plan is documented in [`CITYGML_TRANSPORTATION_PLAN.md`](CITYGML_TRANSPORTATION_PLAN.md); the metric road-limit and r:trån trial pipeline is detailed in [`METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md`](METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md); osm2streets-specific fork and UI work is tracked in [`OSM2STREETS_FORK_PLAN.md`](OSM2STREETS_FORK_PLAN.md).
- **Road-fit validation**: generated road preview polygons are checked against loaded building footprints and planning/land polygons. Surface or known-z building collisions block insertion; OSM tunnel/bridge/layer hints without metric elevation become `vertical_uncertainty` warnings; known vertical separation suppresses overlap and horizontal-clearance conflicts. Near-building clearances are measured in metric CRS: under 0.5 m blocks insertion, and under 1 m warns. Projected polygon operations highlight the actual overlap geometry. The incomplete manual `Trusted road corridor` file workflow has been removed from the app; its pure helpers stay dormant until an authoritative corridor source can be loaded automatically.

### Edit existing buildings
- Attribute editor with priority-sorted rows, type coercion (number/string/boolean)
- Dirty tracking, per-building revert, toolbar dirty-count
- **Transform mode**: "Start editing position" enters a live-preview mode with dX/dY/angle inputs + quick-step buttons; map renders a ghost of the transformed footprint; Save commits, Cancel discards. Works on ANY building (generated or imported). Commits preserve shared source vertices safely, refresh stored geographical extents, reject non-finite values, and compact orphaned transform vertices before export.
- **Make editable for imports**: imported CityJSON / Hamburg / IFC-derived buildings can be promoted to parametric form after a confirmation that original mesh detail will be replaced. Promotion now appends replacement vertices correctly and consumes replaced `BuildingPart` descendants, including imports whose geometry lives only on child parts.
- **Edit footprint mode** (parametric/editor-created/promoted buildings): "Edit footprint corners" loads the building's outline as a TerraDrawSelectMode polygon with draggable vertex handles + midpoint dots that split edges into new corners. Save calls `regenerateBuilding` which re-runs the parametric generator with the new shape and the building's stashed parametric attributes (`_eaveHeight`, `_addWindows`, `_eaveOverhang`, …) intact.
- **Reshape mode**: editable buildings expose in-place roof type, ridge/eave height, locked eave/rake overhang controls, and window/door toggles. Apply regenerates geometry without changing the id, footprint, or parent/child linkage.
- **Subdivide — visual division editor**: split-by-floor with two modes:
  - **"Split equally"**: the original uniform N-floor split.
  - **"Custom heights…"**: per-floor wall-height input (auto-seeded with 3.5 m ground + equal upper floors — German residential pattern), live Σ display turning red when heights drift, ⚠ badge when any floor falls below MIN_STOREY_HEIGHT, sum-conservation enforced before Apply unlocks.
  - **Live 3D split-line preview**: the side-panel Three.js viewer draws horizontal accent rings around the building outline at each cumulative split height as you edit — no more "edit numbers blind".
- **Subdivide — split-by-side** with MIN_SIDE_WIDTH=3m enforced, visual plan preview, and selectable auto / longer / shorter split axis.
- **Subdivide — per-floor footprint plans**: a combined planner divides the building vertically and by footprint in one pass. Each floor can have its own rectangular side-section count, axis, and manual percentage cuts; a checkbox applies one floor plan to all floors. The side panel renders a plan preview for every floor and the Three.js viewer overlays the horizontal floor rings plus vertical divider outlines.
- Floor splits work on any unsplit Building, including imported buildings. Footprint section plans currently require a rectangular footprint.
- **Map tinting by roofType**: outline + extruded layers colour each footprint by its `roofType` attribute (flat=cool grey, gable=terracotta, hip=deeper terra, pyramid=walnut, +shed/mansard/barrel). Recognises CityGML/3DBAG integer codes (1000, 2100, 3100, 3200, 3300, 3400, 5100) AND human-readable strings, including 3DBAG's `roofType: 1000` / `roofType: "flat"` mixed convention.
- **3D viewer color-mode toggle**: top-right of the side-panel viewer flips between "By surface" (semantic — distinct tints for Wall / Roof / Window / Door / OuterCeiling) and "By object" (CityObject type — Building / Bridge / Plant / Road). No re-load; flips a uniform on the parser's mesh material.
- Export → downloads a modified CityJSON; local artifact tests also prove a matching change-report JSON and visual-diff GeoJSON output
- **Export glTF (`.glb`)**: binary glTF 2.0 with semantic-coloured per-vertex tinting, per-triangle flat shading, and `extras.cityjson` carrying the centroid and source CRS. Loads in Blender / Sketchfab / three.js / Cesium / Babylon.js without any CityJSON-aware tooling on the receiver.
- Save local → persists to browser IndexedDB

### Filter / search the city
- **Filter bar** below the toolbar: text search (matches id + every string/number attribute, case-insensitive), roof-type chips drawn from the dataset, year-of-construction range, height range. Multi-criteria AND.
- Match count shown live (e.g. "47 of 918 match"). Non-matching buildings dim to ~25 % opacity on the map so the match pattern is visible at a glance; the selected building always wins.

### Trust + housekeeping
- **Integrity-check pill**: red/amber pill in the toolbar surfaces vertex-index out-of-bounds, dangling parent/child links, asymmetric parent links, semantics shell/face mismatches, missing transforms, NaN vertices, and orphaned-vertex info. Click for a summary alert with the first 12 issues.
- **Vertex compaction**: a "Compact (N)" toolbar button appears when there are 50+ orphaned vertices (typical after a few footprint-edit regenerations). Click reclaims them in place and reports how many were freed.
- **Undo / Redo**: snapshot-based history covering every mutation (create, attribute change, transform, split, footprint edit, compact). Toolbar buttons + Ctrl+Z / Ctrl+Shift+Z (Cmd+Z / Cmd+Shift+Z). 30-snapshot cap; tooltips show the next action's label ("Undo: Move building").

### Browse
- **Building list sidebar** (toolbar "☰ List" toggle): 300px-wide left rail with one row per building, sortable by id / year / height / function, capped at 300 visible rows. Filter narrows it; clicking a row selects on the map and opens its AttributePanel.

### UI
- Full shadcn/ui — Button, Input, Label, Dialog, Select — across Toolbar, FileLoader, AttributePanel, BuildingCreator
- Simplified demo toolbar: always-visible map actions are Data, New Building, List, Planning, Save seq when dirty, Export CityJSON, and validation pills; lower-frequency actions live under More.
- Tailwind utility classes for layout; CSS variables for theme
- Dark palette; focus rings; consistent hover states; polished scrollbars

---

## 2. Planned vs delivered (approval doc, S1–S20)

| # | Decision | Status | Notes |
|---|---|---|---|
| S1 | CityJSON 2.0 primary format | ✅ | In-memory state = single source of truth |
| S2 | CityJSON → 3DCityDB import healthy | 🟡 doc | Covered in HAMBURG_PIPELINE.md; not executed end-to-end yet |
| S3 | No data loss on client-side edits | ✅ | Round-trip tested for every roof type; vertex integer encoding preserved |
| S4 | Backend-mediated DB access | ⚪ mock | IndexedDB and local artifact bundles stand in for now |
| S5 | New-building flow (Terra Draw + parametric generator) | ✅ | Including four roof types, split-on-create, snap-to-existing |
| S6 | Edit existing building | ✅ | Attributes and transform (move/rotate) on imported buildings; floor splits on unsplit buildings; rectangular footprints also support manual per-floor section plans |
| S7 | ENU / local metric for edits | ✅ | proj4 handles WGS84 ↔ CRS, Three.js in model-local metres |
| S8 | LoD0 + LoD2 coexist per Building | ✅ | Native CityJSON hierarchy; LoD-by-zoom rendering on map |
| S9 | Three.js | ✅ | three 0.165, dedupe configured |
| S10 | cityjson-threejs-loader | ✅ | pinned GitHub dependency at `cf8db910`; no manual clone needed |
| S11 | Custom serializer | ✅ | Mutate-in-place + JSON.stringify |
| S12 | Azul not used | ✅ | — |
| S13 | deck.gl + 3D Tiles + pg2b3dm | 🟡 partial | deck.gl ✓; Tile3DLayer and pg2b3dm need the backend phase |
| S14 | Single source of truth | ✅ | CityJSON state; every view derives |
| S15 | End-to-end edit flow | 🟡 partial | Client-side round-trip done; server-side write + tile regen needs backend |
| S16 | nginx tile serving | ❌ deferred | Backend phase |
| S17 | Incremental tile regeneration | ❌ deferred | Backend phase |
| S18 | Custom picking in Tile3DLayer | 🟢 different | deck.gl picking on SolidPolygonLayer is built-in; when we adopt Tile3DLayer, the workaround plan applies |
| S19 | 3DBAG as primary test data; Hamburg via CityGML | ✅ / partial | 3DBAG quick-sample; committed official LoD2 Hamburg center demo; official 2026 whole-city batch converted and audited; strict editing catalog emitted with primitive-invalid originals quarantined |
| S20 | Transportation / roads | 🟡 v1 | CityJSON Transportation Road authoring, OSM reference, satellite check, manual redraw, lane/speed edit, percentage split, payload export; backend routing/OpenDRIVE importer deferred |

---

## 3. Hamburg workflow — current state

1. Committed browser-safe buildings: `public/data/hamburg/hamburg-city-center-buildings.city.jsonl`.
2. Committed browser-safe roads: `public/data/hamburg/hamburg-city-center-roads.osm`.
3. Demo source/output: `npm run data:hamburg-center` selects 1,353 official LoD2-DE buildings; `npm run data:hamburg-center:osm` extracts a compact road network from the Hamburg PBF. At startup the OSM crop runs through the same browser osm2streets rendering path as **Fetch Roads**. The close pitched camera covers the Elbe waterfront / HafenCity through Rathaus to Jungfernstieg.
4. Authoritative source: LGV's complete-city LoD2-DE CityGML 1.0 archive. As of 2026-06-01, the script resolves `LoD2-DE_HH_2026-04-28.zip` (659,524,658 bytes) from the live official metadata endpoint.
5. Whole-city preparation: `npm run data:hamburg-lod2 -- download`, `extract`, then `convert --cjval cjval`. This emits one structurally validated editable `.city.jsonl` per CityGML tile plus `catalog.json`.
6. Primitive-valid editing set: run `geometry-audit --allow-invalid`, then `geometry-clean`. This retains defective source features under `Data/hamburg-lod2/quarantine/` and emits strict tiles under `Data/hamburg-lod2/cityjsonseq-clean/`.
7. Local city-scale access: `npm run data:hamburg-lod2 -- serve --output-dir ../Data/hamburg-lod2/cityjsonseq-clean` exposes bbox tile lookup, tile delivery, and revision-checked validated tile write-back on `http://127.0.0.1:8787`.
8. FileLoader exposes **Connect catalog** for the local strict CityJSONSeq server. It loads a bounded centre viewport and fetches unseen adjacent sequence tiles after map pans while preserving dirty edits. The toolbar's **Save seq** action checkpoints edited tiles; clean off-screen tiles are evicted to keep long pan sessions bounded.
9. FileLoader exposes the committed building sample from GitHub Pages with no CORS issue; normal startup additionally loads and processes the matching OSM road crop. The Planning toolbar fetches live Hamburg XPlan polygons for the same area.

**Tested**: the committed center building file parses as strict CityJSONSeq and renders the official LoD2 geometry; the committed OSM crop passes through the forked browser WASM into lane polygons, intersections, lane markings, and intersection markings using the same function as **Fetch Roads**. Imported-building editing remains covered, while OSM selection/draft/CityJSON insertion is covered by the transportation and osm2streets suites. The official 2026 LoD2 archive downloaded and extracted to 783 tiles; every source GML passed `citygml-tools validate`; all tiles converted to 388,729 editable CityJSONSeq building features and 7,391,235 vertices; structural validation passed during conversion and again as a second full pass. Full isolated `val3dity 2.6.0` audit found 3,338 primitive-invalid originals plus 49 validator-crashing originals. The strict editing build quarantined those 3,387 source features, emitted 385,342 primitive-valid features across 782 tiles, and then passed a second citywide `val3dity` audit with zero defects and zero crashes. Strict-catalog bbox lookup and HTTP tile delivery passed. A current strict 2026 centre-tile building passed editor-library move, compact, save, reopen, and integrity checks. A real catalog-client smoke also loaded nine strict tiles, fetched unseen adjacent sequence tiles after a simulated pan, normalized differing transforms exactly, moved an imported building, compacted the larger working set, serialized, reopened, and passed integrity checks. A copied current strict centre tile then passed the complete HTTP write-back path: catalog load, imported-building move by `+7.5 m / -2.25 m`, local-grid reconstruction, structural validation, `val3dity`, atomic replacement, refetch, reopen, coordinate comparison, and integrity check. A generated two-floor plan with independent upper-floor footprint sections also serialized as one feature hierarchy and passed `val3dity`.

Caveats:
- `citygml-tools` defaults to writing `.jsonl` rather than `.city.jsonl` for `-l` output; we accept both extensions.
- Hamburg's LoD 2 files have a Building → BuildingPart hierarchy (the Building has no geometry, its children carry it). Our `extractFootprints` walks children, so this works.
- Full Hamburg is not browser-loadable in one document. The current 2026 conversion is 863,708,269 bytes across 783 CityJSONSeq tiles; the pipeline serves a bbox-queryable catalog.
- The committed Hamburg center sample is intentionally bounded. Use the local catalogs for areas outside the Elbe-to-Jungfernstieg showcase.
- Hamburg does not publish an official native CityJSON LoD2 archive. Its JSON resource is a 3D Tiles viewing tileset, not an editable source.
- The official LoD2 release contains primitive-level geometry defects even though its XML schemas and converted CityJSON structure validate. Use `cityjsonseq-clean/` for strict editing; use `quarantine/` when repairing the 3,387 excluded originals.

Full step-by-step: [`HAMBURG_PIPELINE.md`](HAMBURG_PIPELINE.md).

---

## 4. Stack — what's installed vs what the doc specified

| Tech from approval doc | In the prototype? |
|---|---|
| React 18 + TypeScript | ✅ |
| Vite | ✅ (added post-doc; recorded in memory) |
| MapLibre GL JS 4.7 | ✅ |
| deck.gl 9.3 — core, layers, mapbox, mesh-layers | ✅ |
| Three.js 0.165 | ✅ (dedupe configured) |
| cityjson-threejs-loader (TU Delft) | ✅ pinned GitHub dependency at `cf8db910` |
| Terra Draw 1.28 + MapLibre adapter | ✅ (incl. snap-to-existing) |
| proj4 | ✅ — 10 CRS + coord-magnitude inference fallback |
| **shadcn/ui** (Button/Input/Label/Dialog/Select) | ✅ — across every component |
| Tailwind CSS | ✅ (prerequisite for shadcn) |
| Radix UI primitives | ✅ (via shadcn) |
| straight-skeleton WASM | ❌ — replaced by pure-JS flat/pyramid/gable/hip generators (§5) |
| Node.js + Fastify | 🟡 partial | Lightweight Node Hamburg tile-catalog server now handles strict local persistence; production Fastify API still pending |
| PostgreSQL 16 + PostGIS + 3DCityDB v5 | ❌ no backend (Docker ready) |
| citydb-tool | ❌ no backend |
| pg2b3dm | ❌ no backend |
| nginx | ❌ no backend |
| BullMQ | ❌ no backend |
| OGC API - Features (Fastify endpoints) | ❌ no backend |

---

## 5. Roofs — what we handle

| Footprint shape | Flat | Pyramid | Gable | Hip | Notes |
|---|---|---|---|---|---|
| Rectangle (4 verts) | ✅ | ✅ | ✅ | ✅ | Fully covered |
| Triangle | ✅ | ✅ | ❌ | ❌ | Pyramid works |
| Convex N-gon | ✅ | ✅ | ❌ | ❌ | Apex-over-centroid |
| **L / U / T / concave** | ✅ | ⚠ | ❌ | ❌ | Flat always works; pyramid may put apex outside; gable/hip refuse |
| Polygon with holes | ✅ | ⚠ | ❌ | ❌ | Hole ignored by our face walker |

**LoD 2.2 features per roof type:**

| Feature | Flat | Pyramid | Gable | Hip |
|---|---|---|---|---|
| Eave/rake overhang | ❌ disabled | ❌ disabled | ❌ disabled | ❌ disabled |
| Procedural windows | ✅ all walls | ✅ all walls | ✅ long walls only | ✅ all walls |
| Procedural door | ✅ first wall | ✅ first wall | ✅ first long wall | ✅ first wall |

The disabled overhang controls are intentional: the previous implementation emitted zero-thickness overhang/soffit faces inside one `Solid`, which fails ISO 19107 primitive validation. Re-enabling this needs a validated roof-slab model, not just a UI toggle. The pure-JS roof generators are still used for flat/pyramid/gable/hip roofs without overhang.

**Why not WASM straight-skeleton?** No ready npm package; CGAL+Emscripten build is 3–7 days. Our pure-JS generators cover the common flat/rectangle/pyramid cases at zero dependency cost. Straight-skeleton remains the "right answer" for concave and multi-ridge roofs, but it does not by itself solve the overhang roof-slab validity issue.

---

## 6. Simulator consumption — LoD 2 is the target

| Simulator family | Example tools | Needs LoD | Why |
|---|---|---|---|
| Urban energy demand | SimStadt, CitySim, UMEP | **LoD 2** | Wants wall/roof orientations + areas + storeys + use; windows are attributes not geometry |
| Urban microclimate / CFD | ENVI-met, Palm-4U | **LoD 2** | Building envelopes; LoD 3 complicates meshing without analytical gain |
| Solar / PV | r.sun, UMEP SEBE | **LoD 2** | Roof planes with pitch + azimuth |
| Noise propagation | NoiseModelling | **LoD 1 or 2** | Sound barriers only |
| Flood / stormwater | TUFLOW, HEC-RAS 2D | **LoD 1** | Footprints + heights only |
| Daylighting / indoor | RADIANCE, DAYSIM | **LoD 3+** | Real window geometry matters — IFC usually better |
| Structural / seismic | OpenSees | **IFC / LoD 4** | Internal elements; CityJSON out of scope |

For any simulator in the first five rows, LoD 2 is what we want. Regenerative edits (split, roof change) stay LoD 2. Hedge against LoD 3 needs: roadmap item #4 adds procedural door/window sidecars.

---

## 7. Known limitations

- **Browser memory**: a single monolithic CityJSON above ~200 MB starts to strain. The Hamburg catalog fetches sequence tiles by viewport, refuses requests above 25 unseen tiles, and evicts clean off-screen tiles. Unsaved dirty tiles intentionally remain resident until **Save seq** succeeds.
- **Footprint extraction**: fan-triangulates outer rings, skips holes.
- **Roofs on non-rectangles**: gable/hip refuse; pyramid can look wrong on concave.
- **Roof overhangs**: eave/rake controls remain disabled at 0 m until the generator emits a validated roof-slab/soffit topology. This is a geometry-validity problem, not a missing JavaScript slider or a failed WASM load.
- **Compound floor-plan subdivision**: manual footprint cuts currently split rectangular footprints along one selected axis. If a top floor is divided into multiple footprint sections, those section roofs are flat rather than clipped pieces of the source pitched roof.
- **Arbitrary division line for BuildingParts**: the current precise controls are percentage cuts along the selected rectangle axis. "Draw any line on any building and split it into two BuildingParts" is a separate geometry task: polygon clipping for arbitrary/concave footprints, hole handling, per-part roof strategy, parent/child semantics, and val3dity/cjval coverage. Treat this as implementation work, not demo-ready.
- **Three.js side-panel viewer re-parses** on selection change (fast enough for single buildings).
- **Local write-back is single-machine oriented** — the tile server queues writes, requires SHA-256 `If-Match` revisions, keeps `.history/` backups, and validates changed tiles structurally plus with `val3dity`. Authentication, shared-user history, and incremental published 3D Tiles regeneration belong to the production backend.
- **Hamburg strict catalog is not yet losslessly complete** — 3,387 official source features are retained under `quarantine/` pending repair; the primitive-valid editing catalog contains 385,342 features.
- **Road terrain/profile**: v1 road surfaces are generated as flat CityJSON Transportation surfaces at the document base elevation. Terrain draping, road longitudinal profile, kerbs, and superelevation belong to the transportation/backend phase.
- **OSM write-back**: intentionally not implemented. The editor treats OSM as reference data and emits CityJSON/backend payloads.
- **OpenDRIVE import**: not implemented without a real Hamburg `.xodr` sample and lane semantics mapping pass. The internal `RoadDraft` model is the integration point.

---

## 8. What's left — roadmap (priority order)

**Done in the current transportation integration window (2026-06-24 → 2026-07-14):**
- ✅ **CityJSON-only road edit lifecycle** — added dirty-aware cancellation, imported-road draft derivation, in-place same-id save plus compaction, and continuous mouse-locked centerline handle dragging.
- ✅ **Portable local Hamburg road catalog** — added a dry-runnable one-command bootstrap plus a dedicated port-8788 server command; successful builds retain only validated CityJSONSeq tiles and skip when the complete catalog already exists, so no arbitrary 1 km or full-city data blob is committed.
- ✅ **osm2streets panic hardening and complete Hamburg export** — root-fixed the zero-width and degenerate polygon paths in the Rust fork, added three offline regression fixtures, rebuilt matching WASM, passed seven-fixture native/browser parity with zero errors, repaired the three quarantined bboxes, and completed a validated 344,265-road Hamburg batch with `failed: 0`.
- ✅ **Stable semantic road rendering** — exact lane/intersection surfaces keep their polygons and colors between normal display, picking, and draft creation; bus lanes remain visibly red and identify as bus lanes; underground overlays use 50% opacity; satellite mode applies a further 72% opacity factor; and generic OSM hit paths no longer mask exact surfaces.
- ✅ **Planning completeness and road-panel cleanup** — XPlan and FNP now paginate to completion for a bounded clicked viewport with stale-request cancellation and explicit partial-load failures. Removed the non-automatic trusted-corridor upload gate and fixed draft-panel control sizing/text clipping.
- ✅ **Street Explorer parity baseline** — added full plain/lane/marking output, explorer-ordered layers, shared semantic styling, intersection polygons, lane/intersection inspection, connected-road highlighting, and real Hamburg regression fixtures.
- ✅ **Exact road-surface export chain** — added metric `TrafficAreaPolygonAsset` normalization, direct osm2streets lane-polygon CityJSON insertion, re-import/picking metadata, batch CityJSONSeq conversion, and the validated CityJSON → CityGML bridge.
- ✅ **Metric road-query and fit slices** — moved Overpass caps into the active projected CRS, added metric 0.5 m hard and 1 m warning building-clearance checks, and added vertical road profiles with z-aware collision decisions for editable and exact-surface paths.
- ✅ **Road editor integration cleanup** — added the visual draggable lane strip with direction arrows, restored the single closed `CityJSON Export & Backend` disclosure, and exposed vertical placement plus optional road elevation controls.
- ✅ **Projected road constraints** — robust metric intersection/difference geometry highlights actual building and planning conflicts; the reusable corridor/fitting algorithms remain tested but are intentionally not exposed until an authoritative automatic corridor source exists.
- ✅ **Plan reconciliation** — qualified osm2streets as the OSM-derived reference/exact engine while retaining intentional manual `RoadDraft` ribbons, and aligned the transportation plans with the delivered vertical, clearance, projected-geometry, rendering, and panic-hardening baseline.

**Done since the last status update (2026-06-01 → 2026-06-08):**
- ✅ **Transportation road-editing v1** — added Road editor overlay, OSM Overpass road fetch, satellite basemap toggle, OSM lane/speed inference and user confirmation, manual road centerline redraw, lane/band width and direction controls, percentage section split, CityJSON Transportation `Road` insertion, map preview/picking, and backend-ready JSON export/POST.
- ✅ **Terrain-aware building move** — transform mode now exposes dX/dY/rotation plus manual dZ, auto terrain snap, and a "snap ground to terrain" action. Mouse drag updates dX/dY and, when auto terrain is enabled, adjusts dZ so the moved building footprint lands on the local terrain sample before "Place" commits.
- ✅ **Hamburg MultiSurface export regression** — structural validation now uses the declared CityJSON geometry type before checking shell semantics, so valid imported `MultiSurface` face semantics are no longer misreported as `Solid` shell mismatches (`semantics.values has 22 shells, boundaries has 1`).
- ✅ **Planning click details** — clicking a loaded Hamburg planning polygon now expands the legend with source, label, mapped compatible building types, and available plan attributes instead of relying on color alone.
- ✅ **Hamburg initial camera + data-scope clarity** — the committed demo carries its close pitched camera in CityJSON metadata, while arbitrary files still initialize from their loaded bounds and whole-city catalogs retain viewport loading.
- ✅ **Overhang/split-line status cleanup** — status notes now match the code: overhang controls are disabled pending a validated roof-slab model, and arbitrary drawn split lines are documented as a separate geometry-clipping task.
- ✅ **Loader modal + simplified toolbar** — Data opens the load modal over the current map instead of clearing state, advanced loader choices are collapsed, and secondary map actions moved under More for a cleaner demo surface.

**Done since the previous status update (2026-05-26 → 2026-06-01):**
- ✅ **Existing-geometry integrity repair** — fixed imported-building promotion so generated replacement vertices are appended before geometry is installed; moves now reject non-finite values, preserve unquantized decimal coordinates, refresh stored extents, and compact orphaned transform vertices on commit.
- ✅ **Real Hamburg move smoke pass** — locally loaded one hierarchy from `Data/hamburg-565-5936.city.jsonl`, moved it, compacted it, serialized it, parsed it again, and passed the structural integrity checker after reopen.
- ✅ **Per-floor footprint planner** — added combined floor + footprint subdivision with independently editable floor plans, manual percentage cuts, an apply-to-all-floors checkbox, per-floor 2D previews, and matching 3D divider overlays.
- ✅ **Hierarchical import promotion** — imported Buildings whose LoD geometry lives on `BuildingPart` children can now be inferred and promoted to a standalone parametric Building without leaving duplicate child geometry attached.
- ✅ **Whole-city Hamburg LoD2 preparation CLI** — resolves the newest official LGV complete-city CityGML archive, downloads/extracts on demand, converts tile-by-tile to editable CityJSONSeq, rejects structural failures, optionally invokes official `cjval`, emits `catalog.json`, and serves bbox tile lookup locally.
- ✅ **Official 2026 Hamburg whole-city batch** — downloaded `LoD2-DE_HH_2026-04-28.zip`, matched the published 659,524,658-byte size, extracted and schema-validated all 783 source GML tiles, converted all tiles to 388,729 editable CityJSONSeq features / 7,391,235 vertices / 863,708,269 bytes, and passed the repository structural validator twice with zero synthetic repairs.
- ✅ **Hamburg tile catalog proof** — bbox lookup and HTTP tile delivery passed against the generated 783-tile catalog.
- ✅ **Hamburg primitive geometry audit + strict editing set** — full isolated `val3dity 2.6.0` pass checked all 388,729 features, quarantined 3,387 defective originals, emitted 385,342 primitive-valid features across 782 strict editing tiles, and passed a second full audit with zero primitive defects and zero validator crashes.
- ✅ **Strict Hamburg move smoke pass** — a current cleaned centre-tile building passed parse, move, compact, serialize, reopen, and editor integrity checks; strict-catalog bbox lookup and HTTP delivery also passed.
- ✅ **CityJSONSeq-first viewport loading** — FileLoader now connects directly to the strict local Hamburg catalog, loads a bounded centre viewport, auto-fetches only unseen nearby `.city.jsonl` tiles as the map pans, normalizes compatible per-tile transforms exactly, and refuses oversized viewport requests until the user zooms in.
- ✅ **Multi-tile compaction repair** — replaced the large-array spread in `compactVertices` with chunked appends after a real Hamburg multi-tile edit smoke exposed a JavaScript call-stack overflow.
- ✅ **Validated CityJSONSeq write-back + eviction** — catalog tiles retain source-feature provenance and SHA-256 revisions; **Save seq** reconstructs local feature lines, queues atomic server writes with required `If-Match`, retains `.history/` backups, rejects blind writes and structural or `val3dity` failures, preserves partial checkpoint revisions for safe retry, removes sparse tiles safely after final-feature deletion, and evicts clean off-screen working-set tiles while preserving dirty ones.

**Done since the last status update (2026-05-13 → 2026-05-26):**
- ✅ **Viewport-filtered streaming UI wiring** — toolbar action reads the current map viewport, projects it into the dataset CRS, and re-parses cached CityJSONSeq text with `viewportBbox`.
- ✅ **Fullscreen BuildingCreator** — replaced the modal + floating preview with a single full-screen creator, visual roof picker, live Three.js geometry preview, and side-split plan preview.
- ✅ **Visual split previews** — side-subdivision now shows dashed plan-view cut lines in both create and edit flows; floor subdivision always shows 3D split rings, including equal-height mode.
- ✅ **Selectable side-split axis** — split-by-side accepts auto / longer / shorter axis choice, with preview and MIN_SIDE_WIDTH tests.
- ✅ **Make imported buildings editable** — imported CityJSON / Hamburg / IFC-derived objects can be converted into parametric geometry, preserving ids and user attributes.
- ✅ **In-place reshape** — editable buildings can switch roof type, raise/lower ridge/eave, and toggle openings without changing selection identity or hierarchy; overhang inputs remain locked by the current validity gate.
- ✅ **Reproducible loader setup** — removed the manual local loader clone requirement; `cityjson-threejs-loader` is now pinned to upstream commit `cf8db910`, and `regenerator-runtime` is tracked as an app runtime dependency.

**Done in the previous status window (2026-05-07 → 2026-05-13):**
- ✅ **Drag-to-move buildings on the map** — when a building's transform is pending, mouse drag on the map translates the ghost preview; WGS84 deltas are projected to the data's CRS so the numeric dX/dY fields stay in sync.
- ✅ **Floating 3D preview panel during creation** — Three.js viewer in the top-right corner of the map while drawing a new building; shows the actual generated roof shape, including windows/doors, in real time.
- ✅ **Multi-select + copy/paste** — Ctrl+click adds buildings to a secondary selection set (highlighted warm orange); Ctrl+C copies, Ctrl+V pastes with a 5m CRS offset and rewired parent/child relationships.
- ✅ **Delete buildings** — Delete/Backspace or toolbar button removes the primary + multi-selection; cascades into BuildingParts and cleans up surviving parents' `children` arrays.
- ✅ **Door / window detail editing** — `extractOpenings` finds Window/Door semantic surfaces; AttributePanel lists each with dimensions + elevation and exposes directional move buttons (±0.5m lateral, ±0.3m vertical).
- ✅ **Hamburg planning overlay** — replaced the synthetic zoning demo with live Hamburg planning data: XPlan `BP_BaugebietsTeilFlaeche` by viewport, FNP land-use fallback, same client-side legend, and lightweight building-function compatibility checks for new buildings.
- ✅ **Viewport-filtered CityJSONSeq streaming** — `parseCityJsonSeq` (and `parseCityJsonAuto`) accept an optional `viewportBbox` in the data's CRS; features whose decoded XY extent doesn't intersect are skipped before merging.
- ✅ **Drag-on-3D split-line handles** — split-preview rings in the side-panel viewer are now grab-and-drag; mousedown raycasts onto the ring (1m line threshold), vertical-plane raycasts follow the cursor, height transfers between adjacent floors with sum conservation and MIN_STOREY_HEIGHT clamping.
- ✅ **Gable rake overhang prototype (historical, now disabled)** — `rakeOverhang` geometry was prototyped, but the current generator rejects non-zero overhangs until a validated roof-slab model is available.
- ✅ **IFC import correctness** — fixed Y-up→Z-up rotation, refined IfcSlab classification, and triangle-winding correction for IFCs whose `flatTransformation` contains a reflection (negative-determinant 3×3 sub-matrix) — fixes "half the walls invisible" symptom on some IFC sources.

**Done in the previous status update (2026-04-23 → 2026-05-07):**
- ✅ **LoD 2.2 eave overhang prototype (historical, now disabled)** — all 4 roof types had soffit/cap geometry prototyped, but non-zero overhangs are currently blocked by the validation gate.
- ✅ **Procedural doors + windows** — full LoD 2.2 with per-storey window placement, hole-cut walls + standalone semantic Window/Door faces, narrow-wall + lintel-clearance skip logic.
- ✅ **Per-object / per-surface colouring mode** in the side-panel viewer — top-right toggle, warm architectural palette.
- ✅ **Visual division editor MVP** — custom per-floor heights with auto-distribute + sum-conservation validation + live 3D split-line preview rings.
- ✅ **Map tinting by roofType** — Hamburg / 3DBAG datasets now visually informative (CityGML integer codes + human strings both supported).
- ✅ **3DBAG smoke-test fixture** — synthetic dataset captures EPSG:7415 + multi-LoD geometry + `b3_*` attribute conventions, runs in CI without a download.
- ✅ **Live preview mesh with windows + doors** — the dialog's deck.gl preview now matches what the generator emits.
- ✅ **Footprint editing** (drag-and-drop building corners on the map) — TerraDrawSelectMode with `regenerateBuilding` re-running the parametric generator on the new shape; private `_*` attributes preserve every generator input across regenerations.
- ✅ **Binary glTF export** — `.glb` export with earcut hole-aware triangulation, semantic per-vertex colouring, centroid-relative Float32 positions, `extras.cityjson` metadata.
- ✅ **Integrity check** — full structural validator with severity tiers (error / warning / info), wired to a toolbar pill.
- ✅ **Vertex compaction** — `compactVertices` pass reclaims orphaned indices left behind by `regenerateBuilding`; toolbar surfaces a "Compact (N)" button when ≥ 50 orphans accumulate.
- ✅ **Filter bar** — text + roof-type + year-range + height-range filtering with map dimming for non-matches.
- ✅ **Undo / Redo** — snapshot-based history with keyboard shortcuts; covers every mutation handler.
- ✅ **Building list sidebar** — sortable list view of (filtered) buildings with click-to-select.

**Remaining roadmap (priority order):**

1. **IFC → CityJSON import polish** — Route #2 (`web-ifc` WASM in-browser) is working and covered by unit tests, but should be exercised against known real IFC files for error reporting, IFC-version quirks, and complex storey layouts. Lower priority — current quality is "demo-able but rough."
2. **Finish Hamburg external validation and quarantine repair** — Install official `cjval` and run it across the generated CityJSONSeq tiles. The source XML schema gate, repository structural gate, and `val3dity` primitive audit are green for the strict editing catalog. Repair and re-audit the 3,387 quarantined originals if the handoff requires lossless full-building coverage.
3. **Hamburg pipeline end-to-end with 3DCityDB** — Spin up Docker compose, run `citydb import`, validate round-trip. ~½ day (tooling in place).
4. **Transportation module next phase** — The [`OSM2STREETS_PANIC_HARDENING_PLAN.md`](OSM2STREETS_PANIC_HARDENING_PLAN.md) implementation and automated/browser gates are complete; retain its five-minute user acceptance checklist for deployment sign-off. The pinned r:trån runner and setup documentation now cover the first OpenDRIVE pipeline scaffold; next, add a tiny licensed/generated `.xodr` fixture and inspect its CityGML output, evaluate `muv-osm`, and choose an authoritative automatic corridor/parcel source before restoring corridor controls.
5. **Backend Phase 0** — Fastify + OGC API - Features + pg2b3dm + nginx. Add authentication, shared-user history, and incremental published-tile regeneration. Unlocks Tile3DLayer + full S15. ~1-2 weeks.

**Deferred (good ROI not obvious right now):**
- **WASM straight-skeleton** for non-rectangular gable/hip — CGAL+Emscripten build is 3-7 days for a narrow case (concave L/U/T shapes wanting gable/hip). Workaround: split into rectangular BuildingParts via the existing "Subdivide by side" path, then apply gable/hip per part. Re-evaluate if a demo requires real concave gables.

---

## 9. File tree

```
webcityeditor/
├── README.md                            Setup + feature overview
├── HiWi_LoD2_Proje_Plani_v2.docx       Revised project plan
├── LoD2_Editor_Onay_Dokumani.docx      Supervisor approval doc (19 decisions)
├── Data/                                LOCAL ONLY (gitignored) — user's CityGML/CityJSON fixtures
├── tools/                               LOCAL ONLY (gitignored) — citygml-tools, future citydb-tool
├── vendor/osm2streets/                  Git submodule for patched osm2streets fork
├── spike/
│   └── spike.html                       Hand-rolled CityJSON parser (baseline spike)
└── prototype/
    ├── PROTOTYPE_STATUS.md              THIS FILE
    ├── HAMBURG_PIPELINE.md              Hamburg complete-city CityGML→validated tiled CityJSONSeq workflow
    ├── OSM2STREETS_FORK_PLAN.md         osm2streets WASM/fork and lane UI plan
    ├── CITYGML_TRANSPORTATION_PLAN.md   CityGML Transportation, OpenDRIVE, and muv-osm plan
    ├── METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md
    ├── package.json                     React 19, Three 0.184, deck.gl 9, MapLibre 5, Terra Draw 1.31,
    │                                    pinned cityjson-threejs-loader, web-ifc, shadcn deps, proj4 2
    ├── public/data/manifest.json         Same-origin hosted sample manifest for GitHub Pages demos
    ├── public/data/hamburg/              Hamburg center ALKIS CityJSONSeq demo sample
    ├── scripts/build-hamburg-center-sample.mjs
    ├── scripts/build-osm2streets-wasm.ps1
    ├── scripts/build-hamburg-osm2streets-roads.mjs
    ├── scripts/prepare-hamburg-road-catalog.mjs
    ├── scripts/prepare-hamburg-roads-on-windows.ps1
    ├── scripts/cityjson-to-citygml.mjs
    ├── scripts/compare-osm2streets-fixtures.mjs
    ├── scripts/osm2streets-lanes-to-cityjson.mjs
    ├── scripts/hamburg-lod2.mjs         Whole-city download/conversion/validation/catalog server CLI
    ├── test-fixtures/osm2streets/        Hamburg OSM fixture comparison corpus
    ├── vendor/osm2streets-js/            Built wasm-pack package consumed by the app
    ├── tailwind.config.js / postcss.config.js / vitest.config.ts
    ├── vite.config.ts                   resolve.dedupe:['three']; exclude loader from pre-bundle
    ├── index.html
    └── src/
        ├── main.tsx / index.css / App.tsx
        ├── types.ts / cityjson-loader.d.ts
        ├── components/
        │   ├── ui/                      Button, Input, Label, Dialog, Select (shadcn)
        │   ├── Toolbar.tsx / FileLoader.tsx
        │   ├── MapView.tsx              MapLibre + deck.gl + Terra Draw + preview + auto-fit
        │   ├── Viewer.tsx               Three.js side-panel canvas
        │   ├── AttributePanel.tsx       Attrs + transform + subdivide
        │   └── BuildingCreator.tsx      Fullscreen new-building creator + live preview
        ├── lib/
        │   ├── cityjson.ts              Validate, parse (mono + seq), sample, diff
        │   ├── cityjsonseq-catalog.ts   Strict bbox tile loading + exact transform-normalized viewport merge
        │   ├── cityjsonseq-writeback.ts Source-grid reconstruction, revisioned persistence, clean-tile eviction
        │   ├── projection.ts            proj4 CRS registry + coord-magnitude CRS inference
        │   ├── footprints.ts            Extract polygons for deck.gl; filter to single building
        │   ├── footprint-tint.ts        Map roofType (string OR CityGML integer) → RGBA fill colour
        │   ├── filter.ts                Building filter — text + roof + year + height; matchingIds() helper
        │   ├── generator.ts             Flat/pyramid/gable/hip LoD 2(.2) Solid generators
        │   ├── generator-internal.ts    BuildOut / RectangularWall types shared with openings.ts
        │   ├── openings.ts              applyOpenings — windows + door (LoD 2.2)
        │   ├── preview-mesh.ts          Live roof mesh + window/door overlays for SimpleMeshLayer
        │   ├── regenerate.ts            Re-run the parametric generator on a new footprint, in place
        │   ├── compact.ts               compactVertices — reclaim orphaned indices after edits
        │   ├── integrity.ts             Structural integrity check — vertex bounds, parent links, …
        │   ├── gltf-export.ts           CityJSON → binary glTF (.glb) export
        │   ├── undo.ts                  UndoStore — snapshot-based history (push/undo/redo)
        │   ├── subdivision.ts           splitBuildingByFloor + splitBuildingByFloorHeights + splitBuildingBySide
        │   ├── transform.ts             moveBuilding / rotateBuilding (vertex-append-based)
        │   ├── transform-preview.ts     Live-preview footprint under pending transform
        │   ├── storage.ts               IndexedDB save/load/list
        │   ├── local-edit-artifacts.ts  Saveable CityJSON + semantic report + visual diff bundle
        │   ├── transportation.ts        RoadDraft ribbons, CityJSON Transportation, vertical profiles
        │   ├── osm2streets-draft.ts     Editable seeding + metric TrafficAreaPolygonAsset normalization
        │   ├── osm2streets-cityjson.ts  Exact lane assets → CityJSON Road MultiSurface
        │   ├── road-fit.ts              Building/planning/corridor/clearance/vertical validation
        │   └── __fixtures__/
        │       └── 3dbag-sample.ts      Synthetic 3DBAG-flavoured CityJSONSeq for offline smoke tests
        └── test/setup.ts
```

---

## 10. Test suite (518 tests across 59 files)

| File | Tests | Coverage |
|---|---|---|
| `lib/cityjson.test.ts` | 23 | Validation, parsing, root buildings, setAttribute, diff |
| `lib/cityjsonseq.test.ts` | 13 | CityJSONSeq parse, index-shift merge, limit, viewport bbox filtering, malformed-line tolerance, auto-detect |
| `lib/cityjsonseq-catalog.test.ts` | 6 | Strict catalog query, unseen-tile fetch, exact transform normalization, request cap, malformed-line rejection, bbox reprojection |
| `lib/cityjsonseq-writeback.test.ts` | 10 | Source-grid reconstruction, adjacent-transform write-back, per-floor footprint hierarchy round-trip, new-feature ownership, clean-tile eviction, required revisions, sparse-tile removal, pre-checkpoint tombstones, partial-save recovery |
| `lib/synthetic-parent.test.ts` | 4 | Hamburg LoD2 non-conformant `parents` recovery (synthesises a missing root Building) |
| `lib/projection.test.ts` | 11 | CRS detection + coord-magnitude fallback; 2D+3D reprojection and bbox helpers for EPSG:28992/7415/4978/25832 |
| `lib/roundtrip.test.ts` | 6 | edit -> stringify -> re-parse preserves every edit; geometry untouched |
| `lib/footprints.test.ts` | 7 | Extraction returns closed polygons in the right region; filterToBuilding scopes correctly |
| `lib/footprint-tint.test.ts` | 7 | roofType mapping: human strings <-> CityGML/3DBAG integer codes; alpha pass-through; fallback for unknown |
| `lib/filter.test.ts` | 22 | Building filter: text/roof/year/height matching, AND combinations, range helpers, isFilterEmpty, matchingIds |
| `lib/generator.test.ts` | 18 | Flat/pyramid/gable/hip generation, input validation, insertBuilding, round-trip for every roof type, storey-height validator |
| `lib/editor-actions.test.ts` | 4 | Browser action route for create/move/export, vertical terrain placement commit, guarded rollback, invalid export refusal |
| `lib/editor-actions-val3dity.test.ts` | 2 | Generated creator/detail variants and moved/subdivided buildings stay primitive-valid under val3dity |
| `lib/export-validation.test.ts` | 2 | Export preparation refuses structurally invalid documents and round-trips exact download bytes |
| `lib/local-edit-artifacts.test.ts` | 2 | Building and osm2streets road edits produce saveable CityJSON, semantic change reports, and GeoJSON visual-diff outputs |
| `lib/openings.test.ts` | 11 | LoD 2.2 procedural windows + door; ring orientation; gable-end skip; round-trip survival; narrow-wall / lintel-clearance skip |
| `lib/eave-overhang.test.ts` | 6 | Overhang validity gate: zero-overhang topology remains valid; eave/rake overhang values are rejected until a validated roof-slab model exists |
| `lib/preview-mesh.test.ts` | 8 | Live preview mesh: window/door overlay vertex counts, gable-end skip, narrow-wall skip, additive (never replaces) |
| `lib/3dbag-smoke.test.ts` | 8 | Synthetic 3DBAG fixture: EPSG:7415, multi-LoD geometry, `b3_*` attributes, vertex-index rewriting, roofType int<->str |
| `lib/hamburg-pipeline.test.ts` | 1 | Whole-city CLI validates the committed Hamburg CityJSONSeq sample |
| `lib/hamburg-sample.test.ts` | 3 | Hosted Hamburg ALKIS sample roof mesh, map mesh, and create-plus-export regression |
| `lib/hamburg-writeback-server.test.ts` | 1 | Disposable HTTP server: atomic structural write, SHA-256 revision, blind/stale-write rejection, history backup, malformed-body rejection, sparse-tile deletion |
| `lib/osm2streets-cityjson.test.ts` | 4 | Exact metric osm2streets lane assets become CityJSON Road MultiSurface surfaces; re-import preserves geometry, semantics, colors, and tunnel/layer vertical hints |
| `lib/osm2streets-cityjson-cli.test.ts` | 3 | Batch converter turns osm2streets lane-polygons GeoJSON into monolithic or sequence-only CityJSON Road features with importable semantics; real Hamburg native osm2streets polygons round-trip without geometry drift |
| `lib/hamburg-road-catalog-prepare.test.ts` | 1 | Portable Hamburg road-catalog dry-run resolves download, tiling, native exporter, sequence-only output, and local paths without filesystem mutation |
| `lib/osm2streets-draft.test.ts` | 3 | osm2streets lane selection seeds editable RoadDrafts and normalized polygon assets |
| `lib/transportation.test.ts` | 23 | OSM road and tagged street-point query/parsing, inference including pedestrian/shared/cycle paths, semantic source types, manual and exact road insertion, imported-surface draft derivation, vertical profiles/elevation persistence, reopened `_roadLayout` drafts, section splits, payloads, and geometry guards |
| `lib/osm2streets-style.test.ts` | 6 | Semantic lane/intersection/marking colors plus satellite and underground alpha composition |
| `lib/road-fit.test.ts` | 16 | Building/planning/corridor conflicts, trusted-corridor blocking, projected overlap/overflow polygons, metric hard/warning clearance, vertical uncertainty/separation, known-z collision, and per-area conflict identity |
| `lib/road-corridor.test.ts` | 3 | Trusted WGS84 Polygon/MultiPolygon corridor import, ring closing, part expansion, and invalid CRS/geometry rejection |
| `lib/road-corridor-fit.test.ts` | 4 | Largest safe proportional section width, unchanged fits, off-corridor centerline refusal, and 0.40 m semantic-band floor |
| `lib/road-query.test.ts` | 3 | Active-CRS Overpass bbox limiting and geographic fallback |
| `lib/cityjson-to-citygml-cli.test.ts` | 1 | CityJSON Road conversion to schema-valid CityGML 3.0 Transportation XML through citygml-tools |
| `lib/opendrive-rtron-cli.test.ts` | 1 | Pinned r:trån validation/conversion dry-run resolves Java, JAR, input, and output paths without filesystem mutation |
| `lib/regenerate.test.ts` | 14 | regenerateBuilding: footprint swap, attr preservation, reshape overrides, opening toggles, non-rectangular gable rejection, JSON round-trip |
| `lib/parametrise.test.ts` | 18 | Infer/import parametric attrs, normalise roofType, promote imported buildings and delegated BuildingPart hierarchies to valid editable generated geometry |
| `lib/compact.test.ts` | 9 | compactVertices: no-op on clean docs, reclaims orphans from regenerate, footprint shape preserved, idempotent, multi-tile-scale chunked append |
| `lib/integrity.test.ts` | 14 | Vertex-index bounds, dangling parent/child, asymmetric links, orphaned vertices, semantics shell/face mismatch, MultiSurface face semantics, NaN vertices |
| `lib/gltf-export.test.ts` | 14 | glb header validity, MultiSurface semantics, accessor counts/types, bufferView alignment, extras.cityjson metadata, refuses empty geometry |
| `lib/undo.test.ts` | 11 | UndoStore: push, undo, redo, redo-invalidation on new push, maxDepth cap, peek labels, deep-clone integrity, selection + dirty restoration |
| `lib/subdivision.test.ts` | 26 | canSplit, splitByFloor, splitByFloorHeights, per-floor footprint plans, manual cut fractions, selectable side-split axis, min-size enforcement |
| `lib/transform.test.ts` | 10 | move preserves originals; hierarchy integrity; vertical placement, extent refresh; decimal preservation without transform; non-finite rejection; rotation |
| `lib/terrain.test.ts` | 3 | Terrain snap estimation and auto/manual dZ transform behavior |
| `lib/ifc-to-cityjson.test.ts` | 14 | IFC mesh classification and CityJSON conversion helpers |
| `lib/ifc-import.test.ts` | 9 | web-ifc import orchestration and error handling boundaries |
| `lib/opening-edit.test.ts` | 9 | Opening extraction and directional window/door move operations |
| `lib/merge.test.ts` | 12 | Merge/import id conflicts, parent/child rewiring, exact transform normalization, precision-loss refusal |
| `lib/clipboard.test.ts` | 8 | Multi-select copy/paste cloning, offsets, and hierarchy rewiring |
| `lib/delete.test.ts` | 6 | Cascading deletion and surviving parent child-list cleanup |
| `lib/zoning.test.ts` | 28 | Hamburg XPlan/FNP URL builders, full pagination and deduplication, combined-source priority, viewport/feature caps, explicit partial-load failures, GeoJSON mapping, point-in-polygon and allow-list validation |
| `components/Toolbar.test.tsx` | 10 | Title, stats, dirty counter, catalog tile counter, sequence persistence, and Planning refresh wiring |
| `components/FileLoader.test.tsx` | 6 | Sample button, fetch errors, non-CityJSON rejection, strict local catalog connection, malformed sequence-line reporting |
| `components/RoadEditorPanel.test.tsx` | 11 | Responsive semantic band strip/reordering, explicit cancel, in-place save gating, closed advanced disclosure, vertical placement, osm2streets inspection actions, and imported-road edit actions |
| `hooks/useRoadEditor.test.tsx` | 2 | Dirty cancel preserves CityJSON and clears edit state; existing-road Save replaces the same id, compacts vertices, and remains structurally valid |
| `components/AttributePanel.test.tsx` | 13 | Attribute rendering, priority sort, numeric/string/boolean coercion, revert gating, terrain move controls, shared and independent floor-plan controls |

---

## 11. How to run

Prerequisites for the committed showcase: Node.js 20+, npm, Git. Rust/Cargo is
required only for generating/refreshing the complete local osm2streets road
catalog; Java 17+ and Docker remain optional for the Hamburg building pipeline /
future backend.

```bash
git clone https://github.com/cakirmert/webcityeditor.git
cd webcityeditor
cd prototype
npm ci
npm run dev  # http://localhost:5173, Hamburg center auto-loads
npm test
```

For Hamburg CityGML conversion, see `HAMBURG_PIPELINE.md`.
