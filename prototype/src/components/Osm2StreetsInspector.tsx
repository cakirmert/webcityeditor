import type { Osm2StreetsSelection } from '../lib/osm2streets';
import { Button } from './ui/button';

interface Props {
  selection: Osm2StreetsSelection;
  onCreateDraft: () => void;
  onHighlightConnectedRoads: () => void;
  onClear: () => void;
}

export default function Osm2StreetsInspector({
  selection,
  onCreateDraft,
  onHighlightConnectedRoads,
  onClear,
}: Props) {
  if (!selection) return null;
  const props = selection.feature.properties ?? {};

  return (
    <section className="space-y-2 rounded border border-[var(--border)] bg-[rgba(0,0,0,0.18)] p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold">
            osm2streets {selection.kind === 'lane' ? 'lane' : 'intersection'}
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">
            {selection.kind === 'lane'
              ? `Road ${formatValue(props.road)} / lane ${formatValue(props.index)}`
              : `Intersection ${formatValue(props.id)}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded px-2 py-1 text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="Clear osm2streets selection"
        >
          x
        </button>
      </div>

      {selection.kind === 'lane' ? (
        <LaneDetails properties={props} onCreateDraft={onCreateDraft} />
      ) : (
        <IntersectionDetails
          properties={props}
          onHighlightConnectedRoads={onHighlightConnectedRoads}
        />
      )}
    </section>
  );
}

function LaneDetails({
  properties,
  onCreateDraft,
}: {
  properties: Record<string, any>;
  onCreateDraft: () => void;
}) {
  return (
    <>
      <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 text-[11px]">
        <InspectorRow label="Type" value={properties.type ?? properties.lane_type} />
        <InspectorRow label="Direction" value={properties.direction} />
        <InspectorRow label="Width" value={formatMeters(properties.width)} />
        <InspectorRow label="Speed" value={properties.speed_limit} />
        <InspectorRow label="Allowed turns" value={properties.allowed_turns} />
        <InspectorRow label="OSM ways" value={properties.osm_way_ids} />
      </dl>
      {properties.muv && (
        <details>
          <summary className="cursor-pointer text-[10px] text-[var(--text-dim)]">
            Muv JSON
          </summary>
          <pre className="mt-1 max-h-28 overflow-auto rounded bg-[rgba(0,0,0,0.24)] p-2 text-[10px] text-[var(--text-faint)]">
            {JSON.stringify(properties.muv, null, 2)}
          </pre>
        </details>
      )}
      <Button size="sm" variant="primary" className="w-full" onClick={onCreateDraft}>
        Create editable road draft
      </Button>
    </>
  );
}

function IntersectionDetails({
  properties,
  onHighlightConnectedRoads,
}: {
  properties: Record<string, any>;
  onHighlightConnectedRoads: () => void;
}) {
  return (
    <>
      <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 text-[11px]">
        <InspectorRow label="Kind" value={properties.intersection_kind ?? properties.kind} />
        <InspectorRow label="Control" value={properties.control} />
        <InspectorRow label="Crossing" value={properties.crossing_kind ?? properties.crossing} />
        <InspectorRow label="Island" value={properties.island} />
        <InspectorRow label="Movements" value={properties.movements} />
        <InspectorRow label="OSM nodes" value={properties.osm_node_ids ?? properties.osm_nodes} />
      </dl>
      <Button size="sm" className="w-full" onClick={onHighlightConnectedRoads}>
        Highlight connected roads
      </Button>
    </>
  );
}

function InspectorRow({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <dt className="text-[var(--text-faint)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--text-dim)]">{formatValue(value)}</dd>
    </>
  );
}

function formatMeters(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(2)} m`
    : formatValue(value);
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'n/a';
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : 'none';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
