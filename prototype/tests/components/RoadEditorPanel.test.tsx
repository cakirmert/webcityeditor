import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import RoadEditorPanel from '../../src/components/RoadEditorPanel';
import type { RoadDraft } from '../../src/lib/transportation';

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
    onCreateDraftFromOsm2StreetsSelection?: () => void;
  } = {}
) {
  const onCreateDraftFromOsm2StreetsSelection =
    options.onCreateDraftFromOsm2StreetsSelection ?? vi.fn();
  render(
    <RoadEditorPanel
      osmRoads={[]}
      selectedOsmRoadId={null}
      draft={draft}
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
      onDraftChange={onDraftChange}
      onSplitDraft={() => {}}
      onInsertRoad={() => {}}
      onExportPayload={() => {}}
      onPostPayload={() => {}}
      onBackendUrlChange={() => {}}
      osm2streetsSelection={options.osm2streetsSelection}
      onCreateDraftFromOsm2StreetsSelection={onCreateDraftFromOsm2StreetsSelection}
      onClearOsm2StreetsSelection={() => {}}
    />
  );
  return { onDraftChange, onCreateDraftFromOsm2StreetsSelection };
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
    renderPanel(vi.fn(), {
      onCreateDraftFromOsm2StreetsSelection,
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
  });
});
