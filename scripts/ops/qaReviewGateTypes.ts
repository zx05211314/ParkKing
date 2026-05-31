import type { ExportOverridesResult } from './exportOverrideTypes'
import type { QaReviewGateInputKind } from './qaReviewGateInput'
import type { QaReviewSummary } from './qaReviewSummaryTypes'
import type { SignOverridePreflightResult } from './signOverridePreflightTypes'

export interface QaReviewGateArgs {
  inputPath: string | null
  manifestPath: string | null
  configPath: string | null
  outDir: string | null
  outPath: string | null
  json: boolean
  strictManifest: boolean
  strictConfigProvenance: boolean
  strictReviewedRows: boolean
  strictReviewedSegments: boolean
  nextReviewRowsLimit: number
  nextReviewOutPath: string | null
  minReviewed: number
  requireStatuses: string[]
  requireBuckets: string[]
  minReviewedBuckets: Record<string, number>
}

export interface QaReviewGateParams {
  inputPath: string
  manifestPath?: string | null
  configPath: string
  outDir?: string | null
  strictManifest?: boolean
  strictConfigProvenance?: boolean
  strictReviewedRows?: boolean
  strictReviewedSegments?: boolean
  nextReviewRowsLimit?: number
  minReviewed?: number
  requireStatuses?: string[]
  requireBuckets?: string[]
  minReviewedBuckets?: Record<string, number>
}

export interface QaReviewGateResult {
  inputPath: string
  inputKind: QaReviewGateInputKind
  configPath: string
  outDir: string
  summary: QaReviewSummary
  exports: ExportOverridesResult[]
  preflight: SignOverridePreflightResult | null
  errors: string[]
  warnings: string[]
  pass: boolean
}
