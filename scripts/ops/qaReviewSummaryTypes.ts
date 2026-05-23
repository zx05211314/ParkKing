export const VALID_QA_REVIEW_STATUSES = ['LEGAL', 'ILLEGAL', 'UNCLEAR'] as const

export type QaReviewStatus = (typeof VALID_QA_REVIEW_STATUSES)[number]

export interface QaReviewSummaryArgs {
  inputPath: string | null
  manifestPath: string | null
  strictManifest: boolean
  strictReviewedRows: boolean
  strictReviewedSegments: boolean
  nextReviewRowsLimit: number
  nextReviewOutPath: string | null
  outPath: string | null
  json: boolean
  minReviewed: number
  requireStatuses: string[]
  requireBuckets: string[]
  minReviewedBuckets: Record<string, number>
}

export interface QaReviewSummaryParams {
  inputPath: string
  manifestPath?: string | null
  strictManifest?: boolean
  strictReviewedRows?: boolean
  strictReviewedSegments?: boolean
  nextReviewRowsLimit?: number
  minReviewed?: number
  requireStatuses?: string[]
  requireBuckets?: string[]
  minReviewedBuckets?: Record<string, number>
}

export interface QaReviewRequirements {
  minReviewedRemaining: number
  estimatedMinimumNewReviews: number
  missingStatuses: string[]
  missingBuckets: string[]
  bucketMinimumsRemaining: Record<string, number>
}

export interface QaReviewNextRow {
  rowNumber: number
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
}

export interface QaReviewPacketManifestSummary {
  path: string
  districtId: string | null
  csvPath: string | null
  datasetBaseDir: string | null
  datasetHash: string | null
  configHash: string | null
  generatedAt: string | null
  publishedAt: string | null
  strategy: string | null
  hhmm: string | null
  topN: number | null
  rowsTotal: number | null
}

export interface QaReviewSummary {
  inputPath: string
  manifest?: QaReviewPacketManifestSummary | null
  totalRows: number
  reviewedRows: number
  validReviewedRows: number
  pendingRows: number
  invalidStatusRows: number
  missingIdentityRows: number
  missingEvidenceRows?: number
  invalidTimestampRows?: number
  duplicateReviewedSegments: number
  duplicateReviewedRows: number
  conflictingReviewedSegments: number
  statusCounts: Record<string, number>
  reviewSourceCounts: Record<string, number>
  bucketCounts: Record<string, number>
  reviewedBucketCounts: Record<string, number>
  districtCounts: Record<string, number>
  reviewRequirements: QaReviewRequirements
  nextReviewRows: QaReviewNextRow[]
  errors: string[]
  warnings: string[]
  pass: boolean
}
