import { describe, expect, it, vi } from 'vitest'
import {
  createCachedPreparedParkingAnswerLoader,
  createParkingAnswerServiceApi,
} from './parkingAnswerServiceApi'
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

  it('caches prepared dataset loads across locations and times', async () => {
    const loadPreparedSegmentsForAnswer = vi.fn().mockResolvedValue({
      datasetHash: 'hash-1',
      segments: [],
      zoneIndex: null,
      reviewedSignOverridesCount: 7,
      appliedSignOverridesCount: 7,
    })
    const service = createParkingAnswerServiceApi({
      loadPreparedSegmentsForAnswer,
    })
    const baseRequest = {
      district: 'xinyi',
      datasetDir: 'public/data/generated/xinyi',
    }

    await service.answer({
      ...baseRequest,
      lng: 121.56,
      lat: 25.03,
      hhmm: '21:01',
    })
    await service.answer({
      ...baseRequest,
      lng: 121.57,
      lat: 25.04,
      hhmm: '21:02',
    })

    expect(loadPreparedSegmentsForAnswer).toHaveBeenCalledTimes(1)
    expect(loadPreparedSegmentsForAnswer).toHaveBeenCalledWith(
      'public/data/generated/xinyi',
    )
  })

  it('re-evaluates cached prepared segments for the requested time', async () => {
    const loadPreparedSegmentsForAnswer = vi.fn().mockResolvedValue({
      datasetHash: 'hash-1',
      segments: [
        {
          id: 'seg-1',
          name: 'Yellow curb',
          curbMarking: 'YELLOW',
          confidence: 'HIGH',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          sourceReliability: 'HIGH',
          dataFreshnessDays: 1,
        },
      ],
      zoneIndex: null,
      reviewedSignOverridesCount: 1,
      appliedSignOverridesCount: 1,
    })
    const service = createParkingAnswerServiceApi({
      loadPreparedSegmentsForAnswer,
    })
    const request = {
      district: 'xinyi',
      datasetDir: 'public/data/generated/xinyi',
      lng: 121.56,
      lat: 25.03,
    }

    const day = await service.answer({ ...request, hhmm: '13:37' })
    const night = await service.answer({ ...request, hhmm: '21:42' })

    expect(day.answer.kind).toBe('TEMP_STOP')
    expect(night.answer.kind).toBe('PARK')
    expect(day.evaluatedCount).toBe(1)
    expect(night.evaluatedCount).toBe(1)
    expect(loadPreparedSegmentsForAnswer).toHaveBeenCalledTimes(1)
  })

  it('evicts the least recently used prepared district', async () => {
    const loadPreparedSegmentsForAnswer = vi.fn().mockResolvedValue({
      datasetHash: 'hash-1',
      segments: [],
      zoneIndex: null,
      reviewedSignOverridesCount: 1,
      appliedSignOverridesCount: 1,
    })
    const loadCached = createCachedPreparedParkingAnswerLoader(
      loadPreparedSegmentsForAnswer,
      1,
    )

    await loadCached('public/data/generated/xinyi')
    await loadCached('public/data/generated/daan')
    await loadCached('public/data/generated/xinyi')

    expect(loadPreparedSegmentsForAnswer).toHaveBeenCalledTimes(3)
  })
})
