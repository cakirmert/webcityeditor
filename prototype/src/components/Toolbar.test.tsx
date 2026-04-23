import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from './Toolbar';

const defaultStats = {
  version: '2.0',
  totalObjects: 100,
  rootBuildings: 42,
  vertices: 12345,
  crs: 'https://www.opengis.net/def/crs/EPSG/0/28992',
};

describe('<Toolbar />', () => {
  it('always shows the app title', () => {
    render(
      <Toolbar
        fileName=""
        stats={null}
        dirtyCount={0}
        hasData={false}
        onExport={() => {}}
        onReloadView={() => {}}
        onNewFile={() => {}}
      />
    );
    expect(screen.getByText('City Editor')).toBeInTheDocument();
  });

  it('shows file name and stats when data is loaded', () => {
    render(
      <Toolbar
        fileName="9-284-556.city.json"
        stats={defaultStats}
        dirtyCount={0}
        hasData={true}
        onExport={() => {}}
        onReloadView={() => {}}
        onNewFile={() => {}}
      />
    );
    expect(screen.getByText('9-284-556.city.json')).toBeInTheDocument();
    expect(screen.getByText('2.0')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/12,345/)).toBeInTheDocument();
    expect(screen.getByText('EPSG:28992')).toBeInTheDocument();
  });

  it('shows unsaved-count warning when dirty', () => {
    render(
      <Toolbar
        fileName="some.city.json"
        stats={defaultStats}
        dirtyCount={3}
        hasData={true}
        onExport={() => {}}
        onReloadView={() => {}}
        onNewFile={() => {}}
      />
    );
    expect(screen.getByText(/3 unsaved/)).toBeInTheDocument();
  });

  it('hides action buttons when no data is loaded', () => {
    render(
      <Toolbar
        fileName=""
        stats={null}
        dirtyCount={0}
        hasData={false}
        onExport={() => {}}
        onReloadView={() => {}}
        onNewFile={() => {}}
      />
    );
    expect(screen.queryByText(/Export CityJSON/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reload view/)).not.toBeInTheDocument();
  });

  it('fires onExport when the export button is clicked', async () => {
    const onExport = vi.fn();
    render(
      <Toolbar
        fileName="x"
        stats={defaultStats}
        dirtyCount={1}
        hasData={true}
        onExport={onExport}
        onReloadView={() => {}}
        onNewFile={() => {}}
      />
    );
    await userEvent.click(screen.getByText(/Export CityJSON/));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('fires onReloadView and onNewFile appropriately', async () => {
    const onReloadView = vi.fn();
    const onNewFile = vi.fn();
    render(
      <Toolbar
        fileName="x"
        stats={defaultStats}
        dirtyCount={0}
        hasData={true}
        onExport={() => {}}
        onReloadView={onReloadView}
        onNewFile={onNewFile}
      />
    );
    await userEvent.click(screen.getByText(/Reload view/));
    expect(onReloadView).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText(/Load another/));
    expect(onNewFile).toHaveBeenCalledTimes(1);
  });
});
