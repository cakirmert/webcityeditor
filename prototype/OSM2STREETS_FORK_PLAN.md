# osm2streets Fork & Road Editor Improvement Plan

> **Status**: Ready for implementation  
> **Author**: Auto-generated from investigation session (2026-06-08)  
> **Target**: `webcityeditor/prototype` — Vite + React + MapLibre road editor

> **Companion plan**: broader CityGML Transportation, OpenDRIVE/r:trån, and
> `muv-osm` strategy is tracked in
> [`CITYGML_TRANSPORTATION_PLAN.md`](CITYGML_TRANSPORTATION_PLAN.md). Keep this
> file focused on the osm2streets fork, WASM rebuild, crosswalks, dual
> carriageways, and road-editor UI.

---

## 1. Problem Summary

### 1.0 Actual Goal

The goal is **reliable lane-level road geometry**, not "use osm2streets at all
costs." osm2streets is still the first candidate because it already produces
lane polygons, lane markings, intersection polygons, and crosswalk-style
markings from OSM. But if the current WASM path cannot be made stable for our
target data, a narrower TypeScript/JavaScript implementation or a hybrid fallback
is acceptable.

Acceptable implementation outcomes:

1. Patch the Rust/osm2lanes source and compile a local WASM package.
2. Build a TS/JS lane geometry backend that handles the editor's target cases.
3. Use osm2streets when it succeeds and fall back to TS/JS geometry when it
   fails, produces empty output, or floods diagnostics.

The UI and `RoadDraft` model should not care which backend produced the visual
lane geometry.

### 1.1 Console Errors from WASM

The npm package `osm2streets-js@0.1.4` is a precompiled WASM binary. The Rust
source uses `error!()` log macros for **non-fatal** geometry diagnostics:

```
Road #39 got trimmed into oblivion, collapse it later
Can't make intersection geometry for Intersection #123: Road is too short to trim
Hack! intersection_polygon(Intersection #X) called with no roads
osm2lanes broke on something with tags … unsupported: 'sidewalk=both'
```

These are routed to `console.error()` by the `console_log` Rust crate, flooding
the browser DevTools with red lines. They are **not** actual errors — the
geometry engine continues processing after each one.

**Root cause in Rust** (`osm2streets-js/src/lib.rs`):

```rust
console_log::init_with_level(log::Level::Info).expect("error initializing logger");
```

This bridges ALL Rust `log` levels to browser console:
- `error!()` → `console.error()` ← **this is the problem**
- `warn!()` → `console.warn()`
- `info!()` → `console.info()`

No newer npm version exists. The only fix is to modify the Rust source and rebuild the WASM.

### 1.2 Dual Carriageway / "2 Lines for Same Road"

OpenStreetMap represents divided roads (e.g. Ludwig-Erhard-Straße) as two
separate ways — one per direction. osm2streets has a
`dual_carriageway_experiment` option (currently `false`) that merges them.

### 1.3 Missing Crosswalk / Intersection Markings

The osm2streets demo at `a-b-street.github.io/osm2streets` renders crosswalks
and intersection markings. Our code calls `toIntersectionMarkingsGeojson()` but
the results are often empty because:
- Short roads get "trimmed into oblivion" → adjacent intersections lose geometry
- Degenerate intersections produce empty polygons
- The demo uses the **latest Rust source** (not the old 0.1.4 npm WASM)

### 1.4 Lane Editor UI Limitations

Current lane editing is functional but uses small form rows:
```
[car lane ▼] [3.25] [backward ▼] [-]
[car lane ▼] [3.25] [forward  ▼] [-]
```

**Desired**: Bigger visual lane boxes that mirror the on-map rendering, with
drag-to-reorder support.

---

## 2. Architecture: osm2streets as Git Submodule

This section describes the "repair and rebuild" path. It is the preferred first
attempt because it preserves the upstream geometry engine and should produce the
closest result to the osm2streets demo.

### 2.1 Why a Submodule

- Full control over the Rust source (fix errors, improve geometry)
- `wasm-pack build` produces the exact same `osm2streets_js.js` + `.wasm` output
- Easy to pull upstream fixes with `git pull` in the submodule
- Other contributors only need `rustup` + `wasm-pack` to rebuild

### 2.2 Repository Structure After Setup

```
webcityeditor/
├── vendor/
│   └── osm2streets/              ← git submodule (your fork)
│       ├── osm2streets/          ← core Rust library
│       ├── osm2streets-js/       ← WASM binding crate
│       ├── osm2lanes/            ← lane parser (workspace member)
│       ├── streets_reader/       ← OSM XML parser
│       └── Cargo.toml            ← workspace root
├── prototype/
│   ├── vendor/
│   │   └── osm2streets-js/       ← built WASM output (from wasm-pack)
│   ├── scripts/
│   │   └── build-osm2streets-wasm.ps1
│   ├── src/lib/osm2streets.ts    ← import from local vendor
│   └── package.json              ← "osm2streets-js": "file:./vendor/osm2streets-js"
```

