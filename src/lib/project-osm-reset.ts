import type { CityJsonDocument } from '../types';
import type { Wgs84Bbox } from './road-query';
import { buildOverpassRoadQuery } from './transportation';
import { processOsmXml } from './osm2streets';
import { convertLanePolygonsToCityJson, readRoadMetadata, readRoadMapEdgeEndpoints } from './osm2streets-network-converter.js';

export async function prepareFreshOsmRoads(bbox: Wgs84Bbox, signal: AbortSignal) {
  const endpoint = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: buildOverpassRoadQuery(bbox, 'xml', 45) }), signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) });
  if (!response.ok) throw new Error(`OSM download failed (${response.status}). No project data was changed; try again later.`);
  const xml = await response.text();
  signal.throwIfAborted();
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.documentElement.tagName !== 'osm' || parsed.querySelector('parsererror, remark')) throw new Error('OSM returned an invalid or incomplete extract. The project was not changed; prepare the reset again later.');
  const result = await processOsmXml(xml, bbox, { echoDiagnostics: false, includeNetwork: true });
  signal.throwIfAborted();
  const metadata = readRoadMetadata(result.network);
  const converted = convertLanePolygonsToCityJson(result.lanes, { sourceNetwork: result.network, generatedAt: new Date().toISOString(), sourceLabel: endpoint,
    idPrefix: 'project-reset-', roadMetadataById: metadata, roadMapEdgeEndpointsById: readRoadMapEdgeEndpoints(result.network, metadata) });
  return { document: converted.doc as unknown as CityJsonDocument, source: endpoint, summary: converted.summary, diagnostics: result.diagnostics };
}
