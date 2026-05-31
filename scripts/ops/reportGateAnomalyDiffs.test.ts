import { describe, expect, it } from 'vitest'
import { extractDistrictDiff, pickDelta } from './reportGateAnomalyDiffs'

describe('reportGateAnomalyDiffs', () => {
  it('normalizes numeric delta fields and extracts district-specific diffs', () => {
    expect(
      pickDelta({ prev: '10', next: '3', delta: '-7', deltaPct: '-0.7' }),
    ).toEqual({
      prev: 10,
      next: 3,
      delta: -7,
      deltaPct: -0.7,
    })

    expect(
      extractDistrictDiff(
        {
          districts: [
            { districtId: 'daan', issues: [], meta: {} },
            { districtId: 'xinyi', issues: [{ code: 'FAIL' }], meta: {} },
          ],
        } as never,
        'xinyi',
      ),
    ).toMatchObject({ districtId: 'xinyi' })
  })
})
