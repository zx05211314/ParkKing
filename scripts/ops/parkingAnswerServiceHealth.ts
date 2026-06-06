import { access, open, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PARKING_ANSWER_SCHEMA_VERSION } from './parkingAnswerServiceDefaults'
import type {
  ParkingAnswerServiceConfig,
  ParkingAnswerServiceDistrictReadiness,
  ParkingAnswerServiceHealthResponse,
} from './parkingAnswerServiceTypes'

export const REQUIRED_PARKING_ANSWER_DATASET_FILES = [
  'dataset_meta.json',
  'red_yellow.geojson',
  'bus_stops.geojson',
  'hydrants.geojson',
  'parking_spaces.geojson',
  'intersections.geojson',
  'crosswalks.geojson',
  'sign_overrides.geojson',
  'candidates_inferred.geojson',
] as const

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '')

export const joinParkingAnswerServicePath = (
  basePath: string,
  suffix: string,
) => `${trimTrailingSlash(basePath)}/${suffix.replace(/^\/+/g, '')}`

const getReadinessDistricts = (config: ParkingAnswerServiceConfig) =>
  Array.from(new Set([config.defaultDistrict, ...config.allowedDistricts]))
    .map((district) => district.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' ? record[key] : undefined

const getNumber = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : undefined

const isValidDatasetMetadata = (parsed: unknown) => {
  return isRecord(parsed)
}

const isValidGeoJsonEnvelope = async (filePath: string) => {
  const handle = await open(filePath, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size === 0) {
      return false
    }

    // Release manifests validate full file checksums during the build. Runtime
    // readiness only verifies the top-level GeoJSON envelope to avoid parsing
    // tens of megabytes on every platform health check.
    const sampleSize = Math.min(4096, stat.size)
    const prefixBuffer = Buffer.alloc(sampleSize)
    const suffixBuffer = Buffer.alloc(sampleSize)
    const prefixRead = await handle.read(prefixBuffer, 0, sampleSize, 0)
    const suffixRead = await handle.read(
      suffixBuffer,
      0,
      sampleSize,
      Math.max(0, stat.size - sampleSize),
    )
    const prefix = prefixBuffer.toString('utf-8', 0, prefixRead.bytesRead)
    const suffix = suffixBuffer
      .toString('utf-8', 0, suffixRead.bytesRead)
      .trimEnd()

    return (
      /"type"\s*:\s*"FeatureCollection"/.test(prefix) &&
      /"features"\s*:\s*\[/.test(prefix) &&
      suffix.endsWith('}')
    )
  } finally {
    await handle.close()
  }
}

const isValidRequiredDatasetFile = async (
  fileName: string,
  filePath: string,
) => {
  if (fileName === 'dataset_meta.json') {
    return isValidDatasetMetadata(
      JSON.parse(await readFile(filePath, 'utf-8')) as unknown,
    )
  }
  return await isValidGeoJsonEnvelope(filePath)
}

const inspectRequiredFiles = async (datasetDir: string) => {
  const missing: string[] = []
  const invalid: string[] = []
  for (const fileName of REQUIRED_PARKING_ANSWER_DATASET_FILES) {
    const filePath = resolve(datasetDir, fileName)
    try {
      await access(filePath)
    } catch {
      missing.push(fileName)
      continue
    }
    try {
      if (!(await isValidRequiredDatasetFile(fileName, filePath))) {
        invalid.push(fileName)
      }
    } catch {
      invalid.push(fileName)
    }
  }
  return { missing, invalid }
}

const readJsonRecord = async (filePath: string) => {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const readDistrictReadinessMetadata = async (datasetDir: string) => {
  const [meta, latest] = await Promise.all([
    readJsonRecord(resolve(datasetDir, 'dataset_meta.json')),
    readJsonRecord(resolve(datasetDir, 'LATEST.json')),
  ])
  const counts = isRecord(meta?.counts) ? meta.counts : null
  return {
    districtName: meta ? getString(meta, 'districtName') : undefined,
    datasetHash: meta ? getString(meta, 'datasetHash') : undefined,
    publishedAt: meta ? getString(meta, 'publishedAt') : undefined,
    generatedAt: meta ? getString(meta, 'generatedAt') : undefined,
    latestDatasetHash: latest ? getString(latest, 'datasetHash') : undefined,
    latestPublishedAt: latest ? getString(latest, 'publishedAt') : undefined,
    counts: counts
      ? {
          segments: getNumber(counts, 'segments'),
          parkingSpaces: getNumber(counts, 'parkingSpaces'),
          signOverrides: getNumber(counts, 'signOverrides'),
          inferredCandidates: getNumber(counts, 'inferredCandidates'),
        }
      : undefined,
  }
}

export const buildParkingAnswerServiceDistrictReadiness = async (
  config: ParkingAnswerServiceConfig,
): Promise<ParkingAnswerServiceDistrictReadiness[]> =>
  await Promise.all(
    getReadinessDistricts(config).map(async (district) => {
      const datasetDir = resolve(config.districtDatasetRoot, district)
      const { missing, invalid } = await inspectRequiredFiles(datasetDir)
      const metadata = await readDistrictReadinessMetadata(datasetDir)
      return {
        district,
        datasetDir,
        ready: missing.length === 0 && invalid.length === 0,
        missingFiles: missing,
        invalidFiles: invalid,
        ...metadata,
      }
    }),
  )

export const buildParkingAnswerServiceHealth = (
  config: ParkingAnswerServiceConfig,
  districts?: ParkingAnswerServiceDistrictReadiness[],
): ParkingAnswerServiceHealthResponse => {
  const ready =
    districts === undefined || districts.every((district) => district.ready)
  return {
    schemaVersion: PARKING_ANSWER_SCHEMA_VERSION,
    service: 'parking-answer',
    status: ready ? 'ok' : 'degraded',
    answerPath: config.path,
    healthPath: joinParkingAnswerServicePath(config.path, 'health'),
    readinessPath: joinParkingAnswerServicePath(config.path, 'ready'),
    defaultDistrict: config.defaultDistrict,
    allowedDistricts: config.allowedDistricts,
    defaultHhmm: config.defaultHhmm,
    datasetRoot: config.districtDatasetRoot,
    allowDatasetDirParam: config.allowDatasetDirParam,
    districts,
  }
}
