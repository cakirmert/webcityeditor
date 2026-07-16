# Codex Guide for webcityeditor

This file is the fast entry point for Codex on a fresh PC.

## Start every repo task

1. Run `git status --short --branch`.
2. Run `git fetch --prune origin`.
3. Fast-forward with `git merge --ff-only origin/main` only when it preserves the
   current worktree. Never reset or discard unrelated user changes.
4. Read:
   - `prototype/PROTOTYPE_STATUS.md` for delivered scope and the roadmap.
   - `prototype/OSM2STREETS_HANDOFF.md` for the road geometry decisions.
   - `NEXT_CHAT_PROMPT.md` for the latest cross-PC setup and handoff.

The working application is under `prototype/`. Use `rg` for searches and run
Node commands from that directory.

## Immediate demo workflow

The committed Hamburg city-center demo needs only Node.js:

```powershell
cd prototype
npm ci
npm run dev
```

It auto-loads official LoD2 buildings plus a committed OSM crop processed by
the same browser osm2streets path as **Fetch Roads** for the
Elbe-to-Jungfernstieg showcase. Do not make the default demo depend on the
ignored whole-city catalogs, Rust/Cargo, Overpass, or a local backend.

## Optional whole-city Hamburg road workflow

On Windows, prepare and serve the complete road catalog with:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -Serve
```

Useful variants:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -DryRun
.\PREPARE_HAMBURG_ROADS.cmd
cd prototype
npm run dev:hamburg-roads
```

The generated catalog is intentionally ignored under
`Data/hamburg-roads-osm2streets/cityjsonseq/`. Do not commit it: the retained
complete catalog is about 2.3 GiB and is reproducible locally. The startup
resolver also recognizes a complete sibling `cityjsonseq-*` proof catalog, so
an older incomplete directory does not force an unnecessary rebuild.

The committed center files are the intentional exception:
`hamburg-city-center-buildings.city.jsonl` and
`hamburg-city-center-roads.osm` belong in Git. Regenerate them with
`npm run data:hamburg-center` and `npm run data:hamburg-center:osm`.

## Road editing invariants

- CityJSON Transportation `Road` objects are the edit source of truth.
- osm2streets is used to generate/refresh exact base polygons, not for every
  normal edit after a catalog exists.
- Preserve exact osm2streets polygons until the user intentionally reshapes and
  saves a road.
- Road centerline handles use capture-phase Pointer Events and pointer capture.
  Do not reintroduce `event.buttons === 0` as a drag-ending condition; it caused
  points to detach on trackpads and overlay event sequences.
- Keep explicit Cancel/Discard controls visible.
- Do not restore a manual `Trusted road corridor` blocking workflow.

## Verification

For ordinary prototype changes:

```powershell
cd prototype
npm run test -- <focused test paths>
npm test
npm run build
cd ..
git diff --check
```

For road-catalog setup changes, also run:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -DryRun
cd prototype
node --check scripts/dev.mjs
node --check scripts/prepare-hamburg-road-catalog.mjs
npm run dev:hamburg-roads -- --dry-run
```

For osm2streets engine changes, follow the larger command list in
`prototype/OSM2STREETS_HANDOFF.md`.
