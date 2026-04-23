# City Editor

Browser-based LoD 2 city-model editor. Loads CityJSON 2.0, renders every building on a MapLibre + deck.gl map, and lets you edit, create, transform, subdivide, and export buildings — all client-side.

Built as the prototype deliverable for the HiWi "LoD 2 Editor" project. See [`prototype/PROTOTYPE_STATUS.md`](prototype/PROTOTYPE_STATUS.md) for the full planned-vs-delivered breakdown and [`prototype/HAMBURG_PIPELINE.md`](prototype/HAMBURG_PIPELINE.md) for the Hamburg CityGML-to-CityJSON pipeline.

## Features

- MapLibre basemap + deck.gl extruded building context (LoD-by-zoom: outlines below z 14.5, blocks above).
- Side-panel Three.js editor for the selected building (uses TU Delft's [`cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader)).
- Parametric new-building flow: Terra Draw footprint → dialog with live preview on the map → flat / pyramid / gable / hip roofs.
- Snap-to-existing-footprints while drawing (auto-collected from the loaded CityJSON).
- Attribute editing with dirty tracking, per-building revert, export modified CityJSON, IndexedDB local persistence.
- Subdivision into BuildingParts: split by floor (stacked) or by side (adjacent). Works on any loaded building, not just ones created in the editor.
- Live-preview transforms: translate and rotate buildings with a ghost preview on the map, then save or cancel.
- 10 CRS registered via proj4 (EPSG:4326, 3857, 4978, 7415, 28992, 25831–25834, 3812, 2056, 31287, 5514).
- 100+ tests across validation, round-trip, generation, subdivision, transforms.

## Setup

Prerequisites: Node.js 20+, npm, Git.

```bash
git clone https://github.com/YOUR-USER/webcityeditor.git
cd webcityeditor

# Clone the TU Delft CityJSON-Three.js loader into the expected location.
# It's referenced via a file: link from prototype/package.json and intentionally
# not vendored into this repo.
git clone https://github.com/cityjson/cityjson-threejs-loader.git spike/cityjson-threejs-loader

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
    ├── spike.html                        Hand-rolled CityJSON parser for baseline risk check
    └── cityjson-threejs-loader/          (cloned on setup — not in this repo)
```

## License

See `spike/cityjson-threejs-loader` upstream for its MIT license. This project is currently unlicensed (all rights reserved pending HiWi outcome). Add a LICENSE file before open-sourcing more broadly.
