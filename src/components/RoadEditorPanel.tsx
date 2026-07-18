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
  Maximize2,
  Minimize2,
  PencilLine,
  Road,
  Route,
  Satellite,
  Scissors,
  Send,
  Trash2,
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
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import Osm2StreetsInspector from './Osm2StreetsInspector';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  osmRoads: OsmRoadFeature[];
  selectedOsmRoadId: string | null;
  draft: RoadDraft | null;
  draftDirty: boolean;
  exactGeometryStatus?: 'preserved' | 'changed' | null;
  editingRoadId?: string | null;
  status: string | null;
  basemap: 'map' | 'satellite';
  drawMode: 'none' | 'polygon' | 'road-line';
  backendUrl: string;
  insertedRoadId?: string | null;
  roadFitConflicts?: RoadFitConflict[];
  roadFitPending?: boolean;
  selectedRoadArea?: RoadArea | null;
  osm2streetsSelection?: Osm2StreetsSelection;
  onClose: () => void;
  onFetchOsmRoads: () => void;
  onBasemapChange: (basemap: 'map' | 'satellite') => void;
  onStartManualDraw: () => void;
  onFinishManualDraw: () => void;
  onCancelDraw: () => void;
  onCancelEdit: () => void;
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
  draftDirty,
  exactGeometryStatus = null,
  editingRoadId = null,
  status,
  basemap,
  drawMode,
  backendUrl,
  insertedRoadId,
  roadFitConflicts = [],
  roadFitPending = false,
  selectedRoadArea = null,
  osm2streetsSelection = null,
  onClose,
  onFetchOsmRoads,
  onStartManualDraw,
  onFinishManualDraw,
  onCancelDraw,
  onCancelEdit,
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
}: Props) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);
  const [dropBandIndex, setDropBandIndex] = useState<number | null>(null);
  const [activeBandIndex, setActiveBandIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [newBandKind, setNewBandKind] = useState<RoadBandKind>('car_lane');
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

  useEffect(() => {
    if (!activeSection?.bands.length) {
      setActiveBandIndex(0);
      return;
    }
    setActiveBandIndex((index) => Math.min(index, activeSection.bands.length - 1));
  }, [activeSection]);

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
  const activeBand = activeSection?.bands[activeBandIndex] ?? null;
  const connectionCount = draft?.sections.reduce(
    (count, section) =>
      count + Number(!!section.connections?.start) + Number(!!section.connections?.end),
    0
  ) ?? 0;

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
    setActiveBandIndex((index) => Math.max(0, Math.min(index, activeSection.bands.length - 2)));
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
    if (activeBandIndex === fromIndex) setActiveBandIndex(toIndex);
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
    setActiveBandIndex(activeSection.bands.length);
  };

  return (
    <aside
      className={`road-editor-panel ${expanded ? 'is-expanded' : ''} ${drawMode === 'road-line' ? 'is-drawing' : ''}`}
      data-testid="road-editor-panel"
    >
      <header className="road-editor-panel__header">
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
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Use compact road editor' : 'Expand road editor'}
            title={expanded ? 'Use compact width' : 'Make editor wider'}
          >
            {expanded ? (
              <Minimize2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11"
            onClick={onClose}
            aria-label="Close road editor"
            title="Close road editor"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {drawMode === 'road-line' && (
        <div className="road-editor-draw-bar" role="status">
          <div>
            <b>Tap the road on the map</b>
            <span>Add points wherever it bends, then finish.</span>
          </div>
          <div>
            <Button className="h-12" variant="primary" onClick={onFinishManualDraw}>
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Finish road
            </Button>
            <Button className="h-12" variant="warn" onClick={onCancelDraw}>
              <X className="h-5 w-5" aria-hidden="true" /> Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="road-editor-panel__metrics grid grid-cols-3 gap-1 border-b border-[rgba(148,163,184,0.14)] bg-[rgba(0,0,0,0.16)] px-3 py-2">
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
            roadFitPending
              ? 'checking…'
              : roadFitTone === 'error'
              ? `${blockingFitConflicts.length} block`
              : warningFitConflicts > 0
                ? `${warningFitConflicts} warn`
                : 'clear'
          }
          sub={roadFitPending ? 'while you shape' : carLaneCount || bikeLaneCount ? `${carLaneCount} car / ${bikeLaneCount} bike` : 'preview'}
          tone={roadFitPending ? 'neutral' : roadFitTone}
        />
      </div>

      <div className="road-editor-panel__scroll">
        <nav className="road-editor-steps" aria-label="Road editing steps">
          <span className={draft ? 'is-done' : 'is-active'}><b>1</b>Choose</span>
          <span className={draft ? 'is-active' : ''}><b>2</b>Shape</span>
          <span className={draft ? 'is-active' : ''}><b>3</b>Lanes</span>
          <span><b>4</b>Save</span>
        </nav>

        <section className="road-editor-card">
          <PanelSectionHeader
            icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
            title="1 · Choose a road"
            meta={selectedOsm ? selectedOsm.tags.name ?? selectedOsm.id : `${osmRoads.length} OSM segments`}
          />
          <p className="road-editor-card__help">
            Load detailed osm2streets roads for what you can see, then tap a road. Or draw a
            centreline yourself while comparing it with the imagery.
          </p>
          <div className="road-source-actions">
            <Button variant="primary" className="road-touch-action" onClick={onFetchOsmRoads}>
              <Route className="h-5 w-5" aria-hidden="true" />
              <span>
                <b>{osmRoads.length > 0 ? 'Refresh visible roads' : 'Load visible roads'}</b>
                <small>osm2streets lanes and junctions</small>
              </span>
            </Button>
            {drawMode !== 'road-line' && (
              <Button className="road-touch-action" onClick={onStartManualDraw}>
                <PencilLine className="h-5 w-5" aria-hidden="true" />
                <span><b>{draft ? 'Redraw centreline' : 'Draw a road'}</b><small>tap points along every bend</small></span>
              </Button>
            )}
          </div>
          <div className="road-map-layers-hint">
            {basemap === 'satellite' ? <Satellite aria-hidden="true" /> : <Map aria-hidden="true" />}
            <span>
              {basemap === 'satellite' ? 'Satellite comparison is on.' : 'Map view is on.'}{' '}
              Use <b>Map layers</b> in the lower-left of the map to switch and blend imagery
              against road surfaces.
            </span>
          </div>
          {status && <StatusCard>{status}</StatusCard>}
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
          <section className="road-editor-card space-y-4">
            <PanelSectionHeader
              icon={<Road className="h-3.5 w-3.5" aria-hidden="true" />}
              title="2 · Shape and connect"
              meta={draft.name ?? draft.source}
            />
            <div className="road-shape-summary">
              <div>
                <b>{summarizeRoadDraft(draft)}</b>
                <span>{activeSection.centerlineWgs84.length} curve anchors · {activeTotalWidth.toFixed(2)} m wide</span>
              </div>
              <span className={connectionCount > 0 ? 'is-connected' : ''}>
                {connectionCount > 0 ? `${connectionCount} joins confirmed` : 'No joins yet'}
              </span>
            </div>

            {exactGeometryStatus && (
              <div
                className={`road-geometry-preservation is-${exactGeometryStatus}`}
                role="status"
              >
                {exactGeometryStatus === 'preserved' ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                )}
                <div>
                  <b>
                    {exactGeometryStatus === 'preserved'
                      ? 'Exact source polygons protected'
                      : 'Saving will rebuild this road'}
                  </b>
                  <span>
                    {exactGeometryStatus === 'preserved'
                      ? 'Type, direction, surface, access and speed update without moving any osm2streets vertices.'
                      : 'A handle, width, band order/count, split or curve changed. Save will create editable smooth ribbons.'}
                  </span>
                </div>
              </div>
            )}

            <div className="road-handle-explainer" data-testid="road-centerline-drag-hint">
              <div><i className="road-guide-dot road-guide-dot--anchor" /><span><b>Yellow anchor</b>Drag it to bend the smooth road.</span></div>
              <div><i className="road-guide-dot road-guide-dot--add">+</i><span><b>White +</b>Tap or drag to add another bend.</span></div>
              <div><i className="road-guide-dot road-guide-dot--snap" /><span><b>Teal join</b>Drag a yellow end onto it to connect roads.</span></div>
              <p
                className="col-span-full m-0 text-[11px] leading-5 text-[var(--text-dim)]"
              >
                Press and hold a point, then drag. The point stays attached until release, including
                with a finger or trackpad.
              </p>
            </div>

            <div className="road-curve-control">
              <div className="road-curve-control__header">
                <div><b>Road curve</b><span>The saved CityJSON follows this same shape.</span></div>
                <div className="road-curve-control__modes" role="group" aria-label="Road curve mode">
                  <button
                    type="button"
                    className={(activeSection.curve?.mode ?? 'smooth') === 'smooth' ? 'is-active' : ''}
                    onClick={() =>
                      updateSection(activeSection.id, (section) => ({
                        ...section,
                        curve: { mode: 'smooth', strength: section.curve?.strength ?? 0.72 },
                      }))
                    }
                  >Smooth</button>
                  <button
                    type="button"
                    className={activeSection.curve?.mode === 'straight' ? 'is-active' : ''}
                    onClick={() =>
                      updateSection(activeSection.id, (section) => ({
                        ...section,
                        curve: { mode: 'straight', strength: section.curve?.strength ?? 0.72 },
                      }))
                    }
                  >Straight</button>
                </div>
              </div>
              <label>
                <span>Curve strength</span>
                <output>{Math.round((activeSection.curve?.strength ?? 0.72) * 100)}%</output>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  disabled={activeSection.curve?.mode === 'straight'}
                  value={activeSection.curve?.strength ?? 0.72}
                  aria-label="Road curve strength"
                  onChange={(event) =>
                    updateSection(activeSection.id, (section) => ({
                      ...section,
                      curve: {
                        mode: section.curve?.mode ?? 'smooth',
                        strength: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              {activeSection.centerlineWgs84.length < 3 && (
                <p>Two anchors make a straight span. Tap the white + on the map to add a bend.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {draft.sections.length > 1 && (
                <label className="col-span-2 block text-[11px]">
                  <span className="mb-1 block text-[var(--text-dim)]">Active section</span>
                  <select
                    value={activeSection.id}
                    onChange={(event) => setActiveSectionId(event.target.value)}
                    className="h-12 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
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
                  className="h-12"
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
                  className="h-12 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
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
                    className="h-12"
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

            <div className="road-section-split">
              <div>
                <b>Does the lane layout change along this road?</b>
                <span>Split here, then give each section its own lanes and widths.</span>
              </div>
              <label>
                <span>Split at</span>
                <input
                  type="range"
                  min={5}
                  max={95}
                  step={1}
                  value={splitPercent}
                  aria-label="Road section split position"
                  onChange={(event) => setSplitPercent(Number(event.target.value))}
                />
                <output>{splitPercent}%</output>
              </label>
              <Button
                className="h-11"
                disabled={!activeSection}
                onClick={() => activeSection && onSplitDraft(activeSection.id, splitPercent / 100)}
              >
                <Scissors className="h-4 w-4" aria-hidden="true" /> Create two editable sections
              </Button>
            </div>

            <div className="road-lane-editor">
              <PanelSectionHeader
                icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
                title="3 · Lanes and roadside"
                meta="left to right on the map"
              />
              <p className="road-editor-card__help">
                This cross-section uses the same semantic colours as the road on the map. Tap a
                band to edit one clear set of controls.
              </p>
              <div
                data-testid="road-band-order-strip"
                className="road-cross-section"
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
                    onClick={() => setActiveBandIndex(index)}
                    aria-pressed={activeBandIndex === index}
                    className={`road-cross-section__band ${
                      draggingBandIndex === index
                        ? 'is-dragging'
                        : dropBandIndex === index
                          ? 'is-drop-target'
                          : ''
                    } ${activeBandIndex === index ? 'is-active' : ''
                    }`}
                    style={{
                      flexGrow: Math.max(0.8, band.widthM),
                      background: bandBoxBackground(band.kind, band.sourceType),
                      color: bandBoxTextColor(band.kind, band.sourceType),
                    }}
                    title={`Band ${index + 1}: ${labelBand(band.kind, band.sourceType)} (${band.widthM} m)`}
                    aria-label={`Band ${index + 1}: ${labelBand(band.kind, band.sourceType)}, ${band.widthM} metres`}
                  >
                    <span className="flex items-center gap-1 text-[10px] opacity-80">
                      <GripVertical className="h-3 w-3" aria-hidden="true" />
                      #{index + 1}
                    </span>
                    <span className="mt-1 block truncate text-xs">{labelBand(band.kind, band.sourceType)}</span>
                    <span className="flex items-center justify-between gap-1 text-[10px] opacity-80">
                      <span>{band.widthM} m</span>
                      <span aria-hidden="true">{directionArrow(band.direction)}</span>
                    </span>
                  </button>
                ))}
              </div>

              {activeBand && (
                <div className="road-band-detail">
                  <div className="road-band-detail__heading">
                    <span
                      style={{
                        background: bandBoxBackground(activeBand.kind, activeBand.sourceType),
                        color: bandBoxTextColor(activeBand.kind, activeBand.sourceType),
                      }}
                    >{activeBandIndex + 1}</span>
                    <div><b>{labelBand(activeBand.kind, activeBand.sourceType)}</b><small>Edit this map band</small></div>
                  </div>

                  <label className="road-field">
                    <span>Band type</span>
                    <select
                      value={activeBand.sourceType ? '__source__' : activeBand.kind}
                      onChange={(event) => {
                        const kind = event.target.value as RoadBandKind;
                        updateBand(activeBandIndex, {
                          kind,
                          sourceType: undefined,
                          direction:
                            kind === 'car_lane' || kind === 'bike_lane'
                              ? activeBand.direction ?? 'forward'
                              : 'none',
                          allowedModes: defaultModes(kind),
                        });
                      }}
                      className="h-12 w-full"
                    >
                      {activeBand.sourceType && (
                        <option value="__source__" disabled>
                          {labelBand(activeBand.kind, activeBand.sourceType)} (source)
                        </option>
                      )}
                      {BAND_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {labelBand(kind)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="road-field">
                    <span>Surface material</span>
                    <select
                      className="h-12 w-full"
                      value={activeBand.surface ?? defaultSurface(activeBand.kind)}
                      onChange={(event) =>
                        updateBand(activeBandIndex, { surface: event.target.value })
                      }
                    >
                      <option value="asphalt">Asphalt</option>
                      <option value="concrete">Concrete</option>
                      <option value="paving_stones">Paving stones</option>
                      <option value="compacted">Compacted</option>
                      <option value="gravel">Gravel</option>
                      <option value="grass">Grass</option>
                    </select>
                  </label>

                  <label className="road-width-control">
                    <span>Width</span>
                    <output>{activeBand.widthM.toFixed(2)} m</output>
                    <input
                      type="range"
                      min={0.4}
                      max={12}
                      step={0.05}
                      value={activeBand.widthM}
                      aria-label={`${labelBand(activeBand.kind, activeBand.sourceType)} width`}
                      onChange={(event) =>
                        updateBand(activeBandIndex, { widthM: Number(event.target.value) })
                      }
                    />
                    <Input
                      className="h-12"
                      type="number"
                      min={0.4}
                      max={12}
                      step={0.05}
                      value={activeBand.widthM}
                      onChange={(event) =>
                        updateBand(activeBandIndex, {
                          widthM: Math.max(
                            0.4,
                            Number(event.target.value) || DEFAULT_WIDTH[activeBand.kind]
                          ),
                        })
                      }
                    />
                  </label>

                  <fieldset className="road-direction-control">
                    <legend>Direction</legend>
                    <div>
                      {DIRECTIONS.map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          className={(activeBand.direction ?? 'none') === direction ? 'is-active' : ''}
                          onClick={() => updateBand(activeBandIndex, { direction })}
                        >{directionArrow(direction)} <span>{direction}</span></button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="road-band-actions">
                    <button
                      type="button"
                      disabled={activeBandIndex === 0}
                      onClick={() => reorderBand(activeBandIndex, activeBandIndex - 1)}
                    >Move left</button>
                    <button
                      type="button"
                      disabled={activeBandIndex === activeSection.bands.length - 1}
                      onClick={() => reorderBand(activeBandIndex, activeBandIndex + 1)}
                    >Move right</button>
                    <button
                      type="button"
                      className="is-destructive"
                      onClick={() => removeBand(activeBandIndex)}
                      disabled={activeSection.bands.length <= 1}
                      aria-label={`Remove ${labelBand(activeBand.kind, activeBand.sourceType)} band`}
                    ><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</button>
                  </div>
                </div>
              )}

              <div className="road-add-band">
                <label>
                  <span>Add another band</span>
                  <select
                    value={newBandKind}
                    onChange={(event) => setNewBandKind(event.target.value as RoadBandKind)}
                  >
                    {BAND_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{labelBand(kind)}</option>
                    ))}
                  </select>
                </label>
                <Button className="h-12" onClick={() => addBand(newBandKind)}>
                  {newBandKind === 'bike_lane' ? <Bike aria-hidden="true" /> :
                    newBandKind === 'sidewalk' ? <Footprints aria-hidden="true" /> :
                      <Car aria-hidden="true" />}
                  Add band
                </Button>
              </div>
            </div>

            <details
              data-testid="cityjson-export-backend"
              className="road-advanced-disclosure"
            >
              <summary>
                Advanced · <span>CityJSON Export &amp; Backend</span>
              </summary>
              <div className="mt-2 space-y-2">
                <Button className="h-11 w-full" onClick={onExportPayload}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Export edit payload
                </Button>
                <Input
                  className="h-11"
                  value={backendUrl}
                  onChange={(event) => onBackendUrlChange(event.target.value)}
                  placeholder="http://127.0.0.1:8787/api/roads"
                />
                <Button className="h-11 w-full" onClick={onPostPayload}>
                  <Send className="h-4 w-4" aria-hidden="true" />
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
      {draft && (
        <footer className="road-editor-footer">
          <div className="road-editor-footer__status">
            <b>
              {editingRoadId
                ? draftDirty
                  ? `Unsaved changes to ${editingRoadId}`
                  : `Editing ${editingRoadId}`
                : 'New road draft'}
            </b>
            <span>
              {roadFitPending
                ? 'Updating fit check…'
                : blockingFitConflicts.length > 0
                  ? `${blockingFitConflicts.length} blocking conflict${blockingFitConflicts.length === 1 ? '' : 's'}`
                  : exactGeometryStatus === 'preserved'
                    ? 'Ready to update attributes on the exact polygons'
                    : exactGeometryStatus === 'changed'
                      ? 'Ready to save rebuilt editable geometry'
                      : 'Ready to save as editable CityJSON'}
            </span>
          </div>
          <div className="road-editor-footer__actions">
            <Button
              variant="outline"
              className="h-12"
              onClick={onCancelEdit}
              aria-label="Cancel road edit"
              title="Discard this road draft and leave the saved CityJSON unchanged"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Discard
            </Button>
            <Button
              variant="primary"
              className="h-12"
              onClick={onInsertRoad}
              disabled={
                roadFitPending ||
                blockingFitConflicts.length > 0 ||
                (!!editingRoadId && !draftDirty)
              }
              title={
                blockingFitConflicts.length > 0
                  ? 'Resolve road-fit building overlaps before saving.'
                  : editingRoadId && !draftDirty
                    ? 'Change the road layout before saving.'
                    : undefined
              }
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              {exactGeometryStatus === 'preserved'
                ? 'Save exact attributes'
                : editingRoadId
                  ? 'Save road changes'
                  : 'Save new road'}
            </Button>
          </div>
        </footer>
      )}
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
      <Button size="sm" className="mt-2 w-full" onClick={() => onEdit(area)}>
        <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
        {area.geometryMode === 'exact'
          ? 'Edit exact road'
          : area.editableDraft
            ? 'Edit saved layout'
            : 'Create editable layout'}
      </Button>
      {area.geometryMode === 'exact' && (
        <p className="mt-1.5 text-[10px] leading-snug text-[var(--text-faint)]">
          Attribute edits preserve these exact polygons. Only moving handles, changing width,
          reordering or adding bands, splitting, or changing the curve rebuilds editable ribbons.
        </p>
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

function defaultSurface(kind: RoadBandKind): string {
  return kind === 'green' ? 'grass' : 'asphalt';
}

function directionArrow(direction: RoadDirection | undefined): string {
  if (direction === 'forward') return '▶';
  if (direction === 'backward') return '◀';
  if (direction === 'both') return '◀▶';
  return '•';
}

function labelBand(kind: RoadBandKind, sourceType?: string): string {
  switch (normalizeLaneType(sourceType)) {
    case 'bus':
    case 'buslane':
      return 'bus lane';
    case 'lightrail':
    case 'tram':
      return 'light rail';
    case 'construction':
      return 'construction';
    case 'footway':
      return 'footway';
    case 'shareduse':
    case 'shared':
      return 'shared path';
    case 'shoulder':
      return 'shoulder';
    default:
      break;
  }
  return kind.replaceAll('_', ' ');
}

function bandBoxBackground(kind: RoadBandKind, sourceType?: string): string {
  switch (normalizeLaneType(sourceType)) {
    case 'bus':
    case 'buslane':
      return 'linear-gradient(180deg, #ac3a3a 0%, #7d2929 100%)';
    case 'lightrail':
    case 'tram':
      return 'linear-gradient(180deg, #805634 0%, #603f26 100%)';
    case 'construction':
      return 'linear-gradient(180deg, #da8434 0%, #aa6124 100%)';
    case 'shareduse':
    case 'shared':
      return 'linear-gradient(180deg, #909a52 0%, #6e773d 100%)';
    case 'footway':
      return 'linear-gradient(180deg, #d7dae1 0%, #b9bec8 100%)';
    default:
      break;
  }
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

function bandBoxTextColor(kind: RoadBandKind, sourceType?: string): string {
  const semantic = normalizeLaneType(sourceType);
  return kind === 'sidewalk' && semantic !== 'shareduse' && semantic !== 'shared'
    ? '#111827'
    : '#ffffff';
}

function normalizeLaneType(value?: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
