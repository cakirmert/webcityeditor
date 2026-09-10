import { ArrowUpRight, AlertTriangle, Copy, GitBranch, Layers2, MousePointer2, PencilLine, Pentagon, Plus, Route, Trash2, WandSparkles } from 'lucide-react';
import { openJunctionRing, type JunctionEditTool, type JunctionFootprint } from '../lib/junction-footprint';
import { useEffect, useId, useMemo, useState } from 'react';
import { roadMovementKey, type RoadLaneContinuation } from '../lib/road-lane-continuations';
import type { RoadJunctionDraft, RoadJunctionPlan } from '../lib/road-junctions';
import { deriveEditableRoadDraftFromAreas, type RoadArea } from '../lib/transportation';
import { roadDisplayName, roadEndpointBearing } from '../lib/road-labels';
import { approachColor, isDrivingMovement, isLaneTransition, turnSymbol } from '../lib/junction-presentation';
import { consolidateJunctionCluster, suggestJunctionCluster } from '../lib/junction-clusters';

export const junctionSourceKey = (movement: RoadLaneContinuation) => JSON.stringify([movement.sourceRoadId, movement.sourceSectionId, movement.sourceBandIndex]);

export default function RoadJunctionPanel({ draft, plan, areas, tool, onToolChange, onCompare, onChange, onFocusSource, onEditRoad, focusedSource }: {
  draft: RoadJunctionDraft; plan: RoadJunctionPlan; areas: RoadArea[]; tool: JunctionEditTool;
  onToolChange: (tool: JunctionEditTool) => void; onCompare: () => void;
  onChange: (draft: RoadJunctionDraft) => void; onFocusSource?: (source: string | null) => void;
  onEditRoad?: (area: RoadArea) => void;
  focusedSource?: string | null;
}) {
  const [tab, setTab] = useState('turns');
  const [source, setSource] = useState('__all__');
  const [approach, setApproach] = useState('');
  const [focusedRoad, setFocusedRoad] = useState(draft.roadIds[0] ?? '');
  const [copyStatus, setCopyStatus] = useState('');
  const [groupError, setGroupError] = useState('');
  const cluster = useMemo(() => draft.mergedFrom ? null : suggestJunctionCluster(areas,draft.id),[areas,draft.id,draft.mergedFrom]);
  const transition = useMemo(() => isLaneTransition(draft,areas),[draft,areas]);
  const pendingMerge = !!draft.mergedFrom && [...draft.mergedFrom.junctionIds, ...draft.mergedFrom.internalRoadIds].some(id => id !== draft.id && areas.some(a => a.roadId === id));
  const name = (id: string) => roadDisplayName(areas, id);
  const layouts = useMemo(() => new Map(draft.roadIds.flatMap((id) => {
    try { return [[id, areas.find((area) => area.roadId === id && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, id)] as const]; }
    catch { return []; }
  })), [areas, draft.roadIds]);
  const laneLabel = (movement: RoadLaneContinuation, side: 'source' | 'target') => {
    const section = layouts.get(movement[`${side}RoadId`])?.sections.find((section) => section.id === movement[`${side}SectionId`]);
    const kind = movement.mode === 'pedestrian' ? 'sidewalk' : movement.mode === 'bicycle' ? 'bike_lane' : 'car_lane';
    const number = section?.bands.slice(0, movement[`${side}BandIndex`] + 1).filter((band) => band.kind === kind).length || 1;
    return `${kind === 'sidewalk' ? 'Sidewalk' : kind === 'bike_lane' ? 'Cycle lane' : 'Driving lane'} ${number}`;
  };
  const modeRank = (mode: string) => mode === 'pedestrian' ? 2 : mode === 'bicycle' ? 1 : 0;
  const sources = [...new Map(plan.movements.map((movement) => [junctionSourceKey(movement), movement])).values()].sort((a, b) => modeRank(a.mode) - modeRank(b.mode));
  const activeSource = source === '__all__' ? source : sources.some((movement) => junctionSourceKey(movement) === source) ? source : '__all__';
  const overview = activeSource === '__all__';
  useEffect(() => { if (focusedSource && (focusedSource === '__all__' || sources.some(m=>junctionSourceKey(m)===focusedSource))) setSource(focusedSource); },[focusedSource]);
  useEffect(() => {
    const candidate = approach ? JSON.parse(approach) as [string, 'start' | 'end'] : null;
    const endpoint = candidate?.[0] === focusedRoad ? candidate[1] : draft.endpoints[focusedRoad];
    onFocusSource?.(tab === 'turns' ? activeSource || null : tab === 'approaches' ? `road:${JSON.stringify([focusedRoad, endpoint])}` : '__shape__');
  }, [activeSource, focusedRoad, approach, draft.endpoints, tab, onFocusSource]);
  const visible = plan.movements.filter((movement) => overview ? isDrivingMovement(movement) : junctionSourceKey(movement) === activeSource);
  const toggle = (movement: RoadLaneContinuation) => {
    const key = roadMovementKey(movement);
    onChange({ ...draft, disabledMovements: draft.disabledMovements.includes(key) ? draft.disabledMovements.filter((item) => item !== key) : [...draft.disabledMovements, key] });
  };
  const nearApproaches = useMemo(() => {
    const boundary = draft.footprint?.polygon ?? plan.footprint?.polygon ?? areas.find(area => area.roadId === draft.id)?.polygon;
    const center = boundary?.length ? boundary.reduce<[number, number]>((sum, point) => [sum[0] + point[0] / boundary.length, sum[1] + point[1] / boundary.length], [0, 0]) : plan.movements[0]?.path[0]; if (!center) return [];
    const ids = [...new Set(areas.filter((area) => !draft.roadIds.includes(area.roadId) && area.function !== 'intersection' && area.attributes.transportationUsage !== 'intersection' && area.polygon.some((p) => Math.abs(p[0] - center[0]) < .0008 && Math.abs(p[1] - center[1]) < .0005)).map((area) => area.roadId))];
    return ids.flatMap((id) => {
      try {
        const road = areas.find((area) => area.roadId === id && area.editableDraft)?.editableDraft ?? deriveEditableRoadDraftFromAreas(areas, id);
        return (['start', 'end'] as const).flatMap((endpoint) => {
          const section = endpoint === 'start' ? road.sections[0] : road.sections.at(-1);
          const point = endpoint === 'start' ? section?.centerlineWgs84[0] : section?.centerlineWgs84.at(-1); if (!point) return [];
          const distance = Math.hypot((point[0] - center[0]) * 66000, (point[1] - center[1]) * 110540);
          return distance <= 35 ? [{ id, endpoint, distance, bearing: roadEndpointBearing(road, endpoint) }] : [];
        });
      } catch { return []; }
    }).sort((a, b) => a.distance - b.distance).slice(0, 20);
  }, [areas, draft.id, draft.roadIds, draft.footprint, plan.footprint, plan.movements]);
  const footprint = draft.footprint ?? plan.footprint;
  const savedGenerated = areas.some(area => area.roadId === draft.id && area.attributes.junctionSurfaceMode === 'generated');
  const beginEditing = () => {
    if (!footprint) return;
    onChange({ ...draft, surfaceMode: 'rebuild', footprint: { ...footprint, polygon: openJunctionRing(footprint.polygon), holes: footprint.holes.map(openJunctionRing) } });
    onCompare(); onToolChange('vertices');
  };
  const tabs = [{ id: 'shape', label: 'Shape', icon: <Pentagon size={15} /> }, { id: 'turns', label: 'Turns', icon: <Route size={15} /> }, { id: 'approaches', label: 'Roads', icon: <GitBranch size={15} /> }];
  return <div className="junction-editor">
    {plan.error && <div className="studio-feedback is-error" role="alert"><AlertTriangle size={17} /><p>{plan.error}</p></div>}
    <div className="junction-workflow-tabs" role="tablist" aria-label="Intersection tools">{tabs.map((item, i) => <button key={item.id} id={`junction-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`junction-view-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => { setTab(item.id); onToolChange(item.id === 'shape' ? 'vertices' : 'none'); }} onKeyDown={(event) => {
      const next = event.key === 'ArrowRight' ? (i + 1) % tabs.length : event.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : -1;
      if (next >= 0) { event.preventDefault(); setTab(tabs[next].id); onToolChange(tabs[next].id === 'shape' ? 'vertices' : 'none'); document.getElementById(`junction-tab-${tabs[next].id}`)?.focus(); }
    }}>{item.icon}{item.label}</button>)}</div>
    <div id="junction-view-shape" role="tabpanel" aria-labelledby="junction-tab-shape" hidden={tab !== 'shape'} className="junction-tab-body">
      {transition && <div className="junction-transition-note"><b>Lane transition</b><p>Generate joins the changing lane widths and retains their arrows. Review the preview, then save to apply it.</p></div>}
      {cluster && <div className="junction-cluster-note"><b>{cluster.junctionIds.length} connected junction pieces</b><p>Consolidate these junctions and {cluster.internalRoadIds.length} short internal roads into one editable intersection. Review its boundary against the imagery before saving.</p><button className="road-wide-action" onClick={() => { try { onChange(consolidateJunctionCluster(areas,draft,cluster)); setGroupError(''); onToolChange('vertices'); } catch(error) { setGroupError(error instanceof Error ? error.message : String(error)); } }}>Preview one combined intersection</button></div>}
      {draft.mergedFrom && <p className="junction-transition-note">One intersection from {draft.mergedFrom.junctionIds.length} source pieces. Internal road seams are removed together when you save.</p>}
      {groupError && <p role="alert" className="road-inline-error">{groupError}</p>}
      <div className="junction-intro"><h3>{footprint ? tool === 'vertices' ? 'Drag a boundary point on the map' : 'Review the junction boundary' : 'Create a continuous boundary'}</h3><p>{footprint ? 'Use Adjust boundary on map to move corners. Small dots add a corner; Undo restores the previous shape.' : 'The imported surface has separate or invalid fragments. Generate a connected outline, or trace the visible kerb from satellite.'}</p></div>
      <div className="junction-shape-modes" role="group" aria-label="Junction surface">
        <button aria-pressed={draft.surfaceMode === 'preserve'} disabled={pendingMerge || !areas.some((area) => area.roadId === draft.id)} title={pendingMerge ? 'Undo the combined preview to keep the separate source junctions.' : undefined} onClick={() => { const saved = areas.find((area) => area.roadId === draft.id)?.attributes.junctionFootprint as unknown as JunctionFootprint | undefined; onChange({ ...draft, surfaceMode: 'preserve', footprint: saved || undefined }); onToolChange('none'); }}><Layers2 size={19} /><b>Keep current</b><span>Retain its exact surface</span></button>
        <button aria-pressed={draft.surfaceMode === 'rebuild' && !draft.footprint} onClick={() => { onChange({ ...draft, surfaceMode: 'rebuild', footprint: undefined }); onToolChange('none'); }}><WandSparkles size={19} /><b>Generate</b><span>Connect the road kerbs</span></button>
      </div>
      <button className="junction-trace-action" onClick={() => { onCompare(); onToolChange('trace-boundary'); }}><PencilLine size={19} /><span><b>{draft.footprint ? 'Retrace boundary' : 'Trace from satellite'}</b><small>Click around the actual road edge</small></span><ArrowUpRight size={18} /></button>
      <div className="junction-outline-summary"><span><i className={draft.footprint ? 'is-traced' : ''} />{draft.footprint ? 'Custom boundary' : draft.surfaceMode === 'preserve' ? savedGenerated ? 'Saved generated surface' : 'Imported surface' : 'Generated kerb outline'}</span>{footprint && <small>{openJunctionRing(footprint.polygon).length} points</small>}</div>
      <button className="road-wide-action junction-edit-boundary" disabled={!footprint} onClick={beginEditing}><MousePointer2 size={16} />{tool === 'vertices' ? 'Boundary handles are active' : 'Adjust boundary on map'}</button>
      {!draft.footprint && draft.surfaceMode === 'rebuild' && <label className="road-field junction-curvature"><span>Corner shape <output>{Math.round(draft.curveFactor * 100)}%</output></span><input aria-label="Corner shape" type="range" min=".15" max=".65" step=".025" value={draft.curveFactor} onChange={(event) => onChange({ ...draft, curveFactor: Number(event.target.value) })} /><small>Gentle ↔ tighter curves. Trace irregular kerbs directly.</small></label>}
      <section className="junction-islands"><div><h4>Traffic islands</h4><span>{(draft.footprint?.holes.length ?? 0) + (draft.retainedIslands?.length ?? 0)}</span></div><p>Cut out raised islands, medians and tree beds.</p>
        {!!draft.retainedIslands?.length && <p>{draft.retainedIslands.length} source kerb and island surfaces retained. They remain separate semantic surfaces within this intersection.</p>}
        {draft.footprint?.holes.map((hole, i) => <div className="junction-island-row" key={i}><span>Island {i + 1}<small>{openJunctionRing(hole).length} corners</small></span><button aria-label={`Remove island ${i + 1}`} onClick={() => onChange({ ...draft, surfaceMode: 'rebuild', footprint: { ...draft.footprint!, holes: draft.footprint!.holes.filter((_, j) => j !== i) } })}><Trash2 size={15} /></button></div>)}
        <button className="road-wide-action" disabled={!footprint} onClick={() => { if (!footprint) return; onChange({ ...draft, surfaceMode: 'rebuild', footprint }); onCompare(); onToolChange('trace-island'); }}><Plus size={16} />Trace an island</button>
      </section>
      {draft.footprint?.reference && <p className="junction-reference-note">{draft.footprint.reference}</p>}
      {draft.footprint && <details className="junction-coordinates"><summary>Outline coordinates</summary><textarea aria-label="Intersection outline JSON" readOnly rows={4} value={JSON.stringify(draft.footprint, null, 2)} /><button className="road-wide-action" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(draft.footprint, null, 2)).then(() => setCopyStatus('Outline coordinates copied.')).catch(() => setCopyStatus('Clipboard unavailable. Export CityJSON to retain the outline.')); }}><Copy size={15} />Copy outline JSON</button><span role="status">{copyStatus}</span></details>}
    </div>
    <div id="junction-view-turns" role="tabpanel" aria-labelledby="junction-tab-turns" hidden={tab !== 'turns'} className="junction-tab-body">
      <div className="junction-intro"><span className="studio-eyebrow">{transition ? 'LANE TRANSITION' : 'LANE CONNECTIONS'}</span><h3>{overview ? 'All approaches, together' : 'Where can this lane go?'}</h3><p>{overview ? 'Each colour is an incoming road. Select a lane below or a connection on the map to inspect its destinations.' : 'The blue lane and numbered destinations match the map.'}</p></div>
      {!overview && <button className="road-wide-action" onClick={() => setSource('__all__')}>← All approaches</button>}
      <label className="road-field"><span>{overview ? 'View' : 'Incoming lane · highlighted blue on the map'}</span><select value={activeSource} onChange={(event) => setSource(event.target.value)}><option value="__all__">All driving approaches</option>{sources.map((movement) => <option key={junctionSourceKey(movement)} value={junctionSourceKey(movement)}>{draft.roadIds.indexOf(movement.sourceRoadId)+1} · {layouts.get(movement.sourceRoadId) ? roadEndpointBearing(layouts.get(movement.sourceRoadId)!, movement.sourceEndpoint) + ' · ' : ''}{name(movement.sourceRoadId)} · {laneLabel(movement, 'source')}</option>)}</select></label>
      {overview && <div className="junction-approach-overview">{draft.roadIds.map(id => { const lanes = sources.filter(m=>m.sourceRoadId===id && isDrivingMovement(m)); if(!lanes.length) return null; const color = `rgb(${approachColor(draft,id).join(',')})`; return <section key={id} style={{borderColor:color}}><header><b style={{color}}>{draft.roadIds.indexOf(id)+1} · {name(id)}</b><small>{layouts.get(id) && roadEndpointBearing(layouts.get(id)!,draft.endpoints[id])} approach</small></header><div>{lanes.map(m=>{ const band=layouts.get(id)?.sections.find(s=>s.id===m.sourceSectionId)?.bands[m.sourceBandIndex]; const turns=band?.allowedTurns?.length ? band.allowedTurns : [...new Set(plan.movements.filter(item=>junctionSourceKey(item)===junctionSourceKey(m)).map(item=>item.turn))]; return <button key={junctionSourceKey(m)} onClick={()=>setSource(junctionSourceKey(m))} aria-label={`Inspect ${laneLabel(m,'source')} on ${name(id)}`}><small>{laneLabel(m,'source')}</small><b style={{color}}>{turns.map(turnSymbol).join(' ')}</b></button>; })}</div></section>; })}</div>}
      {!overview && <div className="junction-movements">{visible.map((movement, i) => <label key={movement.id} className={draft.disabledMovements.includes(roadMovementKey(movement)) ? 'is-disabled' : ''}><input type="checkbox" checked={!draft.disabledMovements.includes(roadMovementKey(movement))} onChange={() => toggle(movement)} /><span className="junction-turn-number">{i + 1}</span><span><b>{movement.turn.replaceAll('_', ' ')} → {laneLabel(movement, 'target')}</b><small>{name(movement.targetRoadId)}</small></span></label>)}</div>}
      {visible.length === 0 && <p>No outgoing movements are known. Check the connected roads and their directions.</p>}
      <div className="junction-minimap"><JunctionPreview areas={plan.areas.length && draft.surfaceMode === 'rebuild' ? plan.areas : [...areas.filter((area) => draft.roadIds.includes(area.roadId)), ...plan.areas.filter((area) => area.roadId === draft.id)]} bounds={plan.movements.flatMap((movement) => movement.path)} movements={visible} disabled={draft.disabledMovements} overview={overview} color={m=>`rgb(${approachColor(draft,m.sourceRoadId).join(',')})`} onToggle={overview ? m=>setSource(junctionSourceKey(m)) : toggle} targetLabel={(movement) => `${laneLabel(movement, 'target')} on ${name(movement.targetRoadId)}`} /></div>
      <p>Turn permissions leave the pavement intact. Curves show lane connections; check their clearance around islands.</p>
    </div>
    <div id="junction-view-approaches" role="tabpanel" aria-labelledby="junction-tab-approaches" hidden={tab !== 'approaches'} className="junction-tab-body">
      <div className="junction-intro"><span className="studio-eyebrow">CONNECTED ROADS</span><h3>{draft.roadIds.length} approaches</h3><p>The intersection and its road ends are saved together.</p></div>
      <label className="road-field"><span>Intersection name</span><input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
      <div className="junction-road-cards">{draft.roadIds.map(id => <div key={id} className={focusedRoad === id ? 'is-focused' : ''}>
        <button className="junction-road-focus" aria-pressed={focusedRoad === id} onClick={() => { setFocusedRoad(id); setApproach(''); }}><b>{name(id)}</b><small>{layouts.get(id) && roadEndpointBearing(layouts.get(id)!, draft.endpoints[id])} approach · {draft.endpoints[id] === 'start' ? 'start of road' : 'end of road'}</small></button>
        <div className="junction-road-actions"><button onClick={() => { const area = areas.find(a => a.roadId === id); if (area) onEditRoad?.(area); }}>Edit road</button><button disabled={draft.roadIds.length <= 2} onClick={() => { const endpoints = { ...draft.endpoints }; delete endpoints[id]; onChange({ ...draft, roadIds: draft.roadIds.filter(roadId => roadId !== id), endpoints, surfaceMode: 'rebuild' }); }}>Disconnect</button></div>
      </div>)}</div>
      {nearApproaches.length > 0 && <details className="junction-nearby"><summary>Add another approach</summary><div className="junction-candidate-list" role="group" aria-label="Nearby road ends">{nearApproaches.map(item => { const value = JSON.stringify([item.id, item.endpoint]); return <button key={value} aria-pressed={approach === value} onClick={() => { setApproach(value); setFocusedRoad(item.id); }}><b>{name(item.id)}</b><small>{item.bearing} · {item.endpoint === 'start' ? 'Start' : 'End'} · {Math.round(item.distance)} m from junction</small></button>; })}</div><button className="road-wide-action" disabled={!approach} onClick={() => { const [id, endpoint] = JSON.parse(approach); onChange({ ...draft, roadIds: [...draft.roadIds, id], allowedLaneMovements: undefined, endpoints: { ...draft.endpoints, [id]: endpoint }, surfaceMode: 'rebuild' }); setApproach(''); }}>Connect selected road end</button></details>}
    </div>
    {plan.warnings?.map((warning) => <div className="studio-feedback" key={warning}><AlertTriangle size={17} /><p>{warning}</p></div>)}
  </div>;
}

