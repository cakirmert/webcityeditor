# osm2streets Lane Validation Notes

> **Source reviewed**: `C:\Users\dmz-admin\Downloads\lane_validation`
> **Date captured**: 2026-06-25
> **Purpose**: preserve the external lane-validation spike so the method can be repeated or folded into repo scripts later.

## Why This Exists

The validation spike checked that osm2streets can turn OSM XML into the same kind of multi-layer download package exposed by the osm2streets web tool. This is useful because the editor should not treat osm2streets output as a single road/lane file. It is a set of related geometry layers:

- lane polygons
- lane markings
- intersection markings
- plain road/intersection polygons
- import boundary
- copied source OSM XML

These notes complement:

- [`OSM2STREETS_HANDOFF.md`](OSM2STREETS_HANDOFF.md)
- [`OSM2STREETS_FORK_PLAN.md`](OSM2STREETS_FORK_PLAN.md)
- [`OSM2STREETS_STREET_EXPLORER_PARITY_PLAN.md`](OSM2STREETS_STREET_EXPLORER_PARITY_PLAN.md)

## Files In The External Spike

The reviewed folder contained:

- `README.md`
  - Turkish-language spike notes and usage instructions.
  - Records that a Python binding for the Rust lane inference path was built into a local virtual environment.
- `verify_lanes.py`
  - Minimal smoke test for `osm2streets_python`.
  - Reads `a-b-street/osm2streets/tests/src/neukolln/input.osm`.
  - Builds a `PyStreetNetwork`, calls `to_lane_polygons_geojson()`, and prints lane polygon count plus lane types.
- `export_osm2streets_web_package.py`
  - Main reusable export script.
  - Reads OSM XML, creates a `PyStreetNetwork`, and writes web-tool-style GeoJSON layers.
- `test_small_hamburg.py`
  - Wrapper for `osm_data/hamburg_small.osm`.
  - Writes `osm_data/hamburg_small_web_export`.
- `osm2lanes_validation.ipynb`
  - Notebook shell for map visualization and statistics. The inspected notebook currently only contains the title cell.
- `__pycache__/`
  - Local Python bytecode cache. Do not preserve in the repo.

The README also mentions `osm_data/download_osm.py`, `osm_data/hamburg_small.osm`, and `osm_data/hamburg_small_web_export`, but those were not present in the reviewed folder listing.

## Python Binding Options Used

The spike used this osm2streets input option shape:

```json
{
  "debug_each_step": false,
  "dual_carriageway_experiment": false,
  "sidepath_zipping_experiment": false,
  "inferred_sidewalks": true,
  "inferred_kerbs": true,
  "override_driving_side": "Right"
}
```

Notes:

- Germany/Hamburg should use right-hand driving.
- The dual-carriageway and sidepath-zipping experiments were kept off for baseline validation.
- Inferred sidewalks and kerbs were enabled.
- `RUST_LOG` was set to `off` unless `OSM2STREETS_SHOW_LOGS=1`.

## Important Clipping Workaround

The Python binding was called as:

```python
network = osm2streets_python.PyStreetNetwork(
    osm_input,
    "",
    json.dumps(options),
)
```

The empty string for the clipping argument was intentional. The spike notes say this avoided a Rust-side `PolyLine` panic from clipping configuration. If this validation path is promoted into repo scripts, preserve this behavior until clipping is tested with fixtures.

## Web-Tool-Style Export Package

`export_osm2streets_web_package.py` writes the same conceptual package as the osm2streets web tool:

| Output file | Source API | Meaning |
|---|---|---|
| `Boundary.geojson` | local OSM bounds or node min/max | Bbox polygon for the imported area |
| `Lane polygons.geojson` | `to_lane_polygons_geojson()` | One polygon per lane; properties include lane type, road id, lane index, direction, width, allowed turns, and OSM way ids |
| `Lane markings .geojson` | `to_lane_markings_geojson()` | Marking polygons such as lane separators, arrows, hatching, and stop lines |
| `Intersection markings.geojson` | `to_intersection_markings_geojson()` | Sidewalk-corner and crossing marking polygons |
| `Intersection polygons.geojson` | `to_geojson_plain()` | Plain road plus intersection network used by the web UI for intersection polygons |
| `output_*.xml` | copied input file | Raw OSM XML, not lane-network XML |

The script derives `Boundary.geojson` from an OSM `<bounds>` element when present; otherwise it scans node coordinates and computes min/max longitude and latitude.

## What `network_plain` Means

The spike clarified that `network_plain` is not a lane-polygon alternative.

`to_geojson_plain()` returns two main feature types:

- `type = "road"`
  - A whole-road polygon generated from the centerline and total road width.
  - Not split into individual lane polygons.
- `type = "intersection"`
  - One polygon per intersection.
  - Carries intersection-level properties such as kind, control, crossings, movements, and OSM node ids.

For lane-level analysis, use `Lane polygons.geojson`. For intersection surfaces and movement/crossing context, use `Intersection polygons.geojson`.

## Reproduction Commands From The Spike

The external README described this setup:

```bash
source .venv/bin/activate
# Required packages included osm2streets_python plus visualization tools
# such as geopandas, matplotlib, and notebook.
```

Generic export:

```bash
python lane_validation/export_osm2streets_web_package.py \
  osm_data/hamburg_small.osm \
  -o osm_data/hamburg_small_web_export \
  --osm-xml-name output_hamburg_small.xml
```

Small Hamburg wrapper:

```bash
python lane_validation/test_small_hamburg.py
```

Minimal lane smoke test:

```bash
python lane_validation/verify_lanes.py
```

The README also recommends keeping bbox sizes around 1 km by 1 km for large data, because very large OSM files can exceed memory limits.

## Relationship To This Repo

This repo now has a source-built Rust/WASM lane path plus native comparison:

```powershell
cd D:\webcityeditor\prototype
npm run osm2streets:compare
```

The external Python validation is still useful because it documents the web-tool-style layer package and names. The repo comparison currently focuses on committed Hamburg fixtures and native-vs-WASM consistency; the spike focuses on producing the downloadable layer set and explaining what each layer means.

## Follow-Up Work

- Add a repo-owned export command that writes the same layer package from either Python binding, native Rust, or the current WASM/native comparison path.
- Preserve the layer names above so output can be compared directly with the osm2streets web tool.
- Add fixture assertions for:
  - lane polygon count and lane type distribution
  - intersection polygon count from `to_geojson_plain()`
  - lane marking and intersection marking counts
  - raw OSM XML copied separately from generated geometry
- Keep feeding `Lane polygons.geojson` through the delivered metric
  `TrafficAreaPolygonAsset` normalization step and extend its fixture coverage
  when new lane semantics appear.
- Keep `Intersection polygons.geojson` as a support layer for intersection surfaces, movements, and crossing context.
