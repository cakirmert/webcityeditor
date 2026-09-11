# Road editor handoff

Updated 9 September 2026

Historical implementation record. Current controls and behavior are documented in [Road connections, intersections and width policy](road-ux-research.md) and [the latest intersection verification](intersections-and-crossings-2026-09-10.md). In particular, opening a junction now preserves its shape without activating handles; generation is manual and reviewable conflicts can be saved with warnings.

## September correction

- Opening an intersection activates boundary handles immediately. Selection also opens the workspace reliably; malformed imported fragments have an explicit generate/trace path.
- Roads can be found by street name. Start/End connection cards open existing junctions; unsaved joins and their physical intersections can be committed atomically. The junction's Roads tab highlights a specific endpoint and uses readable named candidate cards.
- Turns use a blue incoming lane, solid cyan permitted curves, red blocked curves, arrowheads and numbered destinations. The interactive diagram is visible below the controls.
- New road overlap is checked during preview and synchronously at save, including propagated roads and junction trims. Retained source overlap is grandfathered without allowing it to grow or move. Existing approach pavement is excluded from new building/tree occupancy checks; sidewalk-to-traffic changes still check tree trunks.
- Physical geometry works even with no compatible incoming movements. Imported kerbs are sampled at the actual mouth, curved/short approaches are handled more robustly, and source island openings survive automatic regeneration. A precise polygon-operation retry resolves coincident-edge failures without waiving validation.
- Hamburg tile URLs use the canonical serving hostname, fixing the CORS redirect failure for the building and tree sources. LoD1 and both LoD3 variants were confirmed in the browser; LoD2 root/child endpoints were checked for successful CORS responses.
- Tablet layouts keep the inspector on the right. The toolbar compacts at tablet widths and its More menu is no longer clipped by a scrolling header. The repetitive BuildingParts list is collapsed and no longer invents Floor/UNKNOWN labels.

The [eight-location visual review](intersection-validation-2026-09.md) includes a reproducible **608-junction audit**: 539 candidates pass road-overlap checks, 46 are blocked for overlap, and 23 are blocked for construction/elevation constraints. These are geometry checks, not claims of exact satellite alignment. Keep current retains source geometry for cases needing further interpretation.

## Delivered behavior

- **Lanes** combines the proportional street preview with band selection, type, material, width, direction, ordering and additions. The preview and selected width fit in the first desktop inspector screen. Band reordering is in a collapsed disclosure; small bands also have a selection dropdown. The duplicate bottom editor is removed.
- **Shape** contains centreline/curve controls, height and section splitting. Yellow endpoints snap to explicit targets.
- **Connections** shows endpoint joins and opens connected intersections. An unsaved endpoint join can seed a new intersection; additional nearby approaches can be added there.
- **Rules** contains versioned city profiles, per-band minimum/target checks, left/right extents, offset and constrained fitting. Profiles and limits survive CityJSON save/reload.
- A **map comparison bar** holds Map/Satellite, road opacity and hold-to-compare. Tablet/desktop screens use a right inspector with Hide/Expand; the camera accounts for its occupied space. Phones are not an editing target.
- **Intersection editing** has Shape/Turns/Roads tabs. Preserve, generate or visually trace kerbs; drag points, insert midpoints, nudge/delete with the keyboard, and trace island openings. Turn controls show one incoming lane and its destinations, with a visible interactive diagram. Physical pavement comes from kerb outlines independently of permitted movements.
- Automatic junctions follow connected road width/shape edits. A custom trace remains fixed and is checked for attachment to the approaches. Original untrimmed approach geometry is retained to prevent progressive damage. Road/junction saves use guarded mutations and global undo; a boundary drag is one draft undo action.
- **Data → Try the Hamburg intersection** loads a real Mattentwiete design study. Its original crop, estimated widths, outline metadata, screenshots and comparison GIF are included. See [the study](intersection-reference-study.md).
- Trees on sidewalks, planted verges and separators are allowed. Surface driving/cycling/parking over a mapped trunk blocks saving. Known trunk radius is used, with a 0.25 m fallback when unavailable; the editor adds no canopy/root buffer. Underground roads are excluded; uncertain elevated overlap remains a warning.

## Verification workflow

