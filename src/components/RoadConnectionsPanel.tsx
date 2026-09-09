import { useMemo } from 'react';
import { buildRoadConnectionIndex } from '../lib/road-lane-continuations';
import { updateRoadDraftPoint } from '../lib/road-draft-edit';
import type { RoadArea, RoadDraft, RoadSectionDraft } from '../lib/transportation';
import { roadDisplayName } from '../lib/road-labels';

export default function RoadConnectionsPanel({ draft, section, areas, onChange, onEdit, onCreate }: {
  draft: RoadDraft; section: RoadSectionDraft; areas: RoadArea[]; dirty: boolean;
  onChange: (draft: RoadDraft, label?: string) => void; onEdit: (area: RoadArea) => void;
  onCreate?: (sectionId: string, endpoint: 'start' | 'end') => void;
}) {
  const junctions = useMemo(() => buildRoadConnectionIndex(areas).junctions.filter((junction) => junction.roadIds.includes(draft.id ?? '')), [areas, draft.id]);
  const endpointFor = (junction: (typeof junctions)[number]) => {
    const saved = junction.roadEndpoints?.[draft.id ?? '']; if (saved) return saved;
    const distance = (point: [number, number]) => Math.hypot((point[0] - junction.position[0]) * Math.cos(point[1] * Math.PI / 180), point[1] - junction.position[1]);
    return distance(section.centerlineWgs84[0]) <= distance(section.centerlineWgs84.at(-1)!) ? 'start' : 'end';
  };
  return <div className="road-connections-panel">
    <p>Drag a yellow road end onto a teal target. Build intersection previews the connected roads together, including unsaved changes.</p>
    {(['start', 'end'] as const).map((endpoint) => {
      const connection = section.connections?.[endpoint];
      const attached = junctions.filter(junction => endpointFor(junction) === endpoint);
      return <div className="road-endpoint-card" key={endpoint}><b>{endpoint === 'start' ? 'Start of road' : 'End of road'}</b><span>{attached.length ? `Intersection · ${attached[0].roadIds.length} approaches` : connection ? `Joined to ${roadDisplayName(areas, connection.targetId)}` : 'Open end · drag to a target to connect'}</span>
        {attached.map(junction => { const area = areas.find(item => item.id === junction.areaIds[0]); return area ? <button className="road-wide-action" key={junction.id} onClick={() => onEdit(area)}>Edit intersection at {endpoint}<small>{junction.roadIds.filter(id => id !== draft.id).map(id => roadDisplayName(areas, id)).filter((name, i, names) => names.indexOf(name) === i).join(' / ')}</small></button> : null; })}
        {connection && <div className="road-profile-actions"><button type="button" onClick={() => {
          const index = endpoint === 'start' ? 0 : section.centerlineWgs84.length - 1;
          onChange(updateRoadDraftPoint(draft, section.id, index, section.centerlineWgs84[index], null), 'Disconnect road end');
        }}>Disconnect</button>{!attached.length && <button type="button" disabled={connection.target !== 'cityjson'} onClick={() => onCreate?.(section.id, endpoint)}>Build intersection</button>}</div>}
      </div>;
    })}
    <p>Only the selected lane’s movements are highlighted on the map. Edit an intersection to enable or disable individual connections.</p>
  </div>;
}
