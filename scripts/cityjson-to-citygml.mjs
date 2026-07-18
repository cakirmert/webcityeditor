import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const summary = await main(process.argv.slice(2));
    console.log(typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export async function main(argv) {
  const { input, options } = parseArgs(argv);
  if (options.help || options.h) return usage();
  if (!input) {
    throw new Error(usage());
  }

  const inputFile = path.resolve(input);
  const outputDir = path.resolve(String(options['output-dir'] ?? path.dirname(inputFile)));
  const citygmlVersion = String(options.version ?? '3.0');
  if (!['3.0', '2.0', '1.0'].includes(citygmlVersion)) {
    throw new Error('--version must be one of 3.0, 2.0, or 1.0');
  }

  const doc = readCityJson(inputFile);
  const roads = Object.entries(doc.CityObjects).filter(([, object]) => object?.type === 'Road');
  if (options['require-road'] && roads.length === 0) {
    throw new Error(`${inputFile} does not contain any CityJSON Road objects.`);
  }

  const crsName = String(options['crs-name'] ?? doc.metadata?.referenceSystem ?? '');
  if (!crsName) {
    throw new Error('CityJSON metadata.referenceSystem is missing. Pass --crs-name explicitly.');
  }

  await mkdir(outputDir, { recursive: true });
  const converter = resolveConverter(options.converter);
  const before = new Set(await listGmlFiles(outputDir));
  const converterArgs = [
    'from-cityjson',
    '-v',
    citygmlVersion,
    '--crs-name',
    crsName,
    '-o',
    outputDir,
    '-L',
    'warn',
    inputFile,
  ];
  runCommand(converter, converterArgs);

  const outputFile = await findOutputFile(outputDir, inputFile, before);
  const xml = readFileSync(outputFile, 'utf8');
  const inspection = inspectCityGml(xml);
  if (roads.length > 0) {
    if (inspection.roads === 0) {
      throw new Error('Converted CityGML does not contain tran:Road output.');
    }
    if (inspection.trafficAreas === 0) {
      throw new Error('Converted CityGML Road output has no traffic area surfaces.');
    }
    if (inspection.polygons === 0) {
      throw new Error('Converted CityGML Road output has no polygon geometry.');
    }
  }

  let validation = { ran: false, ok: null };
  if (!options['skip-validate']) {
    runCommand(converter, ['validate', outputFile]);
    validation = { ran: true, ok: true };
  }

  return {
    input: inputFile,
    output: outputFile,
    converter,
    citygmlVersion,
    crsName,
    cityjson: {
      cityObjects: Object.keys(doc.CityObjects).length,
      roads: roads.length,
      vertices: doc.vertices.length,
    },
    citygml: inspection,
    validation,
  };
}

function usage() {
  return 'Usage: node scripts/cityjson-to-citygml.mjs INPUT.city.json [--output-dir DIR] [--version 3.0] [--converter PATH] [--crs-name CRS] [--require-road] [--skip-validate]';
}

function readCityJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || parsed.type !== 'CityJSON') {
    throw new Error(`${file}: expected a CityJSON document.`);
  }
  if (!parsed.CityObjects || typeof parsed.CityObjects !== 'object') {
    throw new Error(`${file}: missing CityObjects.`);
  }
  if (!Array.isArray(parsed.vertices)) {
    throw new Error(`${file}: missing vertices array.`);
  }
  return parsed;
}

function inspectCityGml(xml) {
  return {
    roads: countMatches(xml, /<tran:Road\b/g),
    trafficSpaces: countMatches(xml, /<tran:TrafficSpace\b/g),
    trafficAreas: countMatches(xml, /<tran:(?:TrafficArea|AuxiliaryTrafficArea)\b/g),
    polygons: countMatches(xml, /<gml:Polygon\b/g),
    hasTransportationNamespace: xml.includes('http://www.opengis.net/citygml/transportation/3.0'),
  };
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function resolveConverter(explicit) {
  if (explicit) return path.resolve(String(explicit));
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

function runCommand(executable, args) {
  const command =
    process.platform === 'win32' && executable.toLowerCase().endsWith('.bat')
      ? process.env.ComSpec ?? 'cmd.exe'
      : executable;
  const commandArgs = command === executable ? args : ['/d', '/q', '/c', executable, ...args];
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: 'pipe',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(' ')} failed with code ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`
    );
  }
  return result;
}

async function findOutputFile(outputDir, inputFile, before) {
  const expected = path.join(outputDir, expectedOutputName(inputFile));
  if (existsSync(expected)) return expected;
  const after = await listGmlFiles(outputDir);
  const created = after.filter((file) => !before.has(file));
  if (created.length === 1) return created[0];
  if (created.length > 1) {
    created.sort();
    return created[created.length - 1];
  }
  throw new Error(`citygml-tools did not create a .gml output file in ${outputDir}.`);
}

async function listGmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.gml$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

function expectedOutputName(inputFile) {
  const base = path.basename(inputFile);
  if (/\.city\.json$/i.test(base)) return base.replace(/\.city\.json$/i, '.city.gml');
  if (/\.json$/i.test(base)) return base.replace(/\.json$/i, '.gml');
  return `${base}.gml`;
}

function parseArgs(args) {
  const options = {};
  let input = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      if (input) throw new Error(`Unexpected extra input "${arg}".`);
      input = arg;
      continue;
    }
    const equals = arg.indexOf('=');
    if (equals >= 0) {
      options[arg.slice(2, equals)] = arg.slice(equals + 1);
    } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
      options[arg.slice(2)] = args[++i];
    } else {
      options[arg.slice(2)] = true;
    }
  }
  return { input, options };
}
