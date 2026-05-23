import type { PublishGateBaselineAdoptState } from './publishGateDecision'
import type { PublishGateRunSummary } from './publishGateRunSummary'

export const buildPublishGateBaselineAdoptSummary = ({
  allowBaselineAdopt,
  baselineAdoptState,
}: {
  allowBaselineAdopt: boolean
  baselineAdoptState: PublishGateBaselineAdoptState
}): PublishGateRunSummary['baselineAdopt'] => ({
  enabled: allowBaselineAdopt,
  applied: baselineAdoptState.applied,
  districtIds: baselineAdoptState.districtIds,
  reason: baselineAdoptState.applied ? 'baseline_adopt' : null,
})
