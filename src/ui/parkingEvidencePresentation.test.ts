import { describe, expect, it } from 'vitest'
import {
  getParkingSpaceBackedDetail,
  getParkingSpaceBackedReason,
  isParkingSpaceBackedGreenSegment,
} from './parkingEvidencePresentation'

describe('parkingEvidencePresentation', () => {
  it('detects parking-space-backed green segments and returns standard copy', () => {
    const segment = {
      allowedNow: 'PARK',
      tier: 'GREEN',
      sourceType: 'CURB',
      reasonCodes: ['PARKING_SPACE_EVIDENCE'],
    }

    expect(isParkingSpaceBackedGreenSegment(segment)).toBe(true)
    expect(getParkingSpaceBackedReason(segment)).toBe(
      'High-confidence parking backed by mapped official marked spaces',
    )
    expect(getParkingSpaceBackedDetail(segment)).toBe(
      'High-confidence parking backed by mapped official marked spaces along this curb.',
    )
  })

  it('adds stale-freshness context when old paint timestamps were rescued by parking spaces', () => {
    const segment = {
      allowedNow: 'PARK',
      tier: 'GREEN',
      sourceType: 'CURB',
      dataFreshnessDays: 900,
      reasonCodes: ['PARKING_SPACE_EVIDENCE'],
    }

    expect(getParkingSpaceBackedReason(segment)).toBe(
      'High-confidence parking backed by mapped official marked spaces despite an old curb-paint timestamp',
    )
    expect(getParkingSpaceBackedDetail(segment)).toBe(
      'High-confidence parking backed by mapped official marked spaces along this curb, even though the curb-paint timestamp is old.',
    )
  })

  it('does not claim parking-space evidence for inferred or non-green segments', () => {
    expect(
      getParkingSpaceBackedReason({
        allowedNow: 'PARK',
        tier: 'GREEN',
        sourceType: 'INFERRED',
        reasonCodes: ['PARKING_SPACE_EVIDENCE'],
      }),
    ).toBeNull()
    expect(
      getParkingSpaceBackedDetail({
        allowedNow: 'TEMP_STOP',
        tier: 'YELLOW',
        sourceType: 'CURB',
        reasonCodes: ['PARKING_SPACE_EVIDENCE'],
      }),
    ).toBeNull()
  })
})
