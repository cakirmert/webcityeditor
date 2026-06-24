# osm2streets Hamburg Regression Fixtures

These fixtures are small, committed OSM XML snippets that exercise Hamburg-style
road tags without relying on live Overpass.

They are not a replacement for real Hamburg viewport testing. They are a fast
regression layer for the forked osm2streets WASM path:

- `sidewalk:both=separate`
- one-sided `sidewalk:right=separate`
- short intersection geometry
- parallel one-way roads that can later be used for dual-carriageway checks

Run:

```powershell
npm run osm2streets:compare
```

The script compares actual forked-WASM output counts against the minimum counts
in `fixtures.json` and fails on any `console.error` emitted by the WASM bridge.
