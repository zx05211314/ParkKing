import { bbox, booleanIntersects, featureCollection } from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
} from 'geojson'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { resolveOverrideReportsPath } from './overrideReportsPath'
import { loadBoundary, readDataset, writeGeoJson } from './utils'
import {
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'
import type { Segment } from '../../src/ui/types'

const pickSignOverrideProperties = (properties: Feature['properties']) => {
  if (!properties) {
    return properties
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /segment|override|note|conf|time|window|verify|source|id/i.test(key),
  )
  if (filtered.length === 0) {
    return properties
  }
  return Object.fromEntries(filtered)
}

type ReportStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

interface OverrideReport {
  schemaVersion?: number
  districtId?: string
  segmentId?: string
  status?: string
  note?: string | null
  createdAt?: string
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const normalizeSegmentId = (value: string) => value.replace(/-part-\d+$/i, '')

type PointCoordinate = [number, number]

type OverrideGeometrySource = 'SEGMENT_GEOMETRY' | 'DISTRICT_CENTER_FALLBACK'

type SegmentOverridePointIndex = Map<string, PointCoordinate>
type SegmentBuilder = (
  feature: Feature<LineString | MultiLineString>,
  index: number,
  meta: null,
) => Segment[]

const centerFromPositions = (positions: PointCoordinate[]): PointCoordinate | null => {
  if (positions.length === 0) {
    return null
  }
  const total = positions.reduce(
    (sum, position) => [sum[0] + position[0], sum[1] + position[1]] as PointCoordinate,
    [0, 0] as PointCoordinate,
  )
  return [total[0] / positions.length, total[1] / positions.length]
}

const centerFromPath = (path: [number, number][]) =>
  centerFromPositions(path.map(([lng, lat]) => [lng, lat] as PointCoordinate))

const readGeneratedSegmentCollection = async (
  config: ResolvedConfig,
  fileName: string,
) => {
  const filePath = path.resolve(config.outputs.generatedDir, fileName)
  if (!(await fileExists(filePath))) {
    return null
  }

  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as FeatureCollection<LineString | MultiLineString>
}

const addSegmentOverridePoints = (
  points: SegmentOverridePointIndex,
  collection: FeatureCollection<LineString | MultiLineString>,
  buildSegments: SegmentBuilder,
) => {
  collection.features.forEach((feature, index) => {
    buildSegments(feature, index, null).forEach((segment) => {
      const center = centerFromPath(segment.path)
      if (center) {
        points.set(segment.id, center)
      }
    })
  })
}

const loadSegmentOverridePoints = async (
  config: ResolvedConfig,
): Promise<SegmentOverridePointIndex> => {
  try {
    const points: SegmentOverridePointIndex = new Map()
    const redYellow = await readGeneratedSegmentCollection(config, 'red_yellow.geojson')
    const inferred = await readGeneratedSegmentCollection(
      config,
      'candidates_inferred.geojson',
    )

    if (redYellow) {
      addSegmentOverridePoints(points, redYellow, buildSegmentsFromFeature)
    }
    if (inferred) {
      addSegmentOverridePoints(points, inferred, buildInferredSegmentsFromFeature)
    }

    return points
  } catch {
    console.warn(
      'Unable to load segment geometry for user overrides; using district center fallback.',
    )
    return new Map()
  }
}

const isReportStatus = (value: string): value is ReportStatus => {
  return value === 'LEGAL' || value === 'ILLEGAL' || value === 'UNCLEAR'
}

const OVERRIDE_SCHEMA_VERSION = 1

const parseSchemaVersion = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : OVERRIDE_SCHEMA_VERSION
}

const buildOverrideNote = (status: ReportStatus, note?: string | null) => {
  const trimmed = note ? note.trim() : ''
  if (trimmed.length > 0) {
    return `User report: ${status} - ${trimmed}`
  }
  return `User report: ${status}`
}

const loadOverrideReports = async (
  config: ResolvedConfig,
  overridePoint: [number, number],
  segmentOverridePoints: SegmentOverridePointIndex,
) => {
  const overridesPath = resolveOverrideReportsPath(config.districtId)
  if (!(await fileExists(overridesPath))) {
    return { features: [], count: 0 }
  }

  const raw = await fs.readFile(overridesPath, 'utf-8')
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const features: Feature[] = []

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as OverrideReport
      const districtId = typeof parsed.districtId === 'string' ? parsed.districtId : null
      if (districtId && districtId !== config.districtId) {
        return
      }
      const segmentId =
        typeof parsed.segmentId === 'string' ? normalizeSegmentId(parsed.segmentId) : null
      const status =
        typeof parsed.status === 'string' ? parsed.status.trim().toUpperCase() : ''
      const userNote = typeof parsed.note === 'string' ? parsed.note.trim() : ''
      const verifiedAt =
        typeof parsed.createdAt === 'string' ? parsed.createdAt.trim() : ''
      if (!segmentId || !isReportStatus(status) || !userNote || !verifiedAt) {
        return
      }
      const schemaVersion = parseSchemaVersion(parsed.schemaVersion)
      const note = buildOverrideNote(status, userNote)
      const segmentPoint = segmentOverridePoints.get(segmentId)
      const coordinates = segmentPoint ?? overridePoint
      const geometrySource: OverrideGeometrySource = segmentPoint
        ? 'SEGMENT_GEOMETRY'
        : 'DISTRICT_CENTER_FALLBACK'

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates },
        properties: {
          segmentId,
          override_note: note,
          override_confidence: 'HIGH',
          override_verified_at: verifiedAt,
          override_status: status,
          override_schema_version: schemaVersion,
          override_source: 'USER',
          override_geometry_source: geometrySource,
        },
      })
    } catch {
      console.warn(`Skipping invalid override entry at line ${index + 1}`)
    }
  })

  return { features, count: features.length }
}

export const ingestSignOverrides = async (config: ResolvedConfig) => {
  const inputPath = config.inputs.sign_overrides
  const boundary = await loadBoundary(config)
  const bounds = bbox(boundary)
  const overridePoint: [number, number] = [
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  ]

  const segmentOverridePoints = await loadSegmentOverridePoints(config)
  const overridePayload = await loadOverrideReports(
    config,
    overridePoint,
    segmentOverridePoints,
  )

  let filteredFeatures: Feature[] = []
  if (inputPath) {
    const collection = await readDataset(inputPath, config.crs.default)
    filteredFeatures = collection.features.filter((feature) => {
      if (!feature.geometry) {
        return false
      }
      return booleanIntersects(boundary, feature as Feature<Geometry>)
    })
  }

  const reduced = filteredFeatures.map((feature) => ({
    ...feature,
    properties: pickSignOverrideProperties(feature.properties ?? null),
  }))

  const merged = [...reduced, ...overridePayload.features]

  await writeGeoJson(
    config,
    'sign_overrides.geojson',
    featureCollection(merged),
  )
  console.log('Generated sign_overrides.geojson')
  await writeGeoJson(
    config,
    'overrides_applied.geojson',
    featureCollection(overridePayload.features),
  )
  console.log('Generated overrides_applied.geojson')
}

const run = async () => {
  const config = await readConfig()
  await ingestSignOverrides(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
