import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findReadyHamburgRoadCatalog } from '../../scripts/hamburg-road-catalog-path.mjs';

const projectRoot = resolve(__dirname, '../..');
const scriptPath = resolve(projectRoot, 'scripts/prepare-hamburg-road-catalog.mjs');

describe('Hamburg road catalog preparation', () => {
  it('prints a portable, non-mutating local build plan', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'webcityeditor-hamburg-roads-plan-'));
    const outputDir = resolve(dir, 'catalog');
    const workDir = resolve(dir, 'work');
    const osmPath = resolve(dir, 'hamburg-latest.osm.pbf');
    try {
      const stdout = execFileSync(
        process.execPath,
        [
          scriptPath,
          '--dry-run',
          '--osm',
          osmPath,
          '--output-dir',
          outputDir,
          '--work-dir',
          workDir,
        ],
        { cwd: projectRoot, encoding: 'utf8' }
      );
      const plan = JSON.parse(stdout);

      expect(plan).toMatchObject({
        type: 'HamburgRoadCatalogPreparationPlan',
        sourceUrl: 'https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf',
        osmPath,
        outputDir,
        workDir,
        bbox: [
          8.487587953331118,
          53.39685748599475,
          10.334190169755693,
          53.93059691328656,
        ],
        tiling: {
          grid: 2,
          minDepth: 2,
          maxDepth: 3,
          maxLaneGeoJsonMiB: 384,
        },
        outputMode: {
          cityjsonseqOnly: true,
          discardSuccessfulWork: true,
        },
      });
      expect(plan.exporter).toMatch(
        process.platform === 'win32'
          ? /webcityeditor_native_export\.exe$/
          : /webcityeditor_native_export$/
      );
      expect(existsSync(outputDir)).toBe(false);
      expect(existsSync(workDir)).toBe(false);
      expect(existsSync(osmPath)).toBe(false);
      expect(existsSync(resolve(projectRoot, 'PREPARE_HAMBURG_ROADS.cmd'))).toBe(true);
      expect(
        existsSync(resolve(projectRoot, 'scripts/prepare-hamburg-roads-on-windows.ps1'))
      ).toBe(true);
      const packageJson = JSON.parse(
        readFileSync(resolve(projectRoot, 'package.json'), 'utf8')
      );
      expect(packageJson.scripts['dev:hamburg-roads']).toBe(
        'node scripts/dev.mjs --catalog roads'
      );
      expect(packageJson.scripts['data:hamburg-roads:serve']).toBe(
        'node scripts/dev.mjs --catalog roads --server-only'
      );

      const preferredDir = resolve(dir, 'cityjsonseq');
      const completeDir = resolve(dir, 'cityjsonseq-complete-proof');
      mkdirSync(preferredDir);
      mkdirSync(completeDir);
      writeFileSync(
        resolve(preferredDir, 'catalog.json'),
        JSON.stringify({ type: 'HamburgLoD2CityJSONSeqCatalog' })
      );
      writeFileSync(resolve(completeDir, 'tile.city.jsonl'), '{"type":"CityJSON"}\n');
      writeFileSync(
        resolve(completeDir, 'catalog.json'),
        JSON.stringify({
          type: 'HamburgOsm2StreetsRoadCityJSONSeqCatalog',
          summary: { tiles: 1, features: 1, failed: 0 },
          tiles: [{ file: 'tile.city.jsonl' }],
        })
      );
      expect(findReadyHamburgRoadCatalog(preferredDir)?.directory).toBe(completeDir);

      const startupPlan = JSON.parse(
        execFileSync(
          process.execPath,
          [
            resolve(projectRoot, 'scripts/dev.mjs'),
            '--catalog',
            'roads',
            '--output-dir',
            completeDir,
            '--dry-run',
          ],
          { cwd: projectRoot, encoding: 'utf8' }
        )
      );
      expect(startupPlan).toMatchObject({
        type: 'WebcityeditorDevelopmentStartupPlan',
        catalogMode: 'roads',
        catalogUrl: 'http://127.0.0.1:8788',
        serverOnly: false,
        serverArgs: [
          'scripts/hamburg-lod2.mjs',
          'serve',
          '--output-dir',
          completeDir,
          '--port',
          '8788',
        ],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
