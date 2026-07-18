import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import {
  createManualRoadDraft,
  extractTransportationAreas,
  insertRoadIntoCityJson,
  type RoadDraft,
} from '../../src/lib/transportation';
import { useRoadEditor } from '../../src/hooks/useRoadEditor';

const roadLine: [number, number][] = [
  [4.35704, 52.01158],
  [4.35742, 52.01164],
];

describe('useRoadEditor road-edit lifecycle', () => {
  it('clears stale road status when a different dataset is loaded', () => {
    const doc = buildSampleCube();
    const { result } = renderHook(() =>
      useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never)
    );

    act(() => result.current.setRoadStatus('Roads ready: old dataset'));
    expect(result.current.roadStatus).toContain('old dataset');

    act(() => result.current.clearOsmRoadData());
    expect(result.current.roadStatus).toBeNull();
    expect(result.current.osmRoads).toEqual([]);
    expect(result.current.osm2streetsResult).toBeNull();
  });

  it('cancels a dirty road draft without changing the saved CityJSON road', () => {
    const doc = buildSampleCube();
    const savedDraft = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, savedDraft, { id: 'road-existing' });
    const before = JSON.stringify(doc.CityObjects['road-existing']);
    const coreState = coreStateFor(doc);
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo: vi.fn() } as never)
    );
    const area = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-existing'
    );
    expect(area).toBeDefined();
    if (!area) return;

    act(() => result.current.handleEditSelectedRoadArea(area));
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, 4)));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => result.current.handleCancelRoadEdit());

    expect(confirm).toHaveBeenCalledWith('Discard the unsaved road-edit draft?');
    expect(result.current.roadDraft).toBeNull();
    expect(result.current.roadDraftDirty).toBe(false);
    expect(result.current.editingRoadId).toBeNull();
    expect(JSON.stringify(doc.CityObjects['road-existing'])).toBe(before);
    expect(coreState.setDrawMode).toHaveBeenCalledWith('none');
    expect(coreState.setSelection).toHaveBeenCalledWith(null);
    confirm.mockRestore();
  });

  it('saves edits back onto the existing Road id without leaving orphaned vertices', () => {
    const doc = buildSampleCube();
    const savedDraft = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, savedDraft, { id: 'road-existing' });
    doc.CityObjects['road-existing'].attributes!.reviewNote = 'keep this provenance';
    const createdAt = doc.CityObjects['road-existing'].attributes!._createdAt;
    const coreState = coreStateFor(doc);
    const pushUndo = vi.fn();
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo } as never)
    );
    const area = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-existing'
    );
    expect(area).toBeDefined();
    if (!area) return;

    act(() => result.current.handleEditSelectedRoadArea(area));
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, 4)));
    act(() => result.current.handleInsertRoad());

    const roadIds = Object.entries(doc.CityObjects)
      .filter(([, object]) => object.type === 'Road')
      .map(([id]) => id);
    expect(roadIds).toEqual(['road-existing']);
    expect(pushUndo).toHaveBeenCalledWith('Update CityJSON road');
    expect(result.current.roadDraftDirty).toBe(false);
    expect(result.current.editingRoadId).toBe('road-existing');
    expect(doc.CityObjects['road-existing'].attributes).toMatchObject({
      reviewNote: 'keep this provenance',
      _createdAt: createdAt,
    });
    expect(doc.CityObjects['road-existing'].attributes?._updatedAt).toEqual(expect.any(String));
    expect(
      extractTransportationAreas(doc).find((candidate) => candidate.roadId === 'road-existing')
        ?.editableDraft?.sections[0].bands[0].widthM
    ).toBe(4);
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
  });
});

function withFirstBandWidth(draft: RoadDraft, widthM: number): RoadDraft {
  const next = JSON.parse(JSON.stringify(draft)) as RoadDraft;
  next.sections[0].bands[0].widthM = widthM;
  return next;
}

function coreStateFor(cityjson: ReturnType<typeof buildSampleCube>) {
  return {
    cityjson,
    setSelection: vi.fn(),
    setDirtyIds: vi.fn(),
    setReloadToken: vi.fn(),
    setDrawMode: vi.fn(),
    markGeometryChanged: vi.fn(),
    reloadToken: 0,
    mapBboxRef: { current: null },
  };
}
