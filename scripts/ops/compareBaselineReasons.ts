import { compareReasonCodeSlot } from './compareBaselineReasonSlot'
import type {
  BaselineMetrics,
  CurrentMetrics,
  OpsThresholds,
  Warning,
} from './compareBaselineTypes'

export const compareReasonCodes = (
  current: CurrentMetrics['reasonCodes'],
  baseline: BaselineMetrics['reasonCodes'] | undefined,
  thresholds: OpsThresholds,
): Warning[] => {
  if (!baseline) {
    return []
  }
  return [
    ...compareReasonCodeSlot({
      slot: 'day',
      currentSlot: current.day,
      baselineSlot: baseline.day,
      thresholds,
    }),
    ...compareReasonCodeSlot({
      slot: 'night',
      currentSlot: current.night,
      baselineSlot: baseline.night,
      thresholds,
    }),
  ]
}
