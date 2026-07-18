# City Editor

City Editor is a touch-friendly browser workspace for checking and editing CityJSON buildings and osm2streets-quality roads directly on a map. The Hamburg city-center demo opens automatically, so you can explore the interface before loading your own data.

![Hamburg buildings in City Editor](assets/readme/city-overview.jpg)

## Start the editor

Install [Node.js](https://nodejs.org/) 20 or newer, then run:

```powershell
npm ci
npm run dev
```

Open the local address printed in the terminal. No backend, Rust installation, or data download is needed for the built-in demo.

## Edit a building

1. Tap a building on the map.
2. Change its height, storeys, function, or roof type in **Building details**.
3. Choose **Make editable** only when you want to replace imported geometry with a parametric building that can be reshaped.
4. Use the larger action cards for footprint, position, floors, openings, or roof changes.
5. Choose **Export CityJSON** when you are ready to save or compare the result.

The close-up viewer uses the highest LoD stored for that building. Far-away buildings become inexpensive outlines or blocks so navigation stays responsive.

![Building details and highest-detail preview](assets/readme/building-editor.jpg)

## Edit a road

1. Choose **Roads**. Tap an existing road, choose **Load visible roads**, or choose **Draw a road**.
2. Shape the centreline on the map. Yellow handles move bends, white `+` handles add bends, and teal endpoints show places where roads can connect.
3. In **Lanes**, edit the road type, direction, speed, access, surface, and the width or order of each visible band. The preview uses the same surface styling as the map.
4. Open **Map layers** to switch between map and satellite imagery and adjust both imagery and road opacity.
5. Review the preview and choose **Save**. **Discard** is always available.

For imported osm2streets roads, ordinary attribute changes preserve the exact source polygons and vertices. Moving the centreline, changing widths, rearranging bands, splitting, or changing the curve intentionally rebuilds an editable road ribbon, and the editor warns before that happens.

![Touch-friendly exact road editing](assets/readme/road-editor.jpg)

## Save, compare, and continue later

Edits stay local until you export. **Export CityJSON** downloads a complete editable snapshot that can be reopened, compared, and changed again. A connected local Hamburg catalog can also write changed CityJSONSeq tiles back to disk.

For the optional complete Hamburg road catalog on Windows:

```powershell
.\PREPARE_HAMBURG_ROADS.cmd -Serve
```

The large generated catalog stays under `Data/` and is intentionally ignored by Git.

Architecture, data formats, osm2streets decisions, contributor commands, and the honest remaining roadmap are in [PROJECT.md](PROJECT.md).
