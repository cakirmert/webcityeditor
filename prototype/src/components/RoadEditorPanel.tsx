import { useEffect, useMemo, useState } from 'react';
import {
  buildRoadEditPayload,
  summarizeRoadDraft,
  type OsmRoadFeature,
  type RoadBand,
  type RoadBandKind,
  type RoadDirection,
  type RoadDraft,
} from '../lib/transportation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  osmRoads: OsmRoadFeature[];
  selectedOsmRoadId: string | null;
  draft: RoadDraft | null;
  status: string | null;
  basemap: 'map' | 'satellite';
  drawMode: 'none' | 'polygon' | 'road-line';
  backendUrl: string;
  insertedRoadId?: string | null;
  onClose: () => void;
  onFetchOsmRoads: () => void;
  onBasemapChange: (basemap: 'map' | 'satellite') => void;
  onStartManualDraw: () => void;
  onFinishManualDraw: () => void;
  onCancelDraw: () => void;
  onDraftChange: (draft: RoadDraft) => void;
  onSplitDraft: (sectionId: string, fraction: number) => void;
  onInsertRoad: () => void;
  onExportPayload: () => void;
  onPostPayload: () => void;
  onBackendUrlChange: (url: string) => void;
}

const BAND_KINDS: RoadBandKind[] = [
  'car_lane',
  'bike_lane',
  'sidewalk',
  'parking',
  'median',
  'green',
];
const DIRECTIONS: RoadDirection[] = ['forward', 'backward', 'both', 'none'];

const DEFAULT_WIDTH: Record<RoadBandKind, number> = {
  car_lane: 3.25,
  bike_lane: 1.75,
  sidewalk: 2,
  parking: 2.1,
  median: 1,
  green: 1,
};

