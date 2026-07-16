import { booleanPointInPolygon, point } from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson'
import { centerFromLineGeometry } from './ingestCandidateGeometry'

export interface BBox {
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

export const bboxFromGeometry = (geometry: Geometry): BBox => {
  const coords: [number, number][] = []
  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates, coords)

  if (coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const xs = coords.map((coord) => coord[0])
  const ys = coords.map((coord) => coord[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export const bboxIntersects = (left: BBox, right: BBox) => {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  )
}

export const assertCoordRanges = (
  geometry: Geometry,
  dataset: string,
  featureIndex: number,
  errors: string[],
) => {
  const coords: [number, number][] = []
  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates, coords)

  coords.forEach((coord) => {
    const [lon, lat] = coord
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      errors.push(`[${dataset}] feature ${featureIndex + 1}: non-finite coordinate ${coord}`)
      return
    }
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      errors.push(
        `[${dataset}] feature ${featureIndex + 1}: coordinate out of WGS84 range (${lon}, ${lat}). Check CRS in ingest.config.json`,
      )
    }
  })
}

export const validateGeometryTypes = (
  feature: Feature,
  allowed: string[],
  dataset: string,
  index: number,
  errors: string[],
) => {
  if (!feature.geometry) {
    errors.push(`[${dataset}] feature ${index + 1}: missing geometry`)
    return
  }
  if (!allowed.includes(feature.geometry.type)) {
    errors.push(
      `[${dataset}] feature ${index + 1}: expected ${allowed.join(', ')}, got ${feature.geometry.type}`,
    )
  }
}

export const validateCollection = (
  collection: FeatureCollection,
  dataset: string,
  allowedTypes: string[],
  boundaryBBox: BBox,
  minCount: number,
  errors: string[],
) => {
  if (collection.features.length === 0) {
    if (minCount > 0) {
      errors.push(`[${dataset}] contains 0 features. Check filtering or input.`)
    }
    return
  }

  if (collection.features.length < minCount) {
    errors.push(
      `[${dataset}] has ${collection.features.length} features, below minimum ${minCount}.`,
    )
  }

  let outOfBounds = 0

  collection.features.forEach((feature, index) => {
    validateGeometryTypes(feature, allowedTypes, dataset, index, errors)
    if (!feature.geometry) {
      return
    }
    assertCoordRanges(feature.geometry, dataset, index, errors)
    const featureBBox = bboxFromGeometry(feature.geometry)
    if (!bboxIntersects(featureBBox, boundaryBBox)) {
      outOfBounds += 1
    }
  })

  if (outOfBounds > 0) {
    errors.push(
      `[${dataset}] ${outOfBounds} feature(s) fall outside district boundary bbox. Check boundary clip step.`,
    )
  }
}

export const validateCandidateBoundaryOwnership = (
  collection: FeatureCollection,
  boundary: Feature<Polygon | MultiPolygon>,
  errors: string[],
) => {
  const outsideIds: string[] = []
  collection.features.forEach((feature, index) => {
    if (
      !feature.geometry ||
      (feature.geometry.type !== 'LineString' &&
        feature.geometry.type !== 'MultiLineString')
    ) {
      return
    }
    const center = centerFromLineGeometry(
      feature.geometry as LineString | MultiLineString,
    )
    if (!center || !booleanPointInPolygon(point(center), boundary)) {
      outsideIds.push(String(feature.properties?.id ?? `feature-${index + 1}`))
    }
  })

  if (outsideIds.length > 0) {
    errors.push(
      `[candidates_inferred] ${outsideIds.length} feature(s) have representative centers outside district boundary. ` +
        `Sample IDs: ${outsideIds.slice(0, 5).join(', ')}. Re-run inferred candidate ingest.`,
    )
  }
}
