import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CityJsonDocument } from '../../src/types';

const { viewerSpy, lod3LoaderSpy } = vi.hoisted(() => ({
  viewerSpy: vi.fn(),
  lod3LoaderSpy: vi.fn(),
}));

vi.mock('../../src/lib/hamburg-lod3-tiles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/hamburg-lod3-tiles')>()),
  loadHamburgLod3Building: lod3LoaderSpy,
}));

vi.mock('../../src/components/Viewer', () => ({
  default: (props: Record<string, unknown>) => {
    viewerSpy(props);
    return <div data-testid="selected-building-viewer" />;
  },
}));

import BuildingDetailPreview from '../../src/components/BuildingDetailPreview';

function detailDocument(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    CityObjects: {
      selected: {
        type: 'Building',
        geometry: [
          { type: 'MultiSurface', lod: '2', boundaries: [[[0, 1, 2]]] },
          {
            type: 'MultiSurface',
            lod: '3',
            boundaries: [[[0, 1, 2]]],
            texture: { rgbTexture: { values: [[[0, 0, 1, 2]]] } },
          },
        ],
      },
      neighbour: {
        type: 'Building',
        geometry: [{ type: 'MultiSurface', lod: '3', boundaries: [[[0, 1, 2]]] }],
      },
    },
    appearance: {
      textures: [{ type: 'JPG', image: 'selected.jpg' }],
      'vertices-texture': [[0, 0], [1, 0], [0, 1]],
    },
  };
}

function hamburgLod2Document(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: {
      scale: [0.000001, 0.000001, 0.001],
      translate: [10, 53.54, 0],
    },
    metadata: { referenceSystem: 'EPSG:4326' },
    vertices: [
      [0, 0, 0],
      [100, 0, 0],
      [100, 100, 0],
      [0, 100, 0],
    ],
    CityObjects: {
      DEHHALKAJ00058sn: {
        type: 'Building',
        geometry: [{
          type: 'MultiSurface',
          lod: '2',
          boundaries: [[[0, 1, 2, 3]]],
        }],
      },
    },
  };
}

describe('<BuildingDetailPreview />', () => {
  beforeEach(() => {
    viewerSpy.mockClear();
    lod3LoaderSpy.mockReset();
    lod3LoaderSpy.mockResolvedValue(null);
  });

  it('loads only the selected building and defaults to textured LoD3', () => {
    render(
      <BuildingDetailPreview
        cityjson={detailDocument()}
        buildingId="selected"
        reloadToken={0}
        splitPreview={null}
      />
    );

    const firstProps = viewerSpy.mock.calls.at(-1)?.[0] as {
      cityjson: CityJsonDocument;
      lod: string;
      texturesEnabled: boolean;
    };
    expect(Object.keys(firstProps.cityjson.CityObjects)).toEqual(['selected']);
    expect(firstProps.lod).toBe('lod3');
    expect(firstProps.texturesEnabled).toBe(true);
    expect(screen.getByText(/Selected building only/)).toHaveTextContent(
      'photo textures'
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Selected building textures' }));
    expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ lod: 'lod3', texturesEnabled: false })
    );

    fireEvent.click(screen.getByRole('button', { name: 'LoD2' }));
    expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ lod: 'lod2', texturesEnabled: false })
    );
    expect(screen.getByRole('switch', { name: 'Selected building textures' })).toBeDisabled();
  });

  it('enables LoD3 for a matching Hamburg LoD2 building and displays the streamed mesh', async () => {
    const group = { traverse: vi.fn() };
    lod3LoaderSpy.mockResolvedValue({
      group,
      triangleCount: 59,
      tileUrl: 'https://daten-hamburg.de/example.b3dm',
    });

    render(
      <BuildingDetailPreview
        cityjson={hamburgLod2Document()}
        buildingId="DEHHALKAJ00058sn"
        reloadToken={0}
        splitPreview={null}
      />
    );

    expect(screen.getByRole('button', { name: 'LoD3' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'LoD3' })).toHaveClass('is-active');
    await waitFor(() => expect(lod3LoaderSpy).toHaveBeenCalledWith(
      'DEHHALKAJ00058sn',
      expect.any(Array),
      expect.any(AbortSignal)
    ));
    await waitFor(() => expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ externalModel: group, lod: 'lod3' })
    ));
    expect(screen.getByText(/Hamburg Geoportal untextured geometry/)).toHaveTextContent(
      '59 triangles'
    );
    expect(screen.getByRole('switch', { name: 'Selected building textures' })).toBeDisabled();
  });
});
