import { fallback, formatPercent } from './formatting'
import {
  buildDatasetInfoDeltaBadges,
  findPreviousMetricsHistoryEntry,
  parseMetricsHistory,
} from './metricsHistory'
import type { BuildDatasetInfoModelParams, DatasetInfoModel } from './types'

interface BuildDatasetInfoHealthOptions {
  districtId: string
  latest: BuildDatasetInfoModelParams['latest']
  meta: BuildDatasetInfoModelParams['meta']
  manifest: BuildDatasetInfoModelParams['manifest']
  report: BuildDatasetInfoModelParams['report']
  metricsHistory?: BuildDatasetInfoModelParams['metricsHistory']
}

interface DatasetInfoHealthResult {
  anomalies: string[]
  health: DatasetInfoModel['health']
  publishedAt: string
}

export const buildDatasetInfoHealth = ({
  districtId,
  latest,
  meta,
  manifest,
  report,
  metricsHistory,
}: BuildDatasetInfoHealthOptions): DatasetInfoHealthResult => {
  const warnings =
    report?.districts?.find((district) => district.districtId === districtId)?.warnings ?? []
  const anomalies = warnings
    .filter((warning) => warning.severity && warning.severity !== 'INFO')
    .map((warning) => warning.message ?? warning.code ?? 'Unknown warning')
    .slice(0, 3)

  const segmentsCount = typeof meta?.segmentsCount === 'number' ? meta.segmentsCount : null
  const overridesAppliedCount =
    typeof meta?.overridesAppliedCount === 'number' ? meta.overridesAppliedCount : null
  const signOverridesCount =
    typeof meta?.signOverridesCount === 'number' ? meta.signOverridesCount : null
  const signOverrideMatchedSegmentCount =
    typeof meta?.signOverrideMatchedSegmentCount === 'number'
      ? meta.signOverrideMatchedSegmentCount
      : null
  const signOverrideSpatialMatchCount =
    typeof meta?.signOverrideSpatialMatchCount === 'number'
      ? meta.signOverrideSpatialMatchCount
      : null
  const signOverrideUnmatchedNamedCount =
    typeof meta?.signOverrideUnmatchedNamedCount === 'number'
      ? meta.signOverrideUnmatchedNamedCount
      : null
  const curbMarkingKnownRate =
    typeof meta?.curbMarkingKnownRate === 'number' ? meta.curbMarkingKnownRate : null
  const restrictionTriggeredRate =
    typeof meta?.restrictionTriggeredRate === 'number' ? meta.restrictionTriggeredRate : null

  const metricsEntries = parseMetricsHistory(metricsHistory).filter(
    (entry) => entry.districtId === districtId,
  )
  const publishedAtRaw =
    typeof meta?.publishedAt === 'string'
      ? meta.publishedAt
      : typeof latest?.publishedAt === 'string'
        ? latest.publishedAt
        : typeof manifest?.publishedAt === 'string'
          ? manifest.publishedAt
          : null
  const previousEntry = findPreviousMetricsHistoryEntry(metricsEntries, publishedAtRaw)
  const deltaBadges = buildDatasetInfoDeltaBadges({
    segmentsCount,
    overridesAppliedCount,
    signOverrideUnmatchedNamedCount,
    curbMarkingKnownRate,
    restrictionTriggeredRate,
    previousEntry,
  })

  const overridesRatio =
    segmentsCount && overridesAppliedCount !== null ? overridesAppliedCount / segmentsCount : null
  const healthWarnings: string[] = []
  if (curbMarkingKnownRate !== null && curbMarkingKnownRate < 0.1) {
    healthWarnings.push('Low curb marking coverage')
  }
  if (restrictionTriggeredRate !== null && restrictionTriggeredRate < 0.01) {
    healthWarnings.push('Low restriction trigger rate')
  }
  if (overridesRatio !== null && overridesRatio > 0.2) {
    healthWarnings.push('High override volume')
  }
  if (signOverridesCount !== null && signOverridesCount === 0) {
    healthWarnings.push('No reviewed sign overrides')
  } else if (overridesAppliedCount !== null && overridesAppliedCount === 0) {
    healthWarnings.push('No sign overrides applied')
  }
  if (signOverrideUnmatchedNamedCount !== null && signOverrideUnmatchedNamedCount > 0) {
    healthWarnings.push('Named overrides did not match current segments')
  }

  const publishedAt = fallback(latest?.publishedAt ?? manifest?.publishedAt)
  const lastUpdated = fallback(meta?.provenanceFetchedAt ?? meta?.generatedAt ?? manifest?.generatedAt)

  return {
    anomalies,
    publishedAt,
    health: {
      districtId,
      lastUpdated,
      publishedAt,
      segmentsCount: fallback(segmentsCount),
      signOverridesCount: fallback(signOverridesCount),
      signOverrideMatchedSegmentCount: fallback(signOverrideMatchedSegmentCount),
      signOverrideSpatialMatchCount: fallback(signOverrideSpatialMatchCount),
      overridesAppliedCount: fallback(overridesAppliedCount),
      signOverrideUnmatchedNamedCount: fallback(signOverrideUnmatchedNamedCount),
      curbMarkingKnownRate: formatPercent(curbMarkingKnownRate),
      restrictionTriggeredRate: formatPercent(restrictionTriggeredRate),
      warnings: healthWarnings,
      deltas: deltaBadges,
    },
  }
}
