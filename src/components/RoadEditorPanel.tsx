import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  Download,
  Footprints,
  GripVertical,
  Maximize2,
  Minimize2,
  PencilLine,
  Road,
  Route,
  Redo2,
  Scissors,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  buildRoadEditPayload,
  removeRoadBandFromDraft,
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
import type { RoadFitReview } from '../lib/road-fit-review';
import type { BasemapMode } from '../lib/basemap';
import type { Osm2StreetsSelection } from '../lib/osm2streets';
import Osm2StreetsInspector from './Osm2StreetsInspector';
import RoadRulesPanel from './RoadRulesPanel';
import RoadSectionPreview from './RoadSectionPreview';
import RoadConnectionsPanel from './RoadConnectionsPanel';
import RoadJunctionPanel from './RoadJunctionPanel';
import { canAcceptRoadRuleWarning, roadWidthRule, type RoadRuleIssue } from '../lib/road-rules';
import { roadDisplayName } from '../lib/road-labels';
import type { RoadEditorState } from '../hooks/useRoadEditor';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  roadAreas?: RoadArea[];
  roadRuleIssues?: RoadRuleIssue[];
  junction?: Pick<RoadEditorState, 'junctionDraft' | 'junctionPlan' | 'junctionDirty' | 'junctionConflicts' | 'junctionSaveError' | 'handleJunctionChange' | 'handleSaveJunction' | 'handleCancelJunction' | 'handleCreateJunction' | 'handleUndoJunction' | 'handleRedoJunction' | 'canUndoJunction' | 'canRedoJunction' | 'junctionSource' | 'setJunctionSource' | 'junctionEditTool' | 'setJunctionEditTool'>;
  osmRoads: OsmRoadFeature[];
  selectedOsmRoadId: string | null;
  draft: RoadDraft | null;
  draftDirty: boolean;
  exactGeometryStatus?: 'preserved' | 'changed' | null;
  editingRoadId?: string | null;
  status: string | null;
  basemap: BasemapMode;
  satelliteOpacity: number;
  roadOverlayOpacity: number;
  cityJsonRoadCount: number;
  cityJsonJunctionCount?: number;
  drawMode: 'none' | 'polygon' | 'road-line';
  backendUrl: string;
  insertedRoadId?: string | null;
  roadFitConflicts?: RoadFitConflict[];
  roadFitPending?: boolean;
  savedFitReview?: RoadFitReview | null;
  onSaveRoadWithWarnings?: () => void;
  parkedDrafts?: Array<{ id: string; name: string; kind: string }>;
  onResumeDraft?: (id: string) => void;
  selectedRoadArea?: RoadArea | null;
  selectedRoadBand?: { sectionId: string; bandIndex: number } | null;
  osm2streetsSelection?: Osm2StreetsSelection;
  canUndoDraft: boolean;
  canRedoDraft: boolean;
  undoDraftLabel?: string;
  redoDraftLabel?: string;
  onClose: () => void;
  onBasemapChange: (basemap: BasemapMode) => void;
  onSatelliteOpacityChange: (opacity: number) => void;
  onRoadOverlayOpacityChange: (opacity: number) => void;
  onStartManualDraw: () => void;
  onFinishManualDraw: () => void;
  onCancelDraw: () => void;
  onCancelEdit: () => void;
  onDraftChange: (draft: RoadDraft, label?: string, historyGroup?: string) => void;
  onUndoDraft: () => void;
  onRedoDraft: () => void;
  onSplitDraft: (sectionId: string, fraction: number) => void;
  onInsertRoad: () => void;
  onExportPayload: () => void;
  onPostPayload: () => void;
  onBackendUrlChange: (url: string) => void;
  onEditSelectedRoadArea: (area: RoadArea) => void;
  onDeleteSelectedRoadArea: (area: RoadArea) => void;
  onRoadBandSelect?: (
    selection: { sectionId: string; bandIndex: number } | null
  ) => void;
  onEditOsm2StreetsSelection: () => void;
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
  roadAreas = [],
  roadRuleIssues = [],
  junction,
  draft,
  draftDirty,
  exactGeometryStatus = null,
  editingRoadId = null,
  status,
  cityJsonRoadCount,
  cityJsonJunctionCount = 0,
  drawMode,
  backendUrl,
  insertedRoadId,
  roadFitConflicts = [],
  roadFitPending = false,
  savedFitReview,
  onSaveRoadWithWarnings,
  parkedDrafts = [],
  onResumeDraft,
  selectedRoadArea = null,
  selectedRoadBand = null,
  osm2streetsSelection = null,
  canUndoDraft,
  canRedoDraft,
  undoDraftLabel,
  redoDraftLabel,
  onClose,
  onBasemapChange,
  onSatelliteOpacityChange,
  onRoadOverlayOpacityChange,
  onStartManualDraw,
  onFinishManualDraw,
  onCancelDraw,
  onCancelEdit,
  onDraftChange,
  onUndoDraft,
  onRedoDraft,
  onSplitDraft,
  onInsertRoad,
  onExportPayload,
  onPostPayload,
  onBackendUrlChange,
  onEditSelectedRoadArea,
  onDeleteSelectedRoadArea,
  onRoadBandSelect,
  onEditOsm2StreetsSelection,
  onClearOsm2StreetsSelection,
}: Props) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingBandIndex, setDraggingBandIndex] = useState<number | null>(null);
  const [dropBandIndex, setDropBandIndex] = useState<number | null>(null);
  const [activeBandIndex, setActiveBandIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const traceCollapsed = useRef(false);
  useEffect(() => {
    const tracing = junction?.junctionEditTool?.startsWith('trace-');
    if (tracing && window.innerWidth < 768) {
      traceCollapsed.current = true; setCollapsed(true);
    } else if (!tracing && traceCollapsed.current) {
      traceCollapsed.current = false; setCollapsed(false);
    }
  }, [junction?.junctionEditTool]);
  const [activeTab, setActiveTab] = useState('lanes');
  const [roadSearch, setRoadSearch] = useState('');
  const searchResults = useMemo(() => {
    const query = roadSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    const firstAreas = [...new Map(roadAreas.map(area => [area.roadId, area])).values()];
    return firstAreas.filter(area => `${area.attributes.roadName ?? ''} ${area.roadId}`.toLocaleLowerCase().includes(query)).slice(0, 10);
  }, [roadAreas, roadSearch]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) { scrollRef.current.scrollTop = 0; scrollRef.current.scrollLeft = 0; } }, [activeTab, draft?.id, junction?.junctionDraft?.id]);
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

  useEffect(() => {
    if (!selectedRoadBand) return;
    const section = draft?.sections.find(
      (candidate) => candidate.id === selectedRoadBand.sectionId
    );
    if (!section?.bands[selectedRoadBand.bandIndex]) return;
    setActiveSectionId(section.id);
    setActiveBandIndex(selectedRoadBand.bandIndex);
  }, [draft, selectedRoadBand]);

  const payloadPreview = draft
    ? JSON.stringify(buildRoadEditPayload(draft, insertedRoadId ?? undefined), null, 2)
    : '';
  const blockingFitConflicts = roadFitConflicts.filter(
    (conflict) => conflict.severity === 'error'
  );
  const blockingRuleCount = roadRuleIssues.filter(issue => issue.severity === 'error' && !(onSaveRoadWithWarnings && draft && canAcceptRoadRuleWarning(issue, draft))).length;
  const designWarnings = roadRuleIssues.filter(issue => draft && canAcceptRoadRuleWarning(issue, draft)).map((issue, i) => ({ id: `rule-${i}`, label: issue.message, severity: issue.severity }));
  const visibleRoadWarnings = [...roadFitConflicts, ...designWarnings];
  const tabs = ['lanes', 'shape', 'connections', 'rules'];
  const warningFitConflicts = roadFitConflicts.length - blockingFitConflicts.length;
  const activeTotalWidth = activeSection
    ? activeSection.bands.reduce((sum, band) => sum + band.widthM, 0)
    : 0;
  const draftBandCount = activeSection?.bands.length ?? 0;
  const verticalProfile = draft ? roadVerticalProfileForDraft(draft) : null;
  const activeBand = activeSection?.bands[activeBandIndex] ?? null;
  const connectionCount = draft?.sections.reduce(
    (count, section) =>
      count + Number(!!section.connections?.start) + Number(!!section.connections?.end),
    0
  ) ?? 0;

  const updateSection = (
    sectionId: string,
    updater: (section: RoadDraft['sections'][number]) => RoadDraft['sections'][number],
    label = 'Edit road',
    historyGroup?: string
  ) => {
    if (!draft) return;
    onDraftChange(
      {
        ...draft,
        sections: draft.sections.map((section) =>
          section.id === sectionId ? updater(section) : section
        ),
      },
      label,
      historyGroup
    );
  };

  const updateBand = (bandIndex: number, patch: Partial<RoadBand>) => {
    if (!activeSection || !draft) return;
    const changedFields = Object.keys(patch).sort().join('-');
    updateSection(
      activeSection.id,
      (section) => ({
        ...section,
        bands: section.bands.map((band, index) =>
          index === bandIndex ? { ...band, ...patch } : band
        ),
      }),
      'Change road band',
      `band-${activeSection.id}-${bandIndex}-${changedFields}`
    );
  };

  const removeBand = (bandIndex: number) => {
    if (!activeSection || !draft || activeSection.bands.length <= 1) return;
    onDraftChange(
      removeRoadBandFromDraft(draft, activeSection.id, bandIndex),
      'Remove road band'
    );
    const nextBandIndex =
      bandIndex < activeBandIndex
        ? activeBandIndex - 1
        : Math.max(
            0,
            Math.min(activeBandIndex, activeSection.bands.length - 2)
          );
    setActiveBandIndex(nextBandIndex);
    onRoadBandSelect?.({
      sectionId: activeSection.id,
      bandIndex: nextBandIndex,
    });
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
    const nextActiveBandIndex =
      activeBandIndex === fromIndex
        ? toIndex
        : fromIndex < activeBandIndex && toIndex >= activeBandIndex
          ? activeBandIndex - 1
          : fromIndex > activeBandIndex && toIndex <= activeBandIndex
            ? activeBandIndex + 1
            : activeBandIndex;
    if (nextActiveBandIndex !== activeBandIndex) {
      setActiveBandIndex(nextActiveBandIndex);
      onRoadBandSelect?.({
        sectionId: activeSection.id,
        bandIndex: nextActiveBandIndex,
      });
    }
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
          id: `${kind}-${crypto.randomUUID()}`,
          kind,
          widthM: roadWidthRule({ kind, direction, widthM: 0 }, draft?.ruleProfile).recommendedM,
          direction,
          allowedModes: defaultModes(kind),
          maxspeedKmh:
            kind === 'car_lane' ? section.maxspeedKmh ?? 50 : undefined,
        },
      ],
    }));
    setActiveBandIndex(activeSection.bands.length);
    onRoadBandSelect?.({
      sectionId: activeSection.id,
      bandIndex: activeSection.bands.length,
    });
  };

  return (
    <aside
      className={`road-editor-panel ${expanded ? 'is-expanded' : ''} ${collapsed ? 'is-collapsed' : ''} ${drawMode === 'road-line' ? 'is-drawing' : ''} ${!draft && !junction?.junctionDraft ? 'is-browse' : 'is-editing'} ${junction?.junctionDraft ? 'is-junction' : ''}`}
      data-testid="road-editor-panel"
    >
      <header className="road-editor-panel__header">
        <div className="studio-heading"><span className="studio-eyebrow">{junction?.junctionDraft ? 'INTERSECTION' : draft ? 'ROAD DESIGN' : 'STREET WORKSPACE'}</span><h2>{junction?.junctionDraft?.name ?? draft?.name ?? 'Roads & intersections'}</h2></div>
        <div className="flex items-center gap-1">
          <button type="button" className="road-panel-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Show road controls' : 'Minimize road controls'} aria-expanded={!collapsed}>{collapsed ? 'Show' : 'Hide'}</button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="road-editor-expand h-11 w-11"
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

      <div className="road-editor-quick-status" role="status">
        <span><b>{cityJsonRoadCount.toLocaleString()}</b> roads · <b>{cityJsonJunctionCount.toLocaleString()}</b> junctions</span>
        {draft && <span><b>{draftBandCount}</b> bands · {activeTotalWidth.toFixed(1)} m</span>}
        {roadFitPending ? (
          <span>Checking fit…</span>
        ) : blockingFitConflicts.length + blockingRuleCount > 0 ? (
          <span className="is-error"><b>{blockingFitConflicts.length + blockingRuleCount}</b> conflicts</span>
        ) : warningFitConflicts > 0 ? (
          <span className="is-warning"><b>{warningFitConflicts}</b> warnings</span>
        ) : draft ? (
          <span className="is-ok">Fit clear</span>
        ) : null}
      </div>

      <div className="road-editor-history" role="toolbar" aria-label="Road edit history">
        <div>
          <b>Road edit history</b>
          <span>Changes are recorded automatically</span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={junction?.junctionDraft ? junction.handleUndoJunction : onUndoDraft}
          disabled={junction?.junctionDraft ? !junction.canUndoJunction : !canUndoDraft}
          aria-label={
            junction?.junctionDraft ? 'Undo intersection edit' : canUndoDraft && undoDraftLabel
              ? `Undo road edit: ${undoDraftLabel}`
              : 'Undo road edit'
          }
          title={
            junction?.junctionDraft ? junction.canUndoJunction ? 'Undo intersection edit (Ctrl+Z)' : 'Nothing to undo' : canUndoDraft ? `Undo ${undoDraftLabel ?? 'last road edit'} (Ctrl+Z)` : 'Nothing to undo'
          }
        >
          <Undo2 className="h-5 w-5" aria-hidden="true" /> Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={junction?.junctionDraft ? junction.handleRedoJunction : onRedoDraft}
          disabled={junction?.junctionDraft ? !junction.canRedoJunction : !canRedoDraft}
          aria-label={
            junction?.junctionDraft ? 'Redo intersection edit' : canRedoDraft && redoDraftLabel
              ? `Redo road edit: ${redoDraftLabel}`
              : 'Redo road edit'
          }
          title={
            junction?.junctionDraft ? junction.canRedoJunction ? 'Redo intersection edit (Ctrl+Shift+Z)' : 'Nothing to redo' : canRedoDraft
              ? `Redo ${redoDraftLabel ?? 'last road edit'} (Ctrl+Shift+Z)`
              : 'Nothing to redo'
          }
        >
          <Redo2 className="h-5 w-5" aria-hidden="true" /> Redo
        </Button>
      </div>

      {draft && <div className="road-inspector-tabs" role="tablist" aria-label="Road editing tools">
        {tabs.map((tab, index) => <button key={tab} id={`road-tab-${tab}`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`road-view-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={(e) => {
          const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
          if (next >= 0) { e.preventDefault(); setActiveTab(tabs[next]); document.getElementById(`road-tab-${tabs[next]}`)?.focus(); }
        }}>{tab[0].toUpperCase() + tab.slice(1)}{tab === 'rules' && blockingRuleCount > 0 ? ` (${blockingRuleCount})` : ''}</button>)}
      </div>}
      <div className="road-editor-panel__scroll" ref={scrollRef}>
        {status && !junction?.junctionDraft && <details className="road-inspector-notice" open={/blocked|unable|cannot|failed|invalid|needs|before.*saving/i.test(status)}><summary>Status</summary><div role="status">{status}</div></details>}
        {junction?.junctionSaveError && <div className="studio-feedback is-error" role="alert"><AlertTriangle size={17} /><p>{junction.junctionSaveError}</p></div>}
        <section className="road-editor-card" id="road-view-map" role={draft ? 'tabpanel' : undefined} aria-labelledby={draft ? 'road-tab-map' : undefined} hidden={!!junction?.junctionDraft || (!!draft && activeTab !== 'map')}>
          <PanelSectionHeader
            icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Roads"
            meta={`${cityJsonRoadCount.toLocaleString()} roads + ${cityJsonJunctionCount.toLocaleString()} junctions in CityJSON`}
          />
          <p className="road-editor-card__help">
            <b>Click an intersection to edit its boundary and turns.</b> Select a road to change its lanes or connect its ends.
          </p>
          <div className="road-source-actions">
            {drawMode !== 'road-line' && (
              <Button variant="primary" className="road-touch-action" onClick={onStartManualDraw}>
                <PencilLine className="h-5 w-5" aria-hidden="true" />
                <span><b>{draft ? 'Redraw road' : 'Draw new road'}</b><small>tap points along every bend</small></span>
              </Button>
            )}
          </div>
          <label className="road-field"><span>Find a loaded road</span><input type="search" placeholder="Street name or road ID" value={roadSearch} onChange={event => setRoadSearch(event.target.value)} /></label>
          {roadSearch.trim() && <div className="road-search-results">{searchResults.map(area => <button key={area.roadId} onClick={() => { onEditSelectedRoadArea(area); setRoadSearch(''); }}><b>{roadDisplayName(roadAreas, area.roadId)}</b><small>{area.function === 'intersection' ? 'Intersection · edit boundary and turns' : `Road · ${area.roadId.split('-').at(-1)}`}</small></button>)}{!searchResults.length && <p>No matching road is loaded. Pan closer to that street to load it.</p>}</div>}
        </section>

        {parkedDrafts.length > 0 && <section className="road-kept-drafts" aria-label="Kept drafts"><b>{parkedDrafts.length} other unsaved draft{parkedDrafts.length === 1 ? '' : 's'}</b><p>Click a road on the map to switch. Your drafts stay here until saved or discarded.</p>{parkedDrafts.map(entry => <button key={entry.id} onClick={() => onResumeDraft?.(entry.id)}>Resume {entry.name}<small>{entry.kind === 'junction' ? 'Intersection' : 'Road'}</small></button>)}</section>}
        {visibleRoadWarnings.length > 0 && (
          <FitConflictCard
            conflicts={visibleRoadWarnings}
            blockingCount={blockingFitConflicts.length}
          />
        )}
        {savedFitReview && !draftDirty && !junction?.junctionDirty && <FitConflictCard conflicts={savedFitReview.warnings} blockingCount={0} saved />}

        <Osm2StreetsInspector
          selection={osm2streetsSelection}
          onEditRoad={onEditOsm2StreetsSelection}
          onClear={onClearOsm2StreetsSelection}
        />
        {selectedRoadArea && !draft && !junction?.junctionDraft && (
          <SelectedRoadAreaCard
            area={selectedRoadArea}
            onEdit={onEditSelectedRoadArea}
            onDelete={onDeleteSelectedRoadArea}
          />
        )}

        {junction?.junctionDraft && junction.junctionPlan && <RoadJunctionPanel key={junction.junctionDraft.id} draft={junction.junctionDraft} plan={junction.junctionPlan} areas={roadAreas} tool={junction.junctionEditTool} onToolChange={junction.setJunctionEditTool} onCompare={() => { onBasemapChange('satellite'); onSatelliteOpacityChange(1); onRoadOverlayOpacityChange(.35); }} onChange={junction.handleJunctionChange} onFocusSource={junction.setJunctionSource} focusedSource={junction.junctionSource} onEditRoad={onEditSelectedRoadArea} />}
        {junction?.junctionConflicts && junction.junctionConflicts.length > 0 && <FitConflictCard conflicts={junction.junctionConflicts} blockingCount={junction.junctionConflicts.filter((item) => item.severity === 'error').length} />}
        {draft && activeSection ? (
          <section className="road-editor-card space-y-4">
            <div id="road-view-shape" role="tabpanel" aria-labelledby="road-tab-shape" hidden={activeTab !== 'shape'}>
            <PanelSectionHeader
              icon={<Road className="h-3.5 w-3.5" aria-hidden="true" />}
              title="Shape and connect"
              meta={draft.name ?? draft.source}
            />
            <div className="road-shape-summary">
              <div>
                <b>{summarizeRoadDraft(draft)}</b>
                <span>{activeSection.centerlineWgs84.length} curve anchors · {activeTotalWidth.toFixed(2)} m wide</span>
              </div>
              <span className={connectionCount > 0 ? 'is-connected' : ''}>
                {connectionCount > 0 ? `${connectionCount} joins confirmed` : 'No manual joins'}
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
                    onChange={(event) => {
                      setActiveSectionId(event.target.value);
                      setActiveBandIndex(0);
                      onRoadBandSelect?.({
                        sectionId: event.target.value,
                        bandIndex: 0,
                      });
                    }}
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

            </div>
            <div id="road-view-lanes" role="tabpanel" aria-labelledby="road-tab-lanes" className="road-lane-editor" hidden={activeTab !== 'lanes'}>
              <RoadSectionPreview section={activeSection} selected={activeBandIndex} onSelect={(index) => { setActiveBandIndex(index); onRoadBandSelect?.({ sectionId: activeSection.id, bandIndex: index }); }} />


              {activeBand && (
                <div className="road-band-detail">
                  <div className="road-band-detail__heading">
                    <span
                      style={{
                        background: bandBoxBackground(activeBand.kind, activeBand.sourceType),
                        color: bandBoxTextColor(activeBand.kind, activeBand.sourceType),
                      }}
                    >{activeBandIndex + 1}</span>
                    <select
                      aria-label="Selected road band"
                      value={activeBandIndex}
                      onChange={(event) => {
                        const index = Number(event.target.value);
                        setActiveBandIndex(index);
                        onRoadBandSelect?.({ sectionId: activeSection.id, bandIndex: index });
                      }}
                    >
                      {activeSection.bands.map((band, index) => (
                        <option key={band.id ?? index} value={index}>
                          {index + 1}. {labelBand(band.kind, band.sourceType)} · {band.widthM} m
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="road-width-control">
                    <span>Width</span>
                    <output>{activeBand.widthM.toFixed(2)} m</output>
                    <input
                      type="range"
                      min={0.1}
                      max={Math.max(activeBand.widthM, roadWidthRule(activeBand, draft.ruleProfile).maximumM ?? 12)}
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
                      aria-label="Band width in metres"
                      min={0.1}
                      max={roadWidthRule(activeBand, draft.ruleProfile).maximumM ?? 12}
                      step={0.05}
                      value={activeBand.widthM}
                      onChange={(event) =>
                        updateBand(activeBandIndex, {
                          widthM: Math.max(
                            0.1,
                            Number(event.target.value) || DEFAULT_WIDTH[activeBand.kind]
                          ),
                        })
                      }
                    />
                  </label>

                  {roadRuleIssues.filter(issue => issue.sectionId === activeSection.id && issue.bandIndex === activeBandIndex && issue.severity === 'error').map(issue => <p className="road-inline-error" role="alert" key={issue.message}>{issue.message}</p>)}

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

              <details className="road-band-reorder">
                <summary>Reorder bands <span>Drag left or right</span></summary>
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
                    onClick={() => {
                      setActiveBandIndex(index);
                      onRoadBandSelect?.({
                        sectionId: activeSection.id,
                        bandIndex: index,
                      });
                    }}
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
              </details>

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

            <div id="road-view-connections" role="tabpanel" aria-labelledby="road-tab-connections" hidden={activeTab !== 'connections'}>
              <RoadConnectionsPanel draft={draft} section={activeSection} areas={roadAreas} dirty={draftDirty} onChange={onDraftChange} onEdit={onEditSelectedRoadArea} onCreate={junction?.handleCreateJunction} />
            </div>
            <div id="road-view-rules" role="tabpanel" aria-labelledby="road-tab-rules" hidden={activeTab !== 'rules'}>
              <RoadRulesPanel draft={draft} section={activeSection} issues={roadRuleIssues} onChange={onDraftChange} />
            </div>

            <details
              data-testid="cityjson-export-backend"
              className="road-advanced-disclosure"
              hidden={activeTab !== 'map'}
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
        ) : !junction?.junctionDraft && !selectedRoadArea ? (
          <section className="rounded-md border border-dashed border-[rgba(148,163,184,0.24)] bg-[rgba(255,255,255,0.025)] p-3 text-[11px] text-[var(--text-dim)]">
            Select an existing street to start. Your changes stay in a draft until you save.
          </section>
        ) : null}
      </div>
      {draft && (
        <footer className="road-editor-footer">
          <div className="road-editor-footer__status">
            <b>
              {editingRoadId
                ? draftDirty
                  ? `Unsaved changes to ${draft.name ?? editingRoadId}`
                  : `Editing ${draft.name ?? editingRoadId}`
                : 'New road draft'}
            </b>
            <span>
              {roadFitPending
                ? 'Updating fit check…'
                : blockingFitConflicts.length > 0
                  ? `${blockingFitConflicts.length} conflicts need review — you can save with warnings`
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
              onClick={visibleRoadWarnings.length && onSaveRoadWithWarnings ? onSaveRoadWithWarnings : onInsertRoad}
              disabled={
                roadFitPending ||
                (blockingFitConflicts.length > 0 && !onSaveRoadWithWarnings) || blockingRuleCount > 0 ||
                (!!editingRoadId && !draftDirty)
              }
              title={
                blockingFitConflicts.length > 0
                  ? 'Save this design with the listed warnings recorded in the project.'
                  : editingRoadId && !draftDirty
                    ? 'Change the road layout before saving.'
                    : undefined
              }
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              {visibleRoadWarnings.length && onSaveRoadWithWarnings ? `Save with ${visibleRoadWarnings.length} warning${visibleRoadWarnings.length === 1 ? '' : 's'}` : exactGeometryStatus === 'preserved'
                ? 'Save exact attributes'
                : editingRoadId
                  ? 'Save road changes'
                  : 'Save new road'}
            </Button>
          </div>
        </footer>
      )}
      {junction?.junctionDraft && <footer className="road-editor-footer"><div className="road-editor-footer__status"><b>{junction.junctionDirty ? 'Unsaved intersection' : 'Intersection saved'}</b><span>{junction.junctionDraft.surfaceMode === 'preserve' ? 'Current surface retained' : 'Rebuild junction and approaches'}</span></div><div className="road-editor-footer__actions">
        <Button variant="outline" onClick={junction.handleCancelJunction}>Discard</Button>
        <Button variant="primary" disabled={!junction.junctionDirty || junction.junctionEditTool.startsWith('trace-') || !!junction.junctionPlan?.error} onClick={() => junction.handleSaveJunction({ allowWarnings: true })}>{junction.junctionConflicts.length ? `Save with ${junction.junctionConflicts.length} warning${junction.junctionConflicts.length === 1 ? '' : 's'}` : 'Save intersection'}</Button>
      </div></footer>}
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

function FitConflictCard({
  conflicts,
  blockingCount,
  saved = false,
}: {
  conflicts: Array<Pick<RoadFitConflict, 'id' | 'label' | 'severity'>>;
  blockingCount: number;
  saved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`road-fit-card${blockingCount ? ' has-conflicts' : ''}`} aria-label={saved ? 'Saved road warnings' : 'Road fit warnings'}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{saved ? 'Warnings accepted at last save' : 'Road fit warnings'}</span>
        </div>
        <span className="road-fit-card__count">
          {conflicts.length}
        </span>
      </div>
      <p>{saved ? 'Recorded with the saved design. These are the results of its last geometry check.' : 'Review the highlighted areas. Save with warnings keeps the design and records these issues.'}</p>
      <ul className="space-y-1">
        {(expanded ? conflicts : conflicts.slice(0, 4)).map((conflict) => (
          <li key={conflict.id}>
            <span className="road-fit-card__severity">
              {conflict.severity === 'error' ? 'Conflict' : 'Check'}
            </span>
            <span>{conflict.label}</span>
          </li>
        ))}
      </ul>
      {conflicts.length > 4 && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer warnings' : `Show all ${conflicts.length} warnings`}</button>
      )}
    </section>
  );
}

function SelectedRoadAreaCard({
  area,
  onEdit,
  onDelete,
}: {
  area: RoadArea;
  onEdit: (area: RoadArea) => void;
  onDelete: (area: RoadArea) => void;
}) {
  const attrs = area.attributes;
  const isIntersection =
    String(attrs.transportationUsage ?? area.function).toLowerCase() === 'intersection';
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
    <div className="selected-road-card">
      <div className="selected-road-card__title">
        <div>
          <b>{isIntersection ? 'Selected CityJSON junction' : stringAttr(attrs.roadName) ?? 'Selected CityJSON road'}</b>
          <span>{stringAttr(attrs.sourceType) ?? area.function} · {stringAttr(attrs.trafficDirection) ?? 'no direction'}</span>
        </div>
        <span>{modes}</span>
      </div>
        <Button className="h-14 w-full text-sm" variant="primary" onClick={() => onEdit(area)}>
          <PencilLine className="h-5 w-5" aria-hidden="true" /> {isIntersection ? 'Edit intersection' : 'Edit road'}
        </Button>
      <Button
        className="h-12 w-full text-sm"
        variant="warn"
        onClick={() => onDelete(area)}
        aria-label={isIntersection ? 'Delete junction' : 'Delete road'}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" /> {isIntersection ? 'Delete junction' : 'Delete road'}
      </Button>
      {!isIntersection && area.geometryMode === 'exact' && (
        <p>
          Speed, direction, access, material, and type keep the exact source polygons. Shape or
          width changes rebuild only this road.
        </p>
      )}
      <details className="selected-road-card__source">
        <summary>Source details</summary>
        <dl>
          <dt>CityJSON id</dt><dd>{area.roadId}</dd>
          <dt>osm2streets</dt><dd>road {stringAttr(attrs.osm2streetsRoadId) ?? 'n/a'}, lane {stringAttr(attrs.osm2streetsLaneIndex) ?? 'n/a'}</dd>
          <dt>OSM ways</dt><dd>{osmWayIds}</dd>
        </dl>
        {provenance && (
          <pre className="mt-1 max-h-28 overflow-auto rounded bg-[rgba(0,0,0,0.28)] p-1 text-[10px] leading-snug">
            {provenance}
          </pre>
        )}
      </details>
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
