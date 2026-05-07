/**
 * Minimal type declaration for earcut. The package ships only an untyped
 * `src/earcut.js` and there's no `@types/earcut` on npm, so we declare just
 * the call signature we use (point-in-poly triangulation with optional hole
 * indices).
 */
declare module 'earcut' {
  function earcut(
    flatCoords: number[],
    holeIndices?: number[],
    dim?: number
  ): number[];
  export default earcut;
}
