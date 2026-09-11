# Road connections, intersections and width policy

Design and implementation reference · updated 11 September 2026

Road editing operates on three related models: **cross-sections** allocate space along a road; **junction surfaces** describe pavement between roads; **directed connections** describe permitted movements. Keeping them distinct allows a turn to change without removing pavement, or a road width to change while retaining its junction connection.

The interface targets desktop and tablet layouts from 768 CSS pixels. Road and intersection tools share the right inspector. The [README](../README.md) provides the illustrated user guide; this document explains the interaction model, construction and width rules.

## Selection and editing workflow

| Selection | Inspector tabs | Typical operation |
| --- | --- | --- |
| Road | Lanes, Shape, Connections, Rules | Add/reorder bands, change widths, adjust the centreline and inspect endpoint joins. |
| Intersection | Shape, Turns, Roads | Inspect approaches, adjust lane movements and optionally rebuild pavement. |

Selecting an intersection preserves its saved surfaces. **Turns** initially shows all approaches with consistent colours and numbers; selecting an incoming lane narrows the display to its destinations. Arrow direction and turn markings supplement colour. Connections remain editable even when imported pavement is irregular.

An endpoint join identifies which road end meets a junction. A lane movement connects an incoming lane to an outgoing lane. Adding an approach does not establish every possible movement, and visually crossing roads do not necessarily form a junction.

Edits remain drafts until Save. Clicking another road or intersection parks an unfinished draft and its undo history for the session. Returning resumes it; a source-change check prevents overwriting geometry changed elsewhere. Parked drafts are not durable saves. Save local, CityJSON export or a connected shared project preserves applied edits beyond the session.

## Interaction references

