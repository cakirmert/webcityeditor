import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const children: ChildProcess[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('Hamburg CityJSONSeq write-back server', () => {
  it(
    'atomically persists a valid tile, keeps a backup, and rejects stale revisions',
    async () => {
      const outputDir = await mkdtemp(path.join(os.tmpdir(), 'hamburg-writeback-'));
      temporaryDirectories.push(outputDir);
      const tileId = 'tile-a';
      const tileFile = `${tileId}.city.jsonl`;
      const initial = tileText(0);
      await writeFile(path.join(outputDir, tileFile), initial, 'utf8');
      await writeFile(
        path.join(outputDir, 'catalog.json'),
        `${JSON.stringify(catalog(tileId, tileFile), null, 2)}\n`,
        'utf8'
      );
      const port = await reservePort();
      const child = spawn(
        process.execPath,
        [
          path.resolve('scripts/hamburg-lod2.mjs'),
          'serve',
          '--output-dir',
          outputDir,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--skip-writeback-geometry-validation',
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      );
      children.push(child);
      const baseUrl = `http://127.0.0.1:${port}`;
      await waitForHealth(baseUrl, child);
      const query = (await fetch(`${baseUrl}/api/hamburg/tiles?bbox=0,0,10,10`).then((res) =>
        res.json()
      )) as { tiles: { revision: string }[] };
      const revision = query.tiles[0].revision;
      expect(revision).toMatch(/^[0-9a-f]{64}$/);
      const exportValidation = await fetch(`${baseUrl}/api/hamburg/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/city+json; charset=utf-8' },
        body: JSON.stringify({ type: 'CityJSON', version: '2.0', CityObjects: {}, vertices: [] }),
      });
      expect(exportValidation.status).toBe(503);
      const moved = tileText(1000);
      const blind = await fetch(`${baseUrl}/api/hamburg/tiles/${tileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/city+json-seq; charset=utf-8' },
        body: moved,
      });
      expect(blind.status).toBe(428);
      const saved = await fetch(`${baseUrl}/api/hamburg/tiles/${tileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/city+json-seq; charset=utf-8',
          'If-Match': `"${revision}"`,
        },
        body: moved,
      });

      expect(saved.status).toBe(200);
      const payload = (await saved.json()) as { tile: { revision: string }; backup: string };
      expect(payload.tile.revision).not.toBe(revision);
      expect(await readFile(path.join(outputDir, tileFile), 'utf8')).toBe(moved);
      expect(await readdir(path.join(outputDir, '.history', tileId))).toHaveLength(1);

      const stale = await fetch(`${baseUrl}/api/hamburg/tiles/${tileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/city+json-seq; charset=utf-8',
          'If-Match': `"${revision}"`,
        },
        body: tileText(2000),
      });
      expect(stale.status).toBe(409);
      expect(await readFile(path.join(outputDir, tileFile), 'utf8')).toBe(moved);

      const malformed = await fetch(`${baseUrl}/api/hamburg/tiles/${tileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/city+json-seq; charset=utf-8',
          'If-Match': `"${payload.tile.revision}"`,
        },
        body: '{bad json}\n',
      });
      expect(malformed.status).toBe(422);
      expect(await readFile(path.join(outputDir, tileFile), 'utf8')).toBe(moved);

      const deleted = await fetch(`${baseUrl}/api/hamburg/tiles/${tileId}`, {
        method: 'DELETE',
        headers: { 'If-Match': `"${payload.tile.revision}"` },
      });
      expect(deleted.status).toBe(200);
      await expect(readFile(path.join(outputDir, tileFile), 'utf8')).rejects.toThrow();
      expect(await readdir(path.join(outputDir, '.history', tileId))).toHaveLength(2);
      const catalogAfterDelete = JSON.parse(
        await readFile(path.join(outputDir, 'catalog.json'), 'utf8')
      ) as { tiles: unknown[] };
      expect(catalogAfterDelete.tiles).toEqual([]);
    },
    30_000
  );
});

function tileText(dx: number): string {
  return (
    [
      {
        type: 'CityJSON',
        version: '2.0',
        transform: { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] },
        metadata: { referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832' },
        CityObjects: {},
        vertices: [],
      },
      {
        type: 'CityJSONFeature',
        id: 'Building_A',
        CityObjects: {
          Building_A: {
            type: 'Building',
            geometry: [
              {
                type: 'Solid',
                lod: '2.0',
                boundaries: [
                  [
                    [[0, 3, 2, 1]],
                    [[4, 5, 6, 7]],
                    [[0, 1, 5, 4]],
                    [[1, 2, 6, 5]],
                    [[2, 3, 7, 6]],
                    [[3, 0, 4, 7]],
                  ],
                ],
              },
            ],
          },
        },
        vertices: [
          [dx, 0, 0],
          [dx + 10000, 0, 0],
          [dx + 10000, 10000, 0],
          [dx, 10000, 0],
          [dx, 0, 10000],
          [dx + 10000, 0, 10000],
          [dx + 10000, 10000, 10000],
          [dx, 10000, 10000],
        ],
      },
    ]
      .map((value) => JSON.stringify(value))
      .join('\n') + '\n'
  );
}

function catalog(id: string, file: string) {
  return {
    type: 'HamburgLoD2CityJSONSeqCatalog',
    generatedAt: new Date(0).toISOString(),
    crs: 'EPSG:25832',
    summary: {
      tiles: 1,
      features: 1,
      cityObjects: 1,
      vertices: 8,
      syntheticRootsAdded: 0,
      extent: [0, 0, 0, 10, 10, 10],
    },
    tiles: [
      {
        id,
        file,
        url: `/tiles/${file}`,
        extent: [0, 0, 0, 10, 10, 10],
        features: 1,
        cityObjects: 1,
        vertices: 8,
        syntheticRootsAdded: 0,
      },
    ],
  };
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve an HTTP port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess): Promise<void> {
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Tile server exited early: ${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Tile server did not become healthy: ${stderr}`);
}
