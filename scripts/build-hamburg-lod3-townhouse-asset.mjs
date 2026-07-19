import fs from 'node:fs/promises';
import path from 'node:path';

const [
  ,
  ,
  inputArg = 'public/data/hamburg/hamburg-lod3-showcase.city.json',
  outputDirArg = 'public/data/assets/hamburg-lod3',
] = process.argv;

const sourceId = 'DEHHALKAJ0000pIJ';
const assetId = 'hamburg-lod3-townhouse';
const assetFile = 'hamburg-townhouse.city.json';
const textureFile = 'hamburg-townhouse.jpg';
const source = JSON.parse(await fs.readFile(path.resolve(inputArg), 'utf8'));
const object = source.CityObjects?.[sourceId];
if (!object) throw new Error(`Missing CityObject ${sourceId}`);

const geometry = structuredClone(object.geometry ?? []);
const sourceVertexIds = collectBoundaryIndices(geometry.map((item) => item.boundaries));
const sourceVertices = [...sourceVertexIds].map((index) => decodeVertex(source, index));
const min = [0, 1, 2].map((axis) => Math.min(...sourceVertices.map((vertex) => vertex[axis])));
const max = [0, 1, 2].map((axis) => Math.max(...sourceVertices.map((vertex) => vertex[axis])));
const centerX = (min[0] + max[0]) / 2;
const centerY = (min[1] + max[1]) / 2;
const vertexMap = new Map([...sourceVertexIds].map((index, local) => [index, local]));
for (const item of geometry) item.boundaries = remapBoundaries(item.boundaries, vertexMap);

const textureIndex = findTextureIndex(geometry);
if (textureIndex == null) throw new Error(`${sourceId} has no texture`);
const textureVertexIds = collectTextureVertexIndices(geometry);
const textureVertexMap = new Map([...textureVertexIds].map((index, local) => [index, local]));
for (const item of geometry) {
  if (item.texture) item.texture = remapTexture(item.texture, textureIndex, textureVertexMap);
}

const measuredHeight = round(max[2] - min[2]);
const exportedObject = {
  ...structuredClone(object),
  attributes: {
    ...structuredClone(object.attributes ?? {}),
    name: 'Hamburg townhouse',
    measuredHeight,
    function: 'residential',
    _assetSource: 'Hamburg LoD3.0-HH Area 1 (2023), tile 6433',
    _sourceObjectId: sourceId,
    _license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
    _attribution: 'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
  },
  geometry,
};
delete exportedObject.children;
delete exportedObject.parents;

const asset = {
  type: 'CityJSON',
  version: '2.0',
  CityObjects: { [assetId]: exportedObject },
  vertices: [...sourceVertexIds].map((index) => {
    const [x, y, z] = decodeVertex(source, index);
    return [round(x - centerX), round(y - centerY), round(z - min[2])];
  }),
  appearance: {
    textures: [
      {
        ...structuredClone(source.appearance.textures[textureIndex]),
        image: textureFile,
      },
    ],
    'vertices-texture': [...textureVertexIds].map(
      (index) => source.appearance['vertices-texture'][index]
    ),
  },
  metadata: {
    geographicalExtent: [
      round(min[0] - centerX),
      round(min[1] - centerY),
      0,
      round(max[0] - centerX),
      round(max[1] - centerY),
      measuredHeight,
    ],
    title: 'Hamburg townhouse',
    source: 'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg5',
  },
};

const outputDir = path.resolve(outputDirArg);
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, assetFile), `${JSON.stringify(asset)}\n`);
const sourceTexture = source.appearance.textures[textureIndex].image;
await fs.copyFile(path.resolve('public', sourceTexture), path.join(outputDir, textureFile));
console.log(
  `${assetFile}: ${asset.vertices.length} vertices, ${measuredHeight} m high, ${textureVertexIds.size} texture vertices`
);

function decodeVertex(doc, index) {
  const vertex = doc.vertices[index];
  const transform = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  return vertex.map((value, axis) => value * transform.scale[axis] + transform.translate[axis]);
}

function collectBoundaryIndices(values, result = new Set()) {
  if (Number.isInteger(values)) result.add(values);
  else if (Array.isArray(values)) values.forEach((value) => collectBoundaryIndices(value, result));
  return result;
}

function remapBoundaries(values, vertexMap) {
  if (Number.isInteger(values)) return vertexMap.get(values);
  return Array.isArray(values) ? values.map((value) => remapBoundaries(value, vertexMap)) : values;
}

function findTextureIndex(geometry) {
  let found = null;
  const visit = (value) => {
    if (found != null || value == null) return;
    if (!Array.isArray(value)) {
      if (typeof value === 'object') Object.values(value).forEach(visit);
      return;
    }
    if (value.length > 1 && Number.isInteger(value[0])) {
      found = value[0];
      return;
    }
    value.forEach(visit);
  };
  geometry.forEach((item) => visit(item.texture));
  return found;
}

function collectTextureVertexIndices(geometry, result = new Set()) {
  const visit = (value) => {
    if (value == null) return;
    if (!Array.isArray(value)) {
      if (typeof value === 'object') Object.values(value).forEach(visit);
      return;
    }
    if (value.length > 1 && Number.isInteger(value[0])) {
      value.slice(1).forEach((index) => {
        if (Number.isInteger(index)) result.add(index);
      });
      return;
    }
    value.forEach(visit);
  };
  geometry.forEach((item) => visit(item.texture));
  return result;
}

function remapTexture(value, sourceTextureIndex, textureVertexMap) {
  if (value == null || typeof value !== 'object') return value;
  if (!Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapTexture(item, sourceTextureIndex, textureVertexMap),
      ])
    );
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    if (value[0] !== sourceTextureIndex) return value;
    return [
      0,
      ...value.slice(1).map((index) =>
        Number.isInteger(index) ? textureVertexMap.get(index) : index
      ),
    ];
  }
  return value.map((item) => remapTexture(item, sourceTextureIndex, textureVertexMap));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
