import { deltaPct, severityForDelta } from './compareBaselineShared'
import type {
  BaselineMetrics,
  CurrentMetrics,
  OpsThresholds,
  Warning,
} from './compareBaselineTypes'

export const compareCounts = (
  current: CurrentMetrics['counts'],
  baseline: BaselineMetrics['counts'],
  thresholds: OpsThresholds['counts'],
): Warning[] => {
  const warnings: Warning[] = []

  const entries: Array<{
    key: keyof OpsThresholds['counts']
    label: string
  }> = [
    { key: 'segments', label: 'segments' },
    { key: 'intersections', label: 'intersections' },
    { key: 'inferredCandidates', label: 'inferredCandidates' },
    { key: 'signOverrides', label: 'signOverrides' },
  ]

  entries.forEach(({ key, label }) => {
    const baselineValue = baseline[key]
    const currentValue = current[key]
    const delta = deltaPct(currentValue, baselineValue)
    const threshold = thresholds[key] ?? thresholds.signOverrides
    if (delta > threshold) {
      const severity = severityForDelta(delta, threshold)
      warnings.push({
        severity,
        code: 'COUNT_DELTA',
        message: `${label} delta ${delta.toFixed(1)}% exceeds ${threshold}%`,
        metric: {
          label,
          baseline: baselineValue,
          current: currentValue,
          deltaPct: delta,
        },
        threshold: { warn: threshold, fail: threshold * 2 },
      })
    }
  })

  warnings.push(...compareCountLimits(current, baseline, thresholds))

  return warnings
}

export const compareCountLimits = (
  current: CurrentMetrics['counts'],
  baseline: BaselineMetrics['counts'] | null,
  thresholds: OpsThresholds['counts'],
): Warning[] => {
  const unmatchedLimit = thresholds.signOverrideUnmatchedNamedCount
  const unmatchedCount = current.signOverrideUnmatchedNamedCount
  if (unmatchedLimit !== undefined && unmatchedCount > unmatchedLimit) {
    return [
      {
        severity: 'FAIL',
        code: 'COUNT_DELTA',
        message: `signOverrideUnmatchedNamedCount ${unmatchedCount} exceeds maximum ${unmatchedLimit}`,
        metric: {
          label: 'signOverrideUnmatchedNamedCount',
          baseline: baseline?.signOverrideUnmatchedNamedCount ?? null,
          current: unmatchedCount,
        },
        threshold: { maximum: unmatchedLimit },
      },
    ]
  }

  return []
}
