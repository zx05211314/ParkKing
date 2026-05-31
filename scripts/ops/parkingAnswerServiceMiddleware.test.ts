import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { REQUIRED_PARKING_ANSWER_DATASET_FILES } from './parkingAnswerServiceHealth'
import { createParkingAnswerServiceMiddleware } from './parkingAnswerServiceMiddleware'
import type {
  ParkingAnswerService,
  ParkingAnswerServiceConfig,
} from './parkingAnswerServiceTypes'

const createMockResponse = () => {
  const headers = new Map<string, string>()
  let body = ''

  return {
    body: () => body,
    headers,
    response: {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers.set(name, value)
      },
      end: (value?: string) => {
        body = value ?? ''
      },
    },
  }
}

const config: ParkingAnswerServiceConfig = {
  path: '/api/parking-answer',
  port: 8790,
  districtDatasetRoot: resolve('public/data/generated'),
  defaultDistrict: 'xinyi',
  allowedDistricts: ['xinyi'],
  defaultHhmm: '21:00',
  allowDatasetDirParam: false,
}

const createDatasetDir = async (district = 'xinyi') => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parking-answer-ready-'))
  const datasetDir = path.join(root, district)
  await fs.mkdir(datasetDir, { recursive: true })
  await Promise.all(
    REQUIRED_PARKING_ANSWER_DATASET_FILES.map((fileName) =>
      fs.writeFile(
        path.join(datasetDir, fileName),
        JSON.stringify(
          fileName === 'dataset_meta.json'
            ? { datasetHash: 'hash-1' }
            : { type: 'FeatureCollection', features: [] },
        ),
        'utf-8',
      ),
    ),
  )
  await fs.writeFile(
    path.join(datasetDir, 'LATEST.json'),
    JSON.stringify({
      datasetHash: 'hash-1',
      publishedAt: '2026-05-23T15:44:29.212Z',
    }),
    'utf-8',
  )
  return { root, datasetDir }
}

describe('createParkingAnswerServiceMiddleware', () => {
  it('returns liveness health without calling the answer service', async () => {
    const service: ParkingAnswerService = {
      answer: vi.fn(),
    }
    const middleware = createParkingAnswerServiceMiddleware(service, config, config.path)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer/health',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(200)
    expect(JSON.parse(res.body())).toMatchObject({
      schemaVersion: 1,
      service: 'parking-answer',
      status: 'ok',
      answerPath: '/api/parking-answer',
      healthPath: '/api/parking-answer/health',
      readinessPath: '/api/parking-answer/ready',
    })
    expect(service.answer).not.toHaveBeenCalled()
  })

  it('returns readiness details for generated district packs', async () => {
    const { root, datasetDir } = await createDatasetDir()
    const service: ParkingAnswerService = {
      answer: vi.fn(),
    }
    const middleware = createParkingAnswerServiceMiddleware(
      service,
      {
        ...config,
        districtDatasetRoot: root,
      },
      config.path,
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(200)
    expect(JSON.parse(res.body())).toMatchObject({
      status: 'ok',
      districts: [
        {
          district: 'xinyi',
          datasetDir,
          ready: true,
          missingFiles: [],
          invalidFiles: [],
          datasetHash: 'hash-1',
          latestDatasetHash: 'hash-1',
          latestPublishedAt: '2026-05-23T15:44:29.212Z',
        },
      ],
    })
    expect(service.answer).not.toHaveBeenCalled()
  })

  it('requires sign overrides and inferred candidates for readiness', () => {
    expect(REQUIRED_PARKING_ANSWER_DATASET_FILES).toContain(
      'sign_overrides.geojson',
    )
    expect(REQUIRED_PARKING_ANSWER_DATASET_FILES).toContain(
      'candidates_inferred.geojson',
    )
  })

  it('returns 503 readiness when required dataset files are missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parking-answer-missing-'))
    await fs.mkdir(path.join(root, 'xinyi'), { recursive: true })
    const service: ParkingAnswerService = {
      answer: vi.fn(),
    }
    const middleware = createParkingAnswerServiceMiddleware(
      service,
      {
        ...config,
        districtDatasetRoot: root,
      },
      config.path,
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(503)
    expect(JSON.parse(res.body())).toMatchObject({
      status: 'degraded',
      districts: [
        {
          district: 'xinyi',
          ready: false,
          missingFiles: [...REQUIRED_PARKING_ANSWER_DATASET_FILES],
          invalidFiles: [],
        },
      ],
    })
    expect(service.answer).not.toHaveBeenCalled()
  })

  it('returns 503 readiness when required dataset files are malformed', async () => {
    const { root } = await createDatasetDir()
    await fs.writeFile(
      path.join(root, 'xinyi', 'red_yellow.geojson'),
      JSON.stringify({ type: 'Feature', properties: {}, geometry: null }),
      'utf-8',
    )
    await fs.writeFile(path.join(root, 'xinyi', 'sign_overrides.geojson'), '{', 'utf-8')
    const service: ParkingAnswerService = {
      answer: vi.fn(),
    }
    const middleware = createParkingAnswerServiceMiddleware(
      service,
      {
        ...config,
        districtDatasetRoot: root,
      },
      config.path,
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(503)
    expect(JSON.parse(res.body())).toMatchObject({
      status: 'degraded',
      districts: [
        {
          district: 'xinyi',
          ready: false,
          missingFiles: [],
          invalidFiles: ['red_yellow.geojson', 'sign_overrides.geojson'],
        },
      ],
    })
    expect(service.answer).not.toHaveBeenCalled()
  })

  it('returns 400 when coordinates are missing', async () => {
    const service: ParkingAnswerService = {
      answer: vi.fn(),
    }
    const middleware = createParkingAnswerServiceMiddleware(service, config, config.path)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer?district=xinyi',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(400)
    expect(res.body()).toBe('{"error":"Missing or invalid lng/lat coordinates."}')
    expect(service.answer).not.toHaveBeenCalled()
  })

  it('passes parsed requests to the parking answer service', async () => {
    const service: ParkingAnswerService = {
      answer: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        district: 'xinyi',
        datasetDir: resolve('public/data/generated/xinyi'),
        datasetHash: 'hash-1',
        hhmm: '21:00',
        evaluatedCount: 1,
        answer: { kind: 'PARK' },
        trustSummary: { trustLabel: 'High trust' },
      }),
    }
    const middleware = createParkingAnswerServiceMiddleware(service, config, config.path)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/parking-answer?lng=121.56&lat=25.03&includeInferred=true',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.answer).toHaveBeenCalledWith({
      district: 'xinyi',
      datasetDir: resolve('public/data/generated/xinyi'),
      lng: 121.56,
      lat: 25.03,
      hhmm: '21:00',
      searchRadiusMeters: undefined,
      includeInferred: true,
      riskMode: undefined,
      maxAlternatives: undefined,
    })
    expect(res.response.statusCode).toBe(200)
    expect(res.body()).toContain('"schemaVersion":1')
  })
})
