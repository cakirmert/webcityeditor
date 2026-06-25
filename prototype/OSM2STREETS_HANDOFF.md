# osm2streets Implementation Handoff

> Last updated: 2026-06-24
> Purpose: give the next model the current osm2streets-only decision, the reason
> WASM is used, and the remaining non-fallback work.

## Current Decision

Use **one road-geometry engine**: the forked osm2streets Rust/WASM path.

Do not reintroduce a TypeScript/JavaScript lane-geometry fallback. The goal is
not "use osm2streets at all costs"; the goal is reliable lane-level road
geometry, and this repo's chosen implementation path is to repair osm2streets at
the Rust source, rebuild the browser WASM package, and prove the output with
Hamburg regression fixtures.

Current implementation state:

- `vendor/osm2streets` is a Git submodule pointing at the project fork.
- The fork patches Rust diagnostics so non-fatal geometry cases are warnings,
  not browser `console.error` failures.
- The fork normalizes Hamburg-style separately mapped sidewalk tags before
  `osm2lanes` lane parsing.
- `prototype/scripts/build-osm2streets-wasm.ps1` rebuilds the WASM package from
  `vendor/osm2streets/osm2streets-js`.
- `prototype/vendor/osm2streets-js` contains the checked-in `wasm-pack` output
  consumed by the Vite app.
- `prototype/package.json` resolves `osm2streets-js` from
  `file:./vendor/osm2streets-js`.
- `vendor/osm2streets/osm2streets-js/src/bin/webcityeditor_native_export.rs`
  is the native executable used to compare browser WASM output against native
  Rust output for the same fixture input.
- `prototype/src/lib/osm2streets.ts` initializes the source-built package and
  returns lane polygons, lane markings, and intersection markings with
  `engine: 'fork'`.
- `prototype/test-fixtures/osm2streets` contains committed Hamburg OSM fixtures.
- `npm run osm2streets:compare` runs those fixtures through both the
  source-built WASM package and native executable, writes both output sets to
  `prototype/test-output/osm2streets-comparison/`, and fails on count,
  diagnostics, or normalized-output differences.
- `prototype/OSM2STREETS_LANE_VALIDATION_NOTES.md` records an external
  Python-binding validation spike from
  `C:\Users\dmz-admin\Downloads\lane_validation`, including web-tool-style
  layer names, options, clipping workaround, and interpretation of
  `network_plain`.

## Why WASM Is Used

osm2streets is a Rust project. The browser cannot execute Rust source or a
native Rust binary directly, so the Rust engine has to be compiled to
WebAssembly for the Vite/React app.

WASM is not being used merely because the old npm package was already
configured. It is the browser delivery format for the upstream Rust geometry
engine. Using WASM keeps the editor on the osm2streets algorithmic path:

- lane polygon generation
- lane marking generation
- intersection polygon generation
- crosswalk/intersection marking output
- dual-carriageway experiments
- upstream Rust bug fixes

The red console spam was not caused by Vite, React, MapLibre, deck.gl, or
dependency bundling. Vite only loads the wasm-pack JS wrapper and `.wasm` asset.
The noisy messages came from the Rust logger and geometry edge cases.

If road generation moves to a backend service, WASM is not required. A backend
could call native Rust or a Rust CLI. For this browser-only prototype path, WASM
is the right way to run the Rust engine.

## Could A JS/TypeScript Version Work?

Technically yes, but it would be a separate implementation, not "making
osm2streets work."

A JS/TypeScript lane engine could offset centerlines for simple roads. That is
not enough here. A real replacement would have to replicate:

- OSM way parsing and tag interpretation
- lane ordering and widths
- sidepaths, sidewalks, cycle lanes, parking, and medians
- road trimming into intersections
- intersection polygons
- crosswalk and lane markings
- dual carriageway merging
- degenerate and short-road handling
- useful diagnostics for broken geometry

That is a large geometry engine and would diverge from upstream osm2streets. For
this project, JS/TypeScript should stay limited to app adapters, `RoadDraft`
conversion, validation, and UI. It should not become a replacement lane-geometry
backend unless the project explicitly changes direction later.

## Completed In This Pass

1. Forked `a-b-street/osm2streets` to the user's GitHub account.
2. Added the fork as `vendor/osm2streets`.
3. Patched Rust logging and non-fatal diagnostics at source.
4. Patched `osm2lanes` tag normalization for separately mapped sidewalk cases.
5. Added Rust tests for Hamburg sidewalk tag combinations.
6. Rebuilt `prototype/vendor/osm2streets-js` with `wasm-pack`.
7. Removed the old npm-wrapper `patch-package` path.
8. Wired the prototype dependency to `file:./vendor/osm2streets-js`.
9. Added Hamburg OSM regression fixtures and a comparison script.
10. Updated tests to load the local WASM package.
11. Added native Rust executable comparison for the same Hamburg fixtures.

## What Is Still Left

- Run real browser verification on Hamburg viewports, not only committed
  fixtures.
- Compare fixture and viewport output against the upstream osm2streets demo for
  the same areas when crosswalk/intersection marking quality matters.
- Test `dual_carriageway_experiment` on representative divided Hamburg roads
  before enabling it by default.
- Keep road-fit validation separate. It should validate `RoadDraft` or final
  road-surface polygons against planning/lot/building constraints and highlight
  overflow areas; it should not become a second lane-geometry generator.
- If a fixture exposes wrong geometry, patch the Rust source and add or tighten
  the fixture expectation in the same commit.

## Verification Commands

Run these after osm2streets changes:

```powershell
cd D:\webcityeditor\vendor\osm2streets
cargo fmt
cargo test -p osm2lanes
cargo test -p osm2streets-js

cd D:\webcityeditor\prototype
.\scripts\build-osm2streets-wasm.ps1
npm install
npm outdated --json
npm audit --json
npm run osm2streets:compare
npm run build
npm run test -- src/lib/osm2streets.test.ts src/lib/road-fit.test.ts
npm test
```

Known full-suite caveat: `npm test` can fail if
`prototype/public/fzk-haus.ifc` is absent. That fixture issue is unrelated to
osm2streets.

Browser verification should include:

- start `npm run dev`
- load the app
- fetch OSM roads for a Hamburg viewport
- confirm lane polygons render
- confirm the console has no red `console.error` lines from non-fatal
  osm2streets diagnostics
- inspect whether intersection/crosswalk markings are empty or present

## Do Not Do

- Do not restore `prototype/src/lib/lane-geometry.ts`.
- Do not add a JS/TypeScript road-geometry fallback behind `processOsmXml()`.
- Do not hide real thrown constructor failures from `JsStreetNetwork`.
- Do not treat Vite as the root cause unless the `.wasm` asset fails to load.
- Do not mix visual lane generation with road-fit validation. They are separate
  layers.
