import type { GateWarning } from './publishGateTypes'

const buildGateWarning = (warning: GateWarning): GateWarning => warning

export const validatePublishGateCountMetadata = (
  districtId: string,
  meta: Record<string, unknown>,
) => {
  const warnings: GateWarning[] = []
  const counts = meta.counts as Record<string, unknown> | undefined
  const requiredCounts = ['segments', 'busStops', 'hydrants', 'intersections']
  const optionalCounts = [
    'crosswalks',
    'signOverrides',
    'inferredCandidates',
    'overridesApplied',
  ]
  const upperBounds: Record<string, number> = {
    segments: 1_000_000,
    intersections: 1_000_000,
    inferredCandidates: 1_000_000,
    signOverrides: 1_000_000,
    overridesApplied: 100_000,
  }

  if (!counts || typeof counts !== 'object') {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_COUNTS_MISSING',
        message: `counts missing in dataset_meta for ${districtId}`,
      }),
    )
    return { counts: undefined, warnings }
  }

  const allCountKeys = [...requiredCounts, ...optionalCounts]
  allCountKeys.forEach((key) => {
    const value = counts[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'META_COUNTS_INVALID',
          message: `counts.${key} invalid in dataset_meta for ${districtId}`,
        }),
      )
      return
    }
    if (requiredCounts.includes(key) && value <= 0) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'META_COUNTS_EMPTY',
          message: `counts.${key} must be > 0 in dataset_meta for ${districtId}`,
        }),
      )
    }
    const upperBound = upperBounds[key]
    if (upperBound && value > upperBound) {
      warnings.push(
        buildGateWarning({
          severity: 'WARN',
          code: 'META_COUNTS_HIGH',
          message: `counts.${key} exceeds expected range for ${districtId}`,
          metric: { value },
          threshold: { max: upperBound },
        }),
      )
    }
  })

  return { counts, warnings }
}
