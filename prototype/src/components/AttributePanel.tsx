import { useEffect, useMemo, useState } from 'react';
import type { AttributeValue, CityJsonDocument } from '../types';
import {
  canSplitBuilding,
  MIN_STOREY_HEIGHT,
  MIN_SIDE_WIDTH,
  type SplitAxis,
} from '../lib/subdivision';
import { extractOpenings, type OpeningInfo } from '../lib/opening-edit';
import { extractFootprints } from '../lib/footprints';
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
  /** New: split using a custom per-floor height array (in metres). The
   *  topmost entry keeps the parent's roof type. */
  onSplitByFloorHeights?: (id: string, heights: number[]) => void;
  /** Optional notifier — fires whenever the user is in custom-heights mode
   *  and the heights array changes. Lets the parent draw a live 3D preview
   *  of the split lines. `null` means "leave custom mode". */
  onCustomHeightsPreview?: (heights: number[] | null) => void;
  onSplitBySide?: (id: string, partCount: number, axis: SplitAxis) => void;
  pendingTransform?: PendingTransform | null;
  onStartTransform?: (id: string) => void;
  onUpdateTransform?: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform?: () => void;
  onSaveTransform?: () => void;
  /** True while the building's footprint is being edited on the map.
   *  When set, the panel shows Save/Cancel and hides editing affordances. */
  inFootprintEdit?: boolean;
  onStartFootprintEdit?: (id: string) => void;
  onSaveFootprintEdit?: () => void;
  onCancelFootprintEdit?: () => void;
  onMoveOpening?: (buildingId: string, opening: OpeningInfo, dx: number, dy: number, dz: number) => void;
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
  onSplitByFloorHeights,
  onCustomHeightsPreview,
  onSplitBySide,
  pendingTransform,
  onStartTransform,
  onUpdateTransform,
  onCancelTransform,
  onSaveTransform,
  inFootprintEdit = false,
  onStartFootprintEdit,
  onSaveFootprintEdit,
  onCancelFootprintEdit,
  onMoveOpening,
  hideHeader = false,
}: Props) {
  const [floorCount, setFloorCount] = useState(2);
  const [sideCount, setSideCount] = useState(2);
  const [sideAxis, setSideAxis] = useState<SplitAxis>('auto');
  /** Custom per-floor wall heights in metres (only used when "Custom heights"
   *  mode is active). Length must match floorCount, sum must match the
   *  building's eave height. */
  const [customHeights, setCustomHeightsRaw] = useState<number[] | null>(null);
  // Keep the parent's preview in sync with our custom-heights state.
  const setCustomHeights = (h: number[] | null) => {
    setCustomHeightsRaw(h);
    onCustomHeightsPreview?.(h);
  };
  // When the building selection changes, drop any in-progress custom heights
  // (and inform the parent so the preview clears).
  useEffect(() => {
    setCustomHeightsRaw(null);
    onCustomHeightsPreview?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);
  const inTransformMode = !!pendingTransform;
  const openings = useMemo(
    () => extractOpenings(cityjson, buildingId),
    [cityjson, buildingId]
  );
  const [selectedOpening, setSelectedOpening] = useState<number | null>(null);

  const splitGate = useMemo(
    () => canSplitBuilding(cityjson, buildingId),
    [cityjson, buildingId]
  );

  // Always feed the parent's splitPreview state — either with the explicit
  // custom-heights array OR an implicit uniform split derived from floorCount
  // and eaveHeight. The 3D viewer's split-line rings appear in both cases so
  // the user sees the cut placement even without entering custom mode.
  useEffect(() => {
    if (customHeights !== null) return; // setCustomHeights already drove the preview
    if (!splitGate.ok || floorCount < 2) {
      onCustomHeightsPreview?.(null);
      return;
    }
    const eaveH = splitGate.params!.eaveHeight;
    const per = eaveH / floorCount;
    onCustomHeightsPreview?.(new Array(floorCount).fill(per));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customHeights, floorCount, splitGate.ok, splitGate.params?.eaveHeight]);
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

      {/* Footprint editing — only available for buildings the editor created
          (we know their full parametric inputs and can re-run the generator
          on a new shape). Imported buildings get a hint instead of the
          button. */}
      {(onStartFootprintEdit || inFootprintEdit) && (
        <section
          className={
            inFootprintEdit
              ? 'rounded-md border border-[var(--select)] bg-[rgba(255,150,40,0.08)] p-3'
              : ''
          }
        >
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Edit footprint
          </div>
          {!inFootprintEdit ? (
            attrs._createdBy === 'city-editor-prototype' ? (
              <Button
                variant="primary"
                onClick={() => onStartFootprintEdit?.(buildingId)}
                className="w-full"
              >
                ✦ Edit footprint corners
              </Button>
            ) : (
              <div className="text-[11px] text-[var(--text-faint)] italic">
                Available only for buildings created in the editor — imported
                buildings keep their original geometry.
              </div>
            )
          ) : (
            <>
              <div className="text-[10px] text-[var(--text-dim)]">
                Drag the corner handles or midpoint dots on the map. Save
                regenerates the building with the new shape.
              </div>
              <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                <Button variant="primary" onClick={onSaveFootprintEdit} className="flex-1">
                  ✓ Save shape
                </Button>
                <Button onClick={onCancelFootprintEdit} className="flex-1">
                  ✕ Cancel
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {onMoveOpening && openings.length > 0 && (
        <Section label={`Openings (${openings.length})`}>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {openings.map((op, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] cursor-pointer ${
                  selectedOpening === i
                    ? 'bg-[rgba(255,150,40,0.15)] border border-[var(--select)]'
                    : 'hover:bg-[var(--surface-2)]'
                }`}
                onClick={() => setSelectedOpening(selectedOpening === i ? null : i)}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${
                  op.type === 'Window' ? 'bg-[#3d6f8f]' : 'bg-[#4a2f1f]'
                }`} />
                <span className="flex-1">
                  {op.type} — {op.width.toFixed(1)}×{op.height.toFixed(1)} m
                </span>
                <span className="text-[var(--text-faint)] tabular-nums">
                  z={op.center[2].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          {selectedOpening !== null && openings[selectedOpening] && (
            <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
              <div className="text-[10px] text-[var(--text-dim)] mb-1.5">
                Move {openings[selectedOpening].type} (metres)
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '← 0.5', dx: -0.5, dy: 0, dz: 0 },
                  { label: '→ 0.5', dx: 0.5, dy: 0, dz: 0 },
                  { label: '↑ 0.3', dx: 0, dy: 0, dz: 0.3 },
                  { label: '↓ 0.3', dx: 0, dy: 0, dz: -0.3 },
                  { label: 'Fwd 0.5', dx: 0, dy: 0.5, dz: 0 },
                  { label: 'Back 0.5', dx: 0, dy: -0.5, dz: 0 },
                ].map((m) => (
                  <Button
                    key={m.label}
                    size="sm"
                    onClick={() => {
                      onMoveOpening(
                        buildingId,
                        openings[selectedOpening!],
                        m.dx,
                        m.dy,
                        m.dz
                      );
                    }}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {(onSplitByFloor || onSplitBySide) && (
        <Section label="Subdivide into BuildingParts">
          {splitGate.ok ? (
            <>
              {onSplitByFloor && (
                <FloorSplitEditor
                  eaveHeight={splitGate.params!.eaveHeight}
                  floorCount={floorCount}
                  setFloorCount={setFloorCount}
                  customHeights={customHeights}
                  setCustomHeights={setCustomHeights}
                  onApplyUniform={() => onSplitByFloor(buildingId, floorCount)}
                  onApplyCustom={
                    onSplitByFloorHeights
                      ? (h) => onSplitByFloorHeights(buildingId, h)
                      : undefined
                  }
                />
              )}
              {onSplitBySide && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
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
                      onClick={() => onSplitBySide(buildingId, sideCount, sideAxis)}
                    >
                      Split by side
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                    <span className="text-[var(--text-dim)] mr-1">Axis:</span>
                    {(['auto', 'longer', 'shorter'] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setSideAxis(a)}
                        className={`rounded px-2 py-0.5 ${
                          sideAxis === a
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                        title={
                          a === 'auto'
                            ? 'Pick the longer axis (default)'
                            : a === 'longer'
                            ? 'Force the longer axis'
                            : 'Force the shorter axis'
                        }
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <SidePlanPreview
                    cityjson={cityjson}
                    buildingId={buildingId}
                    sideCount={sideCount}
                    axis={sideAxis}
                  />
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

interface FloorSplitEditorProps {
  eaveHeight: number;
  floorCount: number;
  setFloorCount: (n: number) => void;
  customHeights: number[] | null;
  setCustomHeights: (h: number[] | null) => void;
  onApplyUniform: () => void;
  onApplyCustom?: (heights: number[]) => void;
}

/**
 * Two-mode split editor: "uniform" picks a floor count and divides equally;
 * "custom" lets the user dial each floor's wall height in metres. The custom
 * mode auto-distributes a sensible starting point (3.5 m ground + equal upper
 * floors), validates that heights sum to the eave height, and shows live
 * warnings when any floor falls below the storey-height minimum or the sum
 * drifts.
 */
function FloorSplitEditor({
  eaveHeight,
  floorCount,
  setFloorCount,
  customHeights,
  setCustomHeights,
  onApplyUniform,
  onApplyCustom,
}: FloorSplitEditorProps) {
  const customMode = customHeights !== null;

  // When entering custom mode (or when floorCount changes while in custom
  // mode), seed sensible defaults: a tall ground floor + equal upper floors.
  const seedCustom = (n: number): number[] => {
    if (n < 2) return [eaveHeight];
    const ground = Math.min(3.5, eaveHeight / n + 0.5);
    const remaining = eaveHeight - ground;
    const upper = remaining / (n - 1);
    return [ground, ...new Array(n - 1).fill(upper)];
  };

  const enterCustom = () => setCustomHeights(seedCustom(floorCount));
  const leaveCustom = () => setCustomHeights(null);

  const updateOne = (idx: number, val: number) => {
    if (!customHeights) return;
    const next = customHeights.slice();
    next[idx] = val;
    setCustomHeights(next);
  };

  const onChangeFloorCount = (n: number) => {
    setFloorCount(n);
    if (customHeights) setCustomHeights(seedCustom(n));
  };

  const sum = customHeights?.reduce((a, b) => a + b, 0) ?? 0;
  const sumDelta = customMode ? sum - eaveHeight : 0;
  const sumOk = Math.abs(sumDelta) < 0.01;
  const anyTooShort =
    customMode && customHeights!.some((h) => h < MIN_STOREY_HEIGHT);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="w-14">Floors</Label>
        <Input
          type="number"
          min={2}
          max={20}
          value={floorCount}
          onChange={(e) => onChangeFloorCount(Math.max(2, Number(e.target.value) || 2))}
          className="w-16"
        />
        {!customMode && (
          <Button size="sm" onClick={onApplyUniform}>
            Split equally
          </Button>
        )}
        {onApplyCustom && (
          <Button size="sm" variant="ghost" onClick={customMode ? leaveCustom : enterCustom}>
            {customMode ? '✕ Equal' : 'Custom heights…'}
          </Button>
        )}
      </div>

      {customMode && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
          <div className="mb-1.5 flex items-baseline justify-between text-[10px] text-[var(--text-faint)]">
            <span>Per-floor wall height (m)</span>
            <span className={sumOk ? '' : 'text-[var(--warn)]'}>
              Σ {sum.toFixed(2)} / {eaveHeight.toFixed(2)} m
              {!sumOk && ` (${sumDelta > 0 ? '+' : ''}${sumDelta.toFixed(2)})`}
            </span>
          </div>
          <div className="space-y-1">
            {customHeights!.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 text-[11px] tabular-nums text-[var(--text-faint)]">
                  Floor {i + 1}
                </span>
                <Input
                  type="number"
                  min={MIN_STOREY_HEIGHT}
                  step="0.1"
                  value={h.toFixed(2)}
                  onChange={(e) =>
                    updateOne(i, Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20"
                />
                <span className="text-[10px] text-[var(--text-faint)]">m</span>
                {h < MIN_STOREY_HEIGHT && (
                  <span className="text-[10px] text-[var(--warn)]">⚠ &lt; {MIN_STOREY_HEIGHT} m</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!sumOk || anyTooShort}
              onClick={() => onApplyCustom?.(customHeights!)}
            >
              Split with custom heights
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCustomHeights(seedCustom(floorCount))}
            >
              Auto-distribute
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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

/**
 * 2D plan view of the selected building's footprint with N-1 dashed cut
 * lines along the AABB long axis. Visualises where `splitBuildingBySide`
 * will cut before the user clicks "Split by side". Hidden when the
 * building has no extractable footprint (e.g. imported buildings without
 * GroundSurface semantics).
 */
function SidePlanPreview({
  cityjson,
  buildingId,
  sideCount,
  axis = 'auto',
}: {
  cityjson: CityJsonDocument;
  buildingId: string;
  sideCount: number;
  axis?: SplitAxis;
}) {
  const { svgPath, splitLines } = useMemo(() => {
    const all = extractFootprints(cityjson);
    const fp = all.find((f) => f.id === buildingId);
    if (!fp || fp.polygon.length < 3) {
      return { svgPath: '', splitLines: [] };
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of fp.polygon) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const targetW = 88;
    const targetH = 48;
    const scale = Math.min(targetW / w, targetH / h);
    const drawW = w * scale;
    const drawH = h * scale;
    const ox = 6 + (targetW - drawW) / 2;
    const oy = 6 + (targetH - drawH) / 2;
    const px = (x: number) => ox + (x - minX) * scale;
    const py = (y: number) => oy + (maxY - y) * scale; // flip Y so north is up

    const path =
      'M ' +
      fp.polygon
        .map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`)
        .join(' L ') +
      ' Z';

    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    if (sideCount >= 2) {
      const naturalLongX = w >= h;
      const longAlongX = axis === 'shorter' ? !naturalLongX : naturalLongX;
      for (let i = 1; i < sideCount; i++) {
        const t = i / sideCount;
        if (longAlongX) {
          const x = px(minX + t * w);
          lines.push({ x1: x, y1: py(minY), x2: x, y2: py(maxY) });
        } else {
          const y = py(minY + t * h);
          lines.push({ x1: px(minX), y1: y, x2: px(maxX), y2: y });
        }
      }
    }
    return { svgPath: path, splitLines: lines };
  }, [cityjson, buildingId, sideCount, axis]);

  if (!svgPath) return null;

  return (
    <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
      <div className="mb-1 text-[10px] text-[var(--text-dim)]">
        Plan view · {sideCount} parts along the long axis
      </div>
      <svg viewBox="0 0 100 60" className="w-full" style={{ height: 70 }}>
        <path
          d={svgPath}
          fill="rgba(76, 126, 255, 0.18)"
          stroke="rgb(76, 126, 255)"
          strokeWidth="1"
        />
        {splitLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgb(255, 138, 61)"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
        ))}
      </svg>
    </div>
  );
}
