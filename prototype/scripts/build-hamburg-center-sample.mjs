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

// AdV/ALKIS roofType codelist values used by German 3D building models.
const ROOF_TYPES = {
  1000: { label: 'Flachdach', kind: 'flat' },
  2100: { label: 'Pultdach', kind: 'shed' },
  2200: { label: 'Versetztes Pultdach', kind: 'shed' },
  3100: { label: 'Satteldach', kind: 'gable' },
  3200: { label: 'Walmdach', kind: 'hip' },
  3300: { label: 'Krueppelwalmdach', kind: 'hip' },
  3400: { label: 'Mansardendach', kind: 'mansard' },
  3500: { label: 'Zeltdach', kind: 'pyramid' },
  3600: { label: 'Kegeldach', kind: 'pyramid' },
  3700: { label: 'Kuppeldach', kind: 'pyramid' },
  3800: { label: 'Sheddach', kind: 'shed' },
  3900: { label: 'Bogendach', kind: 'mansard' },
  4000: { label: 'Turmdach', kind: 'pyramid' },
  5000: { label: 'Mischform', kind: 'pyramid' },
  9999: { label: 'Sonstiges', kind: 'flat' },
};

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
let maxX = -Infinity;
let maxY = -Infinity;

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
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
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
  ...prepared.map(({ feature, projected }) =>
    roofProfileFromProperties(feature.properties ?? {}, stripClosingPoint(projected)).totalHeight
  )
);
const header = {
  type: 'CityJSON',
  version: '2.0',
  metadata: {
    title: 'Hamburg center ALKIS building footprints with procedural roofs demo',
    referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    geographicalExtent: [minX, minY, 0, maxX, maxY, maxHeight],
    source: SOURCE_ITEM_URL,
    sourceDescription:
      'Official Hamburg ALKIS building footprints via ArcGIS FeatureServer. Heights and LoD2-style roofs are procedural demo geometry derived from storey count and ALKIS dachform where present.',
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
  const props = feature.properties ?? {};
  const openRing = ensureCounterClockwise(stripClosingPoint(projectedRing));
  const roofProfile = roofProfileFromProperties(props, openRing);
  const model = buildRoofedSolid(openRing, roofProfile, transform);

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
          roofTypeLabel: roofProfile.label,
          storeysAboveGround: props.anzahlDerOberirdischenGeschosse,
          groundArea: props.grundflaeche,
          measuredHeight: Number(roofProfile.totalHeight.toFixed(2)),
          estimatedHeight: Number(roofProfile.totalHeight.toFixed(2)),
          eaveHeight: Number(roofProfile.eaveHeight.toFixed(2)),
          roofRise: Number((roofProfile.totalHeight - roofProfile.eaveHeight).toFixed(2)),
          heightSource:
            'storeysAboveGround * 3.2m plus procedural roof rise from ALKIS dachform; fallback 12m',
          roofGeometrySource:
            'Procedural demo roof from ALKIS dachform; not surveyed Hamburg LoD2 roof geometry',
        },
        geometry: [
          {
            type: 'Solid',
            lod: '2.0',
            boundaries: [model.shell],
            semantics: {
              surfaces: [
                { type: 'GroundSurface' },
                { type: 'RoofSurface' },
                { type: 'WallSurface' },
              ],
              values: [model.semanticValues],
            },
          },
        ],
      },
    },
    vertices: model.vertices,
  };
}

