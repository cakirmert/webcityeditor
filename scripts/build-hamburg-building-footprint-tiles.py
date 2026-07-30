#!/usr/bin/env python3
"""Build compact, static Hamburg ALKIS building-footprint vector tiles.

The official INSPIRE download is a large GML document. This script parses it
once into a temporary SQLite spatial index, then writes lightweight coloured
PNG overview tiles and a closer Mapbox Vector Tile pyramid. Only a compact
usage category is kept in each vector feature; source geometry is authoritative.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import sqlite3
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path
from typing import Iterable

try:
    import mapbox_vector_tile
    import mercantile
    from lxml import etree
    from PIL import Image, ImageDraw
    from pyproj import Transformer
    from shapely import wkb
    from shapely.geometry import MultiPolygon, Polygon, box
    from shapely.ops import transform
except ImportError as error:
    raise SystemExit(
        "Missing tile-builder dependencies. Install "
        "scripts/requirements-hamburg-building-tiles.txt first.\n"
        f"Original error: {error}"
    ) from error


SOURCE_URL = (
    "https://daten-hamburg.de/inspire/hh_inspire_gebaeude_2d_alkis/"
    "INSPIRE_HH_Gebaeude_2D_ALKIS_2020-07-15.zip"
)
SOURCE_PAGE = (
    "https://suche.transparenz.hamburg.de/dataset/"
    "inspire-hh-gebaeude-alkis12"
)
BUILDING_TAG = "{http://inspire.ec.europa.eu/schemas/bu-core2d/4.0}Building"
GML_NS = "http://www.opengis.net/gml/3.2"
XLINK_HREF = "{http://www.w3.org/1999/xlink}href"
EXTENT = 4096
RASTER_TILE_SIZE = 256
RASTER_SCALE = 2
USAGE_LEGEND = {
    0: "residential",
    1: "mixed",
    2: "commercial",
    3: "office",
    4: "industrial",
    5: "public",
    6: "unknown",
}


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    default_source = (
        Path(tempfile.gettempdir())
        / "INSPIRE_HH_Gebaeude_2D_ALKIS_2020-07-15.zip"
    )
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-zip", type=Path, default=default_source)
    parser.add_argument(
        "--output",
        type=Path,
        default=project_root / "public/data/hamburg/buildings",
    )
    parser.add_argument(
        "--raster-min-zoom",
        type=int,
        default=8,
        help="First zoom for overview PNG footprint tiles.",
    )
    parser.add_argument(
        "--vector-min-zoom",
        type=int,
        default=12,
        help="First zoom for interactive-resolution MVT footprint tiles.",
    )
    parser.add_argument("--max-zoom", type=int, default=14)
    parser.add_argument(
        "--keep-index",
        action="store_true",
        help="Keep the intermediate SQLite index beside the output.",
    )
    parser.add_argument(
        "--rebuild-index",
        action="store_true",
        help="Discard a reusable intermediate index and parse the GML again.",
    )
    return parser.parse_args()


def download_source(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SOURCE_URL}", flush=True)
    with urllib.request.urlopen(SOURCE_URL) as response, path.open("wb") as target:
        downloaded = 0
        while chunk := response.read(1024 * 1024):
            target.write(chunk)
            downloaded += len(chunk)
            if downloaded % (25 * 1024 * 1024) < len(chunk):
                print(f"  {downloaded / 1024 / 1024:.0f} MiB", flush=True)


def local_name(tag: object) -> str:
    value = str(tag)
    return value.rsplit("}", 1)[-1]


def usage_code(building: etree._Element) -> int:
    values: list[str] = []
    for element in building.iter():
        if local_name(element.tag) != "currentUse":
            continue
        href = element.get(XLINK_HREF) or element.get("href") or element.text or ""
        values.append(href.lower().replace("_", "").replace("-", ""))

    classifiers: tuple[tuple[int, tuple[str, ...]], ...] = (
        (0, ("residential",)),
        (1, ("residenceforcommunities", "ancillary")),
        (2, ("commerceandservices", "commercial", "trade")),
        (3, ("office",)),
        (
            4,
            (
                "industrial",
                "industrie",
                "agriculture",
                "versorgungentsorgung",
            ),
        ),
        (5, ("publicservices", "verkehr")),
    )
    for code, needles in classifiers:
        if any(needle in value for value in values for needle in needles):
            return code
    return 6


def ring_coordinates(ring: etree._Element) -> list[tuple[float, float]]:
    pos_list = ring.find(f".//{{{GML_NS}}}posList")
    if pos_list is not None and pos_list.text:
        numbers = [float(value) for value in pos_list.text.split()]
        dimension = int(
            pos_list.get("srsDimension")
            or ring.get("srsDimension")
            or (3 if len(numbers) % 3 == 0 and len(numbers) % 2 else 2)
        )
        coordinates = [
            (numbers[index], numbers[index + 1])
            for index in range(0, len(numbers) - 1, dimension)
        ]
    else:
        coordinates = []
        for pos in ring.findall(f".//{{{GML_NS}}}pos"):
            if not pos.text:
                continue
            numbers = [float(value) for value in pos.text.split()]
            if len(numbers) >= 2:
                coordinates.append((numbers[0], numbers[1]))
    if len(coordinates) >= 3 and coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])
    return coordinates


def building_geometry(building: etree._Element):
    polygons: list[Polygon] = []
    for polygon_element in building.iter(f"{{{GML_NS}}}Polygon"):
        exterior_element = polygon_element.find(
            f"./{{{GML_NS}}}exterior/{{{GML_NS}}}LinearRing"
        )
        if exterior_element is None:
            continue
        exterior = ring_coordinates(exterior_element)
        if len(exterior) < 4:
            continue
        interiors = []
        for interior_element in polygon_element.findall(
            f"./{{{GML_NS}}}interior/{{{GML_NS}}}LinearRing"
        ):
            interior = ring_coordinates(interior_element)
            if len(interior) >= 4:
                interiors.append(interior)
        polygon = Polygon(exterior, interiors)
        if not polygon.is_empty and polygon.area > 0:
            polygons.append(polygon)
    if not polygons:
        return None
    geometry = polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return geometry if not geometry.is_empty else None


def initialise_database(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        CREATE TABLE buildings (
          id INTEGER PRIMARY KEY,
          usage INTEGER NOT NULL,
          geometry BLOB NOT NULL
        );
        CREATE VIRTUAL TABLE building_bounds USING rtree(
          id,
          min_x, max_x,
          min_y, max_y
        );
        """
    )
    return connection