---

## 3. Setup Steps (One-Time)

### 3.1 Install Rust Toolchain

```powershell
# Download and install rustup from https://rustup.rs
# Then:
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

### 3.2 Fork & Add Submodule

```powershell
# 1. Fork https://github.com/a-b-street/osm2streets on GitHub
# 2. Add as submodule:
cd d:\webcityeditor
git submodule add https://github.com/<YOUR_USERNAME>/osm2streets.git vendor/osm2streets
git submodule update --init --recursive
```

### 3.3 Create Build Script

Create `prototype/scripts/build-osm2streets-wasm.ps1`:

```powershell
#!/usr/bin/env pwsh
# Build osm2streets WASM from the local fork
$ErrorActionPreference = "Stop"
$outDir = Join-Path $PSScriptRoot ".." "vendor" "osm2streets-js"

Push-Location (Join-Path $PSScriptRoot ".." ".." "vendor" "osm2streets" "osm2streets-js")
wasm-pack build --release --target web --out-dir $outDir
Pop-Location

Write-Host "✓ WASM build complete → prototype/vendor/osm2streets-js/" -ForegroundColor Green
```

### 3.4 Wire Into Package.json

Replace the npm dependency:

```diff
-"osm2streets-js": "^0.1.4",
+"osm2streets-js": "file:./vendor/osm2streets-js",
```

Then `npm install` to update the symlink.

---

## 4. Rust Source Fixes

### 4.1 Change Log Level (Primary Fix)

**File**: `vendor/osm2streets/osm2streets-js/src/lib.rs`

```diff
-console_log::init_with_level(log::Level::Info).expect("error initializing logger");
+console_log::init_with_level(log::Level::Warn).expect("error initializing logger");
```

This silences `info!()` messages (like "Found 6,917 nodes") while keeping
`warn!()` and `error!()` visible.

### 4.2 Downgrade Non-Fatal Errors to Warnings

Search the codebase for these patterns and change `error!` → `warn!`:

```bash
cd vendor/osm2streets
grep -rn 'error!.*trimmed into oblivion' osm2streets/src/
grep -rn 'error!.*Can.t make intersection geometry' osm2streets/src/
grep -rn 'error!.*Hack.*intersection_polygon' osm2streets/src/
grep -rn 'error!.*too short to trim' osm2streets/src/
```

Each matching `error!(...)` should become `warn!(...)`. These are non-fatal
geometry edge cases, not program errors.

### 4.3 Fix osm2lanes Sidewalk Tags (Optional)

The `osm2lanes` crate (now a workspace member at `vendor/osm2streets/osm2lanes/`)
has unsupported sidewalk tag combinations in:
`osm2lanes/src/transform/tags_to_lanes/modes/foot_shoulder.rs:62`

The unsupported patterns are:
- `sidewalk=right` when `sidewalk:left=no, sidewalk:right=separate`
- `sidewalk=both` when `sidewalk:both=separate`
- `sidewalk=both` when `sidewalk:left=yes, sidewalk:right=separate`

Fix: extend the match arms in `foot_shoulder.rs` to handle `separate` as a valid
sidewalk value (treat it like `yes` for lane generation purposes, since
"separate" means the sidewalk exists but is mapped as a separate way).

### 4.4 Rebuild WASM After Fixes

```powershell
cd d:\webcityeditor\prototype
.\scripts\build-osm2streets-wasm.ps1
npm run dev  # test
```

---

## 5. Fallback: TypeScript / JavaScript Geometry Backend

If the forked WASM still cannot handle Hamburg target data reliably, implement a
small local geometry backend with the same output contract as osm2streets:

```typescript
interface LaneGeometryResult {
  lanes: FeatureCollection;
  laneMarkings: FeatureCollection;
  intersectionMarkings: FeatureCollection;
  warnings: Array<{ roadId?: string; message: string; severity: 'info' | 'warn' | 'error' }>;
}
```

Minimum viable TS/JS backend:

1. Consume `RoadDraft` or OSM-inferred lane/band data.
2. Offset the centerline by cumulative band widths to create lane polygons.
3. Emit lane marking lines between adjacent bands.
4. Keep intersections simple at first:
   - trim road polygons near endpoints
   - mark complex intersections as "needs manual correction"
   - preserve the editable road draft instead of failing the whole import
5. Return warnings instead of throwing for unsupported geometry.

This would not be a full osm2streets clone. It only needs to support the editor's
road-editing workflow and produce stable deck.gl preview layers plus CityJSON
Transportation surfaces.

---

## 6. Backend Selection Strategy

Road geometry generation should be wrapped behind one interface:

```text
OSM XML/JSON + RoadDraft
  |
  |-- patched osm2streets WASM backend
  |-- TS/JS fallback backend
  v
