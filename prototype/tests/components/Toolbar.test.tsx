import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from '../../src/components/Toolbar';

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
        onOpenLoader={() => {}}
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
        onOpenLoader={() => {}}
      />
    );
    expect(screen.getByText('9-284-556.city.json')).toBeInTheDocument();
    expect(screen.getByText('2.0')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/12[,.]?345/)).toBeInTheDocument();
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
        onOpenLoader={() => {}}
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
        onOpenLoader={() => {}}
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
        onOpenLoader={() => {}}
      />
    );
    await userEvent.click(screen.getByText(/Export CityJSON/));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('fires onReloadView from More and opens the data loader', async () => {
    const onReloadView = vi.fn();
    const onOpenLoader = vi.fn();
    render(
      <Toolbar
        fileName="x"
        stats={defaultStats}
        dirtyCount={0}
        hasData={true}
        onExport={() => {}}
        onReloadView={onReloadView}
        onOpenLoader={onOpenLoader}
      />
    );
    await userEvent.click(screen.getByText('Data'));
    expect(onOpenLoader).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText('More'));
    await userEvent.click(screen.getByText(/Reload view/));
    expect(onReloadView).toHaveBeenCalledTimes(1);
  });

  it('shows the connected CityJSONSeq tile count and reloads the viewport on request', async () => {
    const onLoadCatalogViewport = vi.fn();
    render(
      <Toolbar
        fileName="Hamburg CityJSONSeq catalog"
        stats={defaultStats}
        dirtyCount={0}
        hasData={true}
        onExport={() => {}}
        onReloadView={() => {}}
        onOpenLoader={() => {}}
        catalogState={{ loadedTiles: 9, loading: false }}
        onLoadCatalogViewport={onLoadCatalogViewport}
      />
    );
    await userEvent.click(screen.getByText('More'));
    await userEvent.click(screen.getByText(/Seq tiles 9/));
    expect(onLoadCatalogViewport).toHaveBeenCalledTimes(1);
  });

  it('persists dirty CityJSONSeq catalog tiles on request', async () => {
    const onPersistCatalog = vi.fn();
    render(
      <Toolbar
        fileName="Hamburg CityJSONSeq catalog"
        stats={defaultStats}
        dirtyCount={1}
        hasData={true}
        onExport={() => {}}
        onReloadView={() => {}}
        onOpenLoader={() => {}}
        catalogState={{ loadedTiles: 9, loading: false, dirty: true }}
        onPersistCatalog={onPersistCatalog}
      />
    );
    await userEvent.click(screen.getByText('Save seq'));
    expect(onPersistCatalog).toHaveBeenCalledTimes(1);
  });

  it('surfaces browser structure and ISO primitive validation separately', async () => {
    const onShow = vi.fn();
    const onValidate = vi.fn();
    render(
      <Toolbar
        fileName="x.city.json"
        stats={defaultStats}
        dirtyCount={0}
        hasData={true}
        onExport={() => {}}
        onReloadView={() => {}}
        onOpenLoader={() => {}}
        integrity={{ errorCount: 0, warningCount: 0, onShow }}
        primitiveValidation={{
          kind: 'unchecked',
          message: 'Run the local ISO 19107 check',
          onValidate,
        }}
      />
    );

    await userEvent.click(screen.getByText('Structure: valid'));
    await userEvent.click(screen.getByText('Check 3D'));
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onValidate).toHaveBeenCalledTimes(1);
  });
});