def build_spatial_index(source_zip: Path, database_path: Path) -> dict[str, object]:
    transformer = Transformer.from_crs("EPSG:25832", "EPSG:3857", always_xy=True)
    connection = initialise_database(database_path)
    building_count = 0
    skipped_count = 0
    usage_counts = {code: 0 for code in USAGE_LEGEND}
    min_x = min_y = math.inf
    max_x = max_y = -math.inf
    started = time.monotonic()

    with zipfile.ZipFile(source_zip) as archive:
        member = archive.getinfo("result.gml")
        with archive.open(member) as stream:
            context = etree.iterparse(
                stream,
                events=("end",),
                tag=BUILDING_TAG,
                huge_tree=True,
                recover=True,
            )
            connection.execute("BEGIN")
            for _, element in context:
                geometry = building_geometry(element)
                if geometry is None:
                    skipped_count += 1
                else:
                    projected = transform(transformer.transform, geometry)
                    if projected.is_empty:
                        skipped_count += 1
                    else:
                        code = usage_code(element)
                        left, bottom, right, top = projected.bounds
                        building_count += 1
                        usage_counts[code] += 1
                        min_x = min(min_x, left)
                        min_y = min(min_y, bottom)
                        max_x = max(max_x, right)
                        max_y = max(max_y, top)
                        connection.execute(
                            "INSERT INTO buildings(id, usage, geometry) VALUES (?, ?, ?)",
                            (
                                building_count,
                                code,
                                sqlite3.Binary(wkb.dumps(projected, output_dimension=2)),
                            ),
                        )
                        connection.execute(
                            """
                            INSERT INTO building_bounds(
                              id, min_x, max_x, min_y, max_y
                            ) VALUES (?, ?, ?, ?, ?)
                            """,
                            (building_count, left, right, bottom, top),
                        )
                if (building_count and building_count % 10_000 == 0):
                    connection.commit()
                    connection.execute("BEGIN")
                    elapsed = max(0.001, time.monotonic() - started)
                    print(
                        f"Indexed {building_count:,} buildings "
                        f"({building_count / elapsed:,.0f}/s)",
                        flush=True,
                    )
                element.clear()
                parent = element.getparent()
                while parent is not None and element.getprevious() is not None:
                    del parent[0]
            connection.commit()

    metadata = {
        "featureCount": building_count,
        "skippedCount": skipped_count,
        "usageCounts": {
            USAGE_LEGEND[code]: count for code, count in usage_counts.items()
        },
        "mercatorBounds": [min_x, min_y, max_x, max_y],
    }
    connection.execute(
        "CREATE TABLE metadata (json TEXT NOT NULL)"
    )
    connection.execute(
        "INSERT INTO metadata(json) VALUES (?)",
        (json.dumps(metadata, separators=(",", ":")),),
    )
    connection.commit()
    connection.close()
    return metadata


