import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const OFFICIAL_DATASET_API =
  'https://suche.transparenz.hamburg.de/api/3/action/package_show?id=3d-gebaeudemodell-lod2-de-hamburg2';
const OFFICIAL_DATASET_PAGE =
  'https://suche.transparenz.hamburg.de/dataset/3d-gebaeudemodell-lod2-de-hamburg2';
const DEFAULT_DATA_DIR = path.join(repoRoot, 'Data', 'hamburg-lod2');

const { command, options } = parseArgs(process.argv.slice(2));

try {
  switch (command) {
    case 'latest':
      await printLatest();
      break;
    case 'download':
      await downloadLatest();
      break;
    case 'extract':
      await extractArchive();
      break;
    case 'convert':
      await convertTiles();
      break;
    case 'validate':
      await validateTiles();
      break;
    case 'geometry-audit':
      await auditGeometry();
      break;
    case 'geometry-clean':
      await cleanGeometry();
      break;
    case 'serve':
      await serveTiles();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      throw new Error(`Unknown command "${command}". Run with "help" for usage.`);
  }
} catch (error) {
  console.error(`Hamburg LoD2 pipeline failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}

async function printLatest() {
  const resource = await getLatestOfficialResource();
  console.log(JSON.stringify(resource, null, 2));
}

async function downloadLatest() {
  const resource = await getLatestOfficialResource();
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const downloadsDir = path.join(dataDir, 'downloads');
  const destination = path.join(downloadsDir, fileNameFromUrl(resource.url));
  await mkdir(downloadsDir, { recursive: true });

  if (!options.force && (await fileHasSize(destination, resource.bytes))) {
    console.log(`Already downloaded: ${destination}`);
    await writeReleaseMetadata(dataDir, resource);
    return;
  }

  console.log(`Downloading official Hamburg LoD2 ${resource.year} CityGML archive`);
  console.log(resource.url);
  const response = await fetch(resource.url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const temporary = `${destination}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  const downloaded = await stat(temporary);
  if (resource.bytes && downloaded.size !== resource.bytes) {
    throw new Error(`Downloaded ${downloaded.size} bytes, expected ${resource.bytes}`);
  }
  await rename(temporary, destination);
  await writeReleaseMetadata(dataDir, resource);
  console.log(`Saved ${formatBytes(downloaded.size)} to ${destination}`);
}

async function extractArchive() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const sourceDir = resolveOptionPath('source-dir', path.join(dataDir, 'source'));
  const archive = options.archive
    ? path.resolve(String(options.archive))
    : await findDownloadedArchive(dataDir);
  await mkdir(sourceDir, { recursive: true });

  console.log(`Extracting ${archive}`);
  console.log(`Into ${sourceDir}`);
  runCommand('tar', ['-xf', archive, '-C', sourceDir]);
  const sourceFiles = await findFiles(sourceDir, new Set(['.xml', '.gml']));
  if (sourceFiles.length === 0) {
    throw new Error(`No CityGML .xml/.gml tiles found after extraction in ${sourceDir}`);
  }
  console.log(`Found ${sourceFiles.length} CityGML tiles`);
}

