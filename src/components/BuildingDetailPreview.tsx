import { useEffect, useMemo, useState } from 'react';
import type { CityJsonDocument } from '../types';
import { filterToBuilding } from '../lib/footprints';
import Viewer, { type SplitPreviewInfo } from './Viewer';

interface Props {
  cityjson: CityJsonDocument;
  buildingId: string;
  reloadToken: number;
  splitPreview: SplitPreviewInfo | null;
  onAdjustSplit?: (index: number, delta: number) => void;
}

export default function BuildingDetailPreview({
  cityjson,
  buildingId,
  reloadToken,
  splitPreview,
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
  const [texturesEnabled, setTexturesEnabled] = useState(false);

  useEffect(() => {
    setLod(availability.lod3 ? 'lod3' : 'lod2');
    setTexturesEnabled(false);
  }, [availability.lod3, buildingId]);

  const texturesActive = lod === 'lod3' && availability.lod3Textures && texturesEnabled;

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
        <label className={!availability.lod3Textures || lod !== 'lod3' ? 'is-disabled' : ''}>
          <span>Textures</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Selected building textures"
            checked={texturesEnabled}
            disabled={!availability.lod3Textures || lod !== 'lod3'}
            onChange={(event) => setTexturesEnabled(event.target.checked)}
          />
        </label>
      </div>

      <div className="building-detail-status">
        Selected building only · {lod === 'lod3' ? 'LoD3' : 'LoD2'} ·{' '}
        {texturesActive ? 'photo textures on' : 'semantic surface colours'}
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
} {
  let lod2 = false;
  let lod3 = false;
  let lod3Textures = false;
  for (const object of Object.values(doc.CityObjects)) {
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
  return { lod2, lod3, lod3Textures };
}
