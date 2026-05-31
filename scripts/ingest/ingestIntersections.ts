import {
  booleanPointInPolygon,
  featureCollection,
  point,
} from '@turf/turf'
import type { Feature, Geometry, Point } from 'geojson'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import {
  clusterEndpoints,
  degreeFromCluster,
  type Endpoint,
} from './ingestIntersectionClusters'
import {
  angularSpread,
  buildHistogram,
  endpointBearings,
  extractLines,
} from './ingestIntersectionGeometry'
import {
  getRoadClass,
  shouldIncludeRoadClass,
} from './ingestIntersectionRoadClasses'
import { filterToBoundary, loadBoundary, readDataset, writeGeoJson, writeJson } from './utils'

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
      const { startBearing, endBearing } = endpointBearings(line)

      endpoints.push({ coord: line[0], bearing: startBearing, lineId })
      endpoints.push({ coord: line[line.length - 1], bearing: endBearing, lineId })
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

  const features: Array<
    Feature<Point, { id: string; degree: number; angleSpreadDegrees: number }>
  > = filteredByBoundary.map((entry, index) => {
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
