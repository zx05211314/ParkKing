import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
} from 'geojson'
import { PACK_FILES, PACK_FILE_LIST } from '../ingest/hashFiles'
import { diffPacks, type DiffIssue, type PackDiffReport } from './diffPacks'

export type Severity = 'INFO' | 'WARN' | 'FAIL'

export interface GateWarning {
  severity: Severity
  code: string
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}

export interface PublishGateOptions {
  reportPath?: string
  mode?: 'strict' | 'warn'
  allowWarn?: boolean
  allowFail?: boolean
  allowBaselineAdopt?: boolean
  overrideReason?: string | null
  outputDir?: string
  datasetRootDir?: string
  publishedRootDir?: string | null
}

export interface PublishGateResult {
  exitCode: number
  summary: Record<string, unknown>
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const reportIndex = args.findIndex((arg) => arg === '--report')
  const modeIndex = args.findIndex((arg) => arg === '--mode')
  const overrideIndex = args.findIndex((arg) => arg === '--override')
  const rootIndex = args.findIndex((arg) => arg === '--datasetRoot')

  return {
    reportPath: reportIndex >= 0 ? args[reportIndex + 1] : null,
    mode: modeIndex >= 0 ? args[modeIndex + 1] : null,
    allowWarn: args.includes('--allowWarn'),
    allowFail: args.includes('--allowFail'),
    allowBaselineAdopt: args.includes('--allowBaselineAdopt'),
    overrideReason: overrideIndex >= 0 ? args[overrideIndex + 1] : null,
    datasetRootDir: rootIndex >= 0 ? args[rootIndex + 1] : null,
  }
}

const resolveDefaultReport = async () => {
  const primary = path.resolve('public/data/generated/ingest_all_report.json')
  try {
    await fs.access(primary)
    return primary
  } catch {
    const fallback = path.resolve('data/generated/ingest_all_report.json')
    return fallback
  }
}

const loadReport = async (reportPath: string) => {
  const raw = await fs.readFile(reportPath, 'utf-8')
  return JSON.parse(raw) as {
    generatedAt?: string
    districts?: Array<{ districtId?: string; warnings?: GateWarning[] }>
  }
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const sha256 = (buffer: Buffer) => {
  return createHash('sha256').update(buffer).digest('hex')
}

const hashFile = async (filePath: string) => {
  const buffer = await fs.readFile(filePath)
  return { sha256: sha256(buffer), bytes: buffer.length }
}

const readGeoJson = async (filePath: string): Promise<FeatureCollection> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as FeatureCollection
}

const METRIC_THRESHOLDS = {
  curbMarkingKnownRate: 0.1,
  restrictionTriggeredRate: 0.01,
  overridesRatio: 0.2,
}

const normalizeOverrideSegmentId = (value: string) => {
  return value.replace(/-part-\d+$/i, '')
}

const parseSegmentId = (properties: Record<string, unknown> | null) => {
  if (!properties) {
    return null
  }
  const raw =
    properties.segmentId ??
    properties.segment_id ??
    properties.segment ??
    properties.segmentID ??
    properties.segmentid
  return raw ? String(raw) : null
}

const isOverrideStatus = (value: string) => {
  return value === 'LEGAL' || value === 'ILLEGAL' || value === 'UNCLEAR'
}

const OVERRIDE_SCHEMA_VERSIONS = new Set([1])

const parseSchemaVersion = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

const parseDiffSchemaVersion = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

const DIFF_SCHEMA_VERSIONS = new Set([1])
const BOOTSTRAP_OVERRIDE_REASON = 'taipei-real-bootstrap'
const BOOTSTRAP_MODE_FLAG = 'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'
const BOOTSTRAP_DENIED_FLAG = 'BOOTSTRAP_DENIED_PREVIOUS_PACK_EXISTS'
const BASELINE_ADOPT_APPLIED_FLAG = 'BASELINE_ADOPT_APPLIED'
const BASELINE_ADOPT_ENV = 'PARKKING_ALLOW_BASELINE_ADOPT'
const NON_ADOPTABLE_DIFF_FAIL_CODES = new Set([
  'DIFF_SEGMENTS_ZERO',
  'DIFF_BBOX_COLLAPSE',
])

