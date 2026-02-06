import { describe, expect, it } from 'vitest'
import { compareWithBaseline, type BaselineMetrics, type CurrentMetrics } from './compareBaseline'

describe('compareWithBaseline', () => {
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
