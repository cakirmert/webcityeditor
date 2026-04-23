# Hamburg Pilot Pipeline

Goal: take a small patch of Hamburg's authoritative LoD2 data, convert it to CityJSON that our prototype can load, import it into 3DCityDB to verify the full pipeline works, and document anything that breaks along the way.

This is runnable on your machine with Docker + Java installed — **I can provide scripts, but you run them** since they require local downloads and containers that can't be driven from inside the conversation.

---

## 1. What we're trying to prove

Per the approval doc (§S19) and memory notes:

- Hamburg's **direct CityJSON** exports have known quality problems. Don't use them.
- Hamburg's **authoritative LoD2 is CityGML v1.0** on the Transparenzportal. This is the clean source.
- 3D Tiles is an **output format**, never an input. No conversion back to CityJSON.

Pipeline we're validating:

```
Hamburg Transparenzportal (CityGML v1.0, .gml/.zip)
       │
       │  (1) spatial subset — take ~1 km² to keep file sizes sane
       ▼
subset.gml (CityGML v1.0)
       │
       │  (2) citygml-tools to-cityjson
       ▼
subset.city.json (CityJSON 2.0)
       │
       │  (3) cjio validate
       ▼
validation report
       │
       │  (4) citydb-tool import into 3DCityDB v5
       ▼
rows in 3DCityDB
       │
       │  (5) optional: citydb-tool export back to CityJSON for the prototype
       ▼
Load in city editor prototype
```

Each step is a potential point of data loss. We want to know where.

---

## 2. Data sources

### CityGML download

Hamburg's LoD2 ATOM feed:

- Portal: https://suche.transparenz.hamburg.de/dataset/3d-stadtmodell-lod2-de-hamburg2
- Files are per-district 10km × 10km `.gml.zip` (roughly 50–200 MB each).
- Latest model: 2025, derived from ALS 2022 + image-matching 2024.

For the pilot, pick **one small district close to the centre** (e.g. around Rathausmarkt). The file `LoD2_HH_582_5934_1_HH.gml.zip` or similar covers a named 1 km area. 3DBAG tiles span 1 km × 1 km, for comparison.

### Alternate (smaller) starting point

If Hamburg's files are too large to iterate on, **3DBAG remains our primary test dataset** — tile `9-284-556.city.json` (~1 MB) is known-good CityJSON 2.0 and loads in the prototype directly.

---

## 3. Tools (install once)

```bash
# Java 21+ (for citygml-tools and citydb-tool)
# Pick your platform's install method (apt / brew / scoop / manual zip).

# citygml-tools (CityGML ↔ CityJSON ↔ KML ↔ OBJ ↔ glTF conversion)
# https://github.com/citygml4j/citygml-tools/releases
wget https://github.com/citygml4j/citygml-tools/releases/download/v2.2.0/citygml-tools-2.2.0.zip
unzip citygml-tools-2.2.0.zip
export PATH=$PATH:$PWD/citygml-tools-2.2.0

# cjio (CityJSON validation CLI; Python)
pip install cjio

# citydb-tool (3DCityDB v5 import/export)
# https://github.com/3dcitydb/citydb-tool/releases
wget https://github.com/3dcitydb/citydb-tool/releases/download/v1.3.0/citydb-tool-1.3.0.zip
unzip citydb-tool-1.3.0.zip
export PATH=$PATH:$PWD/citydb-tool-1.3.0

# Docker (for 3DCityDB Postgres container)
# https://docs.docker.com/get-docker/
```

Verify:

```bash
citygml-tools --version    # should print 2.2.x
cjio --version              # 0.9.x or similar
citydb --version            # 1.3.x
docker --version
```

---

## 4. Step-by-step

### Step 1 — Download and subset

```bash
mkdir -p hamburg-pilot && cd hamburg-pilot

# Pick one tile from the ATOM feed; replace with the actual file you downloaded.
unzip LoD2_HH_582_5934_1_HH.gml.zip
# Result: LoD2_HH_582_5934_1_HH.gml  (could be ~50-200 MB of XML)

# Option A: work with the whole tile. File count per tile is usually <10k
#   buildings which the prototype can still hold comfortably.
ln -s LoD2_HH_582_5934_1_HH.gml subset.gml

# Option B: cut a smaller bbox with citygml-tools' "clip" or ogr2ogr. If you
# hit render slowness in the prototype, reach for this.
```

### Step 2 — CityGML → CityJSON

```bash
citygml-tools to-cityjson subset.gml \
    --output subset.city.json \
    --cityjson-version 2.0

# Expected output: a single .city.json file, ideally a few MB for one tile.
# Report anything that prints on stderr — warnings are informative.
```

**Likely warnings to expect** (not failures, just loss signals):

