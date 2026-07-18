import type { CityJsonDocument } from '../types';
import { parseCityJson } from './cityjson';
import { checkIntegrity, type IntegrityReport } from './integrity';

export type PreparedCityJsonExport =
  | { ok: true; text: string; report: IntegrityReport }
  | { ok: false; error: string; report?: IntegrityReport };

export interface ExternalGeometryValidation {
  ok: boolean;
  primitiveValidation: 'val3dity --ignore204';
  schemaValidation: 'cjval' | 'structural-only';
  message: string;
}

/**
 * Serialize and reopen the exact bytes offered for download. Export refuses
 * documents that no longer round-trip or contain browser-detectable CityJSON
 * structure errors.
 */
export function prepareValidatedCityJsonExport(doc: CityJsonDocument): PreparedCityJsonExport {
  let text: string;
  try {
    text = JSON.stringify(doc);
  } catch (error) {
    return {
      ok: false,
      error: `CityJSON serialization failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const reopened = parseCityJson(text);
  if (!reopened.ok) return { ok: false, error: reopened.error };
  const report = checkIntegrity(reopened.doc);
  if (!report.ok) {
    const first = report.issues.find((issue) => issue.severity === 'error');
    return {
      ok: false,
      error: `Exported CityJSON failed structural validation: ${first?.message ?? 'unknown error'}`,
      report,
    };
  }
  return { ok: true, text, report };
}

/**
 * Ask the optional local catalog server to validate the exact monolithic
 * CityJSON export with val3dity. The server may additionally run cjval when
 * it was started with `--cjval`.
 */
export async function validateExportGeometry(
  baseUrl: string,
  text: string,
  fetchImpl: typeof fetch = fetch
): Promise<ExternalGeometryValidation> {
  const url = new URL(baseUrl.trim());
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.pathname = url.pathname.replace(/\/api\/hamburg\/(?:catalog|tiles)\/?$/, '/');
  url.search = '';
  url.hash = '';
  const endpoint = new URL('api/hamburg/validate', url);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/city+json; charset=utf-8' },
    body: text,
  });
  let payload: Partial<ExternalGeometryValidation> = {};
  try {
    payload = (await response.json()) as Partial<ExternalGeometryValidation>;
  } catch {
    // Preserve the HTTP error below when a non-JSON proxy response arrives.
  }
  if (!response.ok && typeof payload.ok !== 'boolean') {
    throw new Error(`3D validation service failed: HTTP ${response.status} ${response.statusText}`);
  }
  return {
    ok: payload.ok === true,
    primitiveValidation: 'val3dity --ignore204',
    schemaValidation: payload.schemaValidation === 'cjval' ? 'cjval' : 'structural-only',
    message:
      typeof payload.message === 'string'
        ? payload.message
        : payload.ok
        ? 'val3dity accepted the exported CityJSON'
        : 'val3dity rejected the exported CityJSON',
  };
}
