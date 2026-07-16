import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import fg from 'fast-glob'
import { buildQaReviewSummary } from './qaReviewSummaryState'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'
const HUMAN_REVIEW_SUFFIX = '-human-review'

type HumanReviewBundleStatus =
  | 'review-complete'
  | 'ready-to-finalize'
  | 'ready-for-review'
  | 'incomplete'

interface FileState {
  path: string
  exists: boolean
  bytes: number | null
}

export interface HumanReviewBundleFinalizeInputs {
  districtId: string
  sourcePath: string
  reviewsPath: string
  mergedOutPath: string
  configPath: string
  answerCasesPath: string
  allowPublishWarn: boolean
  publishOverrideReason: string | null
}

export interface HumanReviewBundleIndexOptions {
  reviewRoot?: string
  configRoot?: string
  districtIds?: string[]
  publishGateSummaryPath?: string | null
  requireReadyToFinalize?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string
  json?: boolean
}

export interface HumanReviewBundleEntry {
  districtId: string
  bundleDir: string
  bundleId: string
  sourcePath: string
  status: HumanReviewBundleStatus
  publishGateWarnCodes: string[]
  files: Record<string, FileState>
  handoffRows: number | null
  handoffReviewedRows: number | null
  handoffValidReviewedRows: number | null
  handoffPendingRows: number | null
  handoffEstimatedMinimumNewReviews: number | null
  totalRows: number | null
  reviewedRows: number | null
  validReviewedRows: number | null
  pendingRows: number | null
  estimatedMinimumNewReviews: number | null
  missingStatuses: string[]
  missingBuckets: string[]
  bucketMinimumsRemaining: Record<string, number>
  finalizeInputs: HumanReviewBundleFinalizeInputs
  finalizeCommand: string
  warnings: string[]
  errors: string[]
}

export interface HumanReviewBundleIndexResult {
  reviewRoot: string
  publishGateSummaryPath: string | null
  entries: HumanReviewBundleEntry[]
  specializedEntries?: SpecializedHumanReviewBundleEntry[]
  finalizeReadyCount: number
  notReadyForFinalize: string[]
  warnings: string[]
  errors: string[]
  hasWarnings: boolean
  hasErrors: boolean
}

