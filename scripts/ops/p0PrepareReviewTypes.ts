import type { QaReviewChecklistResult } from './qaReviewChecklistTypes'
import type { QaReviewGeojsonResult } from './qaReviewGeojsonTypes'
import type { QaReviewSummary } from './qaReviewSummaryTypes'

export interface P0PrepareReviewArgs {
  districtId: string | null
  sourcePath: string | null
  manifestPath: string | null
  configPath: string | null
  nextReviewOutPath: string | null
  checklistOutPath: string | null
  geojsonOutPath: string | null
  mergedOutPath: string | null
  nextReviewRowsLimit: number | null
  json: boolean
}

export interface P0PrepareReviewParams {
  districtId?: string | null
  sourcePath?: string | null
  manifestPath?: string | null
  configPath?: string | null
  nextReviewOutPath?: string | null
  checklistOutPath?: string | null
  geojsonOutPath?: string | null
  mergedOutPath?: string | null
  nextReviewRowsLimit?: number | null
}

export interface P0PrepareReviewInputs {
  districtId: string
  sourcePath: string
  manifestPath: string | null
  configPath: string
  nextReviewOutPath: string
  checklistOutPath: string
  geojsonOutPath: string
  mergedOutPath: string
  nextReviewRowsLimit: number
}

export interface P0PrepareReviewResult {
  pass: boolean
  inputs: P0PrepareReviewInputs
  qaReview: QaReviewSummary | null
  fatalReviewErrors: string[]
  nextReviewRowsWritten: number
  checklist: QaReviewChecklistResult | null
  geojson: QaReviewGeojsonResult | null
  errors: string[]
  warnings: string[]
}
