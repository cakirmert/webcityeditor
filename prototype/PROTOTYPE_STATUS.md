# City Editor Prototype — Status

Source of truth for **what was planned, what's delivered now, and what's left**. Complements `LoD2_Editor_Onay_Dokumani.docx` (the 19-question approval document) with a concrete code-aware delta.

**Last updated**: 2026-06-01. **Test suite**: 385 passing across 35 files. **TypeScript**: clean. **Production build**: clean. **Dependency setup**: clean `npm ci`; CityJSON loader pinned to upstream commit `cf8db910`.

---

## 1. What it does today

React editor with a client-side edit model. A lightweight local Hamburg tile-catalog server now supports prepared whole-city LoD2 viewport loading and validated sequence-tile write-back; the full database backend is still pending.

### Load
- **CityJSONSeq** (`.jsonl`, `.city.jsonl`) — preferred city-scale input format, one feature per line; explicit sequence files use strict line parsing so malformed features surface immediately
- **Strict Hamburg CityJSONSeq catalog connection** — load screen connects to the local bbox server, opens a bounded centre viewport, then automatically fetches unseen nearby tiles as the map pans. Differing tile transforms are normalized exactly onto one integer grid; requests above 25 unseen tiles require zooming in first. **Save seq** persists edited source tiles with revision checks, backups, structural validation, and `val3dity`; clean off-screen tiles unload automatically.
- Monolithic CityJSON 2.0 (`.json`, `.city.json`) — retained for small models and modified working-set export
- Drop / file browse / URL fetch / built-in sample cube
- Hosted Hamburg center sample under `public/data/hamburg/hamburg-center-alkis.city.jsonl`; FileLoader surfaces it from the same origin through `public/data/manifest.json`, so it works on GitHub Pages without CORS.
- Recent-saves list from IndexedDB
- Auto-detects CRS, either from `metadata.referenceSystem` OR from the magnitude of `transform.translate` (UTM 32N / 33N / Dutch RD New) as a fallback
- 10 CRS registered via proj4: EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514

### Display
- **MapLibre** basemap (CARTO light raster tiles with OSM attribution; switched away from `tile.openstreetmap.org` after Hamburg tiles returned 404)
- **deck.gl** context layer — LoD by zoom: outlined footprints below 14.5, extruded blocks above
- **Hamburg planning overlay** — toolbar fetches real Hamburg XPlan `BP_BaugebietsTeilFlaeche` polygons for the current viewport, falls back to FNP land-use GeoJSON when XPlan has no polygons, and renders the result as a semi-transparent planning layer. This is a planning-data aid, not a legal compliance decision.
- Click a building → side panel with a per-building Three.js scene
- **Auto-fit on load**: bbox of footprints → `metadata.geographicalExtent` → `transform.translate` as centre — three fallbacks so EVERY file ends up focused.
- Fullscreen toggle on the side panel for focused editing

### Create new buildings
- **＋ New Building** toolbar action activates Terra Draw polygon mode
- **Snap-to-existing-footprints** within 20 px while drawing
- Fullscreen creator overlay with dimensions, overhang, attributes, openings, and subdivision sections
- Visual roof picker for **flat, pyramid, gable, hip** with DIN-inspired storey-height validation
- **Live 3D preview** while creating — roof shape, **windows, door, eave overhang, rake overhang, and split previews** update as you type
- **Procedural openings (LoD 2.2)** — Windows / Door checkboxes in the dialog. When enabled, the generator emits per-storey window holes (1.4 × 1.5 m, 0.9 m sill, ~3 m spacing) on every rectangular wall and a single 1.0 × 2.1 m door on the first wall. Each opening is both an inner-ring hole on the parent wall AND a separate co-planar `Window`/`Door` semantic surface. Bumps the geometry's LoD label from `2.0` to `2.2`.
- **LoD 2.2 eave overhang** — `Eave overhang (m)` input. Adds extending wall-top + roof-edge vertex rings, `OuterCeilingSurface` soffits, and (for gable) rake-corner-cap triangles. **Supports all 4 roof types**: flat, pyramid, hip, gable.
- **Subdivide-on-create**: choose "none / floors / sides" with a count; split applies immediately after insertion
- **Planning compatibility check**: when the Hamburg planning overlay is loaded, new-building creation checks the footprint against the fetched planning polygon's mapped building-use categories.
- The parametric generator produces a proper LoD 2 `Solid` with `GroundSurface` / `RoofSurface` / `WallSurface` (+ optional `OuterCeilingSurface` / `Window` / `Door`) semantics. Round-trip through JSON.stringify tested for every roof type and every opening combination.

