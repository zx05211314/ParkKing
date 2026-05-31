import { distance, point } from '@turf/turf'

export interface Endpoint {
  coord: [number, number]
  bearing: number
  lineId: string
}

export interface Cluster {
  sumX: number
  sumY: number
  count: number
  endpoints: Endpoint[]
}

export const clusterEndpoints = (
  endpoints: Endpoint[],
  toleranceMeters: number,
): Cluster[] => {
  const clusters: Cluster[] = []

  endpoints.forEach((endpoint) => {
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    clusters.forEach((cluster, index) => {
      const center: [number, number] = [
        cluster.sumX / cluster.count,
        cluster.sumY / cluster.count,
      ]
      const dist = distance(point(endpoint.coord), point(center), { units: 'meters' })
      if (dist <= toleranceMeters && dist < bestDistance) {
        bestDistance = dist
        bestIndex = index
      }
    })

    if (bestIndex >= 0) {
      const cluster = clusters[bestIndex]
      cluster.sumX += endpoint.coord[0]
      cluster.sumY += endpoint.coord[1]
      cluster.count += 1
      cluster.endpoints.push(endpoint)
    } else {
      clusters.push({
        sumX: endpoint.coord[0],
        sumY: endpoint.coord[1],
        count: 1,
        endpoints: [endpoint],
      })
    }
  })

  return clusters
}

export const degreeFromCluster = (cluster: Cluster) => {
  const uniqueLines = new Set(cluster.endpoints.map((endpoint) => endpoint.lineId))
  return uniqueLines.size
}
