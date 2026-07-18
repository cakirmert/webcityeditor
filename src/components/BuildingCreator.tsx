import { useEffect, useMemo, useState } from 'react';
import {
  validateStoreyHeight,
  generateBuilding,
  insertBuilding,
  type RoofType,
} from '../lib/generator';
import type { SplitAxis } from '../lib/subdivision';
import { detectCrs } from '../lib/projection';
import type { CityJsonDocument } from '../types';
import Viewer from './Viewer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

/**
 * Form payload the creator emits — same shape as the legacy `NewBuildingDialog`
 * so App.tsx can route either component through the same `handleCreateBuilding`
 * pipeline.
 */
export interface NewBuildingForm {
  totalHeight: number;
  storeys: number;
  roofType: RoofType;
  roofHeight: number;
  function: string;
  yearOfConstruction: number | null;
  splitMode: 'none' | 'floors' | 'sides';
  splitCount: number;
  splitAxis: SplitAxis;
  addWindows: boolean;
  addDoor: boolean;
  eaveOverhang: number;
  rakeOverhang: number;
}

interface Props {
  vertexCount: number;
  /** The drawn footprint in WGS84. Used to build a live preview CityJSON doc. */
  footprint: [number, number][];
  /** The host doc — borrows its `transform` + CRS so the preview lives in the
   *  same coordinate system as the eventual insertion. */
  cityjson: CityJsonDocument;
  error?: string | null;
  onFormChange?: (form: NewBuildingForm) => void;
  onCreate: (form: NewBuildingForm) => void;
  onCancel: () => void;
}

/**
 * Fullscreen building creator — replaces the modal `NewBuildingDialog` + the
 * floating `CreationPreviewPanel`. Layout: form on the left (~38%), Three.js
 * preview on the right (~62%, filling the available height). The 3D viewer
 * re-loads whenever any form field changes so the user sees the actual
 * generated geometry, semantic surfaces and openings live.
 */
