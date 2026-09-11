# WebCityEditor

Embed a CityJSON road, intersection and building editor in a web application.
The browser SDK has no React dependency. It mounts the complete editor inside
an iframe so the host page keeps its own styles and keyboard controls.

```sh
npx webcityeditor-copy-assets public/webcityeditor
```

Serve that directory with the host app, then mount the editor:

```js
import { createEditor } from 'webcityeditor';

const editor = createEditor(document.querySelector('#editor'), {
  editorUrl: '/webcityeditor/index.html',
  document: cityJsonDocument,
  fileName: 'project.city.json',
  onChange: state => console.log('Applied document revision', state.revision),
});
await editor.ready;
const snapshot = await editor.getDocument();
// Later, when the host view unmounts:
editor.destroy();
```

Give `#editor` an explicit height and at least a tablet-sized working area
(768 CSS pixels wide; 1024 or more recommended). No Hamburg project is
automatically loaded by the SDK. The frame still supports ordinary file and
URL imports, maps, manual road/intersection editing and local saving.

Headless helpers work in Node and the browser:

```js
import { parseCityJsonAuto, checkIntegrity } from 'webcityeditor/core';
const result = parseCityJsonAuto(text);
if (!result.ok) throw new Error(result.error);
console.log(checkIntegrity(result.doc));
```

`loadDocument(doc, {fileName, discardDrafts})` replaces the working document.
It rejects active drafts unless `discardDrafts: true` is explicitly supplied.
`getDocument()` returns a copy of applied, currently loaded CityJSON. It excludes
unfinished drafts and unloaded catalog tiles and does not certify 3D validity.
The host is responsible for persisting snapshots. Change events include imports,
applied edits, undo/redo and catalog changes; they do not include pointer previews.

The editor assets include JavaScript, CSS and WASM. Serve them together over
HTTP(S), retain attribution, and use HTTPS in production. Basemaps and chosen
remote datasets require network access. Backend hosting is optional and separate.

See the [package guide](https://github.com/cakirmert/webcityeditor/blob/main/docs/package-guide.md)
for the complete API, React mounting, asset updates, current limits and release
workflow. Editor code is Apache-2.0; bundled dependencies and building data retain
the licenses in `THIRD-PARTY-NOTICES.md`, `WASM-NOTICES.md` and `DATA-NOTICES.md`.

This initial package retains existing renderer/decoder dependency advisories,
including MapLibre's attribution sanitizer. See [dependency maintenance](https://github.com/cakirmert/webcityeditor/blob/main/docs/package-guide.md#dependency-maintenance-before-production-adoption)
before production adoption. A consuming app's npm audit does not inspect bundled
JavaScript/WASM; audit the source lockfile as well.
