# Godot Road Generator integration assessment

Architecture proposal · reviewed 11 September 2026 · **not implemented**

[Godot Road Generator](https://github.com/TheDuckCow/godot-road-generator) is a plausible optional 3D presentation and road-authoring companion. Its best initial use here is a small exported road scene that can be inspected in Godot and returned as a visual GLB preview. CityJSON, the editor's road model and its validation should remain authoritative.

This proposal does not add Godot to the website, replace intersection generation or claim a working import/export round trip. It identifies the adapter and verification work required before such an integration would be useful.

## Reviewed version and capabilities

The reviewed `main` revision is [`980bc04c9f95a5c49b787f0a7a64a458156d5b9b`](https://github.com/TheDuckCow/godot-road-generator/tree/980bc04c9f95a5c49b787f0a7a64a458156d5b9b). Its [plugin configuration](https://github.com/TheDuckCow/godot-road-generator/blob/980bc04c9f95a5c49b787f0a7a64a458156d5b9b/addons/road-generator/plugin.cfg) reports `0.9.3`, while its README version table still lists `0.9.1` for `main`, with Godot `4.4+` support. Pin a commit and a tested Godot version for a prototype rather than depending on that inconsistent release label.

The addon provides cross-section control points, generated road meshes, procedural/prefab intersections, materials, optional lane-following paths and GLB export. It is implemented in GDScript and runs in Godot. Its README also identifies procedural-intersection lane/edge curves as unfinished. These capabilities make it a candidate for visual road scenes, not an existing lane-connection or regulatory engine for this application. [Reviewed README](https://github.com/TheDuckCow/godot-road-generator/blob/980bc04c9f95a5c49b787f0a7a64a458156d5b9b/README.md).

The main abstractions are `RoadManager`, `RoadContainer`, `RoadPoint`, generated `RoadSegment`, `RoadLane` and `RoadLaneAgent`. A `RoadPoint` describes a cross section; segments interpolate between points. That resembles WebCityEditor's sections and bands, but the representations are not equivalent. [Addon class guide](https://github.com/TheDuckCow/godot-road-generator/wiki/Addon-Classes).

## Fit with the current road model

| Requirement | Existing editor model | Adapter implications |
| --- | --- | --- |
| Independent widths for driving, cycling, footway, parking and green bands | Each section contains ordered bands with their own widths and directions. | Godot's `RoadPoint.lane_width` is a single shared traffic-lane width. Heterogeneous bands need custom mesh generation, separate strips or an addon extension. |
| Junction shape and road ownership | Saved polygon/islands plus explicitly trimmed approach ends. | Reuse the accepted footprint for a faithful preview. Reconstructing it with a second generator can change ownership, create gaps or cross buildings. |
| Allowed turns and parallel turning lanes | Directed road/band relationships and disabled movements. | Export these relationships explicitly; lane-following helpers cannot be treated as the movement authority. |
| Ending cycle lanes at full width | A band can stop at an explicit boundary. | Do not convert its end into a width-zero interpolation point. Export a full-width terminal cap. |
| Bridges, underpasses and tunnels | Source layer/placement metadata; often flat source geometry. | Separate crossing levels. Real ramps, clearance and tunnel geometry need additional elevation data. |
| Rule profiles and warnings | Versioned rules and accepted-review metadata stored with the project. | Preserve metadata in a sidecar; a Godot scene or rendered mesh does not evaluate those rules. |

The uniform-width and custom-geometry controls are visible in the pinned [`road_point.gd`](https://github.com/TheDuckCow/godot-road-generator/blob/980bc04c9f95a5c49b787f0a7a64a458156d5b9b/addons/road-generator/nodes/road_point.gd). It exposes `traffic_dir`, `lane_width`, shoulder widths and `create_geo`; turning off generated geometry permits a custom mesh. The proposed adapter should choose its mode explicitly and report unsupported bands rather than silently simplifying them.

The addon documents additional junction constraints: connected points must belong to the same container, some configurations produce texture stretching/clipping, and terrain flattening uses the lowest connected point. An intersection therefore needs to be packaged with its approach points in one scene container. Bridges and tunnels must not participate in a blanket terrain-flatten operation. [Procedural intersection guide](https://github.com/TheDuckCow/godot-road-generator/wiki/Creating-procedural-intersections).

## Integration options

| Option | What must be built | Effect on the web editor | Assessment |
| --- | --- | --- | --- |
| **Offline/native companion** | Export a selected road group and metadata; add a Godot importer; optionally export GLB. | Existing browser editor stays lightweight. No hosted server is required. | Recommended first prototype. Easy to inspect and compare a bounded scene. |
| **Optional Godot web preview** | A separate Godot web build plus a JavaScript message bridge and preview UI. | Additional engine download, memory and graphics context. Needs lifecycle, focus and resize handling. | Feasible after the data bridge is proven; load only on request. |
| **Offline/headless mesh build** | A Godot command-line importer/exporter, job wrapper and cache. | Browser receives generated GLBs; geometry is not rebuilt locally on every drag. | Useful for publishing prepared scenes. Docker can package it later; a server is not needed for local preparation. |
| **Port selected ideas into the current renderer** | Implement chosen mesh/material or control-point techniques in TypeScript. | No Godot engine download, but duplicated implementation to maintain. | Appropriate for a narrowly identified visual improvement; not a plug-in installation. |
| **Replace the main editor with Godot** | Rebuild catalog streaming, georeferencing, selection, accessible forms, persistence and editing transactions. | Large product rewrite. | Outside the scope of a road-rendering integration. |

An npm wrapper can coordinate loading assets and messages, but cannot execute the addon's GDScript in Three.js or make Godot editor panels appear inside React. Godot's editor gizmos and inspector tools are development UI; a web-exported application needs its own runtime controls.

Godot web export uses WebAssembly and WebGL 2 with the Compatibility renderer. A single-thread export avoids the cross-origin isolation required by threaded builds, making it the simpler first candidate alongside the existing external map services. This still needs testing on the target desktop browsers and iPad Safari. [Godot web export documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html).

## Proposed exchange contract

The first adapter should export **one selected intersection and its explicitly selected approach extents**. A larger group is a separate user choice. Reference objects beyond that scope may be included as read-only context, but must not become editable or be absorbed into the junction.

The exchange should contain the source CityJSON plus a versioned adapter manifest. The following fields are proposed, not an existing WebCityEditor or Godot API:

| Manifest content | Purpose |
| --- | --- |
| Schema version, project ID and source revision | Reject stale or incompatible results. |
| CRS, units, CityJSON transform and local origin | Reproduce the same coordinate frame. |
| Source CityObject IDs, selected edit scope and context-only IDs | Prevent a preview/export from modifying neighbouring roads. |
| Sections, ordered bands, widths, directions and endpoint identities | Build road control points without discarding the editable model. |
| Accepted junction outline, islands and approach trim boundaries | Preserve the currently reviewed pavement. |
| Directed movements, band IDs and disabled movements | Preserve turns independently of visual lane markings. |
| Elevation source, layer, bridge/tunnel placement and display-only offsets | Distinguish measured geometry from schematic depth. |
| Rule-profile version, provenance and accepted warnings | Carry the design context through a visual export. |
| Mesh-to-object/band mapping | Translate picking in the preview back to the editor. |

Existing source inputs for this adapter are [transportation.ts](../src/lib/transportation.ts), [road-junctions.ts](../src/lib/road-junctions.ts), [junction-lane-guides.ts](../src/lib/junction-lane-guides.ts) and the attributes described in [Transportation provenance](transportation-provenance.md). They should be accessed through a deliberate public adapter API, rather than importing arbitrary internal module paths from a consumer application.

### Coordinates and depth

CityJSON integer vertices must first be decoded using `scale` and `translate`. Convert to a suitable metre-based projected CRS, then subtract a nearby local origin before building the scene. For the Hamburg UTM frame, a proposed mapping is:

```text
Godot X = easting  - originE
Godot Y = height   - originH
Godot Z = -(northing - originN)
```

Record this mapping and its inverse in the manifest. Test winding, normals, UVs and the inverse projection; do not pass longitude/latitude degrees as road metres. When a project lacks reliable heights, its preview must identify the depth as schematic. The editor's layer-based display spacing is not surveyed bridge clearance and must not be baked into authoritative heights without an explicit conversion decision.

### Geometry and metadata

Two adapter modes are useful:

1. **Accepted-mesh preview:** triangulate the saved surfaces and retain their semantic/object mapping. Godot supplies materials, lighting and scene inspection. This is the first fidelity baseline.
2. **Procedural road experiment:** map supported sections into RoadPoints and generate a comparison mesh. Keep the original mesh visible for comparison and enumerate unsupported features. This output remains a preview until validated and explicitly accepted.

GLB is suitable for the visual result; a portable round trip still needs the manifest and CityJSON. Godot supports exporting scenes to glTF/GLB, but export does not preserve application behavior automatically. A mesh alone cannot recover bands, legal turn permissions, source way IDs or warning decisions. [Godot 3D scene export](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/exporting_3d_scenes.html).

## Browser communication and editing safety

For a later web preview, [Godot's JavaScriptBridge](https://docs.godotengine.org/en/stable/tutorials/platform/web/javascript_bridge.html) can connect GDScript to JavaScript objects and callbacks. A wrapper can expose a small typed protocol such as `loadScene`, `selectObject`, `setCamera` and `previewReady`; these names describe the proposed protocol only.

Keep scene requests versioned, cancel outdated loads, validate the sender/origin when using an iframe, and dispose callbacks and graphics resources when closing the preview. Transfer a bounded scene rather than the whole loaded city on each input event. During dragging, debounce mesh rebuilding and reject a late response whose source revision no longer matches the draft.

The first prototype should be read-only. If editing is added later, Godot must return a proposed change with original IDs and revision, not overwrite the project directly. The host must run the same road-fit, topology, structural and warning-save checks used by the ordinary editor, then commit the accepted change and undo state together. Disabled turns must remain disabled after any geometry regeneration.

## Prototype acceptance criteria

Use fixed saved fixtures and compare the exported scene against the current editor, with the existing imagery available as context:

1. A straight road with different band widths and a full-width cycle-lane end.
2. A simple T intersection and a skewed four-way intersection.
3. The combined Rödingsmarkt case with a retained cycle route and unchanged surrounding-road IDs.
4. A road above rail and a road below rail, with explicit source-layer interpretation.
5. A lane-count transition and a junction with an island and disabled turn.

Acceptance requires object IDs, band widths, approach boundaries, island holes and movement permissions to survive the adapter unchanged in accepted-mesh mode. Any procedural approximation must be labelled and remain separate. Check that geometry introduces no new building overlap, disconnected pavement square or shrinking cycle-lane terminal.

Measure download size, initialization time, peak memory, frame time and regeneration latency on the target devices before choosing performance budgets. No browser-performance benchmark or geographic-fidelity result has been established for this proposed integration.

## Licensing and distribution

The reviewed addon is MIT-licensed, with copyright assigned to Moo-Ack! Productions. Preserve its copyright and permission notice when distributing the addon or substantial adapted code. [Pinned addon license](https://github.com/TheDuckCow/godot-road-generator/blob/980bc04c9f95a5c49b787f0a7a64a458156d5b9b/addons/road-generator/LICENSE).

Embedding a Godot engine build also requires its license and the notices for its bundled third-party components. The engine's MIT terms do not impose an engine license on generated road data; source datasets, imagery, textures and separately included assets retain their own terms. [Godot licensing](https://godotengine.org/license/).

A future npm adapter should therefore distribute only its wrapper, required preview assets and notices. Keep demo datasets, optional native executables and development/test addons outside the default runtime package. The [upstream inventory](upstream-dependencies.md#licenses-and-package-redistribution) explains the existing editor's separate license obligations.
