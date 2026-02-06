import {
  bearing,
  booleanPointInPolygon,
  distance,
  featureCollection,
  point,
} from '@turf/turf'
import type { Feature, Geometry } from 'geojson'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, writeGeoJson, writeJson } from './utils'

interface Endpoint {
  coord: [number, number]
  bearing: number
  lineId: string
}

interface Cluster {
  sumX: number
  sumY: number
  count: number
  endpoints: Endpoint[]
}

const extractLines = (geometry: Geometry): [number, number][][] => {
  if (geometry.type === 'LineString') {
    return [geometry.coordinates]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap((child) => extractLines(child))
  }
  return []
}

const normalizeClass = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

const getRoadClass = (feature: Feature): string | null => {
  const props = feature.properties ?? {}
  const candidateKeys = [
    'road_class',
    'class',
    'class_name',
    'type',
    'kind',
    'highway',
    'road_type',
  ]
  for (const key of candidateKeys) {
    const value = (props as Record<string, unknown>)[key]
    const normalized = normalizeClass(value)
    if (normalized) {
      return normalized
    }
  }
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase()
    if (candidateKeys.includes(lower)) {
      const normalized = normalizeClass(value)
      if (normalized) {
        return normalized
      }
    }
  }
  return null
}

const shouldIncludeRoadClass = (
  roadClass: string | null,
  includeSet: Set<string>,
  excludeSet: Set<string>,
) => {
  if (roadClass && excludeSet.has(roadClass)) {
    return false
  }
  if (includeSet.size === 0) {
    return true
  }
  return roadClass ? includeSet.has(roadClass) : false
}

