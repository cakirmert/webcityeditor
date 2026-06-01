import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(
  __dirname,
  '../public/data/hamburg/hamburg-center-alkis.city.jsonl'
);

const BBOX_WGS84 = [9.985, 53.548, 10.005, 53.558];
const SOURCE_URL =
  'https://services2.arcgis.com/jUpNdisbWqRpMo35/arcgis/rest/services/Geb%C3%A4ude_Hamburg/FeatureServer/0/query';
const SOURCE_ITEM_URL =
  'https://www.arcgis.com/home/item.html?id=1ef87c53adff4c07b9b3010e9d8264fb';

const url = new URL(SOURCE_URL);
url.search = new URLSearchParams({
  f: 'geojson',
  where: '1=1',
  outFields: '*',
  geometry: BBOX_WGS84.join(','),
  geometryType: 'esriGeometryEnvelope',
  inSR: '4326',
  outSR: '4326',
  spatialRel: 'esriSpatialRelIntersects',
  resultRecordCount: '180',
}).toString();

const resp = await fetch(url);
if (!resp.ok) {
  throw new Error(`ArcGIS query failed: HTTP ${resp.status} ${resp.statusText}`);
}
const geojson = await resp.json();
if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
  throw new Error('ArcGIS query did not return a GeoJSON FeatureCollection');
}

const prepared = [];
let minX = Infinity;
let minY = Infinity;

for (const feature of geojson.features) {
  const ring = firstOuterRing(feature.geometry);
  if (!ring || ring.length < 4) continue;

  const projected = ring
    .map(([lng, lat]) => {
      const [x, y] = proj4('EPSG:4326', 'EPSG:25832', [lng, lat]);
      return [x, y];
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (projected.length < 4) continue;

  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  prepared.push({ feature, projected });
}

if (prepared.length === 0) {
  throw new Error('No usable Hamburg building footprints returned for the center bbox');
}

const transform = {
  scale: [0.01, 0.01, 0.01],
  translate: [Math.floor(minX), Math.floor(minY), 0],
};

const maxHeight = Math.max(
  ...prepared.map(({ feature }) => heightFromProperties(feature.properties ?? {}))
);
const header = {
  type: 'CityJSON',
  version: '2.0',
  metadata: {
    title: 'Hamburg center ALKIS building footprints demo',
    referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    geographicalExtent: [
      BBOX_WGS84[0],
      BBOX_WGS84[1],
      0,
      BBOX_WGS84[2],
      BBOX_WGS84[3],
      maxHeight,
    ],
    source: SOURCE_ITEM_URL,
    sourceDescription:
      'Official Hamburg ALKIS building footprints via ArcGIS FeatureServer. Heights are demo extrusions derived from storey count where present.',
  },
  transform,
  CityObjects: {},
  vertices: [],
};

const lines = [JSON.stringify(header)];
for (const { feature, projected } of prepared) {
  const id = `hamburg-alkis-${feature.properties?.OBJECTID ?? feature.id}`;
  lines.push(JSON.stringify(featureToCityJsonFeature(id, feature, projected, transform)));
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${prepared.length} Hamburg buildings to ${outPath}`);

function firstOuterRing(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0])) {
    return closeRing(geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates?.[0]?.[0])) {
    return closeRing(geometry.coordinates[0][0]);
  }
  return null;
}

function closeRing(ring) {
  const coords = ring
    .filter((p) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number')
    .map(([lng, lat]) => [lng, lat]);
  if (coords.length < 3) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
  return coords;
}

function featureToCityJsonFeature(id, feature, projectedRing, transform) {
  let openRing = stripClosingPoint(projectedRing);
  if (signedArea(openRing) < 0) openRing = openRing.reverse();
  const height = heightFromProperties(feature.properties ?? {});
  const vertices = [];
  const bottom = openRing.map(([x, y]) => addVertex(vertices, encodeVertex(x, y, 0, transform)));
  const top = openRing.map(([x, y]) => addVertex(vertices, encodeVertex(x, y, height, transform)));

  const ground = [...bottom].reverse();
  const roof = [...top];
  const shell = [[ground], [roof]];
  const semanticValues = [0, 1];

  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length;
    shell.push([[bottom[i], bottom[j], top[j], top[i]]]);
    semanticValues.push(2);
  }

  const props = feature.properties ?? {};
  return {
    type: 'CityJSONFeature',
    id,
    CityObjects: {
      [id]: {
        type: 'Building',
        attributes: {
          source: 'Freie und Hansestadt Hamburg, LGV / ALKIS',
          sourceUrl: SOURCE_ITEM_URL,
          objectId: props.OBJECTID,
          function: normalizeFunction(props.gebaeudefunktion),
          buildingFunctionCode: props.gebaeudefunktion,
          roofType: props.dachform,
          storeysAboveGround: props.anzahlDerOberirdischenGeschosse,
          groundArea: props.grundflaeche,
          estimatedHeight: height,
          heightSource: 'storeysAboveGround * 3.2m, fallback 12m; demo extrusion',
        },
        geometry: [
          {
            type: 'Solid',
            lod: '1.0',
            boundaries: [shell],
            semantics: {
              surfaces: [
                { type: 'GroundSurface' },
                { type: 'RoofSurface' },
                { type: 'WallSurface' },
              ],
              values: [semanticValues],
            },
          },
        ],
      },
    },
    vertices,
  };
}

function stripClosingPoint(ring) {
  const last = ring[ring.length - 1];
  const first = ring[0];
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return ring;
}

function signedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function addVertex(vertices, vertex) {
  vertices.push(vertex);
  return vertices.length - 1;
}

function encodeVertex(x, y, z, transform) {
  return [
    Math.round((x - transform.translate[0]) / transform.scale[0]),
    Math.round((y - transform.translate[1]) / transform.scale[1]),
    Math.round((z - transform.translate[2]) / transform.scale[2]),
  ];
}

function heightFromProperties(props) {
  const storeys = Number(props.anzahlDerOberirdischenGeschosse);
  if (Number.isFinite(storeys) && storeys > 0) {
    return Math.max(3.2, Math.min(90, Number((storeys * 3.2).toFixed(1))));
  }
  return 12;
}

function normalizeFunction(value) {
  const code = String(value ?? '');
  if (/^1/.test(code)) return 'residential';
  if (/^(2|3)/.test(code)) return 'commercial';
  if (/^(4|5)/.test(code)) return 'industrial';
  return 'public';
}
