import type { ResolvedConfig } from './readConfig'

export const METRICS_SCHEMA_VERSION = 1

type Counts = {
  segments: number
  busStops: number
  hydrants: number
  parkingSpaces: number
  intersections: number
  crosswalks: number
  signOverrides: number
  overridesApplied: number
  inferredCandidates: number
}

type QualityMetrics = {
  segmentsCount: number
  curbMarkingKnownRate: number
  restrictionTriggeredRate: number
  signOverrideMatchedSegmentCount: number
  signOverrideSpatialMatchCount: number
  signOverrideUnmatchedNamedCount: number
}

type FileHashes = {
  files: Record<string, string>
  totalBytes: number
}

type IntersectionsReport = {
  counts: Record<string, number>
  angleSpreadHistogram: number[]
  removed: Record<string, number>
} | null

type BuildDatasetMetaResultOptions = {
  config: ResolvedConfig
  counts: Counts
  districtName: string
  fileHashes: FileHashes
  parkingSpacesBBox: number[] | null
  intersectionsBBox: number[] | null
  crosswalksBBox: number[] | null
  signOverridesBBox: number[] | null
  inferredCandidatesBBox: number[] | null
  boundaryBBox: number[] | null
  boundaryCenter: number[] | null
  inferredRiskCounts: Record<string, number>
  provenanceFetchedAt: string | null
  qualityMetrics: QualityMetrics
  intersectionsReport: IntersectionsReport
  signOverridesUpdatedAt: string | null
  signOverridesFreshnessDays: number | null
}

export const buildDatasetMetaResult = ({
  config,
  counts,
  districtName,
  fileHashes,
  parkingSpacesBBox,
  intersectionsBBox,
  crosswalksBBox,
  signOverridesBBox,
  inferredCandidatesBBox,
  boundaryBBox,
  boundaryCenter,
  inferredRiskCounts,
  provenanceFetchedAt,
  qualityMetrics,
  intersectionsReport,
  signOverridesUpdatedAt,
  signOverridesFreshnessDays,
}: BuildDatasetMetaResultOptions) => {
  return {
    schemaVersion: 1,
    metricsSchemaVersion: METRICS_SCHEMA_VERSION,
    districtId: config.districtId,
    districtName,
    generatedAt: new Date().toISOString(),
    configPath: config.configPath,
    configHash: config.configHash,
    datasetHash: config.datasetHash,
    segmentsCount: qualityMetrics.segmentsCount,
    parkingSpacesCount: counts.parkingSpaces,
    overridesAppliedCount: counts.overridesApplied,
    signOverridesCount: counts.signOverrides,
    signOverrideMatchedSegmentCount: qualityMetrics.signOverrideMatchedSegmentCount,
    signOverrideSpatialMatchCount: qualityMetrics.signOverrideSpatialMatchCount,
    signOverrideUnmatchedNamedCount: qualityMetrics.signOverrideUnmatchedNamedCount,
    curbMarkingKnownRate: qualityMetrics.curbMarkingKnownRate,
    restrictionTriggeredRate: qualityMetrics.restrictionTriggeredRate,
    provenanceFetchedAt,
    signOverrideMatchToleranceMeters: config.signOverrides.matchToleranceMeters,
    sourceFiles: config.sourceFiles,
    counts: {
      ...counts,
      zones: counts.busStops + counts.hydrants + counts.intersections + counts.crosswalks,
    },
    parkingSpacesBBox,
    intersectionsBBox,
    crosswalksBBox,
    signOverridesBBox,
    inferredCandidatesBBox,
    boundaryBBox,
    boundaryCenter,
    inferredRiskCounts,
    signOverridesUpdatedAt,
    signOverridesFreshnessDays,
    intersectionsReport: intersectionsReport
      ? {
          counts: intersectionsReport.counts,
          angleSpreadHistogram: intersectionsReport.angleSpreadHistogram,
          removed: intersectionsReport.removed,
        }
      : null,
    files: fileHashes.files,
    totalBytes: fileHashes.totalBytes,
  }
}
