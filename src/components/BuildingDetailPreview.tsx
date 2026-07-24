import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { CityJsonDocument } from '../types';
import { extractFootprints, filterToBuilding } from '../lib/footprints';
import {
  hamburgLod3CoversPoint,
  isHamburgOfficialBuildingId,
  loadHamburgLod3Building,
  type HamburgLod3BuildingModel,
} from '../lib/hamburg-lod3-tiles';
import Viewer, { type SplitPreviewInfo } from './Viewer';

interface Props {
  cityjson: CityJsonDocument;
  buildingId: string;
  reloadToken: number;
  splitPreview: SplitPreviewInfo | null;
  onAdjustSplit?: (index: number, delta: number) => void;
}

type RemoteLod3State = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  model: HamburgLod3BuildingModel | null;
  message?: string;
};

interface DetailAvailability {
  lod2: boolean;
  lod3: boolean;
  lod2GeometryCount: number;
  lod3GeometryCount: number;
  lod3ObjectCount: number;
  lod3InstallationCount: number;
  lod3SurfaceCount: number;
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
  const buildingCenter = useMemo(
    () => selectedBuildingCenter(selectedDocument),
    [selectedDocument]
  );
  const remoteLod3Eligible = !availability.lod3 &&
    isHamburgOfficialBuildingId(buildingId) &&
    buildingCenter !== null &&
    hamburgLod3CoversPoint(buildingCenter);
  const [remoteLod3, setRemoteLod3] = useState<RemoteLod3State>({
    status: 'idle',
    model: null,
  });
  const [lod, setLod] = useState<'lod2' | 'lod3'>(
    availability.lod3 || remoteLod3Eligible ? 'lod3' : 'lod2'
  );

  useEffect(() => {
    setLod(availability.lod3 || remoteLod3Eligible ? 'lod3' : 'lod2');
  }, [availability.lod3, remoteLod3Eligible, buildingId]);

