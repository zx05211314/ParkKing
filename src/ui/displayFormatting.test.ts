import { describe, expect, it } from 'vitest'
import { FALLBACK_DATASET_OPTIONS } from './displayFormatting'

describe('displayFormatting', () => {
  it('keeps every current production district in the registry fallback', () => {
    expect(FALLBACK_DATASET_OPTIONS.map(({ id }) => id)).toEqual([
      'xinyi',
      'daan',
      'zhongshan',
    ])
  })
})
