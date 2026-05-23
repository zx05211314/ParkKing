export interface QaReviewChecklistArgs {
  inputPath: string | null
  sourcePath: string | null
  outPath: string | null
  mergedOutPath: string | null
  configPath: string | null
  title: string | null
  json: boolean
}

export interface QaReviewChecklistParams {
  inputPath: string
  sourcePath?: string | null
  outPath?: string | null
  mergedOutPath?: string | null
  configPath?: string | null
  title?: string | null
}

export interface QaReviewChecklistProvenance {
  sourceDatasetHash: string | null
  sourceConfigHash: string | null
  sourceRowsTotal: string | null
}

export interface QaReviewChecklistRow {
  rowNumber: number
  sourceRowNumber: string
  districtId: string
  segmentId: string
  reviewBucket: string
  lat: string | null
  lon: string | null
  score: string | null
  tier: string | null
  allowedNow: string | null
  curbMarking?: string | null
  sourceType?: string | null
  sourceReliability?: string | null
  dataFreshnessDays?: string | null
  finalConfidence?: string | null
  coverageConfidence?: string | null
  overrideConfidence?: string | null
  parkingSpaceCount: string | null
  topReasons?: string | null
  flags?: string | null
  riskTags?: string | null
  signOverrideStatus?: string | null
  signOverrideSource?: string | null
  signOverrideVerifiedAt?: string | null
  signOverrideNote?: string | null
  mapsUrl: string | null
  streetViewUrl: string | null
  sourceDatasetHash: string | null
  sourceConfigHash: string | null
  sourceRowsTotal: string | null
  reviewPlanRank: string | null
  reviewPlanReason: string | null
  reviewStatus: string | null
  reviewNote: string | null
  createdAt: string | null
}

export interface QaReviewChecklistResult {
  inputPath: string
  sourcePath: string | null
  outPath: string | null
  mergedOutPath: string | null
  configPath: string | null
  title: string
  totalRows: number
  rowsWithReviewStatus: number
  provenance: QaReviewChecklistProvenance
  rows: QaReviewChecklistRow[]
  errors: string[]
  warnings: string[]
  pass: boolean
}
