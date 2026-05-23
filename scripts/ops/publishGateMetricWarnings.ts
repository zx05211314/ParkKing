import { METRIC_THRESHOLDS } from './publishGatePolicy'
import type { GateWarning } from './publishGateTypes'
import type { PublishGateMetricState } from './publishGateMetricState'

export const buildPublishGateMetricWarnings = (params: {
  districtId: string
  metrics: PublishGateMetricState
}) => {
  const warnings: GateWarning[] = []

  if (
    params.metrics.curbMarkingKnownRate !== null &&
    params.metrics.curbMarkingKnownRate < METRIC_THRESHOLDS.curbMarkingKnownRate
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'METRIC_CURB_MARKING_LOW',
      message: `curbMarkingKnownRate below threshold for ${params.districtId}`,
      metric: { value: params.metrics.curbMarkingKnownRate },
      threshold: { min: METRIC_THRESHOLDS.curbMarkingKnownRate },
    })
  }

  if (
    params.metrics.restrictionTriggeredRate !== null &&
    params.metrics.restrictionTriggeredRate <
      METRIC_THRESHOLDS.restrictionTriggeredRate
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'METRIC_RESTRICTION_LOW',
      message: `restrictionTriggeredRate below threshold for ${params.districtId}`,
      metric: { value: params.metrics.restrictionTriggeredRate },
      threshold: { min: METRIC_THRESHOLDS.restrictionTriggeredRate },
    })
  }

  if (
    params.metrics.overridesRatio !== null &&
    params.metrics.overridesRatio > METRIC_THRESHOLDS.overridesRatio
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'METRIC_OVERRIDES_HIGH',
      message: `overridesAppliedCount high relative to segments for ${params.districtId}`,
      metric: {
        ratio: params.metrics.overridesRatio,
        overridesAppliedCount: params.metrics.overridesAppliedCount,
        segmentsCount: params.metrics.segmentsCount,
        signOverridesCount: params.metrics.signOverridesCount,
      },
      threshold: { maxRatio: METRIC_THRESHOLDS.overridesRatio },
    })
  }

  if (
    params.metrics.signOverrideUnmatchedNamedCount !== null &&
    params.metrics.signOverrideUnmatchedNamedCount >
      METRIC_THRESHOLDS.signOverrideUnmatchedNamedCount
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'METRIC_SIGN_OVERRIDE_UNMATCHED',
      message: `named sign overrides did not match current segments for ${params.districtId}`,
      metric: {
        unmatchedNamedCount: params.metrics.signOverrideUnmatchedNamedCount,
        signOverridesCount: params.metrics.signOverridesCount,
      },
      threshold: {
        maxCount: METRIC_THRESHOLDS.signOverrideUnmatchedNamedCount,
      },
    })
  }

  return warnings
}
