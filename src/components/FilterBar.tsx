import { useMemo, useState } from 'react';
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
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

interface Props {
  footprints: Footprint[];
  filter: BuildingFilter;
  onChange: (next: BuildingFilter) => void;
  matchCount: number;
}

/**
 * Compact filter bar that lives just below the main toolbar. Always shows a
 * search input + match count; structured filters (roof type, year range,
 * height range) hide behind a "More filters ▾" toggle so the chrome stays
 * lean when not in use.
 *
 * The filter shape is held in App state and passed in/out via `onChange`,
 * which keeps this component pure and lets the parent drive layer dimming.
 */
export default function FilterBar({ footprints, filter, onChange, matchCount }: Props) {
  const [open, setOpen] = useState(false);

  const roofTypes = useMemo(() => uniqueRoofTypes(footprints), [footprints]);
  const years = useMemo(() => computeYearRange(footprints), [footprints]);
  const heights = useMemo(() => computeHeightRange(footprints), [footprints]);

  const empty = isFilterEmpty(filter);
  const total = footprints.length;

  const setText = (text: string) => onChange({ ...filter, text });
  const toggleRoof = (key: string) => {
    const next = new Set(filter.roofTypes ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...filter, roofTypes: next.size > 0 ? next : undefined });
  };
  const setYearMin = (v: number | undefined) => onChange({ ...filter, yearMin: v });
  const setYearMax = (v: number | undefined) => onChange({ ...filter, yearMax: v });
  const setHeightMin = (v: number | undefined) => onChange({ ...filter, heightMin: v });
  const setHeightMax = (v: number | undefined) => onChange({ ...filter, heightMax: v });
  const reset = () => onChange({});

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-[11px]">
      <div className="flex items-center gap-2">
        <Search className="shrink-0 text-[var(--text-dim)]" size={16} aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search id, function, year…"
          value={filter.text ?? ''}
          onChange={(e) => setText(e.target.value)}
          className="w-64 h-7"
        />

        <span
          className={
            empty
              ? 'text-[var(--text-faint)] tabular-nums'
              : 'text-[var(--text)] font-semibold tabular-nums'
          }
        >
          {empty ? `${total} buildings` : `${matchCount} of ${total} match`}
        </span>

        <div className="flex-1" />

        {!empty && (
          <Button size="sm" variant="ghost" onClick={reset}>
            <X size={14} aria-hidden="true" />
            Clear filters
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? <><span>Less</span><ChevronUp size={14} aria-hidden="true" /></> : <><span>More filters</span><ChevronDown size={14} aria-hidden="true" /></>}
        </Button>
      </div>

      {open && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-6 pt-1">
          {roofTypes.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-dim)]">Roof:</span>
              {roofTypes.map((rt) => {
                const active = filter.roofTypes?.has(rt) ?? false;
                return (
                  <button
                    key={rt}
                    onClick={() => toggleRoof(rt)}
                    className={
                      active
                        ? 'rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)] cursor-pointer'
                        : 'rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-dim)] hover:bg-[var(--bg)] cursor-pointer'
                    }
                  >
                    {rt}
                  </button>
                );
              })}
            </div>
          )}

          {years && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-dim)]">Year:</span>
              <Input
                type="number"
                min={years.min}
                max={years.max}
                placeholder={String(years.min)}
                value={filter.yearMin ?? ''}
                onChange={(e) =>
                  setYearMin(e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-20 h-7"
              />
              <span className="text-[var(--text-faint)]">to</span>
              <Input
                type="number"
                min={years.min}
                max={years.max}
                placeholder={String(years.max)}
                value={filter.yearMax ?? ''}
                onChange={(e) =>
                  setYearMax(e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-20 h-7"
              />
            </div>
          )}

          {heights && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-dim)]">Height (m):</span>
              <Input
                type="number"
                step="0.5"
                min={heights.min}
                max={heights.max}
                placeholder={heights.min.toFixed(1)}
                value={filter.heightMin ?? ''}
                onChange={(e) =>
                  setHeightMin(e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-20 h-7"
              />
              <span className="text-[var(--text-faint)]">to</span>
              <Input
                type="number"
                step="0.5"
                min={heights.min}
                max={heights.max}
                placeholder={heights.max.toFixed(1)}
                value={filter.heightMax ?? ''}
                onChange={(e) =>
                  setHeightMax(e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-20 h-7"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