const isBootstrapOverride = (overrideReason: string | null) => {
  return overrideReason?.trim() === BOOTSTRAP_OVERRIDE_REASON
}

const hasPublishedPack = async (
  publishedRootDir: string | null,
  districtId: string,
) => {
  if (!publishedRootDir || !districtId || districtId === 'unknown') {
    return false
  }
  const metaPath = path.resolve(publishedRootDir, districtId, 'dataset_meta.json')
  return fileExists(metaPath)
}

const isAdoptableDiffFail = (warning: GateWarning) => {
  if (warning.severity !== 'FAIL') {
    return false
  }
  if (typeof warning.code !== 'string' || !warning.code.startsWith('DIFF_')) {
    return false
  }
  return !NON_ADOPTABLE_DIFF_FAIL_CODES.has(warning.code)
}

const getIdBase = (
  properties: Record<string, unknown> | null,
  index: number,
  fallbackPrefix: string,
) => {
  if (properties) {
    const raw =
      properties.id ??
      properties.ID ??
      properties.objectid ??
      properties.OBJECTID
    if (raw !== undefined && raw !== null) {
      return String(raw)
    }
  }
  return `${fallbackPrefix}-${index + 1}`
}

const collectSegmentIds = (
  collection: FeatureCollection<LineString | MultiLineString>,
  fallbackPrefix: string,
) => {
  const ids = new Set<string>()
  collection.features.forEach((feature, index) => {
    const idBase = getIdBase(
      feature.properties as Record<string, unknown> | null,
      index,
      fallbackPrefix,
    )
    const geometry = feature.geometry
    if (!geometry) {
      return
    }
    if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line, lineIndex) => {
        if (line.length === 0) {
          return
        }
        ids.add(`${idBase}-p${lineIndex + 1}`)
      })
      return
    }
    ids.add(String(idBase))
  })
  return ids
}

const buildSegmentIdSet = async (datasetDir: string) => {
  const ids = new Set<string>()
  const redYellowPath = path.resolve(datasetDir, 'red_yellow.geojson')
  const inferredPath = path.resolve(datasetDir, 'candidates_inferred.geojson')

  const redYellow = await readGeoJson(redYellowPath)
  collectSegmentIds(
    redYellow as FeatureCollection<LineString | MultiLineString>,
    'seg',
  ).forEach((id) => ids.add(id))

  const inferred = await readGeoJson(inferredPath)
  const inferredIds = new Set<string>()
  inferred.features.forEach((feature, index) => {
    const props = feature.properties as Record<string, unknown> | null
    const raw = props?.id ?? props?.ID
    const idBase = raw !== undefined && raw !== null ? String(raw) : `inferred-${index + 1}`
    const geometry = feature.geometry
    if (!geometry) {
      return
    }
    if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line, lineIndex) => {
        if (line.length === 0) {
          return
        }
        inferredIds.add(`${idBase}-p${lineIndex + 1}`)
      })
      return
    }
    inferredIds.add(String(idBase))
  })
  inferredIds.forEach((id) => ids.add(id))

  return ids
}

const resolveDatasetDir = async (
  districtId: string,
  datasetRootDir?: string,
) => {
  const candidates: string[] = []
  if (datasetRootDir) {
    candidates.push(path.resolve(datasetRootDir, districtId))
  }
  candidates.push(
    path.resolve(process.cwd(), 'public/data/generated', districtId),
  )
  candidates.push(path.resolve(process.cwd(), 'data/generated', districtId))

  let fallback: string | null = null
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      const metaPath = path.resolve(candidate, 'dataset_meta.json')
      if (await fileExists(metaPath)) {
        return candidate
      }
      if (!fallback) {
        fallback = candidate
      }
    }
  }
  return fallback
}

