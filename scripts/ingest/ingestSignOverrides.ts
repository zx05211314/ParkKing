import { bbox, booleanIntersects, featureCollection } from '@turf/turf'
import type { Feature, Geometry } from 'geojson'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { loadBoundary, readDataset, writeGeoJson } from './utils'

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
) => {
  const overridesPath = path.resolve(
    process.cwd(),
    'data',
    'overrides',
    `${config.districtId}.jsonl`,
  )
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
      if (!segmentId || !isReportStatus(status)) {
        return
      }
      const schemaVersion = parseSchemaVersion(parsed.schemaVersion)
      const note = buildOverrideNote(status, parsed.note ?? null)
      const verifiedAt =
        typeof parsed.createdAt === 'string' && parsed.createdAt.length > 0
          ? parsed.createdAt
          : undefined

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: overridePoint },
        properties: {
          segmentId,
          override_note: note,
          override_confidence: 'HIGH',
          override_verified_at: verifiedAt,
          override_status: status,
          override_schema_version: schemaVersion,
          override_source: 'USER',
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

  const overridePayload = await loadOverrideReports(config, overridePoint)

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
