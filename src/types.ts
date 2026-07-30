// Minimal CityJSON 2.0 types used by the editor. Not spec-exhaustive.

export interface CityJsonTransform {
  scale: [number, number, number];
  translate: [number, number, number];
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type AttributeValue = JsonValue | undefined;

export interface CityObject {
  type: string;
  attributes?: Record<string, AttributeValue>;
  geometry?: unknown[];
  children?: string[];
  parents?: string[];
  /** Optional CityJSONFeature extent carried by datasets such as 3DBAG. */
  geographicalExtent?: number[];
}

export interface CityJsonDocument {
  type: 'CityJSON';
  version: string;
  metadata?: {
    referenceSystem?: string;
    geographicalExtent?: number[];
    [k: string]: unknown;
  };
  transform?: CityJsonTransform;
  CityObjects: Record<string, CityObject>;
  vertices: [number, number, number][];
  appearance?: unknown;
  extensions?: unknown;
}

export interface SelectionInfo {
  objectId: string;
  surfaceType?: string | null;
  geometryIndex?: number;
  boundaryIndex?: number;
  lodIndex?: number;
  /** True when the click was Ctrl/Cmd+click (for multi-selection). */
  ctrlKey?: boolean;
}

import type { CityJsonSeqLoadedTile } from './lib/cityjsonseq-catalog';
import type { RoofType, WindowPattern } from './lib/generator';
import type { SplitAxis } from './lib/subdivision';

export interface CatalogConnection {
  baseUrl: string;
  /** Original catalog endpoint or static catalog JSON URL used for viewport reads. */
  catalogUrl?: string;
  crs: string;
  loadedTiles: Map<string, CityJsonSeqLoadedTile>;
  loadMode?: 'viewport' | 'all';
  catalogType?: string;
  /** Static GitHub Pages catalogs can be edited in memory, but not written back. */
  readOnly?: boolean;
}

export type PrimitiveValidationState = {
  kind: 'unchecked' | 'checking' | 'valid' | 'invalid' | 'unavailable';
  message: string;
};

export interface NewBuildingForm {
  totalHeight: number;
  storeys: number;
  roofType: RoofType;
  roofHeight: number;
  function: string;
  yearOfConstruction: number | null;
  splitMode: 'none' | 'floors' | 'sides';
  splitCount: number;
  splitAxis: SplitAxis;
  addWindows: boolean;
  addDoor: boolean;
  windowPattern: WindowPattern;
  eaveOverhang: number;
  rakeOverhang: number;
}
