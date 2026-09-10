import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import RoadJunctionPanel from '../../src/components/RoadJunctionPanel';
import { extractTransportationAreas } from '../../src/lib/transportation';
import { buildRoadJunctionPlan, readRoadJunction, type RoadJunctionDraft } from '../../src/lib/road-junctions';
import { suggestJunctionCluster } from '../../src/lib/junction-clusters';

const areas = extractTransportationAreas(JSON.parse(readFileSync('public/examples/hamburg-roedingsmarkt-source.json', 'utf8')));
const id = 'hh-road-r00-c00-osm2streets-intersection-210';

function setup() {
  const onChange = vi.fn<(draft: RoadJunctionDraft) => void>();
  const panel = (junctionId: string) => {
    const draft = readRoadJunction(areas, junctionId);
    return <RoadJunctionPanel key={junctionId} draft={draft} plan={buildRoadJunctionPlan(draft, areas)} areas={areas}
      tool="none" onToolChange={vi.fn()} onCompare={vi.fn()} onChange={onChange} />;
  };
  const rendered = render(panel(id));
  fireEvent.click(screen.getByRole('tab', { name: 'Shape' }));
  return { onChange, panel, ...rendered };
}

describe('intersection generation scope', () => {
  it('defaults to the selected intersection even when a large connected group is available', () => {
    const { onChange } = setup();
    expect(suggestJunctionCluster(areas, id, 'larger')!.internalRoadIds.length).toBeGreaterThan(10);
    expect(screen.getByRole('button', { name: 'Selected intersection' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Generate combined intersection/ })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate intersection' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...readRoadJunction(areas, id), surfaceMode: 'rebuild', footprint: undefined });
    expect(onChange.mock.calls[0][0].mergedFrom).toBeUndefined();
  });

  it('does not keep the wider scope when the user switches back before generating', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Larger area' }));
    expect(screen.getByRole('button', { name: /Generate combined intersection/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Selected intersection' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate intersection' }));
    expect(onChange.mock.calls[0][0].roadIds).toEqual(readRoadJunction(areas, id).roadIds);
    expect(onChange.mock.calls[0][0].mergedFrom).toBeUndefined();
  });

  it('only combines neighbours after selecting Larger area and explicitly generating', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Larger area' }));
    const group = suggestJunctionCluster(areas, id, 'larger')!;
    expect(screen.getByText(`${group.junctionIds.length} junction pieces · ${group.internalRoadIds.length} internal roads · ${group.roadIds.length} outside approaches`)).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Generate combined intersection/ }));
    const next = onChange.mock.calls[0][0];
    expect(next.mergedFrom).toEqual({ junctionIds: group.junctionIds, internalRoadIds: group.internalRoadIds });
    expect(next.roadIds).toEqual(group.roadIds);
    expect(next.surfaceMode).toBe('rebuild');
  });

  it('opens the next selected intersection with the local scope', () => {
    const { panel, rerender, onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Larger area' }));
    const nextId = suggestJunctionCluster(areas, id, 'larger')!.junctionIds.find(other => other !== id)!;
    rerender(panel(nextId));
    fireEvent.click(screen.getByRole('tab', { name: 'Shape' }));
    expect(screen.getByRole('button', { name: 'Selected intersection' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Generate intersection' }));
    expect(onChange.mock.calls[0][0].id).toBe(nextId);
    expect(onChange.mock.calls[0][0].mergedFrom).toBeUndefined();
  });
});