export default function BuildingCreator({
  vertexCount,
  footprint,
  cityjson,
  error,
  onFormChange,
  onCreate,
  onCancel,
}: Props) {
  const [totalHeight, setTotalHeight] = useState(10);
  const [roofType, setRoofType] = useState<RoofType>('flat');
  const [roofHeight, setRoofHeight] = useState(2.5);
  const [func, setFunc] = useState('residential');
  const [year, setYear] = useState<number | null>(new Date().getFullYear());
  const [storeys, setStoreys] = useState(3);
  const [storeysAutoSync, setStoreysAutoSync] = useState(true);
  const [splitMode, setSplitMode] = useState<'none' | 'floors' | 'sides'>('none');
  const [splitCount, setSplitCount] = useState(2);
  const [splitAxis, setSplitAxis] = useState<SplitAxis>('auto');
  const [addWindows, setAddWindows] = useState(true);
  const [addDoor, setAddDoor] = useState(true);
  const [eaveOverhang, setEaveOverhang] = useState(0);
  const [rakeOverhang, setRakeOverhang] = useState(0);

  useEffect(() => {
    if (storeysAutoSync) {
      const effectiveWalls = Math.max(
        2.4,
        totalHeight - (roofType === 'flat' ? 0 : roofHeight)
      );
      const next = Math.max(1, Math.round(effectiveWalls / 3));
      setStoreys(next);
    }
  }, [totalHeight, roofHeight, roofType, storeysAutoSync]);

  const effectiveRoofHeight = roofType === 'flat' ? 0 : roofHeight;
  const validation = useMemo(
    () => validateStoreyHeight(totalHeight, storeys, effectiveRoofHeight),
    [totalHeight, storeys, effectiveRoofHeight]
  );

  const form: NewBuildingForm = useMemo(
    () => ({
      totalHeight,
      storeys,
      roofType,
      roofHeight: effectiveRoofHeight,
      function: func,
      yearOfConstruction: year,
      splitMode,
      splitCount,
      splitAxis,
      addWindows,
      addDoor,
      eaveOverhang: roofType === 'flat' ? eaveOverhang : 0,
      rakeOverhang: 0,
    }),
    [
      totalHeight,
      storeys,
      roofType,
      effectiveRoofHeight,
      func,
      year,
      splitMode,
      splitCount,
      splitAxis,
      addWindows,
      addDoor,
      eaveOverhang,
      rakeOverhang,
    ]
  );

  useEffect(() => {
    onFormChange?.(form);
  }, [form, onFormChange]);

  // Build a one-building preview doc on every form change so the right-pane
  // Viewer renders the actual generated geometry (incl. roof, soffits,
  // openings). The Viewer is keyed on a hash of form values so loader re-runs
  // when meaningful inputs change.
  const previewDoc = useMemo(
    () => buildPreviewDoc(footprint, form, cityjson),
    [footprint, form, cityjson]
  );
  const previewToken = useMemo(() => hashForm(form), [form]);
  const massingMetrics = useMemo(
    () => estimateMassingMetrics(footprint, form),
    [footprint, form]
  );

  // ESC cancels — matches the legacy dialog's behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] flex bg-[rgba(0,0,0,0.55)] backdrop-blur-sm">
      <div className="m-auto flex h-full w-full max-w-[1600px] overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.5)] md:h-[92vh] md:w-[94vw] md:rounded-lg">
        {/* ── Left pane: form ──────────────────────────────────────────── */}
        <div className="flex w-full shrink-0 flex-col border-r border-[var(--border)] md:w-[420px]">
          <header className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[18px] font-semibold">Custom building</h2>
            <p className="mt-1 text-[12px] text-[var(--text-dim)]">
              Your {vertexCount}-corner outline is ready. Changes appear immediately in the preview.
            </p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <Section label="Roof type">
              <RoofTypePicker value={roofType} onChange={setRoofType} />
            </Section>

            <Section label="Dimensions">
              <Row label="Total height (m)">
                <Input
                  type="number"
                  min={3}
                  max={300}
                  step="0.1"
                  value={totalHeight}
                  onChange={(e) =>
                    setTotalHeight(Math.max(3, Number(e.target.value) || 10))
                  }
                />
              </Row>

              {roofType !== 'flat' && (
                <Row label="Roof height (m)">
                  <Input
                    type="number"
                    min={0.5}
                    max={Math.max(0.5, totalHeight - 2.4)}
                    step="0.1"
                    value={roofHeight}
                    onChange={(e) =>
                      setRoofHeight(
                        Math.min(
                          Math.max(0.5, Number(e.target.value) || 2.5),
                          Math.max(0.5, totalHeight - 2.4)
                        )
                      )
                    }
                  />
                </Row>
              )}

              <Row label="Storeys">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={storeys}
                  onChange={(e) => {
                    setStoreysAutoSync(false);
                    setStoreys(Math.max(1, Number(e.target.value) || 1));
                  }}
                />
              </Row>

              <Row label="Storey height">
                <div
                  className={`flex h-7 items-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs tabular-nums ${
                    validation.warnings.length > 0
                      ? 'text-[var(--warn)]'
                      : 'text-[var(--text)]'
                  }`}
                >
                  {validation.storeyHeight.toFixed(2)} m
                  {storeysAutoSync && (
                    <span className="ml-2 text-[var(--text-faint)]">(auto)</span>
                  )}
                </div>
              </Row>

              {validation.warnings.length > 0 && (
                <div className="rounded-md border border-[var(--warn)] bg-[rgba(251,191,36,0.08)] px-2 py-1.5 text-[11px] text-[var(--warn)]">
                  {validation.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}
            </Section>

            <Section label="Massing study">
              <div className="grid grid-cols-3 gap-1.5">
                <Metric label="Footprint" value={`${formatMetric(massingMetrics.footprintAreaM2)} m2`} />
                <Metric label="GFA" value={`${formatMetric(massingMetrics.grossFloorAreaM2)} m2`} />
                <Metric label="Volume" value={`${formatMetric(massingMetrics.volumeM3)} m3`} />
              </div>
            </Section>

            <Section label="Overhang">
              <div className="mb-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[10px] text-[var(--text-dim)]">
                Flat eave overhangs use a validated 0.25 m roof slab. Pitched and rake overhangs are still disabled pending a validated slab model.
              </div>
              <Row label="Eave (m)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step="0.1"
                    value={eaveOverhang}
                    disabled={roofType !== 'flat'}
                    title={
                      roofType === 'flat'
                        ? 'Flat roof eave overhang in metres'
                        : 'Pitched roof overhangs are disabled until a validated slab model is available'
                    }
                    onChange={(e) =>
                      setEaveOverhang(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                  {eaveOverhang > 0 && (
                    <span className="text-[10px] text-[var(--text-faint)]">
                      → LoD 2.2
                    </span>
                  )}
                </div>
              </Row>
              {roofType === 'gable' && (
                <Row label="Rake (m)">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step="0.1"
                      value={rakeOverhang}
                      disabled
                      title="Rake overhangs are disabled until a validated pitched roof-slab model is available"
                      onChange={() => setRakeOverhang(0)}
                    />
                    {rakeOverhang > 0 && (
                      <span className="text-[10px] text-[var(--text-faint)]">
                        → ridge extends
                      </span>
                    )}
                  </div>
                </Row>
              )}
            </Section>

            <Section label="Attributes">
              <Row label="Function">
                <Select value={func} onValueChange={setFunc}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">residential</SelectItem>
                    <SelectItem value="commercial">commercial</SelectItem>
                    <SelectItem value="industrial">industrial</SelectItem>
                    <SelectItem value="mixed">mixed</SelectItem>
                    <SelectItem value="public">public</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Year built">
                <Input
                  type="number"
                  min={1000}
                  max={2100}
                  value={year ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setYear(v === '' ? null : Number(v));
                  }}
                />
              </Row>
            </Section>

            <Section label="Windows and entrance">
              <div className="mb-2 text-[11px] leading-relaxed text-[var(--text-dim)]">
                Add editable Window and Door surfaces. This does not pretend the custom model came from an official LoD3 survey.
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addWindows}
                    onChange={(e) => setAddWindows(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span>Windows</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addDoor}
                    onChange={(e) => setAddDoor(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span>Door</span>
                </label>
              </div>
            </Section>

            <Section label="Separate editable parts (optional)">
              <p className="mb-2 text-[11px] leading-relaxed text-[var(--text-dim)]">
                Choose this only when floors or wings must be selected and edited independently later.
              </p>
              <div className="grid gap-2">
                <PartChoice
                  selected={splitMode === 'none'}
                  title="Keep one building"
                  description="Recommended. The whole building stays one simple object."
                  onClick={() => setSplitMode('none')}
                />
                <PartChoice
                  selected={splitMode === 'floors'}
                  title="Make floors independent"
                  description="Creates stacked BuildingParts so each level can be selected separately."
                  onClick={() => setSplitMode('floors')}
                />
                <PartChoice
                  selected={splitMode === 'sides'}
                  title="Make side-by-side wings"
                  description="Cuts the footprint into separately editable sections."
                  onClick={() => setSplitMode('sides')}
                />
              </div>
              {splitMode !== 'none' && (
                <>
                  <Row
                    label={splitMode === 'floors' ? 'Independent levels' : 'Independent wings'}
                  >
                    <Input
                      type="number"
                      min={2}
                      max={splitMode === 'floors' ? 20 : 8}
                      value={splitCount}
                      onChange={(e) =>
                        setSplitCount(Math.max(2, Number(e.target.value) || 2))
                      }
                    />
                  </Row>
                  {splitMode === 'sides' && (
                    <div className="flex items-center gap-1 text-[10px] pl-[42%]">
                      <span className="text-[var(--text-dim)] mr-1">Cut:</span>
                      {(['auto', 'longer', 'shorter'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setSplitAxis(a)}
                          className={`rounded px-2 py-0.5 ${
                            splitAxis === a
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
                          {a === 'auto' ? 'Best fit' : a === 'longer' ? 'Long side' : 'Short side'}
                        </button>
                      ))}
                    </div>
                  )}
                  <SplitPreview
                    footprint={footprint}
                    splitMode={splitMode}
                    splitCount={splitCount}
                    splitAxis={splitAxis}
                  />
                </>
              )}
            </Section>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {error && (
              <div className="mr-auto max-w-[250px] rounded-md border border-[var(--err,#cb4b4b)] bg-[rgba(203,75,75,0.12)] px-2 py-1 text-[11px] text-[var(--err,#ff7b7b)]">
                {error}
              </div>
            )}
            <Button className="h-12" onClick={onCancel}>Cancel</Button>
            <Button className="h-12" variant="primary" onClick={() => onCreate(form)}>
              Create Building
            </Button>
          </footer>
        </div>

        {/* ── Right pane: live 3D preview ─────────────────────────────── */}
        <div className="relative hidden min-w-0 flex-1 bg-black md:block">
          {previewDoc ? (
            <Viewer
              cityjson={previewDoc}
              reloadToken={previewToken}
              onSelect={() => {}}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--text-faint)]">
              Preview unavailable — unsupported CRS.
            </div>
          )}
          {/* Floating label so it's obvious what the right pane is */}
          <div
            className="pointer-events-none absolute left-4 top-4 rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.55)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)] backdrop-blur"
          >
            Live preview
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PartChoice({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[58px] items-center gap-3 rounded-lg border px-3 py-2 text-left touch-manipulation ${
        selected
          ? 'border-[var(--accent)] bg-[rgba(76,125,255,0.12)]'
          : 'border-[var(--border)] bg-[var(--bg)]'
      }`}
    >
      <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${selected ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[inset_0_0_0_4px_var(--surface)]' : 'border-[var(--text-faint)]'}`} />
      <span>
        <strong className="block text-[12px]">{title}</strong>
        <small className="mt-0.5 block text-[10px] leading-snug text-[var(--text-dim)]">{description}</small>
      </span>
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[42%_1fr] items-center gap-2">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5">
      <div className="text-[9px] uppercase text-[var(--text-faint)]">{label}</div>
      <div className="text-[12px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/**
 * Visual roof-type picker — 4-card grid with SVG icons. Each card is a
 * top-down schematic showing how the ridge / hip lines run, which is the
 * most distinguishing feature among the four roof types.
 */
function RoofTypePicker({
  value,
  onChange,
}: {
  value: RoofType;
  onChange: (v: RoofType) => void;
}) {
  const options: Array<{
    key: RoofType;
    label: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    { key: 'flat', label: 'Flat', sub: 'any polygon', icon: <FlatIcon /> },
    {
      key: 'pyramid',
      label: 'Pyramid',
      sub: 'any polygon',
      icon: <PyramidIcon />,
    },
    { key: 'gable', label: 'Gable', sub: 'rectangle', icon: <GableIcon /> },
    { key: 'hip', label: 'Hip', sub: 'rectangle', icon: <HipIcon /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`group flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-colors ${
              selected
                ? 'border-[var(--accent)] bg-[rgba(76,126,255,0.12)]'
                : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--text-faint)] hover:bg-[var(--surface-2)]'
            }`}
            title={`${o.label} — ${o.sub}`}
          >
            <div
              className={
                selected ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text)]'
              }
            >
              {o.icon}
            </div>
            <div className="text-[11px] font-medium leading-tight">{o.label}</div>
            <div className="text-[9px] text-[var(--text-faint)] leading-none">
              {o.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Top-down 80×52 SVG roof schematics. Stroke uses currentColor so the
// surrounding card's hover/selected state can re-tint them.
function FlatIcon() {
  return (
    <svg width="64" height="42" viewBox="0 0 80 52" fill="none">
      <rect
        x="8"
        y="8"
        width="64"
        height="36"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
function PyramidIcon() {
  return (
    <svg width="64" height="42" viewBox="0 0 80 52" fill="none">
      <rect x="8" y="8" width="64" height="36" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="8" x2="40" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="72" y1="8" x2="40" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="72" y1="44" x2="40" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="44" x2="40" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function GableIcon() {
  return (
    <svg width="64" height="42" viewBox="0 0 80 52" fill="none">
      <rect x="8" y="8" width="64" height="36" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="26" x2="72" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function HipIcon() {
  return (
    <svg width="64" height="42" viewBox="0 0 80 52" fill="none">
      <rect x="8" y="8" width="64" height="36" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="26" x2="52" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="8" x2="28" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="72" y1="8" x2="52" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="72" y1="44" x2="52" y2="26" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="44" x2="28" y2="26" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * 2D plan-view of the footprint with split lines drawn over it — gives the
 * user a clear "this is where the cuts will fall" preview before they commit.
 * For `floors` mode the lines are conceptual (the 3D preview already shows
 * horizontal storey divisions); for `sides` mode we draw N-1 perpendicular
 * cuts along the long axis of the AABB.
 */
function SplitPreview({
  footprint,
  splitMode,
  splitCount,
  splitAxis = 'auto',
}: {
  footprint: [number, number][];
  splitMode: 'none' | 'floors' | 'sides';
  splitCount: number;
  splitAxis?: SplitAxis;
}) {
  const { svgPath, splitLines } = useMemo(() => {
    if (footprint.length < 3) {
      return { svgPath: '', splitLines: [] };
    }
    // Normalize to 0..1 then scale to 100×60 viewBox
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of footprint) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    // Aspect-preserve fit inside 100×60 with 6 px padding
    const targetW = 88;
    const targetH = 48;
    const scale = Math.min(targetW / w, targetH / h);
    const drawW = w * scale;
    const drawH = h * scale;
    const ox = 6 + (targetW - drawW) / 2;
    const oy = 6 + (targetH - drawH) / 2;
    const px = (x: number) => ox + (x - minX) * scale;
    // SVG y is flipped relative to map y — invert so north is up.
    const py = (y: number) => oy + (maxY - y) * scale;
    const path =
      'M ' +
      footprint
        .map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`)
        .join(' L ') +
      ' Z';
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    if (splitMode === 'sides' && splitCount >= 2 && footprint.length >= 4) {
      // Compute the AABB long axis and draw N-1 cuts perpendicular to it.
      // For a non-rectangular polygon this is approximate — but the
      // generator's split-by-side also assumes rectangular-ish footprints.
      const naturalLongX = w >= h;
      const longAlongX = splitAxis === 'shorter' ? !naturalLongX : naturalLongX;
      for (let i = 1; i < splitCount; i++) {
        const t = i / splitCount;
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
  }, [footprint, splitMode, splitCount, splitAxis]);

  if (splitMode === 'none' || splitCount < 2 || !svgPath) return null;

  return (
    <div className="mt-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
      <div className="mb-1 text-[10px] text-[var(--text-dim)]">
        {splitMode === 'sides'
          ? `Plan view: ${splitCount} side-by-side parts along the long axis`
          : `Plan view: ${splitCount} stacked floor-parts (cuts shown in 3D preview)`}
      </div>
      <svg viewBox="0 0 100 60" className="w-full" style={{ height: 80 }}>
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

// ─── Preview-doc helpers ──────────────────────────────────────────────────

function hashForm(form: NewBuildingForm): number {
  return Math.round(
    form.totalHeight * 1000 +
      form.storeys * 100 +
      form.roofHeight * 10 +
      (form.addWindows ? 1 : 0) +
      (form.addDoor ? 2 : 0) +
      form.eaveOverhang * 5 +
      form.rakeOverhang * 7 +
      (form.roofType === 'flat' ? 1000000 : 0) +
      (form.roofType === 'pyramid' ? 2000000 : 0) +
      (form.roofType === 'gable' ? 3000000 : 0) +
      (form.roofType === 'hip' ? 4000000 : 0)
  );
}

function buildPreviewDoc(
  footprint: [number, number][],
  form: NewBuildingForm,
  hostDoc: CityJsonDocument
): CityJsonDocument | null {
  const crs = detectCrs(hostDoc);
  if (!crs.supported) return null;

  try {
    const eaveHeight =
      form.roofType === 'flat'
        ? form.totalHeight
        : form.totalHeight - form.roofHeight;
    const doc: CityJsonDocument = {
      type: 'CityJSON',
      version: hostDoc.version,
      metadata: hostDoc.metadata ? { ...hostDoc.metadata } : undefined,
      transform: hostDoc.transform
        ? {
            scale: [...hostDoc.transform.scale],
            translate: [...hostDoc.transform.translate],
          }
        : { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] },
      CityObjects: {},
      vertices: [],
    };
    const result = generateBuilding(doc, {
      targetCrs: crs.code,
      footprintWgs84: footprint,
      storeys: form.storeys,
      eaveHeight,
      ridgeHeight: form.totalHeight,
      roofType: form.roofType,
      attributes: { function: form.function },
      openings:
        form.addWindows || form.addDoor
          ? { windows: form.addWindows, door: form.addDoor }
          : undefined,
      eaveOverhang: form.eaveOverhang,
      rakeOverhang: form.rakeOverhang,
    });
    insertBuilding(doc, result);
    return doc;
  } catch {
    return null;
  }
}

function estimateMassingMetrics(footprint: [number, number][], form: NewBuildingForm) {
  const footprintAreaM2 = estimateWgs84PolygonAreaM2(footprint);
  return {
    footprintAreaM2,
    grossFloorAreaM2: footprintAreaM2 * form.storeys,
    volumeM3: footprintAreaM2 * form.totalHeight,
  };
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString();
}

function estimateWgs84PolygonAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const latRef = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((latRef * Math.PI) / 180);

  // Project the tiny drawn footprint to a local metre grid, then use the
  // shoelace formula. This is accurate enough for a create-time massing hint
  // and avoids coupling the UI to a specific national CRS.
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lngA, latA] = ring[i];
    const [lngB, latB] = ring[(i + 1) % ring.length];
    const ax = lngA * metersPerDegreeLng;
    const ay = latA * metersPerDegreeLat;
    const bx = lngB * metersPerDegreeLng;
    const by = latB * metersPerDegreeLat;
    twiceArea += ax * by - bx * ay;
  }
  return Math.abs(twiceArea) / 2;
}