async function convertTiles() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const sourceDir = resolveOptionPath('source-dir', path.join(dataDir, 'source'));
  const outputDir = resolveOptionPath('output-dir', path.join(dataDir, 'cityjsonseq'));
  const converter = resolveConverter();
  const sourceFiles = selectFiles(
    await findFiles(sourceDir, new Set(['.xml', '.gml'])),
    String(options.match ?? ''),
    numberOption('limit')
  );
  if (sourceFiles.length === 0) {
    throw new Error(`No CityGML tiles selected in ${sourceDir}`);
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(path.join(outputDir, 'logs'), { recursive: true });
  console.log(`Converting ${sourceFiles.length} Hamburg LoD2 tiles with ${converter}`);

  const stats = [];
  for (let index = 0; index < sourceFiles.length; index++) {
    const sourceFile = sourceFiles[index];
    const relative = path.relative(sourceDir, sourceFile);
    const outputRelative = replaceExtension(relative, '.city.jsonl');
    const outputFile = path.join(outputDir, outputRelative);
    await mkdir(path.dirname(outputFile), { recursive: true });
    console.log(`[${index + 1}/${sourceFiles.length}] ${relative}`);

    if (!options.force && (await exists(outputFile))) {
      stats.push(await validateCityJsonSeq(outputFile));
      console.log(`  valid existing output: ${outputRelative}`);
      continue;
    }

    const workDir = path.join(outputDir, '.work', `${process.pid}-${index}`);
    const workInput = path.join(workDir, path.basename(sourceFile));
    const generated = path.join(workDir, replaceExtension(path.basename(sourceFile), '.jsonl'));
    await mkdir(workDir, { recursive: true });
    await copyFile(sourceFile, workInput);

    const logFile = path.join(outputDir, 'logs', replaceExtension(outputRelative, '.log'));
    await mkdir(path.dirname(logFile), { recursive: true });
    try {
      const result = runCommand(
        converter,
        ['to-cityjson', '-l', '-c', '-e', '25832', '-L', 'warn', workInput],
        { capture: true }
      );
      await writeFile(logFile, `${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8');
      if (!(await exists(generated))) {
        throw new Error(`Converter did not create ${generated}`);
      }
      const tileStats = await normalizeAndValidateCityJsonSeq(generated, outputFile);
      await runCjvalIfRequested(outputFile, logFile);
      stats.push(tileStats);
      console.log(
        `  wrote ${outputRelative}: ${tileStats.features} features, ${tileStats.cityObjects} objects`
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  await writeCatalog(outputDir, stats, dataDir);
}

async function validateTiles() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const outputDir = resolveOptionPath('output-dir', path.join(dataDir, 'cityjsonseq'));
  const input = options.input ? path.resolve(String(options.input)) : null;
  const files = input
    ? [input]
    : selectFiles(
        await findFiles(outputDir, new Set(['.jsonl'])),
        String(options.match ?? ''),
        numberOption('limit')
      ).filter((file) => !file.includes(`${path.sep}.work${path.sep}`));
  if (files.length === 0) {
    throw new Error(`No CityJSONSeq tiles selected in ${outputDir}`);
  }

  const stats = [];
  for (let index = 0; index < files.length; index++) {
    const tileStats = await validateCityJsonSeq(files[index]);
    await runCjvalIfRequested(files[index]);
    stats.push(tileStats);
    console.log(
      `[${index + 1}/${files.length}] valid ${path.basename(files[index])}: ` +
        `${tileStats.features} features, ${tileStats.cityObjects} objects, ` +
        `${tileStats.vertices} vertices`
    );
  }
  if (!input) await writeCatalog(outputDir, stats, dataDir);
}

async function auditGeometry() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const outputDir = resolveOptionPath('output-dir', path.join(dataDir, 'cityjsonseq'));
  const reportDir = resolveOptionPath('report-dir', path.join(dataDir, 'geometry-audit'));
  const validator = resolveVal3dity();
  const input = options.input ? path.resolve(String(options.input)) : null;
  const files = input
    ? [input]
    : selectFiles(
        await findFiles(outputDir, new Set(['.jsonl'])),
        String(options.match ?? ''),
        numberOption('limit')
      ).filter(
        (file) =>
          file.toLowerCase().endsWith('.city.jsonl') &&
          !file.includes(`${path.sep}.work${path.sep}`)
      );
  if (files.length === 0) {
    throw new Error(`No CityJSONSeq tiles selected in ${outputDir}`);
  }

  await mkdir(reportDir, { recursive: true });
  console.log(`Auditing ${files.length} CityJSONSeq tiles with ${validator}`);
  const tiles = [];
  for (let index = 0; index < files.length; index++) {
    const tile = auditGeometryTile(validator, files[index]);
    tiles.push(tile);
    const reportFile = path.join(reportDir, `${tile.id}.geometry.json`);
    await writeFile(reportFile, `${JSON.stringify(tile, null, 2)}\n`, 'utf8');
    console.log(
      `[${index + 1}/${files.length}] ${tile.id}: ${tile.features} features, ` +
        `${tile.invalidFeatures} invalid, ${tile.crashedFeatures} validator crashes` +
        (tile.fallback ? ' (isolated fallback)' : '')
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    validator,
    tiles: tiles.length,
    features: sum(tiles, 'features'),
    invalidFeatures: sum(tiles, 'invalidFeatures'),
    invalidObjects: sum(tiles, 'invalidObjects'),
    crashedFeatures: sum(tiles, 'crashedFeatures'),
    fallbackTiles: tiles.filter((tile) => tile.fallback).length,
    incompleteTiles: tiles.filter((tile) => tile.incomplete).length,
    codeCounts: mergeCounts(tiles.map((tile) => tile.codeCounts)),
    tileReports: tiles.map((tile) => `${tile.id}.geometry.json`),
  };
  const summaryFile = path.join(reportDir, 'geometry-audit.json');
  await writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Geometry audit: ${summaryFile}`);
  console.log(JSON.stringify(summary, null, 2));

  if (!options['allow-invalid'] && (summary.invalidFeatures > 0 || summary.crashedFeatures > 0)) {
    throw new Error(
      `geometry audit found ${summary.invalidFeatures} invalid features and ` +
        `${summary.crashedFeatures} validator crashes; see ${summaryFile}`
    );
  }
}

async function cleanGeometry() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const inputDir = resolveOptionPath('output-dir', path.join(dataDir, 'cityjsonseq'));
  const reportDir = resolveOptionPath('report-dir', path.join(dataDir, 'geometry-audit'));
  const cleanDir = resolveOptionPath('clean-dir', path.join(dataDir, 'cityjsonseq-clean'));
  const quarantineDir = resolveOptionPath('quarantine-dir', path.join(dataDir, 'quarantine'));
  const auditSummary = JSON.parse(await readFile(path.join(reportDir, 'geometry-audit.json'), 'utf8'));
  if (auditSummary.incompleteTiles !== 0) {
    throw new Error(
      `${reportDir} contains an incomplete geometry survey. Run geometry-audit without --skip-fallback.`
    );
  }

  const files = selectFiles(
    (await findFiles(inputDir, new Set(['.jsonl']))).filter((file) =>
      file.toLowerCase().endsWith('.city.jsonl')
    ),
    String(options.match ?? ''),
    numberOption('limit')
  );
  if (files.length === 0) throw new Error(`No CityJSONSeq tiles selected in ${inputDir}`);

  await mkdir(cleanDir, { recursive: true });
  await mkdir(quarantineDir, { recursive: true });
  const stats = [];
  let quarantinedFeatures = 0;
  let acceptedFeatures = 0;
  let quarantineFiles = 0;
  const omittedEmptyTiles = [];
  console.log(`Building geometry-clean CityJSONSeq tiles from ${files.length} audited source tiles`);
  for (const [index, file] of files.entries()) {
    const id = tileId(file);
    const report = JSON.parse(
      await readFile(path.join(reportDir, `${id}.geometry.json`), 'utf8')
    );
    if (report.incomplete) throw new Error(`${id}: geometry audit report is incomplete`);
    const rejectedIds = new Set([
      ...report.issues.map((issue) => issue.featureId),
      ...report.crashes.map((crash) => crash.featureId),
    ]);
    if (rejectedIds.has(null)) throw new Error(`${id}: geometry audit has an unidentified crash`);

    const lines = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim());
    const header = lines[0];
    const accepted = [];
    const quarantined = [];
    for (const [lineIndex, line] of lines.slice(1).entries()) {
      const feature = parseJsonLine(file, lineIndex + 2, line);
      (rejectedIds.has(feature.id) ? quarantined : accepted).push(line);
    }
    if (accepted.length + quarantined.length !== report.features) {
      throw new Error(`${id}: report and source feature counts disagree`);
    }
    const relative = path.relative(inputDir, file);
    const target = path.join(cleanDir, relative);
    const quarantineFile = path.join(quarantineDir, relative);
    if (quarantined.length > 0) {
      await mkdir(path.dirname(quarantineFile), { recursive: true });
      await writeFile(quarantineFile, `${header}\n${quarantined.join('\n')}\n`, 'utf8');
      quarantineFiles++;
    } else {
      await rm(quarantineFile, { force: true });
    }
    acceptedFeatures += accepted.length;
    quarantinedFeatures += quarantined.length;
    if (accepted.length === 0) {
      await rm(target, { force: true });
      omittedEmptyTiles.push(id);
      console.log(
        `[${index + 1}/${files.length}] ${id}: 0 accepted, ` +
          `${quarantined.length} quarantined (empty clean tile omitted)`
      );
      continue;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${header}\n${accepted.join('\n')}\n`, 'utf8');
    stats.push(await validateCityJsonSeq(target));
    console.log(
      `[${index + 1}/${files.length}] ${id}: ${accepted.length} accepted, ` +
        `${quarantined.length} quarantined`
    );
  }

  await writeCatalog(cleanDir, stats, dataDir);
  const summary = {
    generatedAt: new Date().toISOString(),
    source: inputDir,
    audit: path.join(reportDir, 'geometry-audit.json'),
    tiles: stats.length,
    acceptedFeatures,
    quarantinedFeatures,
    quarantineFiles,
    omittedEmptyTiles,
    cleanDir,
    quarantineDir,
  };
  const summaryFile = path.join(cleanDir, 'geometry-clean.json');
  await writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Geometry-clean build: ${summaryFile}`);
  console.log(JSON.stringify(summary, null, 2));
}

function auditGeometryTile(validator, file, profile = {}) {
  const lines = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error(`${file}: expected a CityJSONSeq header and features`);
  const header = lines[0];
  const featureLines = lines.slice(1);
  const objectToFeature = mapObjectsToFeatures(file, featureLines);
  const result = runVal3dity(validator, `${lines.join('\n')}\n`, profile);
  const parsed = parseVal3dityOutput(result.stdout);
  const records = parsed.records.map((record) => ({
    ...record,
    featureId: objectToFeature.get(record.objectId) ?? record.objectId,
  }));

  if (!val3dityCompleted(result, parsed)) {
    if (options['skip-fallback']) {
      return geometryTileReport(
        file,
        featureLines.length,
        records,
        [
          {
            featureId: null,
            line: null,
            status: formatStatus(result.status),
            error: result.error?.message ?? null,
            malformedOutputLines: parsed.malformed,
            scope: 'tile',
          },
        ],
        false,
        true
      );
    }
    return auditGeometryTileByFeature(validator, file, header, featureLines, profile);
  }

  return geometryTileReport(file, featureLines.length, records, [], false);
}

function auditGeometryTileByFeature(validator, file, header, featureLines, profile = {}) {
  const records = [];
  const crashes = [];
  const entries = featureLines.map((line, index) => ({ line, lineNumber: index + 2 }));

  function auditEntries(current) {
    const result = runVal3dity(
      validator,
      `${header}\n${current.map((entry) => entry.line).join('\n')}\n`,
      profile
    );
    const parsed = parseVal3dityOutput(result.stdout);
    if (val3dityCompleted(result, parsed)) {
      const objectToFeature = mapObjectsToFeatures(
        file,
        current.map((entry) => entry.line)
      );
      for (const record of parsed.records) {
        records.push({
          ...record,
          featureId: objectToFeature.get(record.objectId) ?? record.objectId,
        });
      }
      return;
    }
    if (current.length === 1) {
      const entry = current[0];
      const feature = parseJsonLine(file, entry.lineNumber, entry.line);
      crashes.push({
        featureId: feature.id,
        line: entry.lineNumber,
        status: formatStatus(result.status),
        error: result.error?.message ?? null,
        malformedOutputLines: parsed.malformed,
      });
      return;
    }
    const midpoint = Math.ceil(current.length / 2);
    auditEntries(current.slice(0, midpoint));
    auditEntries(current.slice(midpoint));
  }

  auditEntries(entries);
  return geometryTileReport(file, featureLines.length, records, crashes, true);
}

function geometryTileReport(file, features, records, crashes, fallback, incomplete = false) {
  const issues = records
    .filter((record) => record.codes.length > 0)
    .map((record) => ({
      featureId: record.featureId ?? record.objectId,
      objectId: record.objectId,
      codes: record.codes,
    }));
  return {
    id: tileId(file),
    file: path.basename(file),
    features,
    invalidFeatures: new Set(issues.map((issue) => issue.featureId)).size,
    invalidObjects: issues.length,
    crashedFeatures: crashes.length,
    fallback,
    incomplete,
    codeCounts: countCodes(issues),
    issues,
    crashes,
  };
}

function runVal3dity(validator, input, profile = {}) {
  return spawnSync(validator, ['stdin', ...(profile.ignore204 ? ['--ignore204'] : [])], {
    input,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  });
}

function val3dityCompleted(result, parsed) {
  return !result.error && result.status === 0 && parsed.malformed.length === 0;
}

function parseVal3dityOutput(output = '') {
  const records = [];
  const malformed = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^("(?:[^"\\]|\\.)*")\s+(\[.*\])$/);
    if (!match) {
      malformed.push(line);
      continue;
    }
    const objectId = JSON.parse(match[1]);
    const codes = JSON.parse(match[2]).map(String);
    if (objectId !== '1st-line') records.push({ objectId, codes });
  }
  return { records, malformed };
}

