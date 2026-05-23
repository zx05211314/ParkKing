import { access, readFile } from 'node:fs/promises'
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

const isValidRequiredDatasetFile = (fileName: string, parsed: unknown) => {
  if (fileName === 'dataset_meta.json') {
    return isRecord(parsed)
  }
  return (
    isRecord(parsed) &&
    parsed.type === 'FeatureCollection' &&
    Array.isArray(parsed.features)
  )
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
      const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as unknown
      if (!isValidRequiredDatasetFile(fileName, parsed)) {
        invalid.push(fileName)
      }
    } catch {
      invalid.push(fileName)
    }
  }
  return { missing, invalid }
}

export const buildParkingAnswerServiceDistrictReadiness = async (
  config: ParkingAnswerServiceConfig,
): Promise<ParkingAnswerServiceDistrictReadiness[]> =>
  await Promise.all(
    getReadinessDistricts(config).map(async (district) => {
      const datasetDir = resolve(config.districtDatasetRoot, district)
      const { missing, invalid } = await inspectRequiredFiles(datasetDir)
      return {
        district,
        datasetDir,
        ready: missing.length === 0 && invalid.length === 0,
        missingFiles: missing,
        invalidFiles: invalid,
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
