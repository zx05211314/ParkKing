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
        signOverrideUnmatchedNamedCount: 0,
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
    expect(warnings[1]).toMatchObject({
      severity: 'FAIL',
      threshold: { maximum: 0 },
    })
  })

  it('enforces unmatched named overrides as an absolute limit', () => {
    const warnings = compareCounts(
      {
        segments: 100,
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
        signOverrideUnmatchedNamedCount: 2,
      },
      {
        segments: 20,
        intersections: 20,
        inferredCandidates: 20,
        signOverrides: 20,
        signOverrideUnmatchedNamedCount: 0,
      },
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('exceeds maximum 0')
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

  it('keeps cross-host wall-clock regressions visible without hard-failing publish', () => {
    expect(
      comparePerformance(
        {
          day: { evalFirstMs: 160, evalSecondMs: 452 },
          night: { evalFirstMs: 120, evalSecondMs: 332 },
        },
        {
          day: { evalFirstMsMedian: 100, evalSecondMsMedian: 236 },
          night: { evalFirstMsMedian: 120, evalSecondMsMedian: 250 },
        },
        30,
      ),
    ).toEqual([
      {
        severity: 'WARN',
        code: 'PERF_REGRESSION',
        message:
          'day eval time delta 91.5% exceeds 30%; cross-host wall-clock drift is warning-only',
        metric: {
          label: 'day',
          baseline: 236,
          current: 452,
          deltaPct: 91.52542372881356,
        },
        threshold: {
          warn: 30,
          policy: 'warning-only-cross-host-wall-clock',
        },
      },
      {
        severity: 'WARN',
        code: 'PERF_REGRESSION',
        message:
          'night eval time delta 32.8% exceeds 30%; cross-host wall-clock drift is warning-only',
        metric: {
          label: 'night',
          baseline: 250,
          current: 332,
          deltaPct: 32.800000000000004,
        },
        threshold: {
          warn: 30,
          policy: 'warning-only-cross-host-wall-clock',
        },
      },
    ])
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
