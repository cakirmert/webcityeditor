import { useMemo, useState } from 'react';
import type { AttributeValue, CityJsonDocument } from '../types';
import { canSplitBuilding, MIN_STOREY_HEIGHT, MIN_SIDE_WIDTH } from '../lib/subdivision';
import type { PendingTransform } from '../lib/transform-preview';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  buildingId: string;
  cityjson: CityJsonDocument;
  isDirty: boolean;
  onAttributeChange: (id: string, key: string, value: AttributeValue) => void;
  onRevert: (id: string) => void;
  onClose: () => void;
  onSplitByFloor?: (id: string, floorCount: number) => void;
  onSplitBySide?: (id: string, partCount: number) => void;
  pendingTransform?: PendingTransform | null;
  onStartTransform?: (id: string) => void;
  onUpdateTransform?: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform?: () => void;
  onSaveTransform?: () => void;
  hideHeader?: boolean;
}

export default function AttributePanel({
  buildingId,
  cityjson,
  isDirty,
  onAttributeChange,
  onRevert,
  onClose,
  onSplitByFloor,
  onSplitBySide,
  pendingTransform,
  onStartTransform,
  onUpdateTransform,
  onCancelTransform,
  onSaveTransform,
  hideHeader = false,
}: Props) {
  const [floorCount, setFloorCount] = useState(2);
  const [sideCount, setSideCount] = useState(2);
  const inTransformMode = !!pendingTransform;

  const splitGate = useMemo(
    () => canSplitBuilding(cityjson, buildingId),
    [cityjson, buildingId]
  );
  const obj = cityjson.CityObjects[buildingId];
  const attrs = obj?.attributes ?? {};
  const childCount = obj?.children?.length ?? 0;

  const sortedKeys = useMemo(
    () =>
      Object.keys(attrs).sort((a, b) => {
        const priority = [
          'measuredHeight',
          'storeysAboveGround',
          'storeysBelowGround',
          'yearOfConstruction',
          'yearOfDemolition',
          'function',
          'usage',
          'roofType',
          'class',
        ];
        const ia = priority.indexOf(a);
        const ib = priority.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      }),
    [attrs]
  );

  const content = (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <Section label="ID">
        <div className="break-all font-mono text-[11px] text-[var(--text)]">
          {buildingId}
        </div>
      </Section>

      {childCount > 0 && (
        <Section label="Parts (BuildingParts)">
          <div className="text-xs">{childCount}</div>
        </Section>
      )}

      <Section label={`Attributes (${sortedKeys.length})`}>
        {sortedKeys.length === 0 ? (
          <div className="text-xs italic text-[var(--text-faint)]">
            No attributes on this object.
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedKeys.map((k) => (
              <AttributeRow
                key={k}
                attrKey={k}
                value={attrs[k]}
                onChange={(v) => onAttributeChange(buildingId, k, v)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section label="Actions">
        <Button
          onClick={() => onRevert(buildingId)}
          disabled={!isDirty}
          variant="outline"
          className="w-full"
        >
          ⎌ Revert this building
        </Button>
        <div className="mt-2 text-[11px] text-[var(--text-faint)]">
          Click <kbd>Reload view</kbd> in the toolbar to re-render with your edits, or{' '}
          <kbd>Export CityJSON</kbd> to save.
        </div>
      </Section>

      {(onStartTransform || inTransformMode) && (
        <section
          className={
            inTransformMode
              ? 'rounded-md border border-[var(--select)] bg-[rgba(255,150,40,0.08)] p-3'
              : ''
          }
        >
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Edit position
          </div>
          {!inTransformMode ? (
            <Button
              variant="primary"
              onClick={() => onStartTransform?.(buildingId)}
              className="w-full"
            >
              ✦ Start editing position
            </Button>
          ) : (
            <>
              <div className="text-[10px] text-[var(--text-dim)]">
                Live preview on the map. Changes aren't written until you click Save.
              </div>
              <div className="mt-2 grid grid-cols-[30px_1fr] items-center gap-1.5">
                <Label>dX</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={pendingTransform!.dx}
                  onChange={(e) =>
                    onUpdateTransform?.({ dx: Number(e.target.value) || 0 })
                  }
                />
                <Label>dY</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={pendingTransform!.dy}
                  onChange={(e) =>
                    onUpdateTransform?.({ dy: Number(e.target.value) || 0 })
                  }
                />
                <Label>°</Label>
                <Input
                  type="number"
                  step="5"
                  value={pendingTransform!.angle}
                  onChange={(e) =>
                    onUpdateTransform?.({ angle: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {[-5, -1, 1, 5].map((d) => (
                  <Button
                    key={`x${d}`}
                    size="sm"
                    onClick={() =>
                      onUpdateTransform?.({ dx: pendingTransform!.dx + d })
                    }
                  >
                    E{d > 0 ? '+' : ''}
                    {d}
                  </Button>
                ))}
                {[-5, -1, 1, 5].map((d) => (
                  <Button
                    key={`y${d}`}
                    size="sm"
                    onClick={() =>
                      onUpdateTransform?.({ dy: pendingTransform!.dy + d })
                    }
                  >
                    N{d > 0 ? '+' : ''}
                    {d}
                  </Button>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {[-45, -15, 15, 45, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    onClick={() =>
                      onUpdateTransform?.({ angle: pendingTransform!.angle + d })
                    }
                  >
                    {d > 0 ? '+' : ''}
                    {d}°
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onUpdateTransform?.({ dx: 0, dy: 0, angle: 0 })}
                >
                  ⟲ Reset
                </Button>
              </div>

              <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                <Button
                  variant="primary"
                  onClick={onSaveTransform}
                  className="flex-1"
                  disabled={
                    pendingTransform!.dx === 0 &&
                    pendingTransform!.dy === 0 &&
                    pendingTransform!.angle === 0
                  }
                >
                  ✓ Save
                </Button>
                <Button onClick={onCancelTransform} className="flex-1">
                  ✕ Cancel
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {(onSplitByFloor || onSplitBySide) && (
        <Section label="Subdivide into BuildingParts">
          {splitGate.ok ? (
            <>
              {onSplitByFloor && (
                <div className="flex items-center gap-2">
                  <Label className="w-14">Floors</Label>
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    value={floorCount}
                    onChange={(e) =>
                      setFloorCount(Math.max(2, Number(e.target.value) || 2))
                    }
                    className="w-16"
                  />
                  <Button
                    size="sm"
                    onClick={() => onSplitByFloor(buildingId, floorCount)}
                  >
                    Split by floor
                  </Button>
                </div>
              )}
              {onSplitBySide && (
                <div className="mt-2 flex items-center gap-2">
                  <Label className="w-14">Sides</Label>
                  <Input
                    type="number"
                    min={2}
                    max={8}
                    value={sideCount}
                    onChange={(e) =>
                      setSideCount(Math.max(2, Number(e.target.value) || 2))
                    }
                    className="w-16"
                  />
                  <Button
                    size="sm"
                    onClick={() => onSplitBySide(buildingId, sideCount)}
                  >
                    Split by side
                  </Button>
                </div>
              )}
              <div className="mt-2 text-[10px] text-[var(--text-faint)]">
                Min floor height: {MIN_STOREY_HEIGHT} m · min side width:{' '}
                {MIN_SIDE_WIDTH} m. Side-split requires rectangular footprints.
              </div>
            </>
          ) : (
            <div className="text-[10px] italic text-[var(--text-faint)]">
              {splitGate.reason}
            </div>
          )}
        </Section>
      )}
    </div>
  );

  if (hideHeader) return content;

  return (
    <aside className="flex w-[480px] flex-shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <h3 className="m-0 text-[13px] font-semibold">
          {isDirty && (
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--warn)]" />
          )}
          {obj?.type ?? 'Unknown'}
        </h3>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </div>
      {content}
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      {children}
    </section>
  );
}

interface RowProps {
  attrKey: string;
  value: AttributeValue;
  onChange: (v: AttributeValue) => void;
}

function AttributeRow({ attrKey, value, onChange }: RowProps) {
  const isNumber = typeof value === 'number';
  const isBoolean = typeof value === 'boolean';
  const inputId = `attr-${attrKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <div className="grid grid-cols-[45%_1fr] items-center gap-1.5">
      <Label htmlFor={inputId} title={attrKey} className="truncate">
        {attrKey}
      </Label>
      {isBoolean ? (
        <select
          id={inputId}
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)]"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <Input
          id={inputId}
          type={isNumber ? 'number' : 'text'}
          step="any"
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (isNumber) onChange(raw === '' ? null : Number(raw));
            else onChange(raw);
          }}
        />
      )}
    </div>
  );
}
