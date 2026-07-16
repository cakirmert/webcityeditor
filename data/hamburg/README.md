# Hamburg Hosted Demo Data

The default `npm run dev` and GitHub Pages showcase uses two committed,
same-origin files:

```text
hamburg-city-center-buildings.city.jsonl
hamburg-city-center-roads.osm
```

The CityJSONSeq file contains 1,353 official Hamburg LoD2-DE buildings. The OSM
file contains a compact reference-complete road crop for the Elbe waterfront /
HafenCity through Rathaus to Jungfernstieg. On startup the browser runs that OSM
crop through the same forked osm2streets WASM path used by the **Fetch Roads**
button, so lane polygons, intersections, and markings share the richer live-road
rendering.

Regeneration:

```text
npm run data:hamburg-center
python -m pip install osmium
npm run data:hamburg-center:osm
```

The building command reads the prepared official LoD2 catalog. The OSM command
reads `Data/hamburg-osm/hamburg-latest.osm.pbf` and omits fine-grained footways,
paths, steps, and construction ways to keep browser startup responsive. Pass
`--include-all-highways` directly to the Python script when a complete
`highway=*` extract is required.

Whole-city building and road catalogs remain ignored under `Data/` and are
served through the optional local catalog workflows.
