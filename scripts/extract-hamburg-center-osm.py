"""Extract a compact, reference-complete Hamburg road OSM demo from a local PBF.

Requires pyosmium (`python -m pip install osmium`). Only `highway=*` ways that
intersect the requested bbox and their referenced nodes are written, matching
the data shape used by the browser's Overpass / osm2streets road workflow.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import osmium


DEFAULT_BBOX = (9.978, 53.5395, 10.0035, 53.5545)
DEFAULT_EXCLUDED_HIGHWAYS = {
    "bridleway",
    "construction",
    "corridor",
    "elevator",
    "footway",
    "path",
    "platform",
    "proposed",
    "raceway",
    "steps",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("Data/hamburg-osm/hamburg-latest.osm.pbf"),
        help="Source Hamburg .osm.pbf snapshot",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/data/hamburg/hamburg-city-center-roads.osm"),
        help="Output .osm file",
    )
    parser.add_argument(
        "--bbox",
        default=",".join(str(value) for value in DEFAULT_BBOX),
        help="WGS84 west,south,east,north bbox",
    )
    parser.add_argument(
        "--buffer-m",
        type=float,
        default=50.0,
        help="Expand the bbox before selecting roads (default: 50 m)",
    )
    parser.add_argument(
        "--include-all-highways",
        action="store_true",
        help="Retain fine-grained footways, paths, steps, and construction ways",
    )
    return parser.parse_args()


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    parts = tuple(float(part) for part in value.split(","))
    if len(parts) != 4 or not all(math.isfinite(part) for part in parts):
        raise ValueError("--bbox must contain four finite comma-separated numbers")
    west, south, east, north = parts
    if west >= east or south >= north:
        raise ValueError("--bbox must have west < east and south < north")
    return parts


def expand_bbox(
    bbox: tuple[float, float, float, float], metres: float
) -> tuple[float, float, float, float]:
    if not math.isfinite(metres) or metres < 0:
        raise ValueError("--buffer-m must be a finite non-negative number")
    west, south, east, north = bbox
    latitude = math.radians((south + north) / 2)
    lon_delta = metres / (111_320 * max(0.01, math.cos(latitude)))
    lat_delta = metres / 110_540
    return west - lon_delta, south - lat_delta, east + lon_delta, north + lat_delta


def way_intersects_bbox(
    way: osmium.osm.Way, bbox: tuple[float, float, float, float]
) -> bool:
    west, south, east, north = bbox
    min_lon = math.inf
    min_lat = math.inf
    max_lon = -math.inf
    max_lat = -math.inf
    found = False

    for node in way.nodes:
        location = node.location
        if not location.valid():
            continue
        found = True
        min_lon = min(min_lon, location.lon)
        min_lat = min(min_lat, location.lat)
        max_lon = max(max_lon, location.lon)
        max_lat = max(max_lat, location.lat)

    return (
        found
        and min_lon <= east
        and max_lon >= west
        and min_lat <= north
        and max_lat >= south
    )


def main() -> None:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    bbox = expand_bbox(parse_bbox(args.bbox), args.buffer_m)

    if not source.is_file():
        raise FileNotFoundError(source)

    way_ids: set[int] = set()
    node_ids: set[int] = set()
    ways = osmium.FileProcessor(
        str(source), osmium.osm.NODE | osmium.osm.WAY
    ).with_locations()
    for way in ways:
        if not isinstance(way, osmium.osm.Way):
            continue
        highway = way.tags.get("highway")
        if not highway or not way_intersects_bbox(way, bbox):
            continue
        if not args.include_all_highways and highway in DEFAULT_EXCLUDED_HIGHWAYS:
            continue
        way_ids.add(way.id)
        node_ids.update(node.ref for node in way.nodes)

    if not way_ids:
        raise RuntimeError("No highway ways intersected the Hamburg demo bbox")

    output.parent.mkdir(parents=True, exist_ok=True)
    with osmium.SimpleWriter(str(output), overwrite=True) as writer:
        for node in osmium.FileProcessor(str(source), osmium.osm.NODE):
            if node.id in node_ids:
                writer.add(node)
        for way in osmium.FileProcessor(str(source), osmium.osm.WAY):
            if way.id in way_ids:
                writer.add(way)

    print(f"bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}")
    print(f"nodes={len(node_ids)}")
    print(f"ways={len(way_ids)}")
    print(f"output={output}")


if __name__ == "__main__":
    main()