1. Run `npm ci`, `npm test` and `npm run build`.
2. Open **Roads** and select a road. Change a band width and check the preview/map. Undo and redo; save and reload a CityJSON export.
3. In **Rules**, set unequal left/right limits. Fit a feasible envelope, then try one narrower than the sum of minimum widths. The latter must keep the draft unchanged and explain why it cannot fit.
4. Open a connected intersection. Select an incoming lane, disable a movement, undo/redo and save. Reload and check the same restriction. Keeping the surface must leave its geometry and vertex array unchanged.
5. Generate a flat junction. Check its kerbs and trimmed approaches, then widen an approach. The automatic junction must adapt. Trace a boundary and an island; check saved holes, drag undo and approach attachment. A custom outline must remain fixed. Repeat rebuilding and check that approach areas do not keep shrinking.
6. Test a pavement tree, then change that band into a roadway. Only the roadway/trunk case should block saving.
7. Check iPad landscape/portrait, the desktop inspector, keyboard navigation and save/discard controls. Run **Structure** and **Check 3D** before exporting a design.

Automated coverage includes rule persistence, asymmetric fitting, infeasible limits, unchanged observed narrow bands, pavement/trunk behavior, tree-pit holes, reciprocal disconnection, repeated junction rebuilds, movement persistence, connected-width adaptation and separation of bridge/ground roads. Browser QA additionally exercises the responsive controls and rendered geometry.

## Verification results

- `npm test`: **722 passed, 5 skipped** across 86 passing test files and two skipped files, including ten real Hamburg junctions, physical overlap and atomic join regressions. The skipped checks require optional converter/IFC fixtures or the older val3dity executable at the repository's configured external path.
- `npm run build:pages`: TypeScript and the production Vite build with the GitHub Pages base path passed.
- Current browser verification: direct boundary dragging, whole-drag undo/redo, successful junction save, disabled-turn persistence through disconnect/reconnect, named endpoint highlighting and visible cyan/red movement arrows. Entering a 100 m driving lane shows its 5 m policy limit and physical road-overlap conflicts, with saving disabled. LoD3 streamed 23 textured tiles and three untextured tiles in the checked view without the former fetch errors. Current screenshots include desktop, 1024 × 768 and 768 × 1024 tablet viewports; the inspector and More menu remain usable in both tablet orientations.
- `npm run test:backend`: **11 passed**, including authentication, CORS, revision conflicts, idempotent retries, retention and restart persistence. The Docker image was built and run with its persistent volume; an edited 1,276-vertex Mattentwiete document and revision 2 survived a container restart.
- Earlier shared-project browser checks covered connect, create workspace/project, applied intersection autosave, reopening in a fresh page, detecting another writer's revision and saving the retained local design as a separate project. That backend is unchanged by this correction.
- Geometry regression coverage includes three-arm/four-arm junctions, the synthetic short-Hamburg fixture, the real Mattentwiete source and trace, missing endpoint inference, detached/crossing outlines, islands, repeated rebuilding, widened approaches and elevation steps. UI coverage includes whole-drag undo, unfinished-trace save blocking and opacity restoration on release/cancellation.
- **val3dity 2.7.0**, using the application's `--ignore204` profile, accepted all five Road MultiSurfaces in the traced Mattentwiete study. This is geometry validation under that profile, not a full CityJSON schema or traffic-design certification.
- Earlier geometry verification also covered asymmetric fitting, infeasible envelopes, the saved fitted road/junction and the five-object Mattentwiete study with the local **Check 3D** service. Those results do not certify newly edited geometries; run Check 3D again after modifying a design.

The validation executable and synthetic QA documents are temporary local tools/fixtures, not application dependencies or replacement production data.

## Boundaries of the implementation

The builder supports local flat junctions. It rejects known non-flat/grade-separated inputs rather than flattening them. It does not author signals, priority, stop lines or crosswalk placement, and it does not simulate traffic or check vehicle swept paths. Connection curves do not automatically route around islands; crossings are reported for review. Existing source movement restrictions remain authoritative. Disabling a turn does not erase its pavement. Existing exact junctions require explicit generation or tracing before geometry changes. Imagery tracing is visual interpretation, with unknown source acquisition date and no asserted survey accuracy.

Rule profiles are project design policies with documented sources, not complete municipal approval rules. Source conversion does not automatically resize the city. Tree checks depend on loaded tree positions/trunk data; the width policy does not calculate the remaining unobstructed pedestrian envelope around furniture. Changes remain in the browser unless exported, saved locally or linked to a configured shared project. The [Docker storage service](../backend/README.md) is prepared and tested for later hosting; no public backend is deployed. The hosted frontend is updated separately by the project's deployment workflow.

See [data/rule provenance](transportation-provenance.md) and [UX, geometry and width research](road-ux-research.md) for the evidence and decisions.
