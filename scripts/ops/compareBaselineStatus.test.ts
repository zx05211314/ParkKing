import { describe, expect, it } from 'vitest'
import { buildBaselineComparisonPrelude } from './compareBaselineStatus'
import type { BaselineMetrics, CurrentMetrics } from './compareBaselineTypes'

const current: CurrentMetrics = {
  datasetHash: 'hash-1',
  schemaVersion: 2,
  counts: {
    segments: 1,
    intersections: 1,
    inferredCandidates: 1,
    signOverrides: 1,
    signOverrideUnmatchedNamedCount: 0,
  },
  distributions: {
    day: {},
    night: {},
  },
  performance: {
    day: { evalFirstMs: 0 },
    night: { evalFirstMs: 0 },
  },
  reasonCodes: {
    day: { counts: {}, total: 0, coveragePct: 100 },
    night: { counts: {}, total: 0, coveragePct: 100 },
  },
}

describe('compareBaselineStatus', () => {
  it('returns a missing-baseline warning when no baseline exists', () => {
    expect(buildBaselineComparisonPrelude(current, null)).toEqual([
      {
        severity: 'WARN',
        code: 'BASELINE_MISSING',
        message: 'Baseline missing; generate with npm run ops:baseline',
      },
    ])
  })

  it('adds schema mismatch and hash match warnings for baseline metadata issues', () => {
    const baseline: BaselineMetrics = {
      baselineCreatedAt: '2026-03-01T00:00:00.000Z',
      baselineDatasetHash: 'hash-1',
      baselineSchemaVersion: 1,
      counts: current.counts,
      distributions: {
        day: {},
        night: {},
      },
      performance: {
        day: { evalFirstMsMedian: 0 },
        night: { evalFirstMsMedian: 0 },
      },
      reasonCodes: {
        day: { top: {}, other: 0, total: 0, coveragePct: 100 },
        night: { top: {}, other: 0, total: 0, coveragePct: 100 },
      },
    }

    expect(buildBaselineComparisonPrelude(current, baseline)).toEqual([
      {
        severity: 'WARN',
        code: 'BASELINE_SCHEMA_MISMATCH',
        message: 'Baseline schemaVersion 1 does not match current 2',
      },
      {
        severity: 'INFO',
        code: 'BASELINE_HASH_MATCH',
        message: 'Baseline datasetHash matches current (hash-1).',
      },
    ])
  })
})