### Edit existing buildings
- Attribute editor with priority-sorted rows, type coercion (number/string/boolean)
- Dirty tracking, per-building revert, toolbar dirty-count
- **Transform mode**: "Start editing position" enters a live-preview mode with dX/dY/angle inputs + quick-step buttons; map renders a ghost of the transformed footprint; Save commits, Cancel discards. Works on ANY building (generated or imported). Commits preserve shared source vertices safely, refresh stored geographical extents, reject non-finite values, and compact orphaned transform vertices before export.
- **Make editable for imports**: imported CityJSON / Hamburg / IFC-derived buildings can be promoted to parametric form after a confirmation that original mesh detail will be replaced. Promotion now appends replacement vertices correctly and consumes replaced `BuildingPart` descendants, including imports whose geometry lives only on child parts.
- **Edit footprint mode** (parametric/editor-created/promoted buildings): "Edit footprint corners" loads the building's outline as a TerraDrawSelectMode polygon with draggable vertex handles + midpoint dots that split edges into new corners. Save calls `regenerateBuilding` which re-runs the parametric generator with the new shape and the building's stashed parametric attributes (`_eaveHeight`, `_addWindows`, `_eaveOverhang`, …) intact.
- **Reshape mode**: editable buildings expose in-place roof type, ridge/eave height, eave/rake overhang, and window/door toggles. Apply regenerates geometry without changing the id, footprint, or parent/child linkage.
- **Subdivide — visual division editor**: split-by-floor with two modes:
  - **"Split equally"**: the original uniform N-floor split.
  - **"Custom heights…"**: per-floor wall-height input (auto-seeded with 3.5 m ground + equal upper floors — German residential pattern), live Σ display turning red when heights drift, ⚠ badge when any floor falls below MIN_STOREY_HEIGHT, sum-conservation enforced before Apply unlocks.
  - **Live 3D split-line preview**: the side-panel Three.js viewer draws horizontal accent rings around the building outline at each cumulative split height as you edit — no more "edit numbers blind".
- **Subdivide — split-by-side** with MIN_SIDE_WIDTH=3m enforced, visual plan preview, and selectable auto / longer / shorter split axis.
- **Subdivide — per-floor footprint plans**: a combined planner divides the building vertically and by footprint in one pass. Each floor can have its own rectangular side-section count, axis, and manual percentage cuts; a checkbox applies one floor plan to all floors. The side panel renders a plan preview for every floor and the Three.js viewer overlays the horizontal floor rings plus vertical divider outlines.
- Floor splits work on any unsplit Building, including imported buildings. Footprint section plans currently require a rectangular footprint.
- **Map tinting by roofType**: outline + extruded layers colour each footprint by its `roofType` attribute (flat=cool grey, gable=terracotta, hip=deeper terra, pyramid=walnut, +shed/mansard/barrel). Recognises CityGML/3DBAG integer codes (1000, 2100, 3100, 3200, 3300, 3400, 5100) AND human-readable strings, including 3DBAG's `roofType: 1000` / `roofType: "flat"` mixed convention.
- **3D viewer color-mode toggle**: top-right of the side-panel viewer flips between "By surface" (semantic — distinct tints for Wall / Roof / Window / Door / OuterCeiling) and "By object" (CityObject type — Building / Bridge / Plant / Road). No re-load; flips a uniform on the parser's mesh material.
- Export → downloads a modified CityJSON
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
- Tailwind utility classes for layout; CSS variables for theme
- Dark palette; focus rings; consistent hover states; polished scrollbars

---

## 2. Planned vs delivered (approval doc, S1–S19)

