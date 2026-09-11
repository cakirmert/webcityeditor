# Embedding WebCityEditor

WebCityEditor provides a browser SDK for mounting the complete editor and a
separate module for data parsing and checks. The SDK mounts a self-hosted iframe.
The editor's global styles, dialogs, keyboard shortcuts and map renderer remain
inside that frame, so a host application can use React, Vue or plain JavaScript.

The public package name is `webcityeditor`. The first distribution is a tested
npm tarball hosted with the GitHub Pages website; it has **not been published to
the npm registry**. Installing from the URL below makes the same package name
available in imports. A future registry release can shorten the install command
to `npm install webcityeditor` without changing those imports.

## Install and serve the assets

```sh
npm install https://cakirmert.github.io/webcityeditor/packages/webcityeditor-0.1.0.tgz
npx webcityeditor-copy-assets public/webcityeditor
```

For a local source checkout, build the same tarball first:

```sh
npm ci
npm run pack:editor
# In the consuming application, using the actual path to the resulting file:
npm install /path/to/webcityeditor/artifacts/webcityeditor-0.1.0.tgz
npx webcityeditor-copy-assets public/webcityeditor
```

The copy command prepares `index.html`, JavaScript, CSS, worker/WASM assets,
four small building assets and license notices. Serve the directory unchanged
with the host application's static files. Full Hamburg catalogs, satellite
imagery, the Rust toolchain and the optional backend are excluded.

The command refuses a nonempty destination. For an existing copy it created,
use `--update`; this replaces current files and retains older hashed assets.
Production deployments can instead copy into a fresh output directory.

```sh
npx webcityeditor-copy-assets public/webcityeditor --update
```

An explicit `editorUrl` keeps asset resolution independent of the host bundler.
If the application runs under `/planning/`, for example, use
`/planning/webcityeditor/index.html`. The editor build uses relative asset paths.
Its HTML route must serve the editor HTML, rather than the host application's
single-page fallback. Serve `.wasm` as `application/wasm` and JavaScript as a
JavaScript MIME type. Use HTTP(S), with HTTPS for production and browser file APIs.

## Mount and exchange documents

```html
<div id="editor" style="height: 800px; width: 100%"></div>
```

```ts
import { createEditor, type CityJsonDocument } from 'webcityeditor';

const project: CityJsonDocument = await fetch('/project.city.json').then(r => r.json());
const editor = createEditor(document.querySelector<HTMLElement>('#editor')!, {
  editorUrl: '/webcityeditor/index.html',
  document: project,
  fileName: 'project.city.json',
  onChange: state => {
    console.log(state.revision, state.dirtyObjectIds);
  },
  onSelectionChange: selection => console.log(selection),
  onError: error => console.error(error),
});

await editor.ready;
const snapshot = await editor.getDocument();
// Persist snapshot through the host application's own storage service.
// Remove the frame and its listeners when the host view closes:
editor.destroy();
```

The SDK never automatically loads Hamburg. With no initial document, the frame
opens its data loader. With a supplied document, it opens that working model.
Width checks still use the Hamburg concept profile unless the road carries a
different profile. Embedding does not select regulations for another city.

| API | Behavior |
| --- | --- |
| `createEditor(element, options)` | Appends one frame; leaves other host children and styles intact. Requires a connected browser document and an HTTP(S) editor URL. |
| `ready` | Resolves when the frame handshake and optional initial document load finish. It does not wait for every remote map tile or certify 3D geometry. |
| `loadDocument(document, {fileName?, discardDrafts?})` | Checks CityJSON structure, replaces the working document, detaches catalog/shared-project bindings, resets selection and histories. Active/parked drafts require `discardDrafts: true`. A running IFC import must finish first. |
| `getDocument()` | Returns a structured-cloned snapshot of applied, currently loaded CityJSON, or `null`. It excludes unfinished drafts and unloaded catalog tiles. |
| `getState()` | Returns filename, object count, session revision, dirty object IDs, draft presence and current selection. |
| `destroy()` | Removes the owned frame/listeners and rejects pending requests. Safe to call more than once. |
| `onChange(state)` | Signals applied document changes: imports, accepted edits, undo/redo and catalog changes. Pointer previews and parked drafts are excluded. |
| `onSelectionChange(selection)` | Receives `{kind, id}` for a building, road or intersection, or `null`. A road ID identifies the Road object, not its clicked band polygon. |
| `onError(error)` | Reports frame startup failure or unexpected reload. Individual method failures reject their own promises. |

Options also include an accessible iframe `title` and `timeoutMs` (default
60 seconds). Methods reject with `EditorError`, whose `code` distinguishes
`draft-active`, `invalid-document`, `busy`, `timeout`, `reloaded`, and `destroyed`.
After an unexpected frame navigation/reload, destroy the old handle and create a
new one. A timed-out mutation has an unknown result; inspect state before retrying.

Messages check the protocol version, a random instance channel, the expected
window and exact HTTP origin in both directions. The frame can be served on a
different origin if its hosting policy permits embedding. Configure CSP
`frame-src` on the host and `frame-ancestors` on the editor accordingly. The iframe
isolates UI behavior; it is not a sandbox for executing untrusted plugin code.

Each snapshot request copies the loaded document across the frame boundary.
For large models, debounce host persistence and serialize writes rather than
requesting a full snapshot for every notification. The session `revision` is a
change counter, separate from the backend's optimistic revision. A snapshot is
not the UI's validated export: use the [export/validation workflow](road-warnings.md#conversion-loading-and-export-diagnostics)
when primitive validation and portable serialized output are required.

