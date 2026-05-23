import { describe, expect, it } from 'vitest'
import { buildPublishGateRunSummary } from './publishGateRunSummary'

describe('publishGateRunSummary', () => {
  it('builds the publish gate run summary from decision and totals state', () => {
    const summary = buildPublishGateRunSummary({
      reportPath: 'report.json',
      mode: 'strict',
      allowWarn: false,
      allowFailRequested: true,
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt xinyi',
      bootstrapState: {
        requested: true,
        previousPackExists: false,
        modeUsed: true,
        denied: false,
        effectiveAllowFail: true,
        gateMessageFlags: ['BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'],
      },
      baselineAdoptState: {
        checkedDistricts: [],
        applied: true,
        districtIds: ['xinyi'],
        gateMessageFlags: [
          'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH',
          'BASELINE_ADOPT_APPLIED',
        ],
      },
      totals: { info: 1, warn: 2, fail: 0 },
      districts: [
        {
          districtId: 'xinyi',
          info: 1,
          warn: 2,
          fail: 0,
          topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
          topFailCodes: [],
          signOverrideBreakdown: {
            total: 4,
            matchedBySegmentId: 3,
            matchedBySpatial: 1,
            unmatchedNamed: 2,
          },
        },
      ],
      exitCode: 0,
    })

    expect(summary).toMatchObject({
      reportPath: 'report.json',
      allowFail: true,
      allowFailRequested: true,
      overrideReason: 'baseline adopt xinyi',
      bootstrap: {
        requested: true,
        modeUsed: true,
        denied: false,
        previousPackExists: false,
      },
      baselineAdopt: {
        enabled: true,
        applied: true,
        districtIds: ['xinyi'],
        reason: 'baseline_adopt',
      },
      gateMessageFlags: [
        'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH',
        'BASELINE_ADOPT_APPLIED',
      ],
      totals: { info: 1, warn: 2, fail: 0 },
      districts: [
        {
          signOverrideBreakdown: {
            total: 4,
            matchedBySegmentId: 3,
            matchedBySpatial: 1,
            unmatchedNamed: 2,
          },
        },
      ],
      exitCode: 0,
    })
    expect(typeof summary.generatedAt).toBe('string')
  })
})
