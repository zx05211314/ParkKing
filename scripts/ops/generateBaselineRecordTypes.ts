import type { RegistryEntry } from './generateBaselineTypes'

export interface BaselineReasonCodeState {
  coveragePct: number
  counts: Record<string, number>
}

export interface BaselinePeriodState {
  medianEvalFirstMs: number
  medianEvalSecondMs: number
  distribution: Record<string, number>
  reasonCodes: BaselineReasonCodeState
  evaluatedCount: number
}

export interface BuildBaselineRecordParams {
  entry: RegistryEntry
  meta: Record<string, unknown>
  metaRaw: string
  day: BaselinePeriodState
  night: BaselinePeriodState
}

export interface BaselineCounts {
  segments: number
  intersections: number
  inferredCandidates: number
  signOverrides: number
  signOverrideUnmatchedNamedCount: number
}
