import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export const RTRON_VERSION = '1.3.0';
export const RTRON_DOWNLOAD_URL =
  'https://github.com/tum-gis/rtron/releases/download/v1.3.0/rtron-1.3.0.jar';

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
  if (!input) throw new Error(usage());

  const plan = buildPlan(input, options);
  if (options['dry-run']) return plan;

  assertDirectory(plan.inputDir, 'OpenDRIVE input');
  assertFile(plan.rtronJar, 'r:trån JAR');
  assertJavaVersion(plan.java, plan.requirements.minimumJavaMajor);
  await mkdir(plan.reportsDir, { recursive: true });
  await mkdir(plan.citygmlDir, { recursive: true });

  const steps = [];
  for (const command of plan.commands) {
    const result = runCommand(command.executable, command.args);
    steps.push({
      name: command.name,
      status: 'passed',
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
  }

  return {
    ...plan,
    dryRun: false,
    steps,
  };
}

export function buildPlan(input, options = {}) {
  const inputDir = path.resolve(input);
  const outputDir = path.resolve(String(options['output-dir'] ?? path.join(inputDir, '..', 'rtron-output')));
  const reportsDir = path.resolve(String(options['reports-dir'] ?? path.join(outputDir, 'reports')));
  const citygmlDir = path.resolve(String(options['citygml-dir'] ?? path.join(outputDir, 'citygml')));
  const rtronJar = path.resolve(
    String(
      options['rtron-jar'] ??
        path.join(repoRoot, 'tools', `rtron-${RTRON_VERSION}`, `rtron-${RTRON_VERSION}.jar`)
    )
  );
  const java = String(options.java ?? 'java');

  return {
    type: 'OpenDriveRtronPipelinePlan',
    dryRun: true,
    rtron: {
      version: RTRON_VERSION,
      downloadUrl: RTRON_DOWNLOAD_URL,
    },
    requirements: {
      minimumJavaMajor: 11,
      input: 'Directory containing one or more .xodr files',
    },
    inputDir,
    outputDir,
    reportsDir,
    citygmlDir,
    rtronJar,
    java,
    commands: [
      {
        name: 'validate-opendrive',
        executable: java,
        args: ['-jar', rtronJar, 'validate-opendrive', inputDir, reportsDir],
      },
      {
        name: 'opendrive-to-citygml',
        executable: java,
        args: ['-jar', rtronJar, 'opendrive-to-citygml', inputDir, citygmlDir],
      },
    ],
  };
}

function usage() {
  return [
    'Usage: node scripts/opendrive-rtron.mjs INPUT_DIR [options]',
    '',
    'Options:',
    '  --output-dir DIR    Parent directory for reports and CityGML output',
    '  --reports-dir DIR   Override the validation-report directory',
    '  --citygml-dir DIR   Override the converted CityGML directory',
    '  --rtron-jar FILE    Override the pinned r:trån JAR path',
    '  --java COMMAND      Java 11+ executable (default: java)',
    '  --dry-run           Print the resolved plan without touching the filesystem',
  ].join('\n');
}

function assertDirectory(directory, label) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`${label} directory does not exist: ${directory}`);
  }
}

function assertFile(file, label) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(
      `${label} does not exist: ${file}\nDownload r:trån ${RTRON_VERSION} from ${RTRON_DOWNLOAD_URL}`
    );
  }
}

function assertJavaVersion(java, minimumMajor) {
  const result = spawnSync(java, ['-version'], { encoding: 'utf8', stdio: 'pipe' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${java} -version failed with code ${result.status}.`);
  }
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
  const match = output.match(/version\s+"(\d+)(?:\.(\d+))?/i);
  if (!match) throw new Error(`Could not determine Java version from: ${output.trim()}`);
  const first = Number(match[1]);
  const major = first === 1 ? Number(match[2]) : first;
  if (!Number.isFinite(major) || major < minimumMajor) {
    throw new Error(`r:trån requires Java ${minimumMajor}+; ${java} reports Java ${major}.`);
  }
}

function runCommand(executable, args) {
  const result = spawnSync(executable, args, {
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