const buildGateWarning = (warning: GateWarning): GateWarning => warning

const validateDatasetPack = async (
  districtId: string,
  datasetRootDir?: string,
  publishedRootDir?: string | null,
  strictDiff?: boolean,
): Promise<GateWarning[]> => {
  const warnings: GateWarning[] = []
  if (!districtId || districtId === 'unknown') {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'DISTRICT_ID_MISSING',
        message: 'districtId missing from ingest report',
      }),
    )
    return warnings
  }

  const datasetDir = await resolveDatasetDir(districtId, datasetRootDir)
  if (!datasetDir) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'PACK_MISSING',
        message: `No dataset directory found for ${districtId}`,
      }),
    )
    return warnings
  }

  const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
  if (!(await fileExists(metaPath))) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_MISSING',
        message: `dataset_meta.json missing for ${districtId}`,
      }),
    )
    return warnings
  }

  let meta: Record<string, unknown> | null = null
  try {
    const raw = await fs.readFile(metaPath, 'utf-8')
    meta = JSON.parse(raw) as Record<string, unknown>
  } catch {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_UNREADABLE',
        message: `dataset_meta.json unreadable for ${districtId}`,
      }),
    )
    return warnings
  }

  const metaDistrictId = meta.districtId as string | undefined
  if (metaDistrictId && metaDistrictId !== districtId) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_DISTRICT_MISMATCH',
        message: `meta districtId ${metaDistrictId} does not match folder ${districtId}`,
      }),
    )
  }

  const requiredFiles = [...PACK_FILES.required, 'dataset_meta.json']
  for (const fileName of requiredFiles) {
    const target = path.resolve(datasetDir, fileName)
    if (!(await fileExists(target))) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'FILE_MISSING',
          message: `${fileName} missing for ${districtId}`,
        }),
      )
    }
  }

  const boundaryBBox = meta.boundaryBBox as
    | { minX?: unknown; minY?: unknown; maxX?: unknown; maxY?: unknown }
    | undefined
  const boundaryBBoxValid =
    boundaryBBox &&
    typeof boundaryBBox.minX === 'number' &&
    typeof boundaryBBox.minY === 'number' &&
    typeof boundaryBBox.maxX === 'number' &&
    typeof boundaryBBox.maxY === 'number'
  if (!boundaryBBoxValid) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_BOUNDARY_BBOX_MISSING',
        message: `boundaryBBox missing in dataset_meta for ${districtId}`,
      }),
    )
  }

  const boundaryCenter = meta.boundaryCenter
  const boundaryCenterValid =
    Array.isArray(boundaryCenter) &&
    boundaryCenter.length === 2 &&
    boundaryCenter.every((value) => typeof value === 'number')
  if (!boundaryCenterValid) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_BOUNDARY_CENTER_MISSING',
        message: `boundaryCenter missing or invalid in dataset_meta for ${districtId}`,
      }),
    )
  }
  if (boundaryCenterValid && boundaryBBoxValid) {
    const [centerX, centerY] = boundaryCenter as number[]
    if (
      centerX < (boundaryBBox.minX as number) ||
      centerX > (boundaryBBox.maxX as number) ||
      centerY < (boundaryBBox.minY as number) ||
      centerY > (boundaryBBox.maxY as number)
    ) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'META_BOUNDARY_CENTER_OUTSIDE',
          message: `boundaryCenter falls outside boundaryBBox for ${districtId}`,
        }),
      )
    }
  }

  const counts = meta.counts as Record<string, unknown> | undefined
  const requiredCounts = ['segments', 'busStops', 'hydrants', 'intersections']
  const optionalCounts = [
    'crosswalks',
    'signOverrides',
    'inferredCandidates',
    'overridesApplied',
  ]
  const upperBounds: Record<string, number> = {
    segments: 1_000_000,
    intersections: 1_000_000,
    inferredCandidates: 1_000_000,
    signOverrides: 1_000_000,
    overridesApplied: 100_000,
  }
  if (!counts || typeof counts !== 'object') {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_COUNTS_MISSING',
        message: `counts missing in dataset_meta for ${districtId}`,
      }),
    )
  } else {
    const allCountKeys = [...requiredCounts, ...optionalCounts]
    allCountKeys.forEach((key) => {
      const value = counts[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        warnings.push(
          buildGateWarning({
            severity: 'FAIL',
            code: 'META_COUNTS_INVALID',
            message: `counts.${key} invalid in dataset_meta for ${districtId}`,
          }),
        )
        return
      }
      if (requiredCounts.includes(key) && value <= 0) {
        warnings.push(
          buildGateWarning({
            severity: 'FAIL',
            code: 'META_COUNTS_EMPTY',
            message: `counts.${key} must be > 0 in dataset_meta for ${districtId}`,
          }),
        )
      }
      const upperBound = upperBounds[key]
      if (upperBound && value > upperBound) {
        warnings.push(
          buildGateWarning({
            severity: 'WARN',
            code: 'META_COUNTS_HIGH',
            message: `counts.${key} exceeds expected range for ${districtId}`,
            metric: { value },
            threshold: { max: upperBound },
          }),
        )
      }
    })
  }

  const segmentsCount =
    typeof meta.segmentsCount === 'number' ? meta.segmentsCount : null
  const overridesAppliedCount =
    typeof meta.overridesAppliedCount === 'number' ? meta.overridesAppliedCount : null
  const signOverridesCount =
    typeof meta.signOverridesCount === 'number' ? meta.signOverridesCount : null
  const curbMarkingKnownRate =
    typeof meta.curbMarkingKnownRate === 'number' ? meta.curbMarkingKnownRate : null
  const restrictionTriggeredRate =
    typeof meta.restrictionTriggeredRate === 'number'
      ? meta.restrictionTriggeredRate
      : null

  if (
    curbMarkingKnownRate !== null &&
    curbMarkingKnownRate < METRIC_THRESHOLDS.curbMarkingKnownRate
  ) {
    warnings.push(
      buildGateWarning({
        severity: 'WARN',
        code: 'METRIC_CURB_MARKING_LOW',
        message: `curbMarkingKnownRate below threshold for ${districtId}`,
        metric: { value: curbMarkingKnownRate },
        threshold: { min: METRIC_THRESHOLDS.curbMarkingKnownRate },
      }),
    )
  }

  if (
    restrictionTriggeredRate !== null &&
    restrictionTriggeredRate < METRIC_THRESHOLDS.restrictionTriggeredRate
  ) {
    warnings.push(
      buildGateWarning({
        severity: 'WARN',
        code: 'METRIC_RESTRICTION_LOW',
        message: `restrictionTriggeredRate below threshold for ${districtId}`,
        metric: { value: restrictionTriggeredRate },
        threshold: { min: METRIC_THRESHOLDS.restrictionTriggeredRate },
      }),
    )
  }

  if (
    segmentsCount !== null &&
    overridesAppliedCount !== null &&
    segmentsCount > 0
  ) {
    const ratio = overridesAppliedCount / segmentsCount
    if (ratio > METRIC_THRESHOLDS.overridesRatio) {
      warnings.push(
        buildGateWarning({
          severity: 'WARN',
          code: 'METRIC_OVERRIDES_HIGH',
          message: `overridesAppliedCount high relative to segments for ${districtId}`,
          metric: {
            ratio,
            overridesAppliedCount,
            segmentsCount,
            signOverridesCount: signOverridesCount ?? null,
          },
          threshold: { maxRatio: METRIC_THRESHOLDS.overridesRatio },
        }),
      )
    }
  }

  const overridesPath = path.resolve(datasetDir, 'overrides_applied.geojson')
  if (await fileExists(overridesPath)) {
    try {
      const overrides = await readGeoJson(overridesPath)
      const overridesCount = overrides.features.length
      const metaOverrideCount =
        typeof counts?.overridesApplied === 'number' ? counts.overridesApplied : null
      if (metaOverrideCount !== null && overridesCount !== metaOverrideCount) {
        warnings.push(
          buildGateWarning({
            severity: 'FAIL',
            code: 'OVERRIDES_COUNT_MISMATCH',
            message: `overrides_applied count ${overridesCount} does not match meta ${metaOverrideCount} (${districtId})`,
          }),
        )
      }

      if (overridesCount > 0) {
        let segmentIds: Set<string> | null = null
        try {
          segmentIds = await buildSegmentIdSet(datasetDir)
        } catch {
          warnings.push(
            buildGateWarning({
              severity: 'FAIL',
              code: 'OVERRIDES_SEGMENT_LOAD_FAILED',
              message: `unable to load segment IDs for overrides validation (${districtId})`,
            }),
          )
        }

        overrides.features.forEach((feature, index) => {
          const props = feature.properties as Record<string, unknown> | null
          const segmentId = parseSegmentId(props)
          if (!segmentId) {
            warnings.push(
              buildGateWarning({
                severity: 'FAIL',
                code: 'OVERRIDES_SEGMENT_MISSING',
                message: `overrides_applied feature ${index + 1} missing segmentId (${districtId})`,
              }),
            )
          } else if (segmentIds && !segmentIds.has(normalizeOverrideSegmentId(segmentId))) {
            warnings.push(
              buildGateWarning({
                severity: 'FAIL',
                code: 'OVERRIDES_SEGMENT_UNKNOWN',
                message: `overrides_applied segmentId ${segmentId} not found in dataset (${districtId})`,
              }),
            )
          }

          const statusRaw =
            props?.override_status ?? props?.status ?? props?.report_status
          const status =
            typeof statusRaw === 'string' ? statusRaw.trim().toUpperCase() : ''
          if (!status || !isOverrideStatus(status)) {
            warnings.push(
              buildGateWarning({
                severity: 'FAIL',
                code: 'OVERRIDES_STATUS_INVALID',
                message: `overrides_applied feature ${index + 1} missing valid status (${districtId})`,
              }),
            )
          }

          const schemaRaw =
            props?.override_schema_version ?? props?.schemaVersion ?? props?.schema_version
          const schemaVersion = parseSchemaVersion(schemaRaw)
          if (schemaRaw === undefined || schemaRaw === null) {
            warnings.push(
              buildGateWarning({
                severity: 'FAIL',
                code: 'OVERRIDES_SCHEMA_MISSING',
                message: `overrides_applied feature ${index + 1} missing schemaVersion (${districtId})`,
              }),
            )
          } else if (!schemaVersion || !OVERRIDE_SCHEMA_VERSIONS.has(schemaVersion)) {
            warnings.push(
              buildGateWarning({
                severity: 'FAIL',
                code: 'OVERRIDES_SCHEMA_UNKNOWN',
                message: `overrides_applied feature ${index + 1} has unknown schemaVersion (${districtId})`,
                metric: { schemaVersion: schemaRaw },
              }),
            )
          }
        })
      }
    } catch {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'OVERRIDES_UNREADABLE',
          message: `overrides_applied.geojson unreadable for ${districtId}`,
        }),
      )
    }
  }

  const files = meta.files as Record<string, { sha256?: string; bytes?: number }> | undefined
  if (!files || typeof files !== 'object') {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_FILES_MISSING',
        message: `files map missing in dataset_meta for ${districtId}`,
      }),
    )
    return warnings
  }

  PACK_FILE_LIST.forEach((fileName) => {
    if (!files[fileName]) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'META_FILE_ENTRY_MISSING',
          message: `files.${fileName} missing in dataset_meta for ${districtId}`,
        }),
      )
    }
  })

  for (const [fileName, entry] of Object.entries(files)) {
    const target = path.resolve(datasetDir, fileName)
    if (!(await fileExists(target))) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'FILE_MISSING',
          message: `${fileName} missing on disk for ${districtId}`,
        }),
      )
      continue
    }
    try {
      const actual = await hashFile(target)
      if (entry?.sha256 && entry.sha256 !== actual.sha256) {
        warnings.push(
          buildGateWarning({
            severity: 'FAIL',
            code: 'HASH_MISMATCH',
            message: `sha256 mismatch for ${fileName} (${districtId})`,
          }),
        )
      }
      if (typeof entry?.bytes === 'number' && entry.bytes !== actual.bytes) {
        warnings.push(
          buildGateWarning({
            severity: 'FAIL',
            code: 'BYTES_MISMATCH',
            message: `byte size mismatch for ${fileName} (${districtId})`,
          }),
        )
      }
    } catch {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'HASH_READ_FAILED',
          message: `hash verification failed for ${fileName} (${districtId})`,
        }),
      )
    }
  }

  const diffWarnings: GateWarning[] = []
  const diffPath = path.resolve(datasetDir, 'diff_report.json')
  let diffReport: PackDiffReport | null = null
  if (await fileExists(diffPath)) {
    try {
      diffReport = await readJson<PackDiffReport>(diffPath)
    } catch {
      diffReport = null
    }
  }

  if (diffReport) {
    const schemaVersion = parseDiffSchemaVersion(diffReport.schemaVersion)
    if (!schemaVersion || !DIFF_SCHEMA_VERSIONS.has(schemaVersion)) {
      diffWarnings.push(
        buildGateWarning({
          severity: 'WARN',
          code: 'DIFF_SCHEMA_UNKNOWN',
          message: `diff_report schemaVersion unknown for ${districtId}`,
          metric: { schemaVersion: diffReport.schemaVersion },
        }),
      )
    } else {
      const districtDiff = diffReport.districts?.find(
        (entry) => entry.districtId === districtId,
      )
      if (districtDiff?.issues?.length) {
        districtDiff.issues.forEach((issue) => {
          const escalated =
            strictDiff && issue.severity === 'WARN' ? 'FAIL' : issue.severity
          diffWarnings.push(
            buildGateWarning({
              severity: escalated,
              code: issue.code,
              message: issue.message,
              metric: issue.metric,
              threshold: issue.threshold,
            }),
          )
        })
      }
    }
  } else if (publishedRootDir) {
    const prevDir = path.resolve(publishedRootDir, districtId)
    if (
      prevDir !== datasetDir &&
      (await fileExists(path.resolve(prevDir, 'dataset_meta.json')))
    ) {
      try {
        const report = await diffPacks({ prevDir, nextDir: datasetDir })
        const districtDiff = report.districts.find(
          (entry) => entry.districtId === districtId,
        )
        if (districtDiff?.issues?.length) {
          districtDiff.issues.forEach((issue: DiffIssue) => {
            const escalated =
              strictDiff && issue.severity === 'WARN' ? 'FAIL' : issue.severity
            diffWarnings.push(
              buildGateWarning({
                severity: escalated,
                code: issue.code,
                message: issue.message,
                metric: issue.metric,
                threshold: issue.threshold,
              }),
            )
          })
        }
      } catch (error) {
        console.warn('Diff report generation failed:', error)
      }
    }
  }

  diffWarnings.forEach((warning) => warnings.push(warning))

  return warnings
}