def load_index_metadata(connection: sqlite3.Connection) -> dict[str, object]:
    row = connection.execute("SELECT json FROM metadata LIMIT 1").fetchone()
    if not row:
        raise RuntimeError("Reusable footprint index has no metadata")
    return json.loads(row[0])


def polygonal_parts(geometry) -> Iterable:
    if geometry.geom_type == "Polygon":
        yield geometry
        return
    if hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygonal_parts(part)


def encode_tile(
    connection: sqlite3.Connection,
    tile: mercantile.Tile,
) -> tuple[bytes, int]:
    bounds = mercantile.xy_bounds(tile)
    left, bottom, right, top = (
        bounds.left,
        bounds.bottom,
        bounds.right,
        bounds.top,
    )
    rows = connection.execute(
        """
        SELECT b.usage, b.geometry
        FROM building_bounds AS r
        JOIN buildings AS b ON b.id = r.id
        WHERE r.min_x <= ? AND r.max_x >= ?
          AND r.min_y <= ? AND r.max_y >= ?
        """,
        (right, left, top, bottom),
    )
    tile_box = box(left, bottom, right, top)
    tolerance = (right - left) / EXTENT * 0.45
    features = []
    for usage, geometry_blob in rows:
        geometry = wkb.loads(geometry_blob)
        if not tile_box.contains(geometry):
            geometry = geometry.intersection(tile_box)
        if geometry.is_empty:
            continue
        geometry = geometry.simplify(tolerance, preserve_topology=True)
        for part in polygonal_parts(geometry):
            if part.is_empty or part.area <= tolerance * tolerance:
                continue
            features.append(
                {
                    "geometry": part,
                    "properties": {"u": int(usage)},
                }
            )
    payload = mapbox_vector_tile.encode(
        {"name": "buildings", "features": features},
        default_options={
            "quantize_bounds": (left, bottom, right, top),
            "extents": EXTENT,
        },
    )
    return payload, len(features)


def mercator_bounds_to_wgs84(
    bounds: list[float],
) -> tuple[float, float, float, float]:
    transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    west, south = transformer.transform(bounds[0], bounds[1])
    east, north = transformer.transform(bounds[2], bounds[3])
    return west, south, east, north