- `ImplicitGeometry skipped (no geometry)` — harmless, template trees etc.
- `Non-planar polygon / warning: polygon is non-planar` — real warning; these surfaces may render oddly.
- Reversed winding on some faces — renderable but val3dity will flag them.
- `Texture resolution X not supported` — LoD2 usually has no textures, ignore.

### Step 3 — CityJSON validation

```bash
cjio subset.city.json validate

# Reports structural + schema issues. Two kinds of messages:
#   - "Schema validation: OK"  → passes spec
#   - "Schema validation: errors found" → needs fixing before DB import
```

If the schema validation fails:

```bash
# Try repair round-trip
cjio subset.city.json repair --output subset.repaired.city.json
cjio subset.repaired.city.json validate
```

Log whichever errors appear — they are the concrete evidence for "Hamburg needs cleanup before it can round-trip cleanly" in the HiWi report.

### Step 4 — Spin up 3DCityDB v5 + Postgres

`compose.yml`:

```yaml
services:
  postgres:
    image: 3dcitydb/3dcitydb-pg:16-3.5-5.0
    environment:
      POSTGRES_DB: citydb
      POSTGRES_USER: citydb
      POSTGRES_PASSWORD: citydb
      SRID: 25832          # Hamburg's CRS (UTM zone 32N)
    ports:
      - "5432:5432"
    volumes:
      - citydb-data:/var/lib/postgresql/data

volumes:
  citydb-data:
```

```bash
docker compose up -d
docker compose logs -f postgres   # wait for "3D City Database ... ready"
```

### Step 5 — Import the CityJSON into 3DCityDB

```bash
citydb import citygml \
    --db-host localhost \
    --db-port 5432 \
    --db-name citydb \
    --db-user citydb \
    --db-password citydb \
    subset.city.json

# citydb-tool auto-detects CityJSON vs CityGML by file extension/content.
# Watch for:
#   - "Feature skipped: invalid geometry"  ← each one is data loss
#   - "Attribute type mismatch"            ← attribute values coerced or dropped
#   - End-of-run summary with counts
```

### Step 6 — Export back to CityJSON (optional sanity check)

```bash
citydb export cityjson \
    --db-host localhost \
    --db-port 5432 \
    --db-name citydb \
    --db-user citydb \
    --db-password citydb \
    --output hamburg-from-db.city.json

# Compare with the input:
cjio subset.city.json info
cjio hamburg-from-db.city.json info
```

If feature count, attribute count, or vertex count differ, you've found the import's lossy boundary. Write that delta into the HiWi report.

### Step 7 — Load in the prototype

```bash
# From the prototype dir:
cd prototype
npm run dev

# In the browser (http://localhost:5173):
#   "Load another…" → pick subset.city.json or hamburg-from-db.city.json
#   Verify map flies to Hamburg (EPSG:25832 is in our proj4 registry)
#   Verify extrusions render, buildings are clickable, attributes show
```

---

## 5. Known failure modes to watch for

| Symptom | Likely cause | What to capture for the HiWi report |
|---|---|---|
| `citygml-tools to-cityjson` fails with NullPointerException | ImplicitGeometry with missing body (citygml-tools issue #20) | Input filename + stack trace |
| `cjio validate` reports schema errors | Non-spec extensions, invalid winding, duplicate vertex indices | Full validation output |
| `citydb import` reports "feature skipped" | Geometry fails val3dity; usually non-planar polygons | Count of skips vs total |
| Prototype shows "Reference system EPSG:XXXX not supported" | Hamburg uses EPSG:25832; we have it, but derived datasets might use compound CRS | Missing EPSG code |
| Map flies nowhere when loading Hamburg file | CRS detection fails | `cjio info` output of the input file |
| Buildings render but look lumpy or face-flipped | Polygon winding was reversed during conversion | Screenshot + affected feature id |

Whichever of these you see is useful evidence; the absence is also useful evidence ("Hamburg CityGML → 3DCityDB → CityJSON → prototype round-trips cleanly for district X").

---

## 6. Minimum viable pilot

If you want the fastest possible sanity check before investing in the full pipeline:

1. Skip steps 4–6 (no database).
2. Run just: download → citygml-tools to-cityjson → cjio validate → open in prototype.
3. This alone proves whether Hamburg CityGML converts cleanly enough to render. If it does, the database leg is likely fine too (the database is more tolerant than the validator).

---

## 7. After the pilot

Once a known-clean subset is confirmed, the follow-on work is to **automate** this pipeline so we can re-run it on every new Hamburg data release. A tiny `pnpm` script or a `make` target driving citygml-tools + cjio + citydb-tool covers it. Not urgent for the prototype, but a straightforward Phase-0 task.
