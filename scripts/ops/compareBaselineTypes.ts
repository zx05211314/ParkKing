export interface OpsThresholds {
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
    signOverrideUnmatchedNamedCount: number
  }
  tierDistributionMaxDeltaPct: number
  perfRegressionMaxDeltaPct: number
  maxReasonCodeDeltaPct: number
  maxNewReasonCodePct: number
}

export type Severity = 'INFO' | 'WARN' | 'FAIL'

export interface ReasonCodeDistribution {
  top: Record<string, number>
  other: number
  total: number
  coveragePct: number
}

export interface BaselineMetrics {
  baselineCreatedAt?: string
  baselineDatasetHash?: string
  baselineSchemaVersion?: number
  baselineSourceMetaSha256?: string
  baselineDistrictName?: string
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
    signOverrideUnmatchedNamedCount: number
  }
  distributions: {
    day: Record<string, number>
    night: Record<string, number>
  }
  performance: {
    day: { evalFirstMsMedian: number; evalSecondMsMedian?: number }
    night: { evalFirstMsMedian: number; evalSecondMsMedian?: number }
  }
  reasonCodes: {
    day: ReasonCodeDistribution
    night: ReasonCodeDistribution
  }
}

export interface CurrentMetrics {
  datasetHash?: string
  schemaVersion?: number
  counts: {
    segments: number
    intersections: number
    inferredCandidates: number
    signOverrides: number
  }
  distributions: {
    day: Record<string, number>
    night: Record<string, number>
  }
  performance: {
    day: { evalFirstMs: number; evalSecondMs?: number }
    night: { evalFirstMs: number; evalSecondMs?: number }
  }
  reasonCodes: {
    day: { counts: Record<string, number>; total: number; coveragePct: number }
    night: { counts: Record<string, number>; total: number; coveragePct: number }
  }
}

export interface Warning {
  severity: Severity
  code:
    | 'COUNT_DELTA'
    | 'TIER_DELTA'
    | 'PERF_REGRESSION'
    | 'REASON_CODE_DELTA'
    | 'REASON_CODE_NEW'
    | 'REASON_CODE_COVERAGE_DROP'
    | 'BASELINE_MISSING'
    | 'BASELINE_SCHEMA_MISMATCH'
    | 'BASELINE_HASH_MATCH'
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}
