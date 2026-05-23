interface ParkingEvidenceSegmentLike {
  allowedNow?: string | null
  dataFreshnessDays?: number | null
  tier?: string | null
  sourceType?: string | null
  reasonCodes?: string[] | null
}

export const isParkingSpaceBackedGreenSegment = (
  segment: ParkingEvidenceSegmentLike | null | undefined,
) =>
  Boolean(
    segment &&
      segment.allowedNow === 'PARK' &&
      segment.tier === 'GREEN' &&
      segment.sourceType !== 'INFERRED' &&
      segment.reasonCodes?.includes('PARKING_SPACE_EVIDENCE'),
  )

const hasStaleFreshness = (segment: ParkingEvidenceSegmentLike) =>
  typeof segment.dataFreshnessDays === 'number' && segment.dataFreshnessDays > 365

export const getParkingSpaceBackedReason = (
  segment: ParkingEvidenceSegmentLike | null | undefined,
) => {
  if (!segment || !isParkingSpaceBackedGreenSegment(segment)) {
    return null
  }
  return hasStaleFreshness(segment)
    ? 'High-confidence parking backed by mapped official marked spaces despite an old curb-paint timestamp'
    : 'High-confidence parking backed by mapped official marked spaces'
}

export const getParkingSpaceBackedDetail = (
  segment: ParkingEvidenceSegmentLike | null | undefined,
) => {
  if (!segment || !isParkingSpaceBackedGreenSegment(segment)) {
    return null
  }
  return hasStaleFreshness(segment)
    ? 'High-confidence parking backed by mapped official marked spaces along this curb, even though the curb-paint timestamp is old.'
    : 'High-confidence parking backed by mapped official marked spaces along this curb.'
}
