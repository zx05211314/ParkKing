import type { SmokeExactParkingAnswersSummary } from './smokeExactParkingAnswers'
import type { QaReviewSummary } from './qaReviewSummaryTypes'
import type { PublishGateRunSummary } from './publishGateRunSummary'

export interface P0ReadinessArgs {
  districtId: string | null
  datasetDir: string | null
  reviewPath: string | null
  manifestPath: string | null
  configPath: string | null
  publishReportPath: string | null
  answerCasesPath: string | null
  hhmm: string | null
  searchRadiusMeters: number | null
  nextReviewRowsLimit: number | null
  allowPublishWarn: boolean
  allowPublishFail: boolean
  publishOverrideReason: string | null
  json: boolean
}

export interface P0ReadinessParams {
  districtId?: string | null
  datasetDir?: string | null
  reviewPath?: string | null
  manifestPath?: string | null
  configPath?: string | null
  publishReportPath?: string | null
  answerCasesPath?: string | null
  hhmm?: string | null
  searchRadiusMeters?: number | null
  nextReviewRowsLimit?: number | null
  allowPublishWarn?: boolean | null
  allowPublishFail?: boolean | null
  publishOverrideReason?: string | null
}

export interface P0ReadinessCheck<T> {
  pass: boolean
  summary: T | null
  error: string | null
}

export interface P0ReadinessResolvedInputs {
  districtId: string
  datasetDir: string
  reviewPath: string
  manifestPath: string | null
  configPath: string
  publishReportPath: string
  answerCasesPath: string | null
  hhmm: string
  searchRadiusMeters: number
  nextReviewRowsLimit: number
  allowPublishWarn: boolean
  allowPublishFail: boolean
  publishOverrideReason: string | null
}

export interface P0ReadinessResult {
  pass: boolean
  inputs: P0ReadinessResolvedInputs
  exactSmoke: P0ReadinessCheck<SmokeExactParkingAnswersSummary>
  qaReview: P0ReadinessCheck<QaReviewSummary>
  publishGate: P0ReadinessCheck<PublishGateRunSummary>
  reviewPackProvenanceWarnings?: string[]
  reviewConfigDriftWarnings?: string[]
  reviewProvenanceWarnings?: string[]
}
