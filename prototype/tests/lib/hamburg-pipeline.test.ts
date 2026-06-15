import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Hamburg LoD2 whole-city pipeline CLI', () => {
  it('validates the committed Hamburg CityJSONSeq sample', () => {
    const output = execFileSync(
      process.execPath,
      [
        path.resolve('scripts/hamburg-lod2.mjs'),
        'validate',
        '--input',
        path.resolve('public/data/hamburg/hamburg-center-alkis.city.jsonl'),
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );

    expect(output).toContain('valid hamburg-center-alkis.city.jsonl');
    expect(output).toContain('180 features');
  });
});
