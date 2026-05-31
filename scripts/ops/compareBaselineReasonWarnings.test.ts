import { describe, expect, it } from 'vitest'
import {
  buildReasonCodeCoverageDropWarning,
  buildReasonCodeDeltaWarning,
  buildReasonCodeNewWarning,
} from './compareBaselineReasonWarnings'
import type { OpsThresholds } from './compareBaselineTypes'

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

describe('compareBaselineReasonWarnings', () => {
  it('builds stable warning payloads for each reason-code warning type', () => {
    expect(
      buildReasonCodeDeltaWarning({
        slot: 'day',
        code: 'RULE_RED_NO_STOP',
        delta: 25,
        baselinePct: 10,
        currentPct: 35,
        thresholds,
        severity: 'WARN',
      }),
    ).toMatchObject({
      code: 'REASON_CODE_DELTA',
      severity: 'WARN',
    })
    expect(
      buildReasonCodeNewWarning({
        slot: 'night',
        code: 'NEW_REASON',
        pct: 12.5,
        thresholds,
        severity: 'FAIL',
      }),
    ).toMatchObject({
      code: 'REASON_CODE_NEW',
      severity: 'FAIL',
    })
    expect(
      buildReasonCodeCoverageDropWarning({
        slot: 'day',
        baselineCoveragePct: 100,
        currentCoveragePct: 60,
        thresholds,
        severity: 'FAIL',
      }),
    ).toMatchObject({
      code: 'REASON_CODE_COVERAGE_DROP',
      severity: 'FAIL',
    })
  })
})
