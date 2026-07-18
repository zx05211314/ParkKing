import { deltaPct } from './compareBaselineShared'
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
      warnings.push({
        // Baselines are often captured on an operator workstation while
        // release gates run on hosted CI. Without a host fingerprint,
        // wall-clock deltas cannot distinguish code regressions from CPU load.
        severity: 'WARN',
        code: 'PERF_REGRESSION',
        message: `${label} eval time delta ${delta.toFixed(1)}% exceeds ${maxDeltaPctValue}%; cross-host wall-clock drift is warning-only`,
        metric: {
          label,
          baseline: baselineValue,
          current: currentValue,
          deltaPct: delta,
        },
        threshold: {
          warn: maxDeltaPctValue,
          policy: 'warning-only-cross-host-wall-clock',
        },
      })
    }
  })

  return warnings
}
