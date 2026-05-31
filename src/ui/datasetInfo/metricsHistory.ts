import {
  formatSigned,
  formatSignedPercent,
  formatSignedPoints,
} from './formatting'
import type { HealthDelta, MetricsHistoryEntry } from './types'

interface DatasetInfoHealthDeltaOptions {
  segmentsCount: number | null
  overridesAppliedCount: number | null
  signOverrideUnmatchedNamedCount: number | null
  curbMarkingKnownRate: number | null
  restrictionTriggeredRate: number | null
  previousEntry: MetricsHistoryEntry | null
}

const normalizeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const computeDelta = (prev: unknown, next: unknown) => {
  const normalizedPrev = normalizeNumber(prev)
  const normalizedNext = normalizeNumber(next)
  if (normalizedPrev === null || normalizedNext === null) {
    return { delta: null, deltaPct: null }
  }
  const delta = normalizedNext - normalizedPrev
  const deltaPct = normalizedPrev !== 0 ? delta / normalizedPrev : null
  return { delta, deltaPct }
}

export const parseMetricsHistory = (raw?: string | null): MetricsHistoryEntry[] => {
  if (!raw) {
    return []
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as MetricsHistoryEntry
        if (parsed && typeof parsed.districtId === 'string') {
          return parsed
        }
      } catch {
        return null
      }
      return null
    })
    .filter((entry): entry is MetricsHistoryEntry => Boolean(entry))
}

export const findPreviousMetricsHistoryEntry = (
  entries: MetricsHistoryEntry[],
  currentPublishedAt: string | null,
) => {
  if (entries.length === 0) {
    return null
  }
  const lastEntry = entries[entries.length - 1]
  if (currentPublishedAt && lastEntry.publishedAt === currentPublishedAt) {
    return entries.length > 1 ? entries[entries.length - 2] : null
  }
  return lastEntry
}

export const buildDatasetInfoDeltaBadges = ({
  segmentsCount,
  overridesAppliedCount,
  signOverrideUnmatchedNamedCount,
  curbMarkingKnownRate,
  restrictionTriggeredRate,
  previousEntry,
}: DatasetInfoHealthDeltaOptions): HealthDelta[] => {
  const segmentsDelta = computeDelta(
    previousEntry ? previousEntry.segmentsCount : null,
    segmentsCount,
  )
  const overridesDelta = computeDelta(
    previousEntry ? previousEntry.overridesAppliedCount : null,
    overridesAppliedCount,
  )
  const unmatchedNamedDelta = computeDelta(
    previousEntry ? previousEntry.signOverrideUnmatchedNamedCount : null,
    signOverrideUnmatchedNamedCount,
  )
  const curbDelta = computeDelta(
    previousEntry ? previousEntry.curbMarkingKnownRate : null,
    curbMarkingKnownRate,
  )
  const restrictionDelta = computeDelta(
    previousEntry ? previousEntry.restrictionTriggeredRate : null,
    restrictionTriggeredRate,
  )

  return [
    {
      key: 'segments',
      label: 'Segments Δ',
      value:
        segmentsDelta.delta === null
          ? '-'
          : `${formatSigned(segmentsDelta.delta, 0)}${
              segmentsDelta.deltaPct !== null
                ? ` (${formatSignedPercent(segmentsDelta.deltaPct)})`
                : ''
            }`,
      warn: segmentsDelta.deltaPct !== null && segmentsDelta.deltaPct <= -0.1,
    },
    {
      key: 'overrides',
      label: 'Overrides Δ',
      value: overridesDelta.delta === null ? '-' : formatSigned(overridesDelta.delta, 0),
      warn: false,
    },
    {
      key: 'namedOverrideMismatch',
      label: 'Named overrides Δ',
      value:
        unmatchedNamedDelta.delta === null
          ? '-'
          : formatSigned(unmatchedNamedDelta.delta, 0),
      warn: unmatchedNamedDelta.delta !== null && unmatchedNamedDelta.delta > 0,
    },
    {
      key: 'curbKnown',
      label: 'Curb known Δ',
      value: curbDelta.delta === null ? '-' : formatSignedPoints(curbDelta.delta),
      warn: curbDelta.delta !== null && curbDelta.delta <= -0.1,
    },
    {
      key: 'restrictions',
      label: 'Restrictions Δ',
      value:
        restrictionDelta.delta === null ? '-' : formatSignedPoints(restrictionDelta.delta),
      warn: restrictionDelta.delta !== null && restrictionDelta.delta <= -0.01,
    },
  ]
}