| # | Decision | Status | Notes |
|---|---|---|---|
| S1 | CityJSON 2.0 primary format | ✅ | In-memory state = single source of truth |
| S2 | CityJSON → 3DCityDB import healthy | 🟡 doc | Covered in HAMBURG_PIPELINE.md; not executed end-to-end yet |
| S3 | No data loss on client-side edits | ✅ | Round-trip tested for every roof type; vertex integer encoding preserved |
| S4 | Backend-mediated DB access | ⚪ mock | IndexedDB stands in for now |
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
| S19 | 3DBAG as primary test data; Hamburg via CityGML | ✅ / partial | 3DBAG quick-sample; ALKIS demo; official 2026 whole-city LoD2 batch converted and audited; strict editing catalog emitted with primitive-invalid originals quarantined |

---

## 3. Hamburg workflow — current state

1. Committed browser-safe demo: `public/data/hamburg/hamburg-center-alkis.city.jsonl`.
2. Demo source: official Hamburg ALKIS building footprints via the public ArcGIS FeatureServer, regenerated with `npm run data:hamburg-center`.
3. Demo output: 180 real Hamburg center footprints as CityJSONSeq. Heights are demo extrusions derived from storey count, not official LoD2 roof geometry.
4. Authoritative source: LGV's complete-city LoD2-DE CityGML 1.0 archive. As of 2026-06-01, the script resolves `LoD2-DE_HH_2026-04-28.zip` (659,524,658 bytes) from the live official metadata endpoint.
5. Whole-city preparation: `npm run data:hamburg-lod2 -- download`, `extract`, then `convert --cjval cjval`. This emits one structurally validated editable `.city.jsonl` per CityGML tile plus `catalog.json`.
6. Primitive-valid editing set: run `geometry-audit --allow-invalid`, then `geometry-clean`. This retains defective source features under `Data/hamburg-lod2/quarantine/` and emits strict tiles under `Data/hamburg-lod2/cityjsonseq-clean/`.
7. Local city-scale access: `npm run data:hamburg-lod2 -- serve --output-dir ../Data/hamburg-lod2/cityjsonseq-clean` exposes bbox tile lookup, tile delivery, and revision-checked validated tile write-back on `http://127.0.0.1:8787`.
8. FileLoader exposes **Connect catalog** for the local strict CityJSONSeq server. It loads a bounded centre viewport and fetches unseen adjacent sequence tiles after map pans while preserving dirty edits. The toolbar's **Save seq** action checkpoints edited tiles; clean off-screen tiles are evicted to keep long pan sessions bounded.
9. FileLoader exposes the committed ALKIS demo automatically from GitHub Pages with no CORS issue. The Planning toolbar fetches live Hamburg XPlan polygons for the same area.

**Tested**: Hamburg center ALKIS sample → 180 buildings → 6,034 vertices; Planning toggle returned 238 XPlan polygons in the local browser check. The official 2026 LoD2 archive downloaded and extracted to 783 tiles; every source GML passed `citygml-tools validate`; all tiles converted to 388,729 editable CityJSONSeq building features and 7,391,235 vertices; structural validation passed during conversion and again as a second full pass. Full isolated `val3dity 2.6.0` audit found 3,338 primitive-invalid originals plus 49 validator-crashing originals. The strict editing build quarantined those 3,387 source features, emitted 385,342 primitive-valid features across 782 tiles, and then passed a second citywide `val3dity` audit with zero defects and zero crashes. Strict-catalog bbox lookup and HTTP tile delivery passed. A current strict 2026 centre-tile building passed editor-library move, compact, save, reopen, and integrity checks. A real catalog-client smoke also loaded nine strict tiles, fetched unseen adjacent sequence tiles after a simulated pan, normalized differing transforms exactly, moved an imported building, compacted the larger working set, serialized, reopened, and passed integrity checks. A copied current strict centre tile then passed the complete HTTP write-back path: catalog load, imported-building move by `+7.5 m / -2.25 m`, local-grid reconstruction, structural validation, `val3dity`, atomic replacement, refetch, reopen, coordinate comparison, and integrity check. A generated two-floor plan with independent upper-floor footprint sections also serialized as one feature hierarchy and passed `val3dity`. The manual browser acceptance pass is still pending.

