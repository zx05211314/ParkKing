import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from 'geojson'
import { fileURLToPath } from 'node:url'
import type { ResolvedConfig } from './readConfig'
import { readConfig } from './readConfig'
import { PACK_FILES, PACK_FILE_LIST } from './hashFiles'
import { getBoundaryFileName } from './utils'

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const readGeoJson = async (filePath: string, label: string) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as FeatureCollection
  } catch {
    throw new Error(`[${label}] missing or unreadable at ${filePath}`)
  }
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const bboxFromGeometry = (geometry: Geometry): BBox => {
  const coords: [number, number][] = []
  collectCoords(geometry.coordinates, coords)

  if (coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const bboxIntersects = (a: BBox, b: BBox) => {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

const assertCoordRanges = (
  geometry: Geometry,
  dataset: string,
  featureIndex: number,
  errors: string[],
) => {
  const coords: [number, number][] = []
  collectCoords(geometry.coordinates, coords)

  coords.forEach((coord) => {
    const [lon, lat] = coord
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      errors.push(
        `[${dataset}] feature ${featureIndex + 1}: non-finite coordinate ${coord}`,
      )
      return
    }
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      errors.push(
        `[${dataset}] feature ${featureIndex + 1}: coordinate out of WGS84 range (${lon}, ${lat}). Check CRS in ingest.config.json`,
      )
    }
  })
}

const validateGeometryTypes = (
  feature: Feature,
  allowed: string[],
  dataset: string,
  index: number,
  errors: string[],
) => {
  if (!feature.geometry) {
    errors.push(`[${dataset}] feature ${index + 1}: missing geometry`)
    return
  }
  if (!allowed.includes(feature.geometry.type)) {
    errors.push(
      `[${dataset}] feature ${index + 1}: expected ${allowed.join(
        ', ',
      )}, got ${feature.geometry.type}`,
    )
  }
}

const validateCollection = (
  collection: FeatureCollection,
  dataset: string,
  allowedTypes: string[],
  boundaryBBox: BBox,
  minCount: number,
  errors: string[],
) => {
  if (collection.features.length === 0) {
    if (minCount > 0) {
      errors.push(`[${dataset}] contains 0 features. Check filtering or input.`)
    }
    return
  }

  if (collection.features.length < minCount) {
    errors.push(
      `[${dataset}] has ${collection.features.length} features, below minimum ${minCount}.`,
    )
  }

  let outOfBounds = 0

  collection.features.forEach((feature, index) => {
    validateGeometryTypes(feature, allowedTypes, dataset, index, errors)
    if (!feature.geometry) {
      return
    }
    assertCoordRanges(feature.geometry, dataset, index, errors)
    const featureBBox = bboxFromGeometry(feature.geometry)
    if (!bboxIntersects(featureBBox, boundaryBBox)) {
      outOfBounds += 1
    }
  })

  if (outOfBounds > 0) {
    errors.push(
      `[${dataset}] ${outOfBounds} feature(s) fall outside district boundary bbox. Check boundary clip step.`,
    )
  }
}

const validateMeta = (meta: Record<string, unknown>, errors: string[]) => {
  const required = [
    'schemaVersion',
    'metricsSchemaVersion',
    'districtId',
    'districtName',
    'generatedAt',
    'configPath',
    'configHash',
    'datasetHash',
    'sourceFiles',
  ]
  required.forEach((key) => {
    if (!meta[key]) {
      errors.push(`[dataset_meta] missing required field: ${key}`)
    }
  })

  if (
    typeof meta.counts !== 'object' ||
    meta.counts === null ||
    typeof (meta.counts as Record<string, unknown>).intersections !== 'number'
  ) {
    errors.push('[dataset_meta] counts.intersections is required')
  }

  if (
    typeof meta.counts !== 'object' ||
    meta.counts === null ||
    typeof (meta.counts as Record<string, unknown>).crosswalks !== 'number'
  ) {
    errors.push('[dataset_meta] counts.crosswalks is required')
  }

  if (
    typeof meta.counts !== 'object' ||
    meta.counts === null ||
    typeof (meta.counts as Record<string, unknown>).signOverrides !== 'number'
  ) {
    errors.push('[dataset_meta] counts.signOverrides is required')
  }

  if (
    typeof meta.counts !== 'object' ||
    meta.counts === null ||
    typeof (meta.counts as Record<string, unknown>).inferredCandidates !== 'number'
  ) {
    errors.push('[dataset_meta] counts.inferredCandidates is required')
  }

  if (
    typeof meta.counts !== 'object' ||
    meta.counts === null ||
    typeof (meta.counts as Record<string, unknown>).overridesApplied !== 'number'
  ) {
    errors.push('[dataset_meta] counts.overridesApplied is required')
  }

  if (typeof meta.segmentsCount !== 'number') {
    errors.push('[dataset_meta] segmentsCount is required')
  }
  if (typeof meta.signOverridesCount !== 'number') {
    errors.push('[dataset_meta] signOverridesCount is required')
  }
  if (typeof meta.overridesAppliedCount !== 'number') {
    errors.push('[dataset_meta] overridesAppliedCount is required')
  }
  if (typeof meta.curbMarkingKnownRate !== 'number') {
    errors.push('[dataset_meta] curbMarkingKnownRate is required')
  } else if (meta.curbMarkingKnownRate < 0 || meta.curbMarkingKnownRate > 1) {
    errors.push('[dataset_meta] curbMarkingKnownRate must be between 0 and 1')
  }
  if (typeof meta.restrictionTriggeredRate !== 'number') {
    errors.push('[dataset_meta] restrictionTriggeredRate is required')
  } else if (
    meta.restrictionTriggeredRate < 0 ||
    meta.restrictionTriggeredRate > 1
  ) {
    errors.push('[dataset_meta] restrictionTriggeredRate must be between 0 and 1')
  }

  if (!meta.intersectionsBBox) {
    errors.push('[dataset_meta] intersectionsBBox is required')
  }

  if (!meta.boundaryBBox) {
    errors.push('[dataset_meta] boundaryBBox is required')
  }

  if (!meta.boundaryCenter) {
    errors.push('[dataset_meta] boundaryCenter is required')
  }

  if (!('signOverridesBBox' in meta)) {
    errors.push('[dataset_meta] signOverridesBBox is required')
  }

  if (!('inferredRiskCounts' in meta)) {
    errors.push('[dataset_meta] inferredRiskCounts is required')
  }

  if (typeof meta.files !== 'object' || meta.files === null) {
    errors.push('[dataset_meta] files map is required')
  }
  if (typeof meta.totalBytes !== 'number') {
    errors.push('[dataset_meta] totalBytes is required')
  }

  if (Array.isArray(meta.sourceFiles)) {
    meta.sourceFiles.forEach((file, index) => {
      if (!file.path || !file.mtimeMs) {
        errors.push(`[dataset_meta] sourceFiles[${index}] missing path/mtimeMs`)
      }
    })
  } else {
    errors.push('[dataset_meta] sourceFiles must be an array')
  }
}

export const validateOutputs = async (config: ResolvedConfig) => {
  const errors: string[] = []
  const baseDir = config.outputs.generatedDir

  const boundaryFile = getBoundaryFileName(config.districtId)
  const boundaryPath = path.resolve(baseDir, boundaryFile)
  const redYellowPath = path.resolve(baseDir, 'red_yellow.geojson')
  const busStopsPath = path.resolve(baseDir, 'bus_stops.geojson')
  const hydrantsPath = path.resolve(baseDir, 'hydrants.geojson')
  const intersectionsPath = path.resolve(baseDir, 'intersections.geojson')
  const crosswalksPath = path.resolve(baseDir, 'crosswalks.geojson')
  const signOverridesPath = path.resolve(baseDir, 'sign_overrides.geojson')
  const overridesAppliedPath = path.resolve(baseDir, 'overrides_applied.geojson')
  const inferredCandidatesPath = path.resolve(baseDir, 'candidates_inferred.geojson')
  const intersectionsReportPath = path.resolve(baseDir, 'intersections_report.json')
  const metaPath = path.resolve(baseDir, 'dataset_meta.json')

  const boundary = await readGeoJson(boundaryPath, boundaryFile)
  if (boundary.features.length < config.validation.minCounts.districtBounds) {
    errors.push(
      `[${boundaryFile}] has ${boundary.features.length} feature(s), below minimum ${config.validation.minCounts.districtBounds}.`,
    )
  }

  const boundaryFeature = boundary.features[0] as Feature<Polygon | MultiPolygon>
  if (!boundaryFeature || !boundaryFeature.geometry) {
    errors.push(`[${boundaryFile}] missing boundary polygon feature`)
  }

  if (boundaryFeature?.geometry) {
    if (!['Polygon', 'MultiPolygon'].includes(boundaryFeature.geometry.type)) {
      errors.push(`[${boundaryFile}] boundary geometry must be Polygon or MultiPolygon`)
    }
    assertCoordRanges(boundaryFeature.geometry, boundaryFile, 0, errors)
  }

  const boundaryBBox = boundaryFeature?.geometry
    ? bboxFromGeometry(boundaryFeature.geometry)
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  const redYellow = await readGeoJson(redYellowPath, 'red_yellow')
  validateCollection(
    redYellow,
    'red_yellow',
    ['LineString', 'MultiLineString'],
    boundaryBBox,
    config.validation.minCounts.redYellow,
    errors,
  )

  const busStops = await readGeoJson(busStopsPath, 'bus_stops')
  validateCollection(
    busStops,
    'bus_stops',
    ['Point'],
    boundaryBBox,
    config.validation.minCounts.busStops,
    errors,
  )

  const hydrants = await readGeoJson(hydrantsPath, 'hydrants')
  validateCollection(
    hydrants,
    'hydrants',
    ['Point'],
    boundaryBBox,
    config.validation.minCounts.hydrants,
    errors,
  )

  const intersections = await readGeoJson(intersectionsPath, 'intersections')
  validateCollection(
    intersections,
    'intersections',
    ['Point', 'MultiPoint'],
    boundaryBBox,
    config.validation.minCounts.intersections,
    errors,
  )

  const crosswalks = await readGeoJson(crosswalksPath, 'crosswalks')
  validateCollection(
    crosswalks,
    'crosswalks',
    ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
    boundaryBBox,
    config.validation.minCounts.crosswalks,
    errors,
  )

  const signOverrides = await readGeoJson(signOverridesPath, 'sign_overrides')
  validateCollection(
    signOverrides,
    'sign_overrides',
    ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
    boundaryBBox,
    config.validation.minCounts.signOverrides,
    errors,
  )

  const overridesApplied = await readGeoJson(
    overridesAppliedPath,
    'overrides_applied',
  )
  validateCollection(
    overridesApplied,
    'overrides_applied',
    ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
    boundaryBBox,
    0,
    errors,
  )

  const inferredCandidates = await readGeoJson(
    inferredCandidatesPath,
    'candidates_inferred',
  )
  validateCollection(
    inferredCandidates,
    'candidates_inferred',
    ['LineString', 'MultiLineString'],
    boundaryBBox,
    config.validation.minCounts.inferredCandidates,
    errors,
  )

  let meta: Record<string, unknown> | null = null
  try {
    const metaRaw = await fs.readFile(metaPath, 'utf-8')
    meta = JSON.parse(metaRaw) as Record<string, unknown>
    validateMeta(meta, errors)
  } catch {
    errors.push(`[dataset_meta] missing or unreadable at ${metaPath}`)
  }

  if (meta && typeof meta.files === 'object' && meta.files !== null) {
    const filesMap = meta.files as Record<string, { sha256?: string; bytes?: number }>

    PACK_FILE_LIST.forEach((fileName) => {
      if (!filesMap[fileName]) {
        errors.push(`[dataset_meta] files missing entry for ${fileName}`)
      }
    })

    for (const [fileName, entry] of Object.entries(filesMap)) {
      const filePath = path.resolve(baseDir, fileName)
      try {
        const stat = await fs.stat(filePath)
        if (PACK_FILES.required.includes(fileName) && stat.size <= 0) {
          errors.push(`[${fileName}] expected non-empty file`)
        }
        if (typeof entry?.bytes !== 'number') {
          errors.push(`[dataset_meta] files.${fileName}.bytes missing`)
        } else if (entry.bytes <= 0 && PACK_FILES.required.includes(fileName)) {
          errors.push(`[dataset_meta] files.${fileName}.bytes must be > 0`)
        }
        if (typeof entry?.sha256 !== 'string' || entry.sha256.length === 0) {
          errors.push(`[dataset_meta] files.${fileName}.sha256 missing`)
        }
      } catch {
        errors.push(`[dataset_meta] files lists ${fileName} but it is missing on disk`)
      }
    }
  }

  let reportExists = true
  let report: Record<string, unknown> | null = null
  try {
    const reportRaw = await fs.readFile(intersectionsReportPath, 'utf-8')
    report = JSON.parse(reportRaw) as Record<string, unknown>
  } catch {
    reportExists = false
  }

  if (!reportExists) {
    const hasEmbedded = Boolean(
      meta && (meta as Record<string, unknown>).intersectionsReport,
    )
    if (!hasEmbedded) {
      errors.push(`[intersections_report] missing at ${intersectionsReportPath}`)
    }
  } else if (report) {
    const counts = report.counts as Record<string, unknown> | undefined
    if (!counts || typeof counts.finalIntersections !== 'number') {
      errors.push('[intersections_report] counts.finalIntersections is required')
    }
    if (!report.angleSpreadHistogram) {
      errors.push('[intersections_report] angleSpreadHistogram is required')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.join('\n')}`)
  }

  console.log('Validation succeeded.')
}

const run = async () => {
  const config = await readConfig()
  await validateOutputs(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
