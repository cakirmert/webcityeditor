# City Editor Prototype — Status

Source of truth for **what was planned, what's delivered now, and what's left**. Complements `LoD2_Editor_Onay_Dokumani.docx` (the 19-question approval document) with a concrete code-aware delta.

**Last updated**: 2026-04-23. **Test suite**: 108 passing. **TypeScript**: clean. **Published**: [github.com/cakirmert/webcityeditor](https://github.com/cakirmert/webcityeditor).

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
- **Live roof mesh preview** on the map via deck.gl `SimpleMeshLayer` — roof shape updates as you type
- **Subdivide-on-create**: choose "none / floors / sides" with a count; split applies immediately after insertion
- The parametric generator produces a proper LoD 2 `Solid` with `GroundSurface` / `RoofSurface` / `WallSurface` semantics. Round-trip through JSON.stringify tested for every roof type.

### Edit existing buildings
- Attribute editor with priority-sorted rows, type coercion (number/string/boolean)
- Dirty tracking, per-building revert, toolbar dirty-count
- **Transform mode**: "Start editing position" enters a live-preview mode with dX/dY/angle inputs + quick-step buttons; map renders a ghost of the transformed footprint; Save commits, Cancel discards. Works on ANY building (generated or imported).
- **Subdivide** split-by-floor / split-by-side with MIN_STOREY_HEIGHT=2.4m, MIN_SIDE_WIDTH=3m enforced. Works on any Building (relaxed from "only editor-created" — imported buildings are supported).
- Export → downloads a modified CityJSON
- Save local → persists to browser IndexedDB

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

## 5. Roofs — what we handle, what a WASM straight-skeleton would add

| Footprint shape | Flat | Pyramid | Gable | Hip | Notes |
|---|---|---|---|---|---|
| Rectangle (4 verts) | ✅ | ✅ | ✅ | ✅ | Fully covered |
| Triangle | ✅ | ✅ | ❌ | ❌ | Pyramid works |
| Convex N-gon | ✅ | ✅ | ❌ | ❌ | Apex-over-centroid |
| **L / U / T / concave** | ✅ | ⚠ | ❌ | ❌ | Flat always works; pyramid may put apex outside; gable/hip refuse |
| Polygon with holes | ✅ | ⚠ | ❌ | ❌ | Hole ignored by our face walker |

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

1. **Visual division editor** — draggable division lines on a 2D footprint preview, per-part attribute assignment, polygon-clipping for non-rectangles. ~2.5 days. Biggest remaining UX gap.
2. **IFC → CityJSON import** — route #1 is doc-only (`ifc-to-cityjson` CLI); route #2 is `web-ifc` WASM in-browser (~1 week).
3. **LoD 2.2 eave overhang** — single parameter + one line per roof builder. ~1-2 h.
4. **Procedural doors + windows** — LoD 3 MultiSurface sidecar on new buildings. ~1 day.
5. **Per-object colouring mode** in the Three.js side-panel viewer — each BuildingPart gets a distinct tint for easy "residential vs commercial" reading. ~½ day.
6. **Batch Hamburg tile conversion** — a little script to convert all 788 tiles at once, plus a quick-picker in the FileLoader listing all converted tiles. ~2 h.
7. **Viewport-filtered streaming** — in CityJSONSeq mode, skip features outside the current map viewport. Unlocks much larger files. ~½ day.
8. **WASM straight-skeleton** for non-rectangular gable/hip — CGAL+Emscripten build. ~3-7 days.
9. **Edit footprints of existing buildings** — Terra Draw edit mode, drag vertices. ~1 day.
10. **Hamburg pipeline end-to-end with 3DCityDB** — spin up Docker compose, run `citydb import`, validate round-trip. ~½ day (tooling in place).
11. **Backend Phase 0** — Fastify + OGC API - Features + pg2b3dm + nginx. Unlocks Tile3DLayer + full S15. ~1-2 weeks.

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
        │   ├── generator.ts             Flat/pyramid/gable/hip LoD 2 Solid generators
        │   ├── preview-mesh.ts          Live roof mesh for deck.gl SimpleMeshLayer preview
        │   ├── subdivision.ts           splitBuildingByFloor / splitBuildingBySide, validation
        │   ├── transform.ts             moveBuilding / rotateBuilding (vertex-append-based)
        │   ├── transform-preview.ts     Live-preview footprint under pending transform
        │   └── storage.ts               IndexedDB save/load/list
        └── test/setup.ts
```

---

## 10. Test suite (108 tests across 11 files)

| File | Tests | Coverage |
|---|---|---|
| `lib/cityjson.test.ts` | 23 | Validation, parsing, root buildings, setAttribute, diff |
| `lib/cityjsonseq.test.ts` | 7 | CityJSONSeq parse, index-shift merge, limit, malformed-line tolerance, auto-detect |
| `lib/projection.test.ts` | 8 | CRS detection + coord-magnitude fallback; 2D+3D reprojection for EPSG:28992/7415/4978/25832 |
| `lib/roundtrip.test.ts` | 6 | edit → stringify → re-parse preserves every edit; geometry untouched |
| `lib/footprints.test.ts` | 7 | Extraction returns closed polygons in the right region; filterToBuilding scopes correctly |
| `lib/generator.test.ts` | 17 | Flat/pyramid/gable/hip generation, input validation, insertBuilding, round-trip for every roof type, storey-height validator |
| `lib/subdivision.test.ts` | 12 | canSplit (accepts imported + inferred storeys), splitByFloor, splitBySide, min-size enforcement, JSON round-trip |
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
