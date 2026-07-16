import { describe, expect, it } from 'vitest'
import { shouldApplyDatasetMapFocus } from './mapFocusPriority'

describe('shouldApplyDatasetMapFocus', () => {
  it('allows dataset focus when there is no explicit target', () => {
    expect(shouldApplyDatasetMapFocus({})).toBe(true)
    expect(
      shouldApplyDatasetMapFocus({
        focusBoundsKey: null,
        focusCenterKey: null,
      }),
    ).toBe(true)
  })

  it('preserves explicit bounds and center targets', () => {
    expect(
      shouldApplyDatasetMapFocus({ focusBoundsKey: 'search:bounds' }),
    ).toBe(false)
    expect(
      shouldApplyDatasetMapFocus({ focusCenterKey: 'search:center' }),
    ).toBe(false)
    expect(
      shouldApplyDatasetMapFocus({
        focusBoundsKey: 'route:bounds',
        focusCenterKey: 'segment:center',
      }),
    ).toBe(false)
  })
})
