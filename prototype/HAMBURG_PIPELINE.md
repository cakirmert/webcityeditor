# Hamburg Whole-City LoD2 Pipeline

Goal: turn Hamburg's authoritative complete-city LoD2 release into a dependable,
editable CityJSON source for the prototype. Keep the result tiled. A complete
Hamburg export is several gigabytes after conversion and must not be loaded into
one browser document.

The repository now includes a batch command that resolves the newest official
release, downloads and extracts it on demand, converts every CityGML tile to
CityJSONSeq, validates each converted tile, emits a catalog, and serves the
catalog locally. It also audits geometric primitives with `val3dity` and can
build a strict editing catalog while retaining defective source features in a
quarantine directory for later repair.

---

## 1. Authoritative Source

Hamburg's official source is the LGV LoD2-DE dataset:

- Portal: <https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod2-de-hamburg2>
- Machine-readable metadata:
  <https://suche.transparenz.hamburg.de/api/3/action/package_show?id=3d-gebaeudemodell-lod2-de-hamburg2>
- License: Datenlizenz Deutschland - Namensnennung - 2.0
- Attribution: Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und
  Vermessung (LGV)

As of 2026-06-01, the newest listed archive is:

```text
LoD2-DE_HH_2026-04-28.zip
https://daten-hamburg.de/opendata/3d_stadtmodell_lod2/LoD2-DE_HH_2026-04-28.zip
659,524,658 bytes
```

The portal describes this as a complete-city CityGML 1.0 download covering
roughly 750 km2, including Neuwerk. Its ground plans come from the official
digital cadastral map; roof forms are generated from point clouds and image
matching. Individual models are not manually corrected, so geometry validation
still matters.

Hamburg does **not** currently publish an official native CityJSON LoD2 archive.
The portal's JSON resource is a 3D Tiles tileset for web viewing. It is useful as
a visual reference, but it is not an editable CityJSON source and should not be
reverse-converted.

---

## 2. Output Shape

The supported preparation flow is:

```text
Official complete-city CityGML ZIP
       |
       | npm run data:hamburg-lod2 -- download
       | npm run data:hamburg-lod2 -- extract
       v
CityGML tiles (.xml/.gml)
       |
       | npm run data:hamburg-lod2 -- convert
       v
Validated CityJSONSeq tiles (.city.jsonl)
       |
       +-- catalog.json
       +-- logs/*.log
       +-- optional logs/*.cjval.log
       |
       | npm run data:hamburg-lod2 -- geometry-audit --allow-invalid
       | npm run data:hamburg-lod2 -- geometry-clean
       v
Primitive-valid CityJSONSeq editing tiles + quarantined source features
       |
       | npm run data:hamburg-lod2 -- serve --output-dir ../Data/hamburg-lod2/cityjsonseq-clean
       v
Local bbox-queryable tile catalog on http://127.0.0.1:8787
```

CityJSONSeq is the primary city-scale input shape: every line after the header
is one independent `CityJSONFeature` with local vertices. The prototype loads
individual `.city.jsonl` files directly, and its **Connect catalog** action
queries strict sequence tiles by viewport. Adjacent source tiles can have
different local transforms, so the browser normalizes them onto the first
loaded tile's integer grid with an exactness check before merging them into the
current editable viewport document. Export remains ordinary CityJSON. When the
user chooses **Save seq**, the editor reconstructs edited source feature lines
in each tile's original integer grid and persists them through the local
server. Directly loaded `.city.jsonl` files also use strict line parsing:
malformed feature lines are surfaced instead of being silently skipped.

The generated `catalog.json` records each tile's EPSG:25832 extent, feature
count, CityObject count, vertex count, and any synthesized roots. The local
server exposes:

```text
GET /health
GET /api/hamburg/catalog
GET /api/hamburg/tiles?bbox=minX,minY,maxX,maxY
GET /tiles/LoD2_32_565_5936_1_HH.city.jsonl
PUT /api/hamburg/tiles/LoD2_32_565_5936_1_HH
DELETE /api/hamburg/tiles/LoD2_32_565_5936_1_HH
```

---

## 3. Install Once

Required:

```text
Node.js 20+
Java 17+
tar
citygml-tools 2.4.0 recommended
```

Download `citygml-tools` from:
<https://github.com/citygml4j/citygml-tools/releases>

Unzip it under `tools/`. The batch script automatically checks these local
folders before falling back to `PATH`:

```text
tools/citygml-tools-2.4.0/
tools/citygml-tools-2.3.2/
tools/citygml-tools-2.3.0/
```

