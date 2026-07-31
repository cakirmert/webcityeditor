import { describe, expect, it } from 'vitest';
import { parseHamburgTreeTile } from '../../src/lib/hamburg-tree-tiles';

describe('Hamburg citywide tree tiles', () => {
  it('decodes official-style I3DM instances without loading a citywide asset', () => {
    const tree = parseHamburgTreeTile(createTreeI3dm())[0];

    expect(tree).toMatchObject({
      id: 'Veg_outside_center',
      position: [0, 0, 0],
      height: 12.4,
      crownDiameter: 7.2,
      trunkRadius: 0.32,
      species: 'Quercus robur',
      genus: 'Quercus',
      plantingYear: 1984,
      street: 'Teststraße',
    });
  });
});

function createTreeI3dm(): ArrayBuffer {
  const featureTable = paddedJson({
    INSTANCES_LENGTH: 1,
    POSITION: { byteOffset: 0 },
    BATCH_ID: { byteOffset: 12, componentType: 'UNSIGNED_SHORT' },
  });
  const featureBinary = new Uint8Array(14);
  const featureView = new DataView(featureBinary.buffer);
  featureView.setFloat32(0, 6_378_137, true);
  featureView.setFloat32(4, 0, true);
  featureView.setFloat32(8, 0, true);
  featureView.setUint16(12, 0, true);
  const batchTable = paddedJson({
    id: ['Veg_outside_center'],
    attributes: [
      {
        Hoehe_aus_ALS: 12.4,
        Kronendurchmesser: 7.2,
        Stammumfang: 200,
        Baumart: 'Quercus robur',
        Gattung: 'Quercus',
        Pflanzjahr: 1984,
        Straße: 'Teststraße',
      },
    ],
  });

  const byteLength =
    32 + featureTable.byteLength + featureBinary.byteLength + batchTable.byteLength;
  const output = new Uint8Array(byteLength);
  output.set(new TextEncoder().encode('i3dm'), 0);
  const header = new DataView(output.buffer);
  header.setUint32(4, 1, true);
  header.setUint32(8, byteLength, true);
  header.setUint32(12, featureTable.byteLength, true);
  header.setUint32(16, featureBinary.byteLength, true);
  header.setUint32(20, batchTable.byteLength, true);
  header.setUint32(24, 0, true);
  header.setUint32(28, 1, true);
  let offset = 32;
  output.set(featureTable, offset);
  offset += featureTable.byteLength;
  output.set(featureBinary, offset);
  offset += featureBinary.byteLength;
  output.set(batchTable, offset);
  return output.buffer;
}

function paddedJson(value: unknown): Uint8Array {
  let json = JSON.stringify(value);
  while (json.length % 8 !== 0) json += ' ';
  return new TextEncoder().encode(json);
}
