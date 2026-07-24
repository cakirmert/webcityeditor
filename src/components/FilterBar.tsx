import { useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Footprint } from '../lib/footprints';
import {
  heightRange as computeHeightRange,
  isFilterEmpty,
  uniqueRoofTypes,
  yearRange as computeYearRange,
  type BuildingFilter,
} from '../lib/filter';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  footprints: Footprint[];
  filter: BuildingFilter;
  onChange: (next: BuildingFilter) => void;
  matchCount: number;
  onClose: () => void;
}

/**
 * Search and structured building filters shown on demand from the main
 * toolbar. The panel floats above the map so it never consumes permanent
 * viewport space, and all controls meet the touch-target minimum.
 */
export default function FilterBar({
  footprints,
  filter,
  onChange,
  matchCount,
  onClose,
}: Props) {
  const roofTypes = useMemo(() => uniqueRoofTypes(footprints), [footprints]);
  const years = useMemo(() => computeYearRange(footprints), [footprints]);
  const heights = useMemo(() => computeHeightRange(footprints), [footprints]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const empty = isFilterEmpty(filter);
  const total = footprints.length;

  const setText = (text: string) => onChange({ ...filter, text });
  const toggleRoof = (key: string) => {
    const next = new Set(filter.roofTypes ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...filter, roofTypes: next.size > 0 ? next : undefined });
  };
  const setYearMin = (value: number | undefined) =>
    onChange({ ...filter, yearMin: value });
  const setYearMax = (value: number | undefined) =>
    onChange({ ...filter, yearMax: value });
  const setHeightMin = (value: number | undefined) =>
    onChange({ ...filter, heightMin: value });
  const setHeightMax = (value: number | undefined) =>
    onChange({ ...filter, heightMax: value });
  const reset = () => onChange({});

  return (
    <section
      id="building-filter-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Search and filter buildings"
      className="building-filter-panel absolute left-3 top-3 z-[55] flex max-h-[min(78vh,38rem)] w-[min(760px,calc(100%-24px))] flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-2xl"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              Search and filters
            </h2>
            <p
              className={
                empty
                  ? 'text-xs text-[var(--text-faint)] tabular-nums'
                  : 'text-xs font-semibold text-[var(--text)] tabular-nums'
              }
            >
              {empty ? `${total} buildings` : `${matchCount} of ${total} match`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!empty && (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-12 px-4 text-sm"
              onClick={reset}
            >
              <X className="h-4 w-4" aria-hidden="true" /> Clear
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12 shrink-0"
            onClick={onClose}
            aria-label="Close search and filters"
            title="Close search and filters"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <label className="relative block">
        <span className="sr-only">Search buildings</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-dim)]"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search buildings"
          placeholder="Search id, function, year..."
          value={filter.text ?? ''}
          onChange={(event) => setText(event.target.value)}
          className="min-h-12 w-full pl-12 pr-4 text-base"
        />
      </label>

      <div
        role="region"
        aria-label="Building filters"
        className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4"
      >
        {roofTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-dim)]">Roof:</span>
            {roofTypes.map((roofType) => {
              const active = filter.roofTypes?.has(roofType) ?? false;
              return (
                <button
                  key={roofType}
                  onClick={() => toggleRoof(roofType)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'min-h-12 min-w-12 touch-manipulation cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent)]'
                      : 'min-h-12 min-w-12 touch-manipulation cursor-pointer rounded-md border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] hover:bg-[var(--surface-2)]'
                  }
                >
                  {roofType}
                </button>
              );
            })}
          </div>
        )}

        {years && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-dim)]">Year:</span>
            <Input
              type="number"
              min={years.min}
              max={years.max}
              placeholder={String(years.min)}
              aria-label="Minimum construction year"
              value={filter.yearMin ?? ''}
              onChange={(event) =>
                setYearMin(
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
              className="min-h-12 w-28 px-3 text-sm"
            />
            <span className="text-[var(--text-faint)]">to</span>
            <Input
              type="number"
              min={years.min}
              max={years.max}
              placeholder={String(years.max)}
              aria-label="Maximum construction year"
              value={filter.yearMax ?? ''}
              onChange={(event) =>
                setYearMax(
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
              className="min-h-12 w-28 px-3 text-sm"
            />
          </div>
        )}

        {heights && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-dim)]">Height (m):</span>
            <Input
              type="number"
              step="0.5"
              min={heights.min}
              max={heights.max}
              placeholder={heights.min.toFixed(1)}
              aria-label="Minimum building height"
              value={filter.heightMin ?? ''}
              onChange={(event) =>
                setHeightMin(
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
              className="min-h-12 w-28 px-3 text-sm"
            />
            <span className="text-[var(--text-faint)]">to</span>
            <Input
              type="number"
              step="0.5"
              min={heights.min}
              max={heights.max}
              placeholder={heights.max.toFixed(1)}
              aria-label="Maximum building height"
              value={filter.heightMax ?? ''}
              onChange={(event) =>
                setHeightMax(
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
              className="min-h-12 w-28 px-3 text-sm"
            />
          </div>
        )}
      </div>
    </section>
  );
}
