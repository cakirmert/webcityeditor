import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import RoadEditorPanel from '../../src/components/RoadEditorPanel';
import type { RoadArea, RoadDraft } from '../../src/lib/transportation';

const draft: RoadDraft = {
  id: 'road-1',
  source: 'manual',
  userVerified: true,
  sections: [
    {
      id: 'section-1',
      centerlineWgs84: [
        [10, 53],
        [10.002, 53.004],
      ],
      maxspeedKmh: 50,
      bands: [
        { id: 'bike-1', kind: 'bike_lane', widthM: 1.75, direction: 'forward' },
        { id: 'car-1', kind: 'car_lane', widthM: 3.25, direction: 'forward' },
        { id: 'sidewalk-1', kind: 'sidewalk', widthM: 2, direction: 'none' },
      ],
    },
  ],
};

function renderPanel(
  onDraftChange = vi.fn(),
  options: {
    osm2streetsSelection?: ComponentProps<typeof RoadEditorPanel>['osm2streetsSelection'];
    selectedRoadArea?: RoadArea;
    draftDirty?: boolean;
    editingRoadId?: string;
    onCancelEdit?: () => void;
    onEditSelectedRoadArea?: (area: RoadArea) => void;
    onCreateDraftFromOsm2StreetsSelection?: () => void;
    onInsertOsm2StreetsSelection?: () => void;
    onHighlightConnectedOsm2StreetsRoads?: () => void;
  } = {}
) {
  const onCreateDraftFromOsm2StreetsSelection =
    options.onCreateDraftFromOsm2StreetsSelection ?? vi.fn();
  const onInsertOsm2StreetsSelection = options.onInsertOsm2StreetsSelection ?? vi.fn();
  const onHighlightConnectedOsm2StreetsRoads =
    options.onHighlightConnectedOsm2StreetsRoads ?? vi.fn();
  const rendered = render(
    <RoadEditorPanel
      osmRoads={[]}
      selectedOsmRoadId={null}
      draft={draft}
      draftDirty={options.draftDirty ?? false}
      editingRoadId={options.editingRoadId ?? null}
      status={null}
      basemap="map"
      drawMode="none"
      backendUrl="http://127.0.0.1:8787/api/roads"
      onClose={() => {}}
      onFetchOsmRoads={() => {}}
      onBasemapChange={() => {}}
      onStartManualDraw={() => {}}
      onFinishManualDraw={() => {}}
      onCancelDraw={() => {}}
      onCancelEdit={options.onCancelEdit ?? vi.fn()}
      onDraftChange={onDraftChange}
      onSplitDraft={() => {}}
      onInsertRoad={() => {}}
      onExportPayload={() => {}}
      onPostPayload={() => {}}
      onBackendUrlChange={() => {}}
      onEditSelectedRoadArea={options.onEditSelectedRoadArea ?? vi.fn()}
      selectedRoadArea={options.selectedRoadArea ?? null}
      osm2streetsSelection={options.osm2streetsSelection}
      onCreateDraftFromOsm2StreetsSelection={onCreateDraftFromOsm2StreetsSelection}
      onInsertOsm2StreetsSelection={onInsertOsm2StreetsSelection}
      onHighlightConnectedOsm2StreetsRoads={onHighlightConnectedOsm2StreetsRoads}
      onClearOsm2StreetsSelection={() => {}}
    />
  );
  return {
    onDraftChange,
    onCreateDraftFromOsm2StreetsSelection,
    onInsertOsm2StreetsSelection,
    onHighlightConnectedOsm2StreetsRoads,
    unmount: rendered.unmount,
  };
}

function createDataTransfer() {
  const values = new Map<string, string>();
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn((type: string, value: string) => values.set(type, value)),
    getData: vi.fn((type: string) => values.get(type) ?? ''),
  };
}

