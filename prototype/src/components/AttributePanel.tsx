import { useMemo, useState } from 'react';
import type { AttributeValue, CityJsonDocument } from '../types';
import { canSplitBuilding, MIN_STOREY_HEIGHT, MIN_SIDE_WIDTH } from '../lib/subdivision';
import type { PendingTransform } from '../lib/transform-preview';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Props {
  buildingId: string;
  cityjson: CityJsonDocument;
  isDirty: boolean;
  onAttributeChange: (id: string, key: string, value: AttributeValue) => void;
  onRevert: (id: string) => void;
  onClose: () => void;
  /** Subdivide: split this building into N stacked BuildingParts (one per floor). */
  onSplitByFloor?: (id: string, floorCount: number) => void;
  /** Subdivide: split this building into N side-by-side BuildingParts. */
  onSplitBySide?: (id: string, partCount: number) => void;
  /** Live-preview transform controls. When `pendingTransform` is non-null and
   *  matches this building, the panel shows a dedicated edit-position mode.
   *  `onStartTransform` begins the mode; `onUpdateTransform` pushes live
   *  changes (which the map previews); `onSaveTransform` commits; `onCancelTransform` reverts. */
  pendingTransform?: PendingTransform | null;
  onStartTransform?: (id: string) => void;
  onUpdateTransform?: (patch: Partial<Omit<PendingTransform, 'id'>>) => void;
  onCancelTransform?: () => void;
  onSaveTransform?: () => void;
  /** When true, skip rendering the header (parent container owns it). */
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
        // Prioritize common LoD2-relevant attrs at the top
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
    <div className="panel-body">
      <div className="panel-section">
        <div className="label">ID</div>
          <div className="value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {buildingId}
          </div>
        </div>

        {childCount > 0 && (
          <div className="panel-section">
            <div className="label">Parts (BuildingParts)</div>
            <div className="value">{childCount}</div>
          </div>
        )}

        <div className="panel-section">
          <div className="label">Attributes ({sortedKeys.length})</div>
          {sortedKeys.length === 0 ? (
            <div className="value" style={{ color: 'var(--text-faint)' }}>
              No attributes on this object.
            </div>
          ) : (
            sortedKeys.map((k) => (
              <AttributeRow
                key={k}
                attrKey={k}
                value={attrs[k]}
                onChange={(v) => onAttributeChange(buildingId, k, v)}
              />
            ))
          )}
        </div>

        <div className="panel-section">
          <div className="label">Actions</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={() => onRevert(buildingId)} disabled={!isDirty}>
              Revert this building
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
            Click <kbd>Reload view</kbd> in the toolbar to re-render with your edits,
            or <kbd>Export CityJSON</kbd> to save.
          </div>
        </div>

        {(onStartTransform || inTransformMode) && (
          <div
            className="panel-section"
            style={
              inTransformMode
                ? {
                    background: 'rgba(255, 150, 40, 0.08)',
                    border: '1px solid var(--select)',
                    borderRadius: 4,
                    padding: 8,
                  }
                : undefined
            }
          >
            <div className="label">Edit position</div>
            {!inTransformMode ? (
              <Button
                variant="primary"
                onClick={() => onStartTransform?.(buildingId)}
                className="mt-1 w-full"
              >
                ✦ Start editing position
              </Button>
            ) : (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                  Live preview on the map. Changes aren't written until you click Save.
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px 1fr',
                    gap: 4,
                    marginTop: 6,
                    alignItems: 'center',
                  }}
                >
                  <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>dX</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={pendingTransform!.dx}
                    onChange={(e) =>
                      onUpdateTransform?.({ dx: Number(e.target.value) || 0 })
                    }
                  />
                  <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>dY</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={pendingTransform!.dy}
                    onChange={(e) =>
                      onUpdateTransform?.({ dy: Number(e.target.value) || 0 })
                    }
                  />
                  <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>°</label>
                  <Input
                    type="number"
                    step="5"
                    value={pendingTransform!.angle}
                    onChange={(e) =>
                      onUpdateTransform?.({ angle: Number(e.target.value) || 0 })
                    }
                  />
                </div>

                <div style={{ display: 'flex', gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
                  {[-5, -1, 1, 5].map((d) => (
                    <Button
                      key={`x${d}`}
                      size="sm"
                      onClick={() =>
                        onUpdateTransform?.({ dx: pendingTransform!.dx + d })
                      }
                    >
                      E {d > 0 ? '+' : ''}
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
                      N {d > 0 ? '+' : ''}
                      {d}
                    </Button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
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
                    onClick={() =>
                      onUpdateTransform?.({ dx: 0, dy: 0, angle: 0 })
                    }
                    title="Reset dX/dY/angle to zero"
                  >
                    ⟲ Reset
                  </Button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)',
                  }}
                >
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
          </div>
        )}

        {(onSplitByFloor || onSplitBySide) && (
          <div className="panel-section">
            <div className="label">Subdivide into BuildingParts</div>
            {splitGate.ok ? (
              <>
                {onSplitByFloor && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      marginTop: 4,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60 }}>
                      Floors
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={floorCount}
                      onChange={(e) => setFloorCount(Math.max(2, Number(e.target.value) || 2))}
                      style={{ width: 50, fontSize: 11 }}
                    />
                    <button
                      onClick={() => onSplitByFloor(buildingId, floorCount)}
                      style={{ fontSize: 11 }}
                    >
                      Split by floor
                    </button>
                  </div>
                )}
                {onSplitBySide && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      marginTop: 4,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60 }}>
                      Sides
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={sideCount}
                      onChange={(e) => setSideCount(Math.max(2, Number(e.target.value) || 2))}
                      style={{ width: 50, fontSize: 11 }}
                    />
                    <button
                      onClick={() => onSplitBySide(buildingId, sideCount)}
                      style={{ fontSize: 11 }}
                    >
                      Split by side
                    </button>
                  </div>
                )}
                <div
                  style={{ marginTop: 6, fontSize: 10, color: 'var(--text-faint)' }}
                >
                  Min floor height: {MIN_STOREY_HEIGHT} m · min side width:{' '}
                  {MIN_SIDE_WIDTH} m. Side-split requires rectangular footprints.
                </div>
              </>
            ) : (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: 'var(--text-faint)',
                  fontStyle: 'italic',
                }}
              >
                {splitGate.reason}
              </div>
            )}
          </div>
        )}
    </div>
  );

  if (hideHeader) return content;

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <h3>
          {isDirty && <span className="dirty-dot" />}
          {obj?.type ?? 'Unknown'}
        </h3>
        <button onClick={onClose} aria-label="Close" style={{ padding: '2px 8px' }}>
          ×
        </button>
      </div>
      {content}
    </aside>
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
    <div className="attr-row">
      <label htmlFor={inputId} title={attrKey}>
        {attrKey}
      </label>
      {isBoolean ? (
        <select
          id={inputId}
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          style={{ fontSize: 11 }}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
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
