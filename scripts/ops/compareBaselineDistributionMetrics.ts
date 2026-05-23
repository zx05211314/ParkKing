import { deltaPct, severityForDelta } from './compareBaselineShared'
import type { Warning } from './compareBaselineTypes'

export const compareDistributions = (
  current: Record<string, number>,
  baseline: Record<string, number>,
  maxDeltaPct: number,
  label: string,
): Warning[] => {
  const warnings: Warning[] = []
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)])

  let worst: { key: string; delta: number; baseline: number; current: number } | null =
    null

  keys.forEach((key) => {
    const baselineValue = baseline[key] ?? 0
    const currentValue = current[key] ?? 0
    const delta = deltaPct(currentValue, baselineValue)
    if (!worst || delta > worst.delta) {
      worst = { key, delta, baseline: baselineValue, current: currentValue }
    }
  })

  if (worst && worst.delta > maxDeltaPct) {
    const severity = severityForDelta(worst.delta, maxDeltaPct)
    warnings.push({
      severity,
      code: 'TIER_DELTA',
      message: `${label} tier distribution delta ${worst.delta.toFixed(
        1,
      )}% exceeds ${maxDeltaPct}% (${worst.key})`,
      metric: {
        label,
        key: worst.key,
        baseline: worst.baseline,
        current: worst.current,
        deltaPct: worst.delta,
      },
      threshold: { warn: maxDeltaPct, fail: maxDeltaPct * 2 },
    })
  }

  return warnings
}
