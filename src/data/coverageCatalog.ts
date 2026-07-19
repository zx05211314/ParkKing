import type { MultiPolygon, Polygon } from 'geojson'
import { COVERAGE_AREA_BOUNDARY_KIND } from './coverageAreaBoundary'

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
  boundary?: RuntimeCoverageAliasBoundary
}

export interface RuntimeCoverageAliasBoundary {
  kind: typeof COVERAGE_AREA_BOUNDARY_KIND
  url: string
  dataSha256: string
  sourceSha256: string
  memberFeatureIds: string[]
  parkingAnswerOwnerDistrictId: string
  boundaryBBox: [number, number, number, number]
  boundaryGeometry: Polygon | MultiPolygon
}

export interface RuntimeCoverageReferenceData {
  kind: 'PAID_CURB_SEGMENT_TEXT'
  url: string
  recordCount: number
  sourceSha256: string
  geometryAvailable: false
  legalAnswerEligible: false
  requiresHumanReview: true
  spatialReference?: RuntimeCoverageSpatialReferenceData
}

export interface RuntimeCoverageSpatialReferenceData {
  kind: 'PAID_CURB_SEGMENT'
  url: string
  dataSha256: string
  sourceSha256: string
  reviewSha256: string
  featureCount: number
  excludedFeatureCount: number
  geometryPrecision: 'REPRESENTATIVE_POINT'
  legalAnswerEligible: false
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
): value is RuntimeCoverageDistrict['boundaryBBox'] => {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every(isFiniteNumber)
  ) {
    return false
  }
  const [west, south, east, north] = value
  return west <= east && south <= north
}

const isBoundaryGeometry = (
  value: unknown,
): value is RuntimeCoverageDistrict['boundaryGeometry'] =>
  isRecord(value) &&
  (value.type === 'Polygon' || value.type === 'MultiPolygon') &&
  Array.isArray(value.coordinates)

const isAliasBoundary = (
  value: unknown,
): value is RuntimeCoverageAliasBoundary =>
  isRecord(value) &&
  value.kind === COVERAGE_AREA_BOUNDARY_KIND &&
  typeof value.url === 'string' &&
  value.url.startsWith('/data/reference/') &&
  /^[a-f0-9]{64}$/.test(String(value.dataSha256)) &&
  /^[a-f0-9]{64}$/.test(String(value.sourceSha256)) &&
  Array.isArray(value.memberFeatureIds) &&
  value.memberFeatureIds.length > 0 &&
  value.memberFeatureIds.every(
    (entry) => typeof entry === 'string' && entry.length > 0,
  ) &&
  new Set(value.memberFeatureIds).size === value.memberFeatureIds.length &&
  typeof value.parkingAnswerOwnerDistrictId === 'string' &&
  value.parkingAnswerOwnerDistrictId.length > 0 &&
  isBoundaryBBox(value.boundaryBBox) &&
  isBoundaryGeometry(value.boundaryGeometry)

const isAlias = (value: unknown): value is RuntimeCoverageAlias => {
  if (
    !isRecord(value) ||
    typeof value.areaId !== 'string' ||
    typeof value.areaName !== 'string' ||
    value.coverageMode !== 'parent-district' ||
    typeof value.standaloneBoundaryRequired !== 'boolean'
  ) {
    return false
  }
  return value.standaloneBoundaryRequired
    ? value.boundary === undefined
    : isAliasBoundary(value.boundary)
}

const isSpatialReferenceData = (
  value: unknown,
): value is RuntimeCoverageSpatialReferenceData =>
  isRecord(value) &&
  value.kind === 'PAID_CURB_SEGMENT' &&
  typeof value.url === 'string' &&
  /^[a-f0-9]{64}$/.test(String(value.dataSha256)) &&
  /^[a-f0-9]{64}$/.test(String(value.sourceSha256)) &&
  /^[a-f0-9]{64}$/.test(String(value.reviewSha256)) &&
  Number.isSafeInteger(value.featureCount) &&
  Number(value.featureCount) >= 0 &&
  Number.isSafeInteger(value.excludedFeatureCount) &&
  Number(value.excludedFeatureCount) >= 0 &&
  value.geometryPrecision === 'REPRESENTATIVE_POINT' &&
  value.legalAnswerEligible === false

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
  value.requiresHumanReview === true &&
  (value.spatialReference === undefined ||
    isSpatialReferenceData(value.spatialReference))

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
  (value.aliases as RuntimeCoverageAlias[]).every(
    (alias) =>
      !alias.boundary ||
      alias.boundary.parkingAnswerOwnerDistrictId === value.districtId,
  ) &&
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
  bbox: [number, number, number, number],
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
) =>
  isLocationInCoverageGeometry(
    district.boundaryBBox,
    district.boundaryGeometry,
    location,
  )

const isLocationInCoverageGeometry = (
  boundaryBBox: [number, number, number, number],
  boundaryGeometry: Polygon | MultiPolygon,
  location: [number, number],
) => {
  if (!bboxContainsLocation(boundaryBBox, location)) {
    return false
  }
  if (boundaryGeometry.type === 'Polygon') {
    return isLocationInPolygon(location, boundaryGeometry.coordinates)
  }
  return boundaryGeometry.coordinates.some((polygon) =>
    isLocationInPolygon(location, polygon),
  )
}

export const isLocationInCoverageAlias = (
  alias: RuntimeCoverageAlias,
  location: [number, number],
) =>
  alias.boundary
    ? isLocationInCoverageGeometry(
        alias.boundary.boundaryBBox,
        alias.boundary.boundaryGeometry,
        location,
      )
    : false

export interface RuntimeCoverageAliasMatch {
  district: RuntimeCoverageDistrict
  alias: RuntimeCoverageAlias
}

export const findCoverageAliasByLocation = (
  catalog: RuntimeCoverageCatalog,
  location: [number, number],
): RuntimeCoverageAliasMatch | null => {
  for (const district of catalog.districts) {
    if (!isLocationInCoverageDistrict(district, location)) {
      continue
    }
    const alias = district.aliases.find((candidate) =>
      isLocationInCoverageAlias(candidate, location),
    )
    if (alias) {
      return { district, alias }
    }
  }
  return null
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