Caveats:
- `citygml-tools` defaults to writing `.jsonl` rather than `.city.jsonl` for `-l` output; we accept both extensions.
- Hamburg's LoD 2 files have a Building → BuildingPart hierarchy (the Building has no geometry, its children carry it). Our `extractFootprints` walks children, so this works.
- Full Hamburg is not browser-loadable in one document. The current 2026 conversion is 863,708,269 bytes across 783 CityJSONSeq tiles; the pipeline serves a bbox-queryable catalog.
- The committed Hamburg center sample is not LoD2. Use it for demo/data-loading/planning-overlay feedback, then replace or complement it with a converted LoD2 tile.
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
| Eave overhang | ✅ | ✅ | ✅ (long sides only) | ✅ |
| Procedural windows | ✅ all walls | ✅ all walls | ✅ long walls only | ✅ all walls |
| Procedural door | ✅ first wall | ✅ first wall | ✅ first long wall | ✅ first wall |

Gable's eave overhang covers the long-side eaves and emits 4 rake-corner-cap triangles to close the geometric gap at each gable corner. Full rake overhang (extending the ridge past the gable wall) is **not** implemented — it changes the ridge length and roof slope angles, and would need a separate roadmap item if a demo demands it.

**Why not WASM straight-skeleton?** No ready npm package; CGAL+Emscripten build is 3–7 days. Our pure-JS generators cover the common cases at zero dependency cost. Straight-skeleton remains the "right answer" for concave and multi-ridge roofs — roadmap item for later.

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
- **Compound floor-plan subdivision**: manual footprint cuts currently split rectangular footprints along one selected axis. If a top floor is divided into multiple footprint sections, those section roofs are flat rather than clipped pieces of the source pitched roof.
- **Three.js side-panel viewer re-parses** on selection change (fast enough for single buildings).
- **Local write-back is single-machine oriented** — the tile server queues writes, requires SHA-256 `If-Match` revisions, keeps `.history/` backups, and validates changed tiles structurally plus with `val3dity`. Authentication, shared-user history, and incremental published 3D Tiles regeneration belong to the production backend.
- **Hamburg strict catalog is not yet losslessly complete** — 3,387 official source features are retained under `quarantine/` pending repair; the primitive-valid editing catalog contains 385,342 features.

---

## 8. What's left — roadmap (priority order)

**Done since the last status update (2026-05-26 → 2026-06-01):**
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
- ✅ **In-place reshape** — editable buildings can switch roof type, raise/lower ridge/eave, toggle openings, and change eave/rake overhangs without changing selection identity or hierarchy.
- ✅ **Reproducible loader setup** — removed the manual local loader clone requirement; `cityjson-threejs-loader` is now pinned to upstream commit `cf8db910`, and `regenerator-runtime` is tracked as an app runtime dependency.

**Done in the previous status window (2026-05-07 → 2026-05-13):**
- ✅ **Drag-to-move buildings on the map** — when a building's transform is pending, mouse drag on the map translates the ghost preview; WGS84 deltas are projected to the data's CRS so the numeric dX/dY fields stay in sync.
- ✅ **Floating 3D preview panel during creation** — Three.js viewer in the top-right corner of the map while drawing a new building; shows the actual generated roof shape (incl. windows/doors/overhang) in real time.
- ✅ **Multi-select + copy/paste** — Ctrl+click adds buildings to a secondary selection set (highlighted warm orange); Ctrl+C copies, Ctrl+V pastes with a 5m CRS offset and rewired parent/child relationships.
- ✅ **Delete buildings** — Delete/Backspace or toolbar button removes the primary + multi-selection; cascades into BuildingParts and cleans up surviving parents' `children` arrays.
- ✅ **Door / window detail editing** — `extractOpenings` finds Window/Door semantic surfaces; AttributePanel lists each with dimensions + elevation and exposes directional move buttons (±0.5m lateral, ±0.3m vertical).
- ✅ **Hamburg planning overlay** — replaced the synthetic zoning demo with live Hamburg planning data: XPlan `BP_BaugebietsTeilFlaeche` by viewport, FNP land-use fallback, same client-side legend, and lightweight building-function compatibility checks for new buildings.
- ✅ **Viewport-filtered CityJSONSeq streaming** — `parseCityJsonSeq` (and `parseCityJsonAuto`) accept an optional `viewportBbox` in the data's CRS; features whose decoded XY extent doesn't intersect are skipped before merging.
- ✅ **Drag-on-3D split-line handles** — split-preview rings in the side-panel viewer are now grab-and-drag; mousedown raycasts onto the ring (1m line threshold), vertical-plane raycasts follow the cursor, height transfers between adjacent floors with sum conservation and MIN_STOREY_HEIGHT clamping.
- ✅ **Gable rake overhang** — new `rakeOverhang` param (separate from `eaveOverhang`) extends the ridge past each gable wall along the ridge axis; rake-corner-caps are replaced with planar "rake gable" triangles at the extreme ends. Walls keep the original ridge endpoints as their apex. Round-trip preserved via `_rakeOverhang` private attr.
- ✅ **IFC import correctness** — fixed Y-up→Z-up rotation, refined IfcSlab classification, and triangle-winding correction for IFCs whose `flatTransformation` contains a reflection (negative-determinant 3×3 sub-matrix) — fixes "half the walls invisible" symptom on some IFC sources.

