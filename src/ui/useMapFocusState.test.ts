import { describe, expect, it } from 'vitest'
import { buildPinnedLocationFocus } from './useMapFocusState'

describe('buildPinnedLocationFocus', () => {
  it('focuses shared, imported, and interactive pinned locations', () => {
    expect(
      buildPinnedLocationFocus({
        searchLocation: [121.543, 25.033],
      }),
    ).toEqual({
      key: 'pinned:121.543000,25.033000',
      center: [121.543, 25.033],
    })
  })

  it('ignores empty locations', () => {
    expect(
      buildPinnedLocationFocus({
        searchLocation: null,
      }),
    ).toBeNull()
  })
})
