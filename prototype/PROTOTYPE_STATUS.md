# City Editor Prototype — Status

Source of truth for **what was planned, what's delivered now, and what's left**. Complements `LoD2_Editor_Onay_Dokumani.docx` (the 19-question approval document) with a concrete code-aware delta.

**Last updated**: 2026-05-07 (afternoon). **Test suite**: 229 passing across 22 files. **TypeScript**: clean. **Production build**: clean. **Published**: [github.com/cakirmert/webcityeditor](https://github.com/cakirmert/webcityeditor).

---

## 1. What it does today

Browser-only React app. Everything client-side; no backend yet.

### Load
- Monolithic CityJSON 2.0 (`.json`, `.city.json`)
- **CityJSONSeq** (`.jsonl`, `.city.jsonl`) — streaming format, one feature per line, merged into a single in-memory document with consistent vertex indices
- Drop / file browse / URL fetch / built-in sample cube
- Recent-saves list from IndexedDB
- Auto-detects CRS, either from `metadata.referenceSystem` OR from the magnitude of `transform.translate` (UTM 32N / 33N / Dutch RD New) as a fallback
- 10 CRS registered via proj4: EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514

### Display
- **MapLibre** basemap (OSM raster tiles)
- **deck.gl** context layer — LoD by zoom: outlined footprints below 14.5, extruded blocks above
- Click a building → side panel with a per-building Three.js scene
- **Auto-fit on load**: bbox of footprints → `metadata.geographicalExtent` → `transform.translate` as centre — three fallbacks so EVERY file ends up focused.
- Fullscreen toggle on the side panel for focused editing

### Create new buildings
- **＋ New Building** toolbar action activates Terra Draw polygon mode
- **Snap-to-existing-footprints** within 20 px while drawing
- Dialog prompts for total height / storeys / roof type (**flat, pyramid, gable, hip**) with DIN-inspired storey-height validation
- **Live roof mesh preview** on the map via deck.gl `SimpleMeshLayer` — roof shape, **windows, and door** all update as you type
- **Procedural openings (LoD 2.2)** — Windows / Door checkboxes in the dialog. When enabled, the generator emits per-storey window holes (1.4 × 1.5 m, 0.9 m sill, ~3 m spacing) on every rectangular wall and a single 1.0 × 2.1 m door on the first wall. Each opening is both an inner-ring hole on the parent wall AND a separate co-planar `Window`/`Door` semantic surface. Bumps the geometry's LoD label from `2.0` to `2.2`.
- **LoD 2.2 eave overhang** — `Eave overhang (m)` input. Adds extending wall-top + roof-edge vertex rings, `OuterCeilingSurface` soffits, and (for gable) rake-corner-cap triangles. **Supports all 4 roof types**: flat, pyramid, hip, gable.
- **Subdivide-on-create**: choose "none / floors / sides" with a count; split applies immediately after insertion
- The parametric generator produces a proper LoD 2 `Solid` with `GroundSurface` / `RoofSurface` / `WallSurface` (+ optional `OuterCeilingSurface` / `Window` / `Door`) semantics. Round-trip through JSON.stringify tested for every roof type and every opening combination.

### Edit existing buildings
- Attribute editor with priority-sorted rows, type coercion (number/string/boolean)
- Dirty tracking, per-building revert, toolbar dirty-count
- **Transform mode**: "Start editing position" enters a live-preview mode with dX/dY/angle inputs + quick-step buttons; map renders a ghost of the transformed footprint; Save commits, Cancel discards. Works on ANY building (generated or imported).
- **Edit footprint mode** (editor-created buildings only): "Edit footprint corners" loads the building's outline as a TerraDrawSelectMode polygon with draggable vertex handles + midpoint dots that split edges into new corners. Save calls `regenerateBuilding` which re-runs the parametric generator with the new shape and the building's stashed parametric attributes (`_eaveHeight`, `_addWindows`, `_eaveOverhang`, …) intact. Imported buildings show a friendly disabled-state explanation.
- **Subdivide — visual division editor**: split-by-floor with two modes:
  - **"Split equally"**: the original uniform N-floor split.
  - **"Custom heights…"**: per-floor wall-height input (auto-seeded with 3.5 m ground + equal upper floors — German residential pattern), live Σ display turning red when heights drift, ⚠ badge when any floor falls below MIN_STOREY_HEIGHT, sum-conservation enforced before Apply unlocks.
  - **Live 3D split-line preview**: the side-panel Three.js viewer draws horizontal accent rings around the building outline at each cumulative split height as you edit — no more "edit numbers blind".
- **Subdivide — split-by-side** with MIN_SIDE_WIDTH=3m enforced.
- Both split modes work on any Building (imported buildings supported, not just editor-created).
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

### UI
- Full shadcn/ui — Button, Input, Label, Dialog, Select — across Toolbar, FileLoader, AttributePanel, NewBuildingDialog
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
| S6 | Edit existing building | ✅ | Attributes, transform (move/rotate), split — all on any building |
| S7 | ENU / local metric for edits | ✅ | proj4 handles WGS84 ↔ CRS, Three.js in model-local metres |
| S8 | LoD0 + LoD2 coexist per Building | ✅ | Native CityJSON hierarchy; LoD-by-zoom rendering on map |
| S9 | Three.js | ✅ | three 0.165, dedupe configured |
| S10 | cityjson-threejs-loader | ✅ | via file: link, cloned during setup |
| S11 | Custom serializer | ✅ | Mutate-in-place + JSON.stringify |
| S12 | Azul not used | ✅ | — |
| S13 | deck.gl + 3D Tiles + pg2b3dm | 🟡 partial | deck.gl ✓; Tile3DLayer and pg2b3dm need the backend phase |
| S14 | Single source of truth | ✅ | CityJSON state; every view derives |
| S15 | End-to-end edit flow | 🟡 partial | Client-side round-trip done; server-side write + tile regen needs backend |
| S16 | nginx tile serving | ❌ deferred | Backend phase |
| S17 | Incremental tile regeneration | ❌ deferred | Backend phase |
| S18 | Custom picking in Tile3DLayer | 🟢 different | deck.gl picking on SolidPolygonLayer is built-in; when we adopt Tile3DLayer, the workaround plan applies |
| S19 | 3DBAG as primary test data; Hamburg via CityGML | ✅ | 3DBAG default quick-sample; Hamburg pipeline runnable (citygml-tools installed, one tile converted successfully, 917 buildings loaded) |

---

## 3. Hamburg workflow — confirmed working

1. Hamburg publishes LoD 2 as a ZIP with `.GML` extension containing 788 tile `.xml` files (8 GB uncompressed).
2. Extract ZIP → pick a tile → run `citygml-tools to-cityjson -l -v 2.0 -c -e 25832 tile.xml`.
3. Output: `.jsonl` CityJSONSeq file, ~10× smaller than input.
4. Drop the `.jsonl` into the prototype's FileLoader.
5. Map auto-fits to the Hamburg tile, deck.gl extrudes the buildings, you can click-edit.

**Tested**: tile `LoD2_565_5936_1_HH` → 35 MB CityGML → 3.8 MB CityJSONSeq → 917 buildings, loads in ~1 s.

Caveats:
- `citygml-tools` defaults to writing `.jsonl` rather than `.city.jsonl` for `-l` output; we accept both extensions.
- Hamburg's LoD 2 files have a Building → BuildingPart hierarchy (the Building has no geometry, its children carry it). Our `extractFootprints` walks children, so this works.
- Full Hamburg (788 tiles) would be several GB of CityJSON — not browser-loadable in one go. Use per-tile or move to backend.

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
| cityjson-threejs-loader (TU Delft) | ✅ (cloned during setup) |
| Terra Draw 1.28 + MapLibre adapter | ✅ (incl. snap-to-existing) |
| proj4 | ✅ — 10 CRS + coord-magnitude inference fallback |
| **shadcn/ui** (Button/Input/Label/Dialog/Select) | ✅ — across every component |
| Tailwind CSS | ✅ (prerequisite for shadcn) |
| Radix UI primitives | ✅ (via shadcn) |
| straight-skeleton WASM | ❌ — replaced by pure-JS flat/pyramid/gable/hip generators (§5) |
| Node.js + Fastify | ❌ no backend |
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

- **Browser memory**: a single monolithic CityJSON above ~200 MB starts to strain. CityJSONSeq + `limitFeatures` mitigates; proper fix is the backend-tiled pipeline.
- **Footprint extraction**: fan-triangulates outer rings, skips holes.
- **Roofs on non-rectangles**: gable/hip refuse; pyramid can look wrong on concave.
- **Three.js side-panel viewer re-parses** on selection change (fast enough for single buildings).
- **No server-side validation** — client-only structural checks; not full spec conformance.

---

## 8. What's left — roadmap (priority order)

**Done since the last status update (2026-04-23 → 2026-05-07):**
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

**Remaining roadmap (priority order):**

1. **IFC → CityJSON import** — route #1 is doc-only (`ifc-to-cityjson` CLI); route #2 is `web-ifc` WASM in-browser (~1 week).
2. **Batch Hamburg tile conversion** — a little script to convert all 788 tiles at once, plus a quick-picker in the FileLoader listing all converted tiles. ~2 h.
3. **Viewport-filtered streaming** — in CityJSONSeq mode, skip features outside the current map viewport. Unlocks much larger files. ~½ day.
4. **WASM straight-skeleton** for non-rectangular gable/hip — CGAL+Emscripten build. ~3-7 days.
5. **Visual division editor — drag-on-3D handles** — let the user drag the split rings up/down in the 3D viewer instead of typing numbers. The numeric editor is already wired; this is a UX layer on top. ~1 day.
6. **Gable rake overhang** — extend the ridge past the gable wall + rebuild gable triangles. ~½ day (the long-side eave overhang already in place).
7. **Hamburg pipeline end-to-end with 3DCityDB** — spin up Docker compose, run `citydb import`, validate round-trip. ~½ day (tooling in place).
8. **Backend Phase 0** — Fastify + OGC API - Features + pg2b3dm + nginx. Unlocks Tile3DLayer + full S15. ~1-2 weeks.

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
│   ├── spike.html                       Hand-rolled CityJSON parser (baseline spike)
│   └── cityjson-threejs-loader/         Cloned during setup (gitignored)
└── prototype/
    ├── PROTOTYPE_STATUS.md              THIS FILE
    ├── HAMBURG_PIPELINE.md              Hamburg CityGML pilot (CityGML→CityJSON→DB→prototype)
    ├── package.json                     React 18, Three 0.165, deck.gl 9, MapLibre 4, Terra Draw 1.28,
    │                                    shadcn deps (Radix, Tailwind, CVA, lucide), proj4 2
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
        │   └── NewBuildingDialog.tsx    New-building form (shadcn)
        ├── lib/
        │   ├── cityjson.ts              Validate, parse (mono + seq), sample, diff
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
        │   ├── subdivision.ts           splitBuildingByFloor + splitBuildingByFloorHeights + splitBuildingBySide
        │   ├── transform.ts             moveBuilding / rotateBuilding (vertex-append-based)
        │   ├── transform-preview.ts     Live-preview footprint under pending transform
        │   ├── storage.ts               IndexedDB save/load/list
        │   └── __fixtures__/
        │       └── 3dbag-sample.ts      Synthetic 3DBAG-flavoured CityJSONSeq for offline smoke tests
        └── test/setup.ts
```

---

## 10. Test suite (229 tests across 22 files)

| File | Tests | Coverage |
|---|---|---|
| `lib/cityjson.test.ts` | 23 | Validation, parsing, root buildings, setAttribute, diff |
| `lib/cityjsonseq.test.ts` | 7 | CityJSONSeq parse, index-shift merge, limit, malformed-line tolerance, auto-detect |
| `lib/synthetic-parent.test.ts` | 4 | Hamburg LoD2 non-conformant `parents` recovery (synthesises a missing root Building) |
| `lib/projection.test.ts` | 8 | CRS detection + coord-magnitude fallback; 2D+3D reprojection for EPSG:28992/7415/4978/25832 |
| `lib/roundtrip.test.ts` | 6 | edit → stringify → re-parse preserves every edit; geometry untouched |
| `lib/footprints.test.ts` | 7 | Extraction returns closed polygons in the right region; filterToBuilding scopes correctly |
| `lib/footprint-tint.test.ts` | 7 | roofType mapping: human strings ↔ CityGML/3DBAG integer codes; alpha pass-through; fallback for unknown |
| `lib/filter.test.ts` | 22 | Building filter: text/roof/year/height matching, AND combinations, range helpers, isFilterEmpty, matchingIds |
| `lib/generator.test.ts` | 18 | Flat/pyramid/gable/hip generation, input validation, insertBuilding, round-trip for every roof type, storey-height validator |
| `lib/openings.test.ts` | 11 | LoD 2.2 procedural windows + door; ring orientation; gable-end skip; round-trip survival; narrow-wall / lintel-clearance skip |
| `lib/eave-overhang.test.ts` | 12 | LoD 2.2 eave overhang for all 4 roof types; soffit topology; rake-corner caps for gable; combine-with-openings without index collision |
| `lib/preview-mesh.test.ts` | 8 | Live preview mesh: window/door overlay vertex counts, gable-end skip, narrow-wall skip, additive (never replaces) |
| `lib/3dbag-smoke.test.ts` | 8 | Synthetic 3DBAG fixture: EPSG:7415, multi-LoD geometry, `b3_*` attributes, vertex-index rewriting, roofType int↔str |
| `lib/regenerate.test.ts` | 9 | regenerateBuilding: footprint swap, attr preservation, openings + overhang preservation, imported-building rejection, non-rectangular gable rejection, JSON round-trip |
| `lib/compact.test.ts` | 8 | compactVertices: no-op on clean docs, reclaims orphans from regenerate, footprint shape preserved, idempotent |
| `lib/integrity.test.ts` | 13 | Vertex-index bounds, dangling parent/child, asymmetric links, orphaned vertices, semantics shell/face mismatch, NaN vertices |
| `lib/gltf-export.test.ts` | 13 | glb header validity, accessor counts/types, bufferView alignment, extras.cityjson metadata, refuses empty geometry |
| `lib/subdivision.test.ts` | 18 | canSplit, splitByFloor, splitByFloorHeights (German tall-ground-floor pattern, sum conservation), splitBySide, min-size enforcement |
| `lib/transform.test.ts` | 7 | move preserves originals; rotate changes bbox; 360° returns to origin |
| `components/Toolbar.test.tsx` | 6 | Title, stats, dirty counter, wiring |
| `components/FileLoader.test.tsx` | 4 | Sample button, fetch errors, non-CityJSON rejection |
| `components/AttributePanel.test.tsx` | 11 | Attribute rendering, priority sort, numeric/string/boolean coercion, revert gating |

---

## 11. How to run

Prerequisites: Node.js 20+, npm, Git. (Java 21 + Docker are optional, for the Hamburg pipeline / future backend.)

```bash
git clone https://github.com/cakirmert/webcityeditor.git
cd webcityeditor
git clone https://github.com/cityjson/cityjson-threejs-loader.git spike/cityjson-threejs-loader
cd prototype
npm install
npm run dev        # http://localhost:5173
npm test
```

For Hamburg CityGML conversion, see `HAMBURG_PIPELINE.md`.
