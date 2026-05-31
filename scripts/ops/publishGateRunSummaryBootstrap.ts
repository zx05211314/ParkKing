import type { PublishGateBootstrapState } from './publishGateDecision'
import type { PublishGateRunSummary } from './publishGateRunSummary'

export const buildPublishGateBootstrapSummary = (
  bootstrapState: PublishGateBootstrapState,
): PublishGateRunSummary['bootstrap'] => ({
  requested: bootstrapState.requested,
  modeUsed: bootstrapState.modeUsed,
  denied: bootstrapState.denied,
  previousPackExists: bootstrapState.previousPackExists,
})
