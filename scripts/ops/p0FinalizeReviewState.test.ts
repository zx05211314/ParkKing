import { describe, expect, it } from 'vitest'
import { buildP0FinalizeReview } from './p0FinalizeReviewState'
import type { P0FinalizeReviewRunners } from './p0FinalizeReviewTypes'
import type { P0PromoteReviewResult } from './p0PromoteReviewTypes'
import type { P0ReadinessResult } from './p0ReadinessTypes'
import type { RefreshPublishReportResult } from './refreshPublishReportState'
import type { WriteAnswerCasesResult } from './writeAnswerCases'

const promoteResult = (pass: boolean): P0PromoteReviewResult =>
  ({
    pass,
    inputs: {
      districtId: 'xinyi',
      sourcePath: '.tmp/xinyi-review.csv',
      reviewsPath: '.tmp/xinyi-next-review.csv',
      mergedOutPath: '.tmp/xinyi-review.merged.csv',
      configPath: 'configs/prod/xinyi.json',
      outDir: null,
    },
    apply: pass ? { appliedRows: 4, pass: true } : null,
    gate: pass ? { pass: true, preflight: { effectiveOverrides: 4 } } : null,
    errors: pass ? [] : ['No reviewed rows found in review handoff CSV.'],
    warnings: [],
  }) as unknown as P0PromoteReviewResult

const refreshResult = (): RefreshPublishReportResult =>
  ({
    configPath: 'configs/prod/xinyi.json',
    datasetDir: 'public/data/generated/xinyi',
    outPath: 'public/data/generated/ingest_all_report.json',
    dayHhmm: '13:00',
    nightHhmm: '21:00',
    summary: {
      districtId: 'xinyi',
      datasetHash: 'dataset-hash',
    },
    report: {},
  }) as unknown as RefreshPublishReportResult

const readinessResult = (pass: boolean): P0ReadinessResult =>
  ({
    pass,
    publishGate: {
      pass,
    },
  }) as unknown as P0ReadinessResult

const answerCasesResult = (pass: boolean): WriteAnswerCasesResult =>
  ({
    pass,
    outPath: 'configs/prod/xinyi.answer-cases.json',
    casesWritten: pass ? 4 : 0,
    errors: pass ? [] : ['No reviewed rows found.'],
  }) as unknown as WriteAnswerCasesResult

describe('buildP0FinalizeReview', () => {
  it('stops before ingest when promote fails', async () => {
    let ingestCalled = false
    const result = await buildP0FinalizeReview({
      runners: {
        promote: async () => promoteResult(false),
        ingest: async () => {
          ingestCalled = true
        },
      },
    })

    expect(result.pass).toBe(false)
    expect(result.stage).toBe('promote')
    expect(result.promote?.pass).toBe(false)
    expect(result.ingest).toBeNull()
    expect(ingestCalled).toBe(false)
    expect(result.errors).toContain('No reviewed rows found in review handoff CSV.')
  })

  it('runs ingest, refresh, answer cases, and readiness after promote passes', async () => {
    const calls: {
      ingestArgs?: string[]
      refreshConfig?: string | null
      answerCasesInput?: string | null
      answerCasesDatasetDir?: string | null
      answerCasesOut?: string | null
      readinessReview?: string | null
      readinessAnswerCases?: string | null
      readinessAllowPublishWarn?: boolean | null
      readinessAllowPublishFail?: boolean | null
      readinessPublishOverrideReason?: string | null
    } = {}
    const runners: Partial<P0FinalizeReviewRunners> = {
      promote: async () => promoteResult(true),
      ingest: async (argv) => {
        calls.ingestArgs = argv
      },
      refresh: async (params) => {
        calls.refreshConfig = params.configPath ?? null
        return refreshResult()
      },
      answerCases: async (params) => {
        calls.answerCasesInput = params.inputPath
        calls.answerCasesDatasetDir = params.datasetDir ?? null
        calls.answerCasesOut = params.outPath ?? null
        return answerCasesResult(true)
      },
      readiness: async (params) => {
        calls.readinessReview = params.reviewPath ?? null
        calls.readinessAnswerCases = params.answerCasesPath ?? null
        calls.readinessAllowPublishWarn = params.allowPublishWarn ?? null
        calls.readinessAllowPublishFail = params.allowPublishFail ?? null
        calls.readinessPublishOverrideReason = params.publishOverrideReason ?? null
        return readinessResult(true)
      },
    }

    const result = await buildP0FinalizeReview({
      districtId: 'xinyi',
      noCleanup: true,
      allowPublishWarn: true,
      allowPublishFail: true,
      publishOverrideReason: 'P0 bootstrap',
      runners,
    })

    expect(result.pass).toBe(true)
    expect(result.stage).toBe('done')
    expect(calls.ingestArgs).toContain('--configs')
    expect(calls.ingestArgs).toContain('configs/prod/xinyi.json')
    expect(calls.ingestArgs).toContain('--noCleanup')
    expect(calls.ingestArgs).toContain('--allowWarn')
    expect(calls.ingestArgs).toContain('--allowFail')
    expect(calls.ingestArgs).toContain('--override')
    expect(calls.ingestArgs).toContain('P0 bootstrap')
    expect(calls.refreshConfig).toBe(result.inputs.configPath)
    expect(calls.answerCasesInput).toBe(result.inputs.mergedOutPath)
    expect(calls.answerCasesDatasetDir).toBe('public/data/generated/xinyi')
    expect(calls.answerCasesOut).toBe(result.inputs.answerCasesPath)
    expect(calls.readinessReview).toBe(result.inputs.mergedOutPath)
    expect(calls.readinessAnswerCases).toBe(result.inputs.answerCasesPath)
    expect(calls.readinessAllowPublishWarn).toBe(true)
    expect(calls.readinessAllowPublishFail).toBe(true)
    expect(calls.readinessPublishOverrideReason).toBe('P0 bootstrap')
  })

  it('stops before refresh when ingest fails', async () => {
    let refreshCalled = false
    const result = await buildP0FinalizeReview({
      runners: {
        promote: async () => promoteResult(true),
        ingest: async () => {
          throw new Error('source file missing')
        },
        refresh: async () => {
          refreshCalled = true
          return refreshResult()
        },
      },
    })

    expect(result.pass).toBe(false)
    expect(result.stage).toBe('ingest')
    expect(result.ingest?.error).toBe('source file missing')
    expect(refreshCalled).toBe(false)
    expect(result.errors).toContain('Ingest failed: source file missing')
  })

  it('stops before readiness when answer case generation fails', async () => {
    let readinessCalled = false
    const result = await buildP0FinalizeReview({
      runners: {
        promote: async () => promoteResult(true),
        ingest: async () => undefined,
        refresh: async () => refreshResult(),
        answerCases: async () => answerCasesResult(false),
        readiness: async () => {
          readinessCalled = true
          return readinessResult(true)
        },
      },
    })

    expect(result.pass).toBe(false)
    expect(result.stage).toBe('answerCases')
    expect(result.answerCases?.pass).toBe(false)
    expect(result.readiness).toBeNull()
    expect(readinessCalled).toBe(false)
    expect(result.errors).toContain('Answer cases failed: No reviewed rows found.')
  })
})