def write_vector_tiles(
    connection: sqlite3.Connection,
    output: Path,
    metadata: dict[str, object],
    min_zoom: int,
    max_zoom: int,
) -> dict[str, object]:
    tiles_root = output / "tiles"
    if tiles_root.exists():
        shutil.rmtree(tiles_root)
    tiles_root.mkdir(parents=True, exist_ok=True)
    wgs84_bounds = mercator_bounds_to_wgs84(metadata["mercatorBounds"])
    tile_count = 0
    nonempty_tile_count = 0
    encoded_feature_count = 0
    total_bytes = 0
    started = time.monotonic()

    for zoom in range(min_zoom, max_zoom + 1):
        zoom_tiles = list(mercantile.tiles(*wgs84_bounds, zooms=[zoom]))
        zoom_bytes = 0
        zoom_features = 0
        for index, tile in enumerate(zoom_tiles, start=1):
            payload, feature_count = encode_tile(connection, tile)
            target = tiles_root / str(tile.z) / str(tile.x) / f"{tile.y}.pbf"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            tile_count += 1
            total_bytes += len(payload)
            zoom_bytes += len(payload)
            encoded_feature_count += feature_count
            zoom_features += feature_count
            if feature_count:
                nonempty_tile_count += 1
            if index % 100 == 0:
                print(
                    f"z{zoom}: {index:,}/{len(zoom_tiles):,} tiles",
                    flush=True,
                )
        print(
            f"z{zoom}: {len(zoom_tiles):,} tiles, "
            f"{zoom_features:,} clipped features, "
            f"{zoom_bytes / 1024 / 1024:.1f} MiB",
            flush=True,
        )

    elapsed = time.monotonic() - started
    return {
        "vectorTileCount": tile_count,
        "vectorNonemptyTileCount": nonempty_tile_count,
        "vectorEncodedFeatureCount": encoded_feature_count,
        "vectorBytes": total_bytes,
        "vectorSeconds": round(elapsed, 2),
    }


def pixel_ring(
    coordinates: Iterable[tuple[float, float]],
    bounds: mercantile.Bbox,
    size: int,
) -> list[tuple[float, float]]:
    width = bounds.right - bounds.left
    height = bounds.top - bounds.bottom
    return [
        (
            (x - bounds.left) / width * size,
            (bounds.top - y) / height * size,
        )
        for x, y in coordinates
    ]


def write_raster_tiles(
    connection: sqlite3.Connection,
    output: Path,
    metadata: dict[str, object],
    min_zoom: int,
    max_zoom: int,
) -> dict[str, object]:
    raster_root = output / "raster"
    if raster_root.exists():
        shutil.rmtree(raster_root)
    raster_root.mkdir(parents=True, exist_ok=True)
    wgs84_bounds = mercator_bounds_to_wgs84(metadata["mercatorBounds"])
    colors = {
        0: (240, 220, 60, 218),
        1: (234, 151, 54, 218),
        2: (60, 120, 240, 218),
        3: (60, 180, 100, 218),
        4: (160, 80, 240, 218),
        5: (220, 60, 60, 218),
        6: (200, 200, 210, 190),
    }
    render_size = RASTER_TILE_SIZE * RASTER_SCALE
    tile_count = 0
    total_bytes = 0
    started = time.monotonic()

    for zoom in range(min_zoom, max_zoom + 1):
        zoom_tiles = list(mercantile.tiles(*wgs84_bounds, zooms=[zoom]))
        zoom_bytes = 0
        for tile in zoom_tiles:
            bounds = mercantile.xy_bounds(tile)
            rows = connection.execute(
                """
                SELECT b.usage, b.geometry
                FROM building_bounds AS r
                JOIN buildings AS b ON b.id = r.id
                WHERE r.min_x <= ? AND r.max_x >= ?
                  AND r.min_y <= ? AND r.max_y >= ?
                """,
                (bounds.right, bounds.left, bounds.top, bounds.bottom),
            )
            image = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image, "RGBA")
            tile_box = box(bounds.left, bounds.bottom, bounds.right, bounds.top)
            tolerance = (bounds.right - bounds.left) / render_size * 0.2
            for usage, geometry_blob in rows:
                geometry = wkb.loads(geometry_blob)
                if not tile_box.contains(geometry):
                    geometry = geometry.intersection(tile_box)
                if geometry.is_empty:
                    continue
                geometry = geometry.simplify(tolerance, preserve_topology=True)
                for part in polygonal_parts(geometry):
                    if part.is_empty:
                        continue
                    exterior = pixel_ring(part.exterior.coords, bounds, render_size)
                    if len(exterior) < 3:
                        continue
                    draw.polygon(exterior, fill=colors.get(int(usage), colors[6]))
                    for interior in part.interiors:
                        hole = pixel_ring(interior.coords, bounds, render_size)
                        if len(hole) >= 3:
                            draw.polygon(hole, fill=(0, 0, 0, 0))
            image = image.resize(
                (RASTER_TILE_SIZE, RASTER_TILE_SIZE),
                Image.Resampling.LANCZOS,
            )
            target = raster_root / str(tile.z) / str(tile.x) / f"{tile.y}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, format="PNG", optimize=True)
            byte_count = target.stat().st_size
            tile_count += 1
            total_bytes += byte_count
            zoom_bytes += byte_count
        print(
            f"raster z{zoom}: {len(zoom_tiles):,} tiles, "
            f"{zoom_bytes / 1024 / 1024:.1f} MiB",
            flush=True,
        )

    return {
        "rasterTileCount": tile_count,
        "rasterBytes": total_bytes,
        "rasterSeconds": round(time.monotonic() - started, 2),
    }


