import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  Download,
  Footprints,
  GripVertical,
  Map,
  PencilLine,
  Road,
  Route,
  Satellite,
  Scissors,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildRoadEditPayload,
  roadVerticalProfileForDraft,
  summarizeRoadDraft,
  type OsmRoadFeature,
  type RoadArea,
  type RoadBand,
  type RoadBandKind,
  type RoadDirection,
  type RoadDraft,
  type RoadVerticalPlacement,
} from '../lib/transportation';
import type { RoadFitConflict } from '../lib/road-fit';
import type { RoadAllowedCorridor } from '../lib/road-corridor';
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import Osm2StreetsInspector from './Osm2StreetsInspector';
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
  roadFitConflicts?: RoadFitConflict[];
  allowedCorridors?: RoadAllowedCorridor[];
  selectedRoadArea?: RoadArea | null;
  osm2streetsSelection?: Osm2StreetsSelection;
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
  onEditSelectedRoadArea: (area: RoadArea) => void;
  onCreateDraftFromOsm2StreetsSelection: () => void;
  onInsertOsm2StreetsSelection: () => void;
  onHighlightConnectedOsm2StreetsRoads: () => void;
  onClearOsm2StreetsSelection: () => void;
  onLoadCorridorFile: (file: File) => void | Promise<void>;
  onClearCorridors: () => void;
  onFitDraftToCorridors: () => void;
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
  roadFitConflicts = [],
  allowedCorridors = [],
  selectedRoadArea = null,
  osm2streetsSelection = null,
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
  onEditSelectedRoadArea,
  onCreateDraftFromOsm2StreetsSelection,
  onInsertOsm2StreetsSelection,
  onHighlightConnectedOsm2StreetsRoads,
  onClearOsm2StreetsSelection,
  onLoadCorridorFile,
  onClearCorridors,
  onFitDraftToCorridors,
}: Props) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);
  const [dropBandIndex, setDropBandIndex] = useState<number | null>(null);
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
  const blockingFitConflicts = roadFitConflicts.filter(
    (conflict) => conflict.severity === 'error'
  );
  const warningFitConflicts = roadFitConflicts.length - blockingFitConflicts.length;
  const activeTotalWidth = activeSection
    ? activeSection.bands.reduce((sum, band) => sum + band.widthM, 0)
    : 0;
  const draftBandCount = activeSection?.bands.length ?? 0;
  const carLaneCount = activeSection?.bands.filter((band) => band.kind === 'car_lane').length ?? 0;
  const bikeLaneCount =
    activeSection?.bands.filter((band) => band.kind === 'bike_lane').length ?? 0;
  const roadFitTone =
    blockingFitConflicts.length > 0 ? 'error' : roadFitConflicts.length > 0 ? 'warn' : 'ok';
  const sourceLabel = selectedOsm
    ? selectedOsm.tags.name ?? selectedOsm.id
    : osm2streetsSelection
      ? 'osm2streets selection'
      : draft
        ? draft.source
        : 'none';
  const verticalProfile = draft ? roadVerticalProfileForDraft(draft) : null;

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

  const reorderBand = (fromIndex: number, toIndex: number) => {
    if (!activeSection || fromIndex === toIndex) return;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= activeSection.bands.length ||
      toIndex >= activeSection.bands.length
    ) {
      return;
    }
    updateSection(activeSection.id, (section) => {
      const bands = [...section.bands];
      const [moved] = bands.splice(fromIndex, 1);
      bands.splice(toIndex, 0, moved);
      return { ...section, bands };
    });
  };

  const handleBandDragStart = (
    event: DragEvent<HTMLButtonElement>,
    index: number
  ) => {
    setDraggingBandIndex(index);
    setDropBandIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleBandDrop = (
    event: DragEvent<HTMLButtonElement>,
    index: number
  ) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const fromIndex = Number(raw);
    if (Number.isInteger(fromIndex)) reorderBand(fromIndex, index);
    setDraggingBandIndex(null);
    setDropBandIndex(null);
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
    <aside className="absolute left-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-[430px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-lg border border-[rgba(148,163,184,0.22)] bg-[rgba(18,22,31,0.96)] text-xs text-[var(--text)] shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(148,163,184,0.18)] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[rgba(255,255,255,0.12)] bg-[rgba(76,126,255,0.16)] text-[var(--accent-hover)]">
            <Road className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-sm font-semibold leading-tight">Road editor</h2>
              <span className="rounded bg-[rgba(76,126,255,0.14)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent-hover)]">
                Transportation
              </span>
            </div>
            <div className="mt-1 truncate text-[10px] text-[var(--text-faint)]">
              Source: {sourceLabel}
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Close road editor"
          title="Close road editor"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-1 border-b border-[rgba(148,163,184,0.14)] bg-[rgba(0,0,0,0.16)] px-3 py-2">
        <MetricPill
          icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
          label="OSM"
          value={String(osmRoads.length)}
          sub="segments"
        />
        <MetricPill
          icon={<Road className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Draft"
          value={draft ? `${draftBandCount} bands` : 'none'}
          sub={activeSection ? `${activeTotalWidth.toFixed(1)} m` : 'not selected'}
        />
        <MetricPill
          icon={
            roadFitTone === 'error' ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )
          }
          label="Fit"
          value={
            roadFitTone === 'error'
              ? `${blockingFitConflicts.length} block`
              : warningFitConflicts > 0
                ? `${warningFitConflicts} warn`
                : 'clear'
          }
          sub={carLaneCount || bikeLaneCount ? `${carLaneCount} car / ${bikeLaneCount} bike` : 'preview'}
          tone={roadFitTone}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section className="space-y-2 rounded-md border border-[rgba(148,163,184,0.16)] bg-[rgba(255,255,255,0.035)] p-2.5">
          <PanelSectionHeader
            icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Source"
            meta={selectedOsm ? selectedOsm.tags.name ?? selectedOsm.id : `${osmRoads.length} OSM segments`}
          />
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <Button size="sm" variant="primary" onClick={onFetchOsmRoads}>
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              Fetch / Recalculate View
            </Button>
            <Button
              size="icon"
              variant={basemap === 'satellite' ? 'primary' : 'outline'}
              onClick={() => onBasemapChange(basemap === 'satellite' ? 'map' : 'satellite')}
              aria-label={basemap === 'satellite' ? 'Switch to map basemap' : 'Switch to satellite basemap'}
              title={basemap === 'satellite' ? 'Map basemap' : 'Satellite basemap'}
            >
              {basemap === 'satellite' ? (
                <Map className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Satellite className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_112px] gap-1.5">
            {drawMode === 'road-line' ? (
              <>
                <Button size="sm" variant="primary" onClick={onFinishManualDraw}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Finish road
                </Button>
                <Button size="sm" variant="warn" onClick={onCancelDraw}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={onStartManualDraw}>
                  <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                  Draw / redraw road
                </Button>
                <Button
                  size="sm"
                  disabled={!activeSection}
                  onClick={() => activeSection && onSplitDraft(activeSection.id, splitPercent / 100)}
                  title="Split the active road section"
                >
                  <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                  Split {splitPercent}%
                </Button>
              </>
            )}
          </div>
          <label className="grid grid-cols-[88px_1fr_18px] items-center gap-2 text-[11px] text-[var(--text-dim)]">
            <span>Split position</span>
            <Input
              type="number"
              min={1}
              max={99}
              step={1}
              value={splitPercent}
              onChange={(event) =>
                setSplitPercent(Math.max(1, Math.min(99, Number(event.target.value) || 50)))
              }
            />
            <span>%</span>
          </label>
          {status && <StatusCard>{status}</StatusCard>}
        </section>

        <section className="space-y-2 rounded-md border border-[rgba(45,212,191,0.24)] bg-[rgba(20,184,166,0.06)] p-2.5">
          <PanelSectionHeader
            icon={<Footprints className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Trusted road corridor"
            meta={allowedCorridors.length > 0 ? `${allowedCorridors.length} polygon${allowedCorridors.length === 1 ? '' : 's'}` : 'not loaded'}
          />
          <p className="m-0 text-[10px] leading-snug text-[var(--text-faint)]">
            Load user-approved WGS84 GeoJSON. Road surfaces outside its boundary are highlighted and blocked.
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[11px] font-medium hover:bg-[var(--surface-3)]">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Load corridor GeoJSON
              <input
                className="sr-only"
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                aria-label="Load trusted corridor GeoJSON"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void onLoadCorridorFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {allowedCorridors.length > 0 && (
              <Button size="sm" variant="outline" onClick={onClearCorridors}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
          {allowedCorridors.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={onFitDraftToCorridors}
              disabled={!draft}
              title={draft ? 'Proportionally reduce band widths without moving the centerline.' : 'Create or select an editable road draft first.'}
            >
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              Fit draft widths to corridor
            </Button>
          )}
        </section>

        {roadFitConflicts.length > 0 && (
          <FitConflictCard
            conflicts={roadFitConflicts}
            blockingCount={blockingFitConflicts.length}
          />
        )}

        <Osm2StreetsInspector
          selection={osm2streetsSelection}
          onCreateDraft={onCreateDraftFromOsm2StreetsSelection}
          onInsertCityJson={onInsertOsm2StreetsSelection}
          onHighlightConnectedRoads={onHighlightConnectedOsm2StreetsRoads}
          onClear={onClearOsm2StreetsSelection}
        />
        {selectedRoadArea && (
          <SelectedRoadAreaCard area={selectedRoadArea} onEdit={onEditSelectedRoadArea} />
        )}

        {draft && activeSection ? (
          <section className="space-y-3 rounded-md border border-[rgba(148,163,184,0.16)] bg-[rgba(255,255,255,0.035)] p-2.5">
            <PanelSectionHeader
              icon={<Road className="h-3.5 w-3.5" aria-hidden="true" />}
              title="Draft"
              meta={draft.name ?? draft.source}
            />
            <div className="rounded-md border border-[rgba(148,163,184,0.14)] bg-[rgba(0,0,0,0.18)] px-2.5 py-2">
              <div className="text-[11px] font-medium">{summarizeRoadDraft(draft)}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[var(--text-faint)]">
                <span>{activeSection.centerlineWgs84.length} points</span>
                <span>{activeTotalWidth.toFixed(2)} m total</span>
                <span>{activeSection.maxspeedKmh ?? 'n/a'} km/h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {draft.sections.length > 1 && (
                <label className="col-span-2 block text-[11px]">
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

              <label className="block text-[11px]">
                <span className="mb-1 block text-[var(--text-dim)]">Speed limit</span>
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

              <label className="block text-[11px]">
                <span className="mb-1 block text-[var(--text-dim)]">Vertical position</span>
                <select
                  aria-label="Vertical position"
                  value={verticalProfile?.placement ?? 'surface'}
                  onChange={(event) => {
                    if (!draft || !verticalProfile) return;
                    const placement = event.target.value as RoadVerticalPlacement;
                    onDraftChange({
                      ...draft,
                      vertical: {
                        ...verticalProfile,
                        placement,
                        source: 'user',
                        ...(placement === 'surface' ? { elevationM: undefined } : {}),
                      },
                    });
                  }}
                  className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs"
                >
                  <option value="surface">Surface</option>
                  <option value="underground">Underground</option>
                  <option value="elevated">Elevated</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>

              {verticalProfile && verticalProfile.placement !== 'surface' && (
                <label className="col-span-2 block text-[11px]">
                  <span className="mb-1 flex items-center justify-between gap-2 text-[var(--text-dim)]">
                    <span>Absolute road elevation</span>
                    <span className="text-[10px] text-[var(--text-faint)]">metres; optional</span>
                  </span>
                  <Input
                    aria-label="Absolute road elevation"
                    type="number"
                    step={0.1}
                    value={verticalProfile.elevationM ?? ''}
                    onChange={(event) => {
                      if (!draft) return;
                      const raw = event.target.value;
                      onDraftChange({
                        ...draft,
                        vertical: {
                          ...verticalProfile,
                          source: 'user',
                          elevationM: raw === '' ? undefined : Number(raw),
                        },
                      });
                    }}
                    placeholder="Unknown - keep overlap as a warning"
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lane order</Label>
                <span className="text-[10px] text-[var(--text-faint)]">widths in metres</span>
              </div>
              <div
                data-testid="road-band-order-strip"
                className="flex gap-1 overflow-x-auto rounded-md border border-[rgba(148,163,184,0.18)] bg-[rgba(0,0,0,0.26)] p-1"
              >
                {activeSection.bands.map((band, index) => (
                  <button
                    key={`${band.id ?? band.kind}-${index}-strip`}
                    type="button"
                    draggable
                    data-testid={`road-band-box-${index}`}
                    onDragStart={(event) => handleBandDragStart(event, index)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropBandIndex(index);
                    }}
                    onDrop={(event) => handleBandDrop(event, index)}
                    onDragEnd={() => {
                      setDraggingBandIndex(null);
                      setDropBandIndex(null);
                    }}
                    className={`min-h-16 min-w-[76px] flex-1 cursor-grab rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold shadow-sm transition active:cursor-grabbing ${
                      draggingBandIndex === index
                        ? 'border-[var(--accent)] opacity-55'
                        : dropBandIndex === index
                          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                          : 'border-[rgba(255,255,255,0.18)]'
                    }`}
                    style={{
                      flexGrow: Math.max(0.8, band.widthM),
                      background: bandBoxBackground(band.kind),
                      color: bandBoxTextColor(band.kind),
                    }}
                    title={`Band ${index + 1}: ${labelBand(band.kind)} (${band.widthM} m)`}
                    aria-label={`Band ${index + 1}: ${labelBand(band.kind)}, ${band.widthM} metres`}
                  >
                    <span className="flex items-center gap-1 text-[9px] opacity-80">
                      <GripVertical className="h-3 w-3" aria-hidden="true" />
                      #{index + 1}
                    </span>
                    <span className="mt-0.5 block truncate">{labelBand(band.kind)}</span>
                    <span className="flex items-center justify-between gap-1 text-[9px] opacity-80">
                      <span>{band.widthM} m</span>
                      <span aria-hidden="true">{directionArrow(band.direction)}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                {activeSection.bands.map((band, index) => (
                  <div
                    key={`${band.id ?? band.kind}-${index}`}
                    className="grid grid-cols-[1fr_64px_86px_30px] items-center gap-1"
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
                      aria-label={`Remove ${labelBand(band.kind)} band`}
                      className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" onClick={() => addBand('bike_lane')}>
                  <Bike className="h-3.5 w-3.5" aria-hidden="true" />
                  Bike
                </Button>
                <Button size="sm" onClick={() => addBand('sidewalk')}>
                  <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
                  Sidewalk
                </Button>
                <Button size="sm" onClick={() => addBand('car_lane')}>
                  <Car className="h-3.5 w-3.5" aria-hidden="true" />
                  Car
                </Button>
              </div>
            </div>

            <details
              data-testid="cityjson-export-backend"
              className="rounded-md border border-[rgba(148,163,184,0.14)] bg-[rgba(0,0,0,0.16)] px-2 py-1.5"
            >
              <summary className="cursor-pointer text-[11px] font-medium text-[var(--text-dim)]">
                CityJSON Export &amp; Backend
              </summary>
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={onInsertRoad}
                    disabled={blockingFitConflicts.length > 0}
                    title={
                      blockingFitConflicts.length > 0
                        ? 'Resolve road-fit building overlaps before inserting.'
                        : undefined
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Insert CityJSON Road
                  </Button>
                  <Button size="sm" onClick={onExportPayload}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Export payload
                  </Button>
                </div>
                <Input
                  value={backendUrl}
                  onChange={(event) => onBackendUrlChange(event.target.value)}
                  placeholder="http://127.0.0.1:8787/api/roads"
                />
                <Button size="sm" className="w-full" onClick={onPostPayload}>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  POST payload
                </Button>
                <details>
                  <summary className="cursor-pointer text-[11px] text-[var(--text-dim)]">
                    Payload preview
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-[rgba(0,0,0,0.24)] p-2 text-[10px] text-[var(--text-faint)]">
                    {payloadPreview}
                  </pre>
                </details>
              </div>
            </details>
          </section>
        ) : (
          <section className="rounded-md border border-dashed border-[rgba(148,163,184,0.24)] bg-[rgba(255,255,255,0.025)] p-3 text-[11px] text-[var(--text-dim)]">
            Waiting for OSM road, osm2streets lane, or manual centerline.
          </section>
        )}
      </div>
    </aside>
  );
}

function PanelSectionHeader({
  icon,
  title,
  meta,
}: {
  icon: ReactNode;
  title: string;
  meta?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-[var(--text-faint)]">{icon}</span>
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          {title}
        </h3>
      </div>
      {meta && <span className="truncate text-[10px] text-[var(--text-faint)]">{meta}</span>}
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'error';
}) {
  const toneClass =
    tone === 'error'
      ? 'border-red-400/35 bg-red-500/10 text-red-100'
      : tone === 'warn'
        ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
        : tone === 'ok'
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
          : 'border-[rgba(148,163,184,0.16)] bg-[rgba(255,255,255,0.035)] text-[var(--text)]';
  return (
    <div className={`min-w-0 rounded-md border px-2 py-1.5 ${toneClass}`}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] font-semibold leading-tight">{value}</div>
      <div className="truncate text-[10px] opacity-65">{sub}</div>
    </div>
  );
}

function StatusCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-[rgba(148,163,184,0.16)] bg-[rgba(0,0,0,0.18)] px-2.5 py-2 text-[11px] leading-snug text-[var(--text-dim)]">
      {children}
    </div>
  );
}

function FitConflictCard({
  conflicts,
  blockingCount,
}: {
  conflicts: RoadFitConflict[];
  blockingCount: number;
}) {
  return (
    <section className="rounded-md border border-red-400/35 bg-red-500/10 p-2.5 text-[11px] text-red-100">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Road fit {blockingCount > 0 ? 'blocked' : 'warnings'}</span>
        </div>
        <span className="rounded bg-red-950/30 px-1.5 py-0.5 text-[10px]">
          {conflicts.length}
        </span>
      </div>
      <ul className="space-y-1">
        {conflicts.slice(0, 4).map((conflict) => (
          <li key={conflict.id} className="grid grid-cols-[38px_1fr] gap-1.5">
            <span className="text-red-100/70">
              {conflict.severity === 'error' ? 'Block' : 'Warn'}
            </span>
            <span>{conflict.label}</span>
          </li>
        ))}
      </ul>
      {conflicts.length > 4 && (
        <div className="mt-1.5 text-red-100/70">
          +{conflicts.length - 4} more conflict{conflicts.length - 4 === 1 ? '' : 's'}
        </div>
      )}
    </section>
  );
}

function SelectedRoadAreaCard({ area, onEdit }: { area: RoadArea; onEdit: (area: RoadArea) => void }) {
  const attrs = area.attributes;
  const osmWayIds = Array.isArray(attrs.osmWayIds)
    ? attrs.osmWayIds.map(String).join(', ')
    : attrs.osmWayIds
      ? String(attrs.osmWayIds)
      : 'none';
  const modes = Array.isArray(attrs.allowedModes)
    ? attrs.allowedModes.map(String).join(', ')
    : attrs.allowedModes
      ? String(attrs.allowedModes)
      : 'none';
  const provenance =
    typeof attrs.osm2streetsPropertiesJson === 'string'
      ? attrs.osm2streetsPropertiesJson
      : null;

  return (
    <div className="rounded border border-[var(--border)] bg-[rgba(0,0,0,0.2)] p-2 text-[11px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold">CityJSON road surface</span>
        <span className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">
          {area.surfaceType}
        </span>
      </div>
      <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
        <dt className="text-[var(--text-dim)]">road</dt>
        <dd className="truncate">{area.roadId}</dd>
        <dt className="text-[var(--text-dim)]">function</dt>
        <dd>{area.function}</dd>
        <dt className="text-[var(--text-dim)]">source type</dt>
        <dd>{stringAttr(attrs.sourceType) ?? 'unknown'}</dd>
        <dt className="text-[var(--text-dim)]">osm2streets</dt>
        <dd>
          road {stringAttr(attrs.osm2streetsRoadId) ?? 'n/a'}, lane{' '}
          {stringAttr(attrs.osm2streetsLaneIndex) ?? 'n/a'}
        </dd>
        <dt className="text-[var(--text-dim)]">direction</dt>
        <dd>{stringAttr(attrs.trafficDirection) ?? 'none'}</dd>
        <dt className="text-[var(--text-dim)]">modes</dt>
        <dd>{modes}</dd>
        <dt className="text-[var(--text-dim)]">OSM ways</dt>
        <dd className="break-words">{osmWayIds}</dd>
      </dl>
      {area.editableDraft && (
        <Button size="sm" className="mt-2 w-full" onClick={() => onEdit(area)}>
          <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
          Edit saved layout
        </Button>
      )}
      {provenance && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-[var(--text-dim)]">
            osm2streets properties JSON
          </summary>
          <pre className="mt-1 max-h-28 overflow-auto rounded bg-[rgba(0,0,0,0.28)] p-1 text-[10px] leading-snug">
            {provenance}
          </pre>
        </details>
      )}
    </div>
  );
}

function stringAttr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function defaultModes(kind: RoadBandKind): string[] {
  if (kind === 'bike_lane') return ['bicycle'];
  if (kind === 'sidewalk') return ['pedestrian'];
  if (kind === 'car_lane' || kind === 'parking') return ['car'];
  return [];
}

function directionArrow(direction: RoadDirection | undefined): string {
  if (direction === 'forward') return '▶';
  if (direction === 'backward') return '◀';
  if (direction === 'both') return '◀▶';
  return '•';
}

function labelBand(kind: RoadBandKind): string {
  return kind.replaceAll('_', ' ');
}

function bandBoxBackground(kind: RoadBandKind): string {
  switch (kind) {
    case 'car_lane':
      return 'linear-gradient(180deg, #4a4d57 0%, #343741 100%)';
    case 'bike_lane':
      return 'linear-gradient(180deg, #16844c 0%, #0f6539 100%)';
    case 'sidewalk':
      return 'linear-gradient(180deg, #d6dbe3 0%, #aeb6c2 100%)';
    case 'parking':
      return 'linear-gradient(180deg, #7b7f8a 0%, #5f6370 100%)';
    case 'median':
      return 'linear-gradient(180deg, #8f8f9a 0%, #70707b 100%)';
    case 'green':
      return 'linear-gradient(180deg, #3e8d5d 0%, #2d6f49 100%)';
    default:
      return 'linear-gradient(180deg, #4a4d57 0%, #343741 100%)';
  }
}

function bandBoxTextColor(kind: RoadBandKind): string {
  return kind === 'sidewalk' ? '#111827' : '#ffffff';
}
