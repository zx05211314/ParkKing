import { describe, expect, it } from 'vitest'
import { boundsFromBBox, boundsFromPath, expandBounds } from './bounds'

describe('boundsFromBBox', () => {
  it('builds map bounds from a bbox object', () => {
    expect(
      boundsFromBBox({
        minX: 121.55,
        minY: 25.03,
        maxX: 121.57,
        maxY: 25.05,
      }),
    ).toEqual([
      [121.55, 25.03],
      [121.57, 25.05],
    ])
  })
})

describe('boundsFromPath', () => {
  it('builds bounds from a path', () => {
    expect(
      boundsFromPath([
        [121.561, 25.033],
        [121.559, 25.036],
        [121.564, 25.031],
      ]),
    ).toEqual([
      [121.559, 25.031],
      [121.564, 25.036],
    ])
  })
})

describe('expandBounds', () => {
  it('keeps existing bounds when both spans are already large enough', () => {
    const bounds: [[number, number], [number, number]] = [
      [121.55, 25.03],
      [121.57, 25.05],
    ]

    expect(expandBounds(bounds)).toEqual(bounds)
  })

  it('pads degenerate bounds so fitBounds can zoom safely', () => {
    const result = expandBounds([[121.56, 25.04], [121.56, 25.04]], 0.001)

    expect(result[0][0]).toBeCloseTo(121.5595)
    expect(result[0][1]).toBeCloseTo(25.0395)
    expect(result[1][0]).toBeCloseTo(121.5605)
    expect(result[1][1]).toBeCloseTo(25.0405)
  })
})
