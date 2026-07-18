import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { findReadyHamburgRoadCatalog } from './hamburg-road-catalog-path.mjs';

const cliArgs = process.argv.slice(2);
const catalogMode = takeOption(cliArgs, '--catalog') ?? 'buildings';
const requestedRoadCatalogDir = takeOption(cliArgs, '--output-dir');
const serverOnly = takeFlag(cliArgs, '--server-only');
const dryRun = takeFlag(cliArgs, '--dry-run');
if (!['buildings', 'roads'].includes(catalogMode)) {
  throw new Error(`Unknown catalog mode "${catalogMode}". Use "buildings" or "roads".`);
}

const defaultRoadCatalogDir = resolve(
  process.cwd(),
  'Data/hamburg-roads-osm2streets/cityjsonseq'
);
const catalogConfig =
  catalogMode === 'roads'
    ? {
        label: 'Hamburg road',
        url: 'http://127.0.0.1:8788',
        serverArgs: () => {
          const preferred = requestedRoadCatalogDir
            ? resolve(process.cwd(), requestedRoadCatalogDir)
            : defaultRoadCatalogDir;
          const readyCatalog = findReadyHamburgRoadCatalog(preferred, {
            scanSiblings: !requestedRoadCatalogDir,
          });
          if (!readyCatalog) {
            throw new Error(
              `No complete Hamburg road catalog was found at ${preferred}. ` +
                'Run PREPARE_HAMBURG_ROADS.cmd first.'
            );
          }
          return [
            'scripts/hamburg-lod2.mjs',
            'serve',
            '--output-dir',
            readyCatalog.directory,
            '--port',
            '8788',
          ];
        },
      }
    : {
        label: 'Hamburg LoD2',
        url: 'http://127.0.0.1:8787',
        serverArgs: () => ['scripts/hamburg-lod2.mjs', 'serve'],
      };
const catalogUrl = catalogConfig.url;
const catalogHealthUrl = `${catalogUrl}/api/hamburg/catalog`;
const viteArgs = cliArgs;
const frontendCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
const frontendArgs =
  process.platform === 'win32'
    ? ['/d', '/c', 'npm', 'run', 'dev:frontend', '--', ...viteArgs]
    : ['run', 'dev:frontend', '--', ...viteArgs];

let catalogProcess = null;
let viteProcess = null;
let shuttingDown = false;

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        type: 'WebcityeditorDevelopmentStartupPlan',
        catalogMode,
        catalogUrl,
        serverOnly,
        serverArgs: catalogConfig.serverArgs(),
        viteArgs,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});

async function main() {
  const alreadyRunning = await isCatalogReady();
  if (alreadyRunning) {
    console.log(`${catalogConfig.label} catalog already running at ${catalogUrl}`);
  } else {
    console.log(`Starting ${catalogConfig.label} catalog at ${catalogUrl}`);
    const serverArgs = catalogConfig.serverArgs();
    if (catalogMode === 'roads') console.log(`Using Hamburg road catalog: ${serverArgs[3]}`);
    catalogProcess = spawn(process.execPath, serverArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    catalogProcess.once('exit', (code, signal) => {
      catalogProcess = null;
      if (!shuttingDown) {
        console.error(`${catalogConfig.label} catalog stopped (${formatExit(code, signal)}).`);
        shutdown(code ?? 1);
      }
    });

    await waitForCatalog();
  }

  if (serverOnly) {
    console.log(`${catalogConfig.label} catalog is ready at ${catalogUrl}`);
    return;
  }

  console.log('Starting Vite dev server');
  viteProcess = spawn(
    frontendCommand,
    frontendArgs,
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    }
  );
  viteProcess.once('exit', (code, signal) => {
    viteProcess = null;
    if (!shuttingDown) shutdown(code ?? (signal ? 1 : 0));
  });
}

async function waitForCatalog() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (shuttingDown) throw new Error('Development startup was interrupted.');
    if (await isCatalogReady()) return;
    await delay(400);
  }
  throw new Error(
    `${catalogConfig.label} catalog did not become ready at ${catalogHealthUrl}. ` +
      (catalogMode === 'roads'
        ? 'Run PREPARE_HAMBURG_ROADS.cmd first.'
        : 'Check that Data/hamburg-lod2/cityjsonseq/catalog.json exists.')
  );
}

async function isCatalogReady() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(catalogHealthUrl, {
      cache: 'no-cache',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (viteProcess) viteProcess.kill();
  if (catalogProcess) catalogProcess.kill();
  process.exitCode = code;
}

function formatExit(code, signal) {
  if (signal) return `signal ${signal}`;
  return `exit ${code ?? 'unknown'}`;
}

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
  args.splice(index, 2);
  return value;
}

function takeFlag(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
