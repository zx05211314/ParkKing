import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SmokeExactParkingAnswerCase } from './smokeExactParkingAnswers'
import {
  assertSmokeUiAppReachable,
  buildSmokeUiDatasetMetaUrl,
  buildSmokeUiParkingAnswerCaseUrl,
  buildSmokeUiParkingAnswerExpectations,
  getDatasetHashFromMeta,
  getSmokeProfileCleanupDelayMs,
  isRetryableSmokeProfileCleanupError,
  isSafeSmokeProfileDir,
  parseSmokeUiParkingAnswersArgs,
  removeSmokeProfileDir,
  renderSmokeUiParkingAnswersSummary,
  resolveSmokeUiDatasetHashError,
  resolveSmokeUiSuiteTimeoutMs,
  shouldRetrySmokeUiCase,
  validateSmokeUiDatasetHash,
  validateSmokeUiParkingAnswersSummary,
} from './smokeUiParkingAnswers'

const answerCase: SmokeExactParkingAnswerCase = {
  id: 'xinyi-reviewed-legal-seg-8953-part-2',
  label: 'Reviewed legal parking answer with marked-space evidence',
  lng: 121.570443,
  lat: 25.025664,
  hhmm: '21:00',
  expectedKind: 'PARK',
  expectedEvidenceKind: 'MARKED_SPACE',
  expectedFinalConfidence: 'HIGH',
}

