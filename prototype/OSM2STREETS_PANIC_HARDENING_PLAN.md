# osm2streets Panic Hardening and Visual-Correctness Plan

**Status:** implemented 2026-07-14; automated gates and focused browser pass
complete, with the short user visual-acceptance checklist retained below
**Scope:** eliminate the three quarantined Hamburg native-export panics, retain
native/WASM parity, complete the Hamburg road export, and finish with a focused
browser correctness pass plus the user's manual acceptance test.
**Starting fork revision:** `vendor/osm2streets` at `5eb60ba` (`Fix degenerate
intersection geometry handling`).

## Final implementation evidence (2026-07-14)

- The fork is hardened and pushed at `00b484f868f89c2420d25410525faf2414dde3c5`.
  Explicit zero-width lanes now receive their semantic default width with a
  diagnostic, and road edges, lane polygons, sidewalks, crosswalks, and
  markings use fallible geometry paths with stable OSM road/intersection
  context instead of aborting the network.
- Three offline Hamburg regression fixtures cover the two zero-width paths and
  the degenerate road-edge/marking path. They were extracted with referenced
  OSM objects intact; live Overpass is not part of the regression gate.
- `npm run osm2streets:compare` passes all seven committed fixtures with
  normalized native/WASM parity and zero error diagnostics. The rebuilt WASM
  comes from the same fork revision.
- All three original WGS84 failure bboxes now complete with validation enabled:

  | Failure | Road features | Surfaces | Vertices | Failed |
  |---|---:|---:|---:|---:|
  | repeat-point west | 34,026 | 82,244 | 476,090 | 0 |
  | repeat-point east | 26,945 | 67,857 | 357,357 | 0 |
  | degenerate edge | 101,344 | 267,360 | 1,303,730 | 0 |

- The clean whole-Hamburg run at
  `Data/hamburg-roads-osm2streets/cityjsonseq-2026-07-14-hardening/`
  emitted 20 validated non-empty tiles and 47 true empty/water tiles with
  `failed: 0`: 344,265 `Road` features, 913,927 surfaces, and 4,774,798
  vertices. One 514.5 MiB parent lane file was deterministically subdivided
  into four valid children rather than retained in memory indefinitely.
- The run records fork revision `00b484f`, PBF SHA-256
  `ee5398fbe5c05c9ef5cf4ddbc80f1e90047498280402c7633b5e2d8e2d71510a`,
  and exporter SHA-256
  `eab582032cd343ca2001dcf5380db8756e60ec11605f1d92af1c9c78c95cb74c`.
  `build-hamburg-osm2streets-road-catalog.mjs` regenerates the road-specific
  catalog without replacing it with LoD2 building metadata.
- The focused browser pass covered the hosted exact fixture and a fresh central
  Hamburg Overpass fetch. Exact selection keeps the same polygons and semantic
  colors when an editable draft opens; red surfaces identify as bus lanes;
  underground and satellite overlays use reduced opacity; the compact draft UI
  does not clip; planning loads both paginated sources for the current view;
  and the console contained no errors.
- The manual `Trusted road corridor` upload/blocking workflow was removed. The
  pure geometry helpers remain dormant for a future authoritative automatic
  corridor source, but an unloaded optional file can no longer block or clutter
  ordinary road editing.
- Focused Rust tests pass (`osm2lanes`, `osm2streets`, and the exporter crate).
  The upstream workspace-wide test command still has a Windows-only generated
  fixture-path issue (`src\arizona_highways` is emitted as an invalid Rust
  string escape); it is outside the modified crates and does not affect the
  focused gates above.

## New-thread starter prompt

> Work from `D:\webcityeditor` on current `main`. Read
> `prototype/OSM2STREETS_PANIC_HARDENING_PLAN.md`, `prototype/PROTOTYPE_STATUS.md`,
> `prototype/OSM2STREETS_HANDOFF.md`, and the current failure summary before
> editing. Execute this plan to completion, using the three recorded Hamburg
> bboxes as the initial reproducers. Fix failures in the Rust fork rather than
> adding a JavaScript fallback. Commit and push fork changes inside
> `vendor/osm2streets` first, rebuild the checked-in WASM package, then commit
> the parent repository's gitlink/code/docs changes. Keep automated render
> testing focused; I will do the final visual/manual acceptance pass.

