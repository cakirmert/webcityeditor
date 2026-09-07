import { useId } from 'react';
import { roadBandFillColor } from '../lib/osm2streets-style';
import type { RoadSectionDraft } from '../lib/transportation';

/** A proportional street plan, driven directly by the same editable bands as the map. */
export default function RoadSectionPreview({ section, selected, onSelect }: {
  section: RoadSectionDraft; selected: number; onSelect: (index: number) => void;
}) {
  const id = useId().replaceAll(':', '');
  const total = section.bands.reduce((sum, band) => sum + band.widthM, 0) || 1;
  let x = 0;
  return <figure className="road-live-preview">
    <figcaption><b>Street preview</b><span><i /> Live · {total.toFixed(2)} m</span></figcaption>
    <svg viewBox="0 0 360 126" role="group" preserveAspectRatio="none" aria-label="Live road cross-section, proportional to band widths">
      <defs>
        <pattern id={`${id}-paving`} width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 0H14V14H0Z M0 7H14 M7 0V7 M3.5 7V14" fill="none" stroke="#687077" strokeWidth=".5" opacity=".5" /></pattern>
        <pattern id={`${id}-grass`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M2 7l1-3 1 3m3-5v2" stroke="#a0c19e" opacity=".45" /></pattern>
        <pattern id={`${id}-gravel`} width="6" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".8" fill="#dad4bd" opacity=".4" /></pattern>
      </defs>
      {section.bands.map((band, index) => {
        const width = band.widthM / total * 360;
        const left = x; x += width;
        const color = roadBandFillColor(band.kind, band.sourceType);
        const travel = band.kind === 'car_lane' || band.kind === 'bike_lane';
        const pattern = band.surface === 'gravel' || band.surface === 'compacted' ? 'gravel' : band.kind === 'sidewalk' || band.surface === 'paving_stones' ? 'paving' : band.kind === 'green' || band.surface === 'grass' ? 'grass' : null;
        return <g key={`${band.id}-${index}`} role="button" tabIndex={0} aria-label={`Preview band ${index + 1}, ${band.kind.replaceAll('_', ' ')}`} aria-pressed={selected === index}
          onClick={() => onSelect(index)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(index); } }}>
          <rect x={left} width={width} height="126" fill={`rgb(${color.slice(0, 3).join(',')})`} />
          {pattern && <rect x={left} width={width} height="126" fill={`url(#${id}-${pattern})`} />}
          <path d={`M${left + 1} 0V126`} stroke={travel ? '#f0ede4' : '#e0e0d9'} strokeWidth={travel ? '.7' : '2'} strokeDasharray={travel && section.bands[index - 1]?.kind === band.kind ? '12 9' : undefined} />
          {band.kind === 'parking' && [20, 65, 110].map((y) => <path key={y} d={`M${left + 3} ${y}h${Math.max(0, width - 6)}`} stroke="#ddd" strokeWidth="1" />)}
          {width > 12 && <g transform={`translate(${left + width / 2} 63)`}>
            {travel && band.direction !== 'none' ? <g transform={band.direction === 'backward' ? 'rotate(180)' : undefined} fill="none" stroke="#fffbed" strokeWidth="2" opacity=".9">
              <path d="M0 16V-15m-5 6 5-6 5 6" />
              {band.direction === 'both' && <path d="M-5 10 0 16 5 10" />}
              {band.kind === 'bike_lane' && <g transform="translate(0 32)" strokeWidth="1"><circle cx="-5" r="3" /><circle cx="5" r="3" /><path d="M-5 0l3-5 4 5h-7l3-5h4l3 5" /></g>}
            </g> : band.kind === 'parking' ? <text textAnchor="middle" fill="#eee" fontSize="12">P</text> : null}
          </g>}
          {selected === index && <rect x={left + 1.5} y="1.5" width={Math.max(0, width - 3)} height="123" rx="2" fill="#73cfff" fillOpacity=".08" stroke="#9addff" strokeWidth="2" />}
          {width > 14 && <text x={left + width / 2} y="119" textAnchor="middle" fill={travel ? '#eee' : '#182522'} fontSize="8">{band.widthM.toFixed(1)}</text>}
        </g>;
      })}
    </svg>
    <div><span>Left of centreline</span><span>Direction of road ↑</span><span>Right</span></div>
  </figure>;
}
