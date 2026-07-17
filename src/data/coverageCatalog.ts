import type { MultiPolygon, Polygon } from 'geojson'

export type CoveragePublishStage = 'production' | 'candidate' | 'source-only'
export type CoverageAnswerCapability =
  | 'full-rule-pipeline'
  | 'paid-curb-reference-only'
export type RuntimeCoverageCatalogStatus = 'loading' | 'ready' | 'error'

export interface RuntimeCoverageAlias {
  areaId: string
  areaName: string
  coverageMode: 'parent-district'
  standaloneBoundaryRequired: boolean
}

export interface RuntimeCoverageReferenceData {
  kind: 'PAID_CURB_SEGMENT_TEXT'
  url: string
  recordCount: number
  sourceSha256: string
  geometryAvailable: false
  legalAnswerEligible: false
  requiresHumanReview: true
}

export interface RuntimeCoverageDistrict {
  regionId: string
  regionName: string
  districtId: string
  districtName: string
  boundaryFeatureId: string
  publishStage: CoveragePublishStage
  answerCapability: CoverageAnswerCapability
  requiresHumanReview: boolean
  aliases: RuntimeCoverageAlias[]
  referenceData?: RuntimeCoverageReferenceData
  boundaryBBox: [number, number, number, number]
  boundaryGeometry: Polygon | MultiPolygon
}

export interface RuntimeCoverageCatalog {
  schemaVersion: 1
  districts: RuntimeCoverageDistrict[]
}

const PUBLISH_STAGES = new Set<CoveragePublishStage>([
  'production',
  'candidate',
  'source-only',
])
const ANSWER_CAPABILITIES = new Set<CoverageAnswerCapability>([
  'full-rule-pipeline',
  'paid-curb-reference-only',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isBoundaryBBox = (
  value: unknown,
): value is RuntimeCoverageDistrict['boundaryBBox'] =>
  Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber)

const isBoundaryGeometry = (
  value: unknown,
): value is RuntimeCoverageDistrict['boundaryGeometry'] =>
  isRecord(value) &&
  (value.type === 'Polygon' || value.type === 'MultiPolygon') &&
  Array.isArray(value.coordinates)

const isAlias = (value: unknown): value is RuntimeCoverageAlias =>
  isRecord(value) &&
  typeof value.areaId === 'string' &&
  typeof value.areaName === 'string' &&
  value.coverageMode === 'parent-district' &&
  typeof value.standaloneBoundaryRequired === 'boolean'

const isReferenceData = (
  value: unknown,
): value is RuntimeCoverageReferenceData =>
  isRecord(value) &&
  value.kind === 'PAID_CURB_SEGMENT_TEXT' &&
  typeof value.url === 'string' &&
  Number.isSafeInteger(value.recordCount) &&
  Number(value.recordCount) >= 0 &&
  typeof value.sourceSha256 === 'string' &&
  /^[a-f0-9]{64}$/.test(value.sourceSha256) &&
  value.geometryAvailable === false &&
  value.legalAnswerEligible === false &&
  value.requiresHumanReview === true

const isDistrict = (value: unknown): value is RuntimeCoverageDistrict =>
  isRecord(value) &&
  typeof value.regionId === 'string' &&
  typeof value.regionName === 'string' &&
  typeof value.districtId === 'string' &&
  typeof value.districtName === 'string' &&
  typeof value.boundaryFeatureId === 'string' &&
  PUBLISH_STAGES.has(value.publishStage as CoveragePublishStage) &&
  ANSWER_CAPABILITIES.has(value.answerCapability as CoverageAnswerCapability) &&
  typeof value.requiresHumanReview === 'boolean' &&
  Array.isArray(value.aliases) &&
  value.aliases.every(isAlias) &&
  (value.referenceData === undefined || isReferenceData(value.referenceData)) &&
  isBoundaryBBox(value.boundaryBBox) &&
  isBoundaryGeometry(value.boundaryGeometry)

export const parseRuntimeCoverageCatalog = (
  value: unknown,
): RuntimeCoverageCatalog => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.districts) ||
    !value.districts.every(isDistrict)
  ) {
    throw new Error('Invalid runtime coverage catalog')
  }
  return value as unknown as RuntimeCoverageCatalog
}

const bboxContainsLocation = (
  bbox: RuntimeCoverageDistrict['boundaryBBox'],
  location: [number, number],
) => {
  const [longitude, latitude] = location
  return (
    longitude >= bbox[0] &&
    longitude <= bbox[2] &&
    latitude >= bbox[1] &&
    latitude <= bbox[3]
  )
}

const isPointOnSegment = (
  location: [number, number],
  start: number[],
  end: number[],
) => {
  const [longitude, latitude] = location
  const [startLongitude, startLatitude] = start
  const [endLongitude, endLatitude] = end
  if (
    startLongitude === undefined ||
    startLatitude === undefined ||
    endLongitude === undefined ||
    endLatitude === undefined
  ) {
    return false
  }
  const cross =
    (longitude - startLongitude) * (endLatitude - startLatitude) -
    (latitude - startLatitude) * (endLongitude - startLongitude)
  if (Math.abs(cross) > 1e-10) {
    return false
  }
  return (
    longitude >= Math.min(startLongitude, endLongitude) &&
    longitude <= Math.max(startLongitude, endLongitude) &&
    latitude >= Math.min(startLatitude, endLatitude) &&
    latitude <= Math.max(startLatitude, endLatitude)
  )
}

const isLocationInRing = (
  location: [number, number],
  ring: number[][],
) => {
  const [longitude, latitude] = location
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[index]
    const end = ring[previous]
    if (!start || !end) {
      continue
    }
    if (isPointOnSegment(location, start, end)) {
      return true
    }
    const [startLongitude, startLatitude] = start
    const [endLongitude, endLatitude] = end
    if (
      startLongitude === undefined ||
      startLatitude === undefined ||
      endLongitude === undefined ||
      endLatitude === undefined
    ) {
      continue
    }
    const intersects =
      (startLatitude > latitude) !== (endLatitude > latitude) &&
      longitude <
        ((endLongitude - startLongitude) * (latitude - startLatitude)) /
          (endLatitude - startLatitude) +
          startLongitude
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

const isLocationInPolygon = (
  location: [number, number],
  rings: number[][][],
) => {
  const [outerRing, ...holes] = rings
  return Boolean(
    outerRing &&
      isLocationInRing(location, outerRing) &&
      !holes.some((hole) => isLocationInRing(location, hole)),
  )
}

export const isLocationInCoverageDistrict = (
  district: RuntimeCoverageDistrict,
  location: [number, number],
) => {
  if (!bboxContainsLocation(district.boundaryBBox, location)) {
    return false
  }
  const geometry = district.boundaryGeometry
  if (geometry.type === 'Polygon') {
    return isLocationInPolygon(location, geometry.coordinates)
  }
  return geometry.coordinates.some((polygon) =>
    isLocationInPolygon(location, polygon),
  )
}

export const findCoverageDistrictByLocation = (
  catalog: RuntimeCoverageCatalog,
  location: [number, number],
): RuntimeCoverageDistrict | null =>
  catalog.districts.find((district) =>
    isLocationInCoverageDistrict(district, location),
  ) ?? null

export const findCoverageDistrictById = (
  catalog: RuntimeCoverageCatalog,
  districtId: string,
): RuntimeCoverageDistrict | null =>
  catalog.districts.find((district) => district.districtId === districtId) ?? null

export const getRuntimeCoverageCatalogUrl = () => '/data/coverage.json'
