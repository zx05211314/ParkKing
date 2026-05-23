import { resolve } from 'node:path'
import type { RiskMode } from '../../src/domain/ranking/rank'
import {
  DEFAULT_PARKING_ANSWER_DISTRICT,
  DEFAULT_PARKING_ANSWER_HHMM,
} from './parkingAnswerServiceDefaults'
import type {
  ParkingAnswerRequestParseResult,
  ParkingAnswerServiceConfig,
} from './parkingAnswerServiceTypes'

export const normalizeParkingAnswerText = (value?: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const parseParkingAnswerNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const parseParkingAnswerCsv = (value?: string | null) => {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((part) => normalizeDistrictId(part))
    .filter((part): part is string => part !== null)
}

export const parseBooleanFlag = (value: string | null): boolean | undefined => {
  const normalized = normalizeParkingAnswerText(value)?.toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

export const parseRiskMode = (value: string | null): RiskMode | undefined => {
  const normalized = normalizeParkingAnswerText(value)?.toUpperCase()
  if (
    normalized === 'CONSERVATIVE' ||
    normalized === 'NEUTRAL' ||
    normalized === 'AGGRESSIVE'
  ) {
    return normalized
  }
  return undefined
}

export const parseHhmm = (
  value: string | null,
  fallback = DEFAULT_PARKING_ANSWER_HHMM,
) => {
  const normalized = normalizeParkingAnswerText(value) ?? fallback
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : null
}

export const normalizeDistrictId = (
  value?: string | null,
  fallback?: string,
) => {
  const normalized = normalizeParkingAnswerText(value ?? fallback)?.toLowerCase()
  if (!normalized) {
    return null
  }
  return /^[a-z0-9_-]+$/.test(normalized) ? normalized : null
}

export const parseLocation = (url: URL): [number, number] | null => {
  const locationValue = normalizeParkingAnswerText(url.searchParams.get('location'))
  if (locationValue) {
    const [lngRaw, latRaw] = locationValue.split(',', 2)
    const lng = parseParkingAnswerNumber(lngRaw)
    const lat = parseParkingAnswerNumber(latRaw)
    return lng === null || lat === null ? null : [lng, lat]
  }

  const lng =
    parseParkingAnswerNumber(url.searchParams.get('lng')) ??
    parseParkingAnswerNumber(url.searchParams.get('lon'))
  const lat = parseParkingAnswerNumber(url.searchParams.get('lat'))
  return lng === null || lat === null ? null : [lng, lat]
}

const parseOptionalNumber = (url: URL, ...names: string[]) => {
  for (const name of names) {
    if (!url.searchParams.has(name)) {
      continue
    }
    return parseParkingAnswerNumber(url.searchParams.get(name))
  }
  return undefined
}

const hasAllowedDistrict = (
  district: string,
  allowedDistricts: string[],
) => allowedDistricts.length === 0 || allowedDistricts.includes(district)

export const parseParkingAnswerServiceRequest = (
  url: URL,
  config: ParkingAnswerServiceConfig,
): ParkingAnswerRequestParseResult => {
  const datasetDirParam =
    normalizeParkingAnswerText(url.searchParams.get('datasetDir')) ??
    normalizeParkingAnswerText(url.searchParams.get('dataset-dir'))
  const district = datasetDirParam
    ? null
    : normalizeDistrictId(url.searchParams.get('district'), config.defaultDistrict)

  if (datasetDirParam && !config.allowDatasetDirParam) {
    return {
      ok: false,
      statusCode: 400,
      error: 'datasetDir query parameter is disabled for this service.',
    }
  }

  if (!datasetDirParam && !district) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Missing or invalid district.',
    }
  }

  if (district && !hasAllowedDistrict(district, config.allowedDistricts)) {
    return {
      ok: false,
      statusCode: 403,
      error: `District "${district}" is not enabled for parking-answer API.`,
    }
  }

  const location = parseLocation(url)
  if (!location) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Missing or invalid lng/lat coordinates.',
    }
  }

  const hhmm = parseHhmm(url.searchParams.get('hhmm'), config.defaultHhmm)
  if (!hhmm) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Missing or invalid hhmm. Expected HH:MM in 24-hour time.',
    }
  }

  const searchRadiusMeters = parseOptionalNumber(
    url,
    'radius',
    'searchRadiusMeters',
    'search-radius-meters',
  )
  if (searchRadiusMeters === null) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid search radius.',
    }
  }

  const maxAlternatives = parseOptionalNumber(
    url,
    'maxAlternatives',
    'max-alternatives',
  )
  if (maxAlternatives === null) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid maxAlternatives.',
    }
  }

  const riskMode = parseRiskMode(
    url.searchParams.get('riskMode') ?? url.searchParams.get('risk-mode'),
  )
  if (
    (url.searchParams.has('riskMode') || url.searchParams.has('risk-mode')) &&
    !riskMode
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid risk mode.',
    }
  }

  const includeInferred = parseBooleanFlag(
    url.searchParams.get('includeInferred') ??
      url.searchParams.get('include-inferred'),
  )

  const datasetDir = datasetDirParam
    ? resolve(datasetDirParam)
    : resolve(config.districtDatasetRoot, district ?? DEFAULT_PARKING_ANSWER_DISTRICT)

  return {
    ok: true,
    request: {
      district,
      datasetDir,
      lng: location[0],
      lat: location[1],
      hhmm,
      searchRadiusMeters,
      includeInferred,
      riskMode,
      maxAlternatives,
    },
  }
}
