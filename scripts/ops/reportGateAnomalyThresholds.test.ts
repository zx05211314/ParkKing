import { describe, expect, it } from 'vitest'
import { buildThresholdDeltaSummary } from './reportGateAnomalyThresholds'

describe('buildThresholdDeltaSummary', () => {
  it('builds sorted issues, deltas, and top offenders', () => {
    const summary = buildThresholdDeltaSummary(
      {
        segmentsCount: { prev: 10, next: 7, delta: -3, deltaPct: -0.3 },
        curbMarkingKnownRate: { prev: 0.9, next: 0.6, delta: -0.3, deltaPct: -0.3333 },
      },
      [
        {
          severity: 'WARN',
          code: 'DIFF_CURB_MARKING_DROP',
          message: 'curbMarkingKnownRate dropped',
          metric: { prev: 0.9, next: 0.6, drop: 0.3 },
          threshold: { maxDrop: 0.1 },
        },
      ],
    )

    expect(summary.issues.map((issue) => issue.code)).toEqual(['DIFF_CURB_MARKING_DROP'])
    expect(summary.deltas.map((entry) => entry.field)).toEqual([
      'segmentsCount',
      'curbMarkingKnownRate',
    ])
    expect(summary.topOffenders.biggestCountDelta?.field).toBe('segmentsCount')
    expect(summary.topOffenders.metricTrigger?.code).toBe('DIFF_CURB_MARKING_DROP')
  })
})
