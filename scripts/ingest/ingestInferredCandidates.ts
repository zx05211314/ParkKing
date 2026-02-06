import { distance, featureCollection, lineOffset, lineString, point } from '@turf/turf'
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig, type ResolvedConfig } from './readConfig'
import { filterToBoundary, loadBoundary, readDataset, writeGeoJson } from './utils'

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

const midpointForLine = (coords: [number, number][]) => {
  if (coords.length === 0) {
    return null
  }
  const mid = coords[Math.floor(coords.length / 2)]
  return mid ? ([mid[0], mid[1]] as [number, number]) : null
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

const extractRoadWidth = (properties: Feature['properties']): number | null => {
  if (!properties) {
    return null
  }
  const candidates = [
    'width',
    'road_width',
    'roadwidth',
    'width_m',
    'width_meters',
  ]
  for (const key of candidates) {
    const value = parseNumber((properties as Record<string, unknown>)[key])
    if (value !== null) {
      return value
    }
  }

  const lanesValue = parseNumber(
    (properties as Record<string, unknown>).lanes ??
      (properties as Record<string, unknown>).lane_count,
  )
  if (lanesValue !== null) {
    return lanesValue * 3.5
  }

  return null
}

const extractRepresentativePoint = (
  geometry: Geometry,
): [number, number] | null => {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'MultiPoint') {
    const coord = geometry.coordinates[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'LineString') {
    return midpointForLine(geometry.coordinates as [number, number][])
  }
  if (geometry.type === 'MultiLineString') {
    const line = geometry.coordinates[0]
    return line ? midpointForLine(line as [number, number][]) : null
  }
  if (geometry.type === 'Polygon') {
    const coord = geometry.coordinates[0]?.[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'MultiPolygon') {
    const coord = geometry.coordinates[0]?.[0]?.[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const point = extractRepresentativePoint(child)
      if (point) {
        return point
      }
    }
  }
  return null
}

const loadZonePoints = async (config: ResolvedConfig) => {
  const files = [
    path.resolve(config.outputs.generatedDir, 'bus_stops.geojson'),
    path.resolve(config.outputs.generatedDir, 'hydrants.geojson'),
    path.resolve(config.outputs.generatedDir, 'intersections.geojson'),
    path.resolve(config.outputs.generatedDir, 'crosswalks.geojson'),
  ]

  const points: [number, number][] = []

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const collection = JSON.parse(raw) as FeatureCollection
      collection.features.forEach((feature) => {
        if (!feature.geometry) {
          return
        }
        const pointCoord = extractRepresentativePoint(feature.geometry as Geometry)
        if (pointCoord) {
          points.push(pointCoord)
        }
      })
    } catch {
      // ignore missing optional files
    }
  }

  return points
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

const pickCandidateProperties = (properties: Feature['properties']) => {
  if (!properties) {
    return properties
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /id|name|road|class|side|source|offset|candidate|risk|zone|width|count/i.test(
      key,
    ),
  )
  if (filtered.length === 0) {
    return properties
  }
  return Object.fromEntries(filtered)
}

const classifyRoadRisk = (roadClass: string | null) => {
  if (!roadClass) {
    return []
  }
  const majorClasses = [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'arterial',
    'highway',
    'main',
  ]
  return majorClasses.some((entry) => roadClass.includes(entry)) ? ['MAJOR_ROAD'] : []
}

const classifyZoneDensity = (count: number) => {
  if (count >= 4) {
    return ['HARD_ZONE_DENSE']
  }
  if (count >= 2) {
    return ['HARD_ZONE_MEDIUM']
  }
  if (count >= 1) {
    return ['HARD_ZONE_NEAR']
  }
  return []
}

const classifyRoadWidth = (width: number | null) => {
  if (width === null) {
    return []
  }
  if (width >= 18) {
    return ['WIDE_ROAD']
  }
  return []
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
    const filtered = filterToBoundary(collection, boundary)
    const reduced = filtered.features.map((feature) => ({
      ...feature,
      properties: pickCandidateProperties(feature.properties ?? null),
    }))
    await writeGeoJson(
      config,
      'candidates_inferred.geojson',
      featureCollection(reduced),
    )
    console.log('Copied candidates_inferred.geojson')
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
      const hardZoneCount = midpoint
        ? zonePoints.reduce((count, coord) => {
            const d = distance(point(midpoint), point(coord), { units: 'meters' })
            return d <= zoneRadiusMeters ? count + 1 : count
          }, 0)
        : 0
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

  const filtered = filterToBoundary(featureCollection(candidates), boundary)
  const reduced = filtered.features.map((feature) => ({
    ...feature,
    properties: pickCandidateProperties(feature.properties ?? null),
  }))

  await writeGeoJson(
    config,
    'candidates_inferred.geojson',
    featureCollection(reduced),
  )
  console.log('Generated candidates_inferred.geojson')
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
