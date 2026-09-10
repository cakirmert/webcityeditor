import { useRef, useState } from 'react';
import { Eye, Layers2, Map, Satellite } from 'lucide-react';
import type { BasemapMode } from '../lib/basemap';

export default function RoadMapCompare({ basemap, onBasemapChange, opacity, onOpacityChange, onSatelliteOpacityChange, levels, onLevelsChange }: {
  basemap: BasemapMode; onBasemapChange: (mode: BasemapMode) => void;
  opacity: number; onOpacityChange: (value: number) => void;
  onSatelliteOpacityChange?: (value: number) => void;
  levels?: boolean; onLevelsChange?: (value: boolean) => void;
}) {
  const previous = useRef(.55);
  const [peeking, setPeeking] = useState(false);
  const peek = () => { if (peeking) return; previous.current = opacity; setPeeking(true); onOpacityChange(0); };
  const restore = () => { if (peeking) { setPeeking(false); onOpacityChange(previous.current); } };
  return <div className="road-compare-bar" role="region" aria-label="Map comparison">
    <div className="road-compare-modes" role="group" aria-label="Reference map">
      <button aria-pressed={basemap === 'topplus'} onClick={() => onBasemapChange('topplus')}><Map size={15} />Map</button>
      <button aria-pressed={basemap === 'satellite'} onClick={() => { onBasemapChange('satellite'); onSatelliteOpacityChange?.(1); }}><Satellite size={15} />Satellite</button>
    </div>
    <label className="road-compare-opacity"><Layers2 size={15} /><span>Road overlay</span><input type="range" min="0" max="1" step=".01" value={opacity} aria-label="Road overlay opacity" onChange={(event) => onOpacityChange(Number(event.target.value))} /><output>{Math.round(opacity * 100)}%</output></label>
    <button className="road-compare-peek" aria-label="Hold to show imagery only" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); peek(); }} onPointerUp={restore} onPointerCancel={restore} onLostPointerCapture={restore} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); peek(); } }} onKeyUp={restore} onBlur={restore}><Eye size={16} /><span>Hold to compare</span></button>
    {onLevelsChange && <button className="road-compare-levels" aria-pressed={!!levels} onClick={() => onLevelsChange(!levels)} title="Show bridges and underpasses with schematic height separation"><Layers2 size={16} />Levels</button>}
  </div>;
}