const writeSummary = async (
  baseDir: string,
  summary: Record<string, unknown>,
) => {
  const opsDir = path.resolve(baseDir, '_ops')
  await fs.mkdir(opsDir, { recursive: true })
  const summaryPath = path.resolve(opsDir, 'publish_gate_summary.json')
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8')
}

const appendLog = async (
  baseDir: string,
  fileName: string,
  payload: Record<string, unknown>,
) => {
  const opsDir = path.resolve(baseDir, '_ops')
  await fs.mkdir(opsDir, { recursive: true })
  const logPath = path.resolve(opsDir, fileName)
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8')
}

export const runPublishGate = async (
  options: PublishGateOptions,
): Promise<PublishGateResult> => {
  const reportPath = options.reportPath ?? (await resolveDefaultReport())
  const mode = options.mode === 'warn' ? 'warn' : 'strict'
  const allowWarn = Boolean(options.allowWarn)
  const allowFail = Boolean(options.allowFail)
  const allowBaselineAdopt =
    Boolean(options.allowBaselineAdopt) ||
    /^(1|true|yes)$/i.test(process.env[BASELINE_ADOPT_ENV] ?? '')
  const overrideReason = options.overrideReason ?? null
  const outputDir = options.outputDir ?? 'public/data/generated'
  const datasetRootDir = options.datasetRootDir
  const publishedRootDir = options.publishedRootDir ?? null
  const strictDiff = /^(1|true|yes)$/i.test(process.env.PARKKING_GATE_STRICT ?? '')

  if (
    (allowWarn || allowFail || allowBaselineAdopt) &&
    (!overrideReason || overrideReason.trim().length === 0)
  ) {
    throw new Error('Override reason is required when allowWarn, allowFail, or baseline adopt is set.')
  }

  const report = await loadReport(reportPath)
  const districts = report.districts ?? []
  const bootstrapRequested = isBootstrapOverride(overrideReason)
  const districtIds = districts
    .map((district) => district.districtId?.trim())
    .filter((districtId): districtId is string => Boolean(districtId))
  const previousPackExists = bootstrapRequested && allowFail
    ? await (async () => {
        for (const districtId of districtIds) {
          if (await hasPublishedPack(publishedRootDir, districtId)) {
            return true
          }
        }
        return false
      })()
    : false
  const bootstrapModeUsed = bootstrapRequested && allowFail && !previousPackExists
  const bootstrapDenied = bootstrapRequested && allowFail && previousPackExists
  const effectiveAllowFail = allowFail && (!bootstrapRequested || bootstrapModeUsed)
  const gateMessageFlags = [
    ...(bootstrapModeUsed ? [BOOTSTRAP_MODE_FLAG] : []),
    ...(bootstrapDenied ? [BOOTSTRAP_DENIED_FLAG] : []),
  ]

  let checkedDistricts = await Promise.all(
    districts.map(async (district) => {
      const extraWarnings = await validateDatasetPack(
        district.districtId ?? 'unknown',
        datasetRootDir,
        publishedRootDir,
        strictDiff,
      )
      return {
        ...district,
        warnings: [...(district.warnings ?? []), ...extraWarnings],
      }
    }),
  )

  let baselineAdoptApplied = false
  let baselineAdoptDistrictIds: string[] = []
  if (allowBaselineAdopt && overrideReason) {
    const failWarnings = checkedDistricts.flatMap((district) =>
      (district.warnings ?? [])
        .filter((warning) => warning.severity === 'FAIL')
        .map((warning) => ({ districtId: district.districtId ?? 'unknown', warning })),
    )
    const nonAdoptableFails = failWarnings.filter(
      ({ warning }) => !isAdoptableDiffFail(warning),
    )
    const adoptableDiffFails = failWarnings.filter(({ warning }) =>
      isAdoptableDiffFail(warning),
    )
    if (adoptableDiffFails.length > 0 && nonAdoptableFails.length === 0) {
      baselineAdoptApplied = true
      const districtSet = new Set<string>()
      checkedDistricts = checkedDistricts.map((district) => {
        const districtId = district.districtId ?? 'unknown'
        let touched = false
        const warnings = (district.warnings ?? []).map((warning) => {
          if (!isAdoptableDiffFail(warning)) {
            return warning
          }
          touched = true
          return {
            ...warning,
            severity: 'WARN' as const,
          }
        })
        if (touched && districtId && districtId !== 'unknown') {
          districtSet.add(districtId)
        }
        return { ...district, warnings }
      })
      baselineAdoptDistrictIds = Array.from(districtSet).sort((a, b) =>
        a.localeCompare(b),
      )
      gateMessageFlags.push(BASELINE_ADOPT_APPLIED_FLAG)
    }
  }

  const districtSummaries = checkedDistricts.map((district) => {
    const warnings = district.warnings ?? []
    const counts = {
      INFO: 0,
      WARN: 0,
      FAIL: 0,
    }
    const failCodes: Record<string, number> = {}
    warnings.forEach((warning) => {
      const severity = warning.severity ?? 'WARN'
      counts[severity] += 1
      if (severity === 'FAIL') {
        const code = warning.code ?? 'UNKNOWN'
        failCodes[code] = (failCodes[code] ?? 0) + 1
      }
    })
    const topFailCodes = Object.entries(failCodes)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([code]) => code)

    return {
      districtId: district.districtId ?? 'unknown',
      info: counts.INFO,
      warn: counts.WARN,
      fail: counts.FAIL,
      topFailCodes,
    }
  })

  const totals = districtSummaries.reduce(
    (acc, summary) => {
      acc.info += summary.info
      acc.warn += summary.warn
      acc.fail += summary.fail
      return acc
    },
    { info: 0, warn: 0, fail: 0 },
  )

  const hasFail = totals.fail > 0
  const hasWarn = totals.warn > 0
  const warnBlocking = mode === 'strict' && !allowWarn
  const failBlocking = !effectiveAllowFail

  let exitCode = 0
  if (hasFail && failBlocking) {
    exitCode = 3
  } else if (hasWarn && warnBlocking) {
    exitCode = 2
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    reportPath,
    mode,
    allowWarn,
    allowFail: effectiveAllowFail,
    allowFailRequested: allowFail,
    allowBaselineAdopt,
    overrideReason,
    bootstrap: {
      requested: bootstrapRequested,
      modeUsed: bootstrapModeUsed,
      denied: bootstrapDenied,
      previousPackExists,
    },
    baselineAdopt: {
      enabled: allowBaselineAdopt,
      applied: baselineAdoptApplied,
      districtIds: baselineAdoptDistrictIds,
      reason: baselineAdoptApplied ? 'baseline_adopt' : null,
    },
    gateMessageFlags,
    totals,
    districts: districtSummaries,
    exitCode,
  }

  await writeSummary(outputDir, summary)

  if ((allowWarn || allowFail || allowBaselineAdopt) && overrideReason) {
    await appendLog(outputDir, 'publish_gate_overrides.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath,
      allowWarn,
      allowFail: effectiveAllowFail,
      allowFailRequested: allowFail,
      allowBaselineAdopt,
      overrideReason,
      bootstrapModeUsed,
      baselineAdoptApplied,
      gateMessageFlags,
      totals,
    })
  }

  if (baselineAdoptApplied && overrideReason) {
    await appendLog(outputDir, 'baseline_adopt_stamps.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath,
      overrideReason,
      districtIds: baselineAdoptDistrictIds,
      reason: 'baseline_adopt',
    })
  }

  if (exitCode !== 0) {
    await appendLog(outputDir, 'publish_gate_failures.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath,
      exitCode,
      totals,
    })
  }

  return { exitCode, summary }
}

const run = async () => {
  const args = parseArgs(process.argv)
  const result = await runPublishGate({
    reportPath: args.reportPath ?? undefined,
    mode: args.mode === 'warn' ? 'warn' : 'strict',
    allowWarn: args.allowWarn,
    allowFail: args.allowFail,
    allowBaselineAdopt: args.allowBaselineAdopt,
    overrideReason: args.overrideReason ?? undefined,
    datasetRootDir: args.datasetRootDir ?? undefined,
  })
  process.exit(result.exitCode)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
