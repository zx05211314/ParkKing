import type { PaidCurbSpatialReferencePack } from '../data/paidCurbSpatialReference'

export type PaidCurbReferencePointStatus =
  | 'AVAILABLE'
  | 'EXCLUDED'
  | 'UNAVAILABLE'

export interface PaidCurbReferenceMapSelection {
  parkingSegmentId: string
  coordinates: [number, number]
}

export const getPaidCurbReferencePointStatus = (
  pack: PaidCurbSpatialReferencePack | null,
  parkingSegmentId: string,
): PaidCurbReferencePointStatus => {
  if (
    pack?.features.some(
      ({ properties }) =>
        properties.parkingSegmentId === parkingSegmentId,
    )
  ) {
    return 'AVAILABLE'
  }
  if (
    pack?.metadata.excluded.some(
      (entry) => entry.parkingSegmentId === parkingSegmentId,
    )
  ) {
    return 'EXCLUDED'
  }
  return 'UNAVAILABLE'
}

export const resolvePaidCurbReferenceMapSelection = (
  pack: PaidCurbSpatialReferencePack | null,
  parkingSegmentId: string | null,
): PaidCurbReferenceMapSelection | null => {
  if (!pack || !parkingSegmentId) {
    return null
  }
  const feature = pack.features.find(
    ({ properties }) =>
      properties.parkingSegmentId === parkingSegmentId,
  )
  if (!feature) {
    return null
  }
  const [longitude, latitude] = feature.geometry.coordinates
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90
  ) {
    return null
  }
  return {
    parkingSegmentId: feature.properties.parkingSegmentId,
    coordinates: [longitude, latitude],
  }
}
