import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import type { CityJsonDocument } from '../types';
import { extractFootprints } from '../lib/footprints';
import {
  groundHamburgLod3Tile,
  HAMBURG_LOD3_TILESET_URL,
} from '../lib/hamburg-lod3-tiles';
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
  const center = useMemo(() => buildingCenter(cityjson), [cityjson]);
  const object = cityjson.CityObjects[buildingId];
  const officialHamburgSource =
    !!center &&
    buildingId.startsWith('DEHHALKA') &&
    object?.attributes?._createdBy == null &&
    center[0] >= 9.7 && center[0] <= 10.4 && center[1] >= 53.3 && center[1] <= 53.8;
  const [mode, setMode] = useState<'photo' | 'editable'>(
    officialHamburgSource ? 'photo' : 'editable'
  );

  useEffect(() => {
    setMode(officialHamburgSource ? 'photo' : 'editable');
  }, [buildingId, officialHamburgSource]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {mode === 'photo' && center ? (
        <OfficialHamburgDetail center={center} />
      ) : (
        <Viewer
          cityjson={cityjson}
          reloadToken={reloadToken}
          onSelect={() => {}}
          splitPreview={splitPreview}
          onAdjustSplit={onAdjustSplit}
        />
      )}
      {officialHamburgSource && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            zIndex: 4,
            display: 'flex',
            padding: 3,
            gap: 3,
            borderRadius: 8,
            background: 'rgba(24, 29, 39, 0.88)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(7px)',
          }}
          aria-label="Building detail source"
        >
          <DetailButton active={mode === 'photo'} onClick={() => setMode('photo')}>
            Photo LoD3
          </DetailButton>
          <DetailButton active={mode === 'editable'} onClick={() => setMode('editable')}>
            Editable model
          </DetailButton>
        </div>
      )}
      {mode === 'photo' && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            bottom: 8,
            zIndex: 4,
            maxWidth: 'calc(100% - 20px)',
            padding: '5px 8px',
            borderRadius: 6,
            color: '#f7f8fb',
            background: 'rgba(24, 29, 39, 0.8)',
            fontSize: 10,
          }}
        >
          Official Hamburg photo-textured LoD3 · drag to orbit · use “Editable model” for CityJSON edits
        </div>
      )}
    </div>
  );
}

function OfficialHamburgDetail({ center }: { center: [number, number] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const map = new maplibregl.Map({
      container: host,
      style: { version: 8, sources: {}, layers: [] },
      center,
      // Inspector panels are narrow; a street-scale zoom frames the complete
      // selected building instead of placing the camera inside a large facade.
      zoom: 17.45,
      pitch: 52,
      bearing: -24,
      attributionControl: false,
      dragPan: true,
      touchZoomRotate: true,
    });
    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [
        new Tile3DLayer({
          id: 'hamburg-building-detail-lod3',
          data: HAMBURG_LOD3_TILESET_URL,
          loadOptions: {
            tileset: {
              maximumScreenSpaceError: 5,
              maximumMemoryUsage: 72,
              throttleRequests: true,
            },
          },
          opacity: 1,
          pickable: false,
          onTileLoad: groundHamburgLod3Tile,
        }),
      ],
    });
    map.addControl(overlay as unknown as maplibregl.IControl);
    map.once('load', () => map.resize());
    return () => map.remove();
  }, [center]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, background: '#d9dde5' }} />;
}

function DetailButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: '6px 10px',
        border: active ? '1px solid #82a9ff' : '1px solid transparent',
        borderRadius: 6,
        background: active ? '#467eea' : 'transparent',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function buildingCenter(doc: CityJsonDocument): [number, number] | null {
  const points = extractFootprints(doc).flatMap((footprint) => footprint.polygon);
  if (points.length === 0) return null;
  const west = Math.min(...points.map((point) => point[0]));
  const east = Math.max(...points.map((point) => point[0]));
  const south = Math.min(...points.map((point) => point[1]));
  const north = Math.max(...points.map((point) => point[1]));
  return [(west + east) / 2, (south + north) / 2];
}
