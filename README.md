# City Editor

Browser-based LoD 2 city-model editor. Loads CityJSON 2.0, renders every building on a MapLibre + deck.gl map, and lets you edit, create, transform, subdivide, and export buildings — all client-side.

Built as the prototype deliverable for the HiWi "LoD 2 Editor" project. See [`prototype/PROTOTYPE_STATUS.md`](prototype/PROTOTYPE_STATUS.md) for the full planned-vs-delivered breakdown and [`prototype/HAMBURG_PIPELINE.md`](prototype/HAMBURG_PIPELINE.md) for the Hamburg CityGML-to-CityJSON pipeline.

## Features

- MapLibre basemap + deck.gl extruded building context (LoD-by-zoom: outlines below z 14.5, blocks above).
- Side-panel Three.js editor for the selected building (uses TU Delft's [`cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader)).
- Parametric new-building flow: Terra Draw footprint -> fullscreen creator with live 3D preview -> flat / pyramid / gable / hip roofs.
- Snap-to-existing-footprints while drawing (auto-collected from the loaded CityJSON).
- Attribute editing with dirty tracking, per-building revert, export modified CityJSON, IndexedDB local persistence.
- Hamburg planning overlay: fetches real XPlan building-use polygons by viewport, with FNP land-use fallback when XPlan has no polygons.
- Subdivision into BuildingParts: split by floor (stacked) or by side (adjacent). Works on any loaded building, not just ones created in the editor.
- Live-preview transforms: translate and rotate buildings with a ghost preview on the map, then save or cancel.
- 10 CRS registered via proj4 (EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514).
- 349 tests across validation, round-trip, generation, subdivision, transforms, IFC import, planning data, and UI components.

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

The dev server opens at http://localhost:5173. Click **"Use built-in sample cube"** to see it working instantly, or **"Fetch URL"** on the pre-filled 3DBAG tile for a real-world dataset.

## Scripts

From `prototype/`:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm test` | Run all tests once |
| `npm run test:watch` | Watch-mode tests |
| `npm run build` | Production bundle + TypeScript type-check |
| `npm run build:pages` | Production bundle with GitHub Pages asset base |

## Hosting

The prototype can be hosted as a static GitHub Pages site; no backend is required for the current client-only feature set. For `cakirmert/webcityeditor`, Pages is currently configured to serve the built static bundle from the `gh-pages` branch so the demo does not depend on backend infrastructure.

Small demo datasets can also be hosted from GitHub Pages without CORS issues. Put converted CityJSONSeq fixtures under `prototype/public/data/` and list them in `prototype/public/data/manifest.json`; FileLoader only shows hosted samples whose files exist.

For `cakirmert/webcityeditor`, the deployed URL is:

```text
https://cakirmert.github.io/webcityeditor/
```

To refresh the hosted demo, run `npm run build:pages`, publish `prototype/dist` to `gh-pages`, then request a Pages build. The repository also keeps `.github/workflows/deploy-pages.yml` as a GitHub Actions deployment path; switch **Settings -> Pages -> Source** back to **GitHub Actions** when Actions dispatches are healthy again.

## Project layout

```
webcityeditor/
├── HiWi_LoD2_Proje_Plani.docx           Original HiWi proposal
├── HiWi_LoD2_Proje_Plani_v2.docx        Revised with richer tech stack
├── LoD2_Editor_Onay_Dokumani.docx       Supervisor approval document (19 decisions)
├── prototype/                            The browser app
│   ├── PROTOTYPE_STATUS.md              Current state: planned vs delivered, roadmap
│   ├── HAMBURG_PIPELINE.md              Hamburg CityGML → CityJSON → DB pilot
│   └── src/
│       ├── components/                   React + shadcn/ui components
│       └── lib/                          Pure-function libraries (well-tested)
└── spike/                                Early spikes
    └── spike.html                        Hand-rolled CityJSON parser for baseline risk check
```

## License

The pinned `cityjson-threejs-loader` dependency is MIT licensed upstream. This project is currently unlicensed (all rights reserved pending HiWi outcome). Add a LICENSE file before open-sourcing more broadly.
