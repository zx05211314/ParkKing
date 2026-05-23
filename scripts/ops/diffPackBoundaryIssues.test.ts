import { describe, expect, it } from 'vitest'
import { buildBoundaryAreaIssues } from './diffPackBoundaryIssues'

describe('diffPackBoundaryIssues', () => {
  it('emits a fail issue when boundary area collapses near zero', () => {
    expect(
      buildBoundaryAreaIssues({
        districtId: 'beta',
        boundaryBBox: {
          prev: [0, 0, 1, 1],
          next: [0, 0, 0, 0],
          delta: null,
          deltaPct: null,
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
