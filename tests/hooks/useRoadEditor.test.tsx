import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSampleCube } from '../../src/lib/cityjson';
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
  it('allows explicit width-policy exceptions but still refuses non-positive geometry', () => {
    const doc = buildSampleCube();
    insertRoadIntoCityJson(doc, createManualRoadDraft(roadLine), { id: 'edited' });
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    act(() => result.current.handleEditSelectedRoadArea(extractTransportationAreas(doc).find(area => area.roadId === 'edited')!));
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, 40)));
    act(() => result.current.handleInsertRoad({ allowWarnings: true }));
    expect(result.current.roadDraftDirty).toBe(false); expect(result.current.savedFitReview?.warnings.some(issue => /project limit/.test(issue.label))).toBe(true);
    const saved = JSON.stringify(doc);
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, -1)));
    act(() => result.current.handleInsertRoad({ allowWarnings: true }));
    expect(JSON.stringify(doc)).toBe(saved); expect(result.current.roadDraftDirty).toBe(true);
  });
  it('switches roads without discarding drafts and restores each undo history', () => {
    const doc = buildSampleCube();
    for (const id of ['one', 'two']) insertRoadIntoCityJson(doc, createManualRoadDraft(roadLine), { id });
    const before = JSON.stringify(doc), confirm = vi.spyOn(window, 'confirm');
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    const areas = extractTransportationAreas(doc);
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === 'one')!));
    act(() => result.current.handleRoadDraftChange({ ...result.current.roadDraft!, name: 'First edit' }));
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === 'one')!));
    expect(result.current.roadDraft?.name).toBe('First edit');
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === 'two')!));
    expect(result.current.editingRoadId).toBe('two'); expect(result.current.parkedDrafts).toHaveLength(1);
    act(() => result.current.handleRoadDraftChange({ ...result.current.roadDraft!, name: 'Second edit' }));
    act(() => result.current.handleResumeDraft('one'));
    expect(result.current.roadDraft?.name).toBe('First edit'); expect(result.current.parkedDrafts[0].id).toBe('two');
    act(() => result.current.handleUndoRoadDraft());
    expect(result.current.roadDraft?.name).not.toBe('First edit');
    expect(confirm).not.toHaveBeenCalled(); expect(JSON.stringify(doc)).toBe(before);
    confirm.mockRestore();
  });
  it('retains a generated intersection draft when switching to an approach and back', () => {
    const doc = JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt-source.json', 'utf8'));
    const areas = extractTransportationAreas(doc), area = areas.find(area => area.roadId.endsWith('intersection-483'))!;
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    act(() => result.current.handleEditSelectedRoadArea(area));
    act(() => result.current.handleJunctionChange({ ...result.current.junctionDraft!, surfaceMode: 'rebuild', footprint: undefined }));
    const generated = result.current.junctionDraft;
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === generated!.roadIds[0])!));
    expect(result.current.junctionDraft).toBeNull(); expect(result.current.parkedDrafts).toHaveLength(1);
    act(() => result.current.handleEditSelectedRoadArea(area));
    expect(result.current.junctionDraft).toEqual(generated); expect(result.current.canUndoJunction).toBe(true);
    act(() => result.current.handleSaveJunction()); expect(result.current.junctionSaveError).toBeNull();
  });
  it('saves an overlapping road only with explicit warning acceptance and records the visible warnings', () => {
    const doc = buildSampleCube(), bands = [{ kind: 'car_lane' as const, widthM: 3.25, direction: 'forward' as const }];
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]], { bands }), { id: 'edited' });
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.050032], [4.401, 52.050032]], { bands }), { id: 'neighbour' });
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    act(() => result.current.handleEditSelectedRoadArea(extractTransportationAreas(doc).find(area => area.roadId === 'edited')!));
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, 4.8), 'Widen road'));
    act(() => result.current.handleInsertRoad({ allowWarnings: true }));
    expect(result.current.roadDraftDirty).toBe(false);
    expect(result.current.savedFitReview?.warnings.some(item => /overlaps/.test(item.label))).toBe(true);
    const saved = JSON.parse(JSON.stringify(doc));
    expect(saved.CityObjects.edited.attributes._roadFitReview.warnings.length).toBeGreaterThan(0);
  });
  it('does not overwrite a parked road changed by another saved edit', () => {
    const doc = buildSampleCube();
    for (const id of ['one', 'two']) insertRoadIntoCityJson(doc, createManualRoadDraft(roadLine), { id });
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    const areas = extractTransportationAreas(doc);
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === 'one')!));
    act(() => result.current.handleRoadDraftChange({ ...result.current.roadDraft!, name: 'Parked edit' }));
    act(() => result.current.handleEditSelectedRoadArea(areas.find(area => area.roadId === 'two')!));
    doc.CityObjects.one.attributes!.name = 'A newer saved edit';
    act(() => result.current.handleResumeDraft('one'));
    act(() => result.current.handleInsertRoad({ allowWarnings: true }));
    expect(doc.CityObjects.one.attributes!.name).toBe('A newer saved edit');
    expect(result.current.roadStatus).toMatch(/Saved geometry changed/); expect(result.current.roadDraftDirty).toBe(true);
  });
  it('opens an intersection unchanged and generates only after an explicit edit', () => {
    const doc=JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt-source.json','utf8')),before=JSON.stringify(doc);
    const {result}=renderHook(()=>useRoadEditor(coreStateFor(doc) as never,{pushUndo:vi.fn()} as never));
    const area=extractTransportationAreas(doc).find(a=>a.roadId.endsWith('intersection-483'))!;
    act(()=>result.current.handleEditSelectedRoadArea(area));
    expect(result.current.junctionDraft?.surfaceMode).toBe('preserve');
    expect(result.current.junctionDirty).toBe(false);
    expect(result.current.canUndoJunction).toBe(false);
    expect(result.current.junctionPlan?.areas).toEqual(extractTransportationAreas(doc).filter(a=>a.roadId===area.roadId));
    expect(JSON.stringify(doc)).toBe(before);
    act(()=>result.current.handleJunctionChange({...result.current.junctionDraft!,surfaceMode:'rebuild',footprint:undefined}));
    expect(result.current.junctionDraft?.surfaceMode).toBe('rebuild');
    expect(result.current.junctionDirty).toBe(true);
    expect(JSON.stringify(doc)).toBe(before);
    act(()=>result.current.handleSaveJunction());
    expect(result.current.junctionSaveError).toBeNull();
    expect(result.current.junctionDirty).toBe(false);
    expect(doc.CityObjects[area.roadId].attributes._junctionLaneGuides.length).toBe(6);
  });
  it('exposes a failed save to the panel without changing the document', () => {
    const doc=JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json','utf8')),before=JSON.stringify(doc);
    const {result}=renderHook(()=>useRoadEditor(coreStateFor(doc) as never,{pushUndo:vi.fn()} as never));
    act(()=>result.current.handleEditSelectedRoadArea(extractTransportationAreas(doc).find(a=>a.roadId.includes('intersection'))!));
    act(()=>result.current.handleJunctionChange({...result.current.junctionDraft!,surfaceMode:'rebuild',curveFactor:9}));
    act(()=>result.current.handleSaveJunction());
    expect(result.current.junctionSaveError).toMatch(/Curve reach/);
    expect(JSON.stringify(doc)).toBe(before);
    expect(result.current.junctionDirty).toBe(true);
  });
  it('blocks a widened road overlapping its neighbour before the preview debounce runs', () => {
    const doc = buildSampleCube();
    const bands = [{ kind: 'car_lane' as const, widthM: 3.25, direction: 'forward' as const }];
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.05], [4.401, 52.05]], { bands }), { id: 'edited' });
    insertRoadIntoCityJson(doc, createManualRoadDraft([[4.4, 52.050032], [4.401, 52.050032]], { bands }), { id: 'neighbour' });
    const before = JSON.stringify(doc), alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    act(() => result.current.handleEditSelectedRoadArea(extractTransportationAreas(doc).find(area => area.roadId === 'edited')!));
    act(() => result.current.handleRoadDraftChange(withFirstBandWidth(result.current.roadDraft!, 4.8), 'Widen road'));
    act(() => result.current.handleInsertRoad());
    expect(JSON.stringify(doc)).toBe(before);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('overlaps'));
    alert.mockRestore();
  });
  it('constructs an intersection from an unsaved road join and saves both atomically', () => {
    const doc = buildSampleCube(), join: [number, number] = [4.4, 52.05];
    const bands = [{ kind: 'car_lane' as const, widthM: 3.25, direction: 'forward' as const }, { kind: 'car_lane' as const, widthM: 3.25, direction: 'backward' as const }];
    const peer = createManualRoadDraft([join, [4.401, 52.05]], { bands });
    insertRoadIntoCityJson(doc, peer, { id: 'east' });
    const incoming = createManualRoadDraft([[4.4, 52.0505], join], { bands });
    incoming.sections[0].connections = { end: { target: 'cityjson', targetId: 'east', targetSectionId: peer.sections[0].id, targetEndpoint: 'start', positionWgs84: join, confirmed: true } };
    const before = JSON.stringify(doc), { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    act(() => result.current.setRoadDraft(incoming));
    act(() => result.current.handleRoadDraftChange({ ...incoming, name: 'New connected road' }, 'Name road'));
    act(() => result.current.handleCreateJunction(incoming.sections[0].id, 'end'));
    expect(result.current.junctionDraft).not.toBeNull();
    expect(result.current.junctionPlan?.error).toBeUndefined();
    expect(result.current.junctionConflicts.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(JSON.stringify(doc)).toBe(before);
    act(() => result.current.handleSaveJunction());
    expect(result.current.junctionDirty).toBe(false);
    expect(doc.CityObjects['connected-road-1']?.attributes?.name).toBe('New connected road');
    expect(doc.CityObjects[result.current.junctionDraft!.id]?.attributes?._connectedCityRoadIds).toContain('connected-road-1');
  });
  it('undoes a whole kerb drag and refuses to save an unfinished trace', () => {
    const doc = JSON.parse(readFileSync('public/examples/hamburg-mattentwiete.json', 'utf8'));
    const before = JSON.stringify(doc);
    const { result } = renderHook(() => useRoadEditor(coreStateFor(doc) as never, { pushUndo: vi.fn() } as never));
    const area = extractTransportationAreas(doc).find(area => area.roadId.includes('intersection'))!;
    act(() => result.current.handleEditSelectedRoadArea(area));
    expect(result.current.showRoadEditor).toBe(true);
    expect(result.current.junctionEditTool).toBe('none');
    expect(result.current.junctionSource).toBe('__all__');
    act(() => result.current.setJunctionEditTool('vertices'));
    expect(result.current.junctionPlan?.footprint?.polygon.length).toBeGreaterThan(3);
    const original = result.current.junctionDraft!;
    for (const delta of [.000001, .000002]) {
      const next = structuredClone(original);
      next.surfaceMode = 'rebuild'; next.footprint!.polygon[0][0] += delta;
      act(() => result.current.handleJunctionChange(next, 'one-pointer-drag'));
    }
    act(() => result.current.handleUndoJunction());
    expect(result.current.junctionDraft).toEqual(original);
    expect(result.current.canUndoJunction).toBe(false);
    act(() => result.current.handleRedoJunction());
    expect(result.current.junctionDraft!.footprint!.polygon[0][0]).toBeCloseTo(original.footprint!.polygon[0][0] + .000002, 10);
    act(() => result.current.setJunctionEditTool('trace-boundary'));
    act(() => result.current.handleSaveJunction());
    expect(result.current.roadStatus).toMatch(/Finish or cancel/);
    expect(JSON.stringify(doc)).toBe(before);
    act(() => result.current.setJunctionEditTool('none'));
    act(() => result.current.handleSaveJunction());
    expect(result.current.junctionDirty).toBe(false);
    expect(doc.CityObjects[area.roadId].attributes._junctionFootprint.polygon[0][0]).toBeCloseTo(original.footprint!.polygon[0][0] + .000002, 10);
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

  it('blocks traffic surfaces overlapping mapped street-tree trunks', async () => {
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
        severity: 'error',
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
    // Move away from the peer; disconnecting must not authorize an overlap.
    moved.sections[0].centerlineWgs84.at(-1)![0] -= 0.0001;
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
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
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
    expect(alert.mock.calls).toEqual([]);
    expect(result.current.roadStatus).toContain('moved 1 connected road endpoint');
    expect(savedSource.sections[0].connections?.end).toMatchObject({
      targetId: 'road-target',
      targetEndpoint: 'start',
    });
    expect(savedTarget.sections[0].centerlineWgs84[0]).toEqual(movedPosition);
    expect(savedTarget.sections[0].connections?.start).toMatchObject({
      targetId: 'road-source',
      targetEndpoint: 'end',
    });
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
    confirm.mockRestore();
    alert.mockRestore();
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
