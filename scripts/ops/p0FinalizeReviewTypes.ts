import type { P0ReadinessResult } from './p0ReadinessTypes'
import type { P0PromoteReviewResult } from './p0PromoteReviewTypes'
import type { RefreshPublishReportResult } from './refreshPublishReportState'
import type { WriteAnswerCasesParams, WriteAnswerCasesResult } from './writeAnswerCases'

export type P0FinalizeReviewStage =
  | 'promote'
  | 'ingest'
  | 'refresh'
  | 'answerCases'
  | 'readiness'
  | 'done'

export interface P0FinalizeReviewArgs {
  districtId: string | null
  sourcePath: string | null
  reviewsPath: string | null
  mergedOutPath: string | null
  configPath: string | null
  answerCasesPath: string | null
  outDir: string | null
  publishReportPath: string | null
  noCleanup: boolean
  allowPublishWarn: boolean
  allowPublishFail: boolean
  publishOverrideReason: string | null
  json: boolean
}

export interface P0FinalizeReviewParams {
  districtId?: string | null
  sourcePath?: string | null
  reviewsPath?: string | null
  mergedOutPath?: string | null
  configPath?: string | null
  answerCasesPath?: string | null
  outDir?: string | null
  publishReportPath?: string | null
  noCleanup?: boolean
  allowPublishWarn?: boolean | null
  allowPublishFail?: boolean | null
  publishOverrideReason?: string | null
  runners?: Partial<P0FinalizeReviewRunners>
}

export interface P0FinalizeReviewInputs {
  districtId: string
  sourcePath: string
  reviewsPath: string
  mergedOutPath: string
  configPath: string
  answerCasesPath: string
  outDir: string | null
  publishReportPath: string | null
  noCleanup: boolean
  allowPublishWarn: boolean
  allowPublishFail: boolean
  publishOverrideReason: string | null
}

export interface P0FinalizeReviewStep {
  pass: boolean
  error: string | null
}

export interface P0FinalizeReviewRunners {
  promote: (params: {
    districtId?: string | null
    sourcePath?: string | null
    reviewsPath?: string | null
    mergedOutPath?: string | null
    configPath?: string | null
    outDir?: string | null
  }) => Promise<P0PromoteReviewResult>
  ingest: (argv: string[]) => Promise<void>
  refresh: (params: {
    configPath?: string | null
    outPath?: string | null
  }) => Promise<RefreshPublishReportResult>
  answerCases: (params: WriteAnswerCasesParams) => Promise<WriteAnswerCasesResult>
  readiness: (params: {
    districtId?: string | null
    reviewPath?: string | null
    configPath?: string | null
    publishReportPath?: string | null
    answerCasesPath?: string | null
    allowPublishWarn?: boolean | null
    allowPublishFail?: boolean | null
    publishOverrideReason?: string | null
  }) => Promise<P0ReadinessResult>
}

export interface P0FinalizeReviewResult {
  pass: boolean
  stage: P0FinalizeReviewStage
  inputs: P0FinalizeReviewInputs
  promote: P0PromoteReviewResult | null
  ingest: P0FinalizeReviewStep | null
  refresh: RefreshPublishReportResult | null
  answerCases: WriteAnswerCasesResult | null
  readiness: P0ReadinessResult | null
  errors: string[]
  warnings: string[]
}
