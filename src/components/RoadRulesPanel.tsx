import { useRef, useState } from 'react';
import { HAMBURG_ROAD_RULES, fitRoadDraftToRules, parseRoadRuleProfile, roadSectionExtents, roadWidthRule, type RoadRuleIssue } from '../lib/road-rules';
import type { RoadDraft, RoadSectionDraft } from '../lib/transportation';

export default function RoadRulesPanel({ draft, section, issues, onChange }: {
  draft: RoadDraft; section: RoadSectionDraft; issues: RoadRuleIssue[];
  onChange: (draft: RoadDraft, label?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const profile = draft.ruleProfile ?? HAMBURG_ROAD_RULES;
  const extents = roadSectionExtents(section);
  const patch = (next: Partial<RoadSectionDraft>) => onChange({ ...draft, ruleProfile: structuredClone(profile), sections: draft.sections.map((item) => item.id === section.id ? { ...item, ...next } : item) }, 'Change road extent');
  return <div className="road-rules-panel">
    <div><b>{profile.name}</b><small>Policy {profile.version} · project checks, with source notes</small></div>
    <p>Dashed amber lines show left/right limits measured from the directed centreline. Leave a limit blank where the available space is unknown.</p>
    <div className="road-rules-extents">
      {(['left', 'right'] as const).map((side) => <label key={side}>
        <span>{side === 'left' ? 'Left' : 'Right'} limit (m)</span>
        <input type="number" min="0" step="0.1" value={section.extentLimits?.[side] ?? ''} placeholder="Unknown"
          onChange={(e) => patch({ extentLimits: { ...section.extentLimits, [side]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
        <small>Used: {extents[`${side}M`].toFixed(2)} m</small>
      </label>)}
      <label><span>Offset to left (m)</span><input type="number" step="0.001" value={Number((section.offsetM ?? 0).toFixed(3))} onChange={(e) => patch({ offsetM: Number(e.target.value) })} /></label>
    </div>
    <button type="button" className="road-wide-action" onClick={() => {
      const result = fitRoadDraftToRules(draft);
      setMessage(result.error ?? 'Widths fitted. Review the live road before saving.');
      if (!result.error) onChange(result.draft, 'Fit road to width rules');
    }}>Fit widths to available space</button>
    {message && <p role="status">{message}</p>}
    <table className="road-rule-table"><caption>Active section · metres</caption><thead><tr><th>Band</th><th>Minimum</th><th>Target</th></tr></thead><tbody>
      {section.bands.map((band, i) => { const rule = roadWidthRule(band, profile); return <tr key={i}><th>{i + 1}. {band.kind.replaceAll('_', ' ')}{band.direction === 'both' ? ' ↔' : ''}</th><td>{rule.minimumM.toFixed(2)}</td><td>{rule.recommendedM.toFixed(2)}</td></tr>; })}
    </tbody></table>
    {issues.length > 0 ? <ul className="road-rule-issues">{issues.map((issue, i) => <li key={i} className={`is-${issue.severity}`}>{issue.message}</li>)}</ul> : <p role="status">All project width and extent checks pass.</p>}
    <details><summary>Sources and assumptions</summary>
      <p>These checks support concept design. Clear pedestrian space, traffic demand, vehicle swept paths and local approvals still need review.</p>
      {Object.entries(profile.widths).map(([kind, rule]) => <p key={kind}><b>{kind.replaceAll('_', ' ')}: </b>{rule.note} {rule.source.startsWith('https://') ? <a href={rule.source} target="_blank" rel="noreferrer">Source</a> : <em>{rule.source}</em>}</p>)}
    </details>
    <div className="road-profile-actions">
      <button type="button" onClick={() => input.current?.click()}>Import city rules</button>
      <button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `${profile.id}.rules.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export rules</button>
    </div>
    <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Import city rule profile" onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try { const next = parseRoadRuleProfile(JSON.parse(await file.text())); onChange({ ...draft, ruleProfile: next }, 'Change city rule profile'); setMessage(`Loaded ${next.name}. Existing widths are retained.`); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load profile.'); }
      e.target.value = '';
    }} />
  </div>;
}
