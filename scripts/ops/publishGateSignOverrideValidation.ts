import { buildPublishGateMetricState } from './publishGateMetricState'
import type { GateWarning, PublishGateReportDistrict } from './publishGateTypes'

interface SignOverrideRequirement {
  minSignOverrides: number
  minOverridesApplied: number
  sources: string[]
}

const readPositiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const buildThreshold = (requirement: SignOverrideRequirement) => ({
  minSignOverrides: requirement.minSignOverrides,
  minOverridesApplied: requirement.minOverridesApplied,
  sources: requirement.sources,
})

export const resolvePublishGateSignOverrideRequirement = (
  district: PublishGateReportDistrict,
): SignOverrideRequirement | null => {
  const validationMinimums = district.validation?.minCounts
  const explicitSignOverrides = readPositiveNumber(validationMinimums?.signOverrides)
  const explicitOverridesApplied = readPositiveNumber(
    validationMinimums?.overridesApplied,
  )
  const legacySignOverrideThreshold = readPositiveNumber(
    district.thresholds?.counts?.signOverrides,
  )
  const reportSignOverridesCount = readNumber(district.counts?.signOverrides)

  const minSignOverrides =
    explicitSignOverrides ?? (legacySignOverrideThreshold ? 1 : 0)
  const minOverridesApplied =
    explicitOverridesApplied ??
    (legacySignOverrideThreshold &&
    (reportSignOverridesCount === null || reportSignOverridesCount <= 0)
      ? 1
      : 0)

  if (minSignOverrides <= 0 && minOverridesApplied <= 0) {
    return null
  }

  return {
    minSignOverrides,
    minOverridesApplied,
    sources: [
      ...(explicitSignOverrides ? ['validation.minCounts.signOverrides'] : []),
      ...(explicitOverridesApplied ? ['validation.minCounts.overridesApplied'] : []),
      ...(legacySignOverrideThreshold
        ? ['thresholds.counts.signOverrides']
        : []),
    ],
  }
}

export const validatePublishGateSignOverrideCoverage = (params: {
  districtId: string
  district: PublishGateReportDistrict
  meta: Record<string, unknown>
}): GateWarning[] => {
  const requirement = resolvePublishGateSignOverrideRequirement(params.district)
  if (!requirement) {
    return []
  }

  const metrics = buildPublishGateMetricState(params.meta)
  const warnings: GateWarning[] = []
  const threshold = buildThreshold(requirement)

  if (requirement.minSignOverrides > 0) {
    if (metrics.signOverridesCount === null) {
      warnings.push({
        severity: 'FAIL',
        code: 'SIGN_OVERRIDE_COUNT_MISSING',
        message: `signOverridesCount missing for required sign override district ${params.districtId}`,
        threshold,
      })
    } else if (metrics.signOverridesCount < requirement.minSignOverrides) {
      const hasSourceTimestamp =
        typeof params.meta.signOverridesUpdatedAt === 'string' &&
        params.meta.signOverridesUpdatedAt.trim().length > 0
      warnings.push({
        severity: 'FAIL',
        code: hasSourceTimestamp
          ? 'SIGN_OVERRIDE_COUNT_BELOW_MIN'
          : 'SIGN_OVERRIDE_INPUT_MISSING',
        message: hasSourceTimestamp
          ? `sign overrides count ${metrics.signOverridesCount} is below required minimum ${requirement.minSignOverrides} for ${params.districtId}`
          : `sign override input is missing or empty for required district ${params.districtId}`,
        metric: {
          signOverridesCount: metrics.signOverridesCount,
          signOverridesUpdatedAt: params.meta.signOverridesUpdatedAt ?? null,
        },
        threshold,
      })
    }
  }

  const shouldValidateAppliedCoverage =
    requirement.minOverridesApplied > 0 &&
    (requirement.sources.includes('validation.minCounts.overridesApplied') ||
      metrics.signOverridesCount === null ||
      metrics.signOverridesCount <= 0)

  if (shouldValidateAppliedCoverage) {
    if (metrics.overridesAppliedCount === null) {
      warnings.push({
        severity: 'FAIL',
        code: 'SIGN_OVERRIDE_APPLIED_COUNT_MISSING',
        message: `overridesAppliedCount missing for required sign override district ${params.districtId}`,
        threshold,
      })
    } else if (metrics.overridesAppliedCount < requirement.minOverridesApplied) {
      warnings.push({
        severity: 'FAIL',
        code: 'SIGN_OVERRIDE_COVERAGE_ZERO',
        message: `applied sign override coverage ${metrics.overridesAppliedCount} is below required minimum ${requirement.minOverridesApplied} for ${params.districtId}`,
        metric: {
          overridesAppliedCount: metrics.overridesAppliedCount,
          signOverridesCount: metrics.signOverridesCount,
        },
        threshold,
      })
    }
  }

  return warnings
}
