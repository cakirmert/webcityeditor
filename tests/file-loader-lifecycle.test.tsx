import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileLoader from '../src/components/FileLoader';
import { loadDocument, listDocuments } from '../src/lib/storage';
import { fetchCityJsonSeqViewport, type CityJsonSeqViewportLoad } from '../src/lib/cityjsonseq-catalog';
import type { CityJsonDocument } from '../src/types';

vi.mock('../src/lib/storage', () => ({
  loadDocument: vi.fn(), listDocuments: vi.fn(), deleteDocument: vi.fn(),
}));
vi.mock('../src/lib/cityjsonseq-catalog', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/lib/cityjsonseq-catalog')>(),
  fetchCityJsonSeqViewport: vi.fn(),
}));

const city: CityJsonDocument = { type: 'CityJSON', version: '2.0', CityObjects: {}, vertices: [] };
const text = JSON.stringify(city);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function startUrl(url = 'https://example.test/old.city.json') {
  fireEvent.click(screen.getByText('Advanced loading options'));
  fireEvent.change(screen.getByPlaceholderText(/https:\/\/.*city\.jsonl/), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: 'Fetch URL' }));
}

beforeEach(() => {
  vi.mocked(listDocuments).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('FileLoader source ownership', () => {
  it.each(['URL', 'quick sample'] as const)('ignores a late %s response after host replacement unmounts the loader', async (source) => {
    const response = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal('fetch', fetchMock);
    const onLoaded = vi.fn(), onClose = vi.fn();
    const view = render(<StrictMode><FileLoader includeHostedSamples={false} onLoaded={onLoaded} onClose={onClose} /></StrictMode>);
    if (source === 'URL') startUrl();
    else {
      fireEvent.click(screen.getByText('Advanced loading options'));
      fireEvent.click(screen.getByRole('button', { name: /3DBAG - Delft tile/i }));
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    // Deliberately simulate a transport that resolves despite cancellation.
    await act(async () => response.resolve({ ok: true, text: async () => text } as Response));
    expect(onLoaded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a file read that finishes after the loader is unmounted', async () => {
    const read = deferred<string>();
    const file = new File([], 'old.city.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => read.promise });
    const onLoaded = vi.fn();
    const view = render(<FileLoader includeHostedSamples={false} onLoaded={onLoaded} />);
    fireEvent.drop(screen.getByText(/Drop a file here/), { dataTransfer: { files: [file] } });
    view.unmount();
    await act(async () => read.resolve(text));
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('ignores a local save read that finishes after the loader is unmounted', async () => {
    const read = deferred<Awaited<ReturnType<typeof loadDocument>>>();
    vi.mocked(listDocuments).mockResolvedValue([{ name: 'Saved project', savedAt: Date.now() }]);
    vi.mocked(loadDocument).mockReturnValue(read.promise);
    const onLoaded = vi.fn();
    const view = render(<FileLoader includeHostedSamples={false} onLoaded={onLoaded} />);
    fireEvent.click(screen.getByText('Advanced loading options'));
    fireEvent.click(await screen.findByRole('button', { name: /Saved project/ }));
    expect(loadDocument).toHaveBeenCalledWith('Saved project');
    view.unmount();
    await act(async () => read.resolve({ name: 'Saved project', savedAt: Date.now(), doc: city }));
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('ignores a late catalog connection after replacement and aborts its fetches', async () => {
    const read = deferred<CityJsonSeqViewportLoad>();
    vi.mocked(fetchCityJsonSeqViewport).mockReturnValue(read.promise);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onLoaded = vi.fn(), onCatalogLoaded = vi.fn();
    const view = render(<FileLoader includeHostedSamples={false} onLoaded={onLoaded} onCatalogLoaded={onCatalogLoaded} />);
    fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8787'), { target: { value: 'https://example.test/catalog.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect catalog' }));
    const fetchTile = vi.mocked(fetchCityJsonSeqViewport).mock.calls[0][3]!;
    void fetchTile('https://example.test/tile.city.jsonl');
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => read.resolve({ doc: city, tileIds: ['old-tile'] } as CityJsonSeqViewportLoad));
    expect(onCatalogLoaded).not.toHaveBeenCalled();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('keeps a newer synchronous sample when an older network read resolves later', async () => {
    const read = deferred<string>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => read.promise }));
    const onLoaded = vi.fn();
    render(<FileLoader includeHostedSamples={false} onLoaded={onLoaded} />);
    startUrl();
    fireEvent.click(screen.getByRole('button', { name: /built-in sample cube/i }));
    expect(onLoaded).toHaveBeenCalledOnce();
    expect(onLoaded.mock.calls[0][1]).toBe('sample-cube.city.json');
    await act(async () => read.resolve(text));
    expect(onLoaded).toHaveBeenCalledOnce();
    expect(screen.getByText(/Loaded v2\.0.*1 objects/)).toBeInTheDocument();
  });

  it('lets the newer URL win and ignores a stale failure without replacing its success status', async () => {
    const first = deferred<Response>(), second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const onLoaded = vi.fn();
    render(<FileLoader includeHostedSamples={false} onLoaded={onLoaded} />);
    startUrl();
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/.*city\.jsonl/), { target: { value: 'https://example.test/current.city.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch URL' }));
    await act(async () => second.resolve({ ok: true, text: async () => text } as Response));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledOnce());
    expect(onLoaded.mock.calls[0][1]).toBe('current.city.json');
    await act(async () => first.reject(new Error('old request failed')));
    expect(screen.queryByText(/old request failed/)).not.toBeInTheDocument();
    expect(screen.getByText(/Loaded v2\.0.*0 objects/)).toBeInTheDocument();
    expect(onLoaded).toHaveBeenCalledOnce();
  });
});
