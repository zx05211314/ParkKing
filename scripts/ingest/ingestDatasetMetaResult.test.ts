import { describe, expect, it, vi } from 'vitest'
import type { ResolvedConfig } from './readConfig'
import { buildDatasetMetaResult } from './ingestDatasetMetaResult'

const createConfig = (): ResolvedConfig =>
  ({
    districtId: 'xinyi',
    districtName: 'Xinyi',
    boundary: { names: ['Xinyi'] },
    configPath: 'C:/config.json',
    configHash: 'config-hash',
    datasetHash: 'dataset-hash',
    inputs: {},
    outputs: {
      generatedDir: 'C:/generated/xinyi',
      publicDir: 'C:/public/generated/xinyi',
    },
    crs: { default: 'EPSG:4326' },
    intersections: {
      snapToleranceMeters: 10,
      angleDiversityDegrees: 15,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    crosswalks: { bufferMeters: 5 },
    signOverrides: { matchToleranceMeters: 6 },
    inferredCandidates: {
      offsetMeters: 2,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    ops: {
      thresholds: {
        counts: {
          segments: 0,
          intersections: 0,
          inferredCandidates: 0,
          signOverrides: 0,
        },
        tierDistributionMaxDeltaPct: 0,
        perfRegressionMaxDeltaPct: 0,
        maxReasonCodeDeltaPct: 0,
        maxNewReasonCodePct: 0,
      },
      retention: {
        maxBackupsPerDistrict: 5,
        maxBackupAgeDays: 30,
      },
    },
    validation: {
      minCounts: {
        districtBounds: 1,
        redYellow: 1,
        busStops: 1,
        hydrants: 1,
        parkingSpaces: 0,
        intersections: 1,
        crosswalks: 0,
        signOverrides: 0,
        inferredCandidates: 0,
      },
    },
    sourceFiles: [],
  }) as never

describe('ingestDatasetMetaResult', () => {
  it('builds dataset meta with derived zones and trimmed report fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T00:00:00.000Z'))

    const result = buildDatasetMetaResult({
      config: createConfig(),
      counts: {
        segments: 5,
        busStops: 2,
        hydrants: 1,
        parkingSpaces: 3,
        intersections: 4,
        crosswalks: 1,
        signOverrides: 2,
        overridesApplied: 1,
        inferredCandidates: 6,
      },
      districtName: 'Xinyi',
      fileHashes: {
        files: { 'dataset_meta.json': { sha256: 'abc123', bytes: 1024 } },
        totalBytes: 1024,
      },
      parkingSpacesBBox: {
        minX: 121.5,
        minY: 25.0,
        maxX: 121.6,
        maxY: 25.1,
      },
      intersectionsBBox: null,
      crosswalksBBox: null,
      signOverridesBBox: null,
      inferredCandidatesBBox: null,
      boundaryBBox: {
        minX: 121.4,
        minY: 24.9,
        maxX: 121.7,
        maxY: 25.2,
      },
      boundaryCenter: [121.55, 25.05],
      inferredRiskCounts: { MAJOR_ROAD: 2 },
      provenanceFetchedAt: '2026-03-20T00:00:00.000Z',
      qualityMetrics: {
        segmentsCount: 5,
        curbMarkingKnownRate: 0.75,
        restrictionTriggeredRate: 0.5,
        signOverrideMatchedSegmentCount: 1,
        signOverrideSpatialMatchCount: 0,
        signOverrideUnmatchedNamedCount: 2,
      },
      intersectionsReport: {
        counts: { clustered: 4 },
        angleSpreadHistogram: [1, 2, 3],
        removed: { duplicates: 1 },
      },
      signOverridesUpdatedAt: '2026-03-19T00:00:00.000Z',
      signOverridesFreshnessDays: 2,
    })

    expect(result.generatedAt).toBe('2026-03-21T00:00:00.000Z')
    expect(result.metricsSchemaVersion).toBe(1)
    expect(result.counts.zones).toBe(8)
    expect(result.signOverrideMatchToleranceMeters).toBe(6)
    expect(result.signOverrideMatchedSegmentCount).toBe(1)
    expect(result.signOverrideSpatialMatchCount).toBe(0)
    expect(result.signOverrideUnmatchedNamedCount).toBe(2)
    expect(result.intersectionsReport).toEqual({
      counts: { clustered: 4 },
      angleSpreadHistogram: [1, 2, 3],
      removed: { duplicates: 1 },
    })
    expect(result.files).toEqual({
      'dataset_meta.json': { sha256: 'abc123', bytes: 1024 },
    })
    expect(result.totalBytes).toBe(1024)

    vi.useRealTimers()
  })
})
