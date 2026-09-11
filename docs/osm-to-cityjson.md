# Building roads from OSM

Reproducible conversion guide · verified 11 September 2026

The road preparation pipeline reads **OSM XML or PBF**, constructs a lane-level network with **osm2streets**, then converts lane and junction polygons to **CityJSON**. XML here means OpenStreetMap XML, not CityGML. This guide covers running the pipeline, inspecting its intermediate files and packaging the result for viewport loading.

The website already contains a prepared Hamburg catalog. Using the editor requires neither Rust nor a fresh OSM download. [Transportation provenance](transportation-provenance.md) explains the inferred values and semantic mapping; [Streaming and storage](streaming-and-storage.md) explains the runtime architecture.

## Prerequisites

Run commands from the repository root. The examples use PowerShell; the single-line Node and Cargo commands also work in ordinary Unix shells.

- Node.js 24 and installed frontend dependencies (`npm ci`).
- Rust/Cargo and the platform's native compiler/linker. Windows Rust builds require the matching Visual C++ build tools.
- The pinned `vendor/osm2streets` submodule. `git submodule update --init --recursive` initializes it; its configured remote uses GitHub SSH.

Build the native exporter:

```powershell
cargo build --release --manifest-path vendor/osm2streets/Cargo.toml -p osm2streets-js --bin webcityeditor_native_export
```

The executable is `vendor/osm2streets/target/release/webcityeditor_native_export.exe` on Windows and the same path without `.exe` on Linux/macOS. If Cargo is configured to use another target directory, pass the resulting path through the wrapper's `--exporter` option. The browser's committed WebAssembly package is a separate build.

## Convert the committed Hamburg example

This example uses the repository's centre extract and writes into an ignored temporary directory. It does not replace the public catalog.

```powershell
node scripts/build-hamburg-osm2streets-roads.mjs --osm public/data/hamburg/hamburg-city-center-roads.osm --output-dir .tmp/osm-cityjson-guide/output --work-dir .tmp/osm-cityjson-guide/native --output .tmp/osm-cityjson-guide/roads.city.json --bbox 9.978,53.5395,10.0035,53.5545 --grid 1 --min-depth 0 --max-depth 0 --generated-at 2026-09-11T00:00:00.000Z --source "Committed Hamburg centre OSM extract"
```

`--bbox` is **west,south,east,north in longitude/latitude degrees**. It is not a UTM bounding box. With grid 1 and both depths 0, the wrapper processes one crop and names it `hh-road-r00-c00`. Sequence-structure validation is enabled by default.

The verified run at fork revision `00b484f868f89c2420d25410525faf2414dde3c5` produced:

| Result | Count |
| --- | ---: |
| Road objects excluding intersections | 1,608 |
| Intersection objects | 1,042 |
| Total CityObjects / CityJSONFeatures | 2,650 |
| Surfaces | 7,597 |
| Vertices | 38,096 |
| Failed build tiles | 0 |
| Native diagnostics | 539 warnings; 0 errors |

The warnings are retained in the native diagnostics file. A successful conversion does not mean every inferred street or turn is correct. These are results for the committed extract, not expected counts for a newer OSM download.

Open `roads.city.json` through **Data** to inspect the result in the editor. Its road geometry is initially flat and uses `EPSG:25832`.

## Files produced at each stage

```text
.tmp/osm-cityjson-guide/
  native/hh-road-r00-c00/
    lane-polygons.geojson
    lane-markings.geojson
    intersection-markings.geojson
    network.json
    diagnostics.json
    summary.json
    native-export.log
    cityjson-convert.log
    cityjsonseq-validate.log
  output/
    hh-road-r00-c00.city.json
    hh-road-r00-c00.city.jsonl
    hamburg-osm2streets-roads-summary.json
    catalog.json
  roads.city.json
```