export default function RoadEditorPanel({
  osmRoads,
  selectedOsmRoadId,
  draft,
  status,
  basemap,
  drawMode,
  backendUrl,
  insertedRoadId,
  onClose,
  onFetchOsmRoads,
  onBasemapChange,
  onStartManualDraw,
  onFinishManualDraw,
  onCancelDraw,
  onDraftChange,
  onSplitDraft,
  onInsertRoad,
  onExportPayload,
  onPostPayload,
  onBackendUrlChange,
}: Props) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const activeSection = useMemo(() => {
    if (!draft) return null;
    return (
      draft.sections.find((section) => section.id === activeSectionId) ??
      draft.sections[0] ??
      null
    );
  }, [draft, activeSectionId]);

  useEffect(() => {
    if (!draft?.sections.length) {
      setActiveSectionId(null);
      return;
    }
    if (!activeSectionId || !draft.sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(draft.sections[0].id);
    }
  }, [draft, activeSectionId]);

  const selectedOsm = osmRoads.find((road) => road.id === selectedOsmRoadId);
  const payloadPreview = draft
    ? JSON.stringify(buildRoadEditPayload(draft, insertedRoadId ?? undefined), null, 2)
    : '';

  const updateSection = (
    sectionId: string,
    updater: (section: RoadDraft['sections'][number]) => RoadDraft['sections'][number]
  ) => {
    if (!draft) return;
    onDraftChange({
      ...draft,
      sections: draft.sections.map((section) =>
        section.id === sectionId ? updater(section) : section
      ),
    });
  };

  const updateBand = (bandIndex: number, patch: Partial<RoadBand>) => {
    if (!activeSection || !draft) return;
    updateSection(activeSection.id, (section) => ({
      ...section,
      bands: section.bands.map((band, index) =>
        index === bandIndex ? { ...band, ...patch } : band
      ),
    }));
  };

  const removeBand = (bandIndex: number) => {
    if (!activeSection || activeSection.bands.length <= 1) return;
    updateSection(activeSection.id, (section) => ({
      ...section,
      bands: section.bands.filter((_, index) => index !== bandIndex),
    }));
  };

  const addBand = (kind: RoadBandKind) => {
    if (!activeSection) return;
    const direction: RoadDirection =
      kind === 'car_lane' || kind === 'bike_lane' ? 'forward' : 'none';
    updateSection(activeSection.id, (section) => ({
      ...section,
      bands: [
        ...section.bands,
        {
          id: `${kind}-${section.bands.length + 1}`,
          kind,
          widthM: DEFAULT_WIDTH[kind],
          direction,
          allowedModes: defaultModes(kind),
          maxspeedKmh:
            kind === 'car_lane' ? section.maxspeedKmh ?? 50 : undefined,
        },
      ],
    }));
  };

  return (
    <aside className="absolute left-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-[390px] max-w-[calc(100%-24px)] flex-col rounded-lg border border-[var(--border)] bg-[rgba(31,35,47,0.94)] text-xs text-[var(--text)] shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div>
          <div className="text-sm font-semibold">Road editor</div>
          <div className="text-[10px] text-[var(--text-dim)]">
            OSM is a reference. Export stores CityJSON Transportation.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close road editor"
          className="rounded px-2 py-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          x
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="primary" onClick={onFetchOsmRoads}>
              Fetch / Recalculate View
            </Button>
            <Button
              size="sm"
              variant={basemap === 'satellite' ? 'primary' : 'outline'}
              onClick={() => onBasemapChange(basemap === 'satellite' ? 'map' : 'satellite')}
            >
              {basemap === 'satellite' ? 'Satellite ON' : 'Satellite'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {drawMode === 'road-line' ? (
              <>
                <Button size="sm" variant="primary" onClick={onFinishManualDraw}>
                  Finish road
                </Button>
                <Button size="sm" variant="warn" onClick={onCancelDraw}>
                  Cancel road draw
                </Button>
              </>
            ) : (
              <>
              <Button size="sm" onClick={onStartManualDraw}>
                Draw / redraw road
              </Button>
                <Button
                  size="sm"
                  disabled={!activeSection}
                  onClick={() => activeSection && onSplitDraft(activeSection.id, splitPercent / 100)}
                  title="Split the active road section at this percentage along its centerline."
                >
                  Split {splitPercent}%
                </Button>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
            Split position
            <Input
              type="number"
              min={1}
              max={99}
              step={1}
              value={splitPercent}
              onChange={(event) =>
                setSplitPercent(Math.max(1, Math.min(99, Number(event.target.value) || 50)))
              }
              className="w-20"
            />
            %
          </label>
          <div className="text-[11px] text-[var(--text-faint)]">
            {osmRoads.length} OSM road segment{osmRoads.length === 1 ? '' : 's'} loaded.
            {selectedOsm ? ` Selected: ${selectedOsm.tags.name ?? selectedOsm.id}.` : ''}
          </div>
          {status && (
            <div className="rounded border border-[var(--border)] bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[11px] text-[var(--text-dim)]">
              {status}
            </div>
          )}
        </section>

        {draft && activeSection ? (
          <section className="space-y-2 border-t border-[var(--border)] pt-3">
            <div>
              <Label>Draft summary</Label>
              <div className="mt-1 rounded bg-[rgba(0,0,0,0.18)] px-2 py-1 text-[11px]">
                {draft.name ?? draft.source} - {summarizeRoadDraft(draft)}
              </div>
            </div>

            {draft.sections.length > 1 && (
              <label className="block text-[11px]">
                <span className="mb-1 block text-[var(--text-dim)]">Active section</span>
                <select
                  value={activeSection.id}
                  onChange={(event) => setActiveSectionId(event.target.value)}
                  className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs"
                >
                  {draft.sections.map((section, index) => (
                    <option key={section.id} value={section.id}>
                      Section {index + 1}: {section.centerlineWgs84.length} points
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid grid-cols-[90px_1fr] items-center gap-2 text-[11px]">
              <span className="text-[var(--text-dim)]">Speed limit</span>
              <Input
                type="number"
                min={5}
                max={140}
                step={5}
                value={activeSection.maxspeedKmh ?? ''}
                onChange={(event) => {
                  const raw = event.target.value;
                  updateSection(activeSection.id, (section) => ({
                    ...section,
                    maxspeedKmh: raw === '' ? null : Number(raw),
                    bands: section.bands.map((band) =>
                      band.kind === 'car_lane'
                        ? { ...band, maxspeedKmh: raw === '' ? null : Number(raw) }
                        : band
                    ),
                  }));
                }}
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Road bands, left to right</Label>
                <span className="text-[10px] text-[var(--text-faint)]">
                  widths in metres
                </span>
              </div>
              {activeSection.bands.map((band, index) => (
                <div
                  key={`${band.id ?? band.kind}-${index}`}
                  className="grid grid-cols-[1fr_64px_82px_26px] items-center gap-1"
                >
                  <select
                    value={band.kind}
                    onChange={(event) => {
                      const kind = event.target.value as RoadBandKind;
                      updateBand(index, {
                        kind,
                        widthM: DEFAULT_WIDTH[kind],
                        direction:
                          kind === 'car_lane' || kind === 'bike_lane'
                            ? band.direction ?? 'forward'
                            : 'none',
                        allowedModes: defaultModes(kind),
                      });
                    }}
                    className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs"
                  >
                    {BAND_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {labelBand(kind)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0.4}
                    max={12}
                    step={0.05}
                    value={band.widthM}
                    onChange={(event) =>
                      updateBand(index, {
                        widthM: Math.max(0.4, Number(event.target.value) || DEFAULT_WIDTH[band.kind]),
                      })
                    }
                  />
                  <select
                    value={band.direction ?? 'none'}
                    onChange={(event) =>
                      updateBand(index, { direction: event.target.value as RoadDirection })
                    }
                    className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs"
                  >
                    {DIRECTIONS.map((direction) => (
                      <option key={direction} value={direction}>
                        {direction}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeBand(index)}
                    disabled={activeSection.bands.length <= 1}
                    title="Remove band"
                    className="h-7 rounded border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                  >
                    -
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" onClick={() => addBand('bike_lane')}>
                  + Bike
                </Button>
                <Button size="sm" onClick={() => addBand('sidewalk')}>
                  + Sidewalk
                </Button>
                <Button size="sm" onClick={() => addBand('car_lane')}>
                  + Car
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border)] pt-3">
              <Button size="sm" variant="primary" onClick={onInsertRoad}>
                Insert CityJSON Road
              </Button>
              <Button size="sm" onClick={onExportPayload}>
                Export payload
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Backend endpoint</Label>
              <Input
                value={backendUrl}
                onChange={(event) => onBackendUrlChange(event.target.value)}
                placeholder="http://127.0.0.1:8787/api/roads"
              />
              <Button size="sm" className="w-full" onClick={onPostPayload}>
                POST payload
              </Button>
            </div>

            <details>
              <summary className="cursor-pointer text-[11px] text-[var(--text-dim)]">
                Payload preview
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-[rgba(0,0,0,0.24)] p-2 text-[10px] text-[var(--text-faint)]">
                {payloadPreview}
              </pre>
            </details>
          </section>
        ) : (
          <section className="rounded border border-dashed border-[var(--border)] p-3 text-[11px] text-[var(--text-dim)]">
            Fetch OSM roads, click a road segment, then confirm whether the OSM lane
            interpretation matches the satellite image. Use Draw / redraw road when OSM is wrong.
          </section>
        )}
      </div>
    </aside>
  );
}

function defaultModes(kind: RoadBandKind): string[] {
  if (kind === 'bike_lane') return ['bicycle'];
  if (kind === 'sidewalk') return ['pedestrian'];
  if (kind === 'car_lane' || kind === 'parking') return ['car'];
  return [];
}

function labelBand(kind: RoadBandKind): string {
  return kind.replaceAll('_', ' ');
}
