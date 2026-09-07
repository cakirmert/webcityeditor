# Transportation data and rule provenance

English research report · updated 7 September 2026

## What comes from where?

The existing pipeline is **OSM data serialized as XML → osm2streets → lane/junction polygons → CityJSON → browser edits**. XML is the input serialization, not a separate CityGML conversion step. The default hosted app reads prepared CityJSONSeq tiles; it does not regenerate Hamburg from OSM at startup.

| Stage | Responsibility | Repository evidence |
| --- | --- | --- |
| OSM extract / optional Overpass refresh | Ways, nodes, access, direction, lane and width tags | `src/lib/transportation.ts`, `src/hooks/useRoadEditor.ts`, `public/data/hamburg/` |
| osm2streets | Infer a street network and generate lane/intersection geometry | `vendor/osm2streets/`, browser package `vendor/osm2streets-js/` |
| Conversion and packaging | Project, quantize, attach semantics and provenance, produce viewport tiles | `scripts/osm2streets-lanes-to-cityjson.mjs`, `scripts/build-hamburg-osm2streets-road-catalog.mjs`, `scripts/build-hamburg-road-pages-catalog.mjs` |
| Editing | Preserve exact imported polygons for attribute edits; generate editable ribbons for shape/width changes | `src/lib/transportation.ts`, `src/hooks/useRoadEditor.ts` |

The inspected upstream fork is pinned at `00b484f868f89c2420d25410525faf2414dde3c5`. Its repository origin is recorded in `.gitmodules`. This identifies the code we inspected; it does not establish who the coworker's “British developer” is. If that refers to a separate converter, its rules remain unverified until its source is supplied.

## Is the upstream a configurable city rule engine?

Partly configurable, but **not a municipal design-policy engine**. In the checked-in source:

- `osm2lanes/src/algorithm.rs` combines OSM tags, country/driving-side information and lane inference. Explicit usable widths take precedence over typical widths.
- `osm2lanes/src/lib.rs::typical_lane_widths` contains hard-coded alternatives for different lane types. Its own comments identify a mixture of references and estimates; changing these defaults requires changing the source and rebuilding the package.
- `src/lib/osm2streets-options.ts` exposes processing options such as inferred sidewalks/kerbs and driving-side override. It does not expose independent city-specific minimum/target tables.

Upstream describes the network-generation project in its [official repository](https://github.com/a-b-street/osm2streets). Our local fork additionally contains geometry robustness fixes described in [PROJECT.md](../PROJECT.md#osm2streets-fork-and-wasm). We should not describe its output as code-compliant road design simply because inference succeeded.

The implemented editor policy is separate: `src/lib/road-rules.ts` provides a versioned, validated JSON profile containing minimum/target widths, directional variants and source notes. It is embedded in `_roadLayout.ruleProfile`, can be imported/exported in **Rules**, and governs new bands, edits and fitting. Observed narrow widths can remain with a warning; newly narrowed or newly introduced sub-minimum bands are blocked. Source conversion remains lossless with respect to its geometry rather than silently resizing the OSM-derived city.

## CityJSON versus CityGML

CityJSON 2.0.2 supports `Road`, `Railway`, `Waterway` and `TransportSquare`. `Section`, `Intersection` and `Track` are represented through attributes; `TrafficArea`, `AuxiliaryTrafficArea`, `Marking` and `Hole` are semantic surfaces. A subdivided transportation surface belongs in a `MultiSurface`/`CompositeSurface` with per-face semantics, not invented top-level `Intersection` objects. See the [official transportation specification](https://www.cityjson.org/specs/2.0.2/#transportation).

This implementation writes `Road` objects with `MultiSurface` geometry. Bands retain their type, material, direction and access attributes. Authored intersections remain `Road` objects with an intersection classification and explicit connectivity metadata. `_roadLayout`, `_connectedCityRoadIds`, `_disabledMovements`, `_junctionFootprint` and `_junctionBaseSurfaces` are application attributes, not standard CityGML traffic-space classes. The footprint stores the editable kerb and island rings with a reference note. The last stores untrimmed approach geometry in coordinate values so vertex compaction cannot invalidate it.

Use the editor's road graph as the editing model, the cited transportation vocabulary as the semantic reference, and CityJSON as the supported interchange encoding. CityJSON structural validity alone does not prove lane connectivity, traffic legality, accessibility or ISO 19107 geometric validity. Existing **Structure**, **Check 3D** and export validation remain separate checks.

## What this change adds

One compact inspector; live proportional street preview; explicit intersection movement editing; bounded flat-junction construction; disjoint semantic surfaces and atomic approach trimming; automatic updates for previously constructed junctions; per-city policy profiles and asymmetric extents; and trunk-based conflicts that allow pavement trees. Original exact junction surfaces remain preserved until **Shape → Generate** or a new boundary trace is selected. The [Mattentwiete study](intersection-reference-study.md) demonstrates direct kerb tracing against the existing imagery.
