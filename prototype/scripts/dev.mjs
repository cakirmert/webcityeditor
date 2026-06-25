import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const catalogUrl = 'http://127.0.0.1:8787';
const catalogHealthUrl = `${catalogUrl}/api/hamburg/catalog`;
const viteArgs = process.argv.slice(2);
const frontendCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
const frontendArgs =
  process.platform === 'win32'
    ? ['/d', '/c', 'npm', 'run', 'dev:frontend', '--', ...viteArgs]
    : ['run', 'dev:frontend', '--', ...viteArgs];

let catalogProcess = null;
let viteProcess = null;
let shuttingDown = false;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});

async function main() {
  const alreadyRunning = await isCatalogReady();
  if (alreadyRunning) {
    console.log(`Hamburg LoD2 catalog already running at ${catalogUrl}`);
  } else {
    console.log(`Starting Hamburg LoD2 catalog at ${catalogUrl}`);
    catalogProcess = spawn(process.execPath, ['scripts/hamburg-lod2.mjs', 'serve'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    catalogProcess.once('exit', (code, signal) => {
      catalogProcess = null;
      if (!shuttingDown) {
        console.error(`Hamburg LoD2 catalog stopped (${formatExit(code, signal)}).`);
        shutdown(code ?? 1);
      }
    });

    await waitForCatalog();
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
    `Hamburg LoD2 catalog did not become ready at ${catalogHealthUrl}. ` +
      'Check that Data/hamburg-lod2/cityjsonseq/catalog.json exists.'
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

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
