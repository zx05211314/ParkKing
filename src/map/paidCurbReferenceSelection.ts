export interface PaidCurbReferencePointSelection {
  parkingSegmentId: string
  districtId: string
  description: string
  fareDescription: string | null
  hasChargingPoint: boolean
  coordinates: [number, number]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCoordinates = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  Math.abs(value[0]) <= 180 &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  Math.abs(value[1]) <= 90

export const parsePaidCurbReferencePointSelection = (
  value: unknown,
): PaidCurbReferencePointSelection | null => {
  if (!isRecord(value) || !isRecord(value.geometry) || !isRecord(value.properties)) {
    return null
  }
  const { geometry, properties } = value
  if (
    geometry.type !== 'Point' ||
    !isCoordinates(geometry.coordinates) ||
    properties.evidenceKind !== 'PAID_CURB_SEGMENT' ||
    properties.geometryPrecision !== 'REPRESENTATIVE_POINT' ||
    properties.legalAnswerEligible !== false ||
    typeof properties.parkingSegmentId !== 'string' ||
    properties.parkingSegmentId.length === 0 ||
    typeof properties.districtId !== 'string' ||
    properties.districtId.length === 0 ||
    typeof properties.description !== 'string' ||
    (properties.fareDescription !== undefined &&
      properties.fareDescription !== null &&
      typeof properties.fareDescription !== 'string') ||
    typeof properties.hasChargingPoint !== 'boolean'
  ) {
    return null
  }

  return {
    parkingSegmentId: properties.parkingSegmentId,
    districtId: properties.districtId,
    description: properties.description,
    fareDescription:
      typeof properties.fareDescription === 'string'
        ? properties.fareDescription
        : null,
    hasChargingPoint: properties.hasChargingPoint,
    coordinates: geometry.coordinates,
  }
}
