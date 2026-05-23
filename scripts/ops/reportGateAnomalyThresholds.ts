import { boundaryAnomalies } from './reportGateBoundaryAnomalies'
import {
  buildTopCountDelta,
  pickDelta,
  selectMetricTrigger,
  sortIssues,
} from './reportGateAnomalyIssues'
import { DELTA_FIELDS } from './reportGateAnomalyConstants'
import type { GateAnomalyReport, ThresholdDeltaEntry } from './reportGateAnomalyTypes'

export const buildThresholdDeltaSummary = (
  rawMeta: Record<string, Record<string, unknown> | undefined>,
  rawIssues: Array<{
    severity: string
    code: string
    message: string
    metric?: Record<string, unknown>
    threshold?: Record<string, unknown>
  }>,
) => {
  const issues: GateAnomalyReport['thresholdDeltas']['issues'] = sortIssues(rawIssues).map(
    (issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      metric: issue.metric,
      threshold: issue.threshold,
    }),
  )

  const deltas: ThresholdDeltaEntry[] = []
  DELTA_FIELDS.forEach(({ field, layer }) => {
    const delta = pickDelta(rawMeta[field])
    if (!delta) {
      return
    }
    deltas.push({
      field,
      layer,
      prev: delta.prev,
      next: delta.next,
      delta: delta.delta,
      deltaPct: delta.deltaPct,
    })
  })

  return {
    issues,
    deltas,
    topOffenders: {
      biggestCountDelta: buildTopCountDelta(deltas),
      metricTrigger: selectMetricTrigger(rawIssues),
    } satisfies GateAnomalyReport['topOffenders'],
  }
}

export const buildBoundaryCenterAnomalySummary = (
  meta: Record<string, unknown>,
  districtDiff: unknown,
) => boundaryAnomalies(meta, districtDiff)
