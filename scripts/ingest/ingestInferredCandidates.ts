import {
  booleanPointInPolygon,
  featureCollection,
  lineOffset,
  lineString,
  point,
} from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import {
  classifyRoadRisk,
  classifyRoadWidth,
  classifyZoneDensity,
  extractRoadWidth,
  getRoadClass,
  pickCandidateProperties,
  shouldIncludeRoadClass,
} from './ingestCandidateClassification'
import { extractLines, midpointForLine } from './ingestCandidateGeometry'
import { countNearbyZonePoints, loadZonePoints } from './ingestCandidateZones'
import { filterToBoundary, loadBoundary, readDataset, writeGeoJson } from './utils'

const centerFromCandidateGeometry = (
  geometry: LineString | MultiLineString,
): [number, number] | null => {
  const positions = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat()
  if (positions.length === 0) {
    return null
  }
  const [longitude, latitude] = positions.reduce(
    ([longitudeSum, latitudeSum], position) => [
      longitudeSum + (position[0] ?? 0),
      latitudeSum + (position[1] ?? 0),
    ],
    [0, 0],
  )
  return [longitude / positions.length, latitude / positions.length]
}

export const filterCandidatesToBoundaryOwnership = (
  collection: FeatureCollection<LineString | MultiLineString>,
  boundary: Feature<Polygon | MultiPolygon>,
) => {
  const intersecting = filterToBoundary(collection, boundary)
  return featureCollection(
    intersecting.features.filter((feature) => {
      if (
        !feature.geometry ||
        (feature.geometry.type !== 'LineString' &&
          feature.geometry.type !== 'MultiLineString')
      ) {
        return false
      }
      const center = centerFromCandidateGeometry(feature.geometry)
      return center
        ? booleanPointInPolygon(point(center), boundary)
        : false
    }) as Array<Feature<LineString | MultiLineString>>,
  )
}

export const ingestInferredCandidates = async (config: ResolvedConfig) => {
  if (config.inputs.candidates_inferred) {
    const collection = await readDataset(
      config.inputs.candidates_inferred,
      config.crs.default,
    )
    collection.features.forEach((feature, index) => {
      if (!feature.geometry) {
        throw new Error(`[candidates_inferred] feature ${index + 1} missing geometry`)
      }
      if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
        throw new Error(
          `[candidates_inferred] feature ${index + 1} expected LineString/MultiLineString, got ${feature.geometry.type}`,
        )
      }
    })
    const boundary = await loadBoundary(config)
    const filtered = filterCandidatesToBoundaryOwnership(
      collection as FeatureCollection<LineString | MultiLineString>,
      boundary,
    )
    const reduced = filtered.features.map((feature) => ({
      ...feature,
      properties: pickCandidateProperties(feature.properties ?? null),
    }))
    await writeGeoJson(
      config,
      'candidates_inferred.geojson',
      featureCollection(reduced),
    )
    console.log(
      `Copied candidates_inferred.geojson (${filtered.features.length} retained, ` +
        `${collection.features.length - filtered.features.length} outside district ownership removed)`,
    )
    return
  }

  if (!config.inputs.road_centerlines) {
    throw new Error(
      'candidates_inferred require inputs.road_centerlines or inputs.candidates_inferred',
    )
  }

  const collection = await readDataset(config.inputs.road_centerlines, config.crs.default)
  const boundary = await loadBoundary(config)
  const zonePoints = await loadZonePoints(config)

  const includeSet = new Set(
    config.inferredCandidates.includeRoadClasses.map((entry) => entry.toLowerCase()),
  )
  const excludeSet = new Set(
    config.inferredCandidates.excludeRoadClasses.map((entry) => entry.toLowerCase()),
  )

  const offsetMeters = config.inferredCandidates.offsetMeters
  const candidates: Array<Feature<LineString | MultiLineString>> = []
  const zoneRadiusMeters = 25

  collection.features.forEach((feature, featureIndex) => {
    if (!feature.geometry) {
      return
    }
    const roadClass = getRoadClass(feature)
    if (!shouldIncludeRoadClass(roadClass, includeSet, excludeSet)) {
      return
    }

    const lines = extractLines(feature.geometry as Geometry)
    lines.forEach((line, lineIndex) => {
      if (line.length < 2) {
        return
      }
      const widthMeters = extractRoadWidth(feature.properties ?? null)
      const midpoint = midpointForLine(line)
      const hardZoneCount = countNearbyZonePoints(
        midpoint,
        zonePoints,
        zoneRadiusMeters,
      )
      const riskTags = [
        ...classifyRoadRisk(roadClass),
        ...classifyRoadWidth(widthMeters),
        ...classifyZoneDensity(hardZoneCount),
      ]
      const baseId =
        (feature.properties?.id ??
          feature.properties?.ID ??
          `candidate-${featureIndex + 1}-${lineIndex + 1}`) as string
      const name = feature.properties?.name
        ? String(feature.properties.name)
        : `Inferred candidate ${featureIndex + 1}`

      const baseLine = lineString(line)
      const left = lineOffset(baseLine, offsetMeters, { units: 'meters' })
      const right = lineOffset(baseLine, -offsetMeters, { units: 'meters' })

      if (left.geometry) {
        candidates.push({
          ...left,
          properties: {
            id: `${baseId}-L`,
            name: `${name} (L)`,
            side: 'L',
            roadClass,
            source: 'inferred',
            offsetMeters,
            roadWidthMeters: widthMeters ?? undefined,
            hardZoneCount,
            riskTags,
          },
        })
      }
      if (right.geometry) {
        candidates.push({
          ...right,
          properties: {
            id: `${baseId}-R`,
            name: `${name} (R)`,
            side: 'R',
            roadClass,
            source: 'inferred',
            offsetMeters,
            roadWidthMeters: widthMeters ?? undefined,
            hardZoneCount,
            riskTags,
          },
        })
      }
    })
  })

  const filtered = filterCandidatesToBoundaryOwnership(
    featureCollection(candidates),
    boundary,
  )
  const reduced = filtered.features.map((feature) => ({
    ...feature,
    properties: pickCandidateProperties(feature.properties ?? null),
  }))

  await writeGeoJson(
    config,
    'candidates_inferred.geojson',
    featureCollection(reduced),
  )
  console.log(
    `Generated candidates_inferred.geojson (${filtered.features.length} retained, ` +
      `${candidates.length - filtered.features.length} outside district ownership removed)`,
  )
}

const run = async () => {
  const config = await readConfig()
  await ingestInferredCandidates(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
