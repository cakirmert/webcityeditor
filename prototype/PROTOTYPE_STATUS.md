# City Editor Prototype — Status

Source of truth for **what was planned, what changed, and what is currently shipping in the prototype**. Complements `LoD2_Editor_Onay_Dokumani.docx` (the 19-question approval document) with a concrete, code-aware delta.

Last updated: 2026-04-23.

---

## 1. Overview

Browser-only React application. No backend by design (user confirmed prototype scope).

- Loads CityJSON 2.0 documents (file, URL, built-in sample cube, or local IndexedDB save).
- Renders every building as extruded footprints on a MapLibre basemap via deck.gl. **LoD-aware**: only outlines below zoom 14.5, extruded blocks above.
- On load, map fits to the dataset's bounding box (no hardcoded Delft — the fit runs once per loaded document).
- Click any building → side panel with a dedicated Three.js 3D view of that building, an attribute editor, and a fullscreen toggle for focused work.
- **Draw a new building**: ＋ New Building → Terra Draw polygon → parameter dialog (total height / storeys / roof type with live preview on the map) → parametric generator → immediate insertion.
- Roof types: flat, pyramid, gable. Hip / custom pitched roofs are the remaining target for a WASM straight-skeleton integration.
- Dirty tracking, revert-per-building, "reload view", **export** to new CityJSON, **local persistence** via IndexedDB.

---

## 2. Planned vs. Delivered

The approval doc defined 19 decisions (S1–S19). Status in the prototype:

| # | Decision | Status | Notes |
|---|---|---|---|
| S1 | CityJSON 2.0 as primary format | ✅ Full | In-memory state is the single source of truth. |
| S2 | CityJSON → 3DCityDB import is healthy | 🟡 Documented | No DB in prototype; `HAMBURG_PIPELINE.md` documents the full CityGML → CityJSON → 3DCityDB import pipeline with expected loss points. |
| S3 | **Edits** inside the client are lossless | ✅ Full | **Scope clarified**: applies to edits within the prototype (CityJSON → mutate → serialize → re-parse). **Lossy boundaries outside this scope** — GML→CityJSON conversion and DB round-trips — are documented in `HAMBURG_PIPELINE.md` with the symptoms we expect to see. |
| S4 | Backend-mediated DB access | ⚪ Mocked | IndexedDB persistence fills the UX role. Real backend deferred. |
| S5 | New-building flow (Terra Draw + parametric generator) | ✅ Full | Terra Draw 1.28 draws the footprint. `generator.ts` supports **flat / pyramid / gable** roofs. Dialog shows live preview on the map, derives storey height, warns on building-code violations (DIN 18065-inspired). Hip / custom pitched via WASM straight-skeleton still pending. |
| S6 | Edit existing building (click → CityJSON → 3js → write-back) | ✅ Full | Write-back is export + local save in place of PATCH. |
| S7 | ENU tangent-plane projection | ✅ Full | proj4 converts CityJSON CRS → WGS84 → deck.gl. Three.js edit view works in model-local metres. |
| S8 | LoD0 + LoD2 coexist per Building | ✅ Full | Loader handles LoD hierarchy. **LoD-by-zoom** in MapView: outlines below zoom 14.5, extrusions above. |
| S9 | Three.js (not Babylon) | ✅ Full | three 0.165.0 pinned, Vite dedupe configured. |
| S10 | cityjson-threejs-loader for CityJSON → Three.js | ✅ Full | Installed via file: link from spike/. |
| S11 | Custom serializer | ✅ Full | Mutate-in-place + JSON.stringify. Round-trip **verified for every roof type** in `generator.test.ts`. |
| S12 | Azul not used | ✅ Full | No dependency. |
| S13 | deck.gl + 3D Tiles + pg2b3dm | 🟡 Partial | deck.gl is used via `MapboxOverlay` with `PolygonLayer` (outlines) + `SolidPolygonLayer` (extrusions). Full `Tile3DLayer` requires backend-generated tiles; see §4. |
| S14 | Single source of truth | ✅ Full | React state is canonical; every view derives from it. |
| S15 | End-to-end edit flow | 🟡 Partial | Client-side round-trip complete (edit → local save → reopen → edit again). Steps 7–9 (DB write, tile invalidation) need the backend. |
| S16 | nginx tile serving | ❌ Deferred | Needs backend. |
| S17 | Incremental tile regeneration after edit | ❌ Deferred | Needs backend + pg2b3dm. |
| S18 | Custom per-feature picking in Tile3DLayer | 🟢 Covered differently | deck.gl picking on `SolidPolygonLayer` is built-in and returns `Footprint.id` directly. When Tile3DLayer is adopted, the original workaround plan applies. |
| S19 | 3DBAG as primary test data; Hamburg only via CityGML | ✅ Full + pipeline doc | Default URL is 3DBAG. `HAMBURG_PIPELINE.md` gives a runnable step-by-step for piloting Hamburg CityGML → CityJSON → 3DCityDB → prototype. |

