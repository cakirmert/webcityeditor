"""Build the static railway context from the same regional OSM source as roads.

Requires pyosmium. No elevations are inferred or written: OSM layer is only
relative crossing order. The viewer may offer a labelled schematic depth view.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import osmium

parser = argparse.ArgumentParser()
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--output', type=Path, default=Path('public/data/hamburg/hamburg-railway-context.json'))
args = parser.parse_args()


class Railways(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []

    def way(self, way):
        tags = dict(way.tags)
        if tags.get('railway') not in ('rail', 'light_rail', 'subway', 'tram'):
            return
        points = [[n.lon, n.lat] for n in way.nodes if n.location.valid()]
        if len(points) < 2:
            return
        self.features.append({'type': 'Feature', 'id': str(way.id), 'properties': {
            k: tags[k] for k in ('name', 'railway', 'bridge', 'tunnel', 'layer', 'ele', 'tracks') if k in tags
        }, 'geometry': {'type': 'LineString', 'coordinates': points}})


handler = Railways()
handler.apply_file(str(args.input), locations=True)
result = {'type': 'FeatureCollection', 'source': 'OpenStreetMap contributors / Geofabrik Hamburg extract',
          'sourceUrl': 'https://download.geofabrik.de/europe/germany/hamburg.html',
          'license': 'ODbL 1.0', 'generatedAt': datetime.now(timezone.utc).isoformat(), 'features': handler.features}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, separators=(',', ':')), encoding='utf8')
print(f'{len(handler.features)} railway ways -> {args.output}')
