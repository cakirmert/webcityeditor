# Transportation data and rule provenance

Technical reference · checked against the repository and external sources on 11 September 2026

The road model combines mapped observations, inferred geometry and authored changes. These have different origins and levels of certainty. This document describes those boundaries, the CityJSON representation and the source of the editor's width checks.

For executable commands, see [Building roads from OSM](osm-to-cityjson.md). For delivery to the browser and database choices, see [Streaming and storage](streaming-and-storage.md). For geometry editing and Hamburg design references, see [Road connections, intersections and width policy](road-ux-research.md).

## Data flow and responsibilities

```mermaid
flowchart LR
    A["OSM extract: XML or PBF"] --> B["osm2streets: infer lanes and construct network"]
    B --> C["Lane polygons + network.json"]
    C --> D["CityJSON: coordinates, surfaces, metadata"]
    D --> E["CityJSONSeq catalog and gzip tiles"]
    E --> F["Browser: selected roads and intersections"]
    F --> G["Authored CityJSON project"]
```

**XML is an OSM input encoding.** There is no intermediate CityGML XML stage in this road pipeline. The native reader accepts both OSM XML and binary PBF. The hosted application normally starts from prepared CityJSONSeq tiles. Conversion runs during data preparation, or through the WebAssembly build during an explicit project road reset.

