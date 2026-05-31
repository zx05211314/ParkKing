import { computeReasonCodePct, severityForDelta } from './compareBaselineShared'
import {
  buildReasonCodeDeltaWarning,
  buildReasonCodeNewWarning,
} from './compareBaselineReasonWarnings'
import type { Warning } from './compareBaselineTypes'
import type { CompareReasonCodeSlotParams } from './compareBaselineReasonSlotTypes'

export const compareReasonCodeDeltaWarnings = (
  params: CompareReasonCodeSlotParams,
): Warning[] => {
  const warnings: Warning[] = []
  const currentPct = computeReasonCodePct(
    params.currentSlot.counts,
    params.currentSlot.total,
  )
  const baselinePct = computeReasonCodePct(
    params.baselineSlot.top,
    params.baselineSlot.total,
  )

  Object.entries(params.baselineSlot.top).forEach(([code]) => {
    const basePct = baselinePct[code] ?? 0
    const currentValue = currentPct[code] ?? 0
    const delta = Math.abs(currentValue - basePct)
    if (delta > params.thresholds.maxReasonCodeDeltaPct) {
      warnings.push(
        buildReasonCodeDeltaWarning({
          slot: params.slot,
          code,
          delta,
          baselinePct: basePct,
          currentPct: currentValue,
          thresholds: params.thresholds,
          severity: severityForDelta(delta, params.thresholds.maxReasonCodeDeltaPct),
        }),
      )
    }
  })

  Object.entries(currentPct).forEach(([code, pct]) => {
    const baselineHasRolledUpReasons = params.baselineSlot.other > 0
    if (
      !baselineHasRolledUpReasons &&
      !params.baselineSlot.top[code] &&
      pct > params.thresholds.maxNewReasonCodePct
    ) {
      warnings.push(
        buildReasonCodeNewWarning({
          slot: params.slot,
          code,
          pct,
          thresholds: params.thresholds,
          severity: severityForDelta(pct, params.thresholds.maxNewReasonCodePct),
        }),
      )
    }
  })

  return warnings
}