function mapObjectsToFeatures(file, featureLines) {
  const map = new Map();
  for (const [index, line] of featureLines.entries()) {
    const feature = parseJsonLine(file, index + 2, line);
    for (const id of Object.keys(feature.CityObjects ?? {})) map.set(id, feature.id);
  }
  return map;
}

async function serveTiles() {
  const dataDir = resolveOptionPath('data-dir', DEFAULT_DATA_DIR);
  const outputDir = resolveOptionPath('output-dir', path.join(dataDir, 'cityjsonseq'));
  const catalogPath = path.join(outputDir, 'catalog.json');
  const port = numberOption('port') ?? 8787;
  const host = String(options.host ?? '127.0.0.1');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const datasetLabel =
    catalog.type === 'HamburgOsm2StreetsRoadCityJSONSeqCatalog'
      ? 'Hamburg osm2streets Road CityJSONSeq tiles'
      : 'Hamburg LoD2 CityJSONSeq tiles';
  const writebackValidator = options['skip-writeback-geometry-validation']
    ? null
    : resolveVal3dity();
  const writebackSchemaValidator = options.cjval ? String(options.cjval) : null;
  await hydrateCatalogRevisions(outputDir, catalog);
  let writebackQueue = Promise.resolve();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match');
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
      response.setHeader('Cache-Control', 'no-cache');
      if (request.method === 'OPTIONS') {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (url.pathname === '/' || url.pathname === '/health') {
        sendJson(response, {
          ok: true,
          dataset: datasetLabel,
          catalog: '/api/hamburg/catalog',
          query: '/api/hamburg/tiles?bbox=minX,minY,maxX,maxY',
          writeback: 'PUT or DELETE /api/hamburg/tiles/:id',
          exportValidation: 'POST /api/hamburg/validate',
          schemaValidation: writebackSchemaValidator ? 'cjval' : 'structural-only',
          primitiveValidation: writebackValidator ? 'val3dity --ignore204' : 'disabled',
        });
        return;
      }
      if (url.pathname === '/api/hamburg/catalog') {
        sendJson(response, catalog);
        return;
      }
      if (url.pathname === '/api/hamburg/tiles') {
        const bbox = parseBbox(url.searchParams.get('bbox'));
        const tiles = bbox
          ? catalog.tiles.filter((tile) => intersects(tile.extent, bbox))
          : catalog.tiles;
        sendJson(response, { crs: catalog.crs, count: tiles.length, tiles });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/hamburg/validate') {
        await validateExportRequest({
          request,
          response,
          outputDir,
          validator: writebackValidator,
          schemaValidator: writebackSchemaValidator,
        });
        return;
      }
      if (
        (request.method === 'PUT' || request.method === 'DELETE') &&
        url.pathname.startsWith('/api/hamburg/tiles/')
      ) {
        const id = decodeURIComponent(url.pathname.slice('/api/hamburg/tiles/'.length));
        const operation = writebackQueue.then(() =>
          request.method === 'DELETE'
            ? deleteTile({ request, response, outputDir, catalogPath, catalog, id })
            : writeBackTile({
                request,
                response,
                outputDir,
                catalogPath,
                catalog,
                id,
                validator: writebackValidator,
                schemaValidator: writebackSchemaValidator,
              })
        );
        writebackQueue = operation.catch(() => {});
        await operation;
        return;
      }
      if (url.pathname.startsWith('/tiles/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          throw httpError(405, 'Tile delivery only supports GET and HEAD');
        }
        const relative = decodeURIComponent(url.pathname.slice('/tiles/'.length));
        const tilePath = path.resolve(outputDir, relative);
        if (!isInside(outputDir, tilePath) || !tilePath.endsWith('.jsonl')) {
          response.statusCode = 400;
          response.end('Invalid tile path');
          return;
        }
        await access(tilePath);
        response.setHeader('Content-Type', 'application/city+json-seq; charset=utf-8');
        if (request.method === 'HEAD') {
          response.statusCode = 200;
          response.end();
        } else {
          createReadStream(tilePath).pipe(response);
        }
        return;
      }
      response.statusCode = 404;
      response.end('Not found');
    } catch (error) {
      response.statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  server.listen(port, host, () => {
    console.log(`${datasetLabel} server listening on http://${host}:${port}`);
    console.log(`Catalog: http://${host}:${port}/api/hamburg/catalog`);
    console.log(
      `Write-back: enabled with structural${writebackSchemaValidator ? ' + cjval' : ''}${
        writebackValidator ? ' + val3dity' : ''
      } validation`
    );
  });
}

async function writeBackTile({
  request,
  response,
  outputDir,
  catalogPath,
  catalog,
  id,
  validator,
  schemaValidator,
}) {
  const tile = catalog.tiles.find((candidate) => candidate.id === id);
  if (!tile) throw httpError(404, `Unknown Hamburg tile "${id}"`);
  const expected = parseIfMatch(request.headers['if-match']);
  if (!expected) throw httpError(428, `Tile "${id}" write-back requires an If-Match revision`);
  if (expected !== tile.revision) {
    throw httpError(409, `Tile "${id}" changed since it was loaded; reload before saving`);
  }

  const tilePath = path.resolve(outputDir, tile.file);
  if (!isInside(outputDir, tilePath) || !tilePath.endsWith('.jsonl')) {
    throw httpError(400, 'Invalid catalog tile path');
  }
  const temporary = `${tilePath}.${process.pid}.${Date.now()}.partial`;
  try {
    await writeRequestBody(request, temporary);
    let stats;
    try {
      stats = await validateCityJsonSeq(temporary);
    } catch (error) {
      throw httpError(
        422,
        `Tile "${id}" failed structural validation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    if (schemaValidator) {
      const schema = runCjvalStream(schemaValidator, temporary);
      if (!schema.ok) {
        throw httpError(422, `Tile "${id}" failed cjval validation: ${schema.message}`);
      }
    }
    if (validator) {
      const report = auditGeometryTile(validator, temporary, { ignore204: true });
      if (report.invalidFeatures > 0 || report.crashedFeatures > 0 || report.incomplete) {
        throw httpError(
          422,
          `Tile "${id}" failed primitive validation: ${report.invalidFeatures} invalid feature(s), ` +
            `${report.crashedFeatures} validator crash(es)`
        );
      }
    }

    const backupDir = path.join(outputDir, '.history', id);
    await mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `${backupName()}.city.jsonl`);
    await copyFile(tilePath, backup);
    await rename(temporary, tilePath);
    const next = {
      ...tile,
      extent: stats.extent,
      features: stats.features,
      cityObjects: stats.cityObjects,
      vertices: stats.vertices,
      syntheticRootsAdded: stats.syntheticRootsAdded,
      revision: await fileRevision(tilePath),
    };
    const index = catalog.tiles.indexOf(tile);
    catalog.tiles[index] = next;
    updateCatalogSummary(catalog);
    try {
      await writeJsonAtomic(catalogPath, catalog);
    } catch (error) {
      await copyFile(backup, tilePath);
      catalog.tiles[index] = tile;
      updateCatalogSummary(catalog);
      throw error;
    }
    sendJson(response, {
      ok: true,
      tile: next,
      backup: slash(path.relative(outputDir, backup)),
    });
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function validateExportRequest({
  request,
  response,
  outputDir,
  validator,
  schemaValidator,
}) {
  if (!validator) {
    throw httpError(503, 'Export 3D validation requires val3dity on the local server');
  }
  const validationDir = path.join(outputDir, '.validation');
  await mkdir(validationDir, { recursive: true });
  const temporary = path.join(validationDir, `${process.pid}-${Date.now()}.city.json`);
  try {
    await writeRequestBody(request, temporary, 'CityJSON validation');
    try {
      await validateMonolithicCityJson(temporary);
    } catch (error) {
      throw httpError(
        422,
        `Export failed structural validation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (schemaValidator) {
      const schema = runCjvalFile(schemaValidator, temporary);
      if (!schema.ok) {
        sendValidation(response, 422, {
          ok: false,
          schemaValidation: 'cjval',
          primitiveValidation: 'val3dity --ignore204',
          message: `cjval rejected the exported CityJSON: ${schema.message}`,
        });
        return;
      }
    }
    const geometry = runVal3dityFile(validator, temporary);
    sendValidation(response, geometry.ok ? 200 : 422, {
      ok: geometry.ok,
      schemaValidation: schemaValidator ? 'cjval' : 'structural-only',
      primitiveValidation: 'val3dity --ignore204',
      message: geometry.ok
        ? `Exported CityJSON passed ${schemaValidator ? 'cjval and ' : ''}val3dity --ignore204`
        : `val3dity --ignore204 rejected the exported CityJSON: ${geometry.message}`,
    });
  } finally {
    await rm(temporary, { force: true });
  }
}

async function deleteTile({ request, response, outputDir, catalogPath, catalog, id }) {
  const tile = catalog.tiles.find((candidate) => candidate.id === id);
  if (!tile) throw httpError(404, `Unknown Hamburg tile "${id}"`);
  const expected = parseIfMatch(request.headers['if-match']);
  if (!expected) throw httpError(428, `Tile "${id}" deletion requires an If-Match revision`);
  if (expected !== tile.revision) {
    throw httpError(409, `Tile "${id}" changed since it was loaded; reload before saving`);
  }
  const tilePath = path.resolve(outputDir, tile.file);
  if (!isInside(outputDir, tilePath) || !tilePath.endsWith('.jsonl')) {
    throw httpError(400, 'Invalid catalog tile path');
  }
  const backupDir = path.join(outputDir, '.history', id);
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `${backupName()}.city.jsonl`);
  await copyFile(tilePath, backup);
  await rm(tilePath);
  const index = catalog.tiles.indexOf(tile);
  catalog.tiles.splice(index, 1);
  updateCatalogSummary(catalog);
  try {
    await writeJsonAtomic(catalogPath, catalog);
  } catch (error) {
    await copyFile(backup, tilePath);
    catalog.tiles.splice(index, 0, tile);
    updateCatalogSummary(catalog);
    throw error;
  }
  sendJson(response, {
    ok: true,
    deleted: true,
    id,
    backup: slash(path.relative(outputDir, backup)),
  });
}

async function hydrateCatalogRevisions(outputDir, catalog) {
  for (const tile of catalog.tiles) {
    const tilePath = path.resolve(outputDir, tile.file);
    if (!isInside(outputDir, tilePath) || !tilePath.endsWith('.jsonl')) {
      throw new Error(`Catalog contains invalid tile path "${tile.file}"`);
    }
    tile.revision = await fileRevision(tilePath);
  }
}

async function fileRevision(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function writeRequestBody(request, file, label = 'CityJSONSeq tile write-back') {
  const chunks = [];
  let bytes = 0;
  const maxBytes = 64 * 1024 * 1024;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw httpError(413, `${label} exceeds the 64 MB request limit`);
    chunks.push(buffer);
  }
  if (bytes === 0) throw httpError(400, `${label} body is empty`);
  await writeFile(file, Buffer.concat(chunks));
}

async function validateMonolithicCityJson(file) {
  let doc;
  try {
    doc = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isObject(doc) || doc.type !== 'CityJSON') {
    throw new Error('root must be a CityJSON object');
  }
  if (typeof doc.version !== 'string') throw new Error('root requires a string version');
  if (!isObject(doc.CityObjects) || !Array.isArray(doc.vertices)) {
    throw new Error('root requires CityObjects and vertices');
  }
  if (doc.transform !== undefined && !isTransform(doc.transform)) {
    throw new Error('transform must contain finite non-zero scale and finite translate triples');
  }
  for (const [index, vertex] of doc.vertices.entries()) {
    if (!isFiniteTriple(vertex)) throw new Error(`vertices[${index}] is not a finite triple`);
  }
  const ids = new Set(Object.keys(doc.CityObjects));
  for (const [id, object] of Object.entries(doc.CityObjects)) {
    if (!isObject(object) || typeof object.type !== 'string') {
      throw new Error(`CityObject "${id}" has no type`);
    }
    for (const parentId of object.parents ?? []) {
      if (!ids.has(parentId)) throw new Error(`CityObject "${id}" has missing parent "${parentId}"`);
      if (!(doc.CityObjects[parentId].children ?? []).includes(id)) {
        throw new Error(`parent "${parentId}" omits child "${id}"`);
      }
    }
    for (const childId of object.children ?? []) {
      if (!ids.has(childId)) throw new Error(`CityObject "${id}" has missing child "${childId}"`);
      if (!(doc.CityObjects[childId].parents ?? []).includes(id)) {
        throw new Error(`child "${childId}" omits parent "${id}"`);
      }
    }
    for (const geometry of object.geometry ?? []) {
      visitNumbers(geometry.boundaries, (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= doc.vertices.length) {
          throw new Error(
            `CityObject "${id}" references vertex ${index}, outside [0, ${doc.vertices.length})`
          );
        }
      });
      validateSemanticValues(file, 1, id, geometry.semantics);
    }
  }
}

function runCjvalFile(validator, file) {
  return processResult(
    spawnSync(validator, [], {
      encoding: 'utf8',
      input: readFileSync(file),
      maxBuffer: 100 * 1024 * 1024,
    })
  );
}

function runCjvalStream(validator, file) {
  return processResult(
    spawnSync(validator, [], {
      encoding: 'utf8',
      input: readFileSync(file),
      maxBuffer: 100 * 1024 * 1024,
    })
  );
}

function runVal3dityFile(validator, file) {
  return processResult(
    spawnSync(validator, [file, '--ignore204'], {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
    })
  );
}

function processResult(result) {
  const ok = !result.error && result.status === 0;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  const summary = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(' | ');
  return {
    ok,
    message: result.error?.message ?? summary ?? `validator exited with ${formatStatus(result.status)}`,
  };
}

function sendValidation(response, statusCode, value) {
  response.statusCode = statusCode;
  sendJson(response, value);
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.partial`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function updateCatalogSummary(catalog) {
  catalog.generatedAt = new Date().toISOString();
  catalog.summary = {
    ...catalog.summary,
    tiles: catalog.tiles.length,
    features: sum(catalog.tiles, 'features'),
    cityObjects: sum(catalog.tiles, 'cityObjects'),
    vertices: sum(catalog.tiles, 'vertices'),
    syntheticRootsAdded: sum(catalog.tiles, 'syntheticRootsAdded'),
    extent: mergeExtents(catalog.tiles.map((tile) => tile.extent)),
  };
}

function parseIfMatch(value) {
  if (typeof value !== 'string') return null;
  return value.replace(/^W\//, '').replace(/^"|"$/g, '');
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupName() {
  return `${safeTimestamp()}-${process.hrtime.bigint()}`;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function normalizeAndValidateCityJsonSeq(inputFile, outputFile) {
  const temporary = `${outputFile}.partial`;
  const output = createWriteStream(temporary, { encoding: 'utf8' });
  try {
    const tileStats = await scanCityJsonSeq(inputFile, (value) => {
      output.write(`${JSON.stringify(value)}\n`);
    });
    await new Promise((resolve, reject) => {
      output.end(resolve);
      output.on('error', reject);
    });
    await rename(temporary, outputFile);
    return { ...tileStats, file: slash(path.relative(path.dirname(outputFile), outputFile)) };
  } catch (error) {
    output.destroy();
    await rm(temporary, { force: true });
    throw error;
  }
}

async function validateCityJsonSeq(file) {
  const tileStats = await scanCityJsonSeq(file);
  return { ...tileStats, file: slash(path.basename(file)) };
}

async function runCjvalIfRequested(file, converterLogFile) {
  if (!options.cjval) return;
  const validator = String(options.cjval);
  const result = spawnSync(validator, [], {
    encoding: 'utf8',
    input: readFileSync(file),
    maxBuffer: 100 * 1024 * 1024,
  });
  const logFile = converterLogFile
    ? replaceExtension(converterLogFile, '.cjval.log')
    : `${file}.cjval.log`;
  await writeFile(logFile, `${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8');
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`cjval rejected ${file}; see ${logFile}`);
  }
  console.log(`  cjval schema validation passed: ${path.basename(file)}`);
}

