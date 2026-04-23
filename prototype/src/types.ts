// Minimal CityJSON 2.0 types for prototype. Not spec-exhaustive.

export interface CityJsonTransform {
  scale: [number, number, number];
  translate: [number, number, number];
}

export type AttributeValue = string | number | boolean | null | undefined;

export interface CityObject {
  type: string;
  attributes?: Record<string, AttributeValue>;
  geometry?: unknown[];
  children?: string[];
  parents?: string[];
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
}
