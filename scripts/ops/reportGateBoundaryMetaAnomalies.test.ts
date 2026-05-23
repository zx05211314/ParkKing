import { describe, expect, it } from 'vitest'

import { buildBoundaryMetaAnomalies } from './reportGateBoundaryMetaAnomalies'

describe('reportGateBoundaryMetaAnomalies', () => {
  it('emits missing, outside, and near-zero boundary anomalies from dataset meta', () => {
    expect(buildBoundaryMetaAnomalies({})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BOUNDARY_BBOX_MISSING' }),
        expect.objectContaining({ code: 'BOUNDARY_CENTER_MISSING' }),
      ]),
    )

    expect(
      buildBoundaryMetaAnomalies({
        boundaryBBox: { minX: 0, minY: 0, maxX: 1e-6, maxY: 1e-6 },
        boundaryCenter: [2, 2],
      }).map((entry) => entry.code),
    ).toEqual(['BOUNDARY_CENTER_OUTSIDE_BBOX', 'BOUNDARY_BBOX_NEAR_ZERO'])
  })
})
