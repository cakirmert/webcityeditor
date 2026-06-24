# osm2streets Hamburg Regression Fixtures

These fixtures are small, committed OSM XML snippets that exercise Hamburg-style
road tags without relying on live Overpass.

They are not a replacement for real Hamburg viewport testing. They are a fast
regression layer for comparing the forked osm2streets WASM package against the
native Rust executable built from the same fork:

- `sidewalk:both=separate`
- one-sided `sidewalk:right=separate`
- short intersection geometry
- parallel one-way roads that can later be used for dual-carriageway checks

Run:

```powershell
npm run osm2streets:compare
```

The script builds `webcityeditor_native_export`, runs both the WASM package and
native executable on the same fixture cut, writes both result sets to
`prototype/test-output/osm2streets-comparison/`, and fails if:

- either runner falls below the minimum counts in `fixtures.json`
- either runner emits an error
- warning/error diagnostics differ
- normalized lane polygons, lane markings, intersection markings, or
  `network.json` differ
