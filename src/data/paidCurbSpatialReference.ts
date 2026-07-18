import type { Feature, FeatureCollection, Point } from 'geojson'

export const PAID_CURB_SPATIAL_REFERENCE_KIND = 'PAID_CURB_SEGMENT' as const
export const PAID_CURB_SPATIAL_REFERENCE_PRECISION =
  'REPRESENTATIVE_POINT' as const

export interface PaidCurbSpatialReferenceProperties {
  evidenceKind: typeof PAID_CURB_SPATIAL_REFERENCE_KIND
  parkingSegmentId: string
  districtId: string
  description: string
  fareDescription: string | null
  hasChargingPoint: boolean
  geometryPrecision: typeof PAID_CURB_SPATIAL_REFERENCE_PRECISION
  legalAnswerEligible: false
  sourceDataset: 'TDX OnStreet ParkingSegment v1'
}

export interface PaidCurbSpatialReferenceExclusion {
  parkingSegmentId: string
  reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY'
}

export interface PaidCurbSpatialReferencePack
  extends FeatureCollection<Point, PaidCurbSpatialReferenceProperties> {
  metadata: {
    schemaVersion: 1
    districtId: string
    boundaryFeatureId: string
    evidenceKind: typeof PAID_CURB_SPATIAL_REFERENCE_KIND
    sourceDataset: 'TDX OnStreet ParkingSegment v1'
    sourceSha256: string
    sourceFeatureCount: number
    reviewSha256: string
    reviewRecordCount: number
    featureCount: number
    excludedFeatureCount: number
    excluded: PaidCurbSpatialReferenceExclusion[]
    geometryPrecision: typeof PAID_CURB_SPATIAL_REFERENCE_PRECISION
    legalAnswerEligible: false
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSha256 = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  Math.abs(value[0]) <= 180 &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  Math.abs(value[1]) <= 90

const isProperties = (
  value: unknown,
): value is PaidCurbSpatialReferenceProperties =>
  isRecord(value) &&
  value.evidenceKind === PAID_CURB_SPATIAL_REFERENCE_KIND &&
  typeof value.parkingSegmentId === 'string' &&
  value.parkingSegmentId.length > 0 &&
  typeof value.districtId === 'string' &&
  value.districtId.length > 0 &&
  typeof value.description === 'string' &&
  (value.fareDescription === null ||
    typeof value.fareDescription === 'string') &&
  typeof value.hasChargingPoint === 'boolean' &&
  value.geometryPrecision === PAID_CURB_SPATIAL_REFERENCE_PRECISION &&
  value.legalAnswerEligible === false &&
  value.sourceDataset === 'TDX OnStreet ParkingSegment v1'

const isFeature = (
  value: unknown,
): value is Feature<Point, PaidCurbSpatialReferenceProperties> =>
  isRecord(value) &&
  value.type === 'Feature' &&
  isRecord(value.geometry) &&
  value.geometry.type === 'Point' &&
  isCoordinate(value.geometry.coordinates) &&
  isProperties(value.properties)

const isExclusion = (
  value: unknown,
): value is PaidCurbSpatialReferenceExclusion =>
  isRecord(value) &&
  typeof value.parkingSegmentId === 'string' &&
  value.parkingSegmentId.length > 0 &&
  value.reason === 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY'

export const parsePaidCurbSpatialReferencePack = (
  value: unknown,
): PaidCurbSpatialReferencePack => {
  if (
    !isRecord(value) ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features) ||
    !value.features.every(isFeature) ||
    !isRecord(value.metadata)
  ) {
    throw new Error('Invalid paid-curb spatial reference pack')
  }
  const metadata = value.metadata
  if (
    metadata.schemaVersion !== 1 ||
    typeof metadata.districtId !== 'string' ||
    metadata.districtId.length === 0 ||
    typeof metadata.boundaryFeatureId !== 'string' ||
    metadata.boundaryFeatureId.length === 0 ||
    metadata.evidenceKind !== PAID_CURB_SPATIAL_REFERENCE_KIND ||
    metadata.sourceDataset !== 'TDX OnStreet ParkingSegment v1' ||
    !isSha256(metadata.sourceSha256) ||
    !Number.isSafeInteger(metadata.sourceFeatureCount) ||
    Number(metadata.sourceFeatureCount) < value.features.length ||
    !isSha256(metadata.reviewSha256) ||
    !Number.isSafeInteger(metadata.reviewRecordCount) ||
    Number(metadata.reviewRecordCount) < 0 ||
    !Number.isSafeInteger(metadata.featureCount) ||
    metadata.featureCount !== value.features.length ||
    !Number.isSafeInteger(metadata.excludedFeatureCount) ||
    !Array.isArray(metadata.excluded) ||
    metadata.excludedFeatureCount !== metadata.excluded.length ||
    !metadata.excluded.every(isExclusion) ||
    metadata.reviewRecordCount !==
      metadata.featureCount + metadata.excludedFeatureCount ||
    metadata.geometryPrecision !== PAID_CURB_SPATIAL_REFERENCE_PRECISION ||
    metadata.legalAnswerEligible !== false
  ) {
    throw new Error('Invalid paid-curb spatial reference metadata')
  }

  const features = value.features as Array<
    Feature<Point, PaidCurbSpatialReferenceProperties>
  >
  if (
    features.some(
      ({ properties }) => properties.districtId !== metadata.districtId,
    )
  ) {
    throw new Error('Paid-curb spatial feature district does not match metadata')
  }
  const featureIds = features.map(
    ({ properties }) => properties.parkingSegmentId,
  )
  const excludedIds = metadata.excluded.map(
    ({ parkingSegmentId }) => parkingSegmentId,
  )
  if (
    new Set(featureIds).size !== featureIds.length ||
    new Set(excludedIds).size !== excludedIds.length ||
    excludedIds.some((id) => featureIds.includes(id))
  ) {
    throw new Error('Paid-curb spatial reference IDs are not unique')
  }

  return value as unknown as PaidCurbSpatialReferencePack
}

export const getTaoyuanDistrictPaidCurbSpatialReferenceUrl = () =>
  '/data/reference/taoyuan-district-paid-curb-points.geojson'
