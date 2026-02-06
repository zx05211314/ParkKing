import { describe, expect, it } from 'vitest'
import { selectDistrictByLocation } from './districtSelect'

describe('selectDistrictByLocation', () => {
  it('prefers districts that contain the location', () => {
    const districts = [
      {
        districtId: 'alpha',
        boundaryBBox: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
        boundaryCenter: [1, 1] as [number, number],
      },
      {
        districtId: 'beta',
        boundaryBBox: { minX: 3, minY: 3, maxX: 4, maxY: 4 },
        boundaryCenter: [3.5, 3.5] as [number, number],
      },
    ]

    const selected = selectDistrictByLocation(districts, [1.5, 1.5])
    expect(selected).toBe('alpha')
  })

  it('falls back to nearest center when outside all bboxes', () => {
    const districts = [
      {
        districtId: 'alpha',
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [0.5, 0.5] as [number, number],
      },
      {
        districtId: 'beta',
        boundaryBBox: { minX: 5, minY: 5, maxX: 6, maxY: 6 },
        boundaryCenter: [5.5, 5.5] as [number, number],
      },
    ]

    const selected = selectDistrictByLocation(districts, [2.2, 2.2])
    expect(selected).toBe('alpha')
  })

  it('uses bbox center when boundaryCenter is missing', () => {
    const districts = [
      {
        districtId: 'alpha',
        boundaryBBox: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      },
      {
        districtId: 'beta',
        boundaryBBox: { minX: 4, minY: 4, maxX: 6, maxY: 6 },
      },
    ]

    const selected = selectDistrictByLocation(districts, [5, 5])
    expect(selected).toBe('beta')
  })
})
