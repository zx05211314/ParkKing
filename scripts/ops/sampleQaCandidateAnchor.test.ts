import { describe, expect, it } from 'vitest'
import { MOCK_LOCATION } from '../../src/map/geo'
import { toQaAnchorLocation } from './sampleQaCandidateAnchor'

describe('sampleQaCandidateAnchor', () => {
  it('falls back to the mock location when the boundary center is unusable', () => {
    expect(toQaAnchorLocation(null)).toEqual(MOCK_LOCATION)
    expect(toQaAnchorLocation({ boundaryCenter: [Number.NaN, 25] } as never)).toEqual(
      MOCK_LOCATION,
    )
  })

  it('returns the boundary center when present and numeric', () => {
    expect(
      toQaAnchorLocation({
        boundaryCenter: [121.5, 25.05],
      } as never),
    ).toEqual([121.5, 25.05])
  })
})
