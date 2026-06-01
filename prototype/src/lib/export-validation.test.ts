import { describe, expect, it, vi } from 'vitest';
import { buildSampleCube } from './cityjson';
import { prepareValidatedCityJsonExport, validateExportGeometry } from './export-validation';

describe('CityJSON export validation', () => {
  it('validates the exact reopened export bytes in the browser', () => {
    const prepared = prepareValidatedCityJsonExport(buildSampleCube());

    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.report.ok).toBe(true);
  });

  it('posts the exact export bytes to the local val3dity endpoint', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_input)).toBe('http://127.0.0.1:8787/api/hamburg/validate');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe('{"type":"CityJSON"}');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ok: true,
          primitiveValidation: 'val3dity --ignore204',
          schemaValidation: 'structural-only',
          message: 'passed',
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await validateExportGeometry(
      'http://127.0.0.1:8787',
      '{"type":"CityJSON"}',
      fetchImpl
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe('passed');
  });
});
