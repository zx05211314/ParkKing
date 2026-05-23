import { deltaPct, severityForDelta } from './compareBaselineShared'
import type {
  BaselineMetrics,
  CurrentMetrics,
  Warning,
} from './compareBaselineTypes'

export const comparePerformance = (
  current: CurrentMetrics['performance'],
  baseline: BaselineMetrics['performance'],
  maxDeltaPctValue: number,
): Warning[] => {
  const warnings: Warning[] = []
  const entries: Array<{ label: 'day' | 'night' }> = [{ label: 'day' }, { label: 'night' }]

  entries.forEach(({ label }) => {
    const baselineValue =
      baseline[label].evalSecondMsMedian ?? baseline[label].evalFirstMsMedian
    const currentValue = current[label].evalSecondMs ?? current[label].evalFirstMs
    if (currentValue <= baselineValue) {
      return
    }
    const delta = deltaPct(currentValue, baselineValue)
    if (delta > maxDeltaPctValue) {
      const severity = severityForDelta(delta, maxDeltaPctValue)
      warnings.push({
        severity,
        code: 'PERF_REGRESSION',
        message: `${label} eval time delta ${delta.toFixed(1)}% exceeds ${maxDeltaPctValue}%`,
        metric: {
          label,
          baseline: baselineValue,
          current: currentValue,
          deltaPct: delta,
        },
        threshold: { warn: maxDeltaPctValue, fail: maxDeltaPctValue * 2 },
      })
    }
  })

  return warnings
}
