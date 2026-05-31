import { describe, expect, it } from 'vitest'

import {
  buildBaselineRecord,
} from './generateBaselineMetrics'
import { buildReasonDistribution, median } from './generateBaselineStats'

describe('generateBaselineMetrics', () => {
  it('builds a baseline record from registry, meta, and benchmark results', () => {
    const baseline = buildBaselineRecord({
      entry: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        generatedAt: '2026-03-01T00:00:00Z',
        datasetHash: 'hash-1',
        schemaVersion: 7,
      },
      meta: {
        counts: {
          segments: 10,
          intersections: 4,
          inferredCandidates: 2,
          signOverrides: 1,
        },
        signOverrideUnmatchedNamedCount: 3,
      },
      metaRaw: '{"counts":{"segments":10}}',
      day: {
        medianEvalFirstMs: 11,
        medianEvalSecondMs: 3,
        distribution: { RED: 3 },
        reasonCodes: { coveragePct: 100, counts: { RULE_A: 4, RULE_B: 1 } },
        evaluatedCount: 5,
      },
      night: {
        medianEvalFirstMs: 9,
        medianEvalSecondMs: 2,
        distribution: { GREEN: 2 },
        reasonCodes: { coveragePct: 95, counts: { RULE_C: 2 } },
        evaluatedCount: 2,
      },
    })

    expect(baseline.districtId).toBe('xinyi')
    expect(baseline.counts.segments).toBe(10)
    expect(baseline.counts.signOverrideUnmatchedNamedCount).toBe(3)
    expect(baseline.performance.day.evalFirstMsMedian).toBe(11)
    expect(baseline.reasonCodes.day.top).toEqual({ RULE_A: 4, RULE_B: 1 })
    expect(baseline.reasonCodes.night.coveragePct).toBe(95)
  })

  it('still re-exports stats helpers through the facade', () => {
    expect(median([10, 2, 4, 8])).toBe(6)
    expect(
      buildReasonDistribution(
        { B: 2, A: 5, C: 1, D: 1 },
        9,
        100,
        2,
      ),
    ).toEqual({
      top: { A: 5, B: 2 },
      other: 2,
      total: 9,
      coveragePct: 100,
    })
  })
})