export interface SpecializedHumanReviewBundleEntry {
  bundleId: string
  bundleDir: string
  districtId: string
  contract: 'source-text'
  status: 'approved' | 'pending' | 'needs-resolution' | 'invalid' | 'unknown'
  reviewPath: string
  manifestPath: string
  statusPath: string
  expectedRows: number | null
  actualRows: number | null
  pendingRows: number | null
  statusCommand: string
  gateCommand: string
  warnings: string[]
  errors: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const getArgValues = (argv: string[], ...flags: string[]) => {
  const values: string[] = []
  argv.forEach((arg, index) => {
    if (flags.includes(arg) && argv[index + 1]) {
      values.push(argv[index + 1])
    }
  })
  return values.flatMap((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseHumanReviewBundleIndexArgs = (
  argv: string[],
): HumanReviewBundleIndexOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  configRoot:
    getArgValue(argv, '--config-root', '--configRoot') ?? DEFAULT_CONFIG_ROOT,
  districtIds: getArgValues(argv, '--district', '--district-id', '--districtId'),
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? DEFAULT_PUBLISH_GATE_SUMMARY),
  requireReadyToFinalize: hasFlag(
    argv,
    '--require-ready-to-finalize',
    '--requireReadyToFinalize',
  ),
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath') ?? undefined,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: hasFlag(argv, '--json'),
})

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const readFileState = async (targetPath: string): Promise<FileState> => {
  try {
    const stat = await fs.stat(targetPath)
    return { path: targetPath, exists: true, bytes: stat.size }
  } catch {
    return { path: targetPath, exists: false, bytes: null }
  }
}

const readCsvRowCount = async (csvPath: string) => {
  try {
    const raw = await fs.readFile(csvPath, 'utf-8')
    const rows = parseCsv(raw, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[]
    return rows.length
  } catch {
    return null
  }
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getRecordString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const getRecordNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const getRecordBoolean = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

const readJsonRecord = async (targetPath: string) =>
  toRecord(JSON.parse(await fs.readFile(targetPath, 'utf-8')) as unknown)

const readSourceManifestMeta = async (manifestPath: string) => {
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const parsed = toRecord(JSON.parse(raw) as unknown)
    return {
      districtId: getRecordString(parsed, 'districtId'),
      csvPath: getRecordString(parsed, 'csvPath'),
    }
  } catch {
    return {
      districtId: null,
      csvPath: null,
    }
  }
}

const readPublishGateWarnCodes = async (summaryPath: string | null) => {
  const warnCodesByDistrict = new Map<string, string[]>()
  if (!summaryPath || !(await fileExists(summaryPath))) {
    return warnCodesByDistrict
  }
  const raw = await fs.readFile(summaryPath, 'utf-8')
  const parsed = toRecord(JSON.parse(raw) as unknown)
  const districts = Array.isArray(parsed.districts) ? parsed.districts : []
  districts.forEach((entry) => {
    const record = toRecord(entry)
    const districtId = getRecordString(record, 'districtId')
    if (!districtId) {
      return
    }
    const topWarnCodes = Array.isArray(record.topWarnCodes)
      ? record.topWarnCodes.filter((value): value is string => typeof value === 'string')
      : []
    warnCodesByDistrict.set(districtId, topWarnCodes)
  })
  return warnCodesByDistrict
}

const firstExistingPath = async (paths: string[]) => {
  for (const targetPath of paths) {
    if (await fileExists(targetPath)) {
      return targetPath
    }
  }
  return paths[0]
}

const expectedFiles = async (bundleDir: string, bundleId: string) => ({
  sourceCsv: path.join(bundleDir, `${bundleId}-review.csv`),
  sourceManifest: path.join(bundleDir, `${bundleId}-review.manifest.json`),
  sourceReviewDoc: await firstExistingPath([
    path.join(bundleDir, `${bundleId}-review.review.md`),
    path.join(bundleDir, `${bundleId}-review.md`),
  ]),
  handoffCsv: path.join(bundleDir, `${bundleId}-next-review.csv`),
  handoffChecklist: path.join(bundleDir, `${bundleId}-next-review.md`),
  handoffGeojson: path.join(bundleDir, `${bundleId}-next-review.geojson`),
})

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

type ExpectedFiles = Awaited<ReturnType<typeof expectedFiles>>

interface BundleDiscovery {
  bundleDir: string
  bundleId: string
  qaArtifactId: string | null
  sourceTextManifestPath: string | null
}

const discoverBundle = async (bundleDir: string): Promise<BundleDiscovery> => {
  const bundleName = path.basename(bundleDir)
  const bundleId = bundleName.endsWith(HUMAN_REVIEW_SUFFIX)
    ? bundleName.slice(0, -HUMAN_REVIEW_SUFFIX.length)
    : bundleName
  const canonicalManifest = path.join(bundleDir, `${bundleId}-review.manifest.json`)
  if (await fileExists(canonicalManifest)) {
    return {
      bundleDir,
      bundleId,
      qaArtifactId: bundleId,
      sourceTextManifestPath: null,
    }
  }

  const manifestPaths = (
    await fg('*-review.manifest.json', {
      cwd: bundleDir,
      absolute: true,
      onlyFiles: true,
    })
  ).sort()
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readJsonRecord(manifestPath)
      const allowedStatuses = Array.isArray(manifest.allowedStatuses)
        ? manifest.allowedStatuses
        : []
      if (allowedStatuses.includes('APPROVED_SOURCE_TEXT')) {
        return {
          bundleDir,
          bundleId,
          qaArtifactId: null,
          sourceTextManifestPath: manifestPath,
        }
      }
      if (Object.keys(toRecord(manifest.dataset)).length > 0) {
        return {
          bundleDir,
          bundleId,
          qaArtifactId: path.basename(manifestPath, '-review.manifest.json'),
          sourceTextManifestPath: null,
        }
      }
    } catch {
      // The normal bundle validator will surface malformed canonical manifests.
    }
  }
  if (
    (await fileExists(path.join(bundleDir, `${bundleId}-review.csv`))) ||
    (await fileExists(path.join(bundleDir, `${bundleId}-next-review.csv`)))
  ) {
    return {
      bundleDir,
      bundleId,
      qaArtifactId: bundleId,
      sourceTextManifestPath: null,
    }
  }
  return {
    bundleDir,
    bundleId,
    qaArtifactId: null,
    sourceTextManifestPath: null,
  }
}

