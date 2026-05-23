import { describe, expect, it } from 'vitest'
import { parseBBox, parseCenter } from './reportGateGeometryMeta'

describe('reportGateGeometryMeta', () => {
  it('parses valid bbox and center values', () => {
    expect(
      parseBBox({
        minX: 121.5,
        minY: 25.03,
        maxX: 121.6,
        maxY: 25.04,
      }),
    ).toEqual({
      minX: 121.5,
      minY: 25.03,
      maxX: 121.6,
      maxY: 25.04,
    })
    expect(parseCenter([121.5, 25.03])).toEqual([121.5, 25.03])
  })

  it('returns null for malformed bbox and center values', () => {
    expect(parseBBox({ minX: 'bad', minY: 1, maxX: 2, maxY: 3 })).toBeNull()
    expect(parseCenter([121.5])).toBeNull()
    expect(parseCenter(['bad', 25.03])).toBeNull()
  })
})
