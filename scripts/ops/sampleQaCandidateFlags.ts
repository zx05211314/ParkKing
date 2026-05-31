import { isInferredSegment } from '../../src/domain/ranking/policy'
import type { EvaluatedSegment } from '../../src/ui/types'

export const toTopReasons = (segment: EvaluatedSegment) => {
  const unique: string[] = []
  segment.reasonCodes.forEach((code) => {
    if (!unique.includes(code)) {
      unique.push(code)
    }
  })
  return unique.slice(0, 3)
}

export const toFlags = (segment: EvaluatedSegment) => {
  const reasonCodes = new Set(segment.reasonCodes)
  const flags: string[] = []

  if (reasonCodes.has('ZONE_HYDRANT')) {
    flags.push('hydrant')
  }
  if (reasonCodes.has('ZONE_BUS_STOP')) {
    flags.push('busStop')
  }
  if (reasonCodes.has('ZONE_INTERSECTION')) {
    flags.push('intersection')
  }
  if (reasonCodes.has('ZONE_CROSSWALK')) {
    flags.push('crosswalk')
  }
  if (reasonCodes.has('OVERRIDE_APPLIED')) {
    flags.push('override')
  }
  if (isInferredSegment(segment)) {
    flags.push('inferred')
  }
  if (reasonCodes.has('COVERAGE_LOW')) {
    flags.push('coverageLow')
  }
  if (reasonCodes.has('COVERAGE_MED')) {
    flags.push('coverageMed')
  }
  if (reasonCodes.has('DATA_FRESHNESS_STALE')) {
    flags.push('staleData')
  }
  if (reasonCodes.has('DATA_FRESHNESS_UNKNOWN')) {
    flags.push('freshnessUnknown')
  }

  const riskTags = [...(segment.riskTags ?? [])].sort((a, b) => a.localeCompare(b))
  riskTags.forEach((tag) => {
    flags.push(`risk:${tag}`)
  })

  return flags
}
