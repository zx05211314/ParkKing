import { describe, expect, it } from 'vitest'
import type { EvaluatedSegment } from '../../src/ui/types'
import { toQaCandidateRow } from './sampleQaCandidateRow'

const createSegment = (overrides: Partial<EvaluatedSegment> = {}): EvaluatedSegment =>
  ({
    id: 'seg-1',
    path: [
      [121.5, 25.05],
      [121.5005, 25.0505],
    ],
    rankScore: 0.81234,
    tier: 'RED',
    allowedNow: 'NO_STOP',
    curbMarking: 'RED',
    confidence: 'HIGH',
    sourceType: 'CURB',
    sourceReliability: 'HIGH',
    dataFreshnessDays: 12,
    finalConfidence: 'HIGH',
    coverageConfidence: 'HIGH',
    overrideConfidence: 'MED',
    parkingSpaceCount: 2,
    reasonCodes: ['RULE_A', 'OVERRIDE_APPLIED'],
    riskTags: [],
    zoneType: 'CURB',
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

describe('toQaCandidateRow', () => {
  it('formats midpoint coordinates, score, reasons, and maps url', () => {
    const row = toQaCandidateRow('demo', createSegment())

    expect(row).toMatchObject({
      districtId: 'demo',
      segmentId: 'seg-1',
      score: '0.8123',
      reviewBucket: 'ranked',
      tier: 'RED',
      allowedNow: 'NO_STOP',
      curbMarking: 'RED',
      sourceType: 'CURB',
      sourceReliability: 'HIGH',
      dataFreshnessDays: '12',
      finalConfidence: 'HIGH',
      parkingSpaceCount: '2',
      topReasons: ['RULE_A', 'OVERRIDE_APPLIED'],
      flags: ['override'],
      reviewSource: '',
      reviewStatus: '',
      reviewNote: '',
      createdAt: '',
    })
    expect(row.lat).toMatch(/^\d+\.\d{6}$/)
    expect(row.lon).toMatch(/^\d+\.\d{6}$/)
    expect(row.mapsUrl).toBe(`https://www.google.com/maps?q=${row.lat},${row.lon}`)
    expect(row.streetViewUrl).toBe(
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${row.lat},${row.lon}`,
    )
  })
})
