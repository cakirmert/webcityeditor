# City Editor

Browser-based LoD 2 city-model editor. `npm run dev` immediately opens a
committed Hamburg city-center CityJSONSeq showcase with official LoD2 buildings
plus a committed OSM crop processed through the same browser osm2streets path
as **Fetch Roads**, from the Elbe waterfront to Jungfernstieg. Optional local
catalogs provide whole-city Hamburg loading and write-back.

For a fresh-PC Codex handoff, start with [`AGENTS.md`](AGENTS.md) and
[`NEXT_CHAT_PROMPT.md`](NEXT_CHAT_PROMPT.md).

Built as the prototype deliverable for the HiWi "LoD 2 Editor" project. See [`prototype/PROTOTYPE_STATUS.md`](prototype/PROTOTYPE_STATUS.md) for the full planned-vs-delivered breakdown, [`prototype/HAMBURG_PIPELINE.md`](prototype/HAMBURG_PIPELINE.md) for the Hamburg CityGML-to-CityJSON pipeline, [`prototype/CITYGML_TRANSPORTATION_PLAN.md`](prototype/CITYGML_TRANSPORTATION_PLAN.md) for the CityGML Transportation/OpenDRIVE/muv-osm roadmap, and [`prototype/METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md`](prototype/METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md) for the metric road-limit and r:trån trial pipeline plan.

## Features