async function scanCityJsonSeq(file, emit) {
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  const stats = {
    sourceFile: path.basename(file),
    features: 0,
    cityObjects: 0,
    vertices: 0,
    syntheticRootsAdded: 0,
    extent: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
  };
  const seenIds = new Set();
  let lineNumber = 0;
  let header;

  for await (const line of lines) {
    lineNumber++;
    if (!line.trim()) continue;
    const value = parseJsonLine(file, lineNumber, line);
    if (!header) {
      validateHeader(file, lineNumber, value);
      header = value;
      emit?.(value);
      continue;
    }

    validateFeatureShape(file, lineNumber, value);
    stats.syntheticRootsAdded += ensureFeatureRoot(value);
    validateFeature(file, lineNumber, value, seenIds, stats, header.transform);
    stats.features++;
    emit?.(value);
  }

  if (!header) throw new Error(`${file}: missing CityJSON header`);
  if (stats.features === 0) throw new Error(`${file}: contains no CityJSONFeature lines`);
  if (!Number.isFinite(stats.extent[0])) {
    throw new Error(`${file}: contains no finite geometry vertices`);
  }
  return stats;
}

function validateHeader(file, lineNumber, value) {
  if (!isObject(value) || value.type !== 'CityJSON') {
    throw new Error(`${file}:${lineNumber}: first line must be a CityJSON header`);
  }
  if (value.version !== '2.0') {
    throw new Error(`${file}:${lineNumber}: expected CityJSON 2.0, got ${String(value.version)}`);
  }
  if (!isObject(value.CityObjects) || !Array.isArray(value.vertices)) {
    throw new Error(`${file}:${lineNumber}: header requires CityObjects and vertices`);
  }
  if (!isTransform(value.transform)) {
    throw new Error(`${file}:${lineNumber}: header requires a finite non-zero transform`);
  }
  if (typeof value.metadata?.referenceSystem !== 'string') {
    throw new Error(`${file}:${lineNumber}: header requires metadata.referenceSystem`);
  }
}

