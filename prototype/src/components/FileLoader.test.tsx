import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileLoader from './FileLoader';

describe('<FileLoader />', () => {
  it('calls onLoaded with the sample cube when the sample button is clicked', async () => {
    const onLoaded = vi.fn();
    render(<FileLoader onLoaded={onLoaded} />);

    const btn = screen.getByRole('button', { name: /built-in sample/i });
    await userEvent.click(btn);

    expect(onLoaded).toHaveBeenCalledTimes(1);
    const [doc, name] = onLoaded.mock.calls[0];
    expect(doc.type).toBe('CityJSON');
    expect(doc.version).toBe('2.0');
    expect(doc.CityObjects.Building_A).toBeDefined();
    expect(name).toBe('sample-cube.city.json');
  });

  it('shows a success status after sample is loaded', async () => {
    const onLoaded = vi.fn();
    render(<FileLoader onLoaded={onLoaded} />);

    await userEvent.click(screen.getByRole('button', { name: /built-in sample/i }));
    await waitFor(() =>
      expect(screen.getByText(/Loaded v2\.0/)).toBeInTheDocument()
    );
  });

  it('shows an error when pasted URL cannot be fetched', async () => {
    const onLoaded = vi.fn();
    // Stub fetch to throw
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    render(<FileLoader onLoaded={onLoaded} />);

    const urlInput = screen.getByPlaceholderText(/\.city\.json/);
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'https://example.com/broken.city.json');
    await userEvent.click(screen.getByText(/Fetch URL/));

    await waitFor(() =>
      expect(screen.getByText(/Fetch failed.*network down/)).toBeInTheDocument()
    );
    expect(onLoaded).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('shows an error when the fetched URL returns non-CityJSON', async () => {
    const onLoaded = vi.fn();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"type": "FeatureCollection", "features": []}',
    } as unknown as Response);

    render(<FileLoader onLoaded={onLoaded} />);
    const urlInput = screen.getByPlaceholderText(/\.city\.json/);
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'https://example.com/wrong-format.json');
    await userEvent.click(screen.getByText(/Fetch URL/));

    await waitFor(() =>
      expect(screen.getByText(/Parse error/)).toBeInTheDocument()
    );
    expect(onLoaded).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });

  it('connects the local whole-city CityJSONSeq catalog', async () => {
    const onLoaded = vi.fn();
    const onCatalogLoaded = vi.fn();
    const originalFetch = global.fetch;
    const tile = [
      {
        type: 'CityJSON',
        version: '2.0',
        transform: { scale: [0.001, 0.001, 0.001], translate: [565000, 5936000, 0] },
        metadata: { referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832' },
        CityObjects: {},
        vertices: [],
      },
      {
        type: 'CityJSONFeature',
        id: 'Building_A',
        CityObjects: {
          Building_A: {
            type: 'Building',
            geometry: [{ type: 'Solid', boundaries: [[[[0, 1, 2, 3]]]] }],
          },
        },
        vertices: [
          [0, 0, 0],
          [1000, 0, 0],
          [1000, 1000, 0],
          [0, 1000, 0],
        ],
      },
    ]
      .map((value) => JSON.stringify(value))
      .join('\n');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          crs: 'EPSG:25832',
          count: 1,
          tiles: [
            {
              id: 'tile-a',
              file: 'tile-a.city.jsonl',
              url: '/tiles/tile-a.city.jsonl',
              extent: [565000, 5936000, 0, 565001, 5936001, 0],
              features: 1,
              cityObjects: 1,
              vertices: 4,
              syntheticRootsAdded: 0,
            },
          ],
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => tile,
      } as unknown as Response);

    render(<FileLoader onLoaded={onLoaded} onCatalogLoaded={onCatalogLoaded} />);
    await userEvent.click(screen.getByRole('button', { name: /connect catalog/i }));

    await waitFor(() => expect(onCatalogLoaded).toHaveBeenCalledTimes(1));
    const [loaded, catalogUrl] = onCatalogLoaded.mock.calls[0];
    expect(loaded.doc.CityObjects.Building_A).toBeDefined();
    expect(loaded.tileIds).toEqual(['tile-a']);
    expect(catalogUrl).toBe('http://127.0.0.1:8787');
    expect(screen.getByText(/Connected CityJSONSeq catalog/)).toBeInTheDocument();

    global.fetch = originalFetch;
  });

  it('surfaces malformed lines when a CityJSONSeq URL is loaded directly', async () => {
    const onLoaded = vi.fn();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        `${JSON.stringify({
          type: 'CityJSON',
          version: '2.0',
          CityObjects: {},
          vertices: [],
        })}\n{bad-json`,
    } as unknown as Response);

    render(<FileLoader onLoaded={onLoaded} />);
    const urlInput = screen.getByPlaceholderText(/\.city\.jsonl/);
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'https://example.com/broken.city.jsonl');
    await userEvent.click(screen.getByText(/Fetch URL/));

    await waitFor(() =>
      expect(screen.getByText(/Parse error: broken\.city\.jsonl:2: invalid JSON/)).toBeInTheDocument()
    );
    expect(onLoaded).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
