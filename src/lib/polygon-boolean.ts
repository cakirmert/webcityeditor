import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import * as preciseClipping from 'polyclip-ts';

type Geometry = Polygon | MultiPolygon;

// The fast sweep-line implementation occasionally fails on near-coincident
// kerb edges after projection. Retry the SAME coordinates with decimal
// arithmetic; never buffer, discard a hole, or waive an overlap to hide it.
function operation(name: 'union' | 'intersection' | 'difference') {
  return (first: Geometry, ...rest: Geometry[]): MultiPolygon => {
    try { return polygonClipping[name](first, ...rest); }
    catch { return preciseClipping[name](first, ...rest); }
  };
}

export const union = operation('union');
export const intersection = operation('intersection');
export const difference = operation('difference');
