import * as path from 'node:path'
import { fileExists } from './publishGateFiles'
import type { GateWarning } from './publishGateTypes'

export const METRIC_THRESHOLDS = {
  curbMarkingKnownRate: 0.1,
  restrictionTriggeredRate: 0.01,
  overridesRatio: 0.2,
  signOverrideUnmatchedNamedCount: 0,
}

export const OVERRIDE_SCHEMA_VERSIONS = new Set([1])
export const DIFF_SCHEMA_VERSIONS = new Set([1])
export const BOOTSTRAP_OVERRIDE_REASON = 'taipei-real-bootstrap'
export const BOOTSTRAP_MODE_FLAG = 'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'
export const BOOTSTRAP_DENIED_FLAG = 'BOOTSTRAP_DENIED_PREVIOUS_PACK_EXISTS'
export const BASELINE_ADOPT_APPLIED_FLAG = 'BASELINE_ADOPT_APPLIED'
export const BASELINE_ADOPT_ENV = 'PARKKING_ALLOW_BASELINE_ADOPT'

const NON_ADOPTABLE_DIFF_FAIL_CODES = new Set([
  'DIFF_SEGMENTS_ZERO',
  'DIFF_BBOX_COLLAPSE',
])

const ADOPTABLE_BASELINE_FAIL_CODES = new Set([
  'COUNT_DELTA',
  'TIER_DELTA',
  'REASON_CODE_DELTA',
  'REASON_CODE_NEW',
  'REASON_CODE_COVERAGE_DROP',
])

export const isOverrideStatus = (value: string) => {
  return value === 'LEGAL' || value === 'ILLEGAL' || value === 'UNCLEAR'
}

export const parseSchemaVersion = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export const parseDiffSchemaVersion = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export const isBootstrapOverride = (overrideReason: string | null) => {
  return overrideReason?.trim() === BOOTSTRAP_OVERRIDE_REASON
}

export const hasPublishedPack = async (
  publishedRootDir: string | null,
  districtId: string,
) => {
  if (!publishedRootDir || !districtId || districtId === 'unknown') {
    return false
  }
  const metaPath = path.resolve(publishedRootDir, districtId, 'dataset_meta.json')
  return fileExists(metaPath)
}

export const isAdoptableDiffFail = (warning: GateWarning) => {
  if (warning.severity !== 'FAIL') {
    return false
  }
  if (typeof warning.code !== 'string') {
    return false
  }
  if (warning.code.startsWith('DIFF_')) {
    return !NON_ADOPTABLE_DIFF_FAIL_CODES.has(warning.code)
  }
  return ADOPTABLE_BASELINE_FAIL_CODES.has(warning.code)
}
