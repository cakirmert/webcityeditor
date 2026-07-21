import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import { selectBuildingDetailObjectIds } from '../../src/lib/building-detail-selection';

function selectionDocument(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    vertices: [],
    CityObjects: {
      context: { type: 'Building', geometry: [] },
      edited: {
        type: 'Building',
        children: ['edited-installation'],
        geometry: [],
      },
      'edited-installation': {
        type: 'BuildingInstallation',
        parents: ['edited'],
        geometry: [],
      },
      created: { type: 'Building', geometry: [] },
      road: { type: 'Road', geometry: [] },
    },
  };
}

describe('building close-detail selection', () => {
  it('gives edited and newly created buildings precedence over viewport context', () => {
    const ids = selectBuildingDetailObjectIds(selectionDocument(), {
      visibleObjectIds: ['context'],
      priorityObjectIds: ['road', 'edited', 'created'],
      maxRootObjects: 1,
    });

    expect([...ids!]).toEqual(['edited', 'edited-installation', 'created']);
    expect(ids?.has('context')).toBe(false);
  });

  it('resolves a selected descendant to one stable root and includes all detail children', () => {
    const ids = selectBuildingDetailObjectIds(selectionDocument(), {
      visibleObjectIds: ['context'],
      selectedObjectId: 'edited-installation',
      maxRootObjects: 2,
    });

    expect([...ids!]).toEqual(['edited', 'edited-installation', 'context']);
  });
});
