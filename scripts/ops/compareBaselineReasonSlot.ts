import { compareReasonCodeCoverageWarnings } from './compareBaselineReasonCoverageState'
import { compareReasonCodeDeltaWarnings } from './compareBaselineReasonDeltaState'
import type { Warning } from './compareBaselineTypes'
import type { CompareReasonCodeSlotParams } from './compareBaselineReasonSlotTypes'

export const compareReasonCodeSlot = (params: {
  slot: CompareReasonCodeSlotParams['slot']
  currentSlot: CompareReasonCodeSlotParams['currentSlot']
  baselineSlot: CompareReasonCodeSlotParams['baselineSlot']
  thresholds: CompareReasonCodeSlotParams['thresholds']
}): Warning[] => {
  return [
    ...compareReasonCodeDeltaWarnings(params),
    ...compareReasonCodeCoverageWarnings(params),
  ]
}
