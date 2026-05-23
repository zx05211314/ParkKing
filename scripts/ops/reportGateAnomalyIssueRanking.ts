import type { DiffIssue } from './diffPackTypes'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'

export const issueSeverityOrder = (severity: string) => {
  if (severity === 'FAIL') {
    return 0
  }
  if (severity === 'WARN') {
    return 1
  }
  return 2
}

export const sortIssues = <T extends { severity: string; code: string }>(issues: T[]) => {
  return [...issues].sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    return a.code.localeCompare(b.code)
  })
}

const metricMagnitude = (metric: Record<string, unknown> | undefined) => {
  if (!metric) {
    return 0
  }
  const candidates = ['drop', 'deltaPct', 'ratio', 'delta']
  for (const key of candidates) {
    const value = Number(metric[key])
    if (Number.isFinite(value)) {
      return Math.abs(value)
    }
  }
  return 0
}

export const selectMetricTrigger = (issues: DiffIssue[]) => {
  if (issues.length === 0) {
    return null
  }
  const ranked = [...issues].sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    const magnitudeDelta = metricMagnitude(b.metric) - metricMagnitude(a.metric)
    if (magnitudeDelta !== 0) {
      return magnitudeDelta
    }
    return a.code.localeCompare(b.code)
  })
  const selected = ranked[0]
  if (!selected) {
    return null
  }
  return {
    severity: selected.severity,
    code: selected.code,
    message: selected.message,
    metric: selected.metric,
    threshold: selected.threshold,
  }
}

export const buildTopCountDelta = (
  deltas: GateAnomalyReport['thresholdDeltas']['deltas'],
) => {
  const countsOnly = deltas.filter((entry) =>
    ['segmentsCount', 'overridesAppliedCount', 'signOverridesCount'].includes(entry.field),
  )
  const ranked = [...countsOnly].sort((a, b) => {
    const absA = Math.abs(a.delta ?? 0)
    const absB = Math.abs(b.delta ?? 0)
    if (absA !== absB) {
      return absB - absA
    }
    return a.field.localeCompare(b.field)
  })
  const top = ranked[0]
  if (!top || top.delta === null) {
    return null
  }
  return top
}
