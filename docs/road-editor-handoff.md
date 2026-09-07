# Road editor handoff

7 September 2026

## Delivered behavior

- **Lanes** combines the proportional street preview with band selection, type, material, width, direction, ordering and additions. The preview and selected width fit in the first desktop inspector screen. Band reordering is in a collapsed disclosure; small bands also have a selection dropdown. The duplicate bottom editor is removed.
- **Shape** contains centreline/curve controls, height and section splitting. Yellow endpoints snap to explicit targets.
- **Connections** shows endpoint joins and opens connected intersections. A saved endpoint join can seed a new intersection; additional nearby approaches can be added there.
- **Rules** contains versioned city profiles, per-band minimum/target checks, left/right extents, offset and constrained fitting. Profiles and limits survive CityJSON save/reload.
- A **map comparison bar** holds Map/Satellite, road opacity and hold-to-compare. Narrow screens use a bottom sheet with Hide/Expand; the camera accounts for the inspector's occupied space.
- **Intersection editing** has Shape/Turns/Roads tabs. Preserve, generate or visually trace kerbs; drag points, insert midpoints, nudge/delete with the keyboard, and trace island openings. Turn controls show one incoming lane and its destinations, with an optional diagram. Physical pavement comes from kerb outlines independently of permitted movements.
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
7. Check the phone bottom sheet, landscape inspector, keyboard tab navigation and save/discard controls. Run **Structure** and **Check 3D** before exporting a design.

Automated coverage includes rule persistence, asymmetric fitting, infeasible limits, unchanged observed narrow bands, pavement/trunk behavior, tree-pit holes, reciprocal disconnection, repeated junction rebuilds, movement persistence, connected-width adaptation and separation of bridge/ground roads. Browser QA additionally exercises the responsive controls and rendered geometry.

## Verification results

- `npm test`: **698 passed, 5 skipped** across 84 passing test files and two skipped files, including the shared-storage client and catalog isolation checks. The skipped checks require optional converter/IFC fixtures or the older val3dity executable at the repository's configured external path.
- `npm run build:pages`: TypeScript and the production Vite build with the GitHub Pages base path passed.
- `npm run test:backend`: **11 passed**, including authentication, CORS, revision conflicts, idempotent retries, retention and restart persistence. The Docker image was built and run with its persistent volume; an edited 1,276-vertex Mattentwiete document and revision 2 survived a container restart.
- Shared-project browser checks covered connect, create workspace/project, applied intersection autosave, reopening in a fresh page, detecting another writer's revision and saving the retained local design as a separate project. The dialog was verified at **1280 × 720** and **390 × 844**; its header remains above the toolbar and available while scrolling.
- Geometry regression coverage includes three-arm/four-arm junctions, the synthetic short-Hamburg fixture, the real Mattentwiete source and trace, missing endpoint inference, detached/crossing outlines, islands, repeated rebuilding, widened approaches and elevation steps. UI coverage includes whole-drag undo, unfinished-trace save blocking and opacity restoration on release/cancellation.
- **val3dity 2.7.0**, using the application's `--ignore204` profile, accepted all five Road MultiSurfaces in the traced Mattentwiete study. This is geometry validation under that profile, not a full CityJSON schema or traffic-design certification.
- Browser checks covered **1280 × 720**, **390 × 844** (compact and expanded) and **800 × 450**. Lane width changes updated the road and connected junction; movement disable/undo/redo/save worked; asymmetric fitting displayed its map limits; an infeasible envelope kept widths unchanged and disabled save. The saved, fitted road and junction passed both **Structure** and local **Check 3D**. The traced five-object Mattentwiete example also passed the app’s local **Check 3D** after save. Phone tracing was verified to hide the controls and restore them on cancellation.

The validation executable and synthetic QA documents are temporary local tools/fixtures, not application dependencies or replacement production data.

## Boundaries of the implementation

The builder supports local flat junctions. It rejects known non-flat/grade-separated inputs rather than flattening them. It does not author signals, priority, stop lines or crosswalk placement, and it does not simulate traffic or check vehicle swept paths. Connection curves do not automatically route around islands; crossings are reported for review. Existing source movement restrictions remain authoritative. Disabling a turn does not erase its pavement. Existing exact junctions require explicit generation or tracing before geometry changes. Imagery tracing is visual interpretation, with unknown source acquisition date and no asserted survey accuracy.

Rule profiles are project design policies with documented sources, not complete municipal approval rules. Source conversion does not automatically resize the city. Tree checks depend on loaded tree positions/trunk data; the width policy does not calculate the remaining unobstructed pedestrian envelope around furniture. Changes remain in the browser unless exported, saved locally or linked to a configured shared project. The [Docker storage service](../backend/README.md) is prepared and tested for later hosting; no public backend is deployed. The hosted frontend is updated separately by the project's deployment workflow.

See [data/rule provenance](transportation-provenance.md) and [UX, geometry and width research](road-ux-research.md) for the evidence and decisions.
