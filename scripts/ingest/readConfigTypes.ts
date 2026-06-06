export interface IngestConfig {
  districtId?: string
  districtName?: string
  boundary?: {
    featureId?: string | number
    name?: string
    aliases?: string[]
  }
  inputs: {
    districtBounds: string
    redYellow: string
    busStops: string
    hydrants: string
    parking_spaces?: string
    road_centerlines?: string
    intersections?: string
    crosswalks?: string
    sign_overrides?: string
    candidates_inferred?: string
  }
  outputs?: {
    generatedDir?: string
    publicDir?: string
  }
  crs?: {
    default?: string
  }
  intersections?: {
    snapToleranceMeters?: number
    angleDiversityDegrees?: number
    includeRoadClasses?: string[]
    excludeRoadClasses?: string[]
  }
  crosswalks?: {
    bufferMeters?: number
  }
  signOverrides?: {
    matchToleranceMeters?: number
  }
  inferredCandidates?: {
    offsetMeters?: number
    includeRoadClasses?: string[]
    excludeRoadClasses?: string[]
  }
  ops?: {
    thresholds?: {
      counts?: {
        segments?: number
        intersections?: number
        inferredCandidates?: number
        signOverrides?: number
        signOverrideUnmatchedNamedCount?: number
      }
      tierDistributionMaxDeltaPct?: number
      perfRegressionMaxDeltaPct?: number
      maxReasonCodeDeltaPct?: number
      maxNewReasonCodePct?: number
    }
    retention?: {
      maxBackupsPerDistrict?: number
      maxBackupAgeDays?: number
    }
  }
  validation?: {
    minCounts?: {
      districtBounds?: number
      redYellow?: number
      busStops?: number
      hydrants?: number
      parkingSpaces?: number
      intersections?: number
      crosswalks?: number
      signOverrides?: number
      overridesApplied?: number
      inferredCandidates?: number
    }
  }
}

export interface SourceFileMeta {
  path: string
  mtimeMs: number
  size: number
  sourceKey?: string
  contentHash?: string
}

export interface ResolvedConfig {
  districtId: string
  districtName: string
  boundary: {
    featureId?: string
    names: string[]
  }
  configPath: string
  configHash: string
  datasetHash: string
  inputs: IngestConfig['inputs']
  outputs: {
    generatedDir: string
    publicDir: string
  }
  crs: {
    default: string
  }
  intersections: {
    snapToleranceMeters: number
    angleDiversityDegrees: number
    includeRoadClasses: string[]
    excludeRoadClasses: string[]
  }
  crosswalks: {
    bufferMeters: number
  }
  signOverrides: {
    matchToleranceMeters: number
  }
  inferredCandidates: {
    offsetMeters: number
    includeRoadClasses: string[]
    excludeRoadClasses: string[]
  }
  ops: {
    thresholds: {
      counts: {
        segments: number
        intersections: number
        inferredCandidates: number
        signOverrides: number
        signOverrideUnmatchedNamedCount: number
      }
      tierDistributionMaxDeltaPct: number
      perfRegressionMaxDeltaPct: number
      maxReasonCodeDeltaPct: number
      maxNewReasonCodePct: number
    }
    retention: {
      maxBackupsPerDistrict: number
      maxBackupAgeDays: number
    }
  }
  validation: {
    minCounts: {
      districtBounds: number
      redYellow: number
      busStops: number
      hydrants: number
      parkingSpaces: number
      intersections: number
      crosswalks: number
      signOverrides: number
      overridesApplied: number
      inferredCandidates: number
    }
  }
  sourceFiles: SourceFileMeta[]
}
