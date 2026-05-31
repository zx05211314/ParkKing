import {
  compareCounts,
  compareDistributions,
  comparePerformance,
} from './compareBaselineMetrics'
import { compareReasonCodes } from './compareBaselineReasons'
import { buildBaselineComparisonPrelude } from './compareBaselineStatus'
import type {
  BaselineMetrics,
  CurrentMetrics,
  OpsThresholds,
  Warning,
} from './compareBaselineTypes'

export type * from './compareBaselineTypes'

export const compareWithBaseline = (
  current: CurrentMetrics,
  baseline: BaselineMetrics | null,
  thresholds: OpsThresholds,
): Warning[] => {
  const warnings = buildBaselineComparisonPrelude(current, baseline)
  if (!baseline) {
    return warnings
  }

  return [
    ...warnings,
    ...compareCounts(current.counts, baseline.counts, thresholds.counts),
    ...compareDistributions(
      current.distributions.day,
      baseline.distributions.day,
      thresholds.tierDistributionMaxDeltaPct,
      'day',
    ),
    ...compareDistributions(
      current.distributions.night,
      baseline.distributions.night,
      thresholds.tierDistributionMaxDeltaPct,
      'night',
    ),
    ...comparePerformance(
      current.performance,
      baseline.performance,
      thresholds.perfRegressionMaxDeltaPct,
    ),
    ...compareReasonCodes(current.reasonCodes, baseline.reasonCodes, thresholds),
  ]
}
