import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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

function PreviewHarness({
  cityjson,
  initialTexturesEnabled = false,
}: {
  cityjson: CityJsonDocument;
  initialTexturesEnabled?: boolean;
}) {
  const [texturesEnabled, setTexturesEnabled] = useState(
    initialTexturesEnabled
  );
  return (
    <BuildingDetailPreview
      cityjson={cityjson}
      buildingId="selected"
      reloadToken={0}
      splitPreview={null}
      texturesEnabled={texturesEnabled}
      onTexturesEnabledChange={setTexturesEnabled}
    />
  );
}

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
      <PreviewHarness cityjson={detailDocument()} />
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
    expect(
      screen.queryByRole('switch', { name: 'Selected building textures' })
    ).not.toBeInTheDocument();
  });

  it('mirrors streamed LoD3 texture availability until local geometry overrides it', () => {
    const streamed = detailDocument();
    const selected = streamed.CityObjects.selected;
    selected.attributes = {
      _hamburgTileTexturesAvailable: true,
      _hamburgTileSelectionProxy: true,
      _hamburgTileGeometryOverride: false,
    };
    const lod3 = selected.geometry?.[1] as Record<string, unknown>;
    delete lod3.texture;
    delete streamed.appearance;

    const { unmount } = render(
      <PreviewHarness
        cityjson={streamed}
        initialTexturesEnabled
      />
    );

    const streamedSwitch = screen.getByRole('switch', {
      name: 'Selected building textures',
    });
    expect(streamedSwitch).toBeEnabled();
    expect(streamedSwitch).toBeChecked();
    expect(viewerSpy.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ lod: 'lod3', texturesEnabled: false })
    );
    expect(screen.getByText(/Selected building only/)).toHaveTextContent(
      'photo textures visible on map'
    );

    fireEvent.click(streamedSwitch);
    expect(streamedSwitch).not.toBeChecked();
    expect(screen.getByText(/Selected building only/)).toHaveTextContent(
      'photo textures off'
    );

    unmount();
    selected.attributes._hamburgTileGeometryOverride = true;
    selected.attributes._hamburgTileSelectionProxy = false;
    render(
      <PreviewHarness
        cityjson={streamed}
        initialTexturesEnabled
      />
    );
    expect(
      screen.queryByRole('switch', { name: 'Selected building textures' })
    ).not.toBeInTheDocument();
  });
});
