import { useEffect, useMemo, useState } from 'react';
import { validateStoreyHeight, type RoofType } from '../lib/generator';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export interface NewBuildingForm {
  totalHeight: number;
  storeys: number;
  roofType: RoofType;
  /** Height of the pitched part of the roof (0 for flat). */
  roofHeight: number;
  function: string;
  yearOfConstruction: number | null;
}

interface Props {
  vertexCount: number;
  onFormChange?: (form: NewBuildingForm) => void;
  onCreate: (form: NewBuildingForm) => void;
  onCancel: () => void;
}

/**
 * Parameter dialog for a new building. Now built on shadcn/ui primitives.
 */
export default function NewBuildingDialog({
  vertexCount,
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

  useEffect(() => {
    if (storeysAutoSync) {
      const effectiveWalls = Math.max(2.4, totalHeight - (roofType === 'flat' ? 0 : roofHeight));
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
    }),
    [totalHeight, storeys, roofType, effectiveRoofHeight, func, year]
  );

  useEffect(() => {
    onFormChange?.(form);
  }, [form, onFormChange]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Building</DialogTitle>
          <DialogDescription>
            Footprint drawn with {vertexCount} vertices. The map shows a live preview as you
            adjust these values.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Row label="Total height (m)">
            <Input
              type="number"
              min={3}
              max={300}
              step="0.1"
              value={totalHeight}
              onChange={(e) => setTotalHeight(Math.max(3, Number(e.target.value) || 10))}
              autoFocus
            />
          </Row>

          <Row label="Roof type">
            <Select value={roofType} onValueChange={(v) => setRoofType(v as RoofType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">flat</SelectItem>
                <SelectItem value="pyramid">pyramid (any polygon)</SelectItem>
                <SelectItem value="gable">gable (rectangle)</SelectItem>
                <SelectItem value="hip">hip (rectangle)</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="my-2 h-px bg-[var(--border)]" />

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

          <Row label="Year of construction">
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
        </div>

        <DialogFooter>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Create Building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[45%_1fr] items-center gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
