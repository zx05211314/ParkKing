import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_PARKING_ANSWER_ALLOWED_DISTRICTS,
  DEFAULT_PARKING_ANSWER_DATASET_ROOT,
  DEFAULT_PARKING_ANSWER_DISTRICT,
  DEFAULT_PARKING_ANSWER_HHMM,
  DEFAULT_PARKING_ANSWER_PATH,
  DEFAULT_PARKING_ANSWER_PORT,
} from './parkingAnswerServiceDefaults'
import {
  normalizeDistrictId,
  normalizeParkingAnswerText,
  parseParkingAnswerCsv,
  parsePositiveInteger,
} from './parkingAnswerServiceParsing'
import type { ParkingAnswerServiceConfig } from './parkingAnswerServiceTypes'
import { DEFAULT_PARKING_ANSWER_INDEX_ROOT } from './queryParkingAnswer'

export {
  DEFAULT_PARKING_ANSWER_ALLOWED_DISTRICTS,
  DEFAULT_PARKING_ANSWER_DATASET_ROOT,
  DEFAULT_PARKING_ANSWER_DISTRICT,
  DEFAULT_PARKING_ANSWER_HHMM,
  DEFAULT_PARKING_ANSWER_PATH,
  DEFAULT_PARKING_ANSWER_PORT,
} from './parkingAnswerServiceDefaults'
export {
  normalizeDistrictId,
  normalizeParkingAnswerText,
  parseParkingAnswerCsv,
  parsePositiveInteger,
} from './parkingAnswerServiceParsing'

const parseEnabled = (value?: string | null) => {
  const normalized = normalizeParkingAnswerText(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const parseRegistryDistrictIds = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const districts = (payload as { districts?: unknown }).districts
  if (!Array.isArray(districts)) {
    return []
  }

  const districtIds = districts
    .map((district) => {
      const districtId =
        district && typeof district === 'object'
          ? (district as { districtId?: unknown }).districtId
          : null
      return typeof districtId === 'string' ? normalizeDistrictId(districtId) : null
    })
    .filter((districtId): districtId is string => Boolean(districtId))
  return Array.from(new Set(districtIds)).sort((a, b) => a.localeCompare(b))
}

export const discoverParkingAnswerServiceDistricts = (datasetRoot: string) => {
  try {
    return parseRegistryDistrictIds(
      JSON.parse(readFileSync(resolve(datasetRoot, 'registry.json'), 'utf-8')),
    )
  } catch {
    return []
  }
}

export const resolveParkingAnswerServiceConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ParkingAnswerServiceConfig => {
  const allowedDistricts = parseParkingAnswerCsv(
    env.PARKKING_PARKING_ANSWER_DISTRICTS,
  )
  const defaultDistrict =
    normalizeDistrictId(env.PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT) ??
    DEFAULT_PARKING_ANSWER_DISTRICT
  const districtDatasetRoot = resolve(
    cwd,
    env.PARKKING_PARKING_ANSWER_DATASET_ROOT ??
      DEFAULT_PARKING_ANSWER_DATASET_ROOT,
  )
  const discoveredDistricts =
    allowedDistricts.length > 0
      ? []
      : discoverParkingAnswerServiceDistricts(districtDatasetRoot)
  let resolvedAllowedDistricts = DEFAULT_PARKING_ANSWER_ALLOWED_DISTRICTS
  if (allowedDistricts.length > 0) {
    resolvedAllowedDistricts = allowedDistricts
  } else if (discoveredDistricts.length > 0) {
    resolvedAllowedDistricts = discoveredDistricts
  }

  return {
    path:
      normalizeParkingAnswerText(env.PARKKING_PARKING_ANSWER_PATH) ??
      DEFAULT_PARKING_ANSWER_PATH,
    port: parsePositiveInteger(
      env.PARKKING_PARKING_ANSWER_PORT,
      DEFAULT_PARKING_ANSWER_PORT,
    ),
    districtDatasetRoot,
    defaultDistrict,
    allowedDistricts: resolvedAllowedDistricts,
    defaultHhmm:
      normalizeParkingAnswerText(env.PARKKING_PARKING_ANSWER_DEFAULT_HHMM) ??
      DEFAULT_PARKING_ANSWER_HHMM,
    allowDatasetDirParam: parseEnabled(
      env.PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR,
    ),
    preparedIndexRoot: (() => {
      const configured = normalizeParkingAnswerText(
        env.PARKKING_PARKING_ANSWER_INDEX_ROOT,
      )
      if (configured) {
        return resolve(cwd, configured)
      }
      return env.NODE_ENV === 'production'
        ? resolve(cwd, DEFAULT_PARKING_ANSWER_INDEX_ROOT)
        : null
    })(),
  }
}