LaneGeometryResult + RoadDraft updates
```

Selection logic:

1. Try patched WASM when available.
2. If WASM throws, returns empty critical layers, or exceeds diagnostic
   thresholds, retry with TS/JS fallback.
3. Surface backend warnings in the road editor.
4. Keep insertion/export based on the validated `RoadDraft`, not direct WASM
   internals.

Success criteria:

- Hamburg target bbox renders lane polygons without red console spam.
- Road editor remains usable when a geometry backend hits unsupported tags.
- CityJSON Transportation insertion still works from the same `RoadDraft`.
- Tests can run without requiring a browser-only WASM side effect.

---

## 7. Enable Dual Carriageway Merging

**File**: `prototype/src/lib/osm2streets-options.ts`

```diff
-dual_carriageway_experiment: false,
+dual_carriageway_experiment: true,
```

> **Warning**: This is marked as experimental. Test with Hamburg data first.
> If it causes visual artifacts, revert.

---

## 8. Crosswalk / Intersection Marking Investigation

### 8.1 Why the Demo Works Better

The osm2streets StreetExplorer demo at `a-b-street.github.io/osm2streets` uses
the **latest Rust source** compiled to WASM, not the 0.1.4 npm package. It has
geometry bug fixes that the npm package doesn't.

### 8.2 What We Already Render

Our code (`MapView.tsx:588-603`) already renders intersection markings:

```typescript
if (osm2streetsResult?.intersectionMarkings) {
  layers.push(new GeoJsonLayer({
    id: 'osm2streets-intersection-markings',
    data: osm2streetsResult.intersectionMarkings,
    filled: true, stroked: true,
    getFillColor: [255, 255, 255, 200],  // white crosswalk stripes
    ...
  }));
}
```

### 8.3 Expected Improvement From Fork

Once we build from the latest source:
1. Fewer "trimmed into oblivion" roads → more intersections have geometry
2. Fewer "degenerate intersection" errors → crosswalks can be generated
3. The `toIntersectionMarkingsGeojson()` output will include crosswalk stripes

### 8.4 If Crosswalks Still Don't Appear

Check the GeoJSON output:
```typescript
console.log('Intersection markings:', JSON.stringify(osm2streetsResult.intersectionMarkings, null, 2));
```

The features should contain properties like `type: "crosswalk"` or
`marking_type: "crosswalk"`. If the feature collection is empty, the issue is
upstream in the geometry engine. File an issue on the fork and compare with the
demo's output for the same area.

---

## 9. Lane Editor UI Improvements

### 9.1 Current State

The lane editor (`RoadEditorPanel.tsx`) uses compact form rows:
- `<select>` for lane type
- `<input type="number">` for width
- `<select>` for direction
- `[-]` remove button

### 9.2 Desired: Visual Lane Boxes

Replace the form rows with a **horizontal lane strip** that visually mirrors the
road rendering:

```
┌──────────────────────────────────────────────┐
│ ◄ sidewalk │ ◄ bike │ ◄ car │ car ► │ sw ► │
│   2.0m     │  1.75m │ 3.25m │ 3.25m │ 2.0m │
└──────────────────────────────────────────────┘
```

Each lane box:
- Color-coded to match the map rendering (grey=sidewalk, green=bike, dark=car)
- Shows direction arrow (◄ backward, ► forward, ◄► both)
- Draggable left/right to reorder (HTML5 drag-and-drop or a library like `dnd-kit`)
- Click to select → shows detail panel below (type, direction, allowed modes)
- Fixed width proportional to lane width in metres

### 9.3 Lane Width Standards

Lane widths **are** largely standardised, so the user's instinct is correct:

| Lane Type   | Standard Width (DE) | Range     | Editable? |
|------------|-------------------|-----------|-----------|
| Car lane   | 3.25m             | 2.75–3.75m | Optional  |
| Bike lane  | 1.75m (≥1.5m min) | 1.5–2.5m  | Optional  |
| Sidewalk   | 2.0m              | 1.5–3.0m  | Optional  |
| Parking    | 2.1m              | 2.0–2.5m  | Optional  |
| Median     | 1.0m              | 0.5–3.0m  | Yes       |
| Green/verge| 1.0m              | 0.5–5.0m  | Yes       |

**Recommendation**: Keep the width input but **hide it by default**. Show the
standard width as a label. Only expose the numeric input in an "advanced" or
"custom width" toggle. This simplifies the UI for 90% of cases.

### 9.4 Implementation Approach

1. Create a new `LaneStrip` component with horizontal colored boxes
2. Use `dnd-kit` (already used in many React projects) for drag-to-reorder
3. Keep the existing `addBand()` / `removeBand()` / `updateBand()` logic
4. Map lane type → color using the same palette as `MapView.tsx:537-565`

### 9.5 Hide Rarely-Used Actions

"Insert CityJSON Road", "Export payload", "POST payload", and the backend
endpoint input are **power-user / integration features** that clutter the main
editing flow. Move them behind a collapsible `<details>` disclosure:

```
▸ CityJSON Export & Backend        ← collapsed by default
  ┌─────────────────────────────┐
  │ [Insert CityJSON Road]      │
  │ [Export payload]             │
  │ Backend: [http://...]       │
  │ [POST payload]              │
  │ ▸ Payload preview           │
  └─────────────────────────────┘
```

This keeps the primary lane editing area clean and focused. The main panel
should show: lane strip visualization, add lane buttons, and speed limit — 
everything else goes into the collapsible section.

---

## 10. Future: Traffic Signs, Trees, Street Furniture

### 10.1 What osm2streets Provides

osm2streets focuses on **lane geometry and intersection polygons**. It does NOT
generate:
- Traffic signs
- Trees
- Street furniture (benches, bollards, lamp posts)
- Traffic lights (geometry)

### 10.2 Data Sources for Street Furniture

| Feature       | OSM Tag           | Approach                          |
|--------------|-------------------|-----------------------------------|
| Traffic signs | `traffic_sign=*`  | Query Overpass, place as icons    |
| Trees         | `natural=tree`    | Query Overpass, place as 3D models|
| Street lights | `highway=street_lamp` | Query Overpass, place as models |
| Traffic lights| `highway=traffic_signals` | Already in OSM node data |
| Bollards      | `barrier=bollard` | Query Overpass                    |

### 10.3 Implementation Strategy

1. Extend the Overpass query in `useRoadEditor.ts` to also fetch `node` types
   with relevant tags (currently only fetches `way[highway]`)
2. Add a new deck.gl `IconLayer` or `ScenegraphLayer` for point features
3. For 3D trees: use `ScenegraphLayer` with a simple tree GLB model
4. For signs: use `IconLayer` with SVG/PNG traffic sign sprites

This is independent of the osm2streets fork and can be done in parallel.

---

## 11. Verification Checklist

After completing the fork setup:

- [ ] `wasm-pack build --release --target web` succeeds in `vendor/osm2streets/osm2streets-js`
- [ ] `npm install` resolves `osm2streets-js` from `file:./vendor/osm2streets-js`
- [ ] `npm run dev` starts without errors
- [ ] Browser console shows **zero red `console.error` lines** from osm2streets
- [ ] Lane geometry renders correctly on the map (Hamburg area)
- [ ] TS/JS fallback produces lane polygons for simple Hamburg road sections if
      patched WASM fails
- [ ] Intersection markings / crosswalks appear at intersections
- [ ] Dual carriageway merging works (if enabled)
- [ ] Lane editor UI shows visual lane boxes (after UI improvement)
- [ ] Lanes can be dragged to reorder

---

## 12. File Change Summary

| Action  | File | Description |
|---------|------|-------------|
| NEW     | `vendor/osm2streets/` | Git submodule (fork of a-b-street/osm2streets) |
| NEW     | `prototype/scripts/build-osm2streets-wasm.ps1` | WASM build script |
| NEW     | `prototype/vendor/osm2streets-js/` | Built WASM output directory |
| MODIFY  | `prototype/package.json` | Change osm2streets-js to `file:` dependency |
| MODIFY  | `prototype/src/lib/osm2streets-options.ts` | Enable dual carriageway experiment |
| MODIFY  | `prototype/src/lib/osm2streets.ts` | Already switched to classic parser |
| NEW     | `prototype/src/lib/lane-geometry.ts` | Optional TS/JS fallback geometry backend |
| NEW     | `prototype/src/lib/lane-geometry.test.ts` | Unit tests for fallback lane polygons and warnings |
| MODIFY  | `prototype/src/components/RoadEditorPanel.tsx` | Visual lane strip UI + hide export actions behind collapsible |
| NEW     | `prototype/src/components/LaneStrip.tsx` | New draggable lane visualization |
| MODIFY  | `vendor/osm2streets/osm2streets-js/src/lib.rs` | Change log level |
| MODIFY  | `vendor/osm2streets/osm2streets/src/` | Downgrade error! → warn! |
| MODIFY  | `vendor/osm2streets/osm2lanes/src/.../foot_shoulder.rs` | Fix sidewalk tags |
