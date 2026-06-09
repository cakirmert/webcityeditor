# City Editor

Browser-based LoD 2 city-model editor. Prefers tiled CityJSONSeq input, also loads monolithic CityJSON 2.0, renders buildings on a MapLibre + deck.gl map, and lets you edit, create, transform, subdivide, and export buildings. A lightweight optional local server provides strict whole-city Hamburg tile loading and write-back.

Built as the prototype deliverable for the HiWi "LoD 2 Editor" project. See [`prototype/PROTOTYPE_STATUS.md`](prototype/PROTOTYPE_STATUS.md) for the full planned-vs-delivered breakdown, [`prototype/HAMBURG_PIPELINE.md`](prototype/HAMBURG_PIPELINE.md) for the Hamburg CityGML-to-CityJSON pipeline, and [`prototype/CITYGML_TRANSPORTATION_PLAN.md`](prototype/CITYGML_TRANSPORTATION_PLAN.md) for the CityGML Transportation/OpenDRIVE/muv-osm roadmap.

## Features

- MapLibre basemap + deck.gl extruded building context (LoD-by-zoom: outlines below z 14.5, blocks above).
- Side-panel Three.js editor for the selected building (uses TU Delft's [`cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader)).
- Parametric new-building flow: Terra Draw footprint -> fullscreen creator with live 3D preview -> flat / pyramid / gable / hip roofs.
- Snap-to-existing-footprints while drawing (auto-collected from the loaded CityJSON).
- Attribute editing with dirty tracking, per-building revert, export modified CityJSON, IndexedDB local persistence.
- Hamburg planning overlay: fetches real XPlan building-use polygons by viewport, with FNP land-use fallback when XPlan has no polygons.
- Road editing writes CityJSON Transportation `Road` objects, with OSM as a reference layer and a documented path for patched osm2streets or TS/JS lane geometry, muv-osm semantics, OpenDRIVE/r:trån import, and future road-fit validation against planning/lot/building constraints.
- CityJSONSeq-first Hamburg workflow: connect the local strict catalog once, pan to fetch nearby `.city.jsonl` tiles, use **Save seq** for validated optimistic-concurrency write-back, and let clean off-screen tiles unload automatically.
- Subdivision into BuildingParts: split by floor, by side, or with per-floor footprint plans. Plans support manual percentage cuts, per-floor overrides, an apply-to-all-floors checkbox, and 2D/3D previews.
- Live-preview transforms: translate and rotate buildings with a ghost preview on the map, then save or cancel.
- 10 CRS registered via proj4 (EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514).
- 385 tests across validation, round-trip, generation, subdivision, transforms, CityJSONSeq catalog loading and write-back, IFC import, Hamburg data preparation, planning data, and UI components.

## Setup

Prerequisites: Node.js 20+, npm, Git.

```bash
git clone https://github.com/YOUR-USER/webcityeditor.git
cd webcityeditor

# Install and run the prototype
cd prototype
npm install
npm run dev
```

The dev server opens at http://localhost:5173. Click **"Use built-in sample cube"** to see it working instantly. For strict whole-city Hamburg LoD2 data, start the local tile server and use **"Connect catalog"** on the load screen.

## Scripts

From `prototype/`:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm test` | Run all tests once |
| `npm run test:watch` | Watch-mode tests |
| `npm run build` | Production bundle + TypeScript type-check |
| `npm run build:pages` | Production bundle with GitHub Pages asset base |
| `npm run data:hamburg-center` | Regenerate the small Hamburg center CityJSONSeq demo from official ALKIS footprints |
| `npm run data:hamburg-lod2 -- latest` | Resolve the newest official complete-city Hamburg LoD2 CityGML release |
| `npm run data:hamburg-lod2 -- download` | Download the newest official complete-city Hamburg archive into local `Data/` |
| `npm run data:hamburg-lod2 -- extract` | Extract the downloaded Hamburg CityGML tiles |
| `npm run data:hamburg-lod2 -- convert --cjval cjval` | Batch-convert and validate Hamburg tiles as editable CityJSONSeq |
| `npm run data:hamburg-lod2 -- geometry-audit --allow-invalid` | Audit CityJSONSeq solids with `val3dity`, isolating validator crashes per feature |
| `npm run data:hamburg-lod2 -- geometry-clean` | Build a strict editing catalog and quarantine primitive-invalid source features |
| `npm run data:hamburg-lod2:serve` | Serve the generated Hamburg tile catalog locally on port `8787` |

## Hosting

The prototype can be hosted as a static GitHub Pages site for small-file editing and demos. The complete-city Hamburg workflow uses the optional local catalog server for viewport loading and validated sequence-tile write-back. For `cakirmert/webcityeditor`, Pages serves the built static bundle from the `gh-pages` branch so the small hosted demo does not depend on backend infrastructure.

Small demo datasets can also be hosted from GitHub Pages without CORS issues. The repo now includes `prototype/public/data/hamburg/hamburg-center-alkis.city.jsonl`, a small Hamburg-center CityJSONSeq sample generated from official ALKIS building footprints. FileLoader reads `prototype/public/data/manifest.json` and only shows hosted samples whose files exist.

For `cakirmert/webcityeditor`, the deployed URL is:

```text
https://cakirmert.github.io/webcityeditor/
```

To refresh the hosted demo, push `main`. `.github/workflows/deploy-pages.yml` runs tests, builds `prototype/dist`, and publishes the result to `gh-pages`; GitHub Pages then deploys that branch.

## Project layout

```
webcityeditor/
├── HiWi_LoD2_Proje_Plani.docx           Original HiWi proposal
├── HiWi_LoD2_Proje_Plani_v2.docx        Revised with richer tech stack
├── LoD2_Editor_Onay_Dokumani.docx       Supervisor approval document (19 decisions)
├── prototype/                            The browser app
│   ├── PROTOTYPE_STATUS.md              Current state: planned vs delivered, roadmap
│   ├── HAMBURG_PIPELINE.md              Hamburg complete-city CityGML → validated tiled CityJSONSeq
│   ├── OSM2STREETS_FORK_PLAN.md         osm2streets WASM/fork and lane UI plan
│   ├── CITYGML_TRANSPORTATION_PLAN.md   CityGML Transportation, OpenDRIVE, and muv-osm plan
│   └── src/
│       ├── components/                   React + shadcn/ui components
│       └── lib/                          Pure-function libraries (well-tested)
└── spike/                                Early spikes
    └── spike.html                        Hand-rolled CityJSON parser for baseline risk check
```

## License

The pinned `cityjson-threejs-loader` dependency is MIT licensed upstream. This project is currently unlicensed (all rights reserved pending HiWi outcome). Add a LICENSE file before open-sourcing more broadly.
