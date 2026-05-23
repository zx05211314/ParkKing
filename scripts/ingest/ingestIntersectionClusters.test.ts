import { describe, expect, it } from 'vitest'
import {
  clusterEndpoints,
  degreeFromCluster,
} from './ingestIntersectionClusters'

describe('ingestIntersectionClusters', () => {
  it('clusters nearby endpoints and counts unique line degree', () => {
    const clusters = clusterEndpoints(
      [
        { coord: [121.5, 25], bearing: 0, lineId: 'a' },
        { coord: [121.500001, 25.000001], bearing: 90, lineId: 'b' },
        { coord: [121.6, 25.1], bearing: 180, lineId: 'c' },
      ],
      20,
    )

    expect(clusters).toHaveLength(2)
    expect(degreeFromCluster(clusters[0])).toBe(2)
  })
})
