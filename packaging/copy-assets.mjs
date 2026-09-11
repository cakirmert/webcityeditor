#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const destinationArg = args.find(arg => !arg.startsWith('--'));
if (args.includes('--help') || !destinationArg || args.some(arg => arg.startsWith('--') && arg !== '--update')) {
  console.log('Usage: webcityeditor-copy-assets <public/editor-directory> [--update]\nCopies the editor assets. --update overwrites a directory previously created by this tool.');
  process.exit(args.includes('--help') ? 0 : 1);
}
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await realpath(join(packageRoot, 'editor'));
const destination = resolve(destinationArg);
await mkdir(destination, { recursive: true });
const target = await realpath(destination);
const insideSource = relative(source, target);
const containsSource = relative(target, source);
if (!insideSource || (!insideSource.startsWith('..') && !isAbsolute(insideSource)) || (!containsSource.startsWith('..') && !isAbsolute(containsSource))) {
  throw new Error('Choose a destination outside the installed package.');
}
const markerPath = join(target, '.webcityeditor-assets.json');
const entries = await readdir(target);
let marker;
try { marker = JSON.parse(await readFile(markerPath, 'utf8')); } catch { /* New destination. */ }
if (entries.length && !(args.includes('--update') && marker?.package === 'webcityeditor')) {
  throw new Error('Destination is not empty. Choose an empty directory, or use --update for assets previously copied by this tool.');
}
await cp(source, target, { recursive: true });
// The deployed frame is a redistribution too, so keep notices beside its assets.
const notices = join(target, 'notices');
await mkdir(notices, { recursive: true });
for (const file of await readdir(packageRoot)) {
  if (/notices\.(md|html)$/i.test(file) || file === 'LICENSE') await cp(join(packageRoot, file), join(notices, file));
}
await cp(join(packageRoot, 'licenses'), join(notices, 'licenses'), { recursive: true });
const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
await writeFile(markerPath, JSON.stringify({ package: 'webcityeditor', version: manifest.version }) + '\n');
console.log(`Copied WebCityEditor ${manifest.version} to ${target}`);