function stripClosingPoint(ring) {
  const last = ring[ring.length - 1];
  const first = ring[0];
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return ring;
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

function roofProfileFromProperties(props, ring) {
  const storeys = storeysFromProperties(props);
  const roof = roofTypeFromCode(props.dachform);
  const wallHeight = storeys
    ? Math.max(3.2, Math.min(82, Number((storeys * 3.2).toFixed(2))))
    : 12;

  if (roof.kind === 'flat') {
    return {
      ...roof,
      eaveHeight: wallHeight,
      totalHeight: wallHeight,
    };
  }

  const rise = roofRiseForRing(ring, roof.kind);
  return {
    ...roof,
    eaveHeight: wallHeight,
    totalHeight: Math.min(90, Number((wallHeight + rise).toFixed(2))),
  };
}

function storeysFromProperties(props) {
  const storeys = Number(props.anzahlDerOberirdischenGeschosse);
  if (Number.isFinite(storeys) && storeys > 0) {
    return storeys;
  }
  return null;
}

function roofTypeFromCode(value) {
  const code = String(value ?? '');
  return ROOF_TYPES[code] ?? { label: 'Unbekannt', kind: 'flat' };
}

function roofRiseForRing(ring, roofKind) {
  const { width, height } = bounds2d(ring);
  const shortSpan = Math.max(4, Math.min(width, height));
  const factor =
    roofKind === 'mansard'
      ? 0.28
      : roofKind === 'shed'
        ? 0.16
        : roofKind === 'hip'
          ? 0.2
          : 0.24;
  return Math.max(1.8, Math.min(8, Number((shortSpan * factor).toFixed(2))));
}

function buildRoofedSolid(ring, roofProfile, transform) {
  const vertices = [];
  const add = (x, y, z) => addVertex(vertices, encodeVertex(x, y, z, transform));

  const ground = ring.map(([x, y]) => add(x, y, 0));
  const eaves = ring.map(([x, y]) => add(x, y, roofProfile.eaveHeight));
  const groundFace = [...ground].reverse();
  const walls = [];

  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    walls.push([ground[i], ground[j], eaves[j], eaves[i]]);
  }

  let roofFaces = [];
  let extraWallFaces = [];

  if (roofProfile.kind === 'flat') {
    roofFaces = [[...eaves]];
  } else if (roofProfile.kind === 'gable' && ring.length === 4) {
    ({ roofFaces, extraWallFaces } = buildGableRoof(ring, eaves, roofProfile.totalHeight, add));
  } else if (roofProfile.kind === 'hip' && ring.length === 4) {
    roofFaces = buildHipRoof(ring, eaves, roofProfile.totalHeight, add);
  } else if (roofProfile.kind === 'shed') {
    roofFaces = buildShedRoof(ring, eaves, roofProfile.eaveHeight, roofProfile.totalHeight, add);
  } else if (roofProfile.kind === 'mansard') {
    roofFaces = buildMansardRoof(ring, eaves, roofProfile.eaveHeight, roofProfile.totalHeight, add);
  } else {
    roofFaces = buildPyramidRoof(ring, eaves, roofProfile.totalHeight, add);
  }

  const shell = [
    [groundFace],
    ...roofFaces.map((face) => [face]),
    ...walls.map((face) => [face]),
    ...extraWallFaces.map((face) => [face]),
  ];

  const semanticValues = [
    0,
    ...new Array(roofFaces.length).fill(1),
    ...new Array(walls.length + extraWallFaces.length).fill(2),
  ];

  return { vertices, shell, semanticValues };
}

function buildPyramidRoof(ring, eaves, topZ, add) {
  const [cx, cy] = polygonCentroid(ring);
  const apex = add(cx, cy, topZ);
  const faces = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    faces.push([eaves[i], eaves[j], apex]);
  }
  return faces;
}

function buildGableRoof(ring, eaves, ridgeZ, add) {
  const [v0, v1, v2, v3] = ring;
  const e0 = distSq(v0, v1);
  const e1 = distSq(v1, v2);
  const e2 = distSq(v2, v3);
  const e3 = distSq(v3, v0);
  const ridgeOnE0 = e0 + e2 >= e1 + e3;

  if (ridgeOnE0) {
    const rAxy = midpoint(v1, v2);
    const rBxy = midpoint(v3, v0);
    const rA = add(rAxy[0], rAxy[1], ridgeZ);
    const rB = add(rBxy[0], rBxy[1], ridgeZ);
    return {
      roofFaces: [
        [eaves[0], eaves[1], rA, rB],
        [eaves[2], eaves[3], rB, rA],
      ],
      extraWallFaces: [
        [eaves[1], eaves[2], rA],
        [eaves[3], eaves[0], rB],
      ],
    };
  }

  const rAxy = midpoint(v0, v1);
  const rBxy = midpoint(v2, v3);
  const rA = add(rAxy[0], rAxy[1], ridgeZ);
  const rB = add(rBxy[0], rBxy[1], ridgeZ);
  return {
    roofFaces: [
      [eaves[1], eaves[2], rB, rA],
      [eaves[3], eaves[0], rA, rB],
    ],
    extraWallFaces: [
      [eaves[0], eaves[1], rA],
      [eaves[2], eaves[3], rB],
    ],
  };
}

