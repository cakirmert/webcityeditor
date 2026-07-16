# webcityeditor Other-PC Handoff

Last updated: 2026-07-16.

## Fastest setup on the other Windows PC

```powershell
git clone --recurse-submodules https://github.com/cakirmert/webcityeditor.git
cd webcityeditor
cd prototype
npm ci
npm run dev
```

Open `http://localhost:5173`. The committed Hamburg city-center CityJSONSeq
buildings load automatically, and the committed matching OSM crop runs through
the same browser osm2streets path as **Fetch Roads** for lane, intersection,
and marking rendering from the Elbe waterfront through Rathaus to
Jungfernstieg.

The default demo only needs Node.js 20+ and npm. Rust/Cargo, the Hamburg PBF,
and the 2.3 GiB local road catalog are required only for regenerating or serving
the complete-city road dataset.

For a non-mutating setup check:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -DryRun
```

For conversion without starting the app:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd
```

Then start it later with:

```powershell
cd prototype
npm run dev:hamburg-roads
```

Use `npm run dev:hamburg-roads -- --dry-run` to print the selected validated
catalog and startup plan without opening either service.

The complete generated catalogs stay under ignored `Data/`. The browser-safe
center building CityJSONSeq and OSM crop under
`prototype/public/data/hamburg/` are deliberately committed.

## Current implementation snapshot

- Normal road editing is CityJSON/CityJSONSeq-only after the base catalog has
  been prepared.
- Existing imported road surfaces can be opened as an editable draft, canceled
  without changing CityJSON, and saved back onto the same Road id.
- Exact osm2streets lane polygons remain exact until the user intentionally
  reshapes and saves that road.
- Road point dragging now starts in the capture phase, uses Pointer Events and
  pointer capture, keeps the original grab offset, and ends only on pointer
  release/cancel. The larger yellow/white handles have an 18-pixel pick radius.
- The road editor tells the user to press and hold a yellow point; white
  midpoint handles add a corner.
- `npm run data:hamburg-roads:prepare` remains the cross-platform conversion
  command. `PREPARE_HAMBURG_ROADS.cmd` is the easier Windows entry point.
- `npm run dev:hamburg-roads` starts the prepared port-8788 catalog and Vite
  together.
- `npm run dev` starts Vite directly and auto-loads the committed center demo.
- The latest prior roadmap slice added the pinned r:trån OpenDRIVE pipeline
  scaffold. A real `.xodr` fixture and output inspection are still pending.

## Copy/paste prompt for Codex on the other PC

```text
Work in the webcityeditor clone. Read AGENTS.md, NEXT_CHAT_PROMPT.md,
prototype/PROTOTYPE_STATUS.md, and prototype/OSM2STREETS_HANDOFF.md first.
Check git status, fetch origin, and fast-forward main only if it preserves local
work. Treat CityJSON Transportation roads as the edit source of truth and keep
the generated Hamburg catalog out of Git. Run focused tests, the full test
suite, the production build, and git diff --check before finishing. Report
exactly what changed and what passed or failed.
```

## Verification recorded for this handoff

- Focused road-editor and portable-catalog tests passed.
- Full suite: 59 files, 516 tests passed.
- TypeScript and the production Vite build passed.
- The Windows preparation dry-run passed.
- The normal prepare command found and reused the zero-failure 344,265-road,
  20-tile proof catalog instead of the older partial default directory.
- `npm run dev:hamburg-roads -- --dry-run` selected that validated catalog and
  produced the expected port-8788 plus Vite startup plan.
- A fresh interactive pointer-drag browser acceptance check is still useful on
  the target PC; the implementation and regression suite are green, but this
  session did not have the browser-control runtime needed to automate the drag.

## Important local paths

```text
prototype/src/components/MapView.tsx
prototype/src/components/RoadEditorPanel.tsx
prototype/scripts/prepare-hamburg-road-catalog.mjs
prototype/scripts/prepare-hamburg-roads-on-windows.ps1
prototype/scripts/dev.mjs
Data/hamburg-roads-osm2streets/cityjsonseq/
```
