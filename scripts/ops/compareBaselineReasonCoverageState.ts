import { severityForDelta } from './compareBaselineShared'
import { buildReasonCodeCoverageDropWarning } from './compareBaselineReasonWarnings'
import type { Warning } from './compareBaselineTypes'
import type { CompareReasonCodeSlotParams } from './compareBaselineReasonSlotTypes'

export const compareReasonCodeCoverageWarnings = (
  params: CompareReasonCodeSlotParams,
): Warning[] => {
  const coverageDelta = params.baselineSlot.coveragePct - params.currentSlot.coveragePct
  if (coverageDelta <= params.thresholds.maxReasonCodeDeltaPct) {
    return []
  }

  return [
    buildReasonCodeCoverageDropWarning({
      slot: params.slot,
      baselineCoveragePct: params.baselineSlot.coveragePct,
      currentCoveragePct: params.currentSlot.coveragePct,
      thresholds: params.thresholds,
      severity: severityForDelta(
        coverageDelta,
        params.thresholds.maxReasonCodeDeltaPct,
      ),
    }),
  ]
}
