import { useMemo, useState } from 'react';
import type { Footprint } from '../lib/footprints';
import { Button } from './ui/button';

type SortKey = 'id' | 'year' | 'height' | 'function';

interface Props {
  /** Already-filtered list (ordered however the parent decided). */
  filteredFootprints: Footprint[];
  /** Total count BEFORE filter — used for the "47 of 918" header. */
  totalCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Left-side rail listing every building in the (filtered) document. Click a
 * row to select it on the map and open its AttributePanel. Cap visible rows
 * at 300 to keep render cheap; the user can narrow the filter to see more.
 */
export default function BuildingListPanel({
  filteredFootprints,
  totalCount,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDesc, setSortDesc] = useState(false);

  const sorted = useMemo(() => {
    const arr = filteredFootprints.slice();
    arr.sort((a, b) => cmpFootprints(a, b, sortKey));
    if (sortDesc) arr.reverse();
    return arr;
  }, [filteredFootprints, sortKey, sortDesc]);

  const VISIBLE_CAP = 300;
  const truncated = sorted.length > VISIBLE_CAP;
  const visible = truncated ? sorted.slice(0, VISIBLE_CAP) : sorted;

  return (
    <aside className="flex w-[300px] flex-shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div>
          <div className="text-[12px] font-semibold">
            {filteredFootprints.length === totalCount
              ? `${totalCount} buildings`
              : `${filteredFootprints.length} of ${totalCount}`}
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">
            Click a row to select on the map
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close list"
          className="text-[16px] leading-none text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          ×
        </button>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] px-3 py-1.5 text-[10px]">
        <span className="text-[var(--text-faint)] self-center">Sort:</span>
        {(['id', 'year', 'height', 'function'] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === sortKey) setSortDesc((d) => !d);
              else {
                setSortKey(k);
                setSortDesc(false);
              }
            }}
            className={
              sortKey === k
                ? 'rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent)] cursor-pointer'
                : 'rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--text-dim)] hover:bg-[var(--bg)] cursor-pointer'
            }
          >
            {k}
            {sortKey === k && (sortDesc ? ' ↓' : ' ↑')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-4 text-center text-[11px] italic text-[var(--text-faint)]">
            No buildings match the current filter.
          </div>
        ) : (
          visible.map((fp) => {
            const sel = fp.id === selectedId;
            const attrs = fp.attributes ?? {};
            const fn = stringOf(attrs.function);
            const year = stringOf(attrs.yearOfConstruction);
            const height = stringOf(attrs.measuredHeight ?? fp.height);
            const roofType = stringOf(attrs.roofType);
            return (
              <button
                key={fp.id}
                onClick={() => onSelect(fp.id)}
                className={
                  sel
                    ? 'block w-full border-b border-[var(--border)] bg-[rgba(255,150,40,0.12)] px-3 py-1.5 text-left text-[11px]'
                    : 'block w-full border-b border-[var(--border)] px-3 py-1.5 text-left text-[11px] hover:bg-[var(--bg)]'
                }
              >
                <div
                  className={
                    sel ? 'truncate font-semibold text-[var(--accent)]' : 'truncate'
                  }
                  title={fp.id}
                >
                  {fp.id}
                </div>
                <div className="flex flex-wrap gap-x-2 text-[10px] text-[var(--text-faint)]">
                  {fn && <span>{fn}</span>}
                  {year && <span>· {year}</span>}
                  {height && <span>· {height} m</span>}
                  {roofType && <span>· {roofType}</span>}
                </div>
              </button>
            );
          })
        )}
        {truncated && (
          <div className="px-3 py-2 text-center text-[10px] italic text-[var(--text-faint)]">
            Showing first {VISIBLE_CAP} of {sorted.length} matches.
            <br />
            Narrow the filter for more.
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--border)] px-3 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="w-full text-[10px]"
        >
          Hide list
        </Button>
      </footer>
    </aside>
  );
}

function cmpFootprints(a: Footprint, b: Footprint, key: SortKey): number {
  switch (key) {
    case 'id':
      return a.id.localeCompare(b.id);
    case 'year': {
      const ya = numberOf(a.attributes?.yearOfConstruction) ?? Infinity;
      const yb = numberOf(b.attributes?.yearOfConstruction) ?? Infinity;
      return ya - yb;
    }
    case 'height': {
      const ha = numberOf(a.attributes?.measuredHeight) ?? a.height ?? -Infinity;
      const hb = numberOf(b.attributes?.measuredHeight) ?? b.height ?? -Infinity;
      return ha - hb;
    }
    case 'function': {
      const fa = stringOf(a.attributes?.function) ?? '';
      const fb = stringOf(b.attributes?.function) ?? '';
      const c = fa.localeCompare(fb);
      return c !== 0 ? c : a.id.localeCompare(b.id);
    }
  }
}

function numberOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function stringOf(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}
