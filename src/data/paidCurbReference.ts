export const PAID_CURB_REFERENCE_KIND = 'PAID_CURB_SEGMENT_TEXT' as const

export interface PaidCurbReferenceRecord {
  parkingSegmentId: string
  description: string
  fareDescription: string | null
  hasChargingPoint: boolean
  sourceTownName: string
}

export interface PaidCurbReferenceDistrict {
  districtId: string
  districtName: string
  boundaryFeatureId: string
  recordCount: number
  records: PaidCurbReferenceRecord[]
}

export interface PaidCurbReferencePack {
  schemaVersion: 1
  regionId: 'taoyuan'
  evidenceKind: typeof PAID_CURB_REFERENCE_KIND
  geometryAvailable: false
  legalAnswerEligible: false
  requiresHumanReview: true
  source: {
    dataset: 'Taoyuan City curb parking segment list'
    relativePath: string
    sha256: string
    recordCount: number
  }
  districts: PaidCurbReferenceDistrict[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isReferenceRecord = (value: unknown): value is PaidCurbReferenceRecord =>
  isRecord(value) &&
  typeof value.parkingSegmentId === 'string' &&
  typeof value.description === 'string' &&
  (value.fareDescription === null ||
    typeof value.fareDescription === 'string') &&
  typeof value.hasChargingPoint === 'boolean' &&
  typeof value.sourceTownName === 'string'

const isReferenceDistrict = (
  value: unknown,
): value is PaidCurbReferenceDistrict =>
  isRecord(value) &&
  typeof value.districtId === 'string' &&
  typeof value.districtName === 'string' &&
  typeof value.boundaryFeatureId === 'string' &&
  Number.isSafeInteger(value.recordCount) &&
  Number(value.recordCount) >= 0 &&
  Array.isArray(value.records) &&
  value.records.length === value.recordCount &&
  value.records.every(isReferenceRecord)

export const parsePaidCurbReferencePack = (
  value: unknown,
): PaidCurbReferencePack => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.regionId !== 'taoyuan' ||
    value.evidenceKind !== PAID_CURB_REFERENCE_KIND ||
    value.geometryAvailable !== false ||
    value.legalAnswerEligible !== false ||
    value.requiresHumanReview !== true ||
    !isRecord(value.source) ||
    value.source.dataset !== 'Taoyuan City curb parking segment list' ||
    typeof value.source.relativePath !== 'string' ||
    !/^[a-f0-9]{64}$/.test(String(value.source.sha256)) ||
    !Number.isSafeInteger(value.source.recordCount) ||
    Number(value.source.recordCount) < 0 ||
    !Array.isArray(value.districts) ||
    !value.districts.every(isReferenceDistrict)
  ) {
    throw new Error('Invalid paid-curb reference pack')
  }

  const total = value.districts.reduce(
    (sum, district) => sum + district.recordCount,
    0,
  )
  if (total !== value.source.recordCount) {
    throw new Error('Paid-curb reference pack record count does not match source')
  }

  const districtIds = value.districts.map(({ districtId }) => districtId)
  const boundaryIds = value.districts.map(
    ({ boundaryFeatureId }) => boundaryFeatureId,
  )
  const recordIds = value.districts.flatMap(({ records }) =>
    records.map(({ parkingSegmentId }) => parkingSegmentId),
  )
  if (new Set(districtIds).size !== districtIds.length) {
    throw new Error('Paid-curb reference pack contains duplicate district IDs')
  }
  if (new Set(boundaryIds).size !== boundaryIds.length) {
    throw new Error('Paid-curb reference pack contains duplicate boundary IDs')
  }
  if (new Set(recordIds).size !== recordIds.length) {
    throw new Error('Paid-curb reference pack contains duplicate segment IDs')
  }

  return value as unknown as PaidCurbReferencePack
}

export const getPaidCurbReferenceUrl = () =>
  '/data/reference/taoyuan-paid-curb.json'
