import { describe, expect, it } from 'vitest'
import { buildTopCountDelta, selectMetricTrigger, sortIssues } from './reportGateAnomalyIssues'
import type { DiffIssue } from './diffPackTypes'

describe('reportGateAnomalyIssues', () => {
  it('sorts issues by severity then code and selects the strongest metric trigger', () => {
    const issues = [
      { severity: 'WARN', code: 'B_CODE', message: 'warn b', metric: { drop: 0.2 } },
      { severity: 'FAIL', code: 'A_CODE', message: 'fail a', metric: { drop: 0.1 } },
      { severity: 'WARN', code: 'A_CODE', message: 'warn a', metric: { drop: 0.5 } },
    ] satisfies DiffIssue[]

    expect(sortIssues(issues).map((issue) => issue.code)).toEqual([
      'A_CODE',
      'A_CODE',
      'B_CODE',
    ])
    expect(selectMetricTrigger(issues)?.code).toBe('A_CODE')
    expect(selectMetricTrigger(issues)?.severity).toBe('FAIL')
  })

  it('picks the largest absolute count delta across count fields', () => {
    const top = buildTopCountDelta([
      { field: 'segmentsCount', layer: 'red_yellow.geojson', prev: 10, next: 3, delta: -7, deltaPct: -0.7 },
      { field: 'overridesAppliedCount', layer: 'overrides_applied.geojson', prev: 1, next: 6, delta: 5, deltaPct: 5 },
      { field: 'curbMarkingKnownRate', layer: 'dataset_meta.json', prev: 0.9, next: 0.5, delta: -0.4, deltaPct: -0.44 },
    ])

    expect(top?.field).toBe('segmentsCount')
    expect(top?.delta).toBe(-7)
  })
})