const buildSourceTextBundleEntry = async (
  discovery: BundleDiscovery & { sourceTextManifestPath: string },
): Promise<SpecializedHumanReviewBundleEntry> => {
  const manifestPath = discovery.sourceTextManifestPath
  const manifest = await readJsonRecord(manifestPath)
  const districtId = getRecordString(manifest, 'districtId') ?? discovery.bundleId
  const reviewFileName =
    getRecordString(manifest, 'reviewCsv') ?? `${districtId}-paid-curb-review.csv`
  const reviewPath = path.join(discovery.bundleDir, reviewFileName)
  const statusPath = path.join(discovery.bundleDir, 'status.json')
  const expectedRows = getRecordNumber(manifest, 'reviewRecordCount')
  const actualRows = await readCsvRowCount(reviewPath)
  const warnings: string[] = []
  const errors: string[] = []
  if (!(await fileExists(reviewPath))) {
    errors.push(`missing source-text review CSV: ${reviewPath}`)
  }

  let structureValid: boolean | null = null
  let complete: boolean | null = null
  let approved: boolean | null = null
  let pendingRows: number | null = null
  if (await fileExists(statusPath)) {
    try {
      const status = await readJsonRecord(statusPath)
      const counts = toRecord(status.statusCounts)
      structureValid = getRecordBoolean(status, 'structureValid')
      complete = getRecordBoolean(status, 'complete')
      approved = getRecordBoolean(status, 'approved')
      pendingRows = getRecordNumber(counts, 'PENDING')
      const statusDistrictId = getRecordString(status, 'districtId')
      const statusExpectedRows = getRecordNumber(status, 'expectedRows')
      const statusActualRows = getRecordNumber(status, 'actualRows')
      if (statusDistrictId !== districtId) {
        errors.push(
          `source-text status district ${statusDistrictId ?? '-'} does not match ${districtId}`,
        )
      }
      if (
        statusExpectedRows !== expectedRows ||
        statusActualRows !== actualRows
      ) {
        errors.push('source-text status row counts do not match the current review artifacts')
      }
    } catch (error) {
      errors.push(
        `source-text status could not be read: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    warnings.push(`dedicated status snapshot is missing: ${statusPath}`)
  }

  const status =
    errors.length > 0 || structureValid === false
      ? 'invalid'
      : approved
        ? 'approved'
        : complete
          ? 'needs-resolution'
          : structureValid
            ? 'pending'
            : 'unknown'
  const commandSuffix =
    `-- --district ${quoteArg(districtId)} ` +
    `--review-dir ${quoteArg(discovery.bundleDir)}`
  return {
    bundleId: discovery.bundleId,
    bundleDir: discovery.bundleDir,
    districtId,
    contract: 'source-text',
    status,
    reviewPath,
    manifestPath,
    statusPath,
    expectedRows,
    actualRows,
    pendingRows,
    statusCommand: `npm run ops:taoyuan-review-status ${commandSuffix}`,
    gateCommand: `npm run ops:taoyuan-review-gate ${commandSuffix}`,
    warnings,
    errors,
  }
}

const toMergedCsvPath = (sourcePath: string) => {
  const ext = path.extname(sourcePath)
  const basePath = ext ? sourcePath.slice(0, -ext.length) : sourcePath
  return `${basePath}.merged.csv`
}

const buildFinalizeInputs = (params: {
  districtId: string
  sourcePath: string
  files: ExpectedFiles
  configRoot: string
  allowWarnReason: string | null
}): HumanReviewBundleFinalizeInputs => ({
  districtId: params.districtId,
  sourcePath: params.sourcePath,
  reviewsPath: params.files.handoffCsv,
  mergedOutPath: toMergedCsvPath(params.sourcePath),
  configPath: path.join(params.configRoot, `${params.districtId}.json`),
  answerCasesPath: path.join(
    params.configRoot,
    `${params.districtId}.answer-cases.json`,
  ),
  allowPublishWarn: Boolean(params.allowWarnReason),
  publishOverrideReason: params.allowWarnReason,
})

const buildFinalizeCommand = (inputs: HumanReviewBundleFinalizeInputs) =>
  [
    'npm run ops:p0-finalize-review --',
    '--district',
    inputs.districtId,
    '--source',
    quoteArg(inputs.sourcePath),
    '--reviews',
    quoteArg(inputs.reviewsPath),
    '--merged-out',
    quoteArg(inputs.mergedOutPath),
    '--config',
    quoteArg(inputs.configPath),
    '--answer-cases',
    quoteArg(inputs.answerCasesPath),
    ...(inputs.allowPublishWarn && inputs.publishOverrideReason
      ? [
          '--allow-publish-warn',
          '--publish-override',
          quoteArg(inputs.publishOverrideReason),
        ]
      : []),
  ].join(' ')

const isExpectedReviewBlocker = (error: string) =>
  error.startsWith('Valid reviewed rows ') ||
  error.startsWith('Missing required review status ') ||
  error.startsWith('Missing reviewed row for required bucket ') ||
  error.startsWith('Reviewed rows for bucket ')

const resolveStatus = (params: {
  sourcePass: boolean | null
  handoffPass: boolean | null
  hasFatalHandoffErrors: boolean
  hasRequiredFiles: boolean
  handoffRows: number | null
  errors: string[]
}): HumanReviewBundleStatus => {
  if (params.sourcePass) {
    return 'review-complete'
  }
  if (params.handoffPass) {
    return 'ready-to-finalize'
  }
  if (
    params.errors.length === 0 &&
    !params.hasFatalHandoffErrors &&
    params.hasRequiredFiles &&
    (params.handoffRows ?? 0) > 0
  ) {
    return 'ready-for-review'
  }
  return 'incomplete'
}

const buildBundleEntry = async (
  bundleDir: string,
  configRoot: string,
  publishGateWarnCodesByDistrict: Map<string, string[]>,
  artifactId?: string,
): Promise<HumanReviewBundleEntry> => {
  const bundleName = path.basename(bundleDir)
  const bundleId = bundleName.endsWith(HUMAN_REVIEW_SUFFIX)
    ? bundleName.slice(0, -HUMAN_REVIEW_SUFFIX.length)
    : bundleName
  const files = await expectedFiles(bundleDir, artifactId ?? bundleId)
  const fileStates = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, targetPath]) => [
        key,
        await readFileState(targetPath),
      ]),
    ),
  ) as Record<string, FileState>
  const errors: string[] = []
  const warnings: string[] = []
  const missingFiles = Object.entries(fileStates)
    .filter(([key, state]) => key !== 'sourceReviewDoc' && !state.exists)
    .map(([key]) => key)

  missingFiles.forEach((key) => {
    errors.push(`missing ${key}: ${fileStates[key].path}`)
  })

  let totalRows: number | null = null
  let reviewedRows: number | null = null
  let validReviewedRows: number | null = null
  let pendingRows: number | null = null
  let estimatedMinimumNewReviews: number | null = null
  let missingStatuses: string[] = []
  let missingBuckets: string[] = []
  let bucketMinimumsRemaining: Record<string, number> = {}
  let sourcePass: boolean | null = null
  let handoffPass: boolean | null = null
  let handoffReviewedRows: number | null = null
  let handoffValidReviewedRows: number | null = null
  let handoffPendingRows: number | null = null
  let handoffEstimatedMinimumNewReviews: number | null = null
  let hasFatalHandoffErrors = false
  let districtId = bundleId
  let sourcePath = files.sourceCsv

  if (fileStates.sourceManifest.exists) {
    const manifest = await readSourceManifestMeta(files.sourceManifest)
    districtId = manifest.districtId ?? districtId
    if (manifest.csvPath) {
      const resolvedManifestSource = path.resolve(manifest.csvPath)
      if (await fileExists(resolvedManifestSource)) {
        sourcePath = resolvedManifestSource
      } else {
        warnings.push(
          `source manifest csvPath ${resolvedManifestSource} is missing; falling back to bundled source CSV`,
        )
      }
    }
  }

  if (await fileExists(sourcePath)) {
    try {
      const summary = await buildQaReviewSummary({
        inputPath: sourcePath,
        strictManifest: false,
        strictReviewedRows: true,
        strictReviewedSegments: true,
        nextReviewRowsLimit: 10,
        minReviewed: 1,
        requireStatuses: ['LEGAL', 'ILLEGAL'],
        requireBuckets: ['marked_space_park'],
        minReviewedBuckets: {
          marked_space_park: 2,
          no_stop: 2,
        },
      })
      sourcePass = summary.pass
      districtId = summary.manifest?.districtId ?? districtId
      totalRows = summary.totalRows
      reviewedRows = summary.reviewedRows
      validReviewedRows = summary.validReviewedRows
      pendingRows = summary.pendingRows
      estimatedMinimumNewReviews =
        summary.reviewRequirements.estimatedMinimumNewReviews
      missingStatuses = summary.reviewRequirements.missingStatuses
      missingBuckets = summary.reviewRequirements.missingBuckets
      bucketMinimumsRemaining = summary.reviewRequirements.bucketMinimumsRemaining
      warnings.push(...summary.warnings)
      if (summary.pass) {
        warnings.push('source QA CSV already satisfies P0 review requirements')
      }
    } catch (error) {
      errors.push(
        `review summary failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const handoffRows = await readCsvRowCount(files.handoffCsv)
  if (fileStates.handoffCsv.exists && !sourcePass) {
    try {
      const handoffSummary = await buildQaReviewSummary({
        inputPath: files.handoffCsv,
        strictManifest: false,
        strictReviewedRows: true,
        strictReviewedSegments: true,
        nextReviewRowsLimit: 10,
        minReviewed: 1,
        requireStatuses: ['LEGAL', 'ILLEGAL'],
        requireBuckets: ['marked_space_park'],
        minReviewedBuckets: {
          marked_space_park: 2,
          no_stop: 2,
        },
      })
      handoffPass = handoffSummary.pass
      handoffReviewedRows = handoffSummary.reviewedRows
      handoffValidReviewedRows = handoffSummary.validReviewedRows
      handoffPendingRows = handoffSummary.pendingRows
      handoffEstimatedMinimumNewReviews =
        handoffSummary.reviewRequirements.estimatedMinimumNewReviews
      hasFatalHandoffErrors = handoffSummary.errors.some(
        (error) => !isExpectedReviewBlocker(error),
      )
      warnings.push(
        ...handoffSummary.warnings.map((warning) => `Handoff: ${warning}`),
      )
      if (hasFatalHandoffErrors) {
        errors.push(
          ...handoffSummary.errors
            .filter((error) => !isExpectedReviewBlocker(error))
            .map((error) => `Handoff: ${error}`),
        )
      }
    } catch (error) {
      hasFatalHandoffErrors = true
      errors.push(
        `handoff review summary failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  const publishGateWarnCodes = publishGateWarnCodesByDistrict.get(districtId) ?? []
  const allowWarnReason =
    publishGateWarnCodes.length > 0 &&
    publishGateWarnCodes.every((code) => code === 'BASELINE_MISSING')
      ? `${districtId} reviewed first-publish baseline bootstrap`
      : null
  if (publishGateWarnCodes.length > 0 && !allowWarnReason) {
    warnings.push(
      `publish gate has WARN codes that are not auto-overridden: ${publishGateWarnCodes.join(', ')}`,
    )
  }
  const status = resolveStatus({
    sourcePass,
    handoffPass,
    hasFatalHandoffErrors,
    hasRequiredFiles: missingFiles.length === 0,
    handoffRows,
    errors,
  })
  const finalizeInputs = buildFinalizeInputs({
    districtId,
    sourcePath,
    files,
    configRoot,
    allowWarnReason,
  })

  return {
    districtId,
    bundleId,
    bundleDir,
    sourcePath,
    status,
    publishGateWarnCodes,
    files: fileStates,
    handoffRows,
    handoffReviewedRows,
    handoffValidReviewedRows,
    handoffPendingRows,
    handoffEstimatedMinimumNewReviews,
    totalRows,
    reviewedRows,
    validReviewedRows,
    pendingRows,
    estimatedMinimumNewReviews,
    missingStatuses,
    missingBuckets,
    bucketMinimumsRemaining,
    finalizeInputs,
    finalizeCommand: buildFinalizeCommand(finalizeInputs),
    warnings,
    errors,
  }
}

const matchesDistrictFilter = (
  entry: HumanReviewBundleEntry,
  districtIds: Set<string>,
) =>
  districtIds.size === 0 ||
  districtIds.has(entry.districtId) ||
  districtIds.has(entry.bundleId)

export const runHumanReviewBundleIndex = async (
  options: HumanReviewBundleIndexOptions = {},
): Promise<HumanReviewBundleIndexResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const configRoot = options.configRoot ?? DEFAULT_CONFIG_ROOT
  const publishGateSummaryPath =
    options.publishGateSummaryPath === null
      ? null
      : path.resolve(options.publishGateSummaryPath ?? DEFAULT_PUBLISH_GATE_SUMMARY)
  const errors: string[] = []
  const warnings: string[] = []

  if (!(await fileExists(reviewRoot))) {
    return {
      reviewRoot,
      publishGateSummaryPath,
      entries: [],
      specializedEntries: [],
      finalizeReadyCount: 0,
      notReadyForFinalize: [],
      warnings,
      errors: [`Review root missing: ${reviewRoot}`],
      hasWarnings: false,
      hasErrors: true,
    }
  }

  const bundleDirs = (
    await fg(`*${HUMAN_REVIEW_SUFFIX}`, {
      cwd: reviewRoot,
      absolute: true,
      onlyDirectories: true,
    })
  ).sort((left, right) => path.basename(left).localeCompare(path.basename(right)))

  if (bundleDirs.length === 0) {
    warnings.push(`No human review bundle directories found under ${reviewRoot}`)
  }

  const districtIds = new Set(options.districtIds ?? [])
  const discoveries = await Promise.all(bundleDirs.map(discoverBundle))
  let publishGateWarnCodesByDistrict = new Map<string, string[]>()
  try {
    publishGateWarnCodesByDistrict =
      await readPublishGateWarnCodes(publishGateSummaryPath)
  } catch (error) {
    warnings.push(
      `Publish gate summary not loaded from ${publishGateSummaryPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const entries = (
    await Promise.all(
      discoveries
        .filter(
          (discovery): discovery is BundleDiscovery & { qaArtifactId: string } =>
            discovery.qaArtifactId !== null,
        )
        .map((discovery) =>
          buildBundleEntry(
            discovery.bundleDir,
            configRoot,
            publishGateWarnCodesByDistrict,
            discovery.qaArtifactId,
          ),
        ),
    )
  ).filter((entry) => matchesDistrictFilter(entry, districtIds))
  const specializedEntries = (
    await Promise.all(
      discoveries
        .filter(
          (
            discovery,
          ): discovery is BundleDiscovery & {
            sourceTextManifestPath: string
          } => discovery.sourceTextManifestPath !== null,
        )
        .map((discovery) => buildSourceTextBundleEntry(discovery)),
    )
  ).filter(
    (entry) =>
      districtIds.size === 0 ||
      districtIds.has(entry.districtId) ||
      districtIds.has(entry.bundleId),
  )
  const unsupportedBundles = discoveries.filter(
    (discovery) =>
      discovery.qaArtifactId === null &&
      discovery.sourceTextManifestPath === null &&
      (districtIds.size === 0 || districtIds.has(discovery.bundleId)),
  )
  unsupportedBundles.forEach((discovery) => {
    warnings.push(
      `Skipped unsupported human review bundle ${discovery.bundleId}: ${discovery.bundleDir}`,
    )
  })
  specializedEntries.forEach((entry) => {
    if (entry.status !== 'approved' && entry.errors.length === 0) {
      warnings.push(
        `[${entry.districtId}] specialized source-text review is ${entry.status}; run ${entry.statusCommand}`,
      )
    }
  })
  if (
    entries.length === 0 &&
    specializedEntries.length === 0 &&
    districtIds.size > 0
  ) {
    warnings.push(
      `No human review bundle directories matched districts: ${Array.from(districtIds).join(', ')}`,
    )
  }
  const entryWarnings = entries.flatMap((entry) =>
    entry.warnings.map((warning) => `[${entry.districtId}] ${warning}`),
  )
  const entryErrors = entries.flatMap((entry) =>
    entry.errors.map((error) => `[${entry.districtId}] ${error}`),
  )
  const specializedWarnings = specializedEntries.flatMap((entry) =>
    entry.warnings.map((warning) => `[${entry.districtId}] ${warning}`),
  )
  const specializedErrors = specializedEntries.flatMap((entry) =>
    entry.errors.map((error) => `[${entry.districtId}] ${error}`),
  )
  const allWarnings = [...warnings, ...entryWarnings, ...specializedWarnings]
  const allErrors = [...errors, ...entryErrors, ...specializedErrors]
  const readyStatuses = new Set<HumanReviewBundleStatus>([
    'review-complete',
    'ready-to-finalize',
  ])
  const notReadyForFinalize = entries
    .filter((entry) => !readyStatuses.has(entry.status))
    .map((entry) =>
      entry.bundleId === entry.districtId ? entry.districtId : entry.bundleId,
    )

  return {
    reviewRoot,
    publishGateSummaryPath,
    entries,
    specializedEntries,
    finalizeReadyCount: entries.length - notReadyForFinalize.length,
    notReadyForFinalize,
    warnings: allWarnings,
    errors: allErrors,
    hasWarnings: allWarnings.length > 0,
    hasErrors: allErrors.length > 0,
  }
}

const formatCount = (value: number | null) => (value === null ? '-' : String(value))

const formatBucketMinimums = (value: Record<string, number>) => {
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return entries.length === 0
    ? 'none'
    : entries.map(([bucket, count]) => `${bucket} ${count}`).join(', ')
}

const statusLine = (result: HumanReviewBundleIndexResult) =>
  result.hasErrors ? 'FAIL' : result.hasWarnings ? 'WARN' : 'PASS'

export const renderHumanReviewBundleIndex = (
  result: HumanReviewBundleIndexResult,
) => {
  const specializedEntries = result.specializedEntries ?? []
  const lines = [
    `Human review bundle index: ${statusLine(result)}`,
    `Review root: ${result.reviewRoot}`,
    `Publish gate summary: ${result.publishGateSummaryPath ?? '-'}`,
    `Bundles: ${result.entries.length + specializedEntries.length}`,
    `P0 QA bundles: ${result.entries.length}`,
    `Specialized review bundles: ${specializedEntries.length}`,
    `Finalize-ready bundles: ${result.finalizeReadyCount}/${result.entries.length}`,
    `Not ready for finalize: ${result.notReadyForFinalize.join(', ') || 'none'}`,
    '',
    '| Bundle | District | Status | Handoff rows | Handoff valid | Source valid | Pending source rows | Source minimum new reviews | Missing statuses | Bucket minimums |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ]

  result.entries.forEach((entry) => {
    lines.push(
      [
        `| ${entry.bundleId}`,
        entry.districtId,
        entry.status,
        formatCount(entry.handoffRows),
        formatCount(entry.handoffValidReviewedRows),
        formatCount(entry.validReviewedRows),
        formatCount(entry.pendingRows),
        formatCount(entry.estimatedMinimumNewReviews),
        entry.missingStatuses.join(', ') || 'none',
        `${formatBucketMinimums(entry.bucketMinimumsRemaining)} |`,
      ].join(' | '),
    )
  })

  if (specializedEntries.length > 0) {
    lines.push('')
    lines.push('Specialized review contracts:')
    lines.push('')
    lines.push('| District | Contract | Status | Rows | Pending |')
    lines.push('| --- | --- | --- | ---: | ---: |')
    specializedEntries.forEach((entry) => {
      lines.push(
        `| ${entry.districtId} | ${entry.contract} | ${entry.status} | ${formatCount(entry.actualRows)}/${formatCount(entry.expectedRows)} | ${formatCount(entry.pendingRows)} |`,
      )
    })
    lines.push('')
    specializedEntries.forEach((entry) => {
      lines.push(`- ${entry.districtId}: ${entry.bundleDir}`)
      lines.push(`  Review CSV: ${entry.reviewPath}`)
      lines.push(`  Status snapshot: ${entry.statusPath}`)
      lines.push(`  Refresh status: ${entry.statusCommand}`)
      lines.push(`  Approval gate: ${entry.gateCommand}`)
      entry.errors.forEach((error) => lines.push(`  ERROR: ${error}`))
      entry.warnings.forEach((warning) => lines.push(`  WARN: ${warning}`))
    })
  }

  lines.push('')
  result.entries.forEach((entry) => {
    const entryLabel =
      entry.bundleId === entry.districtId
        ? entry.districtId
        : `${entry.bundleId} (district ${entry.districtId})`
    lines.push(`- ${entryLabel}: ${entry.bundleDir}`)
    lines.push(`  Source CSV: ${entry.sourcePath}`)
    lines.push(`  Handoff CSV: ${entry.files.handoffCsv.path}`)
    lines.push(
      `  Handoff review: valid ${formatCount(entry.handoffValidReviewedRows)}, pending ${formatCount(entry.handoffPendingRows)}, minimum new reviews ${formatCount(entry.handoffEstimatedMinimumNewReviews)}`,
    )
    lines.push(`  Checklist: ${entry.files.handoffChecklist.path}`)
    lines.push(`  GeoJSON: ${entry.files.handoffGeojson.path}`)
    lines.push(
      `  Publish WARN codes: ${entry.publishGateWarnCodes.join(', ') || 'none'}`,
    )
    lines.push(
      `  After human review: ${entry.status === 'review-complete' ? 'source already passes' : entry.finalizeCommand}`,
    )
    entry.errors.forEach((error) => {
      lines.push(`  ERROR: ${error}`)
    })
    entry.warnings.forEach((warning) => {
      lines.push(`  WARN: ${warning}`)
    })
  })

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    result.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  return lines.join('\n')
}

export const resolveHumanReviewBundleIndexSummaryPath = (
  options: Pick<HumanReviewBundleIndexOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseHumanReviewBundleIndexArgs(process.argv)
  const result = await runHumanReviewBundleIndex(options)
  const markdown = renderHumanReviewBundleIndex(result)
  const output = options.json ? JSON.stringify(result, null, 2) : markdown
  console.log(output)

  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  const summaryPath = resolveHumanReviewBundleIndexSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${markdown}\n\n`)
  }

  if (
    result.hasErrors ||
    (options.requireReadyToFinalize && result.notReadyForFinalize.length > 0)
  ) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
