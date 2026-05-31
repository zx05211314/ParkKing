import { describe, expect, it } from 'vitest'

import { parseGenerateBaselinesArgs } from './generateBaselineArgs'

describe('generateBaselineArgs', () => {
  it('parses force, seed, and district filter flags', () => {
    expect(
      parseGenerateBaselinesArgs([
        'node',
        'generateBaselines.ts',
        '--seed',
        '--force',
        '--districtId',
        'xinyi',
      ]),
    ).toEqual({
      force: true,
      seed: true,
      districtIdFilter: 'xinyi',
    })
  })
})
