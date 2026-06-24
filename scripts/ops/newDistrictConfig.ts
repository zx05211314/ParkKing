import * as path from 'node:path'
import type { NewDistrictOptions } from './newDistrictTypes'
import { isAbsoluteCompat } from './pathCompat'

const DEFAULT_OUTPUT_ROOT = 'configs/prod'
const DEFAULT_SOURCE_PRESET = 'raw-district'

export const ensureRelative = (value: string, label = 'sourceRoot') => {
  if (isAbsoluteCompat(value)) {
    throw new Error(`${label} must be a relative path`)
  }
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '')
  if (!normalized || normalized === '.') {
    throw new Error(`${label} must not be empty`)
  }
  return normalized
}

const relativeFromConfigRoot = (configRoot: string, target: string) => {
  const relative = path.posix.relative(configRoot, target)
  return relative.length > 0 ? relative : '.'
}

const buildRawDistrictInputs = (configRoot: string, sourceRoot: string) => ({
  districtBounds: relativeFromConfigRoot(configRoot, `${sourceRoot}/district_bounds.shp`),
  redYellow: relativeFromConfigRoot(configRoot, `${sourceRoot}/red_yellow.shp`),
  busStops: relativeFromConfigRoot(configRoot, `${sourceRoot}/bus_stops.shp`),
  hydrants: relativeFromConfigRoot(configRoot, `${sourceRoot}/hydrants.shp`),
  road_centerlines: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/road_centerlines.shp`,
  ),
  crosswalks: relativeFromConfigRoot(configRoot, `${sourceRoot}/crosswalks.shp`),
  sign_overrides: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/sign_overrides.geojson`,
  ),
})

const buildTaipeiSharedInputs = (configRoot: string, sourceRoot: string) => ({
  districtBounds: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/district_bounds/district_bounds.shp`,
  ),
  redYellow: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/red_yellow/red_yellow.shp`,
  ),
  busStops: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/bus_stops/bus_stops.shp`,
  ),
  hydrants: relativeFromConfigRoot(configRoot, `${sourceRoot}/hydrants.csv`),
  parking_spaces: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/parking_spaces/parking_spaces.shp`,
  ),
  intersections: relativeFromConfigRoot(configRoot, `${sourceRoot}/signals.csv`),
  road_centerlines: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/road_centerlines_gt8m/road_centerlines_gt8m.shp`,
  ),
  crosswalks: relativeFromConfigRoot(
    configRoot,
    `${sourceRoot}/crosswalks/crosswalks.shp`,
  ),
})

const buildBoundary = (options: NewDistrictOptions) => {
  if (!options.boundaryFeatureId && !options.boundaryName) {
    return undefined
  }
  return {
    ...(options.boundaryFeatureId ? { featureId: options.boundaryFeatureId } : {}),
    ...(options.boundaryName ? { name: options.boundaryName } : {}),
  }
}

const buildInputs = (options: NewDistrictOptions, configRoot: string, sourceRoot: string) => {
  const sourcePreset = options.sourcePreset ?? DEFAULT_SOURCE_PRESET
  if (sourcePreset === 'taipei-shared') {
    return buildTaipeiSharedInputs(configRoot, sourceRoot)
  }
  return buildRawDistrictInputs(configRoot, sourceRoot)
}

export const buildNewDistrictConfig = (options: NewDistrictOptions) => {
  const sourceRoot = ensureRelative(options.sourceRoot)
  const outputRoot = ensureRelative(options.outputRoot ?? DEFAULT_OUTPUT_ROOT, 'outputRoot')
  const boundary = buildBoundary(options)
  return {
    districtId: options.districtId,
    districtName: options.districtName,
    ...(boundary ? { boundary } : {}),
    inputs: buildInputs(options, outputRoot, sourceRoot),
    outputs: {
      generatedDir: relativeFromConfigRoot(outputRoot, `data/generated/${options.districtId}`),
      publicDir: relativeFromConfigRoot(
        outputRoot,
        `public/data/generated/${options.districtId}`,
      ),
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
