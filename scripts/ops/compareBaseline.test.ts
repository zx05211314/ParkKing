import { describe, expect, it } from 'vitest'
import { compareWithBaseline, type BaselineMetrics, type CurrentMetrics } from './compareBaseline'

describe('compareWithBaseline', () => {
  it('enforces absolute count limits without a baseline', () => {
    const current: CurrentMetrics = {
      datasetHash: 'hash-1',
      schemaVersion: 1,
      counts: {
        segments: 1,
        intersections: 1,
        inferredCandidates: 1,
        signOverrides: 1,
        signOverrideUnmatchedNamedCount: 1,
      },
      distributions: { day: {}, night: {} },
      performance: { day: { evalFirstMs: 1 }, night: { evalFirstMs: 1 } },
      reasonCodes: {
        day: { counts: {}, total: 0, coveragePct: 0 },
        night: { counts: {}, total: 0, coveragePct: 0 },
      },
    }

    const warnings = compareWithBaseline(current, null, {
      counts: {
        segments: 20,
        intersections: 20,
        inferredCandidates: 20,
        signOverrides: 20,
        signOverrideUnmatchedNamedCount: 0,
      },
      tierDistributionMaxDeltaPct: 30,
      perfRegressionMaxDeltaPct: 30,
      maxReasonCodeDeltaPct: 20,
      maxNewReasonCodePct: 5,
    })

    expect(warnings.map((warning) => warning.severity)).toContain('FAIL')
    expect(warnings.map((warning) => warning.metric?.label)).toContain(
      'signOverrideUnmatchedNamedCount',
    )
  })

  it('flags count and perf regressions over thresholds', () => {
    const baseline: BaselineMetrics = {
      baselineCreatedAt: '2026-02-02T00:00:00Z',
      baselineDatasetHash: 'hash-1',
      baselineSchemaVersion: 1,
      counts: {
        segments: 100,
        intersections: 50,
        inferredCandidates: 20,
        signOverrides: 10,
        signOverrideUnmatchedNamedCount: 0,
      },
      distributions: {
        day: { 'YELLOW|TEMP_STOP': 10 },
        night: { 'YELLOW|PARK': 10 },
      },
      performance: {
        day: { evalFirstMsMedian: 100 },
        night: { evalFirstMsMedian: 120 },
      },
      reasonCodes: {
        day: {
          top: { RULE_RED_NO_STOP: 10 },
          other: 0,
          total: 20,
          coveragePct: 100,
        },
        night: {
          top: { RULE_RED_NO_STOP: 8 },
          other: 0,
          total: 20,
          coveragePct: 100,
        },
      },
    }

    const current: CurrentMetrics = {
      datasetHash: 'hash-2',
      schemaVersion: 1,
      counts: {
        segments: 140,
        intersections: 55,
        inferredCandidates: 5,
        signOverrides: 10,
        signOverrideUnmatchedNamedCount: 2,
      },
      distributions: {
        day: { 'YELLOW|TEMP_STOP': 20 },
        night: { 'YELLOW|PARK': 10 },
      },
      performance: {
        day: { evalFirstMs: 160 },
        night: { evalFirstMs: 120 },
      },
      reasonCodes: {
        day: {
          counts: { RULE_RED_NO_STOP: 30, NEW_REASON: 10 },
          total: 40,
          coveragePct: 50,
        },
        night: {
          counts: { RULE_RED_NO_STOP: 8 },
          total: 20,
          coveragePct: 100,
        },
      },
    }

    const warnings = compareWithBaseline(current, baseline, {
      counts: {
        segments: 20,
        intersections: 20,
        inferredCandidates: 20,
        signOverrides: 20,
      },
      tierDistributionMaxDeltaPct: 30,
      perfRegressionMaxDeltaPct: 30,
      maxReasonCodeDeltaPct: 20,
      maxNewReasonCodePct: 5,
    })

    expect(warnings.some((warning) => warning.code === 'COUNT_DELTA')).toBe(true)
    expect(warnings.some((warning) => warning.code === 'PERF_REGRESSION')).toBe(true)
    expect(warnings.some((warning) => warning.code === 'TIER_DELTA')).toBe(true)
  })
})
