import * as path from 'node:path'
import type { NewDistrictOptions } from './newDistrictTypes'

export const ensureRelative = (value: string) => {
  if (path.isAbsolute(value)) {
    throw new Error('sourceRoot must be a relative path')
  }
  return value.replace(/\\/g, '/')
}

export const buildNewDistrictConfig = (options: NewDistrictOptions) => {
  const root = ensureRelative(options.sourceRoot)
  return {
    districtId: options.districtId,
    districtName: options.districtName,
    inputs: {
      districtBounds: `${root}/district_bounds.shp`,
      redYellow: `${root}/red_yellow.shp`,
      busStops: `${root}/bus_stops.shp`,
      hydrants: `${root}/hydrants.shp`,
      road_centerlines: `${root}/road_centerlines.shp`,
      crosswalks: `${root}/crosswalks.shp`,
      sign_overrides: `${root}/sign_overrides.geojson`,
    },
    outputs: {
      generatedDir: `data/generated/${options.districtId}`,
      publicDir: `public/data/generated/${options.districtId}`,
    },
    crs: {
      default: 'EPSG:3826',
    },
    intersections: {
      snapToleranceMeters: 10,
      angleDiversityDegrees: 25,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    crosswalks: {
      bufferMeters: 6,
    },
    signOverrides: {
      matchToleranceMeters: 15,
    },
    inferredCandidates: {
      offsetMeters: 3.5,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    ops: {
      thresholds: {
        counts: {
          segments: 20,
          intersections: 20,
          inferredCandidates: 30,
          signOverrides: 30,
        },
        tierDistributionMaxDeltaPct: 15,
        perfRegressionMaxDeltaPct: 30,
        maxReasonCodeDeltaPct: 20,
        maxNewReasonCodePct: 5,
      },
      retention: {
        maxBackupsPerDistrict: 5,
        maxBackupAgeDays: 30,
      },
    },
  }
}
