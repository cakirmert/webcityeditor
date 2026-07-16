import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const prototypeRoot = path.resolve(__dirname, '../..');
const scriptPath = path.resolve(prototypeRoot, 'scripts/opendrive-rtron.mjs');

describe('OpenDRIVE r:trån CLI', () => {
  it('prints a pinned, non-mutating validation and conversion plan', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'webcityeditor-rtron-plan-'));
    const inputDir = path.join(dir, 'opendrive');
    const outputDir = path.join(dir, 'output');
    const rtronJar = path.join(dir, 'tools', 'rtron.jar');
    try {
      const stdout = execFileSync(
        process.execPath,
        [
          scriptPath,
          inputDir,
          '--output-dir',
          outputDir,
          '--rtron-jar',
          rtronJar,
          '--java',
          'java-custom',
          '--dry-run',
        ],
        { cwd: prototypeRoot, encoding: 'utf8' }
      );
      const plan = JSON.parse(stdout);

      expect(plan).toMatchObject({
        type: 'OpenDriveRtronPipelinePlan',
        dryRun: true,
        rtron: {
          version: '1.3.0',
          downloadUrl:
            'https://github.com/tum-gis/rtron/releases/download/v1.3.0/rtron-1.3.0.jar',
        },
        requirements: {
          minimumJavaMajor: 11,
          input: 'Directory containing one or more .xodr files',
        },
        inputDir,
        outputDir,
        reportsDir: path.join(outputDir, 'reports'),
        citygmlDir: path.join(outputDir, 'citygml'),
        rtronJar,
        java: 'java-custom',
      });
      expect(plan.commands).toEqual([
        {
          name: 'validate-opendrive',
          executable: 'java-custom',
          args: [
            '-jar',
            rtronJar,
            'validate-opendrive',
            inputDir,
            path.join(outputDir, 'reports'),
          ],
        },
        {
          name: 'opendrive-to-citygml',
          executable: 'java-custom',
          args: [
            '-jar',
            rtronJar,
            'opendrive-to-citygml',
            inputDir,
            path.join(outputDir, 'citygml'),
          ],
        },
      ]);
      expect(existsSync(inputDir)).toBe(false);
      expect(existsSync(outputDir)).toBe(false);
      expect(existsSync(rtronJar)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