For the official CityJSON schema gate, install `cjval`:

```bash
cargo install cjval --features build-binary
```

`cjval` is the CityJSON project's validator for CityJSON and CityJSONSeq. The
batch script always runs its own streaming structural checks; passing
`--cjval cjval` adds the complete schema gate.

For ISO 19107 geometric primitive validity, install `val3dity`:

```text
https://github.com/tudelft3d/val3dity/releases
```

Unzip it under `tools/val3dity-2.6.0/`. The batch script checks that local path
before falling back to `PATH`.

Optional later backend tools:

```text
Docker
3DCityDB v5 image
citydb-tool
```

---

## 4. Prepare The Whole City

Run from `prototype/`.

Inspect the live portal metadata and selected release:

```bash
npm run data:hamburg-lod2 -- latest
```

Download and extract the newest complete-city archive:

```bash
npm run data:hamburg-lod2 -- download
npm run data:hamburg-lod2 -- extract
```

Before the full batch, prove one tile:

```bash
npm run data:hamburg-lod2 -- convert --match LoD2_32_565_5936_1_HH --limit 1 --cjval cjval
```

Then convert and validate the complete city:

```bash
npm run data:hamburg-lod2 -- convert --cjval cjval
npm run data:hamburg-lod2 -- validate --cjval cjval
npm run data:hamburg-lod2 -- geometry-audit --allow-invalid
npm run data:hamburg-lod2 -- geometry-clean
```

Default local output:

```text
Data/hamburg-lod2/
├── downloads/
├── source/
├── release.json
├── cityjsonseq/            # untouched authoritative conversion
├── geometry-audit/         # per-tile primitive defect reports
├── quarantine/             # retained primitive-invalid originals
└── cityjsonseq-clean/      # strict editing catalog
```

Useful options:

```text
--data-dir PATH
--source-dir PATH
--output-dir PATH
--match TEXT
--limit N
--force
--converter PATH
--cjval PATH
--val3dity PATH
--report-dir PATH
--clean-dir PATH
--quarantine-dir PATH
--allow-invalid
--skip-fallback
```

The converter runs `citygml-tools to-cityjson -l -c -e 25832` tile by tile. It
then streams every generated file through the repository validator before
accepting it. A bad tile fails the batch instead of quietly entering the editor.

For an already extracted CityGML archive, skip download and extraction:

```bash
npm run data:hamburg-lod2 -- convert --source-dir ../Data/extracted/LoD2_CityGML_HH_2016
```

---

## 5. Validation Gates

Use all applicable gates before treating a Hamburg release as production-ready:

1. Validate CityGML XML against CityGML schemas:

   ```bash
   citygml-tools validate ../Data/hamburg-lod2/source
   ```

2. Convert with the mandatory repository structural validator:

   ```bash
   npm run data:hamburg-lod2 -- convert
   ```

3. Run the official CityJSONSeq schema validator:

   ```bash
   npm run data:hamburg-lod2 -- validate --cjval cjval
   ```

4. Load at least one generated `.city.jsonl` tile in the editor, move an
   imported building, export, reopen the saved file, and run the editor
   integrity check.

5. Audit ISO 19107 geometric primitive validity and isolate any crashing
   features:

   ```bash
   npm run data:hamburg-lod2 -- geometry-audit --allow-invalid
   ```

6. Build the strict editing catalog. Primitive-invalid originals remain under
   `quarantine/` for repair:

   ```bash
   npm run data:hamburg-lod2 -- geometry-clean
   npm run data:hamburg-lod2 -- geometry-audit \
     --output-dir ../Data/hamburg-lod2/cityjsonseq-clean \
     --report-dir ../Data/hamburg-lod2/geometry-audit-clean
   ```

The built-in streaming validator rejects malformed JSON, missing CityJSONSeq
headers, invalid transforms, missing CRS metadata, omitted roots that cannot be
reconstructed, dangling parent/child links, asymmetric hierarchy links,
duplicate CityObject IDs, invalid vertices, out-of-range geometry references,
and invalid semantic indices.

---

## 6. Serve Tiles Locally

Start the lightweight local catalog server:

```bash
npm run data:hamburg-lod2 -- serve \
  --output-dir ../Data/hamburg-lod2/cityjsonseq-clean
```

Examples:

```text
http://127.0.0.1:8787/health
http://127.0.0.1:8787/api/hamburg/catalog
http://127.0.0.1:8787/api/hamburg/tiles?bbox=565000,5936000,566000,5937000
```

