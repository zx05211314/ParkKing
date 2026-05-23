import { describe, expect, it } from 'vitest'
import { compareReasonCodeDeltaWarnings } from './compareBaselineReasonDeltaState'
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

describe('compareBaselineReasonDeltaState', () => {
  it('emits delta and new-code warnings for one slot', () => {
    const baselineSlot: BaselineMetrics['reasonCodes']['day'] = {
      top: { RULE_RED_NO_STOP: 10 },
      other: 0,
      total: 20,
      coveragePct: 100,
    }
    const currentSlot: CurrentMetrics['reasonCodes']['day'] = {
      counts: { RULE_RED_NO_STOP: 30, NEW_REASON: 10 },
      total: 40,
      coveragePct: 50,
    }

    const warnings = compareReasonCodeDeltaWarnings({
      slot: 'day',
      currentSlot,
      baselineSlot,
      thresholds,
    })

    expect(warnings.map((warning) => warning.code)).toEqual([
      'REASON_CODE_DELTA',
      'REASON_CODE_NEW',
    ])
  })

  it('does not emit new-code warnings when the baseline rolled up other reasons', () => {
    const baselineSlot: BaselineMetrics['reasonCodes']['day'] = {
      top: { RULE_RED_NO_STOP: 10 },
      other: 5,
      total: 20,
      coveragePct: 100,
    }
    const currentSlot: CurrentMetrics['reasonCodes']['day'] = {
      counts: { RULE_RED_NO_STOP: 10, ZONE_HYDRANT: 8 },
      total: 20,
      coveragePct: 100,
    }

    const warnings = compareReasonCodeDeltaWarnings({
      slot: 'day',
      currentSlot,
      baselineSlot,
      thresholds,
    })

    expect(warnings).toEqual([])
  })
})
