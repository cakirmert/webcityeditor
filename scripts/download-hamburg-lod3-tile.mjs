import fs from 'node:fs/promises';
import path from 'node:path';

const ARCHIVE_URL =
  'https://archiv.transparenz.hamburg.de/hmbtgarchive/HMDK/lod3-hh_area1_2023_12_14_180710_snap_1.zip';
const CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;
const [, , tile = '6433', outputArg = `.tmp/hamburg-lod3-source/${tile}.zip`] = process.argv;

const head = await fetch(ARCHIVE_URL, { method: 'HEAD' });
if (!head.ok) throw new Error(`Archive HEAD failed: HTTP ${head.status}`);
const archiveSize = Number(head.headers.get('content-length'));
if (!Number.isFinite(archiveSize)) throw new Error('Archive did not report a content length');

const tailStart = Math.max(0, archiveSize - CENTRAL_DIRECTORY_BYTES);
const tail = Buffer.from(await fetchRange(tailStart, archiveSize - 1));
const entries = parseCentralDirectory(tail);
const selected = entries.filter((entry) => entry.name.startsWith(`${tile}/`));
if (!selected.length) throw new Error(`Tile ${tile} was not found in the Hamburg archive`);

const firstOffset = Math.min(...selected.map((entry) => entry.localOffset));
const lastOffset = Math.max(...selected.map((entry) => entry.localOffset));
const nextEntry = entries
  .filter((entry) => entry.localOffset > lastOffset)
  .sort((a, b) => a.localOffset - b.localOffset)[0];
const lastByte = (nextEntry?.localOffset ?? archiveSize) - 1;
const localRecords = Buffer.from(await fetchRange(firstOffset, lastByte));

const centralRecords = selected.map((entry) => {
  const record = Buffer.from(entry.record);
  record.writeUInt32LE(entry.localOffset - firstOffset, 42);
  return record;
});
const centralDirectory = Buffer.concat(centralRecords);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(selected.length, 8);
eocd.writeUInt16LE(selected.length, 10);
eocd.writeUInt32LE(centralDirectory.length, 12);
eocd.writeUInt32LE(localRecords.length, 16);

const output = path.resolve(outputArg);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, Buffer.concat([localRecords, centralDirectory, eocd]));
console.log(
  `Downloaded official Hamburg LoD3 tile ${tile}: ${selected.length} files, ` +
    `${((localRecords.length + centralDirectory.length + eocd.length) / 1_000_000).toFixed(1)} MB`
);

async function fetchRange(start, end) {
  const response = await fetch(ARCHIVE_URL, {
    headers: { Range: `bytes=${start}-${end}` },
  });
  if (response.status !== 206) {
    throw new Error(`Archive range ${start}-${end} failed: HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

function parseCentralDirectory(buffer) {
  const records = [];
  for (let offset = 0; offset + 46 <= buffer.length; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (offset + recordLength > buffer.length) continue;
    records.push({
      name: buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
      localOffset: buffer.readUInt32LE(offset + 42),
      record: buffer.subarray(offset, offset + recordLength),
    });
    offset += recordLength - 1;
  }
  return records;
}
