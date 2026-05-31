import { describe, expect, it } from 'vitest'
import { buildBoundaryAreaIssues } from './diffPackBoundaryIssues'

describe('diffPackBoundaryIssues', () => {
  it('emits a fail issue when boundary area collapses near zero', () => {
    expect(
      buildBoundaryAreaIssues({
        districtId: 'beta',
        boundaryBBox: {
          prev: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
          next: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
          delta: null,
          area: {
            prev: 1,
            next: 1e-12,
            delta: null,
            deltaPct: null,
          },
        },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_BBOX_COLLAPSE'])
  })
})
