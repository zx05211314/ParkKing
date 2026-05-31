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

export interface WriteMetricsHistoryArgs {
  packDir: string | null
  prevPackDir: string | null
}

export interface WriteMetricsHistoryParams {
  packDir: string
  prevPackDir?: string | null
}

export interface PackLayout {
  kind: 'single' | 'multi'
  districts: Map<string, string>
}

export const HISTORY_SCHEMA_VERSION = 1
export const HISTORY_MAX_LINES = 180
