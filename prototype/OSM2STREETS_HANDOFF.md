# osm2streets Implementation Handoff

> Last updated: 2026-07-16
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
- The hardened fork revision is `00b484f868f89c2420d25410525faf2414dde3c5`.
  It turns explicit non-positive widths into semantic defaults with warnings and
  makes road-edge, lane, sidewalk, crosswalk, and marking polygon generation
  fallible with OSM road/intersection context.
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
- Seven committed fixtures now include the three former Hamburg panic paths;
  native and WASM outputs match with zero error diagnostics.
- `prototype/OSM2STREETS_LANE_VALIDATION_NOTES.md` records an external
  Python-binding validation spike from
  `C:\Users\dmz-admin\Downloads\lane_validation`, including web-tool-style
  layer names, options, clipping workaround, and interpretation of
  `network_plain`.

## Catalog Generation Versus CityJSON Editing

For the precomputed Hamburg workflow, osm2streets is a
**catalog-generation dependency**, not a requirement for normal editing. The
optional live OSM fetch path still uses the browser WASM engine. A fresh clone
can create the complete Hamburg road catalog with:

```powershell
cd D:\webcityeditor
.\PREPARE_HAMBURG_ROADS.cmd -Serve
```

The Windows entry point checks Git, Node.js 20+, npm, and Rust/Cargo before the
large conversion. The underlying preparation command initializes the Git
submodule, installs Node dependencies when needed, downloads the Geofabrik
Hamburg PBF when absent, builds the platform-native exporter with Cargo, runs
the proven Hamburg tile/subdivision settings, validates each CityJSONSeq tile,
and discards successful native/GeoJSON intermediates. It retains about 2.3 GiB
of served `.city.jsonl` data under ignored `Data/`, so the full dataset is not
committed. A complete zero-failure preferred catalog, or the newest complete
sibling `cityjsonseq-*` proof catalog, is detected and reused on later runs;
older partial catalogs are ignored. `PREPARE_HAMBURG_ROADS.cmd -DryRun` prints
the resolved plan without creating files; the cross-platform entry point remains
`npm run data:hamburg-roads:prepare`, and `npm run dev:hamburg-roads` restarts
the prepared catalog plus Vite.

Once generated, the editor and local catalog server load, modify, and save
CityJSONSeq without calling osm2streets. Exact imported road surfaces can be
turned into a `RoadDraft` by deriving a centerline and semantic lane bands.
Cancel discards the draft without touching CityJSON; Save replaces the same
Road id and compacts orphaned vertices. That save intentionally regenerates the
changed road as editable ribbon surfaces, so an untouched exact polygon remains
exact but a reshaped one does not.

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
12. Added offline OSM reference-complete extraction and recursive failure
    minimization helpers plus three focused panic-regression fixtures.
13. Rebuilt WASM from fork commit `00b484f` and repaired all three recorded
    Hamburg bboxes.
14. Completed the whole-Hamburg CityJSONSeq road export with 20 non-empty
    validated tiles, 47 true empty tiles, 344,265 roads, 913,927 surfaces,
    4,774,798 vertices, and `failed: 0`.
15. Stabilized semantic rendering across fetched, selected, editable, and
    re-imported roads; added underground/satellite opacity; removed false car
    lanes for pedestrian paths; and removed the dormant trusted-corridor UI.
16. Made planning explicitly click-driven but complete for the bounded viewport
    by paginating both XPlan and FNP, deduplicating, and rejecting partial loads.
17. Ran the hosted-fixture and live Hamburg browser smoke: exact picking,
    semantic bus-lane red, draft creation, satellite/underground opacity,
    planning, and panel sizing all passed with no console errors.
18. Added explicit road-edit cancellation and in-place save for existing Road
    ids, including imported exact CityJSON roads that lack `_roadLayout`.
19. Replaced the MapLibre-backed deck.gl drag gesture with a capture-phase
    Pointer Event session. Pointer capture, a preserved grab offset, and
    release-only completion keep enlarged road centerline handles attached
    across trackpad and overlay event sequences.
20. Added the portable `data:hamburg-roads:prepare` and
    `data:hamburg-roads:serve` workflow; sequence-only output and successful-work
    cleanup keep the generated catalog local instead of committing a large or
    arbitrary area subset.
21. Added `PREPARE_HAMBURG_ROADS.cmd`, prerequisite-aware Windows preparation,
    `npm run dev:hamburg-roads`, root `AGENTS.md`, and `NEXT_CHAT_PROMPT.md` so a
    fresh-PC Codex session can discover and run the current workflow quickly.

## What Is Still Left

- Run the short user visual-acceptance checklist on the published build.
- Compare fixture and viewport output against the upstream osm2streets demo for
  the same areas when crosswalk/intersection marking quality matters.
- Test `dual_carriageway_experiment` on representative divided Hamburg roads
  before enabling it by default.
- Keep road-fit validation separate. The delivered baseline validates editable
  and exact road surfaces against buildings/planning data, including metric
  clearance and vertical uncertainty. Pure corridor geometry remains dormant;
  only restore its UI after an authoritative automatic data source exists.
- If a fixture exposes wrong geometry, patch the Rust source and add or tighten
  the fixture expectation in the same commit.

## Verification Commands

Run these after osm2streets changes:

```powershell
cd D:\webcityeditor\vendor\osm2streets
cargo fmt
cargo test -p osm2lanes
cargo test -p osm2streets
cargo test -p osm2streets-js

cd D:\webcityeditor\prototype
.\scripts\build-osm2streets-wasm.ps1
npm ci
npm outdated --json
npm audit --json
npm run osm2streets:compare
npm run data:hamburg-roads:prepare -- --dry-run
cd ..
.\PREPARE_HAMBURG_ROADS.cmd -DryRun
cd prototype
npm run build
npm run test -- src/lib/osm2streets.test.ts src/lib/road-fit.test.ts
npm test
```

Known Rust workspace caveat: on Windows, the upstream generated fixture tests
currently emit paths such as `src\arizona_highways` as invalid Rust string
escapes. The three focused modified-crate test suites above pass.

Browser verification should include:

- [x] start `npm run dev:frontend`
- [x] load the hosted exact-surface fixture
- [x] fetch OSM roads for a Hamburg viewport
- [x] confirm exact lane polygons and semantic colors survive selection/editing
- [x] confirm the console has no red `console.error` lines
- [x] inspect intersection/crosswalk markings and metadata
- [x] confirm a dirty road edit exposes the explicit Cancel action (state preservation is unit-covered)
- [ ] press and hold a road endpoint, drag continuously beyond the handle, and
  confirm it remains attached until pointer release

## Do Not Do

- Do not restore `prototype/src/lib/lane-geometry.ts`.
- Do not add a JS/TypeScript road-geometry fallback behind `processOsmXml()`.
- Do not hide real thrown constructor failures from `JsStreetNetwork`.
- Do not treat Vite as the root cause unless the `.wasm` asset fails to load.
- Do not mix visual lane generation with road-fit validation. They are separate
  layers.
