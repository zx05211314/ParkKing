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

  return {
    path:
      normalizeParkingAnswerText(env.PARKKING_PARKING_ANSWER_PATH) ??
      DEFAULT_PARKING_ANSWER_PATH,
    port: parsePositiveInteger(
      env.PARKKING_PARKING_ANSWER_PORT,
      DEFAULT_PARKING_ANSWER_PORT,
    ),
    districtDatasetRoot: resolve(
      cwd,
      env.PARKKING_PARKING_ANSWER_DATASET_ROOT ??
        DEFAULT_PARKING_ANSWER_DATASET_ROOT,
    ),
    defaultDistrict,
    allowedDistricts:
      allowedDistricts.length > 0
        ? allowedDistricts
        : DEFAULT_PARKING_ANSWER_ALLOWED_DISTRICTS,
    defaultHhmm:
      normalizeParkingAnswerText(env.PARKKING_PARKING_ANSWER_DEFAULT_HHMM) ??
      DEFAULT_PARKING_ANSWER_HHMM,
    allowDatasetDirParam: parseEnabled(
      env.PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR,
    ),
  }
}
