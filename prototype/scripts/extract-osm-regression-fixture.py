"""Extract a small, reference-complete OSM regression fixture from a local PBF.

Requires pyosmium (`python -m pip install osmium`). The selected bbox is based
only on the local snapshot; tests never contact Overpass or another live API.
ForwardReferenceWriter adds ways/relations that reference selected nodes and
then back-fills their referenced objects from the same source PBF.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import osmium


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path, help="Source .osm.pbf snapshot")
    parser.add_argument("--output", required=True, type=Path, help="Output .osm or .osm.pbf")
    parser.add_argument(
        "--bbox",
        required=True,
        help="WGS84 west,south,east,north bbox",
    )
    parser.add_argument(
        "--buffer-m",
        type=float,
        default=25.0,
        help="Expand the bbox on every side before extracting (default: 25)",
    )
    parser.add_argument(
        "--include-relations",
        action="store_true",
        help="Retain relation records (off by default to keep geometry fixtures small)",
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


def main() -> None:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    complete_output = (
        output
        if args.include_relations
        else output.with_name(f"{output.stem}.complete{output.suffix}")
    )

    west, south, east, north = expand_bbox(parse_bbox(args.bbox), args.buffer_m)
    selected_nodes = 0
    processor = osmium.FileProcessor(str(source), osmium.osm.NODE)
    with osmium.ForwardReferenceWriter(
        str(complete_output),
        str(source),
        overwrite=True,
        back_references=True,
        remove_tags=False,
        # Road geometry regressions need complete ways and their nodes. Pulling
        # route/network relations can expand a sub-kilometre fixture to many MB
        # without affecting lane or intersection construction.
        forward_relation_depth=0,
        backward_relation_depth=0,
    ) as writer:
        for node in processor:
            location = node.location
            if location.valid() and west <= location.lon <= east and south <= location.lat <= north:
                writer.add_node(node)
                selected_nodes += 1

    if selected_nodes == 0:
        complete_output.unlink(missing_ok=True)
        raise RuntimeError("The buffered bbox contained no OSM nodes")

    if not args.include_relations:
        with osmium.SimpleWriter(str(output), overwrite=True) as writer:
            for obj in osmium.FileProcessor(
                str(complete_output), osmium.osm.NODE | osmium.osm.WAY
            ):
                writer.add(obj)
        complete_output.unlink(missing_ok=True)
    print(f"selected_nodes={selected_nodes}")
    print(f"bbox={west},{south},{east},{north}")
    print(f"output={output}")


if __name__ == "__main__":
    main()
