import { describe, expect, it } from 'vitest'
import { normalizeRelPath } from './diffPackListing'

describe('diffPackListing', () => {
  it('normalizes relative paths to forward slashes', () => {
    expect(
      normalizeRelPath(
        'C:\\tmp\\pack',
        'C:\\tmp\\pack\\nested\\dataset_meta.json',
      ),
    ).toBe('nested/dataset_meta.json')
  })
})
