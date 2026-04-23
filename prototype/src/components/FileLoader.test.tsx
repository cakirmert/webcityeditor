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
});
