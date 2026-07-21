import fs from 'node:fs/promises';
import path from 'node:path';

const [
  ,
  ,
  inputArg = 'public/data/hamburg/hamburg-lod3-showcase.city.json',
  outputDirArg = 'public/data/assets/hamburg-lod3',
] = process.argv;

// Four compact, single-root examples from Hamburg's official web-published
// LoD3 Area 1 data. Descendant BuildingInstallation objects stay attached so
// roof equipment and facade detail are not silently discarded.
const selections = [
  {
    sourceId: 'DEHHALKAJ0000pIJ',
    file: 'gabled-townhouse.city.json',
    name: 'Gabled townhouse',
    description: 'Narrow historic city house with a detailed pitched roof.',
  },
  {
    sourceId: 'DEHHALKAJ0000p7C',
    file: 'urban-corner-house.city.json',
    name: 'Urban corner house',
    description: 'Tall corner building with dormers and a complex roofline.',
  },
  {
    sourceId: 'DEHHALKAJ0000p29',
    file: 'courtyard-office.city.json',
    name: 'Courtyard office',
    description: 'Larger office block with a varied roof and facade installations.',
  },
  {
    sourceId: 'DEHHALKAJ0000opW',
    file: 'civic-building.city.json',
    name: 'Civic building',
    description: 'Highly detailed public-scale building with multiple roof forms.',
  },
];

const source = JSON.parse(await fs.readFile(path.resolve(inputArg), 'utf8'));
const outputDir = path.resolve(outputDirArg);
await fs.mkdir(outputDir, { recursive: true });

for (const selection of selections) {
  const root = source.CityObjects?.[selection.sourceId];
  if (!root) throw new Error(`Missing CityObject ${selection.sourceId}`);

  const objectIds = collectObjectTree(source, selection.sourceId);
  const objects = Object.fromEntries(
    objectIds.map((id) => [id, structuredClone(source.CityObjects[id])])
  );
  const geometries = Object.values(objects).flatMap((object) => object.geometry ?? []);
  const sourceVertexIds = collectBoundaryIndices(
    geometries.map((geometry) => geometry.boundaries)
  );
  const decodedVertices = [...sourceVertexIds].map((index) => decodeVertex(source, index));
  const min = [0, 1, 2].map((axis) =>
    Math.min(...decodedVertices.map((vertex) => vertex[axis]))
  );
  const max = [0, 1, 2].map((axis) =>
    Math.max(...decodedVertices.map((vertex) => vertex[axis]))
  );
  const centerX = (min[0] + max[0]) / 2;
  const centerY = (min[1] + max[1]) / 2;
  const vertexMap = new Map([...sourceVertexIds].map((index, local) => [index, local]));
  for (const object of Object.values(objects)) {
    for (const geometry of object.geometry ?? []) {
      geometry.boundaries = remapBoundaries(geometry.boundaries, vertexMap);
    }
  }

  const textureIds = collectTextureIndices(
    geometries.map((geometry) => geometry.texture)
  );
  const textureVertexIds = collectTextureVertexIndices(
    geometries.map((geometry) => geometry.texture)
  );
  const textureMap = new Map([...textureIds].map((index, local) => [index, local]));
  const textureVertexMap = new Map(
    [...textureVertexIds].map((index, local) => [index, local])
  );
  for (const object of Object.values(objects)) {
    for (const geometry of object.geometry ?? []) {
      if (geometry.texture) {
        geometry.texture = remapTexture(geometry.texture, textureMap, textureVertexMap);
      }
    }
  }

  const measuredHeight = round(max[2] - min[2]);
  objects[selection.sourceId].attributes = {
    ...structuredClone(objects[selection.sourceId].attributes ?? {}),
    name: selection.name,
    measuredHeight,
    _assetSource: 'Hamburg LoD3.0-HH Area 1 (2023), tile 6433',
    _sourceObjectId: selection.sourceId,
    _license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
    _attribution:
      'Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung',
  };

  const textures = [];
  for (const sourceTextureId of textureIds) {
    const texture = structuredClone(source.appearance.textures[sourceTextureId]);
    const fileName = path.basename(texture.image);
    texture.image = fileName;
    textures.push(texture);
    await fs.copyFile(
      path.resolve('public', source.appearance.textures[sourceTextureId].image),
      path.join(outputDir, fileName)
    );
  }

  const asset = {
    type: 'CityJSON',
    version: '2.0',
    CityObjects: objects,
    vertices: [...sourceVertexIds].map((index) => {
      const [x, y, z] = decodeVertex(source, index);
      return [round(x - centerX), round(y - centerY), round(z - min[2])];
    }),
    appearance: {
      textures,
      'vertices-texture': [...textureVertexIds].map(
        (index) => source.appearance['vertices-texture'][index]
      ),
    },
    metadata: {
      referenceSystem: source.metadata?.referenceSystem,
      geographicalExtent: [
        round(min[0] - centerX),
        round(min[1] - centerY),
        0,
        round(max[0] - centerX),
        round(max[1] - centerY),
        measuredHeight,
      ],
      title: selection.name,
      description: selection.description,
      source:
        'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod3-0-hh-hamburg17',
    },
  };

  await fs.writeFile(path.join(outputDir, selection.file), `${JSON.stringify(asset)}\n`);
  console.log(
    `${selection.file}: ${objectIds.length} objects, ${asset.vertices.length} vertices, ` +
      `${measuredHeight} m high, ${textures.length} texture atlas`
  );
}

function collectObjectTree(doc, rootId) {
  const result = [];
  const queue = [rootId];
  const seen = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id) || !doc.CityObjects[id]) continue;
    seen.add(id);
    result.push(id);
    queue.push(...(doc.CityObjects[id].children ?? []));
  }
  return result;
}

function decodeVertex(doc, index) {
  const vertex = doc.vertices[index];
  const transform = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  return vertex.map(
    (value, axis) => value * transform.scale[axis] + transform.translate[axis]
  );
}

function collectBoundaryIndices(values, result = new Set()) {
  if (Number.isInteger(values)) result.add(values);
  else if (Array.isArray(values)) {
    values.forEach((value) => collectBoundaryIndices(value, result));
  }
  return result;
}

function remapBoundaries(values, vertexMap) {
  if (Number.isInteger(values)) return vertexMap.get(values);
  return Array.isArray(values)
    ? values.map((value) => remapBoundaries(value, vertexMap))
    : values;
}

function collectTextureIndices(values, result = new Set()) {
  visitTextureReferences(values, (reference) => result.add(reference[0]));
  return result;
}

function collectTextureVertexIndices(values, result = new Set()) {
  visitTextureReferences(values, (reference) => {
    reference.slice(1).forEach((index) => {
      if (Number.isInteger(index)) result.add(index);
    });
  });
  return result;
}

function visitTextureReferences(value, visit) {
  if (value == null) return;
  if (!Array.isArray(value)) {
    if (typeof value === 'object') Object.values(value).forEach((item) => visitTextureReferences(item, visit));
    return;
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    visit(value);
    return;
  }
  value.forEach((item) => visitTextureReferences(item, visit));
}

function remapTexture(value, textureMap, textureVertexMap) {
  if (value == null || typeof value !== 'object') return value;
  if (!Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapTexture(item, textureMap, textureVertexMap),
      ])
    );
  }
  if (value.length > 1 && Number.isInteger(value[0])) {
    return [
      textureMap.get(value[0]),
      ...value.slice(1).map((index) =>
        Number.isInteger(index) ? textureVertexMap.get(index) : index
      ),
    ];
  }
  return value.map((item) => remapTexture(item, textureMap, textureVertexMap));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