| File | Purpose |
| --- | --- |
| `lane-polygons.geojson` | Generated lane polygons in longitude/latitude with road, lane type, direction and source properties. |
| `network.json` | Serialized network: roads, junction polygons, centrelines, endpoint identities, movements and coordinate bounds. Required for the complete road-and-junction conversion. |
| `lane-markings.geojson`, `intersection-markings.geojson` | Native visualization outputs. The CityJSON adapter does **not** import these files; the browser's road markings come from its own rendering logic. |
| `diagnostics.json`, native `summary.json` | Captured warnings/errors and native output counts. |
| `*.city.json` | One CityJSON document with a document-wide vertex array. |
| `*.city.jsonl` | CityJSONSeq header followed by independent `CityJSONFeature` records, each with local vertex indices. |
| Build summary | Source/executable hashes, fork revision, crop, build settings, successful/empty/failed tiles and totals. |
| `catalog.json` | Tile metadata used by the catalog server or the subsequent static packager. |

`roads.city.json` is a convenience copy of the single generated document. The wrapper only accepts `--output` when there is exactly one successful tile, and not with `--seq-only`.

## Run the CityJSON adapter independently

When native output already exists, geometry conversion can be repeated without rerunning Rust:

```powershell
node scripts/osm2streets-lanes-to-cityjson.mjs --lanes .tmp/osm-cityjson-guide/native/hh-road-r00-c00/lane-polygons.geojson --network .tmp/osm-cityjson-guide/native/hh-road-r00-c00/network.json --output .tmp/osm-cityjson-guide/reconverted.city.json --seq-output .tmp/osm-cityjson-guide/reconverted.city.jsonl --id-prefix hh-road-r00-c00- --generated-at 2026-09-11T00:00:00.000Z --source "Committed Hamburg centre OSM extract"
```

The equivalent npm entry point is `npm run osm2streets:cityjson --` followed by the same arguments.

| Adapter option | Meaning |
| --- | --- |
| `--lanes` | Required path to the lane FeatureCollection. This script does not read OSM XML directly. |
| `--network` | Network snapshot for junctions, source metadata and connections. Omitting it produces an incomplete lane-only model. |
| `--output` | Required CityJSON path, including when `--seq-only` suppresses writing it. |
| `--seq-output` | Optional CityJSONSeq path; required with `--seq-only`. |
| `--seq-only` | Write only the sequence file. The current converter still assembles the crop in memory. |
| `--id-prefix` | Distinguish IDs from independently converted extracts. The batch wrapper uses the tile ID plus a hyphen. |
| `--source` | Dataset label stored in document metadata. |
| `--generated-at` | Explicit conversion timestamp; defaults to the current time. |

The core implementation is [osm2streets-network-converter.js](../src/lib/osm2streets-network-converter.js). It normalizes rings, projects to `EPSG:25832`, quantizes coordinates to 0.001 m and writes Road/MultiSurface objects. It does not apply the editor's Hamburg width profile or infer surveyed elevations.

## Import options

The native exporter accepts `--osm`, `--clip-geojson`, `--options-json` and `--out-dir`. The clip and options arguments contain JSON text, not filenames. The wrapper constructs these arguments to avoid shell quoting mistakes.

The wrapper currently passes this fixed option object, matching the [browser import defaults](../src/lib/osm2streets-options.ts):

```json
{
  "debug_each_step": false,
  "dual_carriageway_experiment": false,
  "sidepath_zipping_experiment": false,
  "inferred_sidewalks": true,
  "inferred_kerbs": true,
  "date_time": null,
  "override_driving_side": ""
}
```

Inferred sidewalks and kerbs can add geometry without explicit mapped widths. The two experimental transformations are disabled. An empty driving-side override leaves upstream location-based selection in place; explicit values are `Left` or `Right`. These are inference options, not city-specific regulatory thresholds. The wrapper does not expose an arbitrary `--options-json` override; alternative options require a direct exporter call or an intentional wrapper change.

## Larger datasets and static packaging

