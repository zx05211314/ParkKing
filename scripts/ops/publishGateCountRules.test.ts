import { describe, expect, it } from 'vitest'
import { validatePublishGateCountMetadata } from './publishGateCountRules'

describe('validatePublishGateCountMetadata', () => {
  it('flags missing counts and invalid count values', () => {
    expect(validatePublishGateCountMetadata('xinyi', {}).warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_COUNTS_MISSING' }),
      ]),
    )

    expect(
      validatePublishGateCountMetadata('xinyi', {
        counts: {
          segments: -1,
          busStops: 1,
          hydrants: 1,
          intersections: 1,
          crosswalks: 0,
          signOverrides: 0,
          inferredCandidates: 0,
          overridesApplied: 0,
        },
      }).warnings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_COUNTS_INVALID' }),
      ]),
    )
  })
})
