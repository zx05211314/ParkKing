import type { BaselineCounts } from './generateBaselineRecordTypes'

export const buildBaselineCounts = (meta: Record<string, unknown>): BaselineCounts => {
  const counts = (meta.counts as Record<string, number>) ?? {}
  return {
    segments: counts.segments ?? 0,
    intersections: counts.intersections ?? 0,
    inferredCandidates: counts.inferredCandidates ?? 0,
    signOverrides: counts.signOverrides ?? 0,
    signOverrideUnmatchedNamedCount:
      typeof meta.signOverrideUnmatchedNamedCount === 'number'
        ? meta.signOverrideUnmatchedNamedCount
        : counts.signOverrideUnmatchedNamedCount ?? 0,
  }
}
