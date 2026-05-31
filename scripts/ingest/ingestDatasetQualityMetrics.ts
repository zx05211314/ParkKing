import type {
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson'
import {
  applySignOverridesWithStats,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'
import { evaluateSegment } from '../../src/domain/rules/evaluateSegment'

const METRICS_SAMPLE_HHMM = '13:00'

const extractRiskTags = (properties: GeoJsonProperties | null): string[] => {
  if (!properties) {
    return []
  }
  const raw =
    properties.riskTags ?? properties.risk_tags ?? properties.riskTag ?? properties.risk_tag

  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry)).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

export const countRiskTags = (collection: FeatureCollection | null) => {
  if (!collection) {
    return null
  }
  const counts: Record<string, number> = {}
  collection.features.forEach((feature) => {
    const tags = extractRiskTags(feature.properties ?? null)
    tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1
    })
  })
  return counts
}

export const buildQualityMetrics = (
  redYellow: FeatureCollection | null,
  signOverridesCollection: FeatureCollection | null,
  matchToleranceMeters: number,
  inferredCandidates: FeatureCollection | null = null,
) => {
  if (!redYellow || redYellow.features.length === 0) {
    return {
      segmentsCount: 0,
      curbMarkingKnownRate: 0,
      restrictionTriggeredRate: 0,
      signOverrideMatchedSegmentCount: 0,
      signOverrideSpatialMatchCount: 0,
      signOverrideUnmatchedNamedCount: 0,
    }
  }

  const segments = (redYellow as FeatureCollection<LineString | MultiLineString>).features
    .flatMap((feature, index) => buildSegmentsFromFeature(feature, index, null))
  const inferredSegments = inferredCandidates
    ? (inferredCandidates as FeatureCollection<LineString | MultiLineString>).features
        .flatMap((feature, index) => buildInferredSegmentsFromFeature(feature, index, null))
    : []
  const overrideCandidateSegments = [...segments, ...inferredSegments]

  const overrideResult = signOverridesCollection
    ? applySignOverridesWithStats(overrideCandidateSegments, signOverridesCollection, {
        matchToleranceMeters,
      })
    : {
        segments: overrideCandidateSegments,
        stats: {
          matchedBySegmentIdCount: 0,
          matchedBySpatialCount: 0,
          unmatchedNamedOverrideCount: 0,
        },
      }

  const segmentsWithOverrides = overrideResult.segments.slice(0, segments.length)

  const segmentsCount = segmentsWithOverrides.length
  if (segmentsCount === 0) {
    return {
      segmentsCount: 0,
      curbMarkingKnownRate: 0,
      restrictionTriggeredRate: 0,
      signOverrideMatchedSegmentCount: 0,
      signOverrideSpatialMatchCount: 0,
      signOverrideUnmatchedNamedCount: 0,
    }
  }

  const knownCount = segmentsWithOverrides.filter(
    (segment) => segment.curbMarking !== 'UNKNOWN',
  ).length
  const triggeredCount = segmentsWithOverrides.filter((segment) => {
    const evaluated = evaluateSegment(segment, METRICS_SAMPLE_HHMM)
    return evaluated.allowedNow !== 'PARK'
  }).length

  return {
    segmentsCount,
    curbMarkingKnownRate: knownCount / segmentsCount,
    restrictionTriggeredRate: triggeredCount / segmentsCount,
    signOverrideMatchedSegmentCount: overrideResult.stats.matchedBySegmentIdCount,
    signOverrideSpatialMatchCount: overrideResult.stats.matchedBySpatialCount,
    signOverrideUnmatchedNamedCount: overrideResult.stats.unmatchedNamedOverrideCount,
  }
}
