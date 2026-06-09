# osm2streets Implementation Handoff

> Last updated: 2026-06-09  
> Purpose: give the next model the current decision, the reason WASM is used,
> and the remaining non-fallback work.

## Current Decision

Use **one road-geometry engine**: osm2streets.

Do not reintroduce a TypeScript/JavaScript lane-geometry fallback. The fallback
files were deleted, and `processOsmXml()` now calls only `osm2streets-js` with
the classic osm2streets parser (`osm2lanes: false`).

Current implementation state:

- `prototype/src/lib/osm2streets.ts` initializes `osm2streets-js` and constructs
  `JsStreetNetwork`.
- `prototype/patches/osm2streets-js+0.1.4.patch` changes the packaged JS bridge
  so non-fatal Rust diagnostics are logged as `console.warn`, not
  `console.error`.
- `prototype/package.json` runs `patch-package` on `postinstall`.
- `prototype/src/lib/osm2streets.test.ts` has a regression test that runs the
  bundled WASM against minimal OSM XML and asserts that no browser errors are
  emitted.

## Why WASM Is Used

osm2streets is a Rust project. The browser cannot execute Rust source or a
native Rust binary directly, so the Rust code has to be compiled to WebAssembly
to run inside the Vite/React app.

WASM is therefore not just a shortcut because something is already configured.
It is the browser delivery format for the upstream Rust geometry engine. Using
WASM keeps the editor on the same algorithmic path as osm2streets itself:

- lane polygon generation
- lane marking generation
- intersection polygon generation
- crosswalk/intersection marking output
- dual-carriageway experiments
- upstream bug fixes from the Rust project

The current red console spam is not caused by Vite, React, MapLibre, deck.gl, or
dependency bundling. Vite is only loading the wasm-pack JS wrapper and `.wasm`
asset. The problematic messages come from the old published `osm2streets-js`
WASM package and its Rust logging/geometry edge cases.

If the road generation runs in a backend service instead of the browser, WASM is
not required. A backend could call native Rust or a Rust CLI directly. For this
browser-only prototype path, WASM is the correct way to run the Rust engine.

## Could A JS/TypeScript Version Work?

Technically yes, but it would be a separate implementation, not "making
osm2streets work."

A JS/TypeScript lane geometry engine could offset centerlines and produce simple
lane polygons for easy roads. That is not enough for this requirement. To
replace osm2streets properly, a JS version would need to replicate hard geometry
and topology behavior:

- OSM way parsing and tag interpretation
- lane ordering and widths
- sidepaths, sidewalks, cycle lanes, parking, medians
- trimming roads into intersections
- intersection polygons
- crosswalk and lane markings
- dual carriageway merging
- degenerate/short-road handling
- useful debug output for broken geometry

That is a large geometry engine. It would also diverge from osm2streets upstream
and make every bug fix local to this project. For that reason, JS/TypeScript
should stay limited to app adapters, `RoadDraft` conversion, validation, and UI.
It should not be used as a replacement or fallback lane-geometry backend unless
the project explicitly changes direction later.

Directly converting the Rust osm2streets codebase to maintainable JS is also not
realistic. wasm-bindgen emits JS glue around compiled WASM; it does not produce a
human-maintainable JS port of the Rust geometry code.

## What Is Left

The current npm wrapper patch only fixes misleading browser error reporting. It
does not fix geometry that is empty, wrong, or missing crosswalks. The remaining
work is to repair the osm2streets source path.

1. Fork `https://github.com/a-b-street/osm2streets`.
2. Add the fork as `vendor/osm2streets` or another clearly documented local
   source dependency.
3. Add a build script that runs `wasm-pack build --release --target web` from
   `vendor/osm2streets/osm2streets-js`.
4. Change `prototype/package.json` from the npm package to the locally built
   package, for example:

   ```json
   "osm2streets-js": "file:./vendor/osm2streets-js"
   ```

5. Patch Rust diagnostics at source:
   - keep actual fatal failures as errors
   - downgrade non-fatal geometry messages such as "trimmed into oblivion" and
     "degenerate intersection" to warnings
   - reduce noisy `info!` output in the browser logger
6. Fix Hamburg OSM tag cases in the Rust path, especially sidewalk/separate tags
   that currently make the older `osm2lanes` parser unreliable.
7. Re-test parser choice:
   - current app uses `osm2lanes: false`
   - after Rust fixes, compare `osm2lanes: true` and `false`
   - keep the mode that produces better Hamburg lane geometry
8. Build a small Hamburg regression corpus:
   - save representative Overpass XML snippets or fixtures
   - include the areas that produced "called with no roads", "trimmed into
     oblivion", and "too short to trim" diagnostics
   - record expected minimum counts for lane polygons, lane markings, and
     intersection markings
9. Compare the current npm WASM, the latest upstream demo behavior, and the
   local fork output for the same Hamburg bboxes.
10. Test `dual_carriageway_experiment` on divided Hamburg roads before enabling
    it by default.
11. Keep road-fit validation separate. It should validate `RoadDraft` or final
    road-surface polygons against planning/lot/building constraints. It should
    not become a second lane-geometry generator.

## Verification Commands

Run these after changes:

```powershell
cd D:\webcityeditor\prototype
npm install
npm outdated --json
npm run build
npm run test -- src/lib/osm2streets.test.ts src/lib/road-fit.test.ts
npm test
```

Known current full-suite caveat: `npm test` fails if
`prototype/public/fzk-haus.ifc` is absent. That fixture issue is unrelated to
osm2streets. The last known run had all other tests passing.

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
