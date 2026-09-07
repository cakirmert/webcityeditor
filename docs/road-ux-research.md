# Road connections, intersections and width policy

English research and design recommendation · updated 7 September 2026

## Recommended editing model

Use **one inspector plus direct map handles**. Road cross-section editing and intersection movement editing need distinct selections inside that workspace. Keep one incoming lane active, show its possible outgoing movements, and preview geometry before saving. On narrow screens use a collapsible bottom sheet; frame the map above it. This is the implemented design.

| Reference | Useful pattern | Application here |
| --- | --- | --- |
| [PTV Vissim connector editing](https://cgi.ptvgroup.com/vision-help/VISSIM_2026_EN-DE/en-us/Content/5_Netzbearbeiten/Strassennetz_Verb_str_modellieren.htm) and [attributes](https://cgi.ptvgroup.com/vision-help/VISSIM_2026_EN-DE/en-us/Content/5_Netzbearbeiten/Strassennetz_Verb_str_Attr.htm) | Road links are connected through lane-specific connectors; connector geometry follows their ends and supports intermediate points. | Keep roads, endpoint joins and lane movements explicit. A curve-reach control adjusts junction connectors while their ends stay attached. |
| [SUMO NetEdit](https://sumo.dlr.de/docs/Netedit/editModesNetwork.html) | Select a source lane, inspect possible/connected/conflicting destinations, then save or cancel connection edits. | Incoming-lane selector, outgoing-movement checkboxes and a clickable miniature plan; draft undo/redo and one save. |
| [Godot Road Generator](https://github.com/TheDuckCow/godot-road-generator) | Cross-section controls, snapping, road-point editing and procedural/prefab intersections make shape editing tangible. | A proportional street preview and map handles. The GDScript plugin is a UX/geometry reference; adopting it would require a different runtime and data integration. |

These products establish useful interaction patterns. They do not validate our generated geometry or establish Hamburg design compliance.

## Geometry alternatives and choice

| Method | Trade-off | Decision |
| --- | --- | --- |
| Union all road buffers / convex hull around endpoints | Simple continuous pavement, but can fill unrelated land and hide lane correspondence. | Do not use a convex hull for the junction. |
| Preset three/four-arm meshes | Predictable appearance, but awkward for skewed approaches, differing widths and imported footprints. | Useful for future templates, not the canonical representation. |
| Full constrained junction optimizer | Can incorporate swept paths, corner radii, crossings and signals; needs substantially more engineering inputs. | Future design/simulation integration. |
| Ordered kerb returns plus a separate directed lane graph | Keeps physical pavement independent of permitted turns; supports skewed road mouths and direct visual correction. | Implemented for local flat junctions, with polygon clipping for semantic separation and approach trimming. |
| Trace the visible kerb and island rings | Can follow irregular source geometry; depends on imagery quality and explicit review. | Implemented as an editable, persistent footprint with direct map handles. |

The movement graph derives approach lanes from saved layouts or source geometry, respects known road-to-road and lane turn restrictions, matches compatible lanes by lateral order, and forms tangent-constrained connection guides. Physical pavement uses ordered road mouths sampled at a setback on their actual centrelines. Curved kerb returns join them; successive motor, cycle and pedestrian envelopes are made disjoint. Turning ribbons do not define pavement. This avoids tangled pedestrian unions and artificial islands exposed by the real Mattentwiete case.

A traced footprint overrides the automatic carriageway outline. Direct handles, midpoint insertion, keyboard nudging and island tracing allow correction against the existing satellite layer. Only explicitly traced or retained source interior rings define islands. They remove pavement from both the junction and underlying approaches. Self-crossing outlines, overlapping/outside islands and detached approaches are rejected. The geometry remains inspectable as ordinary CityJSON Road surfaces; the editable outline and its reference note are retained as attributes.

Turn permission and pavement are separate. Disabling a movement changes connectivity, not the physical pavement footprint. Untrimmed approach surfaces are retained to make rebuilding repeatable. Connected road geometry edits recompute automatic junctions in the live preview and at save; an authored trace stays fixed and requires checking the joins. Existing exact imported junctions require an explicit first rebuild. **Shape / Turns / Roads** are distinct tabs in the same inspector; a map comparison bar provides opacity and hold-to-compare controls. The optional connection diagram is collapsed to leave destinations visible on smaller screens.

The [Mattentwiete reference study](intersection-reference-study.md) records the actual imagery comparison, estimated widths and remaining uncertainty. The older `hamburg-short-intersection` fixture is a synthetic regression network located in Hamburg coordinates; it is not evidence of agreement with a real junction.

Guards reject missing approaches, incompatible lanes, distant ends, different levels, non-flat source surfaces, and complete consumption of a short approach. The result is a concept-design surface, not a swept-path calculation. Crosswalk placement, stop lines, signals, priority rules, capacity and vehicle turning radii require additional authored data; they are not inferred from an attractive curve.

## Hamburg widths: current evidence and explicit assumptions

The [official ReStra page](https://www.hamburg.de/politik-und-verwaltung/behoerden/bvm/die-themen-der-behoerde/grundlagen-strassenwesen/restra-193078) identifies the 23 March 2026 revision. The [current PDF](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf), printed pages 94–96, distinguishes usable cycling space from total marked/protected width. Older summaries giving a 1.85 m cycle lane are not the basis of this profile.

| Band | Implemented minimum / target | Basis and scope |
| --- | --- | --- |
| Sidewalk | 1.80 / 2.65 m | Clear pedestrian minimum versus total side-space reference; furniture/tree pits do not count as clear width. |
| One-way cycling | 2.00 / 2.50 m | Clear usable cycling space; marked-lane total is 2.25 / 2.75 m. Add protection/markings separately. |
| Two-way cycling | 3.00 / 3.50 m | Assumes provision on one side; provision on both sides has different values. |
| Parallel parking | 2.00 / 2.10 m | Material-dependent minimum/standard; busy main-road recommendation is 2.30 m. Door buffers are separate. |
| Motor lane | 2.75 / 3.25 m | Project policy, not a claimed universal regulatory minimum. A two-way band doubles these values. |
| Separator; green strip | 0.10 / 0.50; 0.50 / 1.50 m | Project policy; neither defines a pedestrian refuge or tree rooting volume. |

Cycle and parking dimensions above come from the current ReStra PDF, including its printed page 77 parking table. The profile labels the distinction between source-backed values and project choices. A width check cannot establish unobstructed sidewalk space from a single total-width number. UK [LTN 1/20](https://www.gov.uk/government/publications/cycle-infrastructure-design-ltn-120) is a useful comparison and upstream reference; it is not the governing Hamburg standard.

For a different city, export the profile, change its ID/version, dimensions and evidence, then import it. Left/right extent limits describe available space relative to the directed centreline. Fitting reduces only width above each band's minimum and shifts the section within asymmetric limits. An impossible envelope is reported instead of shrinking every band by the same factor.
