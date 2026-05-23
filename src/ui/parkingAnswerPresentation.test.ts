import { describe, expect, it } from 'vitest'
import type { ParkingAnswer } from '../domain/answers/parkingAnswer'
import { buildParkingAnswerTrustSummary } from './parkingAnswerPresentation'

const baseAnswer: ParkingAnswer = {
  kind: 'PARK',
  label: 'Parking is allowed at the nearest mapped curb for this time.',
  scope: 'NEAREST_MAPPED_CURB',
  location: [121.56, 25.03],
  searchRadiusMeters: 60,
  includeInferred: false,
  primary: {
    id: 'seg-1',
    name: 'Civic West',
    tier: 'GREEN',
    allowedNow: 'PARK',
    curbMarking: 'YELLOW',
    confidence: 'HIGH',
    path: [
      [121.56, 25.03],
      [121.561, 25.03],
    ],
    reasonCodes: ['PARKING_SPACE_EVIDENCE'],
    reasons: ['official marked parking spaces mapped along this curb'],
    timeWindows: [],
    coverageConfidence: 'HIGH',
    overrideConfidence: 'HIGH',
    finalConfidence: 'HIGH',
    sourceReliability: 'HIGH',
    dataFreshnessDays: 3,
    parkingSpaceCount: 3,
    distanceMeters: 0,
    rankScore: 10,
  },
  alternatives: [],
  evidence: {
    kind: 'MARKED_SPACE',
    label: '3 mapped official marked parking spaces near this curb.',
    parkingSpaceCount: 3,
    caveats: [],
  },
  caveats: [],
}

describe('buildParkingAnswerTrustSummary', () => {
  it('labels high-confidence marked-space parking as high trust with field checks', () => {
    const summary = buildParkingAnswerTrustSummary(baseAnswer)

    expect(summary.trustLabel).toBe('High trust')
    expect(summary.trustTone).toBe('strong')
    expect(summary.nextStep).toBe(
      'Likely parkable if the current curb signs still match.',
    )
    expect(summary.fieldChecks).toContain(
      'Confirm the posted curb signs still allow parking at this time.',
    )
    expect(summary.fieldChecks).toContain(
      'Confirm the marked space still exists and is not blocked by temporary signs.',
    )
  })

  it('requires sign checks for curb-rule-only parking', () => {
    const summary = buildParkingAnswerTrustSummary({
      ...baseAnswer,
      evidence: {
        kind: 'CURB_RULE',
        label: 'Curb rule answer; no official marked-space evidence is mapped on this curb.',
        parkingSpaceCount: 0,
        caveats: [
          'No official marked parking-space evidence is mapped on the selected curb.',
        ],
      },
      caveats: [
        'No official marked parking-space evidence is mapped on the selected curb.',
      ],
    })

    expect(summary.trustLabel).toBe('Sign check needed')
    expect(summary.trustTone).toBe('caution')
    expect(summary.fieldChecks).toContain(
      'Check for posted sign overrides because no official marked-space evidence is mapped.',
    )
  })

  it('keeps no-stop answers blocked even when confidence is low', () => {
    const summary = buildParkingAnswerTrustSummary({
      ...baseAnswer,
      kind: 'NO_STOP',
      primary: {
        ...baseAnswer.primary!,
        allowedNow: 'NO_STOP',
        tier: 'RED',
        finalConfidence: 'LOW',
        reasonCodes: ['RULE_RED_NO_STOP'],
      },
      evidence: {
        kind: 'CURB_RULE',
        label: 'Curb rule answer; no official marked-space evidence is mapped on this curb.',
        parkingSpaceCount: 0,
        caveats: [],
      },
    })

    expect(summary.trustLabel).toBe('Blocked, low-confidence map')
    expect(summary.trustTone).toBe('blocked')
    expect(summary.nextStep).toBe('Do not stop or park at this pinned curb.')
    expect(summary.fieldChecks).toContain(
      'Choose another curb; this pinned point is mapped as no-stop or no-parking.',
    )
  })

  it('treats no-data answers as no answer', () => {
    const summary = buildParkingAnswerTrustSummary({
      ...baseAnswer,
      kind: 'NO_DATA',
      primary: null,
      evidence: {
        kind: 'NO_DATA',
        label: 'No mapped curb or parking-space evidence matched this pinned point.',
        parkingSpaceCount: 0,
        caveats: [],
      },
      caveats: [],
    })

    expect(summary.trustLabel).toBe('No answer')
    expect(summary.trustTone).toBe('unknown')
    expect(summary.fieldChecks).toContain(
      'Do not infer legality from an empty map result.',
    )
  })
})