| Stage | Responsibility | Implementation |
| --- | --- | --- |
| OSM extract | Nodes, ways, relations and tags describing the mapped network. A committed centre extract provides a reproducible small input. | [Centre OSM file](../public/data/hamburg/hamburg-city-center-roads.osm), [project reset](../src/lib/project-osm-reset.ts) |
| Lane inference | Interpret lane, width, direction and access tags; supply missing values using upstream defaults. | [osm2lanes algorithm](https://github.com/cakirmert/osm2streets/blob/00b484f868f89c2420d25410525faf2414dde3c5/osm2lanes/src/algorithm.rs), [typical widths](https://github.com/cakirmert/osm2streets/blob/00b484f868f89c2420d25410525faf2414dde3c5/osm2lanes/src/lib.rs) |
| Network geometry | Construct centrelines, lane/junction polygons, endpoint relationships and available road movements. | [Native exporter](https://github.com/cakirmert/osm2streets/blob/00b484f868f89c2420d25410525faf2414dde3c5/osm2streets-js/src/bin/webcityeditor_native_export.rs) |
| CityJSON conversion | Group surfaces into Road objects, project coordinates and record source metadata. | [Shared converter](../src/lib/osm2streets-network-converter.js), [CLI adapter](../scripts/osm2streets-lanes-to-cityjson.mjs) |
| Static packaging | Assign features to spatial tiles; record extents, revisions and required seam neighbours. | [Pages catalog packager](../scripts/build-hamburg-road-pages-catalog.mjs) |
| Editing | Create drafts, check changes and save explicit road/intersection attributes with the resulting surfaces. | [Transportation model](../src/lib/transportation.ts), [road editor](../src/hooks/useRoadEditor.ts) |

The source dependency is the [cakirmert/osm2streets fork at `00b484f`](https://github.com/cakirmert/osm2streets/tree/00b484f868f89c2420d25410525faf2414dde3c5), derived from [a-b-street/osm2streets](https://github.com/a-b-street/osm2streets). The submodule revision and native executable hash are recorded by the batch build. The compiled browser package lives separately in `vendor/osm2streets-js`; rebuilding Rust does not automatically replace that package. [PROJECT.md](../PROJECT.md#osm2streets-fork-and-wasm) describes the fork and WebAssembly build.

## Mapped information and inferred values

OSM does not consistently provide surveyed lane boundaries, kerb radii or complete lane-to-lane connectivity. A generated polygon is therefore a reconstruction. Satellite imagery is a visual reference for review; it does not feed an automatic road-detection algorithm in this application.

The inference code uses parsed lane widths where available and falls back to typical widths when they are missing. The upstream table mixes references and assumptions: for example, its cycling alternatives include 1.5 m and 2.0 m, while other lane types include imperial-unit defaults and estimates. These are **source-generation defaults**, independent of the Hamburg editing profile. An imported cycling band can consequently be narrower than the editor's preferred new design.

Import options control inferred sidewalks and kerbs, driving-side override, date/time-dependent interpretation and experimental transformations. They do not contain a configurable municipal width table. Changing upstream typical widths requires a Rust source change and rebuilding the native/WebAssembly outputs. Changing the editor profile requires no Rust rebuild. Exact options are listed in the [pipeline guide](osm-to-cityjson.md#import-options).

## CityJSON object and surface model

CityJSON's transportation types include `Road`, `Railway`, `Waterway` and `TransportSquare`; intersections are represented through attributes rather than a top-level `Intersection` type. Geometry faces can carry transportation semantics. See [CityJSON 2.0.2, Transportation](https://www.cityjson.org/specs/2.0.2/#transportation) and [semantic surfaces](https://www.cityjson.org/specs/2.0.2/#semantics-of-geometric-primitives). The converter writes file version `"2.0"`; `2.0.2` identifies the specification revision.

The converter writes one `Road` per osm2streets road and another per eligible source intersection. Junctions at the crop boundary (`MapEdge`) and records with fewer than two connected roads are omitted. The `--network` input supplies junctions and connectivity; lane polygons alone are insufficient.

Each object's geometry is a `MultiSurface` with `lod: "2"`. Each face contains an exterior ring and any interior rings, referencing vertices by index. `semantics.values` associates each face with an entry in `semantics.surfaces`. Movement surfaces use `TrafficArea`; separators and green bands use `AuxiliaryTrafficArea`. The core schema also defines `TransportationMarking` and `TransportationHole`, but the converter does not generate those semantic types: islands are interior rings, and native marking files are separate outputs.

The mapping uses a small set of editor band kinds:

| osm2streets lane type | Editor classification | Information retained |
| --- | --- | --- |
| Driving / Bus | `car_lane` | Original type; bus access is distinguishable in `allowedModes`. |
| Biking | `bike_lane` | Direction, lane index and source properties. |
| Sidewalk / Footway / Shoulder / SharedUse | `sidewalk` | Source type; SharedUse includes pedestrian and bicycle access. |
| Parking variants | `parking` | Original parking type in source properties. |
| Buffer variants | `median` | Original buffer type in source properties. |
| Explicit green/planter types | `green` | Source type and material. |
| Unmatched types | `road_surface` | Original type remains available for interpretation. |

This is not a complete transport ontology. The adapter also maps `LightRail` and `Construction` to `car_lane`, including the generic car access fallback. That mapping needs review before mode-specific routing. The separate railway context layer does not correct the converted attributes. Fields such as `transportationUsage`, `bandId` and `allowedModes` are application conventions; other consumers need an agreed mapping for them.

## Coordinates and geometric fidelity

The converter projects longitude/latitude to **ETRS89 / UTM zone 32N (`EPSG:25832`)**, appropriate to Hamburg. Coordinates are quantized to a 0.001 m grid using CityJSON's `scale` and `translate`. Grid precision is a storage choice, not a claim of millimetre survey accuracy.

Conversion removes repeated ring endpoints and consecutive duplicate points, normalizes ring orientation and rounds projected coordinates. It preserves lane subdivision without resizing it to the design profile, but it is not a lossless copy of source coordinates or input bytes. The output CRS is fixed; choosing another city's width profile does not change it.

Road geometry is initially flat at Z = 0. Layer information is retained separately in `_verticalProfile`; the road `_osmTags` record is reconstructed from selected network values (`highway`, `name`, `layer`), including fallbacks, rather than archiving original tags. The raw converter currently initializes intersection profiles to surface/layer 0. It does not reconstruct bridge decks, tunnels or junction elevations. Display and editing behavior are described under [crossings and levels](road-ux-research.md#crossings-and-levels).

## Provenance fields and editing state

| Record | Fields | Interpretation |
| --- | --- | --- |
| Document | `metadata.source`, `metadata.generatedAt`, `metadata.referenceSystem` | Dataset label, conversion timestamp and CRS. The timestamp is not the OSM observation date. |
| Source road | `_osmWayIds`, `_osm2streetsRoadId`, `_sourceCenterlineWgs84`, optional `_sourceMapEdgeEndpointsWgs84` | Links to source ways and generated geometry. Generated IDs are scoped to the extract/build. |
| Source surface | `sourceType`, `osm2streetsLaneIndex`, `osm2streetsPropertiesJson` | Generated lane type, ordering and serialized source properties. |
| Source junction | `_osmNodeIds`, `_connectedOsm2streetsRoadIds`, `_osm2streetsRoadEndpoints`, `_allowedOsm2streetsRoadMovements` | Mapped identity and relationships emitted by osm2streets. |
| Edited road | `_roadLayout`, including `ruleProfile` | Authored sections, bands and versioned editing rules. |
| Edited junction | `_connectedCityRoadIds`, `_disabledMovements`, `_junctionFootprint`, `_junctionBaseSurfaces` | Approaches, disabled turns, custom boundary/islands and recoverable untrimmed approach geometry. |
| Accepted conflicts | `_roadFitReview` | Saved warning review information, without regulatory approval. |

Fields beginning with `_` are editor attributes, not additional CityGML traffic-space classes. Attribute-only saves preserve imported geometry; width or shape changes can rebuild surfaces. Selecting an object does not replace its geometry. A generated junction stores its geometry and affected approach ends together so reopening it does not depend on repeating inference.

## Rule provenance and scope

Three decisions affect a displayed width:

1. **Observation/inference:** OSM tags and osm2streets defaults determine the reconstructed geometry.
2. **Design reference:** Hamburg's adopted standards supply applicable dimensions and conditions for proposed designs. The [width-source table](road-ux-research.md#hamburg-widths-and-source-locations) gives exact references.
3. **Software validation:** `RoadRuleProfile` selects numerical thresholds, directional variants and source notes. It evaluates band widths and available left/right space, rather than every condition of the standards.

A *profile* is the versioned configuration stored with a design. It does not make statutory or adopted requirements optional. Some current values have a documented ReStra basis; motor-lane, generic separator, green-strip and maximum-width defaults remain editor assumptions. The present model lacks the context needed to select a complete design-standard rule.

The converter does not silently widen existing streets. The editor flags retained narrow source bands. Positive-width design conflicts can also be explicitly saved with warnings; invalid numbers and structurally invalid geometry remain blocking errors. Accepting a warning records a design decision for review without changing the source standard.

## Validation boundaries

The sequence check verifies headers, feature structure, coordinate references and indices. Schema validation through `cjval`, geometric validation through `val3dity`, road-fit checks, movement checks and regulatory review answer different questions. Passing one does not establish the others. The [command guide](osm-to-cityjson.md#validation-and-reproducibility) distinguishes the checks.

Historical comparisons remain in the [eight-intersection audit](intersection-validation-2026-09.md) and [reference study](intersection-reference-study.md). Current manual generation, selected-intersection scope and warning saves are documented in [the latest intersection notes](intersections-and-crossings-2026-09-10.md).
