export interface LatestPointer {
  datasetHash: string
  publishedAt: string
  manifestPath?: string
  schemaVersion?: number
}

export interface DatasetManifest {
  districtId: string
  districtName: string
  schemaVersion: number
  datasetHash: string
  configHash: string
  generatedAt: string
  publishedAt: string
  metaSha256: string
  packSha256: string
  totalBytes: number
  gateResult?: string
  overrideReason?: string | null
}

export interface DatasetMetaSummary {
  districtId?: string
  districtName?: string
  schemaVersion?: number
  metricsSchemaVersion?: number
  datasetHash?: string
  configHash?: string
  generatedAt?: string
  publishedAt?: string
  segmentsCount?: number
  overridesAppliedCount?: number
  signOverridesCount?: number
  signOverrideMatchedSegmentCount?: number
  signOverrideSpatialMatchCount?: number
  signOverrideUnmatchedNamedCount?: number
  curbMarkingKnownRate?: number
  restrictionTriggeredRate?: number
  provenanceFetchedAt?: string | null
  totalBytes?: number
  files?: Record<string, { sha256: string; bytes: number }>
}

export interface MetricsHistoryEntry {
  schemaVersion: number
  publishedAt: string
  packId: string
  districtId: string
  segmentsCount: number
  overridesAppliedCount: number
  signOverridesCount: number
  signOverrideUnmatchedNamedCount: number
  curbMarkingKnownRate: number
  restrictionTriggeredRate: number
  provenanceFetchedAt: string | null
}

export interface HealthDelta {
  key: string
  label: string
  value: string
  warn: boolean
}

export interface IngestReport {
  districts?: Array<{
    districtId?: string
    warnings?: Array<{ severity?: string; code?: string; message?: string }>
  }>
}

export interface DatasetInfoModel {
  districtId: string
  districtName: string
  dataSource: string
  schemaVersion: string
  datasetHash: string
  configHash: string
  generatedAt: string
  publishedAt: string
  metaSha256: string
  packSha256: string
  totalBytes: string
  gateResult: string
  anomalies: string[]
  health: {
    districtId: string
    lastUpdated: string
    publishedAt: string
    segmentsCount: string
    signOverridesCount: string
    signOverrideMatchedSegmentCount: string
    signOverrideSpatialMatchCount: string
    overridesAppliedCount: string
    signOverrideUnmatchedNamedCount: string
    curbMarkingKnownRate: string
    restrictionTriggeredRate: string
    warnings: string[]
    deltas: HealthDelta[]
  }
}

export interface BuildDatasetInfoModelParams {
  latest: LatestPointer | null
  meta: DatasetMetaSummary | null
  manifest: DatasetManifest | null
  report: IngestReport | null
  metricsHistory?: string | null
  dataSource?: string
}
