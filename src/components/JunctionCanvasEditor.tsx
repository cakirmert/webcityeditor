import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Check, MousePointer2, Undo2, X } from 'lucide-react';
import { openJunctionRing, validateJunctionFootprint, type JunctionEditTool, type JunctionFootprint, type JunctionPoint } from '../lib/junction-footprint';
import type { RoadJunctionDraft } from '../lib/road-junctions';

interface Props {
  map: MapLibreMap | null;
  draft: RoadJunctionDraft;
  tool: JunctionEditTool;
  onToolChange: (tool: JunctionEditTool) => void;
  onChange: (draft: RoadJunctionDraft, group?: string) => void;
}

export default function JunctionCanvasEditor({ map, draft, tool, onToolChange, onChange }: Props) {
  const [, redraw] = useState(0);
  const [sketch, setSketch] = useState<JunctionPoint[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const drag = useRef<{ ring: number; index: number; group: string; shape: JunctionFootprint } | null>(null);
  const drawing = tool === 'trace-boundary' || tool === 'trace-island';
  useEffect(() => { setSketch([]); setError(''); setSelected(null); }, [tool, draft.id]);
  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => redraw((value) => value + 1)); };
    map.on('move', update); map.on('resize', update);
    return () => { map.off('move', update); map.off('resize', update); cancelAnimationFrame(frame); };
  }, [map]);
  if (!map || tool === 'none') return null;
  const shape = draft.footprint;
  const rings = shape ? [shape.polygon, ...shape.holes].map(openJunctionRing) : [];
  const screen = (point: JunctionPoint) => map.project(point);
  const coordinates = (event: { clientX: number; clientY: number }): JunctionPoint => {
    const rect = map.getContainer().getBoundingClientRect();
    const point = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    return [point.lng, point.lat];
  };
  const patchRing = (base: JunctionFootprint, ring: number, points: JunctionPoint[]): JunctionFootprint => ({
    ...base, source: 'drawn', polygon: ring ? base.polygon : points,
    holes: ring ? base.holes.map((hole, i) => i === ring - 1 ? points : hole) : base.holes,
  });
  const update = (footprint: JunctionFootprint, group?: string) => onChange({ ...draft, surfaceMode: 'rebuild', footprint }, group);
  const finish = () => {
    const footprint: JunctionFootprint = tool === 'trace-island' && shape
      ? { ...shape, holes: [...shape.holes, sketch], source: 'drawn' }
      : { polygon: sketch, holes: shape?.holes ?? [], source: 'drawn', reference: `Esri World Imagery · visually traced ${new Date().toISOString().slice(0, 10)}; imagery capture date unknown` };
    const invalid = validateJunctionFootprint(footprint);
    if (invalid) { setError(invalid); return; }
    update(footprint); onToolChange('vertices');
  };
  const remove = (ring: number, index: number) => {
    if (!shape || rings[ring].length <= 3) return;
    update(patchRing(shape, ring, rings[ring].filter((_, i) => i !== index)));
    setSelected(null);
  };
  const begin = (event: PointerEvent<SVGCircleElement>, ring: number, index: number, inserted?: JunctionPoint) => {
    if (!shape || drawing || event.button !== 0) return;
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus(); event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    let base = shape;
    const group = `kerb-drag-${crypto.randomUUID()}`;
    if (inserted) {
      const points = [...rings[ring]]; points.splice(index, 0, inserted);
      base = patchRing(shape, ring, points); update(base, group);
    }
    drag.current = { ring, index, group, shape: base }; setSelected([ring, index]);
  };
  const move = (event: PointerEvent<SVGElement>) => {
    const current = drag.current; if (!current) return;
    event.stopPropagation(); event.preventDefault();
    const points = [...(current.ring ? current.shape.holes[current.ring - 1] : current.shape.polygon)];
    points[current.index] = coordinates(event);
    update(patchRing(current.shape, current.ring, points), current.group);
  };
  const path = (points: JunctionPoint[], closed = true) => points.map((point, i) => { const p = screen(point); return `${i ? 'L' : 'M'}${p.x},${p.y}`; }).join(' ') + (closed ? ' Z' : '');
  return <div className="junction-canvas-editor">
    <svg className={drawing ? 'is-tracing' : ''} aria-label="Intersection boundary editor" onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onClick={(event) => {
      if (drawing && event.detail === 1) { setSketch((points) => [...points, coordinates(event)]); setError(''); }
    }}>
      {drawing && <rect width="100%" height="100%" fill="transparent" className="junction-trace-hit" />}
      {rings.map((ring, ringIndex) => <g key={ringIndex}>
        <path d={path(ring)} fill="none" stroke={ringIndex ? '#f7b452' : '#51e0d0'} strokeWidth="2.5" strokeDasharray={ringIndex ? '7 4' : undefined} />
        {!drawing && ring.map((point, index) => {
          const p = screen(point), next = ring[(index + 1) % ring.length], q = screen(next);
          const midpoint: JunctionPoint = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
          const label = `${ringIndex ? `Island ${ringIndex}` : 'Boundary'} point ${index + 1}`;
          return <g key={index}>
            {Math.hypot(p.x - q.x, p.y - q.y) > 30 && <circle cx={(p.x + q.x) / 2} cy={(p.y + q.y) / 2} r="5" className="junction-midpoint" role="button" tabIndex={0} aria-label={`Insert after ${label.toLowerCase()}`} onPointerDown={(event) => begin(event, ringIndex, index + 1, midpoint)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={(event) => { if (event.key === 'Enter' && shape) { const points = [...ring]; points.splice(index + 1, 0, midpoint); update(patchRing(shape, ringIndex, points)); } }} />}
            <circle cx={p.x} cy={p.y} r={selected?.[0] === ringIndex && selected[1] === index ? 8 : 6} className="junction-vertex" role="button" tabIndex={0} aria-label={label} onPointerDown={(event) => begin(event, ringIndex, index)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={(event) => {
              if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(ringIndex, index); }
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault(); const step = event.shiftKey ? 10 : 1;
                const target = map.unproject([p.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), p.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)]);
                update(patchRing(shape!, ringIndex, ring.map((value, i) => i === index ? [target.lng, target.lat] : value)));
              }
            }} />
          </g>;
        })}
      </g>)}
      {sketch.length > 0 && <path d={path(sketch, false)} fill="none" stroke="#51e0d0" strokeWidth="3" />}
      {sketch.map((point, i) => { const p = screen(point); return <circle key={i} cx={p.x} cy={p.y} r="6" className="junction-vertex" onClick={(event) => { event.stopPropagation(); if (i === 0 && sketch.length >= 3) finish(); }} />; })}
    </svg>
    <div className="junction-map-guide" role="region" aria-label="Outline tools">
      <MousePointer2 size={18} /><div><b>{drawing ? tool === 'trace-island' ? 'Trace an island' : 'Trace the kerb line' : 'Adjust the kerb line'}</b><span>{drawing ? `${sketch.length} points · click around its edge` : 'Drag a point · small dots add corners · Delete removes'}</span></div>
      {drawing ? <><button disabled={sketch.length < 3} onClick={finish}><Check size={15} />Finish</button><button disabled={!sketch.length} onClick={() => setSketch((points) => points.slice(0, -1))} aria-label="Undo trace point"><Undo2 size={15} /></button></> : selected && <button disabled={rings[selected[0]]?.length <= 3} onClick={() => remove(...selected)}>Remove point</button>}
      <button aria-label={drawing ? 'Cancel tracing' : 'Finish boundary editing'} onClick={() => onToolChange(drawing && shape ? 'vertices' : 'none')}><X size={17} /></button>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