function validateFeatureShape(file, lineNumber, value) {
  if (!isObject(value) || value.type !== 'CityJSONFeature') {
    throw new Error(`${file}:${lineNumber}: expected CityJSONFeature`);
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`${file}:${lineNumber}: feature requires a string id`);
  }
  if (!isObject(value.CityObjects) || !Array.isArray(value.vertices)) {
    throw new Error(`${file}:${lineNumber}: feature requires CityObjects and vertices`);
  }
}

function ensureFeatureRoot(feature) {
  if (feature.CityObjects[feature.id]) return 0;
  const childIds = Object.entries(feature.CityObjects)
    .filter(([, obj]) => Array.isArray(obj?.parents) && obj.parents.includes(feature.id))
    .map(([id]) => id);
  if (childIds.length === 0) {
    throw new Error(`feature "${feature.id}" omits its root CityObject`);
  }
  feature.CityObjects[feature.id] = {
    type: 'Building',
    children: childIds,
    attributes: commonAttributes(childIds.map((id) => feature.CityObjects[id])),
  };
  return 1;
}

function validateFeature(file, lineNumber, feature, seenIds, stats, transform) {
  const ids = new Set(Object.keys(feature.CityObjects));
  if (!ids.has(feature.id)) {
    throw new Error(`${file}:${lineNumber}: root "${feature.id}" is absent after normalization`);
  }
  for (const vertex of feature.vertices) {
    if (!isFiniteTriple(vertex)) {
      throw new Error(`${file}:${lineNumber}: feature "${feature.id}" contains an invalid vertex`);
    }
    includeDecoded(stats.extent, vertex, transform);
  }

  for (const [id, object] of Object.entries(feature.CityObjects)) {
    if (seenIds.has(id)) throw new Error(`${file}:${lineNumber}: duplicate CityObject id "${id}"`);
    seenIds.add(id);
    if (!isObject(object) || typeof object.type !== 'string') {
      throw new Error(`${file}:${lineNumber}: CityObject "${id}" has no type`);
    }
    for (const parentId of object.parents ?? []) {
      if (!ids.has(parentId)) {
        throw new Error(`${file}:${lineNumber}: CityObject "${id}" has missing parent "${parentId}"`);
      }
      if (!(feature.CityObjects[parentId].children ?? []).includes(id)) {
        throw new Error(`${file}:${lineNumber}: parent "${parentId}" omits child "${id}"`);
      }
    }
    for (const childId of object.children ?? []) {
      if (!ids.has(childId)) {
        throw new Error(`${file}:${lineNumber}: CityObject "${id}" has missing child "${childId}"`);
      }
      if (!(feature.CityObjects[childId].parents ?? []).includes(id)) {
        throw new Error(`${file}:${lineNumber}: child "${childId}" omits parent "${id}"`);
      }
    }
    for (const geometry of object.geometry ?? []) {
      visitNumbers(geometry.boundaries, (index) => {
        if (!Number.isInteger(index) || index < 0 || index >= feature.vertices.length) {
          throw new Error(
            `${file}:${lineNumber}: CityObject "${id}" references vertex ${index}, ` +
              `outside [0, ${feature.vertices.length})`
          );
        }
      });
      validateSemanticValues(file, lineNumber, id, geometry.semantics);
    }
  }

  stats.cityObjects += ids.size;
  stats.vertices += feature.vertices.length;
}

