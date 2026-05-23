import { describe, expect, it, vi } from 'vitest'
import type { P0ReadinessResult } from './p0ReadinessTypes'
import type { DistrictReadinessMatrixResult } from './districtReadinessMatrix'
import type { SmokeApiServicesSummary } from './smokeApiServices'
import type { SmokeParkingAnswerServiceSummary } from './smokeParkingAnswerService'
import type { SmokeReviewedUiPacksResult } from './smokeReviewedUiPacks'
import type { SmokeUiParkingAnswersSummary } from './smokeUiParkingAnswers'
import type { SmokeUiMapViewSummary } from './smokeUiMapView'
import type { BundleBudgetResult } from './bundleBudget'
import {
  parseP1ReleaseReadinessArgs,
  renderP1ReleaseReadiness,
  runP1ReleaseReadiness,
  type P1ReleaseReadinessRunners,
} from './p1ReleaseReadiness'

const p0Pass = {
  pass: true,
  exactSmoke: {
    pass: true,
    summary: { caseResults: [{ pass: true }, { pass: true }] },
    error: null,
  },
  qaReview: { pass: true, summary: null, error: null },
  publishGate: { pass: true, summary: null, error: null },
} as unknown as P0ReadinessResult

const matrixWithKnownBlockers = {
  entries: [
    {
      districtId: 'daan',
      blockers: ['runtime stale-public-dir', 'sign overrides missing or zero'],
    },
    {
      districtId: 'xinyi',
      blockers: [],
    },
  ],
  hasBlockers: true,
} as unknown as DistrictReadinessMatrixResult

const apiPass = {
  passed: 8,
  failed: 0,
  results: Array.from({ length: 8 }, (_, index) => ({
    service: index % 2 === 0 ? 'geocode' : 'routing',
    suffix: index % 2 === 0 ? 'health' : 'ready',
    url: `http://localhost/${index}`,
    status: 200,
    ok: true,
    serviceStatus: 'ok',
  })),
} as unknown as SmokeApiServicesSummary

const bundleBudgetPass = {
  pass: true,
  entry: { href: '/assets/index.js', bytes: 407_000 },
  initialJsBytes: 627_000,
  maxEntryBytes: 450_000,
  maxInitialJsBytes: 700_000,
  violations: [],
} as unknown as BundleBudgetResult

const parkingAnswerPass = {
  passed: 7,
  failed: 0,
  results: Array.from({ length: 7 }, (_, index) => ({
    id: `case-${index}`,
    pass: true,
  })),
} as unknown as SmokeParkingAnswerServiceSummary

const reviewedUiPass = {
  hasErrors: false,
  packResults: [
    {
      districtId: 'xinyi',
      errors: [],
    },
  ],
} as unknown as SmokeReviewedUiPacksResult

const mapReviewedUiPass = {
  passCount: 1,
  caseCount: 1,
  view: 'MAP',
} as unknown as SmokeUiParkingAnswersSummary

const mapUiPass = {
  pass: true,
  district: 'xinyi',
  canvasWidth: 1000,
  canvasHeight: 640,
  rootWidth: 1000,
  rootHeight: 640,
  expectedSegmentsCount: 11248,
  expectedParkingSpacesCount: 23091,
  mapSegmentCount: 11248,
  mapParkingSpaceCount: 23091,
} as unknown as SmokeUiMapViewSummary

const buildRunners = (
  overrides: Partial<P1ReleaseReadinessRunners> = {},
): P1ReleaseReadinessRunners => ({
  buildP0Readiness: vi.fn().mockResolvedValue(p0Pass),
  runDistrictReadinessMatrix: vi.fn().mockResolvedValue(matrixWithKnownBlockers),
  runSmokeApiServices: vi.fn().mockResolvedValue(apiPass),
  runBundleBudget: vi.fn().mockResolvedValue(bundleBudgetPass),
  runSmokeParkingAnswerService: vi.fn().mockResolvedValue(parkingAnswerPass),
  runSmokeReviewedUiPacks: vi.fn().mockResolvedValue(reviewedUiPass),
  runSmokeUiParkingAnswers: vi.fn().mockResolvedValue(mapReviewedUiPass),
  runSmokeUiMapView: vi.fn().mockResolvedValue(mapUiPass),
  ...overrides,
})

