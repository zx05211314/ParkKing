import { describe, expect, it } from 'vitest'
import { reasonText } from './reasonText'

describe('reasonText', () => {
  it('presents reviewed sign override reasons as user-facing evidence', () => {
    expect(reasonText('OVERRIDE_STATUS_LEGAL')).toBe(
      'reviewed sign evidence confirms parking is allowed here',
    )
    expect(reasonText('OVERRIDE_STATUS_ILLEGAL')).toBe(
      'reviewed sign evidence confirms parking is not allowed here',
    )
    expect(reasonText('OVERRIDE_STATUS_UNCLEAR')).toBe(
      'reviewed sign evidence is unclear',
    )
    expect(reasonText('OVERRIDE_APPLIED')).toBe(
      'reviewed sign evidence applied to this curb',
    )
    expect(reasonText('OVERRIDE_LOW_CONFIDENCE')).toBe(
      'reviewed sign evidence has low confidence',
    )
  })
})