function validateSemanticValues(file, lineNumber, id, semantics) {
  if (!semantics) return;
  if (!Array.isArray(semantics.surfaces)) {
    throw new Error(`${file}:${lineNumber}: CityObject "${id}" has invalid semantic surfaces`);
  }
  visitNumbers(semantics.values, (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= semantics.surfaces.length) {
      throw new Error(`${file}:${lineNumber}: CityObject "${id}" has invalid semantic index ${index}`);
    }
  });
}

async function writeCatalog(outputDir, stats, dataDir) {
  const release = await readJsonIfPresent(path.join(dataDir, 'release.json'));
  const tiles = stats
    .map((tile) => ({
      id: tileId(tile.sourceFile),
      file: slash(tile.file),
      url: `/tiles/${slash(tile.file)}`,
      extent: tile.extent,
      features: tile.features,
      cityObjects: tile.cityObjects,
      vertices: tile.vertices,
      syntheticRootsAdded: tile.syntheticRootsAdded,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const catalog = {
    type: 'HamburgLoD2CityJSONSeqCatalog',
    generatedAt: new Date().toISOString(),
    source: {
      dataset: OFFICIAL_DATASET_PAGE,
      release: release ?? null,
    },
    crs: 'EPSG:25832',
    summary: {
      tiles: tiles.length,
      features: sum(tiles, 'features'),
      cityObjects: sum(tiles, 'cityObjects'),
      vertices: sum(tiles, 'vertices'),
      syntheticRootsAdded: sum(tiles, 'syntheticRootsAdded'),
      extent: mergeExtents(tiles.map((tile) => tile.extent)),
    },
    tiles,
  };
  const catalogPath = path.join(outputDir, 'catalog.json');
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Catalog: ${catalogPath}`);
}

async function getLatestOfficialResource() {
  const response = await fetch(OFFICIAL_DATASET_API);
  if (!response.ok) throw new Error(`Official dataset metadata failed: HTTP ${response.status}`);
  const payload = await response.json();
  const resources = payload?.result?.resources;
  if (!Array.isArray(resources)) throw new Error('Official dataset metadata has no resources');
  const candidates = resources
    .map((resource) => ({
      year: releaseYear(resource.name, resource.url),
      name: resource.name,
      url: resource.url,
      bytes: Number(resource.file_size ?? resource.size),
    }))
    .filter(
      (resource) =>
        Number.isInteger(resource.year) &&
        typeof resource.url === 'string' &&
        resource.url.toLowerCase().endsWith('.zip') &&
        Number.isFinite(resource.bytes)
    )
    .sort((a, b) => b.year - a.year);
  if (candidates.length === 0) throw new Error('No CityGML ZIP resources in official dataset metadata');
  return { ...candidates[0], dataset: OFFICIAL_DATASET_PAGE };
}

function resolveConverter() {
  if (options.converter) return path.resolve(String(options.converter));
  const suffix = process.platform === 'win32' ? '.bat' : '';
  const candidates = [
    path.join(repoRoot, 'tools', 'citygml-tools-2.4.0', `citygml-tools${suffix}`),
    path.join(repoRoot, 'tools', 'citygml-tools-2.3.2', `citygml-tools${suffix}`),
    path.join(repoRoot, 'tools', 'citygml-tools-2.3.0', `citygml-tools${suffix}`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return `citygml-tools${suffix}`;
}

function resolveVal3dity() {
  if (options.val3dity) return path.resolve(String(options.val3dity));
  const executable = process.platform === 'win32' ? 'val3dity.exe' : 'val3dity';
  const candidates = [
    path.join(repoRoot, 'tools', 'val3dity-2.6.0', 'bin', executable),
    path.join(repoRoot, 'tools', 'val3dity-2.5.1', 'bin', executable),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return executable;
}

function runCommand(executable, args, { capture = false } = {}) {
  const command =
    process.platform === 'win32' && executable.toLowerCase().endsWith('.bat')
      ? process.env.ComSpec ?? 'cmd.exe'
      : executable;
  const commandArgs =
    command === executable ? args : ['/d', '/q', '/c', executable, ...args];
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) {
      console.error(result.stdout ?? '');
      console.error(result.stderr ?? '');
    }
    throw new Error(`${executable} exited with code ${result.status}`);
  }
  return result;
}

async function findFiles(directory, extensions) {
  const files = [];
  async function visit(current) {
    const entries = await import('node:fs/promises').then(({ readdir }) =>
      readdir(current, { withFileTypes: true })
    );
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
    }
  }
  await visit(directory);
  return files.sort();
}

function selectFiles(files, match, limit) {
  const selected = match ? files.filter((file) => file.includes(match)) : files;
  return limit === undefined ? selected : selected.slice(0, limit);
}

function parseArgs(args) {
  const [command, ...rest] = args;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument "${arg}"`);
    const equals = arg.indexOf('=');
    if (equals >= 0) {
      options[arg.slice(2, equals)] = arg.slice(equals + 1);
    } else if (rest[i + 1] && !rest[i + 1].startsWith('--')) {
      options[arg.slice(2)] = rest[++i];
    } else {
      options[arg.slice(2)] = true;
    }
  }
  return { command, options };
}

function printHelp() {
  console.log(`Hamburg LoD2 whole-city preparation

Usage:
  npm run data:hamburg-lod2 -- latest
  npm run data:hamburg-lod2 -- download [--data-dir PATH] [--force]
  npm run data:hamburg-lod2 -- extract [--archive ZIP] [--source-dir PATH]
  npm run data:hamburg-lod2 -- convert [--source-dir PATH] [--output-dir PATH]
                                  [--match TEXT] [--limit N] [--force]
                                  [--converter PATH] [--cjval PATH]
  npm run data:hamburg-lod2 -- validate [--output-dir PATH] [--input FILE]
                                   [--match TEXT] [--limit N] [--cjval PATH]
  npm run data:hamburg-lod2 -- geometry-audit [--output-dir PATH] [--input FILE]
                                   [--match TEXT] [--limit N] [--val3dity PATH]
                                   [--report-dir PATH] [--allow-invalid]
                                   [--skip-fallback]
  npm run data:hamburg-lod2 -- geometry-clean [--output-dir PATH] [--report-dir PATH]
                                   [--clean-dir PATH] [--quarantine-dir PATH]
                                   [--match TEXT] [--limit N]
  npm run data:hamburg-lod2 -- serve [--output-dir PATH] [--host HOST] [--port N]
                                   [--skip-writeback-geometry-validation]

The converter writes one validated CityJSONSeq tile per official Hamburg
CityGML tile and emits catalog.json. Keep the complete city tiled: loading the
entire multi-gigabyte result into one browser document is intentionally avoided.`);
}

function includeDecoded(extent, vertex, transform) {
  const decoded = vertex.map((value, index) => value * transform.scale[index] + transform.translate[index]);
  for (let i = 0; i < 3; i++) {
    if (decoded[i] < extent[i]) extent[i] = decoded[i];
    if (decoded[i] > extent[i + 3]) extent[i + 3] = decoded[i];
  }
}

function mergeExtents(extents) {
  const merged = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const extent of extents) {
    for (let i = 0; i < 3; i++) {
      if (extent[i] < merged[i]) merged[i] = extent[i];
      if (extent[i + 3] > merged[i + 3]) merged[i + 3] = extent[i + 3];
    }
  }
  return merged.every(Number.isFinite) ? merged : null;
}