Open the editor and use **Connect catalog** with:

```text
http://127.0.0.1:8787
```

The initial request loads a bounded Hamburg-centre viewport. Panning the map
automatically queries the catalog and fetches only unseen nearby `.city.jsonl`
tiles. The toolbar's **Seq tiles N** button reports the working-set size and can
manually retry the current viewport. Requests above 25 unseen tiles are refused
until the user zooms in, preventing an accidental whole-city browser load.

After an edit, the toolbar's **Save seq** button reconstructs each affected
feature line in the source tile's local coordinate grid and writes the tile
back atomically. The server requires SHA-256 `If-Match` revisions, queues
concurrent writes, retains the previous tile under `.history/`, runs structural
validation and bundled `val3dity`, then updates `catalog.json`. Deleting the final feature
from a sparse tile removes that tile from the catalog atomically instead of
writing an invalid header-only file. Clean off-screen tiles unload
automatically; dirty tiles stay resident until saved.

The next backend slice is incremental downstream regeneration and optional
database-backed publication for multi-user deployment.

---

## 7. Optional 3DCityDB Round-Trip

The file conversion path does not require a database. Add 3DCityDB when testing
server-side storage and export:

```yaml
services:
  postgres:
    image: 3dcitydb/3dcitydb-pg:16-3.5-5.0
    environment:
      POSTGRES_DB: citydb
      POSTGRES_USER: citydb
      POSTGRES_PASSWORD: citydb
      SRID: 25832
    ports:
      - "5432:5432"
    volumes:
      - citydb-data:/var/lib/postgresql/data

volumes:
  citydb-data:
```

```bash
docker compose up -d

citydb import citygml \
  --db-host localhost \
  --db-port 5432 \
  --db-name citydb \
  --db-user citydb \
  --db-password citydb \
  ../Data/hamburg-lod2/source/LoD2_32_565_5936_1_HH.gml
```

Capture skipped features, attribute coercions, and exported feature-count
deltas. The database round-trip is a separate persistence proof; it is not a
prerequisite for generating clean editable CityJSONSeq tiles.

---

## 8. Current Evidence

Verified locally on 2026-06-01 with the current official archive:

- Downloaded `LoD2-DE_HH_2026-04-28.zip` from the official portal and matched
  its published 659,524,658-byte size.
- Extracted 783 CityGML tiles.
- `citygml-tools validate` passed on all 783 source GML files.
- Converted all 783 source tiles with `citygml-tools 2.3.0`.
- Repository streaming validation passed during conversion and again as an
  explicit second pass with zero structural failures.
- Generated 388,729 building features, 7,391,235 vertices, and 863,708,269
  bytes of editable CityJSONSeq output. No synthetic root repairs were needed.
- A full isolated `val3dity 2.6.0` audit checked all 388,729 source features.
  It found 3,338 primitive-invalid features and 49 additional features that
  crash the validator. These are source-model defects, not CityJSON structural
  failures.
- The strict editing build quarantined those 3,387 originals, retained them for
  repair, and emitted 385,342 primitive-valid features across 782 tiles. One
  sparse source tile was omitted because its only feature was quarantined.
- A second full `val3dity` pass over the strict editing set completed with zero
  primitive-invalid features and zero validator crashes.
- Local strict-catalog serving reported all 782 editing tiles, bbox lookup
  returned the centre tile, and direct centre-tile delivery returned HTTP 200.
- The editor-library move/save/reopen smoke test passed on the strict generated
  centre tile: parse, move imported building, compact, serialize, reopen, and
  structural integrity check.
- The catalog client loaded a real nine-tile strict centre viewport, fetched
  unseen adjacent sequence tiles after a simulated pan, normalized their
  differing local transforms exactly, moved an imported building, compacted
  the multi-tile working set, serialized, reopened, and passed integrity checks.
- A disposable strict HTTP server copied the current centre tile, moved one
  real feature by exactly 1 m, required a SHA-256 `If-Match` revision, retained
  a `.history/` backup, accepted the replacement through `val3dity`, and served
  the changed tile again.
- A generated two-floor hierarchy with independent upper-floor footprint
  sections serialized as one `CityJSONFeature` and passed `val3dity`.

Still required for release acceptance:

- Install `cjval` and run the whole generated city through it.
- Run the user's manual browser editor move/save acceptance check on a current
  2026 generated tile.
- Repair and re-audit the quarantined originals if the handoff requires every
  source building rather than the strict 385,342-feature editing catalog.
