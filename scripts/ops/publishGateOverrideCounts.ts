import type { GateWarning } from './publishGateTypes'

const buildOverrideWarning = (warning: GateWarning): GateWarning => warning

export const validatePublishGateOverrideCount = (params: {
  districtId: string
  overridesCount: number
  counts: Record<string, unknown> | undefined
}) => {
  const { districtId, overridesCount, counts } = params
  const metaOverrideCount =
    typeof counts?.overridesApplied === 'number' ? counts.overridesApplied : null

  if (metaOverrideCount === null || overridesCount === metaOverrideCount) {
    return []
  }

  return [
    buildOverrideWarning({
      severity: 'FAIL',
      code: 'OVERRIDES_COUNT_MISMATCH',
      message: `overrides_applied count ${overridesCount} does not match meta ${metaOverrideCount} (${districtId})`,
    }),
  ]
}
