import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'package-dist');
await mkdir(join(root, 'artifacts'), { recursive: true });
const app = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
// Vite cleans only the known build subdirectories; no source/public data is removed.
await build({ configFile: false, publicDir: false, build: {
  outDir: join(output, 'dist'), emptyOutDir: true, sourcemap: true,
  lib: { entry: { index: join(root, 'src/package/index.ts'), core: join(root, 'src/package/core.ts') }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
} });
await build({ configFile: join(root, 'vite.config.ts'), base: './', publicDir: false,
  build: { outDir: join(output, 'editor'), emptyOutDir: true },
});
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.package.json')], { cwd: root, stdio: 'inherit' });
await mkdir(join(output, 'bin'), { recursive: true });
await cp(join(root, 'packaging/copy-assets.mjs'), join(output, 'bin/copy-assets.mjs'));
await cp(join(root, 'public/data/assets'), join(output, 'editor/data/assets'), { recursive: true });
await cp(join(root, 'LICENSE'), join(output, 'LICENSE'));
await cp(join(root, 'packaging/data-notices.md'), join(output, 'DATA-NOTICES.md'));
await cp(join(root, 'packaging/wasm-notices.md'), join(output, 'WASM-NOTICES.md'));
await cp(join(root, 'packaging/rust-standard-library-notices.html'), join(output, 'rust-standard-library-notices.html'));
const extraNotices = await readFile(join(root, 'packaging/npm-extra-notices.md'), 'utf8');
await writeFile(join(output, 'npm-extra-notices.md'), extraNotices);
await cp(join(root, 'packaging/README.md'), join(output, 'README.md'));

// Preserve the installed npm packages' actual license files, including notices
// that differ from package metadata (the pinned CityJSON loader is Apache-2.0).
const notices = ['# Bundled JavaScript dependencies', '', 'Generated from package-lock.json. This conservative inventory includes production dependencies even when tree-shaking omits their code.', '', '| Package | Declared license | License/notice files |', '| --- | --- | --- |'];
const missing = [];
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location.startsWith('node_modules/') || entry.dev || entry.link) continue;
  const folder = join(root, location);
  let manifest;
  try { manifest = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8')); } catch { continue; }
  const name = manifest.name;
  const files = (await readdir(folder, { withFileTypes: true }))
    .filter(file => file.isFile() && /^(licen[sc]e|notice|copying|copyright)(\b|[-_.])/i.test(file.name)).map(file => file.name);
  if (!files.length && name !== 'osm2streets-js' && !extraNotices.includes(`| ${name} | ${manifest.version} |`)) missing.push(`${name}@${manifest.version}`);
  const relative = `licenses/npm/${location.replaceAll('node_modules/', '').replaceAll('/', '__')}`;
  await mkdir(join(output, relative), { recursive: true });
  for (const file of files) await cp(join(folder, file), join(output, relative, file));
  if (name === 'osm2streets-js') {
    notices.push(`| ${name}@${manifest.version} | Apache-2.0 with separately licensed Rust dependencies | [WASM notices](WASM-NOTICES.md) |`);
  } else {
    const links = files.map(file => `[${file}](${relative}/${file})`).join(', ');
    const declared = name === 'cityjson-threejs-loader' ? 'Apache-2.0 (LICENSE; package metadata incorrectly says MIT)' : String(manifest.license ?? entry.license ?? 'See upstream');
    notices.push(`| ${name}@${manifest.version} | ${declared} | ${links || '[Retained upstream text](npm-extra-notices.md)'} |`);
  }
}
notices.push('', 'Packages without root license files, and web-ifc 0.0.77 corresponding source, are covered in [additional retained notices](npm-extra-notices.md).', '', 'Rust/WASM dependencies and embedded OSM country-boundary data have separate notices in [WASM-NOTICES.md](WASM-NOTICES.md). Sample buildings have [DATA-NOTICES.md](DATA-NOTICES.md).', '');
await writeFile(join(output, 'THIRD-PARTY-NOTICES.md'), notices.join('\n'));
if (missing.length) throw new Error(`Retain license notices before distributing these dependencies: ${missing.join(', ')}`);
await writeFile(join(output, 'package.json'), JSON.stringify({
  name: 'webcityeditor', version: app.version, type: 'module', license: 'Apache-2.0',
  description: 'Embeddable CityJSON road, intersection and building editor with headless validation helpers',
  repository: { type: 'git', url: 'https://github.com/cakirmert/webcityeditor.git' },
  homepage: 'https://github.com/cakirmert/webcityeditor#readme',
  exports: {
    '.': { types: './types/package/index.d.ts', import: './dist/index.js' },
    './core': { types: './types/package/core.d.ts', import: './dist/core.js' },
    './package.json': './package.json',
  },
  main: './dist/index.js', types: './types/package/index.d.ts',
  bin: { 'webcityeditor-copy-assets': './bin/copy-assets.mjs' },
  files: ['dist', 'types', 'editor', 'bin', 'licenses', '*NOTICES.md', '*notices.md', '*notices.html', 'LICENSE', 'README.md'],
  engines: { node: '>=22.12.0' }, sideEffects: false,
  webcityeditor: { sourceRevision: revision, sourceDirty },
}, null, 2) + '\n');
console.log(`Prepared webcityeditor@${app.version} in ${output}`);
