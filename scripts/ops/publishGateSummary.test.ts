import { describe, expect, it } from 'vitest'
import {
  buildPublishGateDistrictSummaries,
  buildPublishGateTotals,
  resolvePublishGateExitCode,
} from './publishGateSummary'

describe('publishGateSummary', () => {
  it('builds per-district severity counts plus top warn and fail codes', () => {
    const summaries = buildPublishGateDistrictSummaries([
      {
        districtId: 'xinyi',
        signOverrideBreakdown: {
          total: 4,
          matchedBySegmentId: 3,
          matchedBySpatial: 1,
          unmatchedNamed: 2,
        },
        warnings: [
          { severity: 'WARN', code: 'W1', message: 'warn' },
          { severity: 'WARN', code: 'W2', message: 'warn 2' },
          { severity: 'WARN', code: 'W1', message: 'warn again' },
          { severity: 'FAIL', code: 'F2', message: 'fail 2' },
          { severity: 'FAIL', code: 'F1', message: 'fail 1a' },
          { severity: 'FAIL', code: 'F1', message: 'fail 1b' },
        ],
      },
    ])

    expect(summaries).toEqual([
      {
        districtId: 'xinyi',
        info: 0,
        warn: 3,
        fail: 3,
        topWarnCodes: ['W1', 'W2'],
        topFailCodes: ['F1', 'F2'],
        signOverrideBreakdown: {
          total: 4,
          matchedBySegmentId: 3,
          matchedBySpatial: 1,
          unmatchedNamed: 2,
        },
      },
    ])
  })

  it('builds totals and resolves exit codes from the summary state', () => {
    const totals = buildPublishGateTotals([
      {
        districtId: 'xinyi',
        info: 1,
        warn: 2,
        fail: 0,
        topWarnCodes: ['WARN_A'],
        topFailCodes: [],
      },
      {
        districtId: 'daan',
        info: 0,
        warn: 0,
        fail: 1,
        topWarnCodes: [],
        topFailCodes: ['FAIL_A'],
      },
    ])

    expect(totals).toEqual({ info: 1, warn: 2, fail: 1 })
    expect(
      resolvePublishGateExitCode({
        totals,
        mode: 'strict',
        allowWarn: false,
        effectiveAllowFail: false,
      }),
    ).toBe(3)
    expect(
      resolvePublishGateExitCode({
        totals: { info: 0, warn: 2, fail: 0 },
        mode: 'strict',
        allowWarn: false,
        effectiveAllowFail: true,
      }),
    ).toBe(2)
    expect(
      resolvePublishGateExitCode({
        totals: { info: 0, warn: 1, fail: 0 },
        mode: 'warn',
        allowWarn: false,
        effectiveAllowFail: true,
      }),
    ).toBe(0)
  })
})
