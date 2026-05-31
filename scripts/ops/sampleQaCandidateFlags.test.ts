import { describe, expect, it } from 'vitest'
import type { EvaluatedSegment } from '../../src/ui/types'
import { toFlags, toTopReasons } from './sampleQaCandidateFlags'

const createSegment = (overrides: Partial<EvaluatedSegment> = {}): EvaluatedSegment =>
  ({
    id: 'seg-1',
    path: [
      [121.5, 25.05],
      [121.5005, 25.0505],
    ],
    rankScore: 0.81234,
    reasonCodes: [],
    riskTags: [],
    zoneType: 'INFERRED',
    sideOfStreet: 'north',
    districtId: 'demo',
    districtName: 'Demo',
    primaryRuleLabel: null,
    displayRuleLabel: null,
    currentRuleLabel: null,
    distanceMeters: 50,
    scoreBreakdown: [],
    availabilityWindow: null,
    restrictionWindow: null,
    timeLimitMinutes: null,
    signs: [],
    timeRanges: [],
    source: 'test',
    sourceType: 'INFERRED',
    restrictions: [],
    legalConfidence: null,
    dataQuality: null,
    needsReview: false,
    riskLevel: 'MEDIUM',
    estimatedWalkMinutes: null,
    estimatedDriveMinutes: null,
    parkingAngle: null,
    curbUses: [],
    ...overrides,
  }) as EvaluatedSegment

describe('sampleQaCandidateFlags', () => {
  it('deduplicates and limits top reasons', () => {
    expect(
      toTopReasons(
        createSegment({
          reasonCodes: [
            'ZONE_HYDRANT',
            'ZONE_HYDRANT',
            'ZONE_CROSSWALK',
            'OVERRIDE_APPLIED',
            'DATA_FRESHNESS_UNKNOWN',
          ],
        }),
      ),
    ).toEqual(['ZONE_HYDRANT', 'ZONE_CROSSWALK', 'OVERRIDE_APPLIED'])
  })

  it('derives sorted qa flags from reason codes, risk tags, and inferred status', () => {
    expect(
      toFlags(
        createSegment({
          reasonCodes: [
            'ZONE_HYDRANT',
            'ZONE_CROSSWALK',
            'OVERRIDE_APPLIED',
            'DATA_FRESHNESS_UNKNOWN',
          ],
          riskTags: ['MAJOR_ROAD', 'SCHOOL'],
        }),
      ),
    ).toEqual([
      'hydrant',
      'crosswalk',
      'override',
      'inferred',
      'freshnessUnknown',
      'risk:MAJOR_ROAD',
      'risk:SCHOOL',
    ])
  })
})
