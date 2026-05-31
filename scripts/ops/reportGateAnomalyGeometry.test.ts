import { describe, expect, it } from 'vitest'
import { boundaryAnomalies } from './reportGateBoundaryAnomalies'

describe('reportGateAnomalyGeometry', () => {
  it('flags missing and outside boundary center anomalies', () => {
    const anomalies = boundaryAnomalies(
      {
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [2, 2],
      },
      null,
    )

    expect(anomalies.map((entry) => entry.code)).toContain('BOUNDARY_CENTER_OUTSIDE_BBOX')
  })
})
