import fs from 'node:fs/promises';
import path from 'node:path';

const [
  ,
  ,
  inputArg = '.tmp/hamburg-lod3-converted/6433/6433.json',
  sourceImagesArg = '.tmp/hamburg-lod3-source/6433/6433/images',
  baseSequenceArg = 'public/data/hamburg/hamburg-city-center-buildings.city.jsonl',
  outputArg = 'public/data/hamburg/hamburg-lod3-showcase.city.json',
  outputImagesArg = 'public/data/hamburg/lod3-6433-textures',
] = process.argv;

const source = JSON.parse(await fs.readFile(path.resolve(inputArg), 'utf8'));
const baseIds = await readSequenceObjectIds(path.resolve(baseSequenceArg));
const target = [565000, 5933600];
const selectedRoots = Object.entries(source.CityObjects)
  .filter(([id, object]) => object.type === 'Building' && baseIds.has(id))
  .map(([id, object]) => ({ id, distance: distanceToObject(source, object, target) }))
  .sort((a, b) => a.distance - b.distance)
  .map(({ id }) => id);

const selectedIds = new Set();
for (const id of selectedRoots) addWithChildren(source.CityObjects, id, selectedIds);

const selectedObjects = Object.fromEntries(
  [...selectedIds].map((id) => [id, structuredClone(source.CityObjects[id])])
);
const vertexIds = collectBoundaryIndices(
  Object.values(selectedObjects).flatMap((object) =>
    (object.geometry ?? []).map((geometry) => geometry.boundaries)
  )
);
const vertexMap = new Map([...vertexIds].map((id, index) => [id, index]));
for (const object of Object.values(selectedObjects)) {
  for (const geometry of object.geometry ?? []) {
    geometry.boundaries = remapBoundaries(geometry.boundaries, vertexMap);
  }
}

const textureIds = new Set();
const textureVertexIds = new Set();
for (const object of Object.values(selectedObjects)) {
  for (const geometry of object.geometry ?? []) {
    collectTextureIndices(geometry.texture, textureIds, textureVertexIds);
  }
}
const textureMap = new Map([...textureIds].map((id, index) => [id, index]));
const textureVertexMap = new Map([...textureVertexIds].map((id, index) => [id, index]));
for (const object of Object.values(selectedObjects)) {
  for (const geometry of object.geometry ?? []) {
    if (geometry.texture) {
      geometry.texture = remapTexture(geometry.texture, textureMap, textureVertexMap);
    }
  }
  object.attributes = {
    ...(object.attributes ?? {}),
    _sourceDataset: 'Hamburg LoD3.0-HH Area 1 (2023), tile 6433',
    _sourceUrl:
      'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5',
  };
}

const outputImages = path.resolve(outputImagesArg);
await fs.mkdir(outputImages, { recursive: true });
const textures = [];
for (const sourceIndex of textureIds) {
  const texture = structuredClone(source.appearance.textures[sourceIndex]);
  const fileName = path.basename(texture.image);
  texture.image = `data/hamburg/lod3-6433-textures/${fileName}`;
  textures.push(texture);
  await fs.copyFile(path.join(path.resolve(sourceImagesArg), fileName), path.join(outputImages, fileName));
}

const vertices = [...vertexIds].map((id) => source.vertices[id]);
const decoded = vertices.map((vertex) => decodeVertex(source, vertex));
const extent = [
  ...[0, 1, 2].map((axis) => Math.min(...decoded.map((vertex) => vertex[axis]))),
  ...[0, 1, 2].map((axis) => Math.max(...decoded.map((vertex) => vertex[axis]))),
];
const output = {
  type: 'CityJSON',
  version: '2.0',
  CityObjects: selectedObjects,
  vertices,
  transform: structuredClone(source.transform),
  appearance: {
    textures,
    'vertices-texture': [...textureVertexIds].map(
      (id) => source.appearance['vertices-texture'][id]
    ),
  },
  metadata: {
    geographicalExtent: extent,
    referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    title: 'Hamburg official textured LoD3 showcase — tile 6433',
    source:
      'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5',
    sourceDescription:
      'Official Hamburg LoD3.0 geometry and textures at their surveyed coordinates.',
    rootBuildingCount: selectedRoots.length,
  },
};

await fs.mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
await fs.writeFile(path.resolve(outputArg), `${JSON.stringify(output)}\n`);
console.log(
  `Built Hamburg LoD3 showcase: ${selectedRoots.length} buildings, ` +
    `${selectedIds.size - selectedRoots.length} installations, ${vertices.length} vertices, ` +
    `${textures.length} textures`
);

async function readSequenceObjectIds(file) {
  const text = await fs.readFile(file, 'utf8');
  const ids = new Set();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const feature = JSON.parse(line);
    Object.keys(feature.CityObjects ?? {}).forEach((id) => ids.add(id));
  }
  return ids;
}

function addWithChildren(objects, id, selected) {
  if (selected.has(id) || !objects[id]) return;
  selected.add(id);
  for (const child of objects[id].children ?? []) addWithChildren(objects, child, selected);
}

function distanceToObject(doc, object, targetPoint) {
  const indices = collectBoundaryIndices(
    (object.geometry ?? []).map((geometry) => geometry.boundaries)
  );
  if (!indices.size) return Infinity;
  const center = [0, 1].map(
    (axis) =>
      [...indices].reduce((sum, id) => sum + decodeVertex(doc, doc.vertices[id])[axis], 0) /
      indices.size
  );
  return (center[0] - targetPoint[0]) ** 2 + (center[1] - targetPoint[1]) ** 2;
}

function decodeVertex(doc, vertex) {
  const transform = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  return vertex.map(
    (value, axis) => value * transform.scale[axis] + transform.translate[axis]
  );
}

function collectBoundaryIndices(value, result = new Set()) {
  if (Number.isInteger(value)) result.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectBoundaryIndices(item, result));
  return result;
}

function remapBoundaries(value, vertexMap) {
  if (Number.isInteger(value)) return vertexMap.get(value);
  return Array.isArray(value)
    ? value.map((item) => remapBoundaries(item, vertexMap))
    : value;
}

function collectTextureIndices(value, textures, vertices) {
  if (value == null || typeof value !== 'object') return;
  if (!Array.isArray(value)) {
    Object.values(value).forEach((item) => collectTextureIndices(item, textures, vertices));
    return;
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    textures.add(value[0]);
    value.slice(1).forEach((id) => {
      if (Number.isInteger(id)) vertices.add(id);
    });
    return;
  }
  value.forEach((item) => collectTextureIndices(item, textures, vertices));
}

function remapTexture(value, textureMap, vertexMap) {
  if (value == null || typeof value !== 'object') return value;
  if (!Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapTexture(item, textureMap, vertexMap),
      ])
    );
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    return [
      textureMap.get(value[0]),
      ...value.slice(1).map((id) => (Number.isInteger(id) ? vertexMap.get(id) : id)),
    ];
  }
  return value.map((item) => remapTexture(item, textureMap, vertexMap));
}
