import { describe, expect, it } from 'vitest'
import type { EvaluatedSegment } from '../../ui/types'
import {
  buildParkingAnswer,
  buildParkingAnswerFromSegments,
  getParkingAnswerFocusPoint,
} from './parkingAnswer'

const makeSegment = (
  overrides: Partial<EvaluatedSegment> & Pick<EvaluatedSegment, 'id' | 'path'>,
): EvaluatedSegment => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  path: overrides.path,
  curbMarking: overrides.curbMarking ?? 'YELLOW',
  confidence: overrides.confidence ?? 'HIGH',
  tier: overrides.tier ?? 'YELLOW',
  allowedNow: overrides.allowedNow ?? 'PARK',
  reasonCodes: overrides.reasonCodes ?? [],
  reasons: overrides.reasons ?? [],
  timeWindows: overrides.timeWindows ?? [],
  coverageConfidence: overrides.coverageConfidence ?? 'HIGH',
  overrideConfidence: overrides.overrideConfidence ?? 'HIGH',
  finalConfidence: overrides.finalConfidence ?? 'HIGH',
  sourceReliability: overrides.sourceReliability ?? 'HIGH',
  dataFreshnessDays: overrides.dataFreshnessDays ?? 3,
  sourceType: overrides.sourceType,
  source: overrides.source,
  riskTags: overrides.riskTags,
  parkingSpaceCount: overrides.parkingSpaceCount,
  signOverride: overrides.signOverride,
})

describe('parkingAnswer', () => {
  it('answers from the nearest curb instead of a farther better-ranked segment', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'red-nearest',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          tier: 'RED',
          allowedNow: 'NO_STOP',
          curbMarking: 'RED',
        }),
        makeSegment({
          id: 'green-farther',
          path: [
            [121.56, 25.031],
            [121.561, 25.031],
          ],
          tier: 'GREEN',
          allowedNow: 'PARK',
          parkingSpaceCount: 2,
        }),
      ],
      [121.5605, 25.03005],
      { searchRadiusMeters: 120 },
    )

    expect(answer.kind).toBe('NO_STOP')
    expect(answer.primary?.id).toBe('red-nearest')
    expect(answer.alternatives[0]?.id).toBe('green-farther')
    expect(answer.scope).toBe('NEAREST_MAPPED_CURB')
    expect(answer.evidence.kind).toBe('CURB_RULE')
    expect(answer.caveats).toContain(
      'No official marked parking-space evidence is mapped on the selected curb.',
    )
  })

  it('returns no data when no segment is inside the answer radius', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'too-far',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
        }),
      ],
      [121.57, 25.04],
      { searchRadiusMeters: 10 },
    )

    expect(answer.kind).toBe('NO_DATA')
    expect(answer.primary).toBeNull()
    expect(answer.label).toContain('within 10m')
    expect(answer.evidence.kind).toBe('NO_DATA')
    expect(answer.caveats).toEqual([])
  })

  it('excludes inferred candidates unless explicitly enabled', () => {
    const inferred = makeSegment({
      id: 'inferred-nearby',
      path: [
        [121.56, 25.03],
        [121.561, 25.03],
      ],
      sourceType: 'INFERRED',
      source: 'INFERRED_CENTERLINE_OFFSET',
    })
    const location: [number, number] = [121.5605, 25.03005]

    expect(
      buildParkingAnswer([inferred], location, { searchRadiusMeters: 25 }).kind,
    ).toBe('NO_DATA')
    expect(
      buildParkingAnswer([inferred], location, {
        searchRadiusMeters: 25,
        includeInferred: true,
      }).primary?.id,
    ).toBe('inferred-nearby')
    expect(
      buildParkingAnswer([inferred], location, {
        searchRadiusMeters: 25,
        includeInferred: true,
      }).evidence.kind,
    ).toBe('INFERRED')
  })

  it('can answer from raw segments without waiting for full district evaluation', () => {
    const answer = buildParkingAnswerFromSegments(
      [
        makeSegment({
          id: 'yellow-nearby',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          curbMarking: 'YELLOW',
        }),
      ],
      [121.5605, 25.03005],
      {
        nowHHMM: '21:00',
        zoneIndex: null,
        searchRadiusMeters: 25,
      },
    )

    expect(answer.kind).toBe('PARK')
    expect(answer.primary?.id).toBe('yellow-nearby')
    expect(answer.primary?.reasonCodes).toContain('RULE_YELLOW_NIGHT_PARK_POSSIBLE')
    expect(answer.evidence.kind).toBe('CURB_RULE')
  })

  it('surfaces official marked-space evidence on the exact answer', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'green-space-backed',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          tier: 'GREEN',
          allowedNow: 'PARK',
          parkingSpaceCount: 2,
          reasonCodes: ['PARKING_SPACE_EVIDENCE'],
        }),
      ],
      [121.5605, 25.03005],
      { searchRadiusMeters: 25 },
    )

    expect(answer.evidence).toMatchObject({
      kind: 'MARKED_SPACE',
      parkingSpaceCount: 2,
      caveats: [],
    })
    expect(answer.evidence.label).toContain('2 mapped official marked parking spaces')
  })

  it('surfaces stale and low-confidence answer caveats', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'stale-red',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          curbMarking: 'RED',
          tier: 'RED',
          allowedNow: 'NO_STOP',
          finalConfidence: 'LOW',
          reasonCodes: ['RULE_RED_NO_STOP', 'DATA_FRESHNESS_STALE'],
          reasons: ['red curb', 'data may be stale'],
        }),
      ],
      [121.5605, 25.03005],
      { searchRadiusMeters: 25 },
    )

    expect(answer.caveats).toContain(
      'Source curb data may be stale; verify current curb paint and signs on-site.',
    )
    expect(answer.caveats).toContain(
      'This answer has low confidence; verify the curb and posted signs before relying on it.',
    )
  })

  it('surfaces dataset-level sign override caveats', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'yellow',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
        }),
      ],
      [121.5605, 25.03005],
      {
        searchRadiusMeters: 25,
        reviewedSignOverridesCount: 0,
        appliedSignOverridesCount: 0,
      },
    )

    expect(answer.caveats[0]).toBe(
      'This dataset has no reviewed sign overrides; verify posted signs on-site.',
    )
  })

  it('exposes a stable focus point for the selected candidate', () => {
    const answer = buildParkingAnswer(
      [
        makeSegment({
          id: 'green',
          path: [
            [121.56, 25.03],
            [121.562, 25.03],
          ],
          tier: 'GREEN',
        }),
      ],
      [121.561, 25.03],
    )

    expect(getParkingAnswerFocusPoint(answer.primary)).toEqual([121.561, 25.03])
  })
})
