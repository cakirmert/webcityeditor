# Upstream software and attribution

Technical reference · source and dependency review, 11 September 2026

WebCityEditor combines an editor maintained in this repository with external data formats, rendering libraries and road-inference software. The two principal upstream contributions are the **CityJSON/TU Delft ecosystem** for city-model exchange, viewing and validation, and **A/B Street's osm2streets ecosystem** for reconstructing roads from OSM. They supply different parts of the system.

This document identifies executable dependencies separately from data samples, specifications and tools considered for future integration. The complete JavaScript dependency list is in [package.json](../package.json) and [package-lock.json](../package-lock.json); the road engine's resolved Rust dependencies are in its [pinned Cargo.lock](https://github.com/cakirmert/osm2streets/blob/00b484f868f89c2420d25410525faf2414dde3c5/Cargo.lock).

## Dependency map

| Component | Use in this repository | Execution or delivery |
| --- | --- | --- |
| CityJSON 2.0 and CityJSONSeq | Object types, indexed geometry, semantics, transforms and feature-sequence encoding. | Format contracts implemented by the editor and preparation scripts; a format is not a runtime library. |
| `cityjson-threejs-loader` | `CityJSONParser` and `CityJSONLoader` in the close-up object viewer. | Browser dependency, pinned to a Git commit. |
| `osm2streets`, including `osm2lanes` and `streets_reader` | Interpret OSM tags, infer missing lane properties, construct a street network and emit lane/junction geometry. | Pinned Rust fork, built as a native exporter and a browser WebAssembly package. |
| A/B Street `geom`, `osm-reader`, `abstutil` | Geometry types/operations, OSM reading, and utilities used by that Rust engine. | Transitive compiled dependencies; the A/B Street traffic simulator is not embedded. |
| Muv OSM crates | OSM lane/tag interpretation used inside `osm2lanes` and `streets_reader`. | Transitive Rust dependencies from a separate upstream project. |
| `country-boundaries` | Determine the import area's country from bundled boundaries. | Rust dependency with Apache-2.0 code and separately licensed OSM-derived boundary data. |
| `val3dity` | Optional 3D primitive checks for prepared tiles and exact export bytes. | Separately installed executable, called by the local catalog service/scripts. |
| `cjval` | Optional CityJSON/CityJSONSeq schema and consistency validation. | Separately supplied CLI through `--cjval`; not a browser dependency. |
| `citygml-tools` | Official Hamburg CityGML-to-CityJSONSeq preparation and CityJSON-to-CityGML export. | Separately installed CLI from the **citygml4j** project. |
| Delft/3DBAG sample files | Example CityJSON inputs available from the data loader. | Downloaded only when chosen; not the Hamburg building source. |