## What already works and must remain true

- The deployed GitHub Pages editor is client-side. It does not need the local
  Hamburg catalog server for hosted samples, OSM/Overpass road inspection,
  manual road editing, road-fit checks, CityJSON export, or the hosted
  exact-surface road fixture.
- The local server is only for prepared whole-city Hamburg CityJSONSeq building
  tile streaming and validated source-tile write-back.
- osm2streets is the single OSM-derived reference/exact-surface geometry engine.
  Manual/editable `RoadDraft` ribbons remain a deliberate separate authoring
  representation; do not add a second OSM lane-geometry implementation.
- Exact osm2streets surfaces retain lane type, direction, width, semantic
  function/usage, OSM ids, osm2streets ids, and source provenance through
  CityJSON insertion and re-import.
- The committed WASM and the native exporter must come from the same fork commit
  and produce normalized-equivalent outputs for the same fixture/options.

## Current evidence

The last full Hamburg run is recorded at:

`Data/hamburg-roads-osm2streets/cityjsonseq/hamburg-osm2streets-roads-current-summary.json`

It produced 10 validated tiles, 182,396 `Road` features, 497,421 surfaces, and
2,641,099 vertices. Eighteen water/outside tiles correctly contained no lane
polygons. Three bboxes exited with native status 101:

| Failure id | WGS84 bbox | Recorded terminal panic |
|---|---|---|
| `hh-road-r00-c01-r00-c01-r01-c00` | `9.87253961564955,53.46357491440622,10.103364892702622,53.5302923428177` | `PolyLine::make_polygons() failed: Ring has repeat non-adjacent points` |
| `hh-road-r00-c01-r00-c01-r01-c01` | `10.103364892702622,53.46357491440622,10.334190169755693,53.5302923428177` | `PolyLine::make_polygons() failed: Ring has repeat non-adjacent points` |
| `hh-road-r00-c01-r01-c01-r00-c00` | `9.87253961564955,53.5302923428177,10.103364892702622,53.59700977122918` | `called Result::unwrap() on Need at least two points for a PolyLine` |

The logs also contain repeated non-fatal signals that should be classified while
minimizing the reproducers: no-road intersections after clipping, loop-road
collision warnings, too-short degenerate-intersection trims, and `named lane
doesn't exist`. Do not assume those warnings are the panic root until a fresh
backtrace proves the call path.

## Success criteria

The slice is done only when all of these are true:

1. All three exact recorded bboxes complete with a freshly built exporter.
2. Each root cause has a small committed OSM regression fixture or a smaller
   deterministic fixture that exercises the same geometry path.
3. Invalid intermediate geometry cannot abort the entire native or WASM run.
4. A repair does not silently delete a normal lane/intersection. Any geometry
   that genuinely cannot be produced is skipped at the narrowest semantic level
   and reported with stable road/intersection ids plus a reason.
5. `npm run osm2streets:compare` proves native/WASM output and diagnostic parity.
6. A full Hamburg rerun ends with `failed: 0`; true no-road tiles remain listed
   as `empty`, not failures.
7. Every generated CityJSONSeq road tile passes the existing structural
   validator and catalog generation completes.
8. A focused browser pass shows lanes, bike lanes, sidewalks, intersections,
   lane markings, and intersection markings with the expected semantic colors,
   picking, metadata, and exact CityJSON re-import behavior.
9. The user receives a short manual checklist and performs the final visual
   acceptance pass. Pixel-perfect screenshot automation is not required.

## Phase 0 - clean start and fresh reproduction

1. Sync without losing work:

   ```powershell
   git fetch --prune origin
   git status -sb
   git submodule update --init --recursive
   git -C vendor/osm2streets status -sb
   git -C vendor/osm2streets rev-parse HEAD
   ```

2. Create a dedicated branch such as
   `codex/osm2streets-panic-hardening`. Treat `vendor/osm2streets` as its own Git
   repository throughout the task.
