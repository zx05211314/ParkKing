import { describe, expect, it } from 'vitest'
import {
  buildAppliedBaselineAdoptState,
  buildUnappliedBaselineAdoptState,
} from './publishGateBaselineAdoptState'

describe('publishGateBaselineAdoptState', () => {
  it('builds an unapplied state without mutating flags', () => {
    const checkedDistricts = [{ districtId: 'xinyi', warnings: [] }]

    expect(
      buildUnappliedBaselineAdoptState({
        checkedDistricts,
        gateMessageFlags: ['EXISTING'],
      }),
    ).toEqual({
      checkedDistricts,
      applied: false,
      districtIds: [],
      gateMessageFlags: ['EXISTING'],
    })
  })

  it('rewrites adoptable diff fails to warnings and appends the applied flag', () => {
    const result = buildAppliedBaselineAdoptState({
      checkedDistricts: [
        {
          districtId: 'xinyi',
          warnings: [
            { severity: 'FAIL', code: 'DIFF_SEGMENT_COUNT_DELTA', message: 'adoptable' },
            { severity: 'FAIL', code: 'DIFF_SEGMENTS_ZERO', message: 'hard fail' },
          ],
        },
      ],
      gateMessageFlags: [],
    })

    expect(result.applied).toBe(true)
    expect(result.districtIds).toEqual(['xinyi'])
    expect(result.gateMessageFlags).toContain('BASELINE_ADOPT_APPLIED')
    expect(result.checkedDistricts[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIFF_SEGMENT_COUNT_DELTA', severity: 'WARN' }),
        expect.objectContaining({ code: 'DIFF_SEGMENTS_ZERO', severity: 'FAIL' }),
      ]),
    )
  })
})
