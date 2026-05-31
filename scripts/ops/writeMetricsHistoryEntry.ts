import {
  HISTORY_SCHEMA_VERSION,
  type MetricsHistoryEntry,
} from './writeMetricsHistoryTypes'

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const buildMetricsHistoryEntry = (
  meta: Record<string, unknown>,
  packId: string,
): MetricsHistoryEntry => {
  const counts =
    meta.counts && typeof meta.counts === 'object'
      ? (meta.counts as Record<string, unknown>)
      : null

  const segmentsCount =
    parseNumber(meta.segmentsCount) ??
    (counts ? parseNumber(counts.segments) : null) ??
    0
  const overridesAppliedCount =
    parseNumber(meta.overridesAppliedCount) ??
    (counts ? parseNumber(counts.overridesApplied) : null) ??
    0
  const signOverridesCount =
    parseNumber(meta.signOverridesCount) ??
    (counts ? parseNumber(counts.signOverrides) : null) ??
    0
  const signOverrideUnmatchedNamedCount =
    parseNumber(meta.signOverrideUnmatchedNamedCount) ??
    (counts ? parseNumber(counts.signOverrideUnmatchedNamedCount) : null) ??
    0
  const curbMarkingKnownRate = parseNumber(meta.curbMarkingKnownRate) ?? 0
  const restrictionTriggeredRate = parseNumber(meta.restrictionTriggeredRate) ?? 0

  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    publishedAt:
      typeof meta.publishedAt === 'string' && meta.publishedAt.trim().length > 0
        ? meta.publishedAt
        : new Date().toISOString(),
    packId,
    districtId:
      typeof meta.districtId === 'string' && meta.districtId.trim().length > 0
        ? meta.districtId
        : 'unknown',
    segmentsCount,
    overridesAppliedCount,
    signOverridesCount,
    signOverrideUnmatchedNamedCount,
    curbMarkingKnownRate,
    restrictionTriggeredRate,
    provenanceFetchedAt:
      typeof meta.provenanceFetchedAt === 'string' ? meta.provenanceFetchedAt : null,
  }
}
