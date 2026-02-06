import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'

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
      intersections?: number
      crosswalks?: number
      signOverrides?: number
      inferredCandidates?: number
    }
  }
}

export interface SourceFileMeta {
  path: string
  mtimeMs: number
  size: number
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
      intersections: number
      crosswalks: number
      signOverrides: number
      inferredCandidates: number
    }
  }
  sourceFiles: SourceFileMeta[]
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const configIndex = args.findIndex((arg) => arg === '--config' || arg === '-c')
  if (configIndex >= 0 && args[configIndex + 1]) {
    return args[configIndex + 1]
  }
  return null
}

const resolveMaybeRelative = (configDir: string, target: string) => {
  return path.isAbsolute(target) ? target : path.resolve(configDir, target)
}

const normalizeDistrictIdLocal = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return 'district'
  }
  const dashed = trimmed.replace(/[\s_]+/g, '-')
  const normalized = dashed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'district'
}

const hashString = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export const readConfig = async (argv: string[] = process.argv): Promise<ResolvedConfig> => {
  const configArg = parseArgs(argv)
  if (!configArg) {
    throw new Error(
      'Missing --config. Example: npm run ingest -- --config ingest.config.json',
    )
  }

  const configPath = path.resolve(configArg)
  const raw = await fs.readFile(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as IngestConfig

  if (!parsed.inputs) {
    throw new Error('Config missing inputs section.')
  }

  const inputsRaw = parsed.inputs as Record<string, string | undefined>
  const pickInput = (key: string, aliases: string[] = []) => {
    const direct = inputsRaw[key]
    if (direct) {
      return direct
    }
    for (const alias of aliases) {
      const value = inputsRaw[alias]
      if (value) {
        return value
      }
    }
    return undefined
  }

  const requiredInputs = [
    'districtBounds',
    'redYellow',
    'busStops',
    'hydrants',
  ] as const
  for (const key of requiredInputs) {
    const value = pickInput(key, [
      key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`),
    ])
    if (!value) {
      throw new Error(`Config missing inputs.${key}`)
    }
  }

  const configDir = path.dirname(configPath)
  const inputs = {
    districtBounds: resolveMaybeRelative(
      configDir,
      pickInput('districtBounds', ['district_bounds']) ?? '',
    ),
    redYellow: resolveMaybeRelative(
      configDir,
      pickInput('redYellow', ['red_yellow']) ?? '',
    ),
    busStops: resolveMaybeRelative(
      configDir,
      pickInput('busStops', ['bus_stops']) ?? '',
    ),
    hydrants: resolveMaybeRelative(
      configDir,
      pickInput('hydrants', ['hydrants']) ?? '',
    ),
    road_centerlines: pickInput('road_centerlines', ['roadCenterlines'])
      ? resolveMaybeRelative(
          configDir,
          pickInput('road_centerlines', ['roadCenterlines']) ?? '',
        )
      : undefined,
    intersections: pickInput('intersections', ['intersection_points'])
      ? resolveMaybeRelative(
          configDir,
          pickInput('intersections', ['intersection_points']) ?? '',
        )
      : undefined,
    crosswalks: pickInput('crosswalks', ['cross_walks'])
      ? resolveMaybeRelative(configDir, pickInput('crosswalks', ['cross_walks']) ?? '')
      : undefined,
    sign_overrides: pickInput('sign_overrides', ['signOverrides'])
      ? resolveMaybeRelative(
          configDir,
          pickInput('sign_overrides', ['signOverrides']) ?? '',
        )
      : undefined,
    candidates_inferred: pickInput('candidates_inferred', ['candidatesInferred'])
      ? resolveMaybeRelative(
          configDir,
          pickInput('candidates_inferred', ['candidatesInferred']) ?? '',
        )
      : undefined,
  }

  const districtIdRaw = parsed.districtId ?? 'xinyi'
  const districtId = normalizeDistrictIdLocal(districtIdRaw)
  const districtName = parsed.districtName ?? districtIdRaw

  const outputs = {
    generatedDir: resolveMaybeRelative(
      configDir,
      parsed.outputs?.generatedDir ?? `data/generated/${districtId}`,
    ),
    publicDir: resolveMaybeRelative(
      configDir,
      parsed.outputs?.publicDir ?? `public/data/generated/${districtId}`,
    ),
  }

  const boundaryNames = [
    parsed.boundary?.name,
    ...(parsed.boundary?.aliases ?? []),
  ]
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const boundary = {
    featureId:
      parsed.boundary?.featureId !== undefined
        ? String(parsed.boundary.featureId)
        : undefined,
    names: boundaryNames,
  }

  const crsDefault = parsed.crs?.default ?? 'EPSG:3826'

  const minCounts = {
    districtBounds: parsed.validation?.minCounts?.districtBounds ?? 1,
    redYellow: parsed.validation?.minCounts?.redYellow ?? 1,
    busStops: parsed.validation?.minCounts?.busStops ?? 1,
    hydrants: parsed.validation?.minCounts?.hydrants ?? 1,
    intersections: parsed.validation?.minCounts?.intersections ?? 1,
    crosswalks: parsed.validation?.minCounts?.crosswalks ?? 0,
    signOverrides: parsed.validation?.minCounts?.signOverrides ?? 0,
    inferredCandidates: parsed.validation?.minCounts?.inferredCandidates ?? 0,
  }

  const opsThresholds = {
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
  }

  const opsRetention = {
    maxBackupsPerDistrict: parsed.ops?.retention?.maxBackupsPerDistrict ?? 5,
    maxBackupAgeDays: parsed.ops?.retention?.maxBackupAgeDays ?? 30,
  }

  const sourceFiles: SourceFileMeta[] = []
  for (const [key, filePath] of Object.entries(inputs)) {
    if (!filePath) {
      continue
    }
    try {
      const stat = await fs.stat(filePath)
      sourceFiles.push({
        path: filePath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      })
    } catch {
      throw new Error(`Input file not found for ${key}: ${filePath}`)
    }
  }

  const configHash = hashString(raw)
  const datasetHash = hashString(JSON.stringify({ configHash, sourceFiles }))

  return {
    districtId,
    districtName,
    boundary,
    configPath,
    configHash,
    datasetHash,
    inputs,
    outputs,
    crs: { default: crsDefault },
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
    ops: {
      thresholds: opsThresholds,
      retention: opsRetention,
    },
    validation: { minCounts },
    sourceFiles,
  }
}