def main() -> int:
    args = parse_args()
    if (
        args.raster_min_zoom < 0
        or args.vector_min_zoom <= args.raster_min_zoom
        or args.max_zoom < args.vector_min_zoom
    ):
        raise SystemExit("Invalid zoom range")
    if not args.source_zip.exists():
        download_source(args.source_zip)

    args.output.mkdir(parents=True, exist_ok=True)
    database_path = (
        args.output / "footprints.sqlite"
        if args.keep_index
        else Path(tempfile.gettempdir()) / "hamburg-building-footprints.sqlite"
    )
    if args.rebuild_index and database_path.exists():
        database_path.unlink()

    if database_path.exists():
        print(f"Reusing {database_path}", flush=True)
        connection = sqlite3.connect(database_path)
        metadata = load_index_metadata(connection)
    else:
        print("Parsing official Hamburg ALKIS GML", flush=True)
        metadata = build_spatial_index(args.source_zip, database_path)
        connection = sqlite3.connect(database_path)

    raster_metadata = write_raster_tiles(
        connection,
        args.output,
        metadata,
        args.raster_min_zoom,
        args.vector_min_zoom - 1,
    )
    vector_metadata = write_vector_tiles(
        connection,
        args.output,
        metadata,
        args.vector_min_zoom,
        args.max_zoom,
    )
    connection.close()

    catalog = {
        "version": 1,
        "format": "mvt",
        "layer": "buildings",
        "tiles": "tiles/{z}/{x}/{y}.pbf",
        "overviewTiles": "raster/{z}/{x}/{y}.png",
        "source": {
            "title": "INSPIRE HH Gebäude ALKIS",
            "url": SOURCE_URL,
            "landingPage": SOURCE_PAGE,
            "snapshot": "2020-07-15",
            "crs": "EPSG:25832",
        },
        "featureCount": metadata["featureCount"],
        "skippedCount": metadata["skippedCount"],
        "usageCounts": metadata["usageCounts"],
        "usageProperty": "u",
        "usageLegend": {str(code): value for code, value in USAGE_LEGEND.items()},
        "bounds": list(mercator_bounds_to_wgs84(metadata["mercatorBounds"])),
        "minZoom": args.raster_min_zoom,
        "rasterMaxZoom": args.vector_min_zoom - 1,
        "vectorMinZoom": args.vector_min_zoom,
        "maxZoom": args.max_zoom,
        **raster_metadata,
        **vector_metadata,
        "tileCount": (
            raster_metadata["rasterTileCount"]
            + vector_metadata["vectorTileCount"]
        ),
        "totalBytes": (
            raster_metadata["rasterBytes"]
            + vector_metadata["vectorBytes"]
        ),
    }
    (args.output / "catalog.json").write_text(
        json.dumps(catalog, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Done: {catalog['tileCount']:,} raster/vector tiles, "
        f"{catalog['totalBytes'] / 1024 / 1024:.1f} MiB, "
        f"{catalog['featureCount']:,} source buildings",
        flush=True,
    )
    if not args.keep_index and database_path.exists():
        database_path.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
