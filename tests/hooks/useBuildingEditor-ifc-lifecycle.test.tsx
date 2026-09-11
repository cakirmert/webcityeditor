import { act, cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildingEditor } from '../../src/hooks/useBuildingEditor';
import type { CityJsonDocument } from '../../src/types';
import type { IfcImportResult } from '../../src/lib/ifc-import';

const mocks = vi.hoisted(() => ({ parseIfc: vi.fn(), convert: vi.fn() }));
vi.mock('../../src/lib/ifc-import', () => ({ parseIfc: mocks.parseIfc }));
vi.mock('../../src/lib/ifc-to-cityjson', () => ({ convertIfcToCityJsonBuilding: mocks.convert }));

const parsed = { name: 'Old IFC' } as IfcImportResult;
const pending = { parsed, fileName: 'old.ifc' };
function documentWith(id: string): CityJsonDocument {
  return { type: 'CityJSON', version: '2.0', vertices: [], CityObjects: { [id]: { type: 'Building' } } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function editor(doc: CityJsonDocument) {
  const pushUndo = vi.fn(), setDirtyIds = vi.fn(), setSelection = vi.fn(), setReloadToken = vi.fn(), markGeometryChanged = vi.fn();
  const view = renderHook(({ document }) => useBuildingEditor({
    cityjson: document, selection: null, dirtyIds: new Set(),
    setDirtyIds, setSelection, setReloadToken, markGeometryChanged,
  } as never, { pushUndo } as never, { zones: [], zoningEnabled: false }), { initialProps: { document: doc } });
  return { ...view, pushUndo, setDirtyIds, setSelection, setReloadToken };
}
function chooseIfc(view: ReturnType<typeof editor>, name: string) {
  act(() => { view.result.current.handleImportIfc(); });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File([], name)] } });
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
  mocks.convert.mockImplementation((doc: CityJsonDocument, _parsed: IfcImportResult, _location: number[], name: string) => ({
    id: name, cityObject: { type: 'Building' }, newVertices: [], vertexOffset: doc.vertices.length,
  }));
});
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.resetAllMocks(); });

describe('IFC import ownership', () => {
  it('does not mutate either document or its UI state when replacement occurs during lazy placement', async () => {
    const old = documentWith('old'), next = documentWith('next');
    const before = JSON.stringify(old), view = editor(old);
    act(() => { view.result.current.setIfcPending(pending); });
    let placing!: Promise<void>;
    act(() => { placing = view.result.current.handleIfcPlacement([10, 53]); });
    view.rerender({ document: next });
    await act(async () => placing);
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(view.pushUndo).not.toHaveBeenCalled();
    expect(view.setDirtyIds).not.toHaveBeenCalled();
    expect(view.setSelection).not.toHaveBeenCalled();
    expect(view.setReloadToken).not.toHaveBeenCalled();
    expect(JSON.stringify(old)).toBe(before);
    expect(Object.keys(next.CityObjects)).toEqual(['next']);
    expect(view.result.current.ifcPending).toBeNull();
  });

  it('keeps a newer pending import when an older canceled placement finishes', async () => {
    const doc = documentWith('base'), view = editor(doc);
    const newer = { parsed: { name: 'New IFC' } as IfcImportResult, fileName: 'new.ifc' };
    act(() => { view.result.current.setIfcPending(pending); });
    let placing!: Promise<void>;
    act(() => {
      placing = view.result.current.handleIfcPlacement([10, 53]);
      view.result.current.handleCancelIfcPlacement();
      view.result.current.setIfcPending(newer);
    });
    await act(async () => placing);
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(view.pushUndo).not.toHaveBeenCalled();
    expect(view.result.current.ifcPending).toBe(newer);
    await act(async () => view.result.current.handleIfcPlacement([10, 53]));
    expect(mocks.convert).toHaveBeenCalledOnce();
    expect(doc.CityObjects['new.ifc']).toBeDefined();
  });

  it('applies a pending import once when placement is clicked twice before the converter loads', async () => {
    const doc = documentWith('base'), view = editor(doc);
    act(() => { view.result.current.setIfcPending(pending); });
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = view.result.current.handleIfcPlacement([10, 53]);
      second = view.result.current.handleIfcPlacement([10.001, 53.001]);
      expect(view.pushUndo).not.toHaveBeenCalled();
    });
    await act(async () => { await Promise.all([first, second]); });
    expect(mocks.convert).toHaveBeenCalledOnce();
    expect(mocks.convert).toHaveBeenCalledWith(doc, parsed, [10, 53], 'old.ifc');
    expect(view.pushUndo).toHaveBeenCalledOnce();
    expect(view.setDirtyIds).toHaveBeenCalledOnce();
    expect(view.setSelection).toHaveBeenCalledWith({ objectId: 'old.ifc' });
    expect(view.result.current.ifcPending).toBeNull();
  });

  it('does not start parsing from a chooser belonging to an older document', async () => {
    const view = editor(documentWith('old'));
    act(() => { view.result.current.handleImportIfc(); });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    view.rerender({ document: documentWith('next') });
    expect(input.isConnected).toBe(false);
    fireEvent.change(input, { target: { files: [new File([], 'late.ifc')] } });
    await act(async () => {});
    expect(mocks.parseIfc).not.toHaveBeenCalled();
    expect(view.result.current.ifcPending).toBeNull();
    expect(view.result.current.ifcParsing).toBe(false);
  });

  it('ignores parsing completed for an older document', async () => {
    const read = deferred<IfcImportResult>();
    mocks.parseIfc.mockReturnValue(read.promise);
    const view = editor(documentWith('old'));
    chooseIfc(view, 'old.ifc');
    await waitFor(() => expect(mocks.parseIfc).toHaveBeenCalledOnce());
    view.rerender({ document: documentWith('next') });
    await act(async () => read.resolve(parsed));
    expect(view.result.current.ifcPending).toBeNull();
    expect(view.result.current.ifcParsing).toBe(false);
    expect(view.pushUndo).not.toHaveBeenCalled();
  });

  it('does not replace a newer parsed file or its loading state with an older parse result', async () => {
    const oldRead = deferred<IfcImportResult>(), newRead = deferred<IfcImportResult>();
    mocks.parseIfc.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    const view = editor(documentWith('base'));
    chooseIfc(view, 'old.ifc');
    await waitFor(() => expect(mocks.parseIfc).toHaveBeenCalledTimes(1));
    chooseIfc(view, 'new.ifc');
    await waitFor(() => expect(mocks.parseIfc).toHaveBeenCalledTimes(2));
    await act(async () => oldRead.resolve(parsed));
    expect(view.result.current.ifcPending).toBeNull();
    expect(view.result.current.ifcParsing).toBe(true);
    const newer = { name: 'New IFC' } as IfcImportResult;
    await act(async () => newRead.resolve(newer));
    expect(view.result.current.ifcPending).toEqual({ parsed: newer, fileName: 'new.ifc' });
    expect(view.result.current.ifcParsing).toBe(false);
  });
});
