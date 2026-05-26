# Hamburg Hosted Data

Place small converted Hamburg CityJSONSeq demo tiles here so GitHub Pages serves
them from the same origin as the app.

Expected first demo file:

```text
prototype/public/data/hamburg/LoD2_565_5936_1_HH.city.jsonl
```

The FileLoader reads `prototype/public/data/manifest.json` and only shows the
hosted Hamburg quick sample when that file exists. This avoids CORS problems and
also avoids a broken demo button while the converted tile is not committed yet.

Keep this directory for small browser-safe fixtures only. Large citywide exports
belong in GitHub Releases, external object storage, or the future backend.
