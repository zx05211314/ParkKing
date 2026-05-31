import { describe, expect, it } from 'vitest'
import { applyPublishGateBaselineAdopt } from './publishGateBaselineAdopt'

describe('publishGateBaselineAdopt', () => {
  it('rewrites adoptable diff fails into warnings and appends the adopt flag', () => {
    const result = applyPublishGateBaselineAdopt({
      checkedDistricts: [
        {
          districtId: 'xinyi',
          warnings: [
            { severity: 'FAIL' as const, code: 'DIFF_SEGMENT_COUNT_DELTA', message: 'adoptable' },
            { severity: 'WARN' as const, code: 'COUNT_DELTA', message: 'warn' },
          ],
        },
      ],
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt xinyi',
      gateMessageFlags: [],
    })

    expect(result.applied).toBe(true)
    expect(result.districtIds).toEqual(['xinyi'])
    expect(result.gateMessageFlags).toContain('BASELINE_ADOPT_APPLIED')
    expect(result.checkedDistricts[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIFF_SEGMENT_COUNT_DELTA', severity: 'WARN' }),
      ]),
    )
  })

  it('leaves non-adoptable hard fails untouched', () => {
    const checkedDistricts = [
      {
        districtId: 'xinyi',
        warnings: [{ severity: 'FAIL' as const, code: 'PERF_REGRESSION', message: 'hard fail' }],
      },
    ]
    const result = applyPublishGateBaselineAdopt({
      checkedDistricts,
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt hard fail',
      gateMessageFlags: [],
    })

    expect(result).toEqual({
      checkedDistricts,
      applied: false,
      districtIds: [],
      gateMessageFlags: [],
    })
  })
})
