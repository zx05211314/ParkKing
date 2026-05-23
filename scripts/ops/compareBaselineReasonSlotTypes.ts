import type {
  BaselineMetrics,
  CurrentMetrics,
  OpsThresholds,
} from './compareBaselineTypes'

export interface CompareReasonCodeSlotParams {
  slot: 'day' | 'night'
  currentSlot: CurrentMetrics['reasonCodes']['day']
  baselineSlot: BaselineMetrics['reasonCodes']['day']
  thresholds: OpsThresholds
}
