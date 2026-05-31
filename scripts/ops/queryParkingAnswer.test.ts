import { describe, expect, it } from 'vitest'
import {
  parseQueryParkingAnswerArgs,
  renderQueryParkingAnswer,
  type QueryParkingAnswerResult,
} from './queryParkingAnswer'

describe('queryParkingAnswer', () => {
  it('parses location and answer options', () => {
    expect(
      parseQueryParkingAnswerArgs([
        'node',
        'queryParkingAnswer',
        '--datasetDir',
        'data/generated/xinyi',
        '--lng',
        '121.56',
        '--lat',
        '25.03',
        '--hhmm',
        '21:00',
        '--radius',
        '80',
        '--include-inferred',
        '--risk-mode',
        'aggressive',
        '--max-alternatives',
        '3',
        '--json',
      ]),
    ).toEqual({
      datasetDir: 'data/generated/xinyi',
      lng: 121.56,
      lat: 25.03,
      hhmm: '21:00',
      searchRadiusMeters: 80,
      includeInferred: true,
      riskMode: 'AGGRESSIVE',
      maxAlternatives: 3,
      json: true,
    })
  })

  it('renders the primary answer evidence', () => {
    const result: QueryParkingAnswerResult = {
      datasetDir: 'public/data/generated/xinyi',
      datasetHash: 'hash-1',
      hhmm: '21:00',
      evaluatedCount: 1,
      answer: {
        kind: 'PARK',
        label: 'Parking is allowed at the nearest mapped curb for this time.',
        scope: 'NEAREST_MAPPED_CURB',
        location: [121.56, 25.03],
        searchRadiusMeters: 60,
        includeInferred: false,
        primary: {
          id: 'seg-1',
          name: 'Segment 1',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          curbMarking: 'YELLOW',
          confidence: 'HIGH',
          tier: 'GREEN',
          allowedNow: 'PARK',
          reasonCodes: ['RULE_YELLOW_NIGHT_PARK_POSSIBLE'],
          reasons: ['night parking allowed'],
          timeWindows: [],
          coverageConfidence: 'HIGH',
          overrideConfidence: 'HIGH',
          finalConfidence: 'HIGH',
          sourceReliability: 'HIGH',
          dataFreshnessDays: 3,
          distanceMeters: 4.4,
          rankScore: 6,
          parkingSpaceCount: 1,
        },
        alternatives: [],
        evidence: {
          kind: 'MARKED_SPACE',
          label: '1 mapped official marked parking space near this curb.',
          parkingSpaceCount: 1,
          caveats: [],
        },
        caveats: [],
      },
      trustSummary: {
        trustLabel: 'High trust',
        trustTone: 'strong',
        nextStep: 'Likely parkable if the current curb signs still match.',
        evidenceStrength: '1 mapped official marked parking space near this curb.',
        fieldChecks: [
          'Confirm the posted curb signs still allow parking at this time.',
        ],
      },
    }

    expect(renderQueryParkingAnswer(result)).toContain('Parking answer: PARK')
    expect(renderQueryParkingAnswer(result)).toContain('Trust: High trust (strong)')
    expect(renderQueryParkingAnswer(result)).toContain(
      'Next step: Likely parkable if the current curb signs still match.',
    )
    expect(renderQueryParkingAnswer(result)).toContain(
      'Evidence strength: 1 mapped official marked parking space near this curb.',
    )
    expect(renderQueryParkingAnswer(result)).toContain('Nearest segment: seg-1 (4m)')
    expect(renderQueryParkingAnswer(result)).toContain(
      'Evidence: 1 mapped official marked parking space near this curb.',
    )
    expect(renderQueryParkingAnswer(result)).toContain(
      'Field checks: Confirm the posted curb signs still allow parking at this time.',
    )
    expect(renderQueryParkingAnswer(result)).toContain('Reasons: night parking allowed')
  })
})
