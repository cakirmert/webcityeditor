# City Editor

City Editor is a touch-friendly map for editing buildings and osm2streets-quality roads in one CityJSON file. The Hamburg demo opens automatically with 1,353 buildings and 1,608 editable CityJSON roads—no server or OSM conversion is needed at startup.

![Hamburg buildings in City Editor](assets/readme/city-overview.jpg)

## Start the editor

Install [Node.js](https://nodejs.org/) 20 or newer, then run:

```powershell
npm ci
npm run dev
```

Open the local address printed in the terminal. No backend, Rust installation, or data download is needed for the built-in demo.

## Add or edit a building

Choose **New Building**. You can place one of the included, officially textured Hamburg LoD3 buildings, or choose **Draw a custom building** and tap its corners on the map.

For a custom building, **Separate editable parts** is optional:

- **Keep one building** is the simple default.
- **Make floors independent** creates separately editable storeys.
- **Make side-by-side wings** creates separately editable building sections.

To edit an existing building:

1. Tap it on the map to open its attributes.
2. Change its height, storeys, function, or roof type in **Building details**.
3. Choose **Start editing position** to move it while keeping its ground aligned with nearby terrain.
4. Choose **Make editable** only when you intentionally want to replace imported geometry with a reshaped parametric building.
5. Export CityJSON when you are ready to save or compare the result.

The default map now includes a surveyed district of **24 textured LoD3 buildings** at their real Hamburg coordinates, surrounded by the wider LoD2 city context. Detail blends continuously from overview footprints to blocks and then to the source geometry across 3.5 zoom levels; it does not jump after one wheel step. The toolbar says LoD3 because LoD3 is genuinely loaded. Texture-visible windows are retained, while the app does not invent semantic Window or Door surfaces that the source omits. The included placement assets come from the same [official Hamburg LoD3.0 source](https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5).

![Building details and highest-detail preview](assets/readme/building-editor.jpg)

## Edit a road

1. Choose **Roads**, then tap a road on the map.
2. Choose **Edit road**. Its exact osm2streets polygons are already stored in CityJSON.
3. Use the large **Road on the map** workspace along the bottom. Tap a coloured band and change its type, surface, width, direction, order, or add/remove bands in the same place.
4. Drag yellow handles to bend the road, tap white `+` handles to add a bend, and drag an end onto a teal dot to confirm a connection.
5. Switch between **Map** and **Satellite** inside the road sheet. Satellite and road opacity have separate sliders.
6. Choose **Save** or **Discard**.

The road's shape is controlled directly on the map; there is no abstract curve-strength slider. Attribute-only changes preserve the exact source vertices. Moving a handle, changing width/order, splitting, or changing between smooth and straight deliberately rebuilds only that road and is clearly labelled before save.

![Touch-friendly exact road editing](assets/readme/road-editor.jpg)

## Save, compare, and continue later

Edits stay local until you export. **Export CityJSON** downloads one complete snapshot containing both buildings and roads. Reopen it later to compare or continue editing.

To draw a custom building, choose **New Building → Draw a custom building**, tap at least three corners, choose **Use outline**, review the preview, then choose **Create Building**. This works with touch and does not require a double-click.

On a phone, the toolbar keeps only **Data**, **Roads**, **New Building**, and **More** visible. Building list, planning, export, validation, and developer actions remain in the large **More** menu.

Architecture, formats, data provenance, contributor commands, and the honest remaining roadmap are in [PROJECT.md](PROJECT.md).