- MapLibre basemap + deck.gl extruded building context (LoD-by-zoom: outlines below z 14.5, blocks above).
- Side-panel Three.js editor for the selected building (uses TU Delft's [`cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader)).
- Parametric new-building flow: Terra Draw footprint -> fullscreen creator with live 3D preview -> flat / pyramid / gable / hip roofs.
- Snap-to-existing-footprints while drawing (auto-collected from the loaded CityJSON).
- Attribute editing with dirty tracking, per-building revert, export modified CityJSON, IndexedDB local persistence, and tested local change-report / visual-diff artifacts.
- Hamburg planning overlay: fetches real XPlan building-use polygons by viewport, with FNP land-use fallback when XPlan has no polygons.
- Road editing writes CityJSON Transportation `Road` objects, supports explicit cancel, uses pointer capture so enlarged centerline handles stay attached until pointer release, can derive an editable layout from imported road surfaces, and saves changes back onto the same CityJSON Road id. With a precomputed catalog, OSM/osm2streets is needed only when generating or refreshing the OSM-derived base data.
- CityJSONSeq-first Hamburg workflow: connect the local strict catalog once, pan to fetch nearby `.city.jsonl` tiles, use **Save seq** for validated optimistic-concurrency write-back, and let clean off-screen tiles unload automatically.
- Subdivision into BuildingParts: split by floor, by side, or with per-floor footprint plans. Plans support manual percentage cuts, per-floor overrides, an apply-to-all-floors checkbox, and 2D/3D previews.
- Live-preview transforms: translate and rotate buildings with a ghost preview on the map, then save or cancel.
- 10 CRS registered via proj4 (EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514).
- 516 tests across validation, round-trip, generation, subdivision, transforms, CityJSONSeq catalog loading and write-back, IFC import, Hamburg data preparation, transportation conversion, local edit artifacts, planning data, and UI components.

## Setup

Prerequisites: Node.js 20+, npm, Git. Rust/Cargo is additionally required to generate the complete local Hamburg road catalog; `wasm-pack` is only required when rebuilding the vendored browser osm2streets package.

```bash
git clone --recurse-submodules https://github.com/cakirmert/webcityeditor.git
cd webcityeditor

# Install and run the prototype
cd prototype
npm install
npm run dev
```

The dev server opens at http://localhost:5173 and automatically loads the
committed Hamburg center demo. No Rust build, data download, or local catalog
server is required for the showcase. For strict whole-city Hamburg data, start
one of the optional local catalog workflows and use **Connect catalog**.

### Generate the Hamburg road catalog locally

The large road dataset is deliberately not committed. On Windows, the easiest
fresh-PC conversion and startup is one command from the repo root:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -Serve
```

Use `-DryRun` to check prerequisites and resolved paths without changing files,
or omit `-Serve` to prepare the catalog without starting the app. On any
platform, the equivalent commands from `prototype/` are:

```bash
npm run data:hamburg-roads:prepare
npm run dev:hamburg-roads
```

The preparation helper checks Git, Node.js 20+, npm, and Rust/Cargo before the
large conversion. It initializes the patched osm2streets submodule, installs
Node dependencies when needed, downloads the current [Geofabrik Hamburg OSM PBF](https://download.geofabrik.de/europe/germany/hamburg.html), builds the native exporter, and emits only the validated CityJSONSeq tiles needed by the editor. It recommends at least 10 GiB free for the long first build; the retained complete catalog is about 2.3 GiB. Successful intermediate tile work is discarded, and a later run exits immediately when a complete catalog is present. The startup resolver can also reuse a valid sibling `cityjsonseq-*` proof directory while ignoring older incomplete output. Connect the editor to `http://127.0.0.1:8788`.

After this one-time conversion, day-to-day road loading, editing, cancellation, and saving use CityJSON/CityJSONSeq only. Creating an editable layout from an imported exact road derives a centerline and lane bands from its surfaces; saving a changed layout replaces those exact polygons with the editor's generated ribbon surfaces.

## Scripts

From `prototype/`:

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite with HMR and auto-load the committed Hamburg center buildings + roads demo |
| `npm run dev:hamburg-buildings` | Start the prepared whole-city Hamburg building catalog on port `8787`, then Vite |
| `npm run dev:hamburg-roads` | Start the prepared Hamburg road catalog on port `8788`, then Vite with HMR |
| `npm test` | Run all tests once |
| `npm run test:watch` | Watch-mode tests |
| `npm run build` | Production bundle + TypeScript type-check |
| `npm run build:pages` | Production bundle with GitHub Pages asset base |
| `npm run data:hamburg-center` | Regenerate the committed Elbe-to-Jungfernstieg building CityJSONSeq from the prepared official LoD2 catalog |
| `npm run data:hamburg-center:osm` | Regenerate the committed compact OSM road crop from the local Hamburg PBF (requires Python `osmium`) |
| `npm run data:hamburg-lod2 -- latest` | Resolve the newest official complete-city Hamburg LoD2 CityGML release |
| `npm run data:hamburg-lod2 -- download` | Download the newest official complete-city Hamburg archive into local `Data/` |
| `npm run data:hamburg-lod2 -- extract` | Extract the downloaded Hamburg CityGML tiles |
| `npm run data:hamburg-lod2 -- convert --cjval cjval` | Batch-convert and validate Hamburg tiles as editable CityJSONSeq |
| `npm run data:hamburg-lod2 -- geometry-audit --allow-invalid` | Audit CityJSONSeq solids with `val3dity`, isolating validator crashes per feature |
| `npm run data:hamburg-lod2 -- geometry-clean` | Build a strict editing catalog and quarantine primitive-invalid source features |
| `npm run data:hamburg-lod2:serve` | Serve the generated Hamburg tile catalog locally on port `8787` |
| `npm run data:hamburg-roads` | Batch-run the native osm2streets exporter over Hamburg OSM tiles and emit validated CityJSONSeq `Road` tiles |
| `npm run data:hamburg-roads:prepare` | One-command local bootstrap for the complete Hamburg road CityJSONSeq catalog |
| `npm run data:hamburg-roads:serve` | Serve the local Hamburg road catalog on port `8788` for editor loading and write-back |
| `npm run cityjson:to-citygml -- INPUT.city.json --require-road` | Convert exported CityJSON roads to CityGML 3.0 with `citygml-tools from-cityjson`, then schema-validate the `.gml` |
| `npm run opendrive:rtron -- INPUT_DIR --dry-run` | Resolve the pinned r:trån validation and OpenDRIVE-to-CityGML pipeline without writing files; omit `--dry-run` after installing Java 11+ and the documented JAR |
| `npm run osm2streets:compare` | Compare source-built osm2streets WASM and native executable outputs for committed Hamburg OSM fixtures |

## Hosting

The prototype is hosted as a static GitHub Pages site. The repo includes
`hamburg-city-center-buildings.city.jsonl` with 1,353 official LoD2 buildings
and `hamburg-city-center-roads.osm`, which is processed by the vendored browser
osm2streets engine into the same lane, intersection, and marking layers as the
live road fetch. The complete-city workflow remains optional and uses local
catalog servers for viewport loading and validated sequence-tile write-back.

For `cakirmert/webcityeditor`, the deployed URL is:

```text
https://cakirmert.github.io/webcityeditor/
```

To refresh the hosted demo, push `main`. `.github/workflows/deploy-pages.yml` runs tests, builds `prototype/dist`, and publishes the result to `gh-pages`; GitHub Pages then deploys that branch.

## Project layout

```
webcityeditor/
├── AGENTS.md                              Automatic Codex repo instructions and verification rules
├── NEXT_CHAT_PROMPT.md                    Fresh-PC setup and latest implementation handoff
├── PREPARE_HAMBURG_ROADS.cmd             Windows road CityJSON preparation entry point
├── HiWi_LoD2_Proje_Plani.docx           Original HiWi proposal
├── HiWi_LoD2_Proje_Plani_v2.docx        Revised with richer tech stack
├── LoD2_Editor_Onay_Dokumani.docx       Supervisor approval document (19 decisions)
├── vendor/osm2streets/                  Git submodule for the patched osm2streets fork
├── prototype/                            The browser app
│   ├── PROTOTYPE_STATUS.md              Current state: planned vs delivered, roadmap
│   ├── HAMBURG_PIPELINE.md              Hamburg complete-city CityGML → validated tiled CityJSONSeq
│   ├── OSM2STREETS_FORK_PLAN.md         osm2streets WASM/fork and lane UI plan
│   ├── OSM2STREETS_HANDOFF.md           osm2streets-only implementation handoff for future agents
│   ├── OSM2STREETS_LANE_VALIDATION_NOTES.md
│   │                                      External Python lane-validation spike notes
│   ├── CITYGML_TRANSPORTATION_PLAN.md   CityGML Transportation, OpenDRIVE, and muv-osm plan
│   ├── METRIC_ROAD_LIMITS_AND_OPENDRIVE_PIPELINE.md
│   │                                      Metric road-limit and r:trån trial pipeline plan
│   ├── OSM2STREETS_PANIC_HARDENING_PLAN.md
│   │                                      Three-bbox Rust/WASM hardening and visual acceptance handoff
│   ├── scripts/build-osm2streets-wasm.ps1
│   ├── scripts/prepare-hamburg-road-catalog.mjs
│   ├── scripts/prepare-hamburg-roads-on-windows.ps1
│   ├── scripts/cityjson-to-citygml.mjs
│   ├── test-fixtures/osm2streets/        Hamburg OSM regression fixtures and expected counts
│   ├── vendor/osm2streets-js/            Built wasm-pack package consumed by the Vite app
│   └── src/
│       ├── components/                   React + shadcn/ui components
│       └── lib/                          Pure-function libraries (well-tested)
└── spike/                                Early spikes
    └── spike.html                        Hand-rolled CityJSON parser for baseline risk check
```

## License

The pinned `cityjson-threejs-loader` dependency is MIT licensed upstream. This project is currently unlicensed (all rights reserved pending HiWi outcome). Add a LICENSE file before open-sourcing more broadly.
