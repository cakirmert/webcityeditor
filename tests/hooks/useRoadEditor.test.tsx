import { readFileSync } from 'node:fs';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleCube, parseCityJsonAuto } from '../../src/lib/cityjson';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import {
  createManualRoadDraft,
  extractTransportationAreas,
  insertRoadIntoCityJson,
  readEditableRoadDraftFromCityObject,
  type RoadDraft,
} from '../../src/lib/transportation';
import { useRoadEditor } from '../../src/hooks/useRoadEditor';

const roadLine: [number, number][] = [
  [4.35704, 52.01158],
  [4.35742, 52.01164],
];

describe('useRoadEditor road-edit lifecycle', () => {
  it('opens imported Hamburg lane movements as reviewable proposals', () => {
    const parsed = parseCityJsonAuto(
      readFileSync(
        'public/data/transportation/osm2streets-hamburg-short-intersection.city.jsonl',
        'utf8'
      )
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const area = extractTransportationAreas(parsed.doc).find(
      (candidate) => candidate.roadId === 'osm2streets-road-0'
    );
    expect(area).toBeDefined();
    if (!area) return;
    const { result } = renderHook(() =>
      useRoadEditor(
        coreStateFor(parsed.doc) as never,
        { pushUndo: vi.fn() } as never
      )
    );

    act(() => result.current.handleEditSelectedRoadArea(area));

    expect(result.current.roadDraft?.laneMovementDecisions?.length).toBeGreaterThan(0);
    expect(
      result.current.roadDraft?.laneMovementDecisions?.every(
        (decision) =>
          decision.status === 'proposed' &&
          decision.provenance.source === 'osm2streets'
      )
    ).toBe(true);
    expect(result.current.roadDraftDirty).toBe(false);
  });

  it('keeps the selected map lane valid as the road layout changes', async () => {
    const doc = buildSampleCube();
    const { result } = renderHook(() =>
      useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never)
    );
    const draft = createManualRoadDraft(roadLine);

    act(() => {
      result.current.setShowRoadEditor(true);
      result.current.setRoadDraft(draft);
    });
    await waitFor(() => {
      expect(result.current.selectedRoadBand).toEqual({
        sectionId: draft.sections[0].id,
        bandIndex: 0,
      });
    });

    act(() =>
      result.current.setSelectedRoadBand({
        sectionId: draft.sections[0].id,
        bandIndex: draft.sections[0].bands.length - 1,
      })
    );
    act(() =>
      result.current.setRoadDraft({
        ...draft,
        sections: [
          {
            ...draft.sections[0],
            bands: draft.sections[0].bands.slice(0, 1),
          },
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.selectedRoadBand).toEqual({
        sectionId: draft.sections[0].id,
        bandIndex: 0,
      });
    });
  });

  it('clears every road highlight when the Roads workspace closes', async () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(roadLine);
    insertRoadIntoCityJson(doc, draft, { id: 'road-highlighted' });
    const area = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-highlighted'
    );
    expect(area).toBeDefined();
    if (!area) return;

    const { result } = renderHook(() =>
      useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never)
    );

    act(() => {
      result.current.setShowRoadEditor(true);
      result.current.setRoadDraft(draft);
      result.current.setSelectedRoadArea(area);
      result.current.setSelectedOsmRoadId('osm-road-1');
      result.current.setOsm2streetsSelection({
        kind: 'lane',
        feature: {
          type: 'Feature',
          properties: { road: 'osm-road-1', index: 0 },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      } as never);
      result.current.setHighlightedOsm2StreetsRoadIds(new Set(['osm-road-1']));
    });
    await waitFor(() => {
      expect(result.current.selectedRoadBand).not.toBeNull();
      expect(result.current.selectedRoadArea?.roadId).toBe('road-highlighted');
    });

    act(() => result.current.handleCloseRoadWorkspace());

    expect(result.current.showRoadEditor).toBe(false);
    expect(result.current.selectedRoadArea).toBeNull();
    expect(result.current.selectedRoadBand).toBeNull();
    expect(result.current.selectedOsmRoadId).toBeNull();
    expect(result.current.osm2streetsSelection).toBeNull();
    expect(result.current.highlightedOsm2StreetsRoadIds.size).toBe(0);
    expect(result.current.roadDraft).toEqual(draft);
  });

  it('reports mapped street-tree overlaps as non-blocking road-fit warnings', async () => {
    const doc = buildSampleCube();
    const midpoint: [number, number] = [
      (roadLine[0][0] + roadLine[1][0]) / 2,
      (roadLine[0][1] + roadLine[1][1]) / 2,
    ];
    const trees = [
      {
        id: 'tree-on-draft',
        position: [midpoint[0], midpoint[1], 0] as [number, number, number],
        trunkRadius: 0.2,
        species: 'Acer campestre',
        street: 'Teststraße',
      },
    ];
    const { result } = renderHook(() =>
      useRoadEditor(
        coreStateFor(doc) as never,
        { pushUndo: vi.fn() } as never,
        { trees }
      )
    );

    act(() => result.current.handleRoadLineDrawn(roadLine));

    await waitFor(() => {
      expect(
        result.current.roadFitConflicts.find(
          (conflict) => conflict.kind === 'tree_overlap'
        )
      ).toMatchObject({
        severity: 'warning',
        affectedId: 'tree-on-draft',
      });
    });
  });

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

  it('saves a lane-movement decision onto the connected peer Road', () => {
    const doc = buildSampleCube();
    const source = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    source.id = 'road-source';
    const peer = createManualRoadDraft(
      [...roadLine].reverse() as [number, number][],
      { maxspeedKmh: 30 }
    );
    peer.id = 'road-peer';
    source.laneMovementDecisions = [
      {
        id: 'movement-review',
        status: 'proposed',
        source: {
          roadId: source.id,
          sectionId: source.sections[0].id,
          endpoint: 'end',
          bandId: source.sections[0].bands[0].id!,
        },
        target: {
          roadId: peer.id,
          sectionId: peer.sections[0].id,
          endpoint: 'start',
          bandId: peer.sections[0].bands[0].id!,
        },
        mode: 'car',
        provenance: { source: 'user' },
      },
    ];
    insertRoadIntoCityJson(doc, source, { id: source.id });
    insertRoadIntoCityJson(doc, peer, { id: peer.id });
    const coreState = coreStateFor(doc);
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo: vi.fn() } as never)
    );
    const sourceArea = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === source.id
    )!;

    act(() => result.current.handleEditSelectedRoadArea(sourceArea));
    const reviewed = JSON.parse(
      JSON.stringify(result.current.roadDraft)
    ) as RoadDraft;
    reviewed.laneMovementDecisions![0].status = 'rejected';
    act(() =>
      result.current.handleRoadDraftChange(
        reviewed,
        'Reject lane movement'
      )
    );
    act(() => result.current.handleInsertRoad());

    expect(
      readEditableRoadDraftFromCityObject(doc.CityObjects[peer.id])
        ?.laneMovementDecisions?.[0]
    ).toMatchObject({
      id: 'movement-review',
      status: 'rejected',
      source: { roadId: peer.id },
      target: { roadId: source.id },
    });
    expect(result.current.roadStatus).toContain(
      'synchronized lane movements with 1 connected road'
    );
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
  });

  it('deletes a selected road and disconnects surviving editable roads', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, target, { id: 'road-target' });
    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      roadLine[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'road-target',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: roadLine[0],
        confirmed: true,
      },
    };
    source.laneMovementDecisions = [
      {
        id: 'movement-to-deleted-road',
        status: 'rejected',
        source: {
          roadId: 'road-source',
          sectionId: source.sections[0].id,
          endpoint: 'end',
          bandId: source.sections[0].bands[0].id!,
        },
        target: {
          roadId: 'road-target',
          sectionId: target.sections[0].id,
          endpoint: 'start',
          bandId: target.sections[0].bands[0].id!,
        },
        mode: 'car',
        provenance: { source: 'user' },
      },
    ];
    insertRoadIntoCityJson(doc, source, { id: 'road-source' });
    const targetArea = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-target'
    );
    expect(targetArea).toBeDefined();
    if (!targetArea) return;

    const coreState = coreStateFor(doc);
    const pushUndo = vi.fn();
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo } as never)
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => result.current.handleDeleteSelectedRoadArea(targetArea));

    expect(confirm).toHaveBeenCalledWith(
      'Delete road-target? Connected roads will be disconnected.'
    );
    expect(pushUndo).toHaveBeenCalledWith('Delete road-target');
    expect(doc.CityObjects['road-target']).toBeUndefined();
    const survivingSource = readEditableRoadDraftFromCityObject(
      doc.CityObjects['road-source']
    );
    expect(survivingSource?.sections[0].connections).toBeUndefined();
    expect(survivingSource?.laneMovementDecisions).toBeUndefined();
    expect(result.current.roadStatus).toBe(
      'Deleted road-target and cleared 1 reciprocal road connection.'
    );
    expect(coreState.setReloadToken).toHaveBeenCalledTimes(1);
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
    confirm.mockRestore();
  });

  it('requires confirmation before saving a moved endpoint that disconnects its peer', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, target, { id: 'road-target' });
    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      roadLine[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'road-target',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: roadLine[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'road-source' });
    const targetDraft = readEditableRoadDraftFromCityObject(doc.CityObjects['road-target'])!;
    targetDraft.sections[0].connections = {
      start: {
        target: 'cityjson',
        targetId: 'road-source',
        targetSectionId: source.sections[0].id,
        targetEndpoint: 'end',
        positionWgs84: roadLine[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, targetDraft, { id: 'road-target' });

    const coreState = coreStateFor(doc);
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo: vi.fn() } as never)
    );
    const sourceArea = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-source'
    )!;
    act(() => result.current.handleEditSelectedRoadArea(sourceArea));
    const moved = JSON.parse(JSON.stringify(result.current.roadDraft)) as RoadDraft;
    moved.sections[0].centerlineWgs84.at(-1)![0] += 0.0001;
    delete moved.sections[0].connections;
    act(() => result.current.handleRoadDraftChange(moved));

    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    act(() => result.current.handleInsertRoad());
    expect(confirm).toHaveBeenCalledWith(
      'This edit moved 1 confirmed connected road endpoint. Move the connected endpoint too and keep the join?'
    );
    expect(confirm).toHaveBeenCalledWith(
      'This edit leaves 1 confirmed reciprocal road join stale. Save and disconnect 1 connected road?'
    );
    expect(
      readEditableRoadDraftFromCityObject(doc.CityObjects['road-target'])?.sections[0].connections
    ).toBeDefined();

    act(() => result.current.handleInsertRoad());
    expect(
      readEditableRoadDraftFromCityObject(doc.CityObjects['road-target'])?.sections[0].connections
    ).toBeUndefined();
    expect(result.current.roadStatus).toContain('cleared 1 stale reciprocal road connection');
    expect(result.current.roadStatus).not.toContain('moved 1 connected road endpoint');
    confirm.mockRestore();
  });

  it('moves a generated peer endpoint when saving a connected road edit', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, target, { id: 'road-target' });
    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      roadLine[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'road-target',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: roadLine[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'road-source' });
    const targetDraft = readEditableRoadDraftFromCityObject(doc.CityObjects['road-target'])!;
    targetDraft.sections[0].connections = {
      start: {
        target: 'cityjson',
        targetId: 'road-source',
        targetSectionId: source.sections[0].id,
        targetEndpoint: 'end',
        positionWgs84: roadLine[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, targetDraft, { id: 'road-target' });

    const coreState = coreStateFor(doc);
    const { result } = renderHook(() =>
      useRoadEditor(coreState as never, { pushUndo: vi.fn() } as never)
    );
    const sourceArea = extractTransportationAreas(doc).find(
      (candidate) => candidate.roadId === 'road-source'
    )!;
    act(() => result.current.handleEditSelectedRoadArea(sourceArea));
    const moved = JSON.parse(JSON.stringify(result.current.roadDraft)) as RoadDraft;
    const movedPosition: [number, number] = [roadLine[0][0] + 0.0001, roadLine[0][1]];
    moved.sections[0].centerlineWgs84[moved.sections[0].centerlineWgs84.length - 1] =
      movedPosition;
    delete moved.sections[0].connections;
    act(() => result.current.handleRoadDraftChange(moved));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => result.current.handleInsertRoad());

    const savedSource = readEditableRoadDraftFromCityObject(doc.CityObjects['road-source'])!;
    const savedTarget = readEditableRoadDraftFromCityObject(doc.CityObjects['road-target'])!;
    expect(savedSource.sections[0].connections?.end).toMatchObject({
      targetId: 'road-target',
      targetEndpoint: 'start',
    });
    expect(savedTarget.sections[0].centerlineWgs84[0]).toEqual(movedPosition);
    expect(savedTarget.sections[0].connections?.start).toMatchObject({
      targetId: 'road-source',
      targetEndpoint: 'end',
    });
    expect(result.current.roadStatus).toContain('moved 1 connected road endpoint');
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
    confirm.mockRestore();
  });

  it('undoes and redoes unsaved road-draft changes before CityJSON is saved', () => {
    const doc = buildSampleCube();
    const savedDraft = createManualRoadDraft(roadLine, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, savedDraft, { id: 'road-existing' });
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
    const originalWidth = result.current.roadDraft!.sections[0].bands[0].widthM;
    act(() =>
      result.current.handleRoadDraftChange(
        withFirstBandWidth(result.current.roadDraft!, 4),
        'Change lane width'
      )
    );

    expect(result.current.roadDraftHistoryState.canUndo).toBe(true);
    expect(result.current.roadDraftDirty).toBe(true);

    act(() => result.current.handleUndoRoadDraft());
    expect(result.current.roadDraft?.sections[0].bands[0].widthM).toBe(originalWidth);
    expect(result.current.roadDraftDirty).toBe(false);
    expect(result.current.roadDraftHistoryState.canRedo).toBe(true);

    act(() => result.current.handleRedoRoadDraft());
    expect(result.current.roadDraft?.sections[0].bands[0].widthM).toBe(4);
    expect(result.current.roadDraftDirty).toBe(true);
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