  useEffect(() => {
    if (!remoteLod3Eligible || !buildingCenter) {
      setRemoteLod3({ status: 'idle', model: null });
      return;
    }
    const controller = new AbortController();
    let loadedModel: HamburgLod3BuildingModel | null = null;
    setRemoteLod3({ status: 'loading', model: null });
    void loadHamburgLod3Building(buildingId, buildingCenter, controller.signal)
      .then((model) => {
        if (controller.signal.aborted) return;
        loadedModel = model;
        setRemoteLod3(model
          ? { status: 'ready', model }
          : {
              status: 'unavailable',
              model: null,
              message: 'Building was not present in the nearby LoD3 tiles.',
            }
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRemoteLod3({
          status: 'error',
          model: null,
          message: error instanceof Error
            ? error.message
            : 'Could not load Hamburg LoD3 geometry.',
        });
      });
    return () => {
      controller.abort();
      if (loadedModel) disposeRemoteModel(loadedModel.group);
    };
  }, [buildingCenter, buildingId, remoteLod3Eligible]);

  const remoteModel = lod === 'lod3' && remoteLod3.status === 'ready'
    ? remoteLod3.model
    : null;
  const viewerLod = lod === 'lod3' && remoteLod3Eligible && !remoteModel
    ? 'lod2'
    : lod;
  const lod3Available = availability.lod3 || remoteLod3Eligible;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Viewer
        cityjson={selectedDocument}
        reloadToken={reloadToken}
        onSelect={() => {}}
        lod={viewerLod}
        texturesEnabled={false}
        externalModel={remoteModel?.group}
        externalModelKey={remoteModel ? `${buildingId}:${remoteModel.tileUrl}` : undefined}
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
            disabled={!lod3Available}
            onClick={() => setLod('lod3')}
          >
            LoD3
          </DetailButton>
        </div>
      </div>

      <div className="building-detail-status" aria-label="LoD3 data information">
        <strong>{detailStatusText(lod, availability.lod3, remoteLod3)}</strong>
        {lod === 'lod3' && (
          <span>{lod3DataText(availability, remoteLod3)}</span>
        )}
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

function selectedBuildingCenter(doc: CityJsonDocument): [number, number] | null {
  const footprint = extractFootprints(doc)[0];
  if (!footprint || footprint.polygon.length === 0) return null;
  const polygon = footprint.polygon;
  const end = polygon.length > 1 &&
    polygon[0][0] === polygon[polygon.length - 1][0] &&
    polygon[0][1] === polygon[polygon.length - 1][1]
    ? polygon.length - 1
    : polygon.length;
  if (end === 0) return null;
  let lng = 0;
  let lat = 0;
  for (let index = 0; index < end; index += 1) {
    lng += polygon[index][0];
    lat += polygon[index][1];
  }
  return [lng / end, lat / end];
}

function detailStatusText(
  lod: 'lod2' | 'lod3',
  localLod3: boolean,
  remote: RemoteLod3State
): string {
  if (lod === 'lod2') return 'Selected building only / LoD2 / semantic surface colours';
  if (localLod3) {
    return 'Selected building only / LoD3 / semantic surface colours';
  }
  if (remote.status === 'ready') {
    return `Selected building only / LoD3 / Hamburg Geoportal untextured geometry / ${remote.model?.triangleCount ?? 0} triangles`;
  }
  if (remote.status === 'loading') {
    return 'Selected building only / Loading Hamburg Geoportal LoD3 / showing LoD2 temporarily';
  }
  if (remote.status === 'error' || remote.status === 'unavailable') {
    return `Selected building only / LoD3 unavailable / ${remote.message ?? 'showing LoD2'}`;
  }
  return 'Selected building only / LoD3 unavailable';
}

function lod3DataText(
  availability: DetailAvailability,
  remote: RemoteLod3State
): string {
  if (availability.lod3) {
    return `Local CityJSON LoD3: ${availability.lod3ObjectCount} object${
      availability.lod3ObjectCount === 1 ? '' : 's'
    } · ${availability.lod3GeometryCount} geometr${
      availability.lod3GeometryCount === 1 ? 'y' : 'ies'
    } · ${availability.lod3SurfaceCount} surface${
      availability.lod3SurfaceCount === 1 ? '' : 's'
    } · ${availability.lod3InstallationCount} installation${
      availability.lod3InstallationCount === 1 ? '' : 's'
    }`;
  }
  if (remote.status === 'ready') {
    return `Hamburg Geoportal streamed LoD3: ${remote.model?.triangleCount ?? 0} triangles`;
  }
  if (remote.status === 'loading') return 'Hamburg Geoportal LoD3 data is loading';
  if (remote.status === 'error' || remote.status === 'unavailable') {
    return `Hamburg Geoportal LoD3: ${remote.message ?? 'unavailable for this object'}`;
  }
  return 'No LoD3 source is available for this object';
}

function disposeRemoteModel(group: THREE.Group): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
}

function inspectDetailAvailability(doc: CityJsonDocument): DetailAvailability {
  let lod2 = false;
  let lod3 = false;
  let lod2GeometryCount = 0;
  let lod3GeometryCount = 0;
  let lod3SurfaceCount = 0;
  let lod3InstallationCount = 0;
  const lod3ObjectIds = new Set<string>();
  for (const [objectId, object] of Object.entries(doc.CityObjects)) {
    let objectHasLod3 = false;
    for (const geometry of object.geometry ?? []) {
      const candidate = geometry as {
        type?: string;
        lod?: string | number;
        boundaries?: unknown;
      };
      const value = Number.parseFloat(String(candidate.lod ?? ''));
      if (!Number.isFinite(value)) continue;
      if (value >= 3) {
        lod3 = true;
        objectHasLod3 = true;
        lod3GeometryCount++;
        lod3SurfaceCount += geometrySurfaceCount(candidate.type, candidate.boundaries);
      } else {
        lod2 = true;
        lod2GeometryCount++;
      }
    }
    if (objectHasLod3) {
      lod3ObjectIds.add(objectId);
      if (object.type === 'BuildingInstallation') lod3InstallationCount++;
    }
  }
  return {
    lod2,
    lod3,
    lod2GeometryCount,
    lod3GeometryCount,
    lod3ObjectCount: lod3ObjectIds.size,
    lod3InstallationCount,
    lod3SurfaceCount,
  };
}

function geometrySurfaceCount(type: string | undefined, boundaries: unknown): number {
  if (!Array.isArray(boundaries)) return 0;
  if (type === 'MultiSurface' || type === 'CompositeSurface') return boundaries.length;
  if (type === 'Solid') {
    return boundaries.reduce(
      (count, shell) => count + (Array.isArray(shell) ? shell.length : 0),
      0
    );
  }
  if (type === 'MultiSolid' || type === 'CompositeSolid') {
    return boundaries.reduce(
      (solidCount, solid) => solidCount + (
        Array.isArray(solid)
          ? solid.reduce(
              (shellCount, shell) => shellCount + (Array.isArray(shell) ? shell.length : 0),
              0
            )
          : 0
      ),
      0
    );
  }
  return 0;
}