describe('smokeUiParkingAnswers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses app, case, Chrome, timeout, and filter options', () => {
    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--app-url',
        'http://127.0.0.1:4173',
        '--cases',
        'configs/prod/xinyi.answer-cases.json',
        '--district',
        'xinyi',
        '--view',
        'MAP',
        '--chrome-path',
        'C:\\Chrome\\chrome.exe',
        '--cdp-port',
        '9333',
        '--timeout-ms',
        '5000',
        '--suite-timeout-ms',
        '9000',
        '--limit',
        '2',
        '--filter',
        '__none__',
      ]),
    ).toEqual({
      appUrl: 'http://127.0.0.1:4173',
      casesPath: 'configs/prod/xinyi.answer-cases.json',
      district: 'xinyi',
      view: 'MAP',
      chromePath: 'C:\\Chrome\\chrome.exe',
      cdpPort: 9333,
      timeoutMs: 5000,
      suiteTimeoutMs: 9000,
      limit: 2,
      filter: '__none__',
      startPreview: false,
      previewPort: undefined,
      datasetMetaUrl: undefined,
      allowUnpinnedCases: false,
      allowMismatchedCaseHash: undefined,
    })
  })

  it('bounds suite duration and only retries fully missing pages once', () => {
    expect(resolveSmokeUiSuiteTimeoutMs(5000)).toBe(10000)
    expect(resolveSmokeUiSuiteTimeoutMs(5000, 12000)).toBe(12000)
    expect(
      shouldRetrySmokeUiCase({
        attempt: 0,
        requiredText: ['one', 'two'],
        missingText: ['one', 'two'],
      }),
    ).toBe(true)
    expect(
      shouldRetrySmokeUiCase({
        attempt: 1,
        requiredText: ['one', 'two'],
        missingText: ['one', 'two'],
      }),
    ).toBe(false)
    expect(
      shouldRetrySmokeUiCase({
        attempt: 0,
        requiredText: ['one', 'two'],
        missingText: ['two'],
      }),
    ).toBe(false)
  })

  it('parses self-managed preview mode', () => {
    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--start-preview',
        '--preview-port',
        '4180',
      ]),
    ).toMatchObject({
      startPreview: true,
      previewPort: 4180,
    })
  })

  it('can disable recommendation filtering', () => {
    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--no-filter',
      ]).filter,
    ).toBeNull()
  })

  it('can override or disable the runtime dataset hash check', () => {
    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--dataset-meta-url',
        'http://127.0.0.1:4173/data/generated/xinyi/dataset_meta.json',
      ]).datasetMetaUrl,
    ).toBe('http://127.0.0.1:4173/data/generated/xinyi/dataset_meta.json')

    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--no-dataset-hash-check',
      ]).datasetMetaUrl,
    ).toBeNull()

    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--allow-unpinned-cases',
      ]).allowUnpinnedCases,
    ).toBe(true)
    expect(
      parseSmokeUiParkingAnswersArgs([
        'node',
        'smokeUiParkingAnswers',
        '--allow-mismatched-case-hash',
      ]).allowMismatchedCaseHash,
    ).toBe(true)
    expect(
      resolveSmokeUiDatasetHashError({
        datasetMetaUrl: null,
        caseDatasetHash: 'hash-1',
        runtimeDatasetHash: null,
      }),
    ).toBeNull()
  })

  it('builds share URLs for reviewed parking answer cases', () => {
    const url = new URL(
      buildSmokeUiParkingAnswerCaseUrl({
        appUrl: 'http://127.0.0.1:4173/',
        district: 'xinyi',
        answerCase,
        filter: '__none__',
      }),
    )

    expect(url.origin).toBe('http://127.0.0.1:4173')
    expect(url.searchParams.get('dataset')).toBe('xinyi')
    expect(url.searchParams.get('address')).toBe(answerCase.label)
    expect(url.searchParams.get('lat')).toBe(String(answerCase.lat))
    expect(url.searchParams.get('lng')).toBe(String(answerCase.lng))
    expect(url.searchParams.get('time')).toBe('NIGHT')
    expect(url.searchParams.get('view')).toBe('LIST')
    expect(url.searchParams.get('filter')).toBe('__none__')
  })

  it('preserves inferred-candidate and radius case options in share URLs', () => {
    const url = new URL(
      buildSmokeUiParkingAnswerCaseUrl({
        appUrl: 'http://127.0.0.1:4173/',
        district: 'daan',
        answerCase: {
          ...answerCase,
          searchRadiusMeters: 35,
          includeInferred: true,
        },
      }),
    )

    expect(url.searchParams.get('radius')).toBe('35')
    expect(url.searchParams.get('inferred')).toBe('1')
  })

  it('builds MAP-mode share URLs for reviewed parking answer cases', () => {
    const url = new URL(
      buildSmokeUiParkingAnswerCaseUrl({
        appUrl: 'http://127.0.0.1:4173/',
        district: 'xinyi',
        answerCase,
        view: 'MAP',
      }),
    )

    expect(url.searchParams.get('dataset')).toBe('xinyi')
    expect(url.searchParams.get('view')).toBe('MAP')
  })

  it('turns answer cases into UI text expectations', () => {
    const expectation = buildSmokeUiParkingAnswerExpectations({
      appUrl: 'http://127.0.0.1:4173',
      district: 'xinyi',
      answerCase,
      filter: '__none__',
    })

    expect(expectation.requiredText).toEqual([
      'Pinned location answer',
      'Park allowed at nearest mapped curb',
      'PARK',
      'Decision: Use this curb only if posted signs still match the mapped rule.',
      'Evidence type: Mapped marked spaces',
      'HIGH confidence',
      'Exact curb answer is shown above. Route-ranked parking targets are unavailable with the current filters or route data.',
    ])
  })

  it('adds MAP-mode text expectations when requested', () => {
    const expectation = buildSmokeUiParkingAnswerExpectations({
      appUrl: 'http://127.0.0.1:4173',
      district: 'xinyi',
      answerCase,
      view: 'MAP',
      filter: null,
    })

    expect(expectation.view).toBe('MAP')
    expect(expectation.requiredText).toEqual(
      expect.arrayContaining([
        'Pinned location answer',
        'Mode: Map + list',
        'Green: park ok',
        'Click map to check parking here',
      ]),
    )
  })

  it('builds and validates runtime dataset hash checks', () => {
    expect(
      buildSmokeUiDatasetMetaUrl({
        appUrl: 'http://127.0.0.1:4173/some/path',
        district: 'xinyi',
      }),
    ).toBe('http://127.0.0.1:4173/data/generated/xinyi/dataset_meta.json')
    expect(getDatasetHashFromMeta({ datasetHash: 'hash-1' })).toBe('hash-1')
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: 'hash-1',
        runtimeDatasetHash: 'hash-1',
      }),
    ).toBeNull()
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: 'hash-1',
        runtimeDatasetHash: 'hash-2',
        allowMismatchedCaseHash: true,
      }),
    ).toBeNull()
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: 'hash-1',
        runtimeDatasetHash: 'hash-2',
      }),
    ).toBe(
      'answer cases datasetHash hash-1 does not match runtime datasetHash hash-2',
    )
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: 'hash-1',
        runtimeDatasetHash: null,
      }),
    ).toBe('runtime dataset_meta.json is missing datasetHash')
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: null,
        runtimeDatasetHash: 'hash-1',
      }),
    ).toBe('answer cases file is missing datasetHash')
    expect(
      validateSmokeUiDatasetHash({
        caseDatasetHash: null,
        runtimeDatasetHash: 'hash-1',
        allowUnpinnedCases: true,
      }),
    ).toBeNull()
  })

  it('fails with an actionable message when the app URL is not reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    )

    await expect(
      assertSmokeUiAppReachable('http://127.0.0.1:4173'),
    ).rejects.toThrow(
      'UI app http://127.0.0.1:4173 is not reachable. Start the app or rerun with --start-preview. Cause: connect ECONNREFUSED',
    )
  })

  it('rejects case times that are not supported by UI share presets', () => {
    expect(() =>
      buildSmokeUiParkingAnswerCaseUrl({
        appUrl: 'http://127.0.0.1:4173',
        district: 'xinyi',
        answerCase: { ...answerCase, hhmm: '09:30' },
      }),
    ).toThrow('UI smoke only supports share-link time presets')
  })

  it('renders and validates UI smoke failures', () => {
    const summary = {
      appUrl: 'http://127.0.0.1:4173',
      casesPath: 'configs/prod/xinyi.answer-cases.json',
      district: 'xinyi',
      view: 'LIST' as const,
      caseDatasetHash: 'hash-1',
      runtimeDatasetHash: 'hash-1',
      caseCount: 1,
      passCount: 0,
      results: [
        {
          ...buildSmokeUiParkingAnswerExpectations({
            appUrl: 'http://127.0.0.1:4173',
            district: 'xinyi',
            answerCase,
          }),
          pass: false,
          missingText: ['Pinned location answer'],
        },
      ],
    }

    expect(validateSmokeUiParkingAnswersSummary(summary)).toEqual([
      'answer case xinyi-reviewed-legal-seg-8953-part-2 missing UI text: Pinned location answer',
    ])
    expect(renderSmokeUiParkingAnswersSummary(summary)).toContain(
      'CASE xinyi-reviewed-legal-seg-8953-part-2: FAIL missing "Pinned location answer"',
    )
  })

  it('reports when a suite deadline stops remaining answer cases', () => {
    const summary = {
      appUrl: 'http://127.0.0.1:4173',
      casesPath: 'configs/prod/xinyi.answer-cases.json',
      district: 'xinyi',
      view: 'LIST' as const,
      caseDatasetHash: 'hash-1',
      runtimeDatasetHash: 'hash-1',
      caseCount: 2,
      passCount: 1,
      results: [
        {
          ...buildSmokeUiParkingAnswerExpectations({
            appUrl: 'http://127.0.0.1:4173',
            district: 'xinyi',
            answerCase,
          }),
          pass: true,
          missingText: [],
        },
      ],
    }

    expect(validateSmokeUiParkingAnswersSummary(summary)).toContain(
      'UI parking answer smoke stopped after 1/2 cases because the suite timeout or page-load retry budget was exhausted.',
    )
  })

  it('guards Chrome profile cleanup to only smoke temp directories', async () => {
    const safePath = path.join(os.tmpdir(), 'parkking-ui-smoke-test-safe')
    const unsafePath = path.join(process.cwd(), 'parkking-ui-smoke-test-unsafe')

    expect(isSafeSmokeProfileDir(safePath)).toBe(true)
    expect(isSafeSmokeProfileDir(unsafePath)).toBe(false)
    await expect(
      removeSmokeProfileDir(unsafePath, {
        rm: vi.fn(),
        waitMs: vi.fn(),
      }),
    ).rejects.toThrow('Refusing to remove unexpected Chrome profile')
  })

  it('retries transient Windows Chrome profile cleanup locks with backoff', async () => {
    const profileDir = path.join(os.tmpdir(), 'parkking-ui-smoke-test-busy')
    const waits: number[] = []
    let calls = 0
    const rm = vi.fn(async () => {
      calls += 1
      if (calls < 3) {
        throw Object.assign(new Error('busy'), { code: 'EBUSY' })
      }
    })

    await removeSmokeProfileDir(profileDir, {
      attempts: 5,
      initialDelayMs: 10,
      rm,
      waitMs: async (ms) => {
        waits.push(ms)
      },
    })

    expect(rm).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([10, 20])
    expect(getSmokeProfileCleanupDelayMs({ attempt: 2, initialDelayMs: 10 }))
      .toBe(40)
  })

  it('does not retry non-lock cleanup errors', async () => {
    const profileDir = path.join(os.tmpdir(), 'parkking-ui-smoke-test-denied')
    const waits: number[] = []
    const rm = vi.fn(async () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' })
    })

    await expect(
      removeSmokeProfileDir(profileDir, {
        attempts: 5,
        initialDelayMs: 10,
        rm,
        waitMs: async (ms) => {
          waits.push(ms)
        },
      }),
    ).rejects.toThrow('denied')

    expect(rm).toHaveBeenCalledTimes(1)
    expect(waits).toEqual([])
    expect(
      isRetryableSmokeProfileCleanupError(
        Object.assign(new Error('busy'), { code: 'EPERM' }),
      ),
    ).toBe(true)
  })
})
