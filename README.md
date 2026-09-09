# City Editor

Design streets, edit intersections and buildings, and keep the result in **CityJSON**. City Editor combines Hamburg's city data, satellite imagery, direct map handles and a single responsive inspector.

**[Open the live demo](https://cakirmert.github.io/webcityeditor/)** · [Run locally](#run-locally) · [Research and technical notes](#research-and-technical-notes)

![The current intersection editor: draggable kerbs on the map with one inspector](assets/readme/intersection-editor-current.jpg)

## Try the intersection in one minute

1. Open **Data → Try the Hamburg intersection**.
2. Choose **Roads**, then click the central junction or search **Mattentwiete** under **Find a loaded road**. Choose the **Intersection** result.
3. Boundary handles appear immediately. Drag a point; drag a smaller dot to add a corner. The pavement updates immediately. Use **Adjust boundary on map** to reactivate handles after another tool.
4. Switch between **Map** and **Satellite** above the map. Adjust **Road overlay**, or hold the eye button to compare the road with the imagery.
5. Open **Turns**, choose an incoming lane and enable or disable its numbered destinations. The incoming lane is blue; permitted turns are cyan and blocked turns remain visible in red.
6. Use **Undo** to review a change. Choose **Save intersection** to update the junction and its approach surfaces together.

The example includes a 28-point visual kerb trace and estimated approach widths. Parking allocations are illustrative; the source lane counts and directions are retained. The [original import](public/examples/hamburg-mattentwiete-source.json), [edited example](public/examples/hamburg-mattentwiete.json) and [comparison notes](docs/intersection-reference-study.md) make the changes inspectable.

The [eight-location satellite review](docs/intersection-validation-2026-09.md) compares the reference imagery, original import and automatic candidates separately. The audit checks **608 junctions**, including difficult cases that are blocked instead of silently overlapping another road. Automatic candidates still need visual correction where inferred widths, islands or short connecting roads differ from reality.

## Edit a road

Choose **Roads** and select a street. The same inspector holds its preview, properties and save controls. If another edit is already active, finish it or use the selected road's **Edit road** action.

| Tab | What you can do |
| --- | --- |
| **Lanes** | Select a band in the proportional street preview. Change width, type, surface, direction and order; add driving, cycling, sidewalk, parking or planting space. |
| **Shape** | Move centreline anchors, add bends with the white `+` handles, choose **Smooth** or **Straight**, adjust elevation or split a section. |
| **Connections** | Inspect Start/End joins, open their existing intersections, or construct one together with an unsaved road draft. |
| **Rules** | Review minimum/maximum widths, set left/right extent limits, fit widths into available space, and import or export a city policy. OSM refresh is under **Advanced**. |

![Road design with a live street preview and the lane controls in the same inspector](assets/readme/road-design-current.jpg)

Changes stay in a draft until **Save road changes** or **Save exact attributes**. Attribute-only edits can retain imported polygons. Moving a road, changing widths or reorganising its bands generates new geometry and previews connected junctions. **Discard** leaves the saved road as it was.

### Draw and connect a new road

1. Choose **Roads → Draw new road**.
2. Click along the centreline, including its bends. Press **Enter** or choose **Finish road**.
3. Set the cross-section in **Lanes** and review **Rules**. New bands start with the active policy's recommended widths.
4. Drag an endpoint onto a nearby teal connection target. Review the confirmed join in **Connections**.
5. Choose **Build intersection** to preview the junction together with the unsaved road. **Save intersection** commits both; **Discard** returns to the road draft. Ordinary road saves also construct confirmed coincident endpoint joins atomically.
6. In the intersection's **Roads** tab, select a street card to highlight its road and Start/End point. **Add another approach** lists named road-end cards with compass direction and distance.

A failed fit explains the conflict and preserves the draft. Excessive band widths and new overlap with other roads block saving, even for connected roads. Shared edges and retained source overlaps are allowed. Width fitting respects the project's limits and the available space on each side; maximums are editable project guardrails, not statutory limits. Existing trees on sidewalks, planted strips and traffic-island openings are allowed. Expanding driving, cycling or parking pavement onto a mapped trunk blocks saving.

## Shape an intersection

The intersection inspector separates its physical outline from its permitted movements:

- **Shape → Keep current** retains the saved surface.
- **Shape → Generate** connects the approach kerbs with curved returns. It is a starting point for a local, flat junction.
- **Trace from satellite** lets you click around the visible carriageway boundary. Extend the outline slightly into each approach, then choose **Finish**. A crossing or detached boundary cannot be saved.
- **Adjust boundary on map** provides draggable corners and midpoint insertion. With a point focused, arrow keys nudge it; **Shift + arrow** moves farther and **Delete** removes it. A whole drag is one undo step.
- **Trace an island** creates an opening for a raised island, median or tree bed. Islands must remain inside the boundary and separate from each other.
- **Turns** selects one incoming driving lane, cycle lane or sidewalk. Numbered curves and destination rows correspond; click either a curve or its checkbox to toggle that movement. The compact diagram stays visible below the controls.
- **Roads** names the junction, highlights connected approaches and their endpoints, opens road editing and adds/removes connections.

![Numbered cyan permitted turns and a red blocked turn, with the incoming lane highlighted blue](assets/readme/intersection-turns-current.jpg)

Automatic junctions follow connected road geometry changes. A manually traced outline remains fixed until you edit it; check its joins again after changing an approach. Islands are retained through save and reload, and the editor warns when a permitted connection crosses one.

Imagery makes a close visual reconstruction practical. It does not supply surveyed kerbs, current legal turn restrictions, vehicle turning envelopes or elevations. This editor handles flat local junction surfaces; complex grade-separated junctions, signals, stop lines and swept-path engineering need additional data and tools. See the [reference study](docs/intersection-reference-study.md).

## Work on an iPad or desktop

The editing workspace targets **tablet and desktop screens, starting at 768 CSS pixels wide**. The inspector stays on the right on iPad-sized screens, including touch devices. Its width is reduced on smaller tablets so the map remains usable. **Hide** exposes the map while retaining the draft; **Expand** gives the controls more room. Save/Discard stay in the inspector footer, and map zoom controls move to the left while editing roads. Phones are not a supported editing target.

On smaller tablets, **More** also holds structure/3D checks, building lists, planning and export. The menu opens over the map, with every action reachable.

![The road inspector and usable map at an iPad landscape viewport](assets/readme/intersection-ipad.jpg)

## Buildings, imagery and planning

The Hamburg overview streams city data as you move. Drag to pan; use the wheel, pinch or map `+`/`−` controls to zoom.

- Open **Map layers** outside road mode to change the basemap, opacity, building usage colours and available photo textures.
- Select a building to inspect its attributes and available **LoD2 / LoD3** detail. Use **Start editing position** to move it or **Make editable** for footprint, roof, opening and part edits.
- Building parts are grouped under **Browse parts**. The panel uses actual names or part IDs, and labels an item as a floor only when floor metadata exists.
- Choose **New Building** for a ready-made example or **Draw a custom building**, then place its footprint on the map.
- Choose **Planning** to inspect Hamburg's planning areas and their legend. Select a coloured area for its category.

![Hamburg's official textured LoD3 buildings rendering in the current editor](assets/readme/hamburg-lod3-textured.jpg)

Hamburg tile requests now use the serving `www.daten-hamburg.de` hostname directly, avoiding the redirect that caused browser **Failed to fetch** errors. The overview uses lightweight LoD1, then close-range LoD3; **Photo textures** switches between textured and untextured geometry. LoD2 remains available to the source-building conversion path.

## Save, check and export

| Action | Result |
| --- | --- |
| **Save road / Save intersection** | Applies the draft to the loaded CityJSON document. |
| **More → Undo / Redo** | Reverses or reapplies document changes. Drafts also have their own Undo / Redo controls. |
| **More → Save local** | Keeps a copy in this browser's local storage. |
| **Data** | Loads CityJSON, CityJSONSeq, bundled examples or a local save. |
| **Structure** | Checks document references and structure in the browser. |
| **Check 3D** | Runs primitive geometry validation through the configured local val3dity service. |
| **Export CityJSON** | Downloads the loaded buildings, roads, junctions, attributes and edits together. |

Road and intersection save operations are guarded against structural damage. Resolve blocking geometry/fit errors before export. A **Structure** pass and a **Check 3D** pass answer different questions; neither certifies traffic engineering or municipal design compliance.

## Shared projects and the optional backend

The editor is live on [GitHub Pages](https://cakirmert.github.io/webcityeditor/). Shared server storage is **prepared for later hosting**; the public site does not currently include a hosted database.

Open **Projects**. Once you have a storage server, enter its HTTPS address and access key, create a workspace and choose **Save as new project**. Applied road and building changes then save automatically. Wait for **Saved to server** before closing; reconnect and open the same project to continue on another device.

![Shared workspace with saved design alternatives and revision status](assets/readme/shared-projects.png)

*Screenshots show a local test server. The public demo is ready to connect when you host the Docker service.*

Different workspaces organize your team's projects. Revision checks stop collaborators from overwriting one another silently. If someone saves first, open their latest version or keep your work as a new project. A newer version is announced every 20 seconds; changes are not automatically merged.

The optional service starts with two commands on a computer with Docker running:

```powershell
npm run backend:setup
npm run backend:up
```

It uses a persistent SQLite volume and retains the last 20 revisions. Local browser saves and CityJSON export continue to work without it. See the [backend setup and API guide](backend/README.md) for the access key, local connection, later HTTPS hosting, backups and replacing the storage implementation.

## Run locally

Use Node.js 20.19+ or 22.12+ and a browser with WebGL2:

```powershell
npm ci
npm run dev:frontend
```

Open the address printed by Vite. The bundled intersection study works with this frontend command; live imagery and remote Hamburg layers require a network connection.

For a prepared local building catalog and validation service, use `npm run dev:hamburg-buildings`; for a prepared road catalog, use `npm run dev:hamburg-roads`. See [PROJECT.md](PROJECT.md) for data preparation and val3dity configuration. A validator executable is an optional local dependency and is not bundled in the website.

```powershell
npm test
npm run build
```

## Research and technical notes

| Document | Contents |
| --- | --- |
| [Eight-intersection review and audit](docs/intersection-validation-2026-09.md) | Labeled satellite/source/candidate comparisons, reproducible tools, the 608-junction audit and explicit blocked cases. |
| [Intersection reference study](docs/intersection-reference-study.md) | Selected real junction, original/edited data, satellite comparison, width estimates and remaining uncertainty. |
| [UX and width-policy research](docs/road-ux-research.md) | PTV Vissim, SUMO NetEdit and Godot patterns; geometry alternatives; Hamburg ReStra sources and project assumptions. |
| [Transportation provenance](docs/transportation-provenance.md) | OSM → osm2streets → CityJSON, upstream rule audit and CityJSON Transportation semantics. |
| [Handoff and verification](docs/road-editor-handoff.md) | Delivered behavior, regression checks and implementation limits. |
| [Backend setup and API](backend/README.md) | Docker, persistent workspaces, revision conflicts, backups and the replaceable storage contract. |
| [PROJECT.md](PROJECT.md) | Architecture, datasets, converter commands and contributor notes. |

The map retains attribution for OpenStreetMap, Hamburg's building/tree/planning data, Esri World Imagery and BKG TopPlusOpen. Current road, intersection and Hamburg LoD3 screenshots were captured from the running editor on 9 September 2026. Shared-project screenshots show the earlier local Docker test server.
