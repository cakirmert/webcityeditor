import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const prototypeRoot = resolve(__dirname, '../..');
const scriptPath = resolve(prototypeRoot, 'scripts/prepare-hamburg-road-catalog.mjs');

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
        { cwd: prototypeRoot, encoding: 'utf8' }
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
