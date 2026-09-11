# Documentation

Start with the [UI/UX handover](handover-ui-ux.md) for user workflows and the
[technical handover](handover-technical.md) for implementation and maintenance.
The [main README](../README.md) gives the shortest introduction with screenshots.

| Document | Purpose |
| --- | --- |
| [UI/UX handover](handover-ui-ux.md) | Navigation, selections, drafts, roads, junctions, buildings and saving. |
| [Technical handover](handover-technical.md) | State ownership, mutation flow, rendering, streaming, storage and verification. |
| [Road warnings](road-warnings.md) | Warning triggers, review/acceptance, structural blockers and saved review metadata. |
| [Upstream software and attribution](upstream-dependencies.md) | Actual Delft, CityJSON, A/B Street and related dependencies, roles and licenses. |
| [Embedding and package guide](package-guide.md) | Installable tarball, browser API, headless helpers, assets and module limits. |
| [Godot road generator assessment](godot-integration.md) | Optional scene/mesh bridge, coordinate and lane mapping, feasibility and prototype criteria. |
| [OSM → XML → CityJSON](osm-to-cityjson.md) | Native Rust converter, inputs, commands, intermediate artifacts and diagnostics. |
| [Transportation data and rule provenance](transportation-provenance.md) | Data semantics, inference, retained source metadata and rule origins. |
| [Road connections, intersections and width policy](road-ux-research.md) | Topology, UX choices, geometry generation and cited governing references. |
| [Streaming and storage](streaming-and-storage.md) | CityJSONSeq, tile delivery, 3D Tiles, current snapshot store and future database options. |
| [Backend operation](../backend/README.md) | Optional Docker setup, HTTP contract, persistence, backup and revision conflicts. |

Dated intersection reviews describe the datasets and behavior at their review
date: [initial design study](intersection-reference-study.md),
[satellite validation](intersection-validation-2026-09.md), and
[crossings and generation changes](intersections-and-crossings-2026-09-10.md).
Use the current handovers and warning reference for today's interaction rules.