The [CityJSON specification](https://www.cityjson.org/specs/2.0.2/) and [CityJSONSeq specification](https://www.cityjson.org/cityjsonseq/) define the exchange structures. WebCityEditor's catalog index, viewport selection, eviction, draft retention and project revision API are additional application behavior; they are not features supplied by the file format.

## CityJSON and TU Delft contributions

### Close-up rendering

The loader is pinned to [`cf8db910b464fe3b4eb1a80d59cfc2de6fee1a7d`](https://github.com/cityjson/cityjson-threejs-loader/tree/cf8db910b464fe3b4eb1a80d59cfc2de6fee1a7d), whose package version is `0.4.0`. Its manifest names Stelios Vitalis as author, and its license file identifies Delft University of Technology. Credit this particular package and its contributors rather than describing all editor code as a TU Delft library. [Pinned manifest](https://github.com/cityjson/cityjson-threejs-loader/blob/cf8db910b464fe3b4eb1a80d59cfc2de6fee1a7d/package.json), [pinned license](https://github.com/cityjson/cityjson-threejs-loader/blob/cf8db910b464fe3b4eb1a80d59cfc2de6fee1a7d/LICENSE).

[Viewer.tsx](../src/components/Viewer.tsx) creates the parser/loader and displays its meshes in a Three.js scene. The editor supplies selection handling, camera fitting, color controls, LoD filtering, split previews and TypeScript declarations. The main map instead uses MapLibre/deck.gl and the editor's [CityJSON mesh builder](../src/lib/cityjson-map-mesh.ts).

Textured Solids have an additional path: the close-up viewer can use that same editor mesh builder to preserve shell-level texture indices. The pinned upstream loader's texture path assumes flatter surface indexing. This adaptation is important when updating the loader or Three.js; a model rendering successfully without textures does not test the textured-Solid path.

### Validation

[`val3dity`](https://github.com/tudelft3d/val3dity) is the TU Delft 3D geoinformation project's primitive-geometry validator. It checks linear 3D primitives, including surfaces and solids. WebCityEditor invokes it through [hamburg-lod2.mjs](../scripts/hamburg-lod2.mjs), with the application service using the `--ignore204` profile. A result must retain that profile and the executable version in its interpretation. It does not establish that lane movements or design widths are correct.

[`cjval`](https://github.com/cityjson/cjval) checks the CityJSON schema and additional format consistency. It is optional in the preparation and write-back commands. Without `--cjval`, the scripts' structural checks must not be reported as a full `cjval` validation run. [export-validation.ts](../src/lib/export-validation.ts) distinguishes the reported schema and primitive checks.

Neither executable is included in the hosted GitHub Pages application. The browser calls the configured local service for **Check 3D**; the static website alone cannot run the native validator. The prepared catalog can also carry earlier validation results, which describe the audited source revision rather than new unsaved edits.

### Sample data

[FileLoader.tsx](../src/components/FileLoader.tsx) offers two TU Delft-hosted sample URLs:

- **3DBAG – Delft tile:** a CityJSON building sample, `9-284-556.city.json`.
- **twocube:** a small CityJSON geometry example.

The 3DBAG dataset is produced by the TU Delft 3D geoinformation group and 3DGI; its data and documentation have their own CC BY 4.0 terms. The prescribed map credit is **© 3DBAG by tudelft3d and 3DGI**, linked to the [3DBAG copyright page](https://docs.3dbag.nl/en/copyright/). Adapted data must identify changes. Software licenses do not replace these data obligations.

The built-in demo cube in [cityjson.ts](../src/lib/cityjson.ts) is generated by this repository and placed near the Delft campus. Its location does not make it a measured TU Delft dataset. Likewise, Hamburg's official building tiles come from Hamburg's publisher, not 3DBAG.

## A/B Street and osm2streets contributions

### Engine responsibilities

`osm2streets` originated in A/B Street and supplies a lane-oriented street network with road/intersection geometry and GeoJSON outputs. Its source is published independently of the A/B Street application. [Upstream repository](https://github.com/a-b-street/osm2streets).

WebCityEditor's [submodule](../.gitmodules) uses the [`cakirmert/osm2streets` fork at `00b484f868f89c2420d25410525faf2414dde3c5`](https://github.com/cakirmert/osm2streets/tree/00b484f868f89c2420d25410525faf2414dde3c5). The principal modules are:

| Module | Responsibility before CityJSON conversion |
| --- | --- |
| `streets_reader` | Read OSM XML/PBF, interpret mapped ways and build the initial street network. |
| `osm2lanes` | Derive lane order, types, directions, access and widths from tags and fallback values. Uses Muv's OSM types/parser. |
| `osm2streets` | Network transformations, centrelines, lane/intersection geometry and marking outputs. |
| `osm2streets-js` | WebAssembly bindings around the network, and the fork's native export binary. |

The compiled browser package is stored in [vendor/osm2streets-js](../vendor/osm2streets-js). [osm2streets.ts](../src/lib/osm2streets.ts) initializes that WebAssembly module, constructs `JsStreetNetwork`, extracts GeoJSON/optional network JSON and releases the native object. It also collects warning/error diagnostics.

The normal map loads already prepared road tiles. The engine runs during offline preparation or an explicit project-wide OSM reset; it does not regenerate the network whenever an intersection is selected. The [OSM-to-CityJSON guide](osm-to-cityjson.md) documents both native output files and the browser path.

### Fork changes

The local fork adds four commits after `fc119c4` in its history:

| Commit | Changes maintained for this project |
| --- | --- |
| [`b3d0b08`](https://github.com/cakirmert/osm2streets/commit/b3d0b08) | Diagnostic visibility and handling of Hamburg sidewalk tags. |
| [`31037a8`](https://github.com/cakirmert/osm2streets/commit/31037a8) | Native export binary for comparable lane/network output and diagnostics. |
| [`5eb60ba`](https://github.com/cakirmert/osm2streets/commit/5eb60ba) | Degenerate intersection geometry handling. |
| [`00b484f`](https://github.com/cakirmert/osm2streets/commit/00b484f) | Further safeguards for degenerate roads, trimming and geometry export. |

These are targeted changes to the upstream engine. The engine's baseline inference and geometry algorithms remain upstream work. The JavaScript CityJSON converter, editor junction regeneration and design-rule profile are maintained in this repository.

Native and browser builds are separate artifacts. Updating the submodule or rebuilding the native exporter does not update the checked-in `.wasm` automatically. A release must record the source revision and rebuild/check both paths when engine behavior changes.

### Transitive road-engine dependencies

The source lockfile pins the following Git dependencies; these are useful when reproducing geometry or assembling redistribution notices:

| Project | Locked revision | Role |
| --- | --- | --- |
| [A/B Street / `abstutil`](https://github.com/a-b-street/abstreet/tree/ca1fb9a39627c99040e29a598286e326b67081ad/abstutil) | `ca1fb9a39627c99040e29a598286e326b67081ad` | Tags, timing and utility code. |
| [A/B Street / `geom`](https://github.com/a-b-street/geom/tree/9bb49fce2be2c527405a821ffd22c63869416976) | `9bb49fce2be2c527405a821ffd22c63869416976` | Geometric primitives and operations. |
| [A/B Street / `osm-reader`](https://github.com/a-b-street/osm-reader/tree/789240588e3401262123aa419f6d82790bc1e4e7) | `789240588e3401262123aa419f6d82790bc1e4e7` | OSM document parsing. |
| [Muv](https://gitlab.com/LeLuxNet/Muv/-/tree/2404d40be602ffe7f61720d8a7f31a10e2c8ae25) | `2404d40be602ffe7f61720d8a7f31a10e2c8ae25` | `muv-osm`, `muv-geo`, `muv-id` and the derive macro crate. |

The workspace has further crates.io dependencies recorded in `Cargo.lock`. The [WebAssembly notices](../packaging/wasm-notices.md) inventory the resolved non-development dependency closure, including compile-time tools. A source URL containing `abstreet` identifies the repository of a utility crate; it does not mean the editor runs A/B Street traffic simulation, routing, demand models or scenario evaluation.

## Features maintained by WebCityEditor

| Application responsibility | Main code |
| --- | --- |
| OSM output → CityJSON projection, semantics and provenance attributes | [Shared converter](../src/lib/osm2streets-network-converter.js) |
| CityJSONSeq catalogs, viewport filtering, merging and tile lifecycle | [Catalog module](../src/lib/cityjsonseq-catalog.ts), [catalog hook](../src/hooks/useCatalog.ts) |
| Editable road sections, independent bands, centrelines and endpoint metadata | [Transportation model](../src/lib/transportation.ts) |
| Manual junction generation, approach trimming, explicit scope and saved movement state | [Road junctions](../src/lib/road-junctions.ts), [ownership](../src/lib/junction-ownership.ts), [clusters](../src/lib/junction-clusters.ts) |
| Hamburg width-profile checks, fit checks and accepted-warning records | [Rules](../src/lib/road-rules.ts), [fit checks](../src/lib/road-fit.ts), [review metadata](../src/lib/road-fit-review.ts) |
| Inspector UI, drafts, undo and direct selection switching | [Road editor hook](../src/hooks/useRoadEditor.ts), [components](../src/components) |
| Browser saves and optional shared project revisions | [Storage](../src/lib/storage.ts), [backend](../backend/README.md) |

These modules use other open-source libraries, such as polygon clipping and rendering utilities. “Maintained by WebCityEditor” identifies the application's orchestration and behavior, not ownership of every underlying mathematical operation.

## Tools and ideas that are not integrated

- **`cjio` and `cjseq`:** ecosystem utilities, not dependencies invoked by the current pipeline. The editor has its own sequence parsing/serialization and CLI adapter.
- **`cjdb` and `3DCityDB`:** database candidates described in [Streaming and storage](streaming-and-storage.md#database-options). Neither runs behind the current project API.
- **Godot Road Generator:** assessed in [Godot integration](godot-integration.md); no Godot runtime or importer is part of the editor.
- **PTV Vissim and SUMO:** reference workflows used in the [road UX study](road-ux-research.md), not embedded editors or simulation engines.
- **r:trån:** an experimental OpenDRIVE command plan exists in [opendrive-rtron.mjs](../scripts/opendrive-rtron.mjs). It is a separate TUM-GIS project and remains a scaffold, not a verified alternative road-import pipeline.
- **`citygml-tools`:** an actual optional conversion dependency, but supplied by [citygml4j](https://github.com/citygml4j/citygml-tools), not TU Delft or A/B Street.

## Licenses and package redistribution

Attribution follows the shipped component, its version and its actual license files. The application package's license cannot replace third-party terms.

| Component | License evidence | Packaging implication |
| --- | --- | --- |
| osm2streets fork | [Apache-2.0 license](https://github.com/cakirmert/osm2streets/blob/00b484f868f89c2420d25410525faf2414dde3c5/LICENSE) | Include the license and relevant notices with redistributed JS/WASM; identify fork modifications. |
| A/B Street Git dependencies above | Repository-root Apache-2.0 texts; some Cargo manifests omit license metadata. | Inspect the source root when an automated manifest scan reports an unknown license. |
| Muv crates above | Their pinned Cargo manifests specify MPL-2.0; source root supplies `LICENSE.mpl-2.0.md`. | Preserve notices/license and provide the corresponding covered source location for executable distribution. This includes the compiled WebAssembly dependency chain. |
| `forestrie-builder` 0.3.1 | MPL-2.0 in the published manifest; dependency of the Muv derive macro. | Its source archive and MPL text are retained/referenced in the WebAssembly notices as compile-time tooling. |
| CityJSON Three.js loader | Pinned `LICENSE` is Apache-2.0, while `package.json` says MIT. | Preserve the actual license and Delft notice, record the mismatch, and resolve it with upstream before treating the package as MIT-only. |
| `cjval` | [MIT license](https://github.com/cityjson/cjval/blob/main/LICENSE) | Separately installed; include its notices if an installer later distributes it. |
| `val3dity` | [GPL version 3 license](https://github.com/tudelft3d/val3dity/blob/master/LICENSE) | Separately installed CLI; bundling the executable or linking its code requires a separate redistribution review. |
| `citygml-tools` | [Apache-2.0 license](https://github.com/citygml4j/citygml-tools/blob/master/LICENSE) | Separately installed CLI; preserve its license and dependency notices if distributed. |

Apache-2.0 section 4 sets the license/notice and modified-file requirements. MPL-2.0 sections 3.1–3.3 distinguish covered source, executable distribution and larger works. An MPL dependency must not disappear from the notices merely because the top-level road engine uses Apache-2.0. [Apache license](https://www.apache.org/licenses/LICENSE-2.0), [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).

For a reproducible package, collect notices from the **actual bundled JavaScript modules** and the **resolved Rust dependency graph for the WebAssembly target**. Include source revisions and retained copyright notices, not just a list of package names. Development-only test tools should be distinguished from shipped runtime code. `cargo metadata --locked --filter-platform wasm32-unknown-unknown --format-version 1 --manifest-path vendor/osm2streets/Cargo.toml` exposes the Rust graph; the package rooted at `osm2streets-js` determines the relevant dependency closure.

Source data needs separate attribution. In particular, `streets_reader` uses `BOUNDARIES_ODBL_60X30` from `country-boundaries`; those bundled boundary bytes are OSM-derived and use ODbL even though the crate's code uses Apache-2.0. The [retained notice and source archive](../packaging/wasm-notices.md#embedded-openstreetmap-country-boundary-data) distinguish them. OSM-derived road geometry, Hamburg data, 3DBAG samples and imagery also retain their publisher's terms. An npm package should not silently include a city dataset or imagery merely because those files are used by the demo website.

## Maintaining the boundary

When replacing an upstream version, retain a small input/output fixture and record which stage changed. A useful comparison includes lane widths/order, connected road IDs, intersection surfaces, source IDs, diagnostic output and CityJSON round-trip metadata. Run the native and WebAssembly comparison paths where the engine changes; run textured and untextured viewer cases where the loader changes.

The [transportation provenance reference](transportation-provenance.md) explains the distinction between mapped facts, inferred geometry and authored changes. Keep that distinction intact: an engine fallback is not a municipal design requirement, and a rendering improvement is not a new surveyed observation.