function buildHipRoof(ring, eaves, ridgeZ, add) {
  const [v0, v1, v2, v3] = ring;
  const e0 = distSq(v0, v1);
  const e1 = distSq(v1, v2);
  const e2 = distSq(v2, v3);
  const e3 = distSq(v3, v0);
  const ridgeOnE0 = e0 + e2 >= e1 + e3;
  const longLen = Math.sqrt(ridgeOnE0 ? Math.min(e0, e2) : Math.min(e1, e3));
  const shortLen = Math.sqrt(ridgeOnE0 ? Math.min(e1, e3) : Math.min(e0, e2));
  const ridgeLen = Math.max(0, longLen - shortLen);
  const [cx, cy] = polygonCentroid(ring);
  const [pa, pb] = ridgeOnE0 ? [v0, v1] : [v1, v2];
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const norm = Math.hypot(dx, dy) || 1;
  const ux = dx / norm;
  const uy = dy / norm;
  const rA = add(cx - ux * ridgeLen * 0.5, cy - uy * ridgeLen * 0.5, ridgeZ);
  const rB = add(cx + ux * ridgeLen * 0.5, cy + uy * ridgeLen * 0.5, ridgeZ);

  if (ridgeOnE0) {
    return [
      [eaves[0], eaves[1], rB, rA],
      [eaves[2], eaves[3], rA, rB],
      [eaves[1], eaves[2], rB],
      [eaves[3], eaves[0], rA],
    ];
  }
  return [
    [eaves[1], eaves[2], rB, rA],
    [eaves[3], eaves[0], rA, rB],
    [eaves[0], eaves[1], rA],
    [eaves[2], eaves[3], rB],
  ];
}

function buildShedRoof(ring, eaves, eaveZ, ridgeZ, add) {
  const { axisX, axisY } = mainAxis(ring);
  let minCross = Infinity;
  let maxCross = -Infinity;
  const crosses = ring.map(([x, y]) => {
    const c = x * -axisY + y * axisX;
    minCross = Math.min(minCross, c);
    maxCross = Math.max(maxCross, c);
    return c;
  });
  const span = maxCross - minCross || 1;
  const top = ring.map(([x, y], i) => {
    const t = (crosses[i] - minCross) / span;
    return add(x, y, eaveZ + (ridgeZ - eaveZ) * t);
  });
  return [[...top]];
}

function buildMansardRoof(ring, eaves, eaveZ, ridgeZ, add) {
  const [cx, cy] = polygonCentroid(ring);
  const midZ = eaveZ + (ridgeZ - eaveZ) * 0.62;
  const mid = ring.map(([x, y]) => add(cx + (x - cx) * 0.72, cy + (y - cy) * 0.72, midZ));
  const cap = ring.map(([x, y]) => add(cx + (x - cx) * 0.38, cy + (y - cy) * 0.38, ridgeZ));
  const faces = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    faces.push([eaves[i], eaves[j], mid[j], mid[i]]);
    faces.push([mid[i], mid[j], cap[j], cap[i]]);
  }
  faces.push([...cap]);
  return faces;
}

function ensureCounterClockwise(ring) {
  return signedArea(ring) < 0 ? [...ring].reverse() : ring;
}

function signedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area * 0.5;
}

function polygonCentroid(ring) {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area2) < 1e-6) {
    return averagePoint(ring);
  }
  return [cx / (3 * area2), cy / (3 * area2)];
}

function averagePoint(ring) {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function bounds2d(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { width: maxX - minX, height: maxY - minY };
}

function mainAxis(ring) {
  const { width, height } = bounds2d(ring);
  if (width >= height) return { axisX: 1, axisY: 0 };
  return { axisX: 0, axisY: 1 };
}

function distSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function normalizeFunction(value) {
  const code = String(value ?? '');
  if (/^1/.test(code)) return 'residential';
  if (/^(2|3)/.test(code)) return 'commercial';
  if (/^(4|5)/.test(code)) return 'industrial';
  return 'public';
}
