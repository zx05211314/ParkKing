export interface QaReviewApplyArgs {
  sourcePath: string | null
  reviewsPath: string | null
  outPath: string | null
  allowOverwrite: boolean
  json: boolean
}

export interface QaReviewApplyParams {
  sourcePath: string
  reviewsPath: string
  outPath: string
  allowOverwrite?: boolean
}

export interface QaReviewApplyResult {
  sourcePath: string
  reviewsPath: string
  outPath: string
  manifestPath: string | null
  totalReviewRows: number
  reviewedInputRows: number
  skippedBlankRows: number
  appliedRows: number
  errors: string[]
  warnings: string[]
  pass: boolean
}
