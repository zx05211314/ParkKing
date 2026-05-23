import type { OpsThresholds, Warning } from './compareBaselineTypes'

export const buildReasonCodeDeltaWarning = (params: {
  slot: 'day' | 'night'
  code: string
  delta: number
  baselinePct: number
  currentPct: number
  thresholds: OpsThresholds
  severity: Warning['severity']
}): Warning => ({
  severity: params.severity,
  code: 'REASON_CODE_DELTA',
  message: `${params.slot} reason code ${params.code} delta ${params.delta.toFixed(
    1,
  )}% exceeds ${params.thresholds.maxReasonCodeDeltaPct}%`,
  metric: {
    slot: params.slot,
    code: params.code,
    baselinePct: params.baselinePct,
    currentPct: params.currentPct,
  },
  threshold: {
    warn: params.thresholds.maxReasonCodeDeltaPct,
    fail: params.thresholds.maxReasonCodeDeltaPct * 2,
  },
})

export const buildReasonCodeNewWarning = (params: {
  slot: 'day' | 'night'
  code: string
  pct: number
  thresholds: OpsThresholds
  severity: Warning['severity']
}): Warning => ({
  severity: params.severity,
  code: 'REASON_CODE_NEW',
  message: `${params.slot} new reason code ${params.code} at ${params.pct.toFixed(
    1,
  )}% exceeds ${params.thresholds.maxNewReasonCodePct}%`,
  metric: { slot: params.slot, code: params.code, pct: params.pct },
  threshold: {
    warn: params.thresholds.maxNewReasonCodePct,
    fail: params.thresholds.maxNewReasonCodePct * 2,
  },
})

export const buildReasonCodeCoverageDropWarning = (params: {
  slot: 'day' | 'night'
  baselineCoveragePct: number
  currentCoveragePct: number
  thresholds: OpsThresholds
  severity: Warning['severity']
}): Warning => ({
  severity: params.severity,
  code: 'REASON_CODE_COVERAGE_DROP',
  message: `${params.slot} reason code coverage dropped from ${params.baselineCoveragePct.toFixed(
    1,
  )}% to ${params.currentCoveragePct.toFixed(1)}%`,
  metric: {
    slot: params.slot,
    baseline: params.baselineCoveragePct,
    current: params.currentCoveragePct,
  },
  threshold: {
    warn: params.thresholds.maxReasonCodeDeltaPct,
    fail: params.thresholds.maxReasonCodeDeltaPct * 2,
  },
})
