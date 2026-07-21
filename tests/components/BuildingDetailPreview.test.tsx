import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CityJsonDocument } from '../../src/types';

const { viewerSpy } = vi.hoisted(() => ({ viewerSpy: vi.fn() }));

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

describe('<BuildingDetailPreview />', () => {
  beforeEach(() => viewerSpy.mockClear());

  it('loads only the selected building and defaults to untextured LoD3', () => {
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
    expect(firstProps.texturesEnabled).toBe(false);
    expect(screen.getByText(/Selected building only/)).toHaveTextContent(
      'semantic surface colours'
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Selected building textures' }));
    expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ lod: 'lod3', texturesEnabled: true })
    );

    fireEvent.click(screen.getByRole('button', { name: 'LoD2' }));
    expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ lod: 'lod2', texturesEnabled: false })
    );
    expect(screen.getByRole('switch', { name: 'Selected building textures' })).toBeDisabled();
  });
});