3. Rebuild the native exporter from source so old binaries cannot create a
   false result:

   ```powershell
   cargo build --release --manifest-path vendor/osm2streets/Cargo.toml `
     -p osm2streets-js --bin webcityeditor_native_export
   $env:RUST_BACKTRACE = 'full'
   ```

4. Re-run each exact bbox independently with `--grid 1 --max-depth 0`, unique
   scratch output/work directories, and `--validate false` during diagnosis.
   Example for the first bbox:

   ```powershell
   Set-Location prototype
   npm run data:hamburg-roads -- `
     --bbox "9.87253961564955,53.46357491440622,10.103364892702622,53.5302923428177" `
     --grid 1 --max-depth 0 --validate false `
     --output-dir "../Data/hamburg-roads-osm2streets/panic-repro/failure-1/output" `
     --work-dir "../Data/hamburg-roads-osm2streets/panic-repro/failure-1/work"
   ```

5. Record for each run: fork SHA, exporter SHA/time, bbox, full backtrace,
   transformation stage, road/intersection ids, panic signature, and whether the
   crash occurs during network construction, lane polygons, lane markings,
   intersection markings, or JSON serialization.
6. If a bbox no longer fails, prove why: compare the rebuilt binary SHA and fork
   SHA with the July run, then still turn the bbox into a non-regression test.

## Phase 1 - minimize and classify each failure

1. Add a small retry/minimization helper around
   `scripts/build-hamburg-osm2streets-roads.mjs` rather than repeatedly editing
   hard-coded bboxes. It should accept the existing summary, retry only failed
   bboxes, recursively quarter a failing bbox, preserve logs, and stop at a
   configurable depth/size.
2. Store a machine-readable repro manifest containing parent/child bboxes,
   exporter exit status, panic signature, and the smallest still-failing bbox.
3. Be careful with clip-edge failures: repeat the smallest bbox with a small
   buffer. If the failure disappears, preserve enough surrounding OSM topology
   in the fixture to reproduce the boundary condition.
4. Extract a minimal `.osm` fixture for each distinct root cause, retaining
   referenced nodes/ways/relations. `osmium-tool` is not currently installed on
   this Windows machine; install/document it, use WSL, or add another
   reproducible extraction step. Do not make live Overpass the regression test.
5. Add the fixtures to `prototype/test-fixtures/osm2streets/fixtures.json` with
   meaningful minimum counts. Keep separate fixtures when the repeat-point and
   one-point-polyline panics have different call paths.

## Phase 2 - fix the Rust root causes without hiding bad geometry

1. Use the fresh backtrace to find the osm2streets call site before changing the
   external `geom` crate. Likely investigation areas include lane/marking
   polygonization, trimmed/pretrimmed centerlines, and geometry recomputation
   after collapsing intersections.
2. Replace panic-prone `unwrap`, `expect`, or infallible
   `PolyLine::make_polygons()` use at the osm2streets boundary with a fallible
   path that contains the relevant road/intersection/lane ids.
3. Prefer a deterministic, semantics-preserving repair when possible:
   - remove adjacent duplicate points;
   - reject or split a repeated non-adjacent loop only when topology proves it;
   - project stale trim points back onto the current centerline;
   - refuse a centerline with fewer than two distinct points before rendering.
4. If repair is unsafe, skip only the affected marking/surface—not the entire
   network—and emit a structured warning. Lane polygons are core output, so a
   skipped lane requires an explicit diagnostic and a correctness review.
5. Avoid a broad `catch_unwind` as the primary fix. Native and WASM should share
   normal `Result`-based control flow and deterministic diagnostics.
6. Add Rust unit tests beside the fixed geometry function and regression tests
   through `webcityeditor_native_export` for every minimized fixture.
7. Reduce repeated no-road-intersection warnings if they are expected clip
   cleanup, but do not suppress genuinely new geometry errors.

## Phase 3 - rebuild WASM and prove native/browser parity

1. Commit and push the Rust fork changes inside `vendor/osm2streets` first.
2. Rebuild the browser package from that exact fork commit:

   ```powershell
   Set-Location prototype
   .\scripts\build-osm2streets-wasm.ps1
   npm ci
   npm run osm2streets:compare
   ```

3. Confirm the generated `prototype/vendor/osm2streets-js` package changed only
   as expected and the parent repository records the new submodule gitlink.
4. For each new fixture require:
   - native exit 0;
   - WASM construction/export without panic;
   - zero error diagnostics;
   - matching normalized lanes, lane markings, intersection markings, and
     `network.json`;
   - minimum semantic feature counts that would detect accidental empty output.
5. Run the focused TypeScript/CLI tests affected by the contract and a production
   build. Do not add expensive screenshot-diff infrastructure for this slice.

## Phase 4 - complete and validate the Hamburg batch

1. First rerun the three former failure bboxes with validation enabled.
2. Rerun the whole Hamburg job with a fresh generated timestamp and clean output
   directories. Do not overwrite the last known summary until the new run has
   completed and been checked.
3. Require `failed: 0`. Review `empty` tiles separately so water/outside areas do
   not become false failures.
4. Check totals for suspicious drops. Exact equality with the July run is not
   required because the three missing areas will add roads, but successful old
   tiles should not unexpectedly lose large numbers of lanes/surfaces.
5. Validate every emitted `.city.jsonl`, regenerate the road catalog, and record
   final totals plus fork SHA in the summary.
6. If a new failure appears, add it to the same minimization/fixture loop; do not
   increase subdivision depth indefinitely as a substitute for a root fix.

## Phase 5 - focused display correctness and user handoff

Automated browser work should be short and evidence-driven because the user will
perform the final visual test:

1. Start the app and load the committed real osm2streets road fixture.
2. Check one representative of each visible class: driving, bike, sidewalk,
   parking/buffer if present, intersection polygon, lane marking, and
   intersection/crosswalk marking.
3. Confirm z-order/readability, semantic colors, selection highlight, connected
   road highlighting, and the metadata card.
4. Insert an exact road into CityJSON, export/reload it, and confirm the same
   polygons, semantic colors, ids, and provenance return.
5. Do one live Hamburg viewport smoke fetch only after fixture parity is green.
   Confirm no red osm2streets console errors. Do not try to exhaustively inspect
   the city in automation.
6. Give the user a five-minute manual checklist covering the same classes plus
   any locations corresponding to the three repaired bboxes.

## Required commits and documentation

Keep the two repositories explicit:

1. `vendor/osm2streets`: Rust fix + Rust/minimized regression tests; push to the
   fork remote.
2. Parent `webcityeditor`: updated gitlink, rebuilt WASM package, JS retry/minimizer,
   committed fixtures, parity expectations, batch summary/docs, and status-plan
   updates.

Update at least:

- `prototype/PROTOTYPE_STATUS.md`
- `prototype/OSM2STREETS_HANDOFF.md`
- `prototype/OSM2STREETS_FORK_PLAN.md`
- `prototype/CITYGML_TRANSPORTATION_PLAN.md`
- this plan with final evidence and manual-test locations

Do not mark this plan complete merely because smaller bboxes avoid the panic.
Completion means root-cause hardening, deterministic native/WASM coverage,
`failed: 0` for the Hamburg batch, valid CityJSONSeq output, and the focused
display/manual acceptance gates above.

## Five-minute published-build acceptance checklist

1. Open **Data → Advanced → Hamburg osm2streets roads - real fixture**, then
   open **Roads**. Pick a dark driving lane and create its editable draft; the
   exact polygon and fill must not turn black, disappear, or change width.
2. Pick a red surface near the live central-Hamburg fetch. Its inspector and
   draft must say **Bus**, not car. Sidewalks should remain grey, bicycle/shared
   paths distinct, and intersection/crosswalk markings visible.
3. Toggle **Satellite** and confirm imagery remains readable beneath all road
   surfaces. Set a draft to **Underground** and confirm its road overlay becomes
   more transparent without changing its semantic color.
4. Click **Planning** once at a normal Hamburg zoom. Wait for both sources to
   finish, then confirm the button says **Refresh Planning**, **Hide** is
   available, and no partial/sample warning appears.
5. Inspect the three repaired areas using the bboxes in **Current evidence** if
   desired; fetch/recalculate must finish without a red error or missing-road
   fallback. The `Trusted road corridor` card must not appear.