describe('p1ReleaseReadiness', () => {
  it('parses release readiness options', () => {
    expect(
      parseP1ReleaseReadinessArgs([
        'node',
        'p1ReleaseReadiness',
        '--district',
        'xinyi',
        '--root',
        'public/data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--configs',
        'configs/prod/*.json',
        '--timeout-ms',
        '25000',
        '--cases',
        'configs/prod/xinyi.answer-cases.json',
        '--dist',
        'dist',
        '--skip-ui',
        '--strict-matrix',
        '--json',
      ]),
    ).toMatchObject({
      districtId: 'xinyi',
      root: 'public/data/generated',
      registryPath: 'public/data/generated/registry.json',
      configGlob: 'configs/prod/*.json',
      timeoutMs: 25000,
      answerCasesPath: 'configs/prod/xinyi.answer-cases.json',
      distDir: 'dist',
      skipUi: true,
      strictMatrix: true,
      json: true,
    })
  })

  it('passes current-product readiness while reporting non-strict district blockers', async () => {
    const runners = buildRunners()
    const result = await runP1ReleaseReadiness({}, runners)

    expect(result.pass).toBe(true)
    expect(result.knownDistrictBlockers).toEqual([
      {
        districtId: 'daan',
        blockers: ['runtime stale-public-dir', 'sign overrides missing or zero'],
      },
    ])
    expect(runners.runSmokeApiServices).toHaveBeenCalledWith({
      startPreview: true,
      timeoutMs: 25000,
    })
    expect(runners.runBundleBudget).toHaveBeenCalledWith({
      distDir: 'dist',
    })
    expect(runners.runSmokeReviewedUiPacks).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredReviewedCaseDistricts: ['xinyi'],
        startPreview: true,
      }),
    )
    expect(runners.runSmokeUiParkingAnswers).toHaveBeenCalledWith({
      district: 'xinyi',
      casesPath: 'configs\\prod\\xinyi.answer-cases.json',
      view: 'MAP',
      limit: 1,
      timeoutMs: 25000,
      startPreview: true,
    })
    expect(runners.runSmokeUiMapView).toHaveBeenCalledWith({
      district: 'xinyi',
      timeoutMs: 25000,
      startPreview: true,
    })
  })

  it('can promote district matrix blockers to release blockers in strict mode', async () => {
    const result = await runP1ReleaseReadiness(
      { strictMatrix: true },
      buildRunners(),
    )

    expect(result.pass).toBe(false)
    expect(result.blockers).toEqual(['District readiness matrix: failed'])
    expect(renderP1ReleaseReadiness(result)).toContain(
      '# P1 Release Readiness: BLOCKED',
    )
  })

  it('can skip Chrome-backed UI smoke when requested', async () => {
    const runners = buildRunners()
    const result = await runP1ReleaseReadiness({ skipUi: true }, runners)

    expect(result.pass).toBe(true)
    expect(result.reviewedUi).toBeNull()
    expect(result.mapReviewedUi).toBeNull()
    expect(result.mapUi).toBeNull()
    expect(runners.runSmokeReviewedUiPacks).not.toHaveBeenCalled()
    expect(runners.runSmokeUiParkingAnswers).not.toHaveBeenCalled()
    expect(runners.runSmokeUiMapView).not.toHaveBeenCalled()
    expect(renderP1ReleaseReadiness(result)).toContain(
      '| SKIP | Reviewed UI answers | skipped by --skip-ui | |',
    )
    expect(renderP1ReleaseReadiness(result)).toContain(
      '| SKIP | MAP reviewed UI answer | skipped by --skip-ui | |',
    )
    expect(renderP1ReleaseReadiness(result)).toContain(
      '| SKIP | MAP UI smoke | skipped by --skip-ui | |',
    )
  })
})
