import { useState, useRef, useEffect, useCallback } from 'react';
import type { CityJsonDocument, SelectionInfo, PrimitiveValidationState, AttributeValue } from '../types';

export function useCoreState() {
  const [cityjson, setCityjson] = useState<CityJsonDocument | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [drawMode, setDrawMode] = useState<'none' | 'polygon' | 'road-line'>('none');
  const [filter, setFilter] = useState<Record<string, any>>({});
  const [showList, setShowList] = useState(false);
  const [primitiveValidation, setPrimitiveValidation] = useState<PrimitiveValidationState>({
    kind: 'unchecked',
    message: '3D primitive validity has not been checked yet.',
  });

  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const cityjsonRef = useRef<CityJsonDocument | null>(null);
  const mapBboxRef = useRef<[number, number, number, number] | null>(null);
  const [originals] = useState<Map<string, Record<string, AttributeValue>>>(new Map());

  useEffect(() => {
    cityjsonRef.current = cityjson;
  }, [cityjson]);

  useEffect(() => {
    dirtyIdsRef.current = dirtyIds;
  }, [dirtyIds]);

  const markGeometryChanged = useCallback((message = 'Geometry changed; run Check 3D or Save seq.') => {
    setPrimitiveValidation({ kind: 'unchecked', message });
  }, []);

  return {
    cityjson,
    setCityjson,
    fileName,
    setFileName,
    selection,
    setSelection,
    dirtyIds,
    setDirtyIds,
    dirtyIdsRef,
    reloadToken,
    setReloadToken,
    saveStatus,
    setSaveStatus,
    drawMode,
    setDrawMode,
    filter,
    setFilter,
    showList,
    setShowList,
    primitiveValidation,
    setPrimitiveValidation,
    cityjsonRef,
    mapBboxRef,
    originals,
    markGeometryChanged,
  };
}

export type CoreState = ReturnType<typeof useCoreState>;
