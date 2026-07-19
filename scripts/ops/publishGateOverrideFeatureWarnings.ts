import type { GateWarning } from './publishGateTypes'
import type { PublishGateOverrideFeatureState } from './publishGateOverrideFeatureState'

export const buildPublishGateOverrideFeatureWarnings = (params: {
  districtId: string
  feature: PublishGateOverrideFeatureState
  segmentIds: Set<string> | null
}) => {
  const { districtId, feature, segmentIds } = params
  const warnings: GateWarning[] = []

  if (!feature.segmentId) {
    warnings.push({
      severity: 'FAIL',
      code: 'OVERRIDES_SEGMENT_MISSING',
      message: `overrides_applied feature ${feature.index + 1} missing segmentId (${districtId})`,
    })
  } else if (
    segmentIds &&
    feature.normalizedSegmentId &&
    !segmentIds.has(feature.normalizedSegmentId)
  ) {
    warnings.push({
      severity: 'FAIL',
      code: 'OVERRIDES_SEGMENT_UNKNOWN',
      message: `overrides_applied segmentId ${feature.segmentId} not found in dataset (${districtId})`,
    })
  }

  if (!feature.hasValidStatus) {
    warnings.push({
      severity: 'FAIL',
      code: 'OVERRIDES_STATUS_INVALID',
      message: `overrides_applied feature ${feature.index + 1} missing valid status (${districtId})`,
    })
  }

  if (feature.schemaRaw === undefined || feature.schemaRaw === null) {
    warnings.push({
      severity: 'FAIL',
      code: 'OVERRIDES_SCHEMA_MISSING',
      message: `overrides_applied feature ${feature.index + 1} missing schemaVersion (${districtId})`,
    })
  } else if (!feature.hasKnownSchemaVersion) {
    warnings.push({
      severity: 'FAIL',
      code: 'OVERRIDES_SCHEMA_UNKNOWN',
      message: `overrides_applied feature ${feature.index + 1} has unknown schemaVersion (${districtId})`,
      metric: { schemaVersion: feature.schemaRaw },
    })
  }

  if (feature.schemaVersion === 2) {
    if (!feature.reviewedSegmentId) {
      warnings.push({
        severity: 'FAIL',
        code: 'OVERRIDES_REVIEW_TARGET_MISSING',
        message: `overrides_applied feature ${feature.index + 1} missing reviewedSegmentId (${districtId})`,
      })
    } else if (
      feature.normalizedSegmentId &&
      feature.normalizedReviewedSegmentId !== feature.normalizedSegmentId
    ) {
      warnings.push({
        severity: 'FAIL',
        code: 'OVERRIDES_REVIEW_TARGET_MISMATCH',
        message: `overrides_applied reviewedSegmentId ${feature.reviewedSegmentId} does not match segmentId ${feature.segmentId} (${districtId})`,
      })
    }
    if (!feature.hasValidReviewedHhmm) {
      warnings.push({
        severity: 'FAIL',
        code: 'OVERRIDES_REVIEW_TIME_INVALID',
        message: `overrides_applied feature ${feature.index + 1} missing valid reviewedHhmm (${districtId})`,
        metric: { reviewedHhmm: feature.reviewedHhmm },
      })
    }
  }

  return warnings
}