function JunctionPreview({ areas, bounds, movements, disabled, onToggle, targetLabel, overview, color }: { overview: boolean; color: (movement: RoadLaneContinuation) => string; areas: RoadArea[]; bounds: [number, number][]; movements: RoadLaneContinuation[]; disabled: string[]; onToggle: (movement: RoadLaneContinuation) => void; targetLabel: (movement: RoadLaneContinuation) => string }) {
  const arrowId = useId().replaceAll(':', '');
  const points = bounds;
  if (!points.length) return null;
  const origin = points[0]; const scaleX = 111320 * Math.cos(origin[1] * Math.PI / 180);
  const project = (point: [number, number]) => [(point[0] - origin[0]) * scaleX, -(point[1] - origin[1]) * 110540];
  const projected = points.map(project);
  const x = Math.min(...projected.map((p) => p[0])) - 7, y = Math.min(...projected.map((p) => p[1])) - 7;
  const width = Math.max(...projected.map((p) => p[0])) - x + 7, height = Math.max(...projected.map((p) => p[1])) - y + 7;
  const path = (ring: [number, number][]) => ring.map((p, i) => `${i === 0 ? 'M' : 'L'}${project(p).join(',')}`).join(' ');
  return <svg className="junction-live-preview" viewBox={`${x} ${y} ${width} ${height}`} role="group" aria-label="Live intersection plan">
    <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#a5e7f5" /></marker></defs>
    {areas.map((area) => <path key={area.id} d={[area.polygon, ...(area.holes ?? [])].map((ring) => path(ring) + 'Z').join(' ')} fillRule="evenodd" fill={/sidewalk|footway/i.test(String(area.attributes.sourceType ?? area.function)) ? '#939b9e' : '#363b40'} stroke="#bec3c4" strokeWidth=".12" />)}
    {movements.map((movement) => <path key={movement.id} d={path(movement.path)} fill="none" markerEnd={`url(#${arrowId})`} stroke={disabled.includes(roadMovementKey(movement)) ? '#e48b83' : overview ? color(movement) : '#68d8ef'} strokeWidth=".6" strokeDasharray={disabled.includes(roadMovementKey(movement)) ? '1 1' : undefined} role="button" tabIndex={0} aria-label={`${overview ? 'Inspect' : 'Toggle'} ${movement.turn.replaceAll('_', ' ')} to ${targetLabel(movement)}`} aria-pressed={overview ? undefined : !disabled.includes(roadMovementKey(movement))} onClick={() => onToggle(movement)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(movement); } }} />)}
  </svg>;
}
