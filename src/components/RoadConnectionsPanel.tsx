import { useMemo } from 'react';
import { buildRoadConnectionIndex } from '../lib/road-lane-continuations';
import { updateRoadDraftPoint } from '../lib/road-draft-edit';
import type { RoadArea, RoadDraft, RoadSectionDraft } from '../lib/transportation';

export default function RoadConnectionsPanel({ draft, section, areas, dirty, onChange, onEdit, onCreate }: {
  draft: RoadDraft; section: RoadSectionDraft; areas: RoadArea[]; dirty: boolean;
  onChange: (draft: RoadDraft, label?: string) => void; onEdit: (area: RoadArea) => void;
  onCreate?: (sectionId: string, endpoint: 'start' | 'end') => void;
}) {
  const junctions = useMemo(() => buildRoadConnectionIndex(areas).junctions.filter((junction) => junction.roadIds.includes(draft.id ?? '')), [areas, draft.id]);
  return <div className="road-connections-panel">
    <p>Drag a yellow road end onto a teal target on the map. Then save the join or construct an intersection around it.</p>
    {(['start', 'end'] as const).map((endpoint) => {
      const connection = section.connections?.[endpoint];
      return <div className="road-endpoint-card" key={endpoint}><b>{endpoint === 'start' ? 'Start' : 'End'}</b><span>{connection ? `Connected · ${connection.targetId}` : 'Open end'}</span>
        {connection && <div className="road-profile-actions"><button type="button" onClick={() => {
          const index = endpoint === 'start' ? 0 : section.centerlineWgs84.length - 1;
          onChange(updateRoadDraftPoint(draft, section.id, index, section.centerlineWgs84[index], null), 'Disconnect road end');
        }}>Disconnect</button><button type="button" disabled={dirty || connection.target !== 'cityjson'} title={dirty ? 'Save this road first' : undefined} onClick={() => onCreate?.(section.id, endpoint)}>Build intersection</button></div>}
      </div>;
    })}
    {junctions.length > 0 && <><b>Connected intersections</b>{junctions.map((junction) => {
      const area = areas.find((item) => item.id === junction.areaIds[0]);
      return area ? <button type="button" className="road-wide-action" key={junction.id} onClick={() => onEdit(area)}>Edit intersection · {junction.roadIds.length} approaches</button> : null;
    })}</>}
    <p>Only the selected lane’s movements are highlighted on the map. Edit an intersection to enable or disable individual connections.</p>
  </div>;
}
