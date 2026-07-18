// Ambient types for cityjson-threejs-loader (upstream has no .d.ts files).
// Only what we call is declared — extend as we use more of the API.

declare module 'cityjson-threejs-loader' {
  import { Box3, Group, Matrix4 } from 'three';

  interface BaseParser {
    resetMaterial(): void;
    matrix: Matrix4 | null;
    surfaceColors: Record<string, number>;
    lods: string[];
  }

  export class CityJSONParser implements BaseParser {
    constructor();
    resetMaterial(): void;
    parse(data: unknown, scene: Group): void;
    matrix: Matrix4 | null;
    surfaceColors: Record<string, number>;
    lods: string[];
  }

  export class CityJSONWorkerParser implements BaseParser {
    constructor();
    resetMaterial(): void;
    loading: boolean;
    matrix: Matrix4 | null;
    surfaceColors: Record<string, number>;
    lods: string[];
    onChunkLoad?: () => void;
    onComplete?: () => void;
  }

  export class CityJSONLoader {
    constructor(parser: BaseParser);
    load(data: unknown): void;
    scene: Group;
    boundingBox: Box3;
    matrix: Matrix4;
  }
}

declare module 'cityjson-threejs-loader/src/helpers/AttributeEvaluator' {
  export class AttributeEvaluator {
    constructor(citymodel: unknown, attribute: string, isNumeric: boolean);
  }
}
