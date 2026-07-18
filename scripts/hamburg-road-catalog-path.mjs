import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const HAMBURG_ROAD_CATALOG_TYPE = 'HamburgOsm2StreetsRoadCityJSONSeqCatalog';

export function readReadyHamburgRoadCatalog(directory) {
  const resolvedDirectory = resolve(directory);
  const catalogPath = resolve(resolvedDirectory, 'catalog.json');
  if (!existsSync(catalogPath)) return null;

  try {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    if (
      catalog.type !== HAMBURG_ROAD_CATALOG_TYPE ||
      !catalog.summary ||
      catalog.summary.failed !== 0 ||
      !(catalog.summary.tiles > 0) ||
      !(catalog.summary.features > 0)
    ) {
      return null;
    }

    const completeTiles =
      Array.isArray(catalog.tiles) &&
      catalog.tiles.length === catalog.summary.tiles &&
      catalog.tiles.every((tile) => {
        if (typeof tile?.file !== 'string' || tile.file.length === 0) return false;
        const tilePath = resolve(resolvedDirectory, tile.file);
        return existsSync(tilePath) && statSync(tilePath).size > 0;
      });
    if (!completeTiles) return null;

    return {
      directory: resolvedDirectory,
      catalogPath,
      catalog,
      modifiedAtMs: statSync(catalogPath).mtimeMs,
    };
  } catch {
    return null;
  }
}

export function findReadyHamburgRoadCatalog(preferredDirectory, options = {}) {
  const preferred = resolve(preferredDirectory);
  const direct = readReadyHamburgRoadCatalog(preferred);
  if (direct || options.scanSiblings === false) return direct;

  const parent = dirname(preferred);
  if (!existsSync(parent)) return null;

  return readdirSync(parent, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith('cityjsonseq') &&
        resolve(parent, entry.name) !== preferred
    )
    .map((entry) => readReadyHamburgRoadCatalog(resolve(parent, entry.name)))
    .filter(Boolean)
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)[0] ?? null;
}