## React lifecycle

```tsx
import { useEffect, useRef } from 'react';
import { createEditor, type CityJsonDocument } from 'webcityeditor';

export function CityEditor({ initialDocument }: { initialDocument: CityJsonDocument }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = createEditor(container.current!, {
      editorUrl: '/webcityeditor/index.html',
      document: initialDocument,
      onError: console.error,
    });
    return () => editor.destroy();
  }, [initialDocument]);
  return <div ref={container} style={{ height: 800 }} />;
}
```

Keep `initialDocument` stable during editing. Recreating it on every parent
render would remount the editor and lose session drafts. For deliberate document
switches in a long-lived editor, retain its handle and call `loadDocument` with
an explicit draft decision. Mounting belongs in a browser effect, never during
server rendering. Importing the SDK itself does not access the DOM.

## Headless data module

```ts
import { parseCityJsonAuto, checkIntegrity, validateRoadRules } from 'webcityeditor/core';
import type { RoadDraft } from 'webcityeditor/core';

const parsed = parseCityJsonAuto(text);
if (!parsed.ok) throw new Error(parsed.error);
const structure = checkIntegrity(parsed.doc);
const road: RoadDraft = getRoadDraftFromApplication();
const widthIssues = validateRoadRules(road);
```

The module exports CityJSON/CityJSONSeq parsers, browser structural checks,
`HAMBURG_ROAD_RULES`, profile parsing, band-width lookup, section extents,
`validateRoadRules` and `fitRoadDraftToRules`, with their types. It initializes no
React, WebGL, map service or WebAssembly. It can run in Node or a browser worker.

These parsers assemble an in-memory document from text. They are not the
viewport tile-streaming service. The integrity check is not full schema or 3D
validation, and width checks alone do not detect building/tree/road collisions.
The full editor computes those spatial checks from its loaded surroundings.
See [streaming](streaming-and-storage.md) and [warning scope](road-warnings.md).

## Source structure and verification

| Source | Responsibility |
| --- | --- |
| [`src/package/index.ts`](../src/package/index.ts) | Browser mount, handshake, requests, notifications and teardown. |
| [`src/package/frame-bridge.ts`](../src/package/frame-bridge.ts) | Frame-side origin checks, command handling and load validation. |
| [`useEditorBridge`](../src/hooks/useEditorBridge.ts) | Connects applied React document state to the bridge. |
| [`src/package/core.ts`](../src/package/core.ts) | Deliberate headless public exports. |
| [`types-cityjson.ts`](../src/types-cityjson.ts), [`road-types.ts`](../src/lib/road-types.ts) | Shared types independent of rendering and projection imports. |
| [`build-package.mjs`](../scripts/build-package.mjs) | SDK, declarations, relative editor build, notices and package manifest. |
| [`copy-assets.mjs`](../packaging/copy-assets.mjs) | Safe copy/update of self-hosted editor assets and notices. |
| [`examples/embedded`](../examples/embedded) | Complete plain TypeScript host with load, snapshot and teardown controls. |

Run Node 24 for repository development:

```sh
npm test
npm run build:package
npm run test:package
```

The package test packs and installs the real tarball into a temporary standalone
consumer, checks Node imports without a DOM, type-checks under NodeNext, copies
assets, rejects an accidental overwrite, and builds the host app. It records the
consumer location and archive sizes in `artifacts/consumer.json`. Run `npm run dev`
in that consumer to inspect the full embedding example. The Pages workflow also
runs these checks and serves the tested tarball under `/packages/` with a SHA-256
file. Registry publication remains a separate release step using npm credentials.

## Current module boundary

The SDK embeds the complete workspace. It does not yet expose independently
mountable panels, commands for every road/junction operation, a Godot preview,
theme tokens or per-instance local-storage namespaces. Frames on the same editor
origin share local saves and storage configuration. Multiple large frames also
use multiple map/WebGL contexts.

Use at least a tablet-sized working area: 768 CSS pixels wide is the minimum UI
target, and 1024 or more is preferable for road work. The UI is not designed for
phones. External basemaps and selected remote data need network access; iframe
storage/file-picker availability follows browser and origin policy. The optional
Docker project API is deployed separately and can later be replaced behind its
HTTP contract. See the [technical handover](handover-technical.md).

The editor's own code is [Apache-2.0](../LICENSE). Dependencies and sample data
retain their separate notices; [upstream attribution](upstream-dependencies.md)
identifies the Delft and A/B Street components and their source revisions.

## Dependency maintenance before production adoption

The first package carries the application's existing rendering dependencies.
On 11 September 2026, `npm audit --omit=dev` reports 12 affected dependency
entries (one critical, eight high and three moderate; transitive entries repeat
underlying advisories). The critical entry concerns the installed MapLibre 5.24.0
attribution sanitizer; the upstream advisory identifies 6.4.1 as the first
patched release. The other underlying reports concern `fflate` ZIP decoding and
`image-size` image-header decoding. These have not been fixed by packaging the
editor, and a clean consumer install cannot audit code already bundled into its
assets. Track the source lockfile and validate the renderer migration before
production adoption. This inventory does not establish exploit reachability for
each editor path. [MapLibre advisory](https://github.com/advisories/GHSA-jrc7-96c5-q579),
[fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98),
[image-size ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[image-size JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