function commonAttributes(objects) {
  const attributes = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object.attributes ?? {})) {
      if (!(key in attributes)) attributes[key] = value;
    }
  }
  return attributes;
}

function visitNumbers(node, callback) {
  if (typeof node === 'number') callback(node);
  else if (Array.isArray(node)) for (const item of node) visitNumbers(item, callback);
}

function parseJsonLine(file, lineNumber, line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`${file}:${lineNumber}: invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function parseBbox(value) {
  if (!value) return null;
  const bbox = value.split(',').map(Number);
  if (bbox.length !== 4 || !bbox.every(Number.isFinite)) {
    throw new Error('bbox must be minX,minY,maxX,maxY in EPSG:25832');
  }
  return bbox;
}

function intersects(extent, bbox) {
  return !(extent[3] < bbox[0] || extent[0] > bbox[2] || extent[4] < bbox[1] || extent[1] > bbox[3]);
}

function sendJson(response, value) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isTransform(value) {
  return (
    isObject(value) &&
    isFiniteTriple(value.scale) &&
    value.scale.every((item) => item !== 0) &&
    isFiniteTriple(value.translate)
  );
}

function isFiniteTriple(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveOptionPath(name, fallback) {
  return path.resolve(String(options[name] ?? fallback));
}

function numberOption(name) {
  if (options[name] === undefined) return undefined;
  const value = Number(options[name]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

async function writeReleaseMetadata(dataDir, resource) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, 'release.json'),
    `${JSON.stringify({ ...resource, resolvedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function findDownloadedArchive(dataDir) {
  const resource = await getLatestOfficialResource();
  const archive = path.join(dataDir, 'downloads', fileNameFromUrl(resource.url));
  if (!(await exists(archive))) {
    throw new Error(`Archive is not downloaded yet: ${archive}. Run the download command first.`);
  }
  return archive;
}

function releaseYear(name, url) {
  const match = `${name ?? ''} ${url ?? ''}`.match(/\b(20\d{2})\b/g);
  return match ? Math.max(...match.map(Number)) : NaN;
}

function fileNameFromUrl(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

function replaceExtension(file, replacement) {
  return file.slice(0, file.length - path.extname(file).length) + replacement;
}

function tileId(file) {
  return path.basename(file).replace(/\.city\.jsonl$|\.jsonl$|\.gml$|\.xml$/i, '');
}

function countCodes(issues) {
  const counts = {};
  for (const issue of issues) {
    for (const code of issue.codes) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

function mergeCounts(counts) {
  const merged = {};
  for (const group of counts) {
    for (const [key, value] of Object.entries(group)) merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

function formatStatus(status) {
  if (!Number.isInteger(status)) return status;
  return `${status} (0x${status.toString(16).toUpperCase()})`;
}

function slash(file) {
  return file.split(path.sep).join('/');
}

function sum(values, key) {
  return values.reduce((total, value) => total + value[key], 0);
}

async function fileHasSize(file, size) {
  try {
    return (await stat(file)).size === size;
  } catch {
    return false;
  }
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
