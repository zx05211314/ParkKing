import * as fs from 'node:fs/promises'
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson'
import type { ResolvedConfig } from './readConfig'
import {
  assertCoordRanges,
  bboxFromGeometry,
  validateCollection,
  type BBox,
} from './validateOutputCollections'
import type { ValidateOutputPaths } from './validateOutputPaths'

export const readGeoJson = async (filePath: string, label: string) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as FeatureCollection
  } catch {
    throw new Error(`[${label}] missing or unreadable at ${filePath}`)
  }
}

export const validateOutputDatasets = async (params: {
  config: ResolvedConfig
  paths: ValidateOutputPaths
  errors: string[]
}): Promise<{ boundaryBBox: BBox }> => {
  const { config, paths, errors } = params
  const boundary = await readGeoJson(paths.boundaryPath, paths.boundaryFile)
  if (boundary.features.length < config.validation.minCounts.districtBounds) {
    errors.push(
      `[${paths.boundaryFile}] has ${boundary.features.length} feature(s), below minimum ${config.validation.minCounts.districtBounds}.`,
    )
  }

  const boundaryFeature = boundary.features[0] as Feature<Polygon | MultiPolygon>
  if (!boundaryFeature || !boundaryFeature.geometry) {
    errors.push(`[${paths.boundaryFile}] missing boundary polygon feature`)
  }

  if (boundaryFeature?.geometry) {
    if (!['Polygon', 'MultiPolygon'].includes(boundaryFeature.geometry.type)) {
      errors.push(
        `[${paths.boundaryFile}] boundary geometry must be Polygon or MultiPolygon`,
      )
    }
    assertCoordRanges(boundaryFeature.geometry, paths.boundaryFile, 0, errors)
  }

  const boundaryBBox = boundaryFeature?.geometry
    ? bboxFromGeometry(boundaryFeature.geometry)
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  const datasets = [
    {
      path: paths.redYellowPath,
      label: 'red_yellow',
      allowedTypes: ['LineString', 'MultiLineString'],
      minCount: config.validation.minCounts.redYellow,
    },
    {
      path: paths.busStopsPath,
      label: 'bus_stops',
      allowedTypes: ['Point'],
      minCount: config.validation.minCounts.busStops,
    },
    {
      path: paths.hydrantsPath,
      label: 'hydrants',
      allowedTypes: ['Point'],
      minCount: config.validation.minCounts.hydrants,
    },
    {
      path: paths.intersectionsPath,
      label: 'intersections',
      allowedTypes: ['Point', 'MultiPoint'],
      minCount: config.validation.minCounts.intersections,
    },
    {
      path: paths.parkingSpacesPath,
      label: 'parking_spaces',
      allowedTypes: [
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ],
      minCount: config.validation.minCounts.parkingSpaces,
    },
    {
      path: paths.crosswalksPath,
      label: 'crosswalks',
      allowedTypes: ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
      minCount: config.validation.minCounts.crosswalks,
    },
    {
      path: paths.signOverridesPath,
      label: 'sign_overrides',
      allowedTypes: [
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ],
      minCount: config.validation.minCounts.signOverrides,
    },
    {
      path: paths.overridesAppliedPath,
      label: 'overrides_applied',
      allowedTypes: [
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ],
      minCount: config.validation.minCounts.overridesApplied,
    },
    {
      path: paths.inferredCandidatesPath,
      label: 'candidates_inferred',
      allowedTypes: ['LineString', 'MultiLineString'],
      minCount: config.validation.minCounts.inferredCandidates,
    },
  ] as const

  for (const dataset of datasets) {
    const collection = await readGeoJson(dataset.path, dataset.label)
    validateCollection(
      collection,
      dataset.label,
      [...dataset.allowedTypes],
      boundaryBBox,
      dataset.minCount,
      errors,
    )
  }

  return { boundaryBBox }
}
