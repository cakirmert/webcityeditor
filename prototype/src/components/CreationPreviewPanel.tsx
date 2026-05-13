import { useMemo } from 'react';
import Viewer from './Viewer';
import type { CityJsonDocument } from '../types';
import type { NewBuildingForm } from './NewBuildingDialog';
import { detectCrs } from '../lib/projection';
import { generateBuilding, insertBuilding } from '../lib/generator';

interface Props {
  footprint: [number, number][];
  form: NewBuildingForm | null;
  cityjson: CityJsonDocument;
}

export default function CreationPreviewPanel({ footprint, form, cityjson }: Props) {
  const previewDoc = useMemo(() => {
    if (!form) return null;
    return buildPreviewDoc(footprint, form, cityjson);
  }, [footprint, form, cityjson]);

  if (!previewDoc) return null;

  return (
    <div className="creation-preview-panel">
      <div className="creation-preview-header">
        <span>3D Preview</span>
      </div>
      <div className="creation-preview-viewer">
        <Viewer
          cityjson={previewDoc}
          reloadToken={hashForm(form)}
          onSelect={() => {}}
        />
      </div>
    </div>
  );
}

function hashForm(form: NewBuildingForm | null): number {
  if (!form) return 0;
  return Math.round(
    form.totalHeight * 1000 +
    form.storeys * 100 +
    form.roofHeight * 10 +
    (form.addWindows ? 1 : 0) +
    (form.addDoor ? 2 : 0) +
    form.eaveOverhang * 5 +
    form.rakeOverhang * 7
  );
}

function buildPreviewDoc(
  footprint: [number, number][],
  form: NewBuildingForm,
  hostDoc: CityJsonDocument
): CityJsonDocument | null {
  const crs = detectCrs(hostDoc);
  if (!crs.supported) return null;

  try {
    const eaveHeight = form.roofType === 'flat' ? form.totalHeight : form.totalHeight - form.roofHeight;
    const doc: CityJsonDocument = {
      type: 'CityJSON',
      version: hostDoc.version,
      metadata: hostDoc.metadata ? { ...hostDoc.metadata } : undefined,
      transform: hostDoc.transform
        ? { scale: [...hostDoc.transform.scale], translate: [...hostDoc.transform.translate] }
        : { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] },
      CityObjects: {},
      vertices: [],
    };
    const result = generateBuilding(doc, {
      targetCrs: crs.code,
      footprintWgs84: footprint,
      storeys: form.storeys,
      eaveHeight,
      ridgeHeight: form.totalHeight,
      roofType: form.roofType,
      attributes: { function: form.function },
      openings: (form.addWindows || form.addDoor) ? { windows: form.addWindows, door: form.addDoor } : undefined,
      eaveOverhang: form.eaveOverhang,
      rakeOverhang: form.rakeOverhang,
    });
    insertBuilding(doc, result);
    return doc;
  } catch {
    return null;
  }
}