`--osm` also accepts a local `.osm.pbf` extract. `--grid` controls initial subdivision; `--min-depth` forces further subdivision; `--max-depth` limits retries after a failed or oversized crop. `--max-lane-geojson-mb` defaults to 384. Crops still too large or unsuccessful at maximum depth appear in the build summary, and the wrapper exits with code 2. Inspect `failed`, not only the presence of output files.

For a small static catalog from the verified example:

```powershell
node scripts/build-hamburg-road-pages-catalog.mjs --input-dir .tmp/osm-cityjson-guide/output --output-dir .tmp/osm-cityjson-guide/pages --generated-at 2026-09-11T00:00:00.000Z
```

This creates `catalog.json` plus `tiles/*.city.jsonl.gz`. The packager requires a complete source catalog, assigns features to 1 km cells by extent centroid, preserves whole features and records seam dependencies. The resulting static URLs are relative and suitable for a subpath such as GitHub Pages. The pre-packaging catalog instead targets the local catalog service's `/tiles/` routes.

The full-city helper is `npm run data:hamburg-roads:prepare`; `-- --dry-run` prints its plan. It can download Hamburg PBF, build Rust and generate a large local catalog. It checks disk capacity and reuses a complete catalog unless rebuilding is requested. [PROJECT.md](../PROJECT.md#whole-city-pages-road-stream) documents full-city preparation and publication.

Use separate output/work directories for separate experiments. The wrapper overwrites its generated tile files and rebuilds each tile's work directory; `--clean` additionally removes the designated output and work directories. `--reuse-work` skips native generation and requires matching retained intermediate files. `--discard-work` removes successful intermediates and cannot be combined with reuse.

## Validation and reproducibility

Recheck the sequence explicitly:

```powershell
node scripts/hamburg-lod2.mjs validate --input .tmp/osm-cityjson-guide/output/hh-road-r00-c00.city.jsonl
```

Despite its filename, this validator also handles road sequences. Its default check covers sequence structure, transforms, feature references and finite coordinates. It is **not** a val3dity run or a full traffic/design check. A separately installed `cjval` can be supplied via `--cjval <executable>` for schema validation. `geometry-audit` and the editor's **Check 3D** use separately configured val3dity; their results and validator options should be recorded separately.

To reproduce a result, retain the OSM file and its SHA-256, source revision, native executable hash, Node/Rust versions, crop, import options, build flags, timestamp and logs. The summary records many of these automatically; the option object is defined by the pinned source. The verified centre extract has SHA-256 `f28572dcf5d7f35e54484424c9352c5f4f0a66f40e8e7a37c8d35770128aa727`. Executable hashes vary with platform and toolchain.

| Symptom | Diagnostic step |
| --- | --- |
| Missing native exporter | Build the named Rust binary; check `--exporter` if Cargo uses another target directory. |
| Roads present, intersections absent | Supply the matching `network.json`; inspect whether the crop contains eligible non-MapEdge junctions. |
| Unexpected lane width or arrow | Inspect OSM tags, native lane properties and diagnostics before changing the CityJSON adapter. |
| Some build tiles fail | Read the summary's failed entries and stage-specific logs; reduce crop size or repair the native input/geometry issue. |
| Coordinates appear in the wrong place | Check longitude/latitude input order and the fixed `EPSG:25832` output, rather than assigning a different CRS label. |
| Static tile URLs fail | Serve the output of the Pages packager; the intermediate catalog has local-service routes. |

## Browser conversion and source replacement

The browser uses the compiled osm2streets WebAssembly package plus the shared JavaScript converter when preparing an explicit project OSM reset. This provides the same representation, without requiring Rust on a user's device. Native builds and browser package revisions still need to be kept in sync during development.

Normal startup streams prepared CityJSONSeq. **Projects → Reset project roads from OSM** is a separately reviewed replacement of the project's Road objects, including edited lanes and junctions. It is not an incremental background update and does not run when a road is selected.
