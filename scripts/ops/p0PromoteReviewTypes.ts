import type { QaReviewApplyResult } from './qaReviewApplyTypes'
import type { QaReviewGateResult } from './qaReviewGateTypes'

export interface P0PromoteReviewArgs {
  districtId: string | null
  sourcePath: string | null
  reviewsPath: string | null
  mergedOutPath: string | null
  configPath: string | null
  outDir: string | null
  json: boolean
}

export interface P0PromoteReviewParams {
  districtId?: string | null
  sourcePath?: string | null
  reviewsPath?: string | null
  mergedOutPath?: string | null
  configPath?: string | null
  outDir?: string | null
}

export interface P0PromoteReviewInputs {
  districtId: string
  sourcePath: string
  reviewsPath: string
  mergedOutPath: string
  configPath: string
  outDir: string | null
}

export interface P0PromoteReviewResult {
  pass: boolean
  inputs: P0PromoteReviewInputs
  apply: QaReviewApplyResult | null
  gate: QaReviewGateResult | null
  errors: string[]
  warnings: string[]
}
