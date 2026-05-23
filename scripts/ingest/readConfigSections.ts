import { normalizeDistrictId } from './ingestDistrictPaths'
import type { IngestConfig, ResolvedConfig } from './readConfigTypes'
import { resolveMaybeRelative } from './readConfigInputs'

export const resolveDistrictIdentity = (parsed: IngestConfig) => {
  const districtIdRaw = parsed.districtId ?? 'xinyi'
  return {
    districtId: normalizeDistrictId(districtIdRaw),
    districtName: parsed.districtName ?? districtIdRaw,
  }
}

export const resolveOutputConfig = (
  parsed: IngestConfig,
  configDir: string,
  districtId: string,
): ResolvedConfig['outputs'] => ({
  generatedDir: resolveMaybeRelative(
    configDir,
    parsed.outputs?.generatedDir ?? `data/generated/${districtId}`,
  ),
  publicDir: resolveMaybeRelative(
    configDir,
    parsed.outputs?.publicDir ?? `public/data/generated/${districtId}`,
  ),
})

export const resolveBoundaryConfig = (
  parsed: IngestConfig,
): ResolvedConfig['boundary'] => {
  const boundaryNames = [parsed.boundary?.name, ...(parsed.boundary?.aliases ?? [])]
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return {
    featureId:
      parsed.boundary?.featureId !== undefined
        ? String(parsed.boundary.featureId)
        : undefined,
    names: boundaryNames,
  }
}

export const resolveValidationConfig = (
  parsed: IngestConfig,
): ResolvedConfig['validation'] => ({
  minCounts: {
    districtBounds: parsed.validation?.minCounts?.districtBounds ?? 1,
    redYellow: parsed.validation?.minCounts?.redYellow ?? 1,
    busStops: parsed.validation?.minCounts?.busStops ?? 1,
    hydrants: parsed.validation?.minCounts?.hydrants ?? 1,
    parkingSpaces: parsed.validation?.minCounts?.parkingSpaces ?? 0,
    intersections: parsed.validation?.minCounts?.intersections ?? 1,
    crosswalks: parsed.validation?.minCounts?.crosswalks ?? 0,
    signOverrides: parsed.validation?.minCounts?.signOverrides ?? 0,
    overridesApplied: parsed.validation?.minCounts?.overridesApplied ?? 0,
    inferredCandidates: parsed.validation?.minCounts?.inferredCandidates ?? 0,
  },
})

export const resolveOpsConfig = (parsed: IngestConfig): ResolvedConfig['ops'] => ({
  thresholds: {
    counts: {
      segments: parsed.ops?.thresholds?.counts?.segments ?? 20,
      intersections: parsed.ops?.thresholds?.counts?.intersections ?? 20,
      inferredCandidates: parsed.ops?.thresholds?.counts?.inferredCandidates ?? 30,
      signOverrides: parsed.ops?.thresholds?.counts?.signOverrides ?? 30,
    },
    tierDistributionMaxDeltaPct:
      parsed.ops?.thresholds?.tierDistributionMaxDeltaPct ?? 15,
    perfRegressionMaxDeltaPct: parsed.ops?.thresholds?.perfRegressionMaxDeltaPct ?? 30,
    maxReasonCodeDeltaPct: parsed.ops?.thresholds?.maxReasonCodeDeltaPct ?? 20,
    maxNewReasonCodePct: parsed.ops?.thresholds?.maxNewReasonCodePct ?? 5,
  },
  retention: {
    maxBackupsPerDistrict: parsed.ops?.retention?.maxBackupsPerDistrict ?? 5,
    maxBackupAgeDays: parsed.ops?.retention?.maxBackupAgeDays ?? 30,
  },
})

export const resolveDerivedConfigSections = (
  parsed: IngestConfig,
): Pick<
  ResolvedConfig,
  'crs' | 'intersections' | 'crosswalks' | 'signOverrides' | 'inferredCandidates'
> => ({
  crs: { default: parsed.crs?.default ?? 'EPSG:3826' },
  intersections: {
    snapToleranceMeters: parsed.intersections?.snapToleranceMeters ?? 10,
    angleDiversityDegrees: parsed.intersections?.angleDiversityDegrees ?? 25,
    includeRoadClasses: parsed.intersections?.includeRoadClasses ?? [],
    excludeRoadClasses: parsed.intersections?.excludeRoadClasses ?? [],
  },
  crosswalks: {
    bufferMeters: parsed.crosswalks?.bufferMeters ?? 6,
  },
  signOverrides: {
    matchToleranceMeters: parsed.signOverrides?.matchToleranceMeters ?? 15,
  },
  inferredCandidates: {
    offsetMeters: parsed.inferredCandidates?.offsetMeters ?? 3.5,
    includeRoadClasses: parsed.inferredCandidates?.includeRoadClasses ?? [],
    excludeRoadClasses: parsed.inferredCandidates?.excludeRoadClasses ?? [],
  },
})
