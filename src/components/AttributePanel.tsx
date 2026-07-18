import { useEffect, useMemo, useState } from 'react';
import type { AttributeValue, CityJsonDocument } from '../types';
import {
  canSplitBuilding,
  MIN_STOREY_HEIGHT,
  MIN_SIDE_WIDTH,
  type FloorPlanDivision,
  type SplitAxis,
} from '../lib/subdivision';
import { extractOpenings, type OpeningInfo } from '../lib/opening-edit';
import { extractFootprints } from '../lib/footprints';
import { USAGE_OPTIONS } from '../lib/footprint-tint';
import type { PendingTransform } from '../lib/transform-preview';
import { isTerrainMatched, type TerrainSnap } from '../lib/terrain';
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
  /** Split vertically and use an independently editable footprint plan for
   *  every floor. */
  onSplitByFloorPlans?: (
    id: string,
    heights: number[],
    floorPlans: FloorPlanDivision[]
  ) => void;
  /** Optional notifier — fires whenever the user is in custom-heights mode
   *  and the heights array changes. Lets the parent draw a live 3D preview
   *  of the split lines. `null` means "leave custom mode". */
  onCustomHeightsPreview?: (heights: number[] | null) => void;
  onFloorPlansPreview?: (plans: FloorPlanDivision[] | null) => void;
  onSplitBySide?: (id: string, partCount: number, axis: SplitAxis) => void;
  pendingTransform?: PendingTransform | null;
  terrainSnap?: TerrainSnap | null;
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
  /** Convert an imported building into one the editor's regenerate /
   *  footprint-edit / openings toolchain can work with. Replaces the
   *  original geometry with a parametric one inferred from attributes +
   *  vertex analysis. Distinct from regenerate so the user can opt in
   *  explicitly. */
  onMakeEditable?: (buildingId: string) => void;
  /** Re-run the parametric generator on the existing footprint with
   *  overridden roof / height / opening / overhang values. Lets the user
   *  switch roof type or raise the ridge without having to re-draw a
   *  footprint or delete & recreate the building. */
  onReshapeBuilding?: (
    buildingId: string,
    overrides: {
      roofType?: 'flat' | 'pyramid' | 'gable' | 'hip';
      eaveHeight?: number;
      ridgeHeight?: number;
      eaveOverhang?: number;
      rakeOverhang?: number;
      addWindows?: boolean;
      addDoor?: boolean;
    }
  ) => void;
  onSelectBuilding?: (id: string | null) => void;
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
  onSplitByFloorPlans,
  onCustomHeightsPreview,
  onFloorPlansPreview,
  onSplitBySide,
  pendingTransform,
  terrainSnap,
  onStartTransform,
  onUpdateTransform,
  onCancelTransform,
  onSaveTransform,
  inFootprintEdit = false,
  onStartFootprintEdit,
  onSaveFootprintEdit,
  onCancelFootprintEdit,
  onMoveOpening,
  onMakeEditable,
  onReshapeBuilding,
  onSelectBuilding,
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
  const transformDz = pendingTransform?.dz ?? 0;
  const autoTerrain = pendingTransform?.autoTerrain ?? true;
  const terrainMatched = isTerrainMatched(terrainSnap ?? null);
  const terrainRangeAnchor = terrainSnap?.requiredDz ?? transformDz;
  const terrainSliderMin = Math.min(-20, Math.floor(terrainRangeAnchor - 5), Math.floor(transformDz - 1));
  const terrainSliderMax = Math.max(20, Math.ceil(terrainRangeAnchor + 5), Math.ceil(transformDz + 1));
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
  const parentId = obj?.parents?.[0];
  const hasParent = parentId && cityjson.CityObjects[parentId];

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
  const essentialKeys = sortedKeys.filter((key) =>
    [
      'measuredHeight',
      'storeysAboveGround',
      'storeysBelowGround',
      'yearOfConstruction',
      'function',
      'usage',
      'roofType',
      'class',
    ].includes(key)
  );
  const sourceMetadataKeys = sortedKeys.filter((key) => !essentialKeys.includes(key));

  const content = (
    <div className="building-inspector-content flex-1 overflow-y-auto p-4 space-y-4">
      {hasParent && (
        <div className="mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectBuilding?.(parentId)}
            className="w-full text-xs flex items-center justify-center gap-1.5"
          >
            ← Back to Parent Building
          </Button>
        </div>
      )}
      <Section label="ID">
        <div className="break-all font-mono text-[11px] text-[var(--text)]">
          {buildingId}
        </div>
      </Section>

      {childCount > 0 && (
        <Section label="Parts (BuildingParts)">
          <div className="space-y-1">
            {obj.children?.map((childId, idx) => {
              const childObj = cityjson.CityObjects[childId];
              if (!childObj) return null;
              const childFunction = String(childObj.attributes?.function ?? 'unknown');
              return (
                <button
                  key={childId}
                  type="button"
                  onClick={() => onSelectBuilding?.(childId)}
                  className="w-full text-left flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <span className="font-medium">Floor {idx + 1}</span>
                  <span className="text-[var(--text-dim)] uppercase text-[10px]">{childFunction}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section label="Building details">
        {essentialKeys.length === 0 ? (
          <div className="text-xs italic text-[var(--text-faint)]">
            No common building details are available.
          </div>
        ) : (
          <div className="space-y-1.5">
            {essentialKeys.map((k) => (
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
          Changes stay local until you export CityJSON. Revert restores this building's loaded
          attributes.
        </div>
      </Section>

      {(onStartTransform || inTransformMode) && (
        <section
          className={`building-edit-tool ${
            inTransformMode
              ? 'rounded-md border border-[var(--select)] bg-[rgba(255,150,40,0.08)] p-3'
              : ''
          }`}
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
                Drag on the map to move the building. Auto terrain keeps its ground elevation
                aligned while you move; manual dZ overrides it.
              </div>
              <div className="mt-2 grid grid-cols-[36px_1fr] items-center gap-1.5">
                <Label>dX</Label>
                <Input
                  type="number"
                  aria-label="dX"
                  step="0.5"
                  value={pendingTransform!.dx}
                  onChange={(e) =>
                    onUpdateTransform?.({ dx: Number(e.target.value) || 0 })
                  }
                />
                <Label>dY</Label>
                <Input
                  type="number"
                  aria-label="dY"
                  step="0.5"
                  value={pendingTransform!.dy}
                  onChange={(e) =>
                    onUpdateTransform?.({ dy: Number(e.target.value) || 0 })
                  }
                />
                <Label>dZ</Label>
                <Input
                  type="number"
                  aria-label="dZ"
                  step="0.1"
                  value={transformDz}
                  onChange={(e) =>
                    onUpdateTransform?.({ dz: Number(e.target.value) || 0 })
                  }
                />
                <Label>°</Label>
                <Input
                  type="number"
                  aria-label="angle"
                  step="5"
                  value={pendingTransform!.angle}
                  onChange={(e) =>
                    onUpdateTransform?.({ angle: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="mt-2 rounded border border-[var(--border)] bg-[rgba(0,0,0,0.18)] p-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[var(--text-dim)]">Manual height offset</span>
                  <span className="font-mono text-[var(--text)]">{transformDz.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  aria-label="dZ terrain offset slider"
                  min={terrainSliderMin}
                  max={terrainSliderMax}
                  step="0.1"
                  value={transformDz}
                  onChange={(e) => onUpdateTransform?.({ dz: Number(e.target.value) || 0 })}
                  className="mt-1 w-full accent-[var(--accent)]"
                />
                {terrainSnap ? (
                  <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                    Terrain {terrainSnap.terrainElevation.toFixed(2)} m · ground{' '}
                    {terrainSnap.currentGroundElevation.toFixed(2)} m ·{' '}
                    {terrainMatched ? (
                      <span className="text-[var(--ok)]">ground matches terrain</span>
                    ) : (
                      <span className="text-[var(--warn)]">
                        {terrainSnap.difference > 0 ? 'raise' : 'lower'}{' '}
                        {Math.abs(terrainSnap.difference).toFixed(2)} m
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                    No terrain estimate is available for this document.
                  </div>
                )}
                {terrainSnap && (
                  <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                    Source: {terrainSnap.matchedBuildingId} ·{' '}
                    {terrainSnap.terrainSource.replaceAll('-', ' ')}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={autoTerrain ? 'primary' : 'outline'}
                    onClick={() => onUpdateTransform?.({ autoTerrain: !autoTerrain })}
                  >
                    Auto terrain {autoTerrain ? 'on' : 'off'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!terrainSnap}
                    onClick={() =>
                      terrainSnap &&
                      onUpdateTransform?.({ dz: terrainSnap.requiredDz, autoTerrain: true })
                    }
                  >
                    Snap ground to terrain
                  </Button>
                </div>
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
                  onClick={() =>
                    onUpdateTransform?.({ dx: 0, dy: 0, dz: 0, angle: 0, autoTerrain: true })
                  }
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
                    (pendingTransform!.dx === 0 &&
                      pendingTransform!.dy === 0 &&
                      transformDz === 0 &&
                      pendingTransform!.angle === 0) ||
                    (!!terrainSnap && !terrainMatched)
                  }
                >
                  ✓ Place
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
          className={`building-edit-tool ${
            inFootprintEdit
              ? 'rounded-md border border-[var(--select)] bg-[rgba(255,150,40,0.08)] p-3'
              : ''
          }`}
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
            ) : onMakeEditable ? (
              <div className="space-y-1.5">
                <div className="text-[11px] text-[var(--text-faint)] italic">
                  This building was imported — its original geometry is
                  read-only. Make it editable to enable footprint editing,
                  roof-type changes, openings, and overhangs.
                </div>
                <Button
                  variant="primary"
                  onClick={() => onMakeEditable(buildingId)}
                  className="w-full"
                  title="Replaces the imported geometry with a parametric regeneration inferred from its attributes (roof type, height, storeys). Original detail is lost; the building becomes fully editable."
                >
                  ✦ Make editable (replace with parametric)
                </Button>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-faint)] italic">
                Available only for buildings created in the editor.
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

      {onReshapeBuilding && attrs._createdBy === 'city-editor-prototype' && (
        <ReshapeSection
          buildingId={buildingId}
          attrs={attrs}
          onReshape={onReshapeBuilding}
        />
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

      {(onSplitByFloor || onSplitBySide || onSplitByFloorPlans) && (
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
              {onSplitByFloorPlans && (
                <FloorPlanEditor
                  cityjson={cityjson}
                  buildingId={buildingId}
                  floorCount={floorCount}
                  heights={
                    customHeights ??
                    new Array(floorCount).fill(splitGate.params!.eaveHeight / floorCount)
                  }
                  onPreview={onFloorPlansPreview}
                  onApply={(heights, plans) =>
                    onSplitByFloorPlans(buildingId, heights, plans)
                  }
                />
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

      {sourceMetadataKeys.length > 0 && (
        <details className="building-technical-attributes">
          <summary>
            <span>Source metadata</span>
            <small>{sourceMetadataKeys.length} technical fields</small>
          </summary>
          <div className="mt-3 space-y-1.5">
            {sourceMetadataKeys.map((key) => (
              <AttributeRow
                key={key}
                attrKey={key}
                value={attrs[key]}
                onChange={(value) => onAttributeChange(buildingId, key, value)}
              />
            ))}
          </div>
        </details>
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
    <section className="attribute-section">
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

function FloorPlanEditor({
  cityjson,
  buildingId,
  floorCount,
  heights,
  onPreview,
  onApply,
}: {
  cityjson: CityJsonDocument;
  buildingId: string;
  floorCount: number;
  heights: number[];
  onPreview?: (plans: FloorPlanDivision[] | null) => void;
  onApply: (heights: number[], plans: FloorPlanDivision[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [applyAllFloors, setApplyAllFloors] = useState(true);
  const [plans, setPlans] = useState<FloorPlanDivision[]>(() =>
    makeFloorPlans(floorCount)
  );

  useEffect(() => {
    setPlans((prev) => {
      const fallback = prev[0] ?? defaultFloorPlan();
      return new Array(floorCount)
        .fill(null)
        .map((_, i) => cloneFloorPlan(prev[i] ?? fallback));
    });
  }, [floorCount]);

  useEffect(() => {
    onPreview?.(open ? plans : null);
    return () => onPreview?.(null);
  }, [open, plans, onPreview]);

  const updatePlan = (floorIndex: number, patch: Partial<FloorPlanDivision>) => {
    setPlans((prev) => {
      const source = { ...(prev[floorIndex] ?? defaultFloorPlan()), ...patch };
      const nextPlan = normaliseFloorPlan(source);
      if (applyAllFloors) {
        return new Array(floorCount).fill(null).map(() => cloneFloorPlan(nextPlan));
      }
      const next = prev.map(cloneFloorPlan);
      next[floorIndex] = nextPlan;
      return next;
    });
  };

  const setCut = (floorIndex: number, cutIndex: number, percent: number) => {
    const current = plans[floorIndex] ?? defaultFloorPlan();
    const cuts = normaliseFloorPlan(current).cutFractions ?? [];
    cuts[cutIndex] = percent / 100;
    updatePlan(floorIndex, { cutFractions: cuts });
  };

  const validHeights =
    heights.length === floorCount &&
    heights.every((h) => h >= MIN_STOREY_HEIGHT) &&
    Number.isFinite(heights.reduce((sum, h) => sum + h, 0));
  const editorFloors = applyAllFloors ? [0] : plans.map((_, i) => i);

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium">Footprint sections per floor</div>
          <div className="text-[10px] text-[var(--text-faint)]">
            Divide each floor plan and preview every section before applying.
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Edit plans'}
        </Button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={applyAllFloors}
              onChange={(e) => {
                const checked = e.target.checked;
                setApplyAllFloors(checked);
                if (checked) {
                  const first = cloneFloorPlan(plans[0] ?? defaultFloorPlan());
                  setPlans(new Array(floorCount).fill(null).map(() => cloneFloorPlan(first)));
                }
              }}
              className="h-3.5 w-3.5"
            />
            <span>Use the same floor plan for all floors</span>
          </label>

          {editorFloors.map((floorIndex) => {
            const plan = plans[floorIndex] ?? defaultFloorPlan();
            return (
              <div
                key={floorIndex}
                className="rounded border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                <div className="mb-1 text-[10px] font-medium text-[var(--text-dim)]">
                  {applyAllFloors ? 'All floors' : `Floor ${floorIndex + 1}`}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Label>Sections</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={plan.partCount}
                    onChange={(e) =>
                      updatePlan(floorIndex, {
                        partCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-14"
                  />
                  <Label>Axis</Label>
                  {(['auto', 'longer', 'shorter'] as const).map((axis) => (
                    <button
                      key={axis}
                      type="button"
                      onClick={() => updatePlan(floorIndex, { axis })}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        plan.axis === axis
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)]'
                      }`}
                    >
                      {axis}
                    </button>
                  ))}
                </div>
                {plan.partCount > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(plan.cutFractions ?? equalCuts(plan.partCount)).map((cut, cutIndex) => (
                      <label
                        key={cutIndex}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]"
                      >
                        Cut {cutIndex + 1}
                        <Input
                          aria-label={`Cut ${cutIndex + 1} percent`}
                          type="number"
                          min={1}
                          max={99}
                          step={1}
                          value={(cut * 100).toFixed(0)}
                          onChange={(e) =>
                            setCut(floorIndex, cutIndex, Number(e.target.value) || 0)
                          }
                          className="w-14"
                        />
                        %
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {plans.map((plan, floorIndex) => (
              <SidePlanPreview
                key={floorIndex}
                cityjson={cityjson}
                buildingId={buildingId}
                sideCount={plan.partCount}
                axis={plan.axis}
                cutFractions={plan.cutFractions}
                title={`Floor ${floorIndex + 1}: ${plan.partCount} section${
                  plan.partCount === 1 ? '' : 's'
                }`}
              />
            ))}
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">
            Manual cuts must stay ordered and leave at least {MIN_SIDE_WIDTH} m
            per section. A subdivided top floor uses flat section roofs.
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={!validHeights}
            onClick={() => onApply(heights, plans)}
            className="w-full"
          >
            Apply floor plans
          </Button>
        </div>
      )}
    </div>
  );
}

function defaultFloorPlan(): FloorPlanDivision {
  return { partCount: 2, axis: 'auto', cutFractions: [0.5] };
}

function makeFloorPlans(count: number): FloorPlanDivision[] {
  return new Array(count).fill(null).map(() => defaultFloorPlan());
}

function equalCuts(partCount: number): number[] {
  return new Array(Math.max(0, partCount - 1))
    .fill(0)
    .map((_, i) => (i + 1) / partCount);
}

function normaliseFloorPlan(plan: FloorPlanDivision): FloorPlanDivision {
  const partCount = Math.max(1, Math.min(8, Math.round(plan.partCount)));
  const cuts =
    plan.cutFractions?.length === partCount - 1
      ? [...plan.cutFractions]
      : equalCuts(partCount);
  return { partCount, axis: plan.axis, cutFractions: cuts };
}

function cloneFloorPlan(plan: FloorPlanDivision): FloorPlanDivision {
  return {
    ...plan,
    cutFractions: plan.cutFractions ? [...plan.cutFractions] : undefined,
  };
}

function AttributeRow({ attrKey, value, onChange }: RowProps) {
  const isNumber = typeof value === 'number';
  const isBoolean = typeof value === 'boolean';
  const isStructured =
    value !== null && value !== undefined && typeof value === 'object';
  const inputId = `attr-${attrKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <div className="grid grid-cols-[45%_1fr] items-center gap-1.5">
      <Label htmlFor={inputId} title={attrKey} className="truncate">
        {attrKey}
      </Label>
      {isStructured ? (
        <textarea
          id={inputId}
          value={JSON.stringify(value, null, 2)}
          readOnly
          title="Structured editor metadata is shown read-only."
          className="min-h-16 resize-y rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-[10px] text-[var(--text-dim)]"
        />
      ) : isBoolean ? (
        <select
          id={inputId}
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)]"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : attrKey === 'function' ? (
        <select
          id={inputId}
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] font-sans"
        >
          {USAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {value != null && !USAGE_OPTIONS.some((option) => option === String(value)) && (
            <option value={String(value)}>{String(value)}</option>
          )}
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
 * Inline "Reshape" controls — lets the user switch roof type, raise the
 * ridge, toggle openings, and dial overhangs on a parametric building, then
 * re-runs the generator in place. The visual roof picker mirrors the one in
 * BuildingCreator so the UX is consistent between create-time and edit-time.
 */
function ReshapeSection({
  buildingId,
  attrs,
  onReshape,
}: {
  buildingId: string;
  attrs: Record<string, AttributeValue>;
  onReshape: (
    id: string,
    overrides: {
      roofType?: 'flat' | 'pyramid' | 'gable' | 'hip';
      eaveHeight?: number;
      ridgeHeight?: number;
      eaveOverhang?: number;
      rakeOverhang?: number;
      addWindows?: boolean;
      addDoor?: boolean;
    }
  ) => void;
}) {
  const currentRoof = (attrs.roofType as 'flat' | 'pyramid' | 'gable' | 'hip') ?? 'flat';
  const currentEave = Number(attrs._eaveHeight ?? 0);
  const currentRidge = Number(attrs._ridgeHeight ?? 0);
  const currentEaveOverhang = Number(attrs._eaveOverhang ?? 0);
  const currentRakeOverhang = Number(attrs._rakeOverhang ?? 0);
  const currentAddWindows = Boolean(attrs._addWindows);
  const currentAddDoor = Boolean(attrs._addDoor);

  const [roofType, setRoofType] = useState(currentRoof);
  const [eave, setEave] = useState(currentEave);
  const [ridge, setRidge] = useState(currentRidge);
  const [eaveOverhang, setEaveOverhang] = useState(currentEaveOverhang);
  const [rakeOverhang, setRakeOverhang] = useState(currentRakeOverhang);
  const [addWindows, setAddWindows] = useState(currentAddWindows);
  const [addDoor, setAddDoor] = useState(currentAddDoor);

  // Re-seed local state whenever the selected building changes.
  useEffect(() => {
    setRoofType(currentRoof);
    setEave(currentEave);
    setRidge(currentRidge);
    setEaveOverhang(currentEaveOverhang);
    setRakeOverhang(currentRakeOverhang);
    setAddWindows(currentAddWindows);
    setAddDoor(currentAddDoor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const isDirty =
    roofType !== currentRoof ||
    Math.abs(eave - currentEave) > 1e-3 ||
    Math.abs(ridge - currentRidge) > 1e-3 ||
    Math.abs(eaveOverhang - currentEaveOverhang) > 1e-3 ||
    Math.abs(rakeOverhang - currentRakeOverhang) > 1e-3 ||
    addWindows !== currentAddWindows ||
    addDoor !== currentAddDoor;

  const apply = () => {
    onReshape(buildingId, {
      roofType,
      eaveHeight: roofType === 'flat' ? ridge : eave,
      ridgeHeight: ridge,
      eaveOverhang: roofType === 'flat' ? eaveOverhang : 0,
      rakeOverhang: 0,
      addWindows,
      addDoor,
    });
  };
  const reset = () => {
    setRoofType(currentRoof);
    setEave(currentEave);
    setRidge(currentRidge);
    setEaveOverhang(currentEaveOverhang);
    setRakeOverhang(currentRakeOverhang);
    setAddWindows(currentAddWindows);
    setAddDoor(currentAddDoor);
  };

  return (
    <Section label="Reshape (roof, height, openings)">
      <div className="grid grid-cols-4 gap-1.5">
        {(['flat', 'pyramid', 'gable', 'hip'] as const).map((rt) => (
          <button
            key={rt}
            type="button"
            onClick={() => setRoofType(rt)}
            className={`rounded-md border px-1.5 py-1 text-[10px] transition-colors ${
              roofType === rt
                ? 'border-[var(--accent)] bg-[rgba(76,126,255,0.12)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
            title={rt}
          >
            {rt}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex items-center gap-1 text-[11px]">
          <span className="text-[var(--text-dim)] w-12">Ridge</span>
          <Input
            type="number"
            min={0.5}
            max={300}
            step="0.1"
            value={ridge}
            onChange={(e) => setRidge(Math.max(0.5, Number(e.target.value) || ridge))}
          />
        </label>
        {roofType !== 'flat' && (
          <label className="flex items-center gap-1 text-[11px]">
            <span className="text-[var(--text-dim)] w-12">Eave</span>
            <Input
              type="number"
              min={0.5}
              max={Math.max(0.5, ridge - 0.5)}
              step="0.1"
              value={eave}
              onChange={(e) =>
                setEave(
                  Math.min(Math.max(0.5, Number(e.target.value) || eave), Math.max(0.5, ridge - 0.5))
                )
              }
            />
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex items-center gap-1 text-[11px]">
          <span className="text-[var(--text-dim)] w-12">Eave OH</span>
          <Input
            type="number"
            min={0}
            max={2}
            step="0.1"
            value={eaveOverhang}
            disabled={roofType !== 'flat'}
            onChange={(e) => setEaveOverhang(Math.max(0, Number(e.target.value) || 0))}
            title={
              roofType === 'flat'
                ? 'Flat roof eave overhang in metres'
                : 'Pitched roof overhangs are disabled until a validated slab model is available'
            }
          />
        </label>
        {roofType === 'gable' && (
          <label className="flex items-center gap-1 text-[11px]">
            <span className="text-[var(--text-dim)] w-12">Rake OH</span>
            <Input
              type="number"
              min={0}
              max={0}
              step="0.1"
              value={rakeOverhang}
              disabled
              onChange={() => setRakeOverhang(0)}
              title="Rake overhangs are disabled until a validated pitched roof-slab model is available"
            />
          </label>
        )}
      </div>
      <div className="text-[10px] text-[var(--warn)]">
        Flat eave overhangs use a validated 0.25 m roof slab. Pitched and rake overhangs remain disabled.
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
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
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="primary"
          disabled={!isDirty}
          onClick={apply}
          className="flex-1"
        >
          Apply reshape
        </Button>
        <Button size="sm" disabled={!isDirty} onClick={reset}>
          Reset
        </Button>
      </div>
    </Section>
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
  cutFractions,
  title,
}: {
  cityjson: CityJsonDocument;
  buildingId: string;
  sideCount: number;
  axis?: SplitAxis;
  cutFractions?: number[];
  title?: string;
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
      const cuts =
        cutFractions?.length === sideCount - 1 ? cutFractions : equalCuts(sideCount);
      for (const t of cuts) {
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
  }, [cityjson, buildingId, sideCount, axis, cutFractions]);

  if (!svgPath) return null;

  return (
    <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
      <div className="mb-1 text-[10px] text-[var(--text-dim)]">
        {title ?? `Plan view: ${sideCount} parts along the selected axis`}
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
