import { describe, expect, it, vi } from 'vitest'
import {
  buildParkingAnswerReadinessUrl,
  buildParkingAnswerApiUrl,
  checkParkingAnswerReadiness,
  getParkingAnswerApiRuntimeAvailability,
  ParkingAnswerReadinessError,
  PARKING_ANSWER_API_UNAVAILABLE_MESSAGE,
  resolveParkingAnswerApiConfig,
  searchParkingAnswer,
} from './parkingAnswer'

describe('parkingAnswer API client', () => {
  it('resolves the endpoint from Vite env and builds query params', () => {
    const config = resolveParkingAnswerApiConfig({
      VITE_PARKING_ANSWER_URL: 'https://api.example.com/parking-answer',
    })

    expect(config.primary.endpoint).toBe('https://api.example.com/parking-answer')
    expect(
      buildParkingAnswerApiUrl(
        {
          district: 'xinyi',
          location: [121.56, 25.03],
          hhmm: '21:00',
          searchRadiusMeters: 25,
          includeInferred: true,
          riskMode: 'NEUTRAL',
          maxAlternatives: 2,
        },
        config.primary,
      ),
    ).toBe(
      'https://api.example.com/parking-answer?district=xinyi&location=121.56%2C25.03&hhmm=21%3A00&radius=25&includeInferred=true&riskMode=NEUTRAL&maxAlternatives=2',
    )
  })

  it('builds readiness URLs by appending ready to the answer endpoint', () => {
    expect(
      buildParkingAnswerReadinessUrl({
        endpoint: 'https://api.example.com/api/parking-answer/',
      }),
    ).toBe('https://api.example.com/api/parking-answer/ready')
  })

  it('marks implicit same-origin API unavailable on non-localhost deployments', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example',
        origin: 'https://parkking.example',
      },
    })

    expect(
      getParkingAnswerApiRuntimeAvailability(
        { primary: { endpoint: '/api/parking-answer' } },
        {},
      ),
    ).toEqual({
      available: false,
      message: PARKING_ANSWER_API_UNAVAILABLE_MESSAGE,
    })
    vi.unstubAllGlobals()
  })

  it('normalizes successful API responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        district: 'xinyi',
        datasetDir: 'public/data/generated/xinyi',
        datasetHash: 'hash-1',
        hhmm: '21:00',
        evaluatedCount: 1,
        answer: {
          kind: 'NO_DATA',
        },
        trustSummary: {
          trustLabel: 'No answer',
        },
      }),
    })

    await expect(
      searchParkingAnswer(
        {
          district: 'xinyi',
          location: [121.56, 25.03],
          hhmm: '21:00',
        },
        {
          config: {
            primary: {
              endpoint: '/api/parking-answer',
            },
          },
          fetchImpl: fetchImpl as never,
        },
      ),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      district: 'xinyi',
      answer: {
        kind: 'NO_DATA',
      },
    })
  })

  it('checks parking-answer readiness before browser-side service use', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        service: 'parking-answer',
        status: 'ok',
        districts: [
          {
            district: 'xinyi',
            datasetDir: 'public/data/generated/xinyi',
            ready: true,
            missingFiles: [],
            invalidFiles: [],
          },
        ],
      }),
    })

    await expect(
      checkParkingAnswerReadiness({
        config: {
          primary: {
            endpoint: '/api/parking-answer',
          },
        },
        fetchImpl: fetchImpl as never,
      }),
    ).resolves.toMatchObject({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          ready: true,
        },
      ],
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost/api/parking-answer/ready',
      expect.anything(),
    )
  })

  it('throws a typed degraded readiness error with missing and invalid files', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        schemaVersion: 1,
        service: 'parking-answer',
        status: 'degraded',
        districts: [
          {
            district: 'xinyi',
            datasetDir: 'public/data/generated/xinyi',
            ready: false,
            missingFiles: ['sign_overrides.geojson'],
            invalidFiles: ['red_yellow.geojson'],
          },
        ],
      }),
    })

    await expect(
      checkParkingAnswerReadiness({
        config: {
          primary: {
            endpoint: '/api/parking-answer',
          },
        },
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(ParkingAnswerReadinessError)
    await expect(
      checkParkingAnswerReadiness({
        config: {
          primary: {
            endpoint: '/api/parking-answer',
          },
        },
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(
      'xinyi: missing sign_overrides.geojson; invalid red_yellow.geojson',
    )
  })
})