const normalizeBearing = (value: number) => {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

const clusterEndpoints = (
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

const degreeFromCluster = (cluster: Cluster) => {
  const uniqueLines = new Set(cluster.endpoints.map((endpoint) => endpoint.lineId))
  return uniqueLines.size
}

const angularSpread = (bearings: number[]): number => {
  if (bearings.length < 2) {
    return 0
  }
  const sorted = [...bearings].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    const gap = i === sorted.length - 1 ? 360 - current + next : next - current
    if (gap > maxGap) {
      maxGap = gap
    }
  }
  return 360 - maxGap
}

const buildHistogram = (values: number[], binSize: number) => {
  const bins = Math.ceil(360 / binSize)
  const histogram: Record<string, number> = {}
  for (let i = 0; i < bins; i += 1) {
    const start = i * binSize
    const end = Math.min(360, start + binSize - 1)
    histogram[`${start}-${end}`] = 0
  }
  values.forEach((value) => {
    const clamped = Math.max(0, Math.min(360, value))
    const binIndex = Math.min(bins - 1, Math.floor(clamped / binSize))
    const start = binIndex * binSize
    const end = Math.min(360, start + binSize - 1)
    const key = `${start}-${end}`
    histogram[key] = (histogram[key] ?? 0) + 1
  })
  return histogram
}

export const ingestIntersections = async (config: ResolvedConfig) => {
  const boundary = await loadBoundary(config)

  if (config.inputs.intersections) {
    const collection = await readDataset(config.inputs.intersections, config.crs.default)
    collection.features.forEach((feature, index) => {
      if (!feature.geometry) {
        throw new Error(`[intersections] feature ${index + 1} missing geometry`)
      }
      if (!['Point', 'MultiPoint'].includes(feature.geometry.type)) {
        throw new Error(
          `[intersections] feature ${index + 1} expected Point/MultiPoint, got ${feature.geometry.type}`,
        )
      }
    })
    const filtered = filterToBoundary(collection, boundary)
    await writeGeoJson(config, 'intersections.geojson', filtered)
    const report = {
      generatedAt: new Date().toISOString(),
      config: {
        source: 'passthrough',
        input: config.inputs.intersections,
      },
      counts: {
        totalFeatures: collection.features.length,
        totalLines: 0,
        totalEndpoints: 0,
        clusters: 0,
        candidatesByDegree: 0,
        finalIntersections: filtered.features.length,
      },
      removed: {
        byRoadClassFeatures: 0,
        byRoadClassLines: 0,
        byAngle: 0,
        byBoundary: collection.features.length - filtered.features.length,
      },
      angleSpreadHistogram: buildHistogram([], 15),
    }
    await writeJson(config, 'intersections_report.json', report)
    console.log('Copied intersections.geojson')
    console.log('Generated intersections_report.json')
    return
  }

  if (!config.inputs.road_centerlines) {
    throw new Error('intersections require inputs.road_centerlines or inputs.intersections')
  }

  const inputPath = config.inputs.road_centerlines
  const collection = await readDataset(inputPath, config.crs.default)

  const includeSet = new Set(
    config.intersections.includeRoadClasses.map((entry) => entry.toLowerCase()),
  )
  const excludeSet = new Set(
    config.intersections.excludeRoadClasses.map((entry) => entry.toLowerCase()),
  )

  const endpoints: Endpoint[] = []
  let totalLines = 0
  let filteredByClassFeatures = 0
  let filteredByClassLines = 0

  collection.features.forEach((feature, featureIndex) => {
    if (!feature.geometry) {
      return
    }
    const roadClass = getRoadClass(feature)
    if (!shouldIncludeRoadClass(roadClass, includeSet, excludeSet)) {
      filteredByClassFeatures += 1
      filteredByClassLines += extractLines(feature.geometry as Geometry).length
      return
    }

    const lines = extractLines(feature.geometry as Geometry)
    lines.forEach((line, lineIndex) => {
      totalLines += 1
      if (line.length < 2) {
        return
      }
      const lineId = `${featureIndex}-${lineIndex}`
      const start = line[0]
      const next = line[1]
      const end = line[line.length - 1]
      const prev = line[line.length - 2]

      const startBearing = normalizeBearing(
        bearing(point(start), point(next)),
      )
      const endBearing = normalizeBearing(
        bearing(point(end), point(prev)),
      )

      endpoints.push({ coord: start, bearing: startBearing, lineId })
      endpoints.push({ coord: end, bearing: endBearing, lineId })
    })
  })

  const clusters = clusterEndpoints(
    endpoints,
    config.intersections.snapToleranceMeters,
  )
  const candidates = clusters.filter((cluster) => degreeFromCluster(cluster) >= 3)

  const angleSpreads: number[] = []
  const candidatesWithSpread = candidates.map((cluster) => {
    const bearings = cluster.endpoints.map((endpoint) => endpoint.bearing)
    const spread = angularSpread(bearings)
    angleSpreads.push(spread)
    return { cluster, spread, degree: degreeFromCluster(cluster) }
  })

  const filteredByAngle = candidatesWithSpread.filter(
    (entry) => entry.spread >= config.intersections.angleDiversityDegrees,
  )

  const filteredByBoundary = filteredByAngle.filter((entry) => {
    const center: [number, number] = [
      entry.cluster.sumX / entry.cluster.count,
      entry.cluster.sumY / entry.cluster.count,
    ]
    return booleanPointInPolygon(point(center), boundary)
  })

  const features = filteredByBoundary.map((entry, index) => {
    const center: [number, number] = [
      entry.cluster.sumX / entry.cluster.count,
      entry.cluster.sumY / entry.cluster.count,
    ]
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: center,
      },
      properties: {
        id: `intersection-${index + 1}`,
        degree: entry.degree,
        angleSpreadDegrees: Number(entry.spread.toFixed(1)),
      },
    }
  })

  await writeGeoJson(config, 'intersections.geojson', featureCollection(features))

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      snapToleranceMeters: config.intersections.snapToleranceMeters,
      angleDiversityDegrees: config.intersections.angleDiversityDegrees,
      includeRoadClasses: config.intersections.includeRoadClasses,
      excludeRoadClasses: config.intersections.excludeRoadClasses,
    },
    counts: {
      totalFeatures: collection.features.length,
      totalLines,
      totalEndpoints: endpoints.length,
      clusters: clusters.length,
      candidatesByDegree: candidates.length,
      finalIntersections: features.length,
    },
    removed: {
      byRoadClassFeatures: filteredByClassFeatures,
      byRoadClassLines: filteredByClassLines,
      byAngle: candidates.length - filteredByAngle.length,
      byBoundary: filteredByAngle.length - filteredByBoundary.length,
    },
    angleSpreadHistogram: buildHistogram(angleSpreads, 15),
  }

  await writeJson(config, 'intersections_report.json', report)
  console.log('Generated intersections.geojson')
  console.log('Generated intersections_report.json')
}

const run = async () => {
  const config = await readConfig()
  await ingestIntersections(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
