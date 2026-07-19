# City Editor

City Editor is a touch-first browser editor for inspecting and editing buildings and transportation surfaces in one CityJSON working document. It keeps the map, source geometry, attributes, validation, and export in the same workflow.

The built-in Hamburg city-center demo opens automatically with **1,353 buildings**, **1,608 roads**, and **1,042 junctions**. Its wider LoD2 context contains **68 photo-textured LoD3 buildings** at their real coordinates. The road and junction polygons are precomputed with osm2streets, so the demo does not need a backend, Rust, Overpass, or startup OSM conversion. Close views optionally stream Hamburg's official 3D street trees.

![Centered Hamburg CityJSON overview with buildings and transportation geometry](assets/readme/city-overview.jpg)

## Run locally

Install [Node.js](https://nodejs.org/) 20 or newer, then run:

```powershell
npm ci
npm run dev
```

Open the local address printed in the terminal. The committed Hamburg demo and the browser build are enough for the default workflow.

## Find your way around

- The top bar reports the file name, CityJSON version, building, road, and junction counts, highest loaded LoD, texture/opening status, vertex count, CRS, and both validation states.
- The search bar filters buildings by ID, function, or year. **More filters** adds type, roof, year, height, and storey filters; **List** provides sortable results and map selection.
- **Roof** and **Usage** recolor the buildings without changing their source attributes.
- **Map layers** in the upper-left switches between the light map, official BKG **TopPlusOpen**, and satellite imagery; it also controls satellite opacity, road-overlay opacity, and source-detail status.
- **Planning** loads the supported Hamburg planning overlay for the current, safely bounded view.

## Inspect and edit buildings

1. Tap a building to open its inspector and highest-detail 3D preview.
2. Switch the preview between **By surface**, **By object**, and **By usage** to inspect its structure.
3. Edit common source attributes such as height, storeys, function, and roof type under **Building details**.
4. Choose **Start editing position** to move the building while keeping its ground aligned with nearby terrain.
5. Use **Revert this building** if you want to restore the loaded attributes before export.

Imported source geometry remains read-only for topology-changing tools. Choose **Make editable (replace with parametric)** only when you intentionally want to replace it with an editable footprint, roof, openings, overhangs, or subdivisions. Ordinary attribute edits do not require that conversion.

![Building attributes and highest-detail preview](assets/readme/building-editor.jpg)

### Add a building

Choose **New Building** to open the current building chooser:

- Place the included **Round courtyard** or **Industrial hall** LoD3 asset, then tap the map to position it.
- Choose **Draw a custom building**, tap at least three corners, and choose **Use outline**.
- Set the height, roof, windows, and internal parts in the preview before choosing **Create Building**.

For a custom building, **Separate editable parts** is optional:

- **Keep one building** is the simple default.
- **Make floors independent** creates separately editable storeys.
- **Make side-by-side wings** creates separately editable building sections.

The map uses three clear, non-overlapping stages: LoD0 footprints for the overview, source LoD2 in the middle range, and textured LoD3 only when you are very close. The Hamburg LoD3 subset retains 68 JPG texture atlases, UV coordinates, and detailed installations. Windows can therefore be visible in the facade photographs even when the source does not encode separate semantic Window or Door surfaces. The buildings come from Hamburg's [official LoD3.0 dataset](https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5), and close views add 2,110 measured trees from its official [3D street-tree register](https://metaver.de/trefferanzeige?docuuid=24513F73-D928-450C-A334-E30037945729), published by Freie und Hansestadt Hamburg, LGV under Datenlizenz Deutschland – Namensnennung 2.0. The optional [TopPlusOpen](https://sg.geodatenzentrum.de/web_public/gdz/dokumentation/deu/TopPlusOpen.pdf) basemap is provided by the Federal Agency for Cartography and Geodesy (BKG).

## Edit roads and junctions

1. Choose **Roads**. The panel reports the loaded CityJSON roads and junctions while keeping the map available for selection.
2. Tap a road and choose **Edit road**. Its exact osm2streets lane polygons are already stored in CityJSON.
3. Use **Road on the map** to select a coloured band and change its type, surface, width, direction, order, or presence with touch-sized controls.
4. Drag a yellow anchor to move a bend, tap a white `+` to add one, or drag an end onto a teal target to confirm a connection.
5. Choose **Smooth** or **Straight** for the road curve, and split a road when its lane layout changes along the section.
6. Switch between **Map** and **Satellite** in the road panel. Satellite imagery and the CityJSON road overlay have separate opacity controls.

Lane dividers and source-directed arrows are rendered from the saved road bands. Type, direction, material, access, and speed edits show **Exact source polygons protected** and leave the original boundaries and global vertex array unchanged. Moving a handle, changing width or band order, adding or removing a band, splitting a section, or changing the curve mode rebuilds only that road around its preserved source centreline.

The save button reflects the pending operation: **Save exact attributes**, **Save road changes**, or **Save new road**. **Discard** leaves the saved CityJSON unchanged.

![Exact CityJSON road editing with on-map band controls](assets/readme/road-editor.jpg)

## Load, validate, and save data

Choose **Data** to drop or browse for a monolithic CityJSON file or a `.jsonl`/CityJSONSeq file. The same panel can reload the hosted Hamburg demo, open the sample cube, or connect to the optional local Hamburg CityJSONSeq catalog. The catalog streams strict tiles as the camera moves instead of loading a whole-city file into the browser at once.

Secondary data tools live under **More**:

- **Save local** stores the current working document in browser IndexedDB.
- **Merge file** adds another CityJSON document to the current one.
- **Import IFC** places an IFC building model into the CityJSON scene.
- **Export glTF** downloads the rendered geometry as binary glTF.
- **Undo** and **Redo** cover building and road edits.

**Structure** checks CityJSON integrity. **Check 3D** validates edited geometry; geometry-changing operations mark it for another check before export.

Choose **Export CityJSON** to download one complete snapshot containing the current buildings, roads, junctions, attributes, and editable road layouts. Load that snapshot through **Data** later to compare it or continue editing. Nothing is written back to a source file or catalog unless you explicitly use its save action.

## Touch and small screens

Drawing and editing use pointer events and touch-sized controls. Custom buildings use **Use outline** rather than a double-click, and road editing always exposes an explicit save or discard action.

On a phone, the primary toolbar keeps **Data**, **Roads**, **New Building**, and **More** visible. Building list, planning, export, validation, and secondary actions remain available in the touch-sized **More** menu.

Architecture, formats, data provenance, contributor commands, and the remaining roadmap are documented in [PROJECT.md](PROJECT.md).
