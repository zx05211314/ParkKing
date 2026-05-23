import { describe, expect, it } from 'vitest'
import { getWrappedIndex } from './searchKeyboard'

describe('getWrappedIndex', () => {
  it('wraps forward to the beginning of the list', () => {
    expect(getWrappedIndex(3, 4, 1)).toBe(0)
  })

  it('wraps backward to the end of the list', () => {
    expect(getWrappedIndex(0, 4, -1)).toBe(3)
  })

  it('returns -1 when the list is empty', () => {
    expect(getWrappedIndex(0, 0, 1)).toBe(-1)
  })
})
