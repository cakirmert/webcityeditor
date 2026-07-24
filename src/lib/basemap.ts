export type BasemapMode = 'topplus' | 'satellite';

export interface BasemapLayerComposition {
  topplusVisibility: 'visible' | 'none';
  satelliteVisibility: 'visible' | 'none';
  satelliteOpacity: number;
}

/** Keep the inactive imagery source out of the render stack at every zoom. */
export function basemapLayerComposition(
  basemap: BasemapMode,
  satelliteOpacity: number
): BasemapLayerComposition {
  const opacity = Number.isFinite(satelliteOpacity)
    ? Math.max(0, Math.min(1, satelliteOpacity))
    : 1;
  return {
    topplusVisibility: basemap === 'topplus' ? 'visible' : 'none',
    satelliteVisibility: basemap === 'satellite' ? 'visible' : 'none',
    satelliteOpacity: opacity,
  };
}