**Done in the previous status update (2026-04-23 → 2026-05-07):**
- ✅ **LoD 2.2 eave overhang** — all 4 roof types, with `OuterCeilingSurface` soffits and (for gable) rake-corner-cap triangles.
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
4. **Backend Phase 0** — Fastify + OGC API - Features + pg2b3dm + nginx. Add authentication, shared-user history, and incremental published-tile regeneration. Unlocks Tile3DLayer + full S15. ~1-2 weeks.

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
├── spike/
│   └── spike.html                       Hand-rolled CityJSON parser (baseline spike)
└── prototype/
    ├── PROTOTYPE_STATUS.md              THIS FILE
    ├── HAMBURG_PIPELINE.md              Hamburg complete-city CityGML→validated tiled CityJSONSeq workflow
    ├── package.json                     React 18, Three 0.165, deck.gl 9, MapLibre 4, Terra Draw 1.28,
    │                                    pinned cityjson-threejs-loader, web-ifc, shadcn deps, proj4 2
    ├── public/data/manifest.json         Same-origin hosted sample manifest for GitHub Pages demos
    ├── public/data/hamburg/              Hamburg center ALKIS CityJSONSeq demo sample
    ├── scripts/build-hamburg-center-sample.mjs
    ├── scripts/hamburg-lod2.mjs         Whole-city download/conversion/validation/catalog server CLI
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
        │   └── __fixtures__/
        │       └── 3dbag-sample.ts      Synthetic 3DBAG-flavoured CityJSONSeq for offline smoke tests
        └── test/setup.ts
