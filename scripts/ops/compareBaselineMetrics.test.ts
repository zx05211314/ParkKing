import { describe, expect, it } from 'vitest'
import { compareCounts } from './compareBaselineCountMetrics'
import { compareDistributions } from './compareBaselineDistributionMetrics'
import { comparePerformance } from './compareBaselinePerformanceMetrics'

describe('compareBaselineMetrics', () => {
  it('flags count deltas beyond thresholds', () => {
    const warnings = compareCounts(
      {
        segments: 140,
        intersections: 50,
        inferredCandidates: 20,
        signOverrides: 10,
        signOverrideUnmatchedNamedCount: 2,
      },
      {
        segments: 100,
        intersections: 50,
        inferredCandidates: 20,
        signOverrides: 10,
        signOverrideUnmatchedNamedCount: 0,
      },
      {
        segments: 20,
        intersections: 20,
        inferredCandidates: 20,
        signOverrides: 20,
      },
    )
    expect(warnings.map((warning) => warning.code)).toEqual([
      'COUNT_DELTA',
      'COUNT_DELTA',
    ])
    expect(warnings.map((warning) => warning.metric?.label)).toEqual([
      'segments',
      'signOverrideUnmatchedNamedCount',
    ])
  })

  it('flags the worst tier distribution delta beyond the threshold', () => {
    expect(
      compareDistributions(
        { 'YELLOW|TEMP_STOP': 20 },
        { 'YELLOW|TEMP_STOP': 10 },
        30,
        'day',
      ).map((warning) => warning.code),
    ).toEqual(['TIER_DELTA'])
  })

  it('flags performance regressions beyond the threshold', () => {
    expect(
      comparePerformance(
        {
          day: { evalFirstMs: 160, evalSecondMs: 110 },
          night: { evalFirstMs: 120, evalSecondMs: 118 },
        },
        {
          day: { evalFirstMsMedian: 100, evalSecondMsMedian: 100 },
          night: { evalFirstMsMedian: 120, evalSecondMsMedian: 120 },
        },
        30,
      ),
    ).toEqual([])
  })

  it('does not flag faster current performance as a regression', () => {
    expect(
      comparePerformance(
        {
          day: { evalFirstMs: 248 },
          night: { evalFirstMs: 200 },
        },
        {
          day: { evalFirstMsMedian: 369 },
          night: { evalFirstMsMedian: 200 },
        },
        30,
      ),
    ).toEqual([])
  })
})
