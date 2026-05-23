import type { Severity } from './compareBaselineTypes'

export const deltaPct = (current: number, baseline: number) => {
  if (baseline === 0) {
    return current === 0 ? 0 : 100
  }
  return Math.abs(((current - baseline) / baseline) * 100)
}

export const severityForDelta = (
  delta: number,
  warnThreshold: number,
): Severity => {
  if (delta > warnThreshold * 2) {
    return 'FAIL'
  }
  if (delta > warnThreshold) {
    return 'WARN'
  }
  return 'INFO'
}

export const computeReasonCodePct = (counts: Record<string, number>, total: number) => {
  const pct: Record<string, number> = {}
  const safeTotal = total > 0 ? total : 1
  Object.entries(counts).forEach(([code, count]) => {
    pct[code] = (count / safeTotal) * 100
  })
  return pct
}