---

## 3. Stack technologies

| Technology (from doc) | In prototype? |
|---|---|
| React 18 + TypeScript | ✅ |
| Vite (build tool) | ✅ |
| MapLibre GL JS 4.7 | ✅ |
| deck.gl 9.3 (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`) | ✅ |
| Three.js 0.165 | ✅ (dedupe in Vite config) |
| cityjson-threejs-loader (TU Delft) | ✅ (via `file:` link from spike) |
| proj4 | ✅ — 10 CRS (EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514) |
| Terra Draw 1.28 + maplibre-gl adapter | ✅ — polygon draw mode |
| shadcn/ui | ❌ — plain CSS; approved for later. |
| straight-skeleton WASM | ❌ — hip / custom pitched roofs pending. Pyramid + gable (flat + rectangular) in place. |
| Node.js + Fastify | ❌ — no backend. |
| PostgreSQL 16 + PostGIS + 3DCityDB v5 | ❌ — no backend (pipeline documented). |
| citydb-tool | ❌ — no backend (pipeline documented). |
| pg2b3dm | ❌ — no backend. |
| nginx tile serving | ❌ — no backend. |
| BullMQ worker | ❌ — no backend. |
| OGC API - Features (Fastify endpoints) | ❌ — no backend. |

---

## 4. Changes and additions (not in the original doc)

1. **Build tool chosen: Vite.** Confirmed on 2026-04-23.

2. **proj4 as a client-side projector.** 10 CRS registered. The reprojection helper passes Z through proj4 for geocentric (EPSG:4978) and compound 3D (EPSG:7415 RD+NAP) inputs — critical for correctness.

3. **Deck.gl footprint extrusion in place of Tile3DLayer.** Since we can't produce 3D Tiles without a backend, we extrude CityJSON footprints directly. Preserves the *role* of deck.gl without the tile pipeline.

4. **LoD-by-zoom rendering.** Below zoom 14.5, outlined footprints only. Above 14.5, extruded blocks. Selecting a building reveals its full LoD2 geometry in the side panel. No data subsetting — the full CityJSON stays in memory, the renderer just changes what it shows.

5. **Fit-to-bounds on load.** No hardcoded centre. When a new document loads, the map fits to the bounding box of all footprints once. Clicking buildings afterward does not re-fly.

6. **IndexedDB persistence mock.** `src/lib/storage.ts` mimics the server-side save path. FileLoader lists recent saves for one-click reload.

7. **S5 new-building flow (multi-roof, with live preview).** Terra Draw polygon on MapLibre → modal that asks for **total height** first, storey count second, roof type third. Storey height is a derived readout with DIN 18065-inspired warnings (<2.4 m = "below habitable", >5 m = "unusually tall", roof > total = "no walls fit"). Every change fires a live preview on the map via a dedicated deck.gl layer. Roof geometry implementations:
   - **flat** — any convex footprint
   - **pyramid** — apex at centroid, N triangular roof faces; any convex footprint
   - **gable** — rectangular 4-vertex footprint only, ridge along the longer axis, 2 sloped roof rectangles + 2 pentagonal gable-end walls
   - **hip / custom pitched** — pending WASM straight-skeleton integration (no mature npm package; needs CGAL/Emscripten compilation). Pyramid approximates most hip roofs.

8. **Round-trip tests for new buildings.** For every roof type, the test generates a building, serializes the whole doc, re-parses, verifies the building is still present, vertex indices still reference valid positions, semantic values line up with face counts, and `extractFootprints` still finds the new building.

9. **Side-panel fullscreen toggle.** ⇱ expands the aside to the viewport, Three.js takes most of the height.

10. **Map auto-fit on load** (2026-04-23). Replaces the old hardcoded `flyTo({ center: Delft })` with `fitBounds` using the footprint bbox. Works equally well for a single sample cube and a 3DBAG tile of hundreds of buildings.

11. **Three.js side-panel auto-fit.** Uses `Box3.setFromObject(loader.scene)` so the camera frames the rendered meshes, not the unused vertices from the filtered sub-document.

12. **Hamburg pilot pipeline documented.** `HAMBURG_PIPELINE.md` is a runnable walkthrough: download CityGML from Transparenzportal → `citygml-tools to-cityjson` → `cjio validate` → `docker compose up 3dcitydb` → `citydb import` → export back → load in prototype. Includes the known failure modes we expect to capture for the HiWi report.

---

## 5. The gap — what the backend would add

If/when Phase 0 starts a Fastify + 3DCityDB + pg2b3dm stack:

| Feature | Why it needs backend |
|---|---|
| `deck.gl Tile3DLayer` for context | Requires `tileset.json` + `.glb` tiles generated by pg2b3dm from 3DCityDB. |
| Server-side save (PATCH `/items/{id}`) | Requires an OGC API - Features (Part 4) endpoint. |
| Tile invalidation on save | Requires BullMQ (or similar) queue to run `pg2b3dm --bbox …` and overwrite nginx-served `.glb`. |
| Multi-user, multi-session persistence | Requires authoritative DB. IndexedDB is per-browser only. |
| Scale to tens of thousands of buildings at high zoom | Client-side CityJSON caps around a few thousand buildings before parsing is slow. Tiled streaming fixes this. |

None require architectural changes in the prototype — they slot in behind the existing API seam (`saveDocument`, `loadDocument`, `extractFootprints` ↔ `Tile3DLayer`).

---

## 6. How to run

Prerequisites: Node.js 20+ (verified on 25), npm 11.

```bash
cd prototype
npm install
npm run dev        # Vite on http://localhost:5173
npm test           # 80 tests, one-shot
npm run test:watch
npm run build      # tsc type-check + production bundle
```

### First run

1. Open http://localhost:5173.
2. Click **"Use built-in sample cube"** (Delft, EPSG:28992) for an instant test. Map fits to the cube's bbox.
3. **"Load another…"** → Fetch the pre-filled 3DBAG URL. Map fits to the tile.
4. Zoom, pan, pitch — outlines below zoom 14.5, extrusions above.
5. **Double-click a building** → side panel opens. Use ⇱ to expand fullscreen.
6. Edit an attribute → toolbar shows dirty indicator → **↻ Reload view** or **💾 Save local** (IndexedDB) or **⬇ Export CityJSON**.
7. Click **＋ New Building** → draw a polygon (double-click to finish) → fill the form (total height → storeys → roof type) → watch the ghost extrusion update live on the map → **Create**. New building is inserted and auto-selected.
8. Refresh the tab → FileLoader lists "Local saves" → click to reload your work.

### Hamburg pilot

Read `HAMBURG_PIPELINE.md` for the full CityGML → CityJSON → 3DCityDB pilot. Minimum viable check is step 7 of that doc: download one Hamburg tile, `citygml-tools to-cityjson`, `cjio validate`, open in the prototype.

---

## 7. File tree

```
prototype/
├── PROTOTYPE_STATUS.md       # this file
├── HAMBURG_PIPELINE.md       # end-to-end Hamburg CityGML pilot
├── package.json
├── tsconfig.json
├── vite.config.ts            # resolve.dedupe: ['three']; exclude loader from pre-bundle
├── vitest.config.ts
├── index.html                # <title>City Editor</title>
└── src/
    ├── main.tsx
    ├── index.css
    ├── App.tsx                  # top-level state
    ├── types.ts
    ├── cityjson-loader.d.ts
    ├── components/
    │   ├── Toolbar.tsx              # title, stats, new-building toggle, save/export
    │   ├── FileLoader.tsx           # drop / URL / sample / IndexedDB recent saves
    │   ├── MapView.tsx              # MapLibre + deck.gl + Terra Draw + live preview
    │   ├── Viewer.tsx               # Three.js canvas for one building
    │   ├── AttributePanel.tsx       # editable form
    │   └── NewBuildingDialog.tsx    # total-height-first, live preview, storey validation
    ├── lib/
    │   ├── cityjson.ts         # validate, parse, rootBuildingIds, setAttribute, sample
    │   ├── footprints.ts       # extract deck.gl polygons, filter to one building
    │   ├── projection.ts       # proj4 CRS registry (10 CRS); 3D-aware projectToWgs84
    │   ├── generator.ts        # flat/pyramid/gable roof generators; validateStoreyHeight
    │   └── storage.ts          # IndexedDB save/load/list/delete
    ├── test/
    │   └── setup.ts
    └── (tests co-located as *.test.ts / *.test.tsx)
```

---

## 8. Test suite (80 tests across 8 files, all passing)

| File | Coverage |
|---|---|
| `lib/cityjson.test.ts` | validation, parsing, root buildings, setAttribute, diff, shortCrs |
| `lib/projection.test.ts` | CRS detection; 2D + 3D reprojection for EPSG:28992, 7415, 4978, 25832 |
| `lib/roundtrip.test.ts` | edit → stringify → re-parse preserves every edit across cycles; geometry untouched |
| `lib/footprints.test.ts` | extractFootprints returns closed polygons in the right region; filterToBuilding scopes correctly |
| `lib/generator.test.ts` | flat/pyramid/gable generation; input validation; insertBuilding; **round-trip for every roof type** (serialize → re-parse → verify structure integrity + extractFootprints finds the new building); DIN-inspired storey-height validator |
| `components/Toolbar.test.tsx` | title, stats, dirty counter, button wiring, save status |
| `components/FileLoader.test.tsx` | sample button, fetch errors, non-CityJSON rejection |
| `components/AttributePanel.test.tsx` | attribute rendering, priority sort, numeric/string/boolean coercion, revert gating |

The round-trip tests in `generator.test.ts` are the concrete evidence that there is **no data loss during client-side edits**, regardless of roof type.

---

## 9. Known limitations

- **Roof generator**: flat ✅, pyramid ✅ (any convex polygon), gable ✅ (rectangular 4-sided only). Hip / mansard / custom pitched need WASM straight-skeleton (CGAL via Emscripten). No ready-made npm package; custom compilation required.
- **Footprint extraction** uses fan triangulation of outer rings. Holes (courtyards) ignored.
- **MapLibre + deck.gl interleaved mode** uses a cast `as unknown as maplibregl.IControl` — type mismatch between deck.gl 9 and MapLibre 4. Works functionally.
- **Tile3DLayer** not implemented. LoD extrusion covers the context-rendering role for now.
- **No server-side validation.** Client-only validation via `validateCityJson` catches structural issues but not full spec conformance.
- **Side-panel Three.js re-parses the filtered sub-document each time selection changes.** Fast enough for single buildings but not optimised.

---

## 10. Should you use LoD 2 or LoD 3 for Hamburg?

Short version: **keep the LoD 2 file.** LoD 3 is nicer to look at but costs you on three fronts, AND most of the simulator ecosystem that consumes our output is built around LoD 2 (see §10a below).

| Dimension | LoD 2 | LoD 3 |
|---|---|---|
| File size | Small (tens of MB per Hamburg tile) | 3–10× larger for the same area |
| Parse + render time in browser | Fast | Noticeably slower; tile streaming becomes more important |
| Editability in the prototype | **Fully parametric** — our generator regenerates LoD 2 cleanly when you change floor count / roof type / split | **Partially lossy** — our generator only produces LoD 2; any LoD 3 detail (individual windows/doors) would be dropped when you regenerate |
| Transforms (move / rotate / translate) | Works | Works identically (transforms rewrite vertex positions and don't care about LoD) |
| Display fidelity | Correct roof shape, no openings | Adds windows, doors, balconies, dormers |
| Availability in Hamburg open data | **Published citywide** | Rare. Hamburg's `LoD2-DE` dataset is the authoritative one for the entire city; LoD 3 exists only for pilot areas. |

**So:**

- For **display + orientation + move/rotate + attribute edits**: LoD 2 is enough. LoD 3 would also work and look prettier, but brings no functional gain for those operations.
- For **regenerative edits** (change roof type, split into floors, add storey) our generator rewrites geometry. On a LoD 3 building it would *silently strip* the windows/doors because the generator is LoD 2-only. That's data loss — contrary to S3.
- For **proposing new buildings** we emit LoD 2 directly. With the proposed "procedural windows + entrance" work item (roadmap §12-2), new buildings become LoD 3-ish via an overlay MultiSurface sidecar.

**Conclusion**: load the LoD 2 file, don't hunt for LoD 3 for Hamburg. If you later need higher visual fidelity for a specific demo shot, you can always load the LoD 3 into a separate session as a display-only dataset.

### 10a. Which LoD does a simulator actually want?

The prototype's output CityJSON is intended to feed a downstream simulator. The right LoD depends on the simulator family. For almost all urban-scale simulators, **LoD 2 is the target**, not LoD 3.

| Simulator family | Example tools | Needs LoD | Why |
|---|---|---|---|
| Urban energy demand | SimStadt, CitySim, UMEP, Simstadt+EnergyADE | **LoD 2** | Wants wall/roof orientations + areas + storey count + use type. LoD 3 windows aren't modelled geometrically; they're a per-wall **window-to-wall ratio attribute**. Feed LoD 3 and the simulator strips it down anyway. |
| Urban microclimate / CFD | ENVI-met, Palm-4U, OpenFOAM pipelines | **LoD 2** | Meshes on building envelopes. LoD 3 detail breaks the mesher or adds hours of preprocessing for no accuracy gain. |
| Solar / PV potential | r.sun, UMEP SEBE, SolarCalc | **LoD 2** | Needs roof planes with correct pitch + azimuth. Windows are irrelevant; walls are secondary. |
| Noise propagation | NoiseModelling, CNOSSOS pipelines | **LoD 1 or 2** | Treats buildings as sound barriers; facade detail is ignored. |
| Flood / stormwater | TUFLOW, HEC-RAS 2D | **LoD 1** | Just needs footprints + heights as obstacles. |
| Daylighting / indoor comfort | RADIANCE, DAYSIM | **LoD 3+** | Genuinely cares about window geometry and room layout. For this tier, IFC is usually a better source than CityJSON. |
| Structural / seismic | OpenSees, SAP2000 pipelines | **IFC / LoD 4** | Needs internal structural elements. Not CityJSON territory. |

**Rule of thumb**: pick the lowest LoD that still carries the information the simulator reads. Higher LoD = more file / memory / preprocessing cost with no analytical payoff unless the simulator specifically consumes the extra detail.

**Our pipeline's position**:
- ✅ **Loading / displaying** any LoD (0 through 3) is fine — the loader handles them, and move/rotate/attribute edits don't care about LoD depth.
- ⚠ **Regenerating geometry** (split by floor, change roof type) outputs LoD 2. If the input was LoD 3, its windows and doors are silently dropped. That's fine for the simulator families in the top five rows above; it's a problem for the last two.
- 🟡 For **procedural openings** on newly generated buildings, the roadmap's "procedural doors + windows" item emits a sidecar LoD 3 MultiSurface so new buildings get LoD 3-tagged geometry without re-plumbing the whole editor.

**Which simulator are you targeting?** If it's any of the first five rows, ship LoD 2 and don't worry about the rest. If it's a daylighting or structural tool, we should talk separately — the right answer there is probably IFC, not CityJSON.

---

## 11. Why not WASM straight-skeleton?

The approval doc originally targeted a WASM-compiled straight-skeleton (CGAL via Emscripten) as the universal roof generator. We haven't pursued it because:

1. **No ready-made npm package exists.** Neither `straight-skeleton`, `polyskel`, nor the various partial JS implementations are production-grade. The CGAL C++ library exists; compiling it to WASM ourselves takes ~3–7 days of Emscripten toolchain + binding work plus integration testing.
2. **The common cases don't need it.** Most residential building footprints are rectangular or convex N-gons. For those, hand-rolled geometry (our `buildFlat`, `buildPyramid`, `buildGable`, `buildHip`) produces identical output at zero dependency cost.
3. **The plan is still to add it later** — for non-rectangular, concave, or multi-ridge hip roofs. Roadmap item #7.

### What our own code handles vs. what a WASM straight-skeleton would add

| Footprint shape | Flat | Pyramid | Gable | Hip | Notes |
|---|---|---|---|---|---|
| Rectangle (4 verts) | ✅ | ✅ | ✅ | ✅ | Fully covered. |
| Triangle | ✅ | ✅ | ❌ | ❌ | Pyramid works; gable/hip need "rectangle-like" guarantees. |
| Convex N-gon (N ≥ 3) | ✅ | ✅ | ❌ | ❌ | Apex-over-centroid pyramid is well-defined. |
| **L / U / T / cross-shaped** (concave) | ✅ | ⚠ | ❌ | ❌ | Pyramid renders but looks wrong (apex over bbox-centroid, which can sit outside the polygon). Gable/hip reject. Straight-skeleton would give a proper ridge network. |
| Polygon with holes (courtyard) | ✅ (ignores hole) | ⚠ | ❌ | ❌ | Our walker drops the holes entirely. |
| Multi-building compound | ❌ | ❌ | ❌ | ❌ | Requires decomposition first. |

If you test with L-shaped or courtyard buildings, expect:
- **Gable/hip**: error message "requires 4-vertex footprint", directs you to pyramid or flat.
- **Pyramid on L-shape**: produces geometry, but the apex may project outside the outline so the roof visibly overshoots on some sides. Still renders and round-trips, just not architecturally sensible.
- **Flat on L-shape**: always correct.

This gives you a clear test plan for "does our stuff hold up against weird shapes": try L, U, plus-shape, and L-with-hole. Flat will always work; pyramid will look iffy on concave; gable/hip will refuse. That's exactly the gap straight-skeleton closes.

---

## 12. Snapping while drawing (implemented)

Terra Draw's polygon mode now snaps your cursor to three things:

1. **Its own drawn vertices** (`toCoordinate: true`) — close the polygon cleanly.
2. **Its own drawn edges** (`toLine: true`) — slide along the line you just drew.
3. **Any existing building's footprint vertex** (`toCustom`) within 20 pixels. Implemented by collecting every vertex from `extractFootprints(cityjson)` once when draw mode activates, then doing a linear nearest-vertex pixel-space search in the custom snap function.

Result: drawing a new building *adjacent* to an existing one snaps the shared corners cleanly, so walls line up to the pixel on the map without manual fiddling.

### What's not (yet) implemented — OSM snapping

You asked about snapping to OSM buildings with house-numbers. That needs an external data source:

- **Overpass API query** on-the-fly for the current viewport's `building=*` ways. Pros: no setup, current data. Cons: request per pan, rate-limited.
- **OSM vector tiles** via OpenMapTiles / MapTiler / self-hosted tileserver. Pros: fast. Cons: requires tileserver or API key.
- **Overture Maps** building footprints as a Parquet/GeoJSON download baked into the app. Pros: all data, no external calls. Cons: ~100 MB per region.

Of those, the Overpass route is the cheapest to prototype (~half a day) and worth doing once we've validated the in-CityJSON snapping is useful. Roadmap item.

### Alternative: grid snapping

Simpler still — snap cursor to a regular grid in CRS metres (0.5 m or 1 m step). No external data. Quick to add; useful when the area has no existing buildings to snap to. Flagged as a 2-line switch in `toCustom`.

---

## 13. LoD levels — what the prototype produces, what LoD 2.2 would add

Quick clarification on what **"LoD 2" without a roof** and **"LoD 2.2"** mean in CityGML/CityJSON terms, and how they map to our generator:

| LoD | Description | Our generator produces this when… |
|---|---|---|
| **LoD 0** | Footprint polygon only (flat ground ring) | The Terra Draw-drawn polygon itself, before any geometry is generated. |
| **LoD 1** | Block: flat-roofed extrusion, no semantic surfaces | Flat roof with no GroundSurface/WallSurface/RoofSurface tagging. *We skip this level — our flat output already carries semantic surfaces, so it sits at LoD 2.0.* |
| **LoD 2.0** | Flat-roofed block with ground/wall/roof semantic surfaces | `roofType: 'flat'` + our GroundSurface/WallSurface/RoofSurface labels. |
| **LoD 2.1** | Correct roof shape (pitched), walls up to eaves, no roof overhangs | `roofType: 'pyramid' / 'gable' / 'hip'`. This is what the generator produces today for pitched roofs. |
| **LoD 2.2** | LoD 2.1 + **roof overhangs** (eaves that extend past the wall) + more faithful per-side wall/roof detail | **Not yet implemented.** ~1 parameter (`eaveOverhang` in metres) + generator updates to push roof vertices horizontally outward along their edge normals before emitting. 1–2 hours of work, no new libraries. |
| **LoD 3** | Openings in the facade: doors (`DoorSurface`), windows (`WindowSurface`), balconies | **Not yet implemented.** Two roads (see §11 below). |

### Can we add entrance (door) + procedural windows?

Yes, in two ways:

- **Approximation (~1 day)**: emit a separate `MultiSurface` geometry at `lod: '3.0'` containing small rectangular faces tagged `DoorSurface` / `WindowSurface`, positioned with a tiny outward offset from each wall. The loader already has colour mappings for these types, so they render as distinct panels on the facade. Not spec-strict LoD 3 (the walls aren't actually cut; it's stickers on top), but it looks right and round-trips cleanly.
- **Proper LoD 3 (~several days)**: subdivide each wall face into a polygon-with-hole + a separate window/door face fitting the hole. Requires adding hole support to our face walker (currently outer-ring-only) and updating the renderer's triangulation. More work but produces validator-clean LoD 3.

The approximation route is what I'd recommend as the next implementation step. Parametric window placement is simple: per wall, per storey, N windows at regular intervals with a fixed width/height. Entrance = one door at ground level on the wall facing the street (or the longest wall, as a default).

---

## 14. Should the editor be in the bigger 3D view?

User asked: should Three.js editor be the main view rather than a side panel?

**My take**: the current split works well for the approval doc's architecture —
- **Map (deck.gl + MapLibre)** = "where is the building in the world" — pan, zoom, tilt, see context
- **Three.js view** = "what does this one building look like and what are its semantic parts"

If we moved the editor fully into the 3D view, we'd lose the geographic context when working on a building, and re-introduce the coordinate-bridging hassle the approval doc explicitly wanted to keep out of Three.js.

**Proposed compromise (implemented)**: **make the side panel wider by default** (from 360px to 480px, Three.js viewport from 280px to 360px) so the 3D view is prominent without displacing the map. The ⇱ fullscreen toggle is still there for when the user wants a distraction-free 3D edit. Net effect: Three.js view is ~2× the visual weight it had before.

If you actually want the 3D to dominate (fullscreen by default when a building is selected), that's a one-line change in App — let me know and I'll flip the default.

---

## 15. IFC import — why it matters, what it costs

IFC (Industry Foundation Classes) is the BIM format: extremely detailed, per-wall, per-window, per-pipe. A single IFC building usually has more data than a whole Hamburg tile of CityJSON LoD 2. The conversion value:

- **Rich starting point**: drop an IFC of a real designed building, get walls/roofs/doors/windows out of the box.
- **Nice visuals**: pulls us closer to LoD 3 without having to author every surface by hand.
- **Interop with architects**: the architectural deliverable is almost always IFC; converting lets us ingest their work.

### Three routes, in increasing order of scope

1. **Local CLI (same shape as the Hamburg pipeline, documented next).**
   - Tool: [`ifc-to-cityjson`](https://github.com/IfcOpenShell/ifc-to-cityjson) from the IfcOpenShell team.
   - Flow: `ifc-to-cityjson building.ifc building.city.json` → drop into the prototype's FileLoader.
   - Caveats: the CLI is C++ built from source. Not as instantly runnable as `citygml-tools`. We'd write an `IFC_PIPELINE.md` companion to `HAMBURG_PIPELINE.md`.
2. **Browser-side via `web-ifc` (WASM).**
   - `web-ifc` is IfcOpenShell compiled to WASM, runs in the browser.
   - We'd add a `.ifc` file handler in FileLoader: parse with web-ifc → extract meshes → package into CityJSON with inferred semantics (walls = vertical faces, roofs = angled-up, grounds = horizontal lowest). Inference is lossy but pragmatic.
   - Scope: ~1 week. Substantial but fully client-side, matches the prototype's scope constraint.
3. **Full fidelity IfcOpenShell in a Node backend.**
   - Only once we have a backend. `ifc-to-cityjson` runs server-side, returns CityJSON.
   - Belongs in Phase 0.

### Data-loss profile

IFC → CityJSON always loses something. What's documented to survive:

| IFC concept | Survives as |
|---|---|
| `IfcWallStandardCase`, `IfcWall` | `WallSurface` geometry |
| `IfcRoof`, pitched roof slabs | `RoofSurface` geometry |
| `IfcSlab` (ground) | `GroundSurface` geometry |
| `IfcWindow`, `IfcDoor` | `WindowSurface` / `DoorSurface` (LoD 3) |
| `IfcSpace`, room definitions | Generic attribute or dropped |
| Structural (`IfcBeam`, `IfcColumn`) | Dropped for display; optional extension |
| MEP / pipes / ducts | Dropped |
| `IfcMaterial` | Optional appearance entry |
| Classification codes | Generic attribute |

For positioning on a map: an IFC has a local origin — we'd need the user to supply a georeferenced anchor (lng/lat + rotation) at import time, or read `IfcSite.RefLatitude / RefLongitude` when present.

### Recommendation

For this prototype: **route #1 now, route #2 after the visual division editor lands**. Route #1 is a documentation-only change for this turn; route #2 is a meaningful feature that pairs well with the division editor (both operate on loaded-and-imported data).

---

## 16. Visual division editor — design sketch

User request: "let user change boundaries by showing just the footprint and how it is divided first." And: support non-rectangular buildings.

Current state: splits work only along bounding-box axes on rectangles. Non-rectangular split-by-side throws. That's insufficient.

### Proposed UX

1. Select a building → click **"Divide building"** in the side panel.
2. Side panel's Three.js viewer swaps to a **2D division editor**: the footprint outline + a proposed division (red lines). Footprint only, no roof.
3. Division presets:
   - **Horizontal slices** (per floor, Z-only)
   - **Vertical slices along long axis** (N equal parts, default)
   - **Vertical slices along short axis**
   - **Manual polygon** — user draws a cut line; each intersection produces sub-polygons
4. The user can:
   - Drag each division line perpendicular to the long axis → ratio changes live.
   - Add / remove division lines.
   - Enforces the minimums: `MIN_SIDE_WIDTH = 3 m` on each resulting sub-footprint; `MIN_STOREY_HEIGHT = 2.4 m` per floor. Violations flag red.
5. **Per-part attribute panel on the right**: pick each sub-footprint and assign its function (`residential`, `commercial`, etc.), roofType, storeys. This answers "now the half is residential."
6. Apply → generates BuildingParts, sets parents/children, exits the editor.

### Algorithm for non-rectangular

Use **polygon clipping against a half-plane**. Each division line defines a plane; intersect the source polygon with it, keep one side for each sub-part.

- `polygon-clipping` on npm handles arbitrary polygons (convex + concave, with holes).
- For horizontal slices, the "plane" is a Z cut — no polygon clipping needed, just Z ranges.
- Minimums enforced via area and bbox checks on each resulting sub-polygon.

### Scope estimate

- 2D editor in SVG: ~1 day.
- Polygon-clipping integration + sub-part generator: ~1 day.
- Per-part attribute panel wiring: ~0.5 day.

Totaling ~2.5 days. Substantial but clean. It's the next big feature.

---

## 17. Roadmap (priority order)

1. **Visual division editor** (see §14). The biggest functional gap — splits non-rectangular buildings interactively, per-part attribute assignment, honours minimum sizes.
2. **IFC → CityJSON import** (see §13). Route #1 (local CLI `ifc-to-cityjson`) is a doc task; route #2 (browser-side via `web-ifc` WASM) is a week of feature work.
3. **LoD 2.2 eave overhang** (1–2 h). Single parameter in `NewBuildingDialog`, generator shifts ridge verts outward.
4. **Procedural doors + windows (approximation)** (~1 day). Generator emits an LoD 3 MultiSurface sidecar of Door/Window rectangles on walls.
5. **shadcn/ui for Toolbar + FileLoader.** Dialog + AttributePanel transform section already migrated. The rest is visible but cosmetic.
6. **Per-object coloring mode in the Three.js viewer.** After a split, each BuildingPart in a distinct colour for "what's residential vs commercial" checks.
7. **Hip / custom pitched via WASM straight-skeleton** for non-rectangular footprints. Pyramid covers convex cases today.
8. **Edit the footprint of an existing building** via Terra Draw's edit mode.
9. **Run the Hamburg pipeline end-to-end** per `HAMBURG_PIPELINE.md`.
10. **Backend Phase 0** (Fastify + 3DCityDB + pg2b3dm). Unlocks Tile3DLayer + full S15.