```

---

## 10. Test suite (385 tests across 35 files)

| File | Tests | Coverage |
|---|---|---|
| `lib/cityjson.test.ts` | 23 | Validation, parsing, root buildings, setAttribute, diff |
| `lib/cityjsonseq.test.ts` | 13 | CityJSONSeq parse, index-shift merge, limit, viewport bbox filtering, malformed-line tolerance, auto-detect |
| `lib/cityjsonseq-catalog.test.ts` | 6 | Strict catalog query, unseen-tile fetch, exact transform normalization, request cap, malformed-line rejection, bbox reprojection |
| `lib/cityjsonseq-writeback.test.ts` | 10 | Source-grid reconstruction, adjacent-transform write-back, per-floor footprint hierarchy round-trip, new-feature ownership, clean-tile eviction, required revisions, sparse-tile removal, pre-checkpoint tombstones, partial-save recovery |
| `lib/synthetic-parent.test.ts` | 4 | Hamburg LoD2 non-conformant `parents` recovery (synthesises a missing root Building) |
| `lib/projection.test.ts` | 9 | CRS detection + coord-magnitude fallback; 2D+3D reprojection for EPSG:28992/7415/4978/25832 |
| `lib/roundtrip.test.ts` | 6 | edit -> stringify -> re-parse preserves every edit; geometry untouched |
| `lib/footprints.test.ts` | 7 | Extraction returns closed polygons in the right region; filterToBuilding scopes correctly |
| `lib/footprint-tint.test.ts` | 7 | roofType mapping: human strings <-> CityGML/3DBAG integer codes; alpha pass-through; fallback for unknown |
| `lib/filter.test.ts` | 22 | Building filter: text/roof/year/height matching, AND combinations, range helpers, isFilterEmpty, matchingIds |
| `lib/generator.test.ts` | 18 | Flat/pyramid/gable/hip generation, input validation, insertBuilding, round-trip for every roof type, storey-height validator |
| `lib/openings.test.ts` | 11 | LoD 2.2 procedural windows + door; ring orientation; gable-end skip; round-trip survival; narrow-wall / lintel-clearance skip |
| `lib/eave-overhang.test.ts` | 18 | LoD 2.2 eave/rake overhang for all 4 roof types; soffit topology; combine-with-openings without index collision |
| `lib/preview-mesh.test.ts` | 8 | Live preview mesh: window/door overlay vertex counts, gable-end skip, narrow-wall skip, additive (never replaces) |
| `lib/3dbag-smoke.test.ts` | 8 | Synthetic 3DBAG fixture: EPSG:7415, multi-LoD geometry, `b3_*` attributes, vertex-index rewriting, roofType int<->str |
| `lib/hamburg-pipeline.test.ts` | 1 | Whole-city CLI validates the committed Hamburg CityJSONSeq sample |
| `lib/hamburg-writeback-server.test.ts` | 1 | Disposable HTTP server: atomic structural write, SHA-256 revision, blind/stale-write rejection, history backup, malformed-body rejection, sparse-tile deletion |
| `lib/regenerate.test.ts` | 13 | regenerateBuilding: footprint swap, attr preservation, reshape overrides, opening toggles, non-rectangular gable rejection, JSON round-trip |
| `lib/parametrise.test.ts` | 18 | Infer/import parametric attrs, normalise roofType, promote imported buildings and delegated BuildingPart hierarchies to valid editable generated geometry |
| `lib/compact.test.ts` | 9 | compactVertices: no-op on clean docs, reclaims orphans from regenerate, footprint shape preserved, idempotent, multi-tile-scale chunked append |
| `lib/integrity.test.ts` | 13 | Vertex-index bounds, dangling parent/child, asymmetric links, orphaned vertices, semantics shell/face mismatch, NaN vertices |
| `lib/gltf-export.test.ts` | 13 | glb header validity, accessor counts/types, bufferView alignment, extras.cityjson metadata, refuses empty geometry |
| `lib/undo.test.ts` | 11 | UndoStore: push, undo, redo, redo-invalidation on new push, maxDepth cap, peek labels, deep-clone integrity, selection + dirty restoration |
| `lib/subdivision.test.ts` | 26 | canSplit, splitByFloor, splitByFloorHeights, per-floor footprint plans, manual cut fractions, selectable side-split axis, min-size enforcement |
| `lib/transform.test.ts` | 9 | move preserves originals; hierarchy integrity; extent refresh; decimal preservation without transform; non-finite rejection; rotation |
| `lib/ifc-to-cityjson.test.ts` | 14 | IFC mesh classification and CityJSON conversion helpers |
| `lib/ifc-import.test.ts` | 9 | web-ifc import orchestration and error handling boundaries |
| `lib/opening-edit.test.ts` | 9 | Opening extraction and directional window/door move operations |
| `lib/merge.test.ts` | 12 | Merge/import id conflicts, parent/child rewiring, exact transform normalization, precision-loss refusal |
| `lib/clipboard.test.ts` | 8 | Multi-select copy/paste cloning, offsets, and hierarchy rewiring |
| `lib/delete.test.ts` | 6 | Cascading deletion and surviving parent child-list cleanup |
| `lib/zoning.test.ts` | 17 | Hamburg XPlan/FNP URL builders, GeoJSON-to-planning-zone mapping, fetch fallback, point-in-polygon checks, and allow-list validation |
| `components/Toolbar.test.tsx` | 8 | Title, stats, dirty counter, catalog tile counter, sequence persistence, wiring |
| `components/FileLoader.test.tsx` | 6 | Sample button, fetch errors, non-CityJSON rejection, strict local catalog connection, malformed sequence-line reporting |
| `components/AttributePanel.test.tsx` | 12 | Attribute rendering, priority sort, numeric/string/boolean coercion, revert gating, shared and independent floor-plan controls |

---

## 11. How to run

Prerequisites: Node.js 20+, npm, Git. (Java 17+ and Docker are optional, for the Hamburg pipeline / future backend.)

```bash
git clone https://github.com/cakirmert/webcityeditor.git
cd webcityeditor
cd prototype
npm install
npm run dev        # http://localhost:5173
npm test
```

For Hamburg CityGML conversion, see `HAMBURG_PIPELINE.md`.
