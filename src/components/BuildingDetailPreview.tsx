import { useEffect, useMemo, useState } from 'react';
import type { CityJsonDocument } from '../types';
import { filterToBuilding } from '../lib/footprints';
import {
  HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE,
  HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE,
  HAMBURG_TILE_TEXTURES_AVAILABLE_ATTRIBUTE,
} from '../lib/hamburg-3d-tiles-edit';
import Viewer, { type SplitPreviewInfo } from './Viewer';

interface Props {
  cityjson: CityJsonDocument;
  buildingId: string;
  reloadToken: number;
  splitPreview: SplitPreviewInfo | null;
  texturesEnabled: boolean;
  onTexturesEnabledChange: (enabled: boolean) => void;
  onAdjustSplit?: (index: number, delta: number) => void;
}

export default function BuildingDetailPreview({
  cityjson,
  buildingId,
  reloadToken,
  splitPreview,
  texturesEnabled,
  onTexturesEnabledChange,
  onAdjustSplit,
}: Props) {
  const selectedDocument = useMemo(
    () => filterToBuilding(cityjson, buildingId),
    [buildingId, cityjson, reloadToken]
  );
  const availability = useMemo(
    () => inspectDetailAvailability(selectedDocument),
    [selectedDocument]
  );
  const [lod, setLod] = useState<'lod2' | 'lod3'>(
    availability.lod3 ? 'lod3' : 'lod2'
  );

  useEffect(() => {
    setLod(availability.lod3 ? 'lod3' : 'lod2');
  }, [availability.lod3, buildingId]);

  const textureOptionAvailable =
    availability.lod3Textures || availability.remoteLod3Textures;
  const texturesActive =
    lod === 'lod3' && availability.lod3Textures && texturesEnabled;
  const remoteMapTexturesActive =
    lod === 'lod3' &&
    availability.remoteLod3Textures &&
    texturesEnabled;
  const textureStatus = texturesActive
    ? 'photo textures on'
    : remoteMapTexturesActive
      ? 'photo textures visible on map · semantic editable preview'
      : availability.remoteLod3Textures
        ? 'photo textures off · semantic editable preview'
        : 'semantic surface colours';

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Viewer
        cityjson={selectedDocument}
        reloadToken={reloadToken}
        onSelect={() => {}}
        lod={lod}
        texturesEnabled={texturesActive}
        splitPreview={splitPreview}
        onAdjustSplit={onAdjustSplit}
      />

      <div className="building-detail-controls" aria-label="Selected building detail">
        <div className="building-detail-controls__lod" role="group" aria-label="Building LoD">
          <DetailButton
            active={lod === 'lod2'}
            disabled={!availability.lod2}
            onClick={() => setLod('lod2')}
          >
            LoD2
          </DetailButton>
          <DetailButton
            active={lod === 'lod3'}
            disabled={!availability.lod3}
            onClick={() => setLod('lod3')}
          >
            LoD3
          </DetailButton>
        </div>
        {textureOptionAvailable && lod === 'lod3' && (
          <label>
            <span>Textures</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Selected building textures"
              checked={texturesEnabled}
              onChange={(event) =>
                onTexturesEnabledChange(event.target.checked)
              }
            />
          </label>
        )}
      </div>

      <div className="building-detail-status">
        Selected building only · {lod === 'lod3' ? 'LoD3' : 'LoD2'} ·{' '}
        {textureStatus}
        {!availability.lod3 && ' · no LoD3 geometry in this object'}
      </div>
    </div>
  );
}

function DetailButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={active ? 'is-active' : ''}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function inspectDetailAvailability(doc: CityJsonDocument): {
  lod2: boolean;
  lod3: boolean;
  lod3Textures: boolean;
  remoteLod3Textures: boolean;
} {
  let lod2 = false;
  let lod3 = false;
  let lod3Textures = false;
  let remoteLod3Textures = false;
  for (const object of Object.values(doc.CityObjects)) {
    if (
      object.attributes?.[HAMBURG_TILE_TEXTURES_AVAILABLE_ATTRIBUTE] === true &&
      object.attributes?.[HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE] === true &&
      object.attributes?.[HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE] !== true
    ) {
      remoteLod3Textures = true;
    }
    for (const geometry of object.geometry ?? []) {
      const candidate = geometry as { lod?: string | number; texture?: unknown };
      const value = Number.parseFloat(String(candidate.lod ?? ''));
      if (!Number.isFinite(value)) continue;
      if (value >= 3) {
        lod3 = true;
        if (candidate.texture != null) lod3Textures = true;
      } else {
        lod2 = true;
      }
    }
  }
  const appearance = doc.appearance as { textures?: unknown[] } | undefined;
  lod3Textures = lod3Textures && !!appearance?.textures?.length;
  return { lod2, lod3, lod3Textures, remoteLod3Textures };
}
