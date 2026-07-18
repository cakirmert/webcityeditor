import {
  projectCrsBboxToWgs84,
  projectWgs84BboxToCrs,
  type Bbox2D,
} from './projection';

export type Wgs84Bbox = Bbox2D;

interface RoadQueryBboxLimitOptions {
  metricCrs: string;
  maxWidthMeters: number;
  maxHeightMeters: number;
}

export function limitRoadQueryBbox(
  bbox: Wgs84Bbox,
  options: RoadQueryBboxLimitOptions
): { bbox: Wgs84Bbox; wasLimited: boolean } {
  if (options.maxWidthMeters <= 0 || options.maxHeightMeters <= 0) {
    throw new Error('Road query bbox limits must be positive');
  }

  const metricBbox = projectWgs84BboxToCrs(bbox, options.metricCrs);
  const [minX, minY, maxX, maxY] = metricBbox;
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= options.maxWidthMeters && height <= options.maxHeightMeters) {
    return { bbox, wasLimited: false };
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfWidth = options.maxWidthMeters / 2;
  const halfHeight = options.maxHeightMeters / 2;
  const limitedMetricBbox: Bbox2D = [
    Math.max(minX, centerX - halfWidth),
    Math.max(minY, centerY - halfHeight),
    Math.min(maxX, centerX + halfWidth),
    Math.min(maxY, centerY + halfHeight),
  ];
  return {
    bbox: metricBboxToLimitedWgs84(limitedMetricBbox, bbox, options),
    wasLimited: true,
  };
}

function metricBboxToLimitedWgs84(
  metricBbox: Bbox2D,
  original: Wgs84Bbox,
  options: RoadQueryBboxLimitOptions
): Wgs84Bbox {
  let current = metricBbox;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wgs84 = clampBboxToOriginal(projectCrsBboxToWgs84(current, options.metricCrs), original);
    const roundTripped = projectWgs84BboxToCrs(wgs84, options.metricCrs);
    const width = roundTripped[2] - roundTripped[0];
    const height = roundTripped[3] - roundTripped[1];
    if (width <= options.maxWidthMeters && height <= options.maxHeightMeters) return wgs84;

    const centerX = (current[0] + current[2]) / 2;
    const centerY = (current[1] + current[3]) / 2;
    const halfWidth = ((current[2] - current[0]) / 2) * Math.min(1, options.maxWidthMeters / width);
    const halfHeight =
      ((current[3] - current[1]) / 2) * Math.min(1, options.maxHeightMeters / height);
    current = [centerX - halfWidth, centerY - halfHeight, centerX + halfWidth, centerY + halfHeight];
  }
  return clampBboxToOriginal(projectCrsBboxToWgs84(current, options.metricCrs), original);
}

function clampBboxToOriginal(bbox: Wgs84Bbox, original: Wgs84Bbox): Wgs84Bbox {
  return [
    Math.max(original[0], bbox[0]),
    Math.max(original[1], bbox[1]),
    Math.min(original[2], bbox[2]),
    Math.min(original[3], bbox[3]),
  ];
}