| Reference | Relevant behavior | Use in this editor |
| --- | --- | --- |
| [PTV Vissim connectors](https://cgi.ptvgroup.com/vision-help/VISSIM_2026_EN-DE/en-us/Content/5_Netzbearbeiten/Strassennetz_Verb_str_modellieren.htm) | Separate road links and lane-specific connectors. | Represent endpoints and directed lane movements explicitly. |
| [SUMO NetEdit connection mode](https://sumo.dlr.de/docs/Netedit/editModesNetwork.html) | Select a source lane and edit its connections. | Start with an approach overview, then edit one incoming lane's destinations. |
| [Godot Road Generator](https://github.com/TheDuckCow/godot-road-generator) | Road points, cross-section controls and procedural geometry. | Proportional previews and direct shape handles. The Godot runtime is not embedded. |

These are interaction references. Their geometry engines and traffic simulation behavior are not included in the application.

## Generating a junction

Generation is an explicit **Shape** action, followed by preview and Save. It does not run when a source intersection is opened.

| Scope | Result |
| --- | --- |
| **Selected intersection** (default) | Rebuild this junction, retain connected road identities and trim their approach ends where they meet its new surface. |
| **Larger area** | Enable **Generate combined intersection**. Search a larger connected group and show junction/short-road absorption counts before saving. |

Selected-intersection generation changes immediate approach ends to avoid overlapping pavement. It does not authorize replacing entire connected roads or merging neighbouring junctions. Larger-area generation addresses fragmented junctions such as Rödingsmarkt. It follows endpoint ownership and compatible levels; proximity alone is insufficient.

Construction proceeds as follows:

1. Resolve approach roads, endpoints, lane order and vertical profiles.
2. Sample actual centrelines and lane edges at a setback to form road mouths.
3. Order the mouths around the junction and join them with curved kerb returns.
4. Allocate carriageway, cycle and pedestrian surfaces using polygon operations. Retain explicit islands and full-width cycling ends; remove detached internal remnants that would otherwise leave rectangles or square holes.
5. Trim approaches and check surrounding loaded roads, buildings and tree trunks. If clipping against a neighbour would split the carriageway, retain the connected candidate and report its conflict.
6. Save junction geometry, approach changes and connection metadata together. Retain untrimmed approach coordinates for repeatable regeneration.

Unsupported inputs, such as incompatible levels, unusable approach geometry or complete consumption of a short approach outside an explicit merge, prevent generation. Overlap with a neighbour is a reviewable conflict where the candidate remains structurally usable.

Previously generated automatic junctions update when attached road geometry changes. A custom footprint stays fixed and its joins require review. **Adjust boundary on map** enables handles; islands can be authored separately. The satellite-tracing button and Data study cards are removed. The imagery layer and comparison controls remain available.

## Geometry alternatives

| Method | Consequence for this dataset | Current role |
| --- | --- | --- |
| Convex hull or union of all road buffers | Can occupy unrelated land and merge separate carriageways. | Not the general construction method. |
| Fixed three/four-arm meshes | Skewed approaches and differing widths require many variants. | Possible future presets. |
| Ordered mouths and kerb returns | Adapt to existing approaches and keep surface ownership explicit. | Current flat-junction construction. |
| Custom exterior and island rings | Represent irregular boundaries independently of generation. | Persistent optional shape override. |
| Vehicle swept-path/constrained solver | Needs design vehicles, speeds, radii, crossings and control data. | Not implemented. |

Connection guides are tangent-constrained curves between compatible lanes. They are not wheel tracks, turning-radius envelopes or conflict-free signal plans. The graph uses available restrictions and authored choices; incomplete source data can still require correction of arrows and destinations. Disabling a movement changes connectivity, not the pavement footprint.

The [Mattentwiete study](intersection-reference-study.md) records an imagery-based footprint comparison. The [eight-location audit](intersection-validation-2026-09.md) documents the earlier 608-junction run; [the latest intersection notes](intersections-and-crossings-2026-09-10.md) describe subsequent fixes. Dated studies are historical evidence, not a fresh certification of every junction. The small `hamburg-short-intersection` fixture is synthetic regression data.

## Crossings and levels

A railway is not inherently above a road. Known layer and placement information determines relative display order: Rödingsmarkt has an elevated railway, while Altmannbrücke has roads above station tracks. A negative layer can describe an open cutting as well as an underground structure; tunnel tags and placement require separate interpretation.

The display separates layers by **six schematic metres per layer**. This offset is not a surveyed height or exported bridge clearance. Raw OSM conversion remains flat, with selected level metadata as described in [Transportation provenance](transportation-provenance.md#coordinates-and-geometric-fidelity). Compatible flat underground junctions retain their placement when edited; mixed levels are refused, and larger consolidation is restricted to ground-level groups.

## Governing references

Hamburg makes ReStra and the FGSV rules introduced through it binding for public-road design. The official edition is **2017, revision 23 March 2026**. ReStra is the adopted technical framework for this jurisdiction. [Hamburg's official ReStra publication](https://www.hamburg.de/politik-und-verwaltung/behoerden/bvm/die-themen-der-behoerde/grundlagen-strassenwesen/restra-193078).

Traffic orders and use obligations follow StVO and VwV-StVO. VwV-StVO's guidance on §2(4), second sentence, paragraphs 14–23 concerns ordering mandatory cycleway use, with contextual requirements and exceptions. Its dimensions should not replace Hamburg's new-design table. [Official VwV-StVO](https://www.verwaltungsvorschriften-im-internet.de/bsvwvbund_26012001_S3236420014.htm).

ReStra applies to public ways, streets and squares under Hamburg's road legislation; its preamble distinguishes design requirements from traffic-law decisions. [ReStra preamble, printed p. i / PDF page 5](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=5).

ReStra supplements base documents including RASt, ERA, EFA, EAR and accessibility guidance. The full RASt text is supplied by [FGSV Verlag](https://www.fgsv-verlag.de/rast). The generic motor-lane thresholds in the current profile have not been traced to an applicable RASt clause in this source audit; they remain identified as editor defaults.

## Hamburg widths and source locations

All dimensions are metres. “Minimum” and “target” name the implemented profile fields; they do not encode every condition of the cited rule.

| Band | Current minimum / target | Verified reference or default status |
| --- | --- | --- |
| Sidewalk | 1.80 / 2.65 | ReStra RASt §4.7, p.12; EFA §3.2.1, p.85: clear space versus total side space at 50 km/h. [PDF p.25](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=25), [p.98](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=98). |
| One-way cycling | 2.00 / 2.50 | ReStra ERA §2.2.1, pp.94–96: usable width. Marked-lane totals: 2.25 / 2.75. [PDF p.107](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=107). |
| Two-way cycling | 3.00 / 3.50 | Same table: provision on one side. Both sides: 2.50 / 3.00. [PDF p.109](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=109). |
| Parallel parking | 2.00 / 2.10 | ReStra EAR §3.4.3, p.78: other/standard materials; 2.30 recommended beside heavily used main roads. [PDF p.91](https://dokumente.hamburg.de/resource/blob/193072/34178351da128e832be75bb3c3fcc405/restra-data.pdf#page=91). |
| Motor lane | 2.75 / 3.25 | Editor fallback. A `both` band uses 5.50 / 6.50. These are not established universal statutory minima. |
| Generic separator | 0.10 / 0.50 | Editor fallback for a kerb/separator, not a pedestrian refuge or complete protection strip. |
| Green strip | 0.50 / 1.50 | Editor fallback for a landscape band, not a tree rooting-volume requirement. |

[HAMBURG_ROAD_RULES](../src/lib/road-rules.ts) defines these values. Its maximum-width fields are editable software limits for detecting unusually wide bands, with no claim that they are statutory maxima.

The numerical profile is a simplified mapping. It cannot independently distinguish painted lanes, protected tracks and shared paths from the generic cycling kind. One total sidewalk width cannot establish clear passage around furniture. Facility classification, usable-width measurements, protection/marking allocation, speed, traffic volume and design-vehicle context are needed for a fuller standards checker. Changing a number alone does not add those checks.

## Applying and fitting a profile

**Rules** imports/exports a versioned JSON profile containing an ID, name, version and all band rules. Each rule carries minimum/target widths, optional maximums, two-way variants, a source and a scope note. The profile is saved in `_roadLayout.ruleProfile`, identifying the thresholds used for that layout.

Left and right extents measure space from the **directed centreline**. For width `W`, left extent `L`, right extent `R` and centre offset `o` (positive left), a section fits when:

```text
o + W/2 <= L
W/2 - o <= R
```

Fitting reserves each band's minimum first, reduces remaining requested width proportionally, rounds down to centimetres and shifts the section into the asymmetric envelope. If minimum widths exceed available space, it fails without partially fitting other sections. This is deterministic width allocation, not traffic-capacity optimization or a right-of-way survey.

A profile for another jurisdiction must identify the authority, edition, clause, facility and measurement convention. Source-backed thresholds and fallback assumptions must remain distinguishable. The current model supports source/note text; richer conditional rules require model and validator changes.

## Warnings, blocking errors and saved review

Width checks, extent checks and spatial-fit checks have separate responsibilities. Spatial checks only know loaded objects and available geometry. Existing trees in sidewalks or planting surfaces can remain; new driving, cycling or parking surfaces occupying a trunk are reported. The check does not model canopies, roots or the unobstructed pedestrian corridor.

The inspector lists conflicts and offers **Save with N warnings** for reviewable issues, including positive widths outside chosen thresholds. Accepted issues remain in `_roadFitReview`. Invalid/non-positive widths, malformed configuration and structurally unusable outlines remain blocking errors. Warning acceptance is an application record, not permission from a road or traffic authority to depart from a requirement.

## Source updates and project persistence

**Projects → Reset project roads from OSM** prepares a replacement for the loaded project extent and presents its counts before explicit reset. It replaces Road objects, including authored lanes, junctions and restrictions. A recovery copy and Undo are available; buildings remain. Source reset is not an inspector action, and routine selection or panning does not regenerate the OSM network.

[Streaming and storage](streaming-and-storage.md) explains source tiles, applied edits, session drafts and durable project revisions.