describe('<RoadEditorPanel />', () => {
  it('shows road bands as draggable side-by-side boxes', () => {
    renderPanel();

    expect(screen.getByTestId('road-band-order-strip')).toBeInTheDocument();
    expect(screen.getByTestId('road-band-box-0')).toHaveTextContent('bike lane');
    expect(screen.getByTestId('road-band-box-1')).toHaveTextContent('car lane');
    expect(screen.getByTestId('road-band-box-2')).toHaveTextContent('sidewalk');
    expect(screen.getByTestId('road-band-box-0')).toHaveTextContent('▶');
  });

  it('keeps CityJSON and backend actions in one disclosure that starts closed', () => {
    renderPanel();

    const disclosure = screen.getByTestId('cityjson-export-backend');
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('CityJSON Export & Backend'));
    expect(disclosure).toHaveAttribute('open');
  });

  it('offers an explicit road-edit cancel action', () => {
    const onCancelEdit = vi.fn();
    renderPanel(vi.fn(), { onCancelEdit });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel road edit' }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('labels updates to an existing road and only enables save after a change', () => {
    const { unmount } = renderPanel(vi.fn(), { editingRoadId: 'road-1' });
    expect(screen.getByRole('button', { name: 'Save road changes' })).toBeDisabled();
    unmount();

    renderPanel(vi.fn(), { editingRoadId: 'road-1', draftDirty: true });
    expect(screen.getByRole('button', { name: 'Save road changes' })).toBeEnabled();
    expect(screen.getByText('Unsaved changes to road-1')).toBeInTheDocument();
  });

  it('stores user-selected vertical placement on the road draft', () => {
    const onDraftChange = vi.fn();
    renderPanel(onDraftChange);

    fireEvent.change(screen.getByLabelText('Vertical position'), {
      target: { value: 'underground' },
    });

    const [nextDraft] = onDraftChange.mock.calls[0] as [RoadDraft];
    expect(nextDraft.vertical).toMatchObject({
      placement: 'underground',
      source: 'user',
    });
  });

  it('does not expose the inactive trusted-corridor workflow', () => {
    renderPanel();

    expect(screen.queryByText('Trusted road corridor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Load trusted corridor GeoJSON')).not.toBeInTheDocument();
  });

  it('reorders band indices when a band box is dropped onto another', () => {
    const onDraftChange = vi.fn();
    renderPanel(onDraftChange);
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(screen.getByTestId('road-band-box-0'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('road-band-box-2'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('road-band-box-2'), { dataTransfer });

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    const [nextDraft] = onDraftChange.mock.calls[0] as [RoadDraft];
    expect(nextDraft.sections[0].bands.map((band) => band.kind)).toEqual([
      'car_lane',
      'sidewalk',
      'bike_lane',
    ]);
  });

  it('shows osm2streets lane inspection and triggers draft creation', () => {
    const onCreateDraftFromOsm2StreetsSelection = vi.fn();
    const onInsertOsm2StreetsSelection = vi.fn();
    renderPanel(vi.fn(), {
      onCreateDraftFromOsm2StreetsSelection,
      onInsertOsm2StreetsSelection,
      osm2streetsSelection: {
        kind: 'lane',
        feature: {
          type: 'Feature',
          properties: {
            road: 42,
            index: 1,
            type: 'Biking',
            direction: 'Forward',
            width: 1.75,
            speed_limit: 'None',
            allowed_turns: ['left'],
            osm_way_ids: [3100],
          },
          geometry: null,
        },
      },
    });

    expect(screen.getByText('osm2streets lane')).toBeInTheDocument();
    expect(screen.getByText('Biking')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create editable road draft' }));
    expect(onCreateDraftFromOsm2StreetsSelection).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Insert exact CityJSON surfaces' }));
    expect(onInsertOsm2StreetsSelection).toHaveBeenCalledTimes(1);
  });

  it('shows selected imported CityJSON road-surface metadata', () => {
    const onEditSelectedRoadArea = vi.fn();
    const selectedRoadArea: RoadArea = {
        id: 'surface-1',
        roadId: 'osm2streets-road-7',
        sectionId: 'section-1',
        bandId: 'band-1',
        surfaceIndex: 0,
        surfaceType: 'TrafficArea',
        function: 'driving_lane',
        polygon: [],
        attributes: {
          sourceType: 'Driving',
          osm2streetsRoadId: '7',
          osm2streetsLaneIndex: 2,
          trafficDirection: 'forward',
          allowedModes: ['car'],
          osmWayIds: ['3100'],
          osm2streetsPropertiesJson: '{"type":"Driving","width":3}',
        },
      };
    renderPanel(vi.fn(), {
      selectedRoadArea,
      onEditSelectedRoadArea,
    });

    expect(screen.getByText('CityJSON road surface')).toBeInTheDocument();
    expect(screen.getByText('osm2streets-road-7')).toBeInTheDocument();
    expect(screen.getByText('Driving')).toBeInTheDocument();
    expect(screen.getByText('road 7, lane 2')).toBeInTheDocument();
    expect(screen.getByText('3100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create editable layout' }));
    expect(onEditSelectedRoadArea).toHaveBeenCalledWith(selectedRoadArea);
  });

  it('offers editing when an imported CityJSON road carries a saved layout', () => {
    const onEditSelectedRoadArea = vi.fn();
    const selectedRoadArea: RoadArea = {
      id: 'surface-1',
      roadId: 'road-with-layout',
      sectionId: 'section-1',
      bandId: 'band-1',
      surfaceIndex: 0,
      surfaceType: 'TrafficArea',
      function: 'driving_lane',
      polygon: [],
      editableDraft: draft,
      attributes: {},
    };
    renderPanel(vi.fn(), {
      selectedRoadArea,
      onEditSelectedRoadArea,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit saved layout' }));

    expect(onEditSelectedRoadArea).toHaveBeenCalledWith(selectedRoadArea);
  });

  it('shows osm2streets intersection inspection and triggers connected-road highlight', () => {
    const onHighlightConnectedOsm2StreetsRoads = vi.fn();
    renderPanel(vi.fn(), {
      onHighlightConnectedOsm2StreetsRoads,
      osm2streetsSelection: {
        kind: 'intersection',
        feature: {
          type: 'Feature',
          properties: {
            id: 2,
            type: 'intersection',
            intersection_kind: 'Connection',
            control: 'Uncontrolled',
            osm_node_ids: [12, 13],
          },
          geometry: null,
        },
      },
    });

    expect(screen.getByText('osm2streets intersection')).toBeInTheDocument();
    expect(screen.getByText('Connection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Highlight connected roads' }));
    expect(onHighlightConnectedOsm2StreetsRoads).toHaveBeenCalledTimes(1);
  });
});
