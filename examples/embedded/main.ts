import { createEditor } from 'webcityeditor';
import { checkIntegrity, type CityJsonDocument } from 'webcityeditor/core';

// Synthetic building, not a surveyed city asset. Replace with your CityJSON.
const sample: CityJsonDocument = {
  type: 'CityJSON', version: '2.0',
  transform: { scale: [1, 1, 1], translate: [85000, 447000, 0] },
  metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/28992' },
  CityObjects: { Building_A: { type: 'Building', attributes: { name: 'Editable example', measuredHeight: 10 }, geometry: [{
    type: 'Solid', lod: '2.2', boundaries: [[[[0, 3, 2, 1]], [[4, 5, 6, 7]], [[0, 1, 5, 4]], [[1, 2, 6, 5]], [[2, 3, 7, 6]], [[3, 0, 4, 7]]]],
    semantics: { surfaces: [{ type: 'GroundSurface' }, { type: 'RoofSurface' }, { type: 'WallSurface' }], values: [[0, 1, 2, 2, 2, 2]] },
  }] } },
  vertices: [[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0], [0, 0, 10], [10, 0, 10], [10, 8, 10], [0, 8, 10]],
};
const status = document.querySelector<HTMLElement>('#status')!;
const editor = createEditor(document.querySelector<HTMLElement>('#editor')!, {
  editorUrl: './webcityeditor/index.html', document: sample, fileName: 'example.city.json',
  onChange: state => { status.textContent = `Applied revision ${state.revision} · ${state.objectCount} objects · ${state.dirtyObjectIds.length} modified`; },
  onSelectionChange: selection => { status.textContent = selection ? `Selected ${selection.kind}: ${selection.id}` : 'Selection cleared'; },
  onError: error => { status.textContent = error.message; },
});
try { await editor.ready; status.textContent = 'Editor ready · host styles remain independent'; }
catch (error) { status.textContent = String(error); }
document.querySelector('#snapshot')!.addEventListener('click', async () => {
  try {
    const snapshot = await editor.getDocument();
    const state = await editor.getState();
    status.textContent = JSON.stringify({ fileName: state.fileName, hasDraft: state.hasDraft, structureValid: snapshot ? checkIntegrity(snapshot).ok : null, objects: snapshot?.CityObjects }, null, 2);
  } catch (error) { status.textContent = String(error); }
});
document.querySelector('#replace')!.addEventListener('click', async () => {
  try { await editor.loadDocument(sample, { fileName: 'replacement.city.json' }); status.textContent = 'Replacement loaded; selection and edit history reset'; }
  catch (error) { status.textContent = String(error); }
});
document.querySelector('#dispose')!.addEventListener('click', () => { editor.destroy(); status.textContent = 'Editor destroyed; host controls remain'; });
window.addEventListener('pagehide', () => editor.destroy(), { once: true });
