import { featureCollection, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { validateTaoyuanBoundaryCollection } from './validateTaoyuanBoundaries'

const makeBoundary = (townCode: string, index: number) =>
  polygon(
    [
      [
        [121.1 + index * 0.001, 24.9],
        [121.101 + index * 0.001, 24.9],
        [121.101 + index * 0.001, 24.901],
        [121.1 + index * 0.001, 24.9],
      ],
    ],
    {
      COUNTYCODE: '68000',
      TOWNCODE: townCode,
      TOWNID: `H${String(index + 1).padStart(2, '0')}`,
      TOWNENG: `District ${index + 1}`,
    },
  )

describe('validateTaoyuanBoundaries', () => {
  it('accepts all 13 official Taoyuan district codes in lng/lat', () => {
    const collection = featureCollection(
      Array.from({ length: 13 }, (_, index) =>
        makeBoundary(`68000${String((index + 1) * 10).padStart(3, '0')}`, index),
      ),
    )
    const result = validateTaoyuanBoundaryCollection(collection)
    expect(result.valid).toBe(true)
    expect(result.rows).toHaveLength(13)
  })

  it('rejects incomplete boundary coverage', () => {
    const result = validateTaoyuanBoundaryCollection(
      featureCollection([makeBoundary('68000010', 0)]),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing Taoyuan TOWNCODE 68000020')
  })
})
