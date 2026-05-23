import { describe, expect, it } from 'vitest'
import { buildBaselineBenchmarkSections } from './generateBaselineRecordBenchmarks'

describe('generateBaselineRecordBenchmarks', () => {
  it('builds distributions, performance, and reason-code sections for both periods', () => {
    const sections = buildBaselineBenchmarkSections({
      day: {
        medianEvalFirstMs: 12,
        medianEvalSecondMs: 4,
        distribution: { RED: 3 },
        reasonCodes: { coveragePct: 100, counts: { RULE_A: 4, RULE_B: 1 } },
        evaluatedCount: 5,
      },
      night: {
        medianEvalFirstMs: 8,
        medianEvalSecondMs: 2,
        distribution: { GREEN: 2 },
        reasonCodes: { coveragePct: 90, counts: { RULE_C: 2 } },
        evaluatedCount: 2,
      },
    })

    expect(sections.distributions).toEqual({
      day: { RED: 3 },
      night: { GREEN: 2 },
    })
    expect(sections.performance.day).toEqual({
      evalFirstMsMedian: 12,
      evalSecondMsMedian: 4,
    })
    expect(sections.reasonCodes.day.top).toEqual({ RULE_A: 4, RULE_B: 1 })
    expect(sections.reasonCodes.night.coveragePct).toBe(90)
  })
})
