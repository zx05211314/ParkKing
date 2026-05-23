import { describe, expect, it, vi } from 'vitest'
import { createParkingAnswerServiceApi } from './parkingAnswerServiceApi'
import type { QueryParkingAnswerResult } from './queryParkingAnswer'

const queryResult: QueryParkingAnswerResult = {
  datasetDir: 'public/data/generated/xinyi',
  datasetHash: 'hash-1',
  hhmm: '21:00',
  evaluatedCount: 0,
  answer: {
    kind: 'NO_DATA',
    label: 'No mapped curb segment found within 60m.',
    scope: 'NEAREST_MAPPED_CURB',
    location: [121.56, 25.03],
    searchRadiusMeters: 60,
    includeInferred: false,
    primary: null,
    alternatives: [],
    evidence: {
      kind: 'NO_DATA',
      label: 'No mapped curb or parking-space evidence matched this pinned point.',
      parkingSpaceCount: 0,
      caveats: [],
    },
    caveats: [],
  },
  trustSummary: {
    trustLabel: 'No answer',
    trustTone: 'unknown',
    evidenceStrength: 'No mapped curb or marked-space evidence matched this pin.',
    nextStep: 'Move the pin or use a nearby ranked target before deciding.',
    fieldChecks: [],
  },
}

describe('createParkingAnswerServiceApi', () => {
  it('wraps queryParkingAnswer with schema and district metadata', async () => {
    const queryParkingAnswer = vi.fn().mockResolvedValue(queryResult)
    const service = createParkingAnswerServiceApi({ queryParkingAnswer })

    await expect(
      service.answer({
        district: 'xinyi',
        datasetDir: 'public/data/generated/xinyi',
        lng: 121.56,
        lat: 25.03,
        hhmm: '21:00',
        searchRadiusMeters: 90,
        includeInferred: true,
        riskMode: 'NEUTRAL',
        maxAlternatives: 2,
      }),
    ).resolves.toEqual({
      schemaVersion: 1,
      district: 'xinyi',
      ...queryResult,
    })

    expect(queryParkingAnswer).toHaveBeenCalledWith({
      datasetDir: 'public/data/generated/xinyi',
      lng: 121.56,
      lat: 25.03,
      hhmm: '21:00',
      searchRadiusMeters: 90,
      includeInferred: true,
      riskMode: 'NEUTRAL',
      maxAlternatives: 2,
    })
  })

  it('caches evaluated dataset loads by dataset and time', async () => {
    const loadEvaluatedSegmentsForAnswer = vi.fn().mockResolvedValue({
      datasetHash: 'hash-1',
      segments: [],
      reviewedSignOverridesCount: 7,
      appliedSignOverridesCount: 7,
    })
    const service = createParkingAnswerServiceApi({
      loadEvaluatedSegmentsForAnswer,
    })
    const baseRequest = {
      district: 'xinyi',
      datasetDir: 'public/data/generated/xinyi',
      hhmm: '21:00',
    }

    await service.answer({
      ...baseRequest,
      lng: 121.56,
      lat: 25.03,
    })
    await service.answer({
      ...baseRequest,
      lng: 121.57,
      lat: 25.04,
    })

    expect(loadEvaluatedSegmentsForAnswer).toHaveBeenCalledTimes(1)
    expect(loadEvaluatedSegmentsForAnswer).toHaveBeenCalledWith(
      'public/data/generated/xinyi',
      '21:00',
    )
  })
})
