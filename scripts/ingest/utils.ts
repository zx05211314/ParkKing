import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { booleanIntersects, featureCollection } from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryCollection,
  MultiPolygon,
  Polygon,
} from 'geojson'
import type { ResolvedConfig } from './readConfig'
import { getBoundaryFileName } from './ingestDistrictPaths'

export { EPSG_3826, EPSG_4326 } from './ingestCrs'
export { buildDatasetMeta } from './ingestDatasetMeta'
export { getBoundaryFileName, normalizeDistrictId } from './ingestDistrictPaths'
export { readDataset } from './ingestDatasetRead'

export const ensureDirs = async (config: ResolvedConfig) => {
  await fs.mkdir(config.outputs.generatedDir, { recursive: true })
  await fs.mkdir(config.outputs.publicDir, { recursive: true })
}

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const collectGeometryCoords = (geometry: Geometry, result: [number, number][]) => {
  if (geometry.type === 'GeometryCollection') {
    const geometryCollection = geometry as GeometryCollection
    geometryCollection.geometries.forEach((entry) => collectGeometryCoords(entry, result))
    return
  }

  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates, result)
}

const bboxFromGeometry = (geometry: Geometry): BBox | null => {
  const coords: [number, number][] = []
  collectGeometryCoords(geometry, coords)
  if (coords.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  coords.forEach(([x, y]) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  return { minX, minY, maxX, maxY }
}

const bboxIntersects = (left: BBox, right: BBox) =>
  !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  )

export const filterToBoundary = (
  collection: FeatureCollection,
  boundary: Feature<Polygon | MultiPolygon>,
): FeatureCollection => {
  const boundaryBBox = boundary.geometry ? bboxFromGeometry(boundary.geometry) : null
  const filtered = collection.features.filter((feature) => {
    if (!feature.geometry) {
      return false
    }
    const featureBBox = bboxFromGeometry(feature.geometry)
    if (boundaryBBox && featureBBox && !bboxIntersects(boundaryBBox, featureBBox)) {
      return false
    }
    return booleanIntersects(boundary, feature as Feature<Geometry, GeoJsonProperties>)
  })

  return featureCollection(filtered)
}

const pickRelevantProperties = (properties: GeoJsonProperties | null) => {
  if (!properties) {
    return null
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /id|color|curb|mark|type|class|date|time|update|name|source|reliab|prov/i.test(
      key,
    ),
  )
  return Object.fromEntries(filtered)
}

export const reduceProperties = (collection: FeatureCollection): FeatureCollection => {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: pickRelevantProperties(feature.properties ?? null) ?? feature.properties,
    })),
  }
}

export const loadBoundary = async (config: ResolvedConfig) => {
  const boundaryFile = getBoundaryFileName(config.districtId)
  const boundaryPath = path.resolve(config.outputs.generatedDir, boundaryFile)
  const raw = await fs.readFile(boundaryPath, 'utf-8')
  const geojson = JSON.parse(raw) as FeatureCollection
  const feature = geojson.features[0] as Feature<Polygon | MultiPolygon>
  if (!feature) {
    throw new Error('Boundary not found. Run ingestDistrictBounds first.')
  }
  return feature
}

export const writeGeoJson = async (
  config: ResolvedConfig,
  fileName: string,
  data: FeatureCollection,
) => {
  await ensureDirs(config)
  await fs.writeFile(
    path.resolve(config.outputs.generatedDir, fileName),
    JSON.stringify(data),
    'utf-8',
  )
}

export const writeJson = async (
  config: ResolvedConfig,
  fileName: string,
  data: unknown,
) => {
  await ensureDirs(config)
  await fs.writeFile(
    path.resolve(config.outputs.generatedDir, fileName),
    JSON.stringify(data, null, 2),
    'utf-8',
  )
}

export const copyGeneratedToPublic = async (config: ResolvedConfig) => {
  await ensureDirs(config)
  await fs.cp(config.outputs.generatedDir, config.outputs.publicDir, {
    recursive: true,
    force: true,
  })
}
