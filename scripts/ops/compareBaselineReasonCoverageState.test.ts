import { describe, expect, it } from 'vitest'
import { compareReasonCodeCoverageWarnings } from './compareBaselineReasonCoverageState'
import type {
  BaselineMetrics,
  CurrentMetrics,
  OpsThresholds,
} from './compareBaselineTypes'

const thresholds: OpsThresholds = {
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
}

describe('compareBaselineReasonCoverageState', () => {
  it('emits a coverage-drop warning when coverage falls past the threshold', () => {
    const baselineSlot: BaselineMetrics['reasonCodes']['day'] = {
      top: { RULE_RED_NO_STOP: 10 },
      other: 0,
      total: 20,
      coveragePct: 100,
    }
    const currentSlot: CurrentMetrics['reasonCodes']['day'] = {
      counts: { RULE_RED_NO_STOP: 30 },
      total: 40,
      coveragePct: 50,
    }

    const warnings = compareReasonCodeCoverageWarnings({
      slot: 'day',
      currentSlot,
      baselineSlot,
      thresholds,
    })

    expect(warnings.map((warning) => warning.code)).toEqual([
      'REASON_CODE_COVERAGE_DROP',
    ])
  })
})
