import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import { resolveAnswerCaseReviewFallbackAllowance } from './answerCaseReviewFallback'
import { DEFAULT_REVIEWED_ANSWER_CASES_GLOB } from './reviewedDistrictDiscovery'

const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_PUBLIC_ROOT = 'public/data/generated'
const DEFAULT_DRY_RUN_ROOT = 'data/generated'
const DEFAULT_REVIEW_ROOT = '.tmp'

type RuntimeStatus =
  | 'published'
  | 'registry-missing-dir'
  | 'stale-public-dir'
  | 'not-published'

type DataPackStatus = 'available' | 'missing'
type ReviewStatus = 'pass' | 'blocked' | 'missing'
type PublishGateStatus = 'pass' | 'fail' | 'warn' | 'unknown'

interface DistrictConfigEntry {
  districtId: string
  districtName: string
  configPath: string
}

interface DatasetCounts {
  segments: number | null
  parkingSpaces: number | null
  signOverrides: number | null
  inferredCandidates: number | null
}

interface AnswerCaseReviewFallback {
  path: string
  reviewedRows: number
}

interface PublishGateEntry {
  status: PublishGateStatus
  warnCodes: string[]
  failCodes: string[]
  warnAllowed: boolean
}

export interface DistrictReadinessEntry {
  districtId: string
  districtName: string
  configPath: string
  runtimeStatus: RuntimeStatus
  dataPackStatus: DataPackStatus
  primaryDatasetSource: 'public' | 'dry-run' | null
  datasetHash: string | null
  generatedAt: string | null
  counts: DatasetCounts
  reviewStatus: ReviewStatus
  reviewPath: string | null
  nextReviewPath: string | null
  reviewedRows: number | null
  validReviewedRows: number | null
  pendingReviewRows: number | null
  publishGateStatus: PublishGateStatus
  publishGateWarnCodes: string[]
  publishGateFailCodes: string[]
  publishGateWarnAllowed: boolean
  blockers: string[]
}

export interface DistrictReadinessMatrixOptions {
  configGlob?: string
  districtIds?: string[]
  publicRoot?: string
  dryRunRoot?: string
  reviewRoot?: string
  answerCasesGlob?: string
  allowAnswerCaseReviewFallback?: boolean
  registryPath?: string | null
  summaryPath?: string
  json?: boolean
}

export interface DistrictReadinessMatrixResult {
  configGlob: string
  districtIds: string[]
  missingDistrictIds: string[]
  publicRoot: string
  dryRunRoot: string
  reviewRoot: string
  registryPath: string
  registryFound: boolean
  entries: DistrictReadinessEntry[]
  hasBlockers: boolean
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

const parseDistrictIds = (value: string | null) =>
  value === null
    ? []
    : value
        .split(',')
        .map((districtId) => districtId.trim())
        .filter(Boolean)

export const parseDistrictReadinessMatrixArgs = (
  argv: string[],
): DistrictReadinessMatrixOptions => ({
  configGlob:
    getArgValue(argv, '--configs', '--config-glob', '--configGlob') ??
    DEFAULT_CONFIG_GLOB,
  districtIds: parseDistrictIds(getArgValue(argv, '--district', '--districts')),
  publicRoot:
    getArgValue(argv, '--public-root', '--publicRoot') ?? DEFAULT_PUBLIC_ROOT,
  dryRunRoot:
    getArgValue(argv, '--dry-run-root', '--dryRunRoot') ?? DEFAULT_DRY_RUN_ROOT,
  reviewRoot: getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  answerCasesGlob:
    getArgValue(
      argv,
      '--answer-cases',
      '--answer-cases-glob',
      '--answerCasesGlob',
    ) ?? undefined,
  allowAnswerCaseReviewFallback: argv.includes(
    '--allow-answer-case-review-fallback',
  )
    ? true
    : undefined,
  registryPath:
    getArgValue(argv, '--registry', '--registry-path', '--registryPath') ??
    undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: argv.includes('--json'),
})

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const readJsonIfExists = async (targetPath: string) => {
  if (!(await fileExists(targetPath))) {
    return null
  }
  const raw = await fs.readFile(targetPath, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getString = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const getNumber = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const getCountsRecord = (meta: Record<string, unknown> | null) =>
  meta?.counts && typeof meta.counts === 'object' && !Array.isArray(meta.counts)
    ? (meta.counts as Record<string, unknown>)
    : null

const getCount = (
  meta: Record<string, unknown> | null,
  topLevelKey: string,
  countsKey: string,
) => getNumber(meta, topLevelKey) ?? getNumber(getCountsRecord(meta), countsKey)

const readConfigs = async (configGlob: string) => {
  const matches = await fg(configGlob.replace(/\\/g, '/'), {
    absolute: true,
    onlyFiles: true,
  })
  const entries: DistrictConfigEntry[] = []
  for (const configPath of matches) {
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const districtId = getString(parsed, 'districtId')
    if (
      !districtId ||
      !parsed.inputs ||
      typeof parsed.inputs !== 'object' ||
      Array.isArray(parsed.inputs)
    ) {
      continue
    }
    entries.push({
      districtId,
      districtName: getString(parsed, 'districtName') ?? districtId,
      configPath,
    })
  }
  return entries.sort((left, right) => left.districtId.localeCompare(right.districtId))
}

const readRegistryDistrictIds = async (registryPath: string) => {
  const registry = await readJsonIfExists(registryPath)
  if (!registry) {
    return { found: false, districtIds: new Set<string>() }
  }
  const districts = Array.isArray(registry.districts) ? registry.districts : []
  const districtIds = new Set<string>()
  districts.forEach((entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const districtId = getString(entry as Record<string, unknown>, 'districtId')
      if (districtId) {
        districtIds.add(districtId)
      }
    }
  })
  return { found: true, districtIds }
}

const resolveRuntimeStatus = (params: {
  registryIds: Set<string>
  publicMetaExists: boolean
  districtId: string
}): RuntimeStatus => {
  const inRegistry = params.registryIds.has(params.districtId)
  if (inRegistry && params.publicMetaExists) {
    return 'published'
  }
  if (inRegistry && !params.publicMetaExists) {
    return 'registry-missing-dir'
  }
  if (!inRegistry && params.publicMetaExists) {
    return 'stale-public-dir'
  }
  return 'not-published'
}

const findReviewPath = async (reviewRoot: string, districtId: string) => {
  const candidates = [
    path.join(reviewRoot, `${districtId}-current-review.merged.csv`),
    path.join(reviewRoot, `${districtId}-review.merged.csv`),
    path.join(reviewRoot, `${districtId}-review.csv`),
  ].map((candidate) => path.resolve(candidate))

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }
  return null
}

const summarizeReview = async (reviewPath: string | null) => {
  if (!reviewPath) {
    return {
      reviewStatus: 'missing' as ReviewStatus,
      reviewedRows: null,
      validReviewedRows: null,
      pendingReviewRows: null,
    }
  }
  const summary = await buildQaReviewSummary({
    inputPath: reviewPath,
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
  return {
    reviewStatus: summary.pass ? 'pass' : ('blocked' as ReviewStatus),
    reviewedRows: summary.reviewedRows,
    validReviewedRows: summary.validReviewedRows,
    pendingReviewRows: summary.pendingRows,
  }
}

const readAnswerCaseReviewFallbacks = async (answerCasesGlob: string) => {
  const files = await fg(answerCasesGlob.replace(/\\/g, '/'), {
    absolute: true,
    onlyFiles: true,
    dot: false,
  })
  const fallbacks = new Map<string, AnswerCaseReviewFallback>()
  for (const file of files) {
    const parsed = await readJsonIfExists(file)
    const districtId =
      getString(parsed, 'districtId') ??
      path.basename(file, '.answer-cases.json')
    const cases = Array.isArray(parsed?.cases) ? parsed.cases : []
    if (districtId && cases.length > 0) {
      fallbacks.set(districtId, {
        path: file,
        reviewedRows: cases.length,
      })
    }
  }
  return fallbacks
}

const answerCaseFallbackReview = (fallback: AnswerCaseReviewFallback) => ({
  reviewStatus: 'pass' as ReviewStatus,
  reviewedRows: fallback.reviewedRows,
  validReviewedRows: fallback.reviewedRows,
  pendingReviewRows: 0,
})

const readPublishGateEntries = async (paths: string[]) => {
  const entries = new Map<string, PublishGateEntry>()
  for (const summaryPath of paths) {
    const summary = await readJsonIfExists(summaryPath)
    const districts = Array.isArray(summary?.districts) ? summary.districts : []
    const summaryWarnOverrideAllowed =
      summary?.allowWarn === true &&
      Boolean(getString(summary, 'overrideReason')) &&
      getNumber(summary, 'exitCode') === 0
    const baselineAdopt = isRecord(summary?.baselineAdopt)
      ? summary.baselineAdopt
      : null
    const baselineAdoptedIds = new Set(
      Array.isArray(baselineAdopt?.districtIds)
        ? baselineAdopt.districtIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
    )
    districts.forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return
      }
      const record = entry as Record<string, unknown>
      const districtId = getString(record, 'districtId')
      if (!districtId) {
        return
      }
      const fail = getNumber(record, 'fail') ?? 0
      const warn = getNumber(record, 'warn') ?? 0
      const topFailCodes = Array.isArray(record.topFailCodes)
        ? record.topFailCodes.filter((value): value is string => typeof value === 'string')
        : []
      const topWarnCodes = Array.isArray(record.topWarnCodes)
        ? record.topWarnCodes.filter((value): value is string => typeof value === 'string')
        : []
      const baselineAdopted = baselineAdoptedIds.has(districtId) && fail === 0
      const warnAllowed =
        warn > 0 && fail === 0 && (baselineAdopted || summaryWarnOverrideAllowed)
      entries.set(districtId, {
        status: fail > 0 ? 'fail' : warn > 0 && !warnAllowed ? 'warn' : 'pass',
        warnCodes: topWarnCodes,
        failCodes: topFailCodes,
        warnAllowed,
      })
    })
  }
  return entries
}

const buildBlockers = (params: {
  runtimeStatus: RuntimeStatus
  dataPackStatus: DataPackStatus
  counts: DatasetCounts
  reviewStatus: ReviewStatus
  publishGateStatus: PublishGateStatus
  publishGateWarnCodes: string[]
  publishGateFailCodes: string[]
  publishGateWarnAllowed: boolean
}) => {
  const blockers: string[] = []
  if (params.runtimeStatus !== 'published') {
    blockers.push(`runtime ${params.runtimeStatus}`)
  }
  if (params.runtimeStatus !== 'published' && params.dataPackStatus === 'missing') {
    blockers.push('dry-run pack missing')
  }
  if (!params.counts.parkingSpaces) {
    blockers.push('parking spaces missing or zero')
  }
  if (!params.counts.inferredCandidates) {
    blockers.push('inferred candidates missing or zero')
  }
  if (!params.counts.signOverrides) {
    blockers.push('sign overrides missing or zero')
  }
  if (params.reviewStatus !== 'pass') {
    blockers.push(`review ${params.reviewStatus}`)
  }
  if (params.publishGateStatus === 'fail') {
    blockers.push(`publish gate fail: ${params.publishGateFailCodes.join(', ') || 'unknown'}`)
  }
  if (
    (params.publishGateStatus === 'warn' || params.publishGateWarnCodes.length > 0) &&
    !params.publishGateWarnAllowed
  ) {
    blockers.push(`publish gate warn: ${params.publishGateWarnCodes.join(', ') || 'unknown'}`)
  }
  return blockers
}

const buildEntry = async (params: {
  config: DistrictConfigEntry
  publicRoot: string
  dryRunRoot: string
  reviewRoot: string
  registryIds: Set<string>
  publicPublishGateEntries: Map<
    string,
    PublishGateEntry
  >
  dryRunPublishGateEntries: Map<
    string,
    PublishGateEntry
  >
  answerCaseReviewFallbacks: Map<string, AnswerCaseReviewFallback>
}) => {
  const {
    config,
    publicRoot,
    dryRunRoot,
    reviewRoot,
    registryIds,
    publicPublishGateEntries,
    dryRunPublishGateEntries,
    answerCaseReviewFallbacks,
  } = params
  const publicMetaPath = path.resolve(publicRoot, config.districtId, 'dataset_meta.json')
  const dryRunMetaPath = path.resolve(dryRunRoot, config.districtId, 'dataset_meta.json')
  const publicMeta = await readJsonIfExists(publicMetaPath)
  const dryRunMeta = await readJsonIfExists(dryRunMetaPath)
  const runtimeStatus = resolveRuntimeStatus({
    registryIds,
    publicMetaExists: Boolean(publicMeta),
    districtId: config.districtId,
  })
  const dataPackStatus: DataPackStatus = dryRunMeta ? 'available' : 'missing'
  const primaryDatasetSource =
    runtimeStatus === 'published'
      ? publicMeta
        ? ('public' as const)
        : null
      : dryRunMeta
        ? ('dry-run' as const)
        : publicMeta
          ? ('public' as const)
          : null
  const meta = primaryDatasetSource === 'public' ? publicMeta : dryRunMeta
  const counts: DatasetCounts = {
    segments: getCount(meta, 'segmentsCount', 'segments'),
    parkingSpaces: getCount(meta, 'parkingSpacesCount', 'parkingSpaces'),
    signOverrides: getCount(meta, 'signOverridesCount', 'signOverrides'),
    inferredCandidates: getCount(meta, 'inferredCandidatesCount', 'inferredCandidates'),
  }
  const reviewCsvPath = await findReviewPath(reviewRoot, config.districtId)
  const answerCaseReviewFallback =
    answerCaseReviewFallbacks.get(config.districtId) ?? null
  const reviewPath = reviewCsvPath ?? answerCaseReviewFallback?.path ?? null
  const nextReviewPath = path.resolve(reviewRoot, `${config.districtId}-next-review.csv`)
  const review = reviewCsvPath
    ? await summarizeReview(reviewCsvPath)
    : answerCaseReviewFallback
      ? answerCaseFallbackReview(answerCaseReviewFallback)
      : await summarizeReview(null)
  const primaryPublishGateEntries =
    primaryDatasetSource === 'public'
      ? publicPublishGateEntries
      : dryRunPublishGateEntries
  const fallbackPublishGateEntries =
    primaryDatasetSource === 'public'
      ? dryRunPublishGateEntries
      : publicPublishGateEntries
  const publishGate =
    primaryPublishGateEntries.get(config.districtId) ??
    fallbackPublishGateEntries.get(config.districtId) ?? {
    status: 'unknown' as PublishGateStatus,
    warnCodes: [],
    failCodes: [],
    warnAllowed: false,
  }
  const blockers = buildBlockers({
    runtimeStatus,
    dataPackStatus,
    counts,
    reviewStatus: review.reviewStatus,
    publishGateStatus: publishGate.status,
    publishGateWarnCodes: publishGate.warnCodes,
    publishGateFailCodes: publishGate.failCodes,
    publishGateWarnAllowed: publishGate.warnAllowed,
  })

  return {
    districtId: config.districtId,
    districtName: config.districtName,
    configPath: config.configPath,
    runtimeStatus,
    dataPackStatus,
    primaryDatasetSource,
    datasetHash: getString(meta, 'datasetHash'),
    generatedAt: getString(meta, 'generatedAt'),
    counts,
    reviewStatus: review.reviewStatus,
    reviewPath,
    nextReviewPath: (await fileExists(nextReviewPath)) ? nextReviewPath : null,
    reviewedRows: review.reviewedRows,
    validReviewedRows: review.validReviewedRows,
    pendingReviewRows: review.pendingReviewRows,
    publishGateStatus: publishGate.status,
    publishGateWarnCodes: publishGate.warnCodes,
    publishGateFailCodes: publishGate.failCodes,
    publishGateWarnAllowed: publishGate.warnAllowed,
    blockers,
  } satisfies DistrictReadinessEntry
}

export const runDistrictReadinessMatrix = async (
  options: DistrictReadinessMatrixOptions = {},
): Promise<DistrictReadinessMatrixResult> => {
  const configGlob = options.configGlob ?? DEFAULT_CONFIG_GLOB
  const publicRoot = path.resolve(options.publicRoot ?? DEFAULT_PUBLIC_ROOT)
  const dryRunRoot = path.resolve(options.dryRunRoot ?? DEFAULT_DRY_RUN_ROOT)
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const registryPath = path.resolve(
    options.registryPath ?? path.join(publicRoot, 'registry.json'),
  )
  const allConfigs = await readConfigs(configGlob)
  const districtIds = (options.districtIds ?? [])
    .map((districtId) => districtId.trim())
    .filter(Boolean)
  const districtFilter = new Set(districtIds)
  const configs =
    districtFilter.size > 0
      ? allConfigs.filter((config) => districtFilter.has(config.districtId))
      : allConfigs
  const foundDistrictIds = new Set(configs.map((config) => config.districtId))
  const missingDistrictIds = districtIds.filter(
    (districtId) => !foundDistrictIds.has(districtId),
  )
  const registry = await readRegistryDistrictIds(registryPath)
  const allowAnswerCaseReviewFallback = resolveAnswerCaseReviewFallbackAllowance(
    options.allowAnswerCaseReviewFallback,
  )
  const answerCaseReviewFallbacks = allowAnswerCaseReviewFallback
    ? await readAnswerCaseReviewFallbacks(
        options.answerCasesGlob ?? DEFAULT_REVIEWED_ANSWER_CASES_GLOB,
      )
    : new Map<string, AnswerCaseReviewFallback>()
  const publicPublishGateEntries = await readPublishGateEntries([
    path.join(publicRoot, '_ops', 'publish_gate_summary.json'),
  ])
  const dryRunPublishGateEntries = await readPublishGateEntries([
    path.join(dryRunRoot, '_ops', 'publish_gate_summary.json'),
  ])
  const entries = await Promise.all(
    configs.map((config) =>
      buildEntry({
        config,
        publicRoot,
        dryRunRoot,
        reviewRoot,
        registryIds: registry.districtIds,
        publicPublishGateEntries,
        dryRunPublishGateEntries,
        answerCaseReviewFallbacks,
      }),
    ),
  )

  return {
    configGlob,
    districtIds,
    missingDistrictIds,
    publicRoot,
    dryRunRoot,
    reviewRoot,
    registryPath,
    registryFound: registry.found,
    entries,
    hasBlockers:
      missingDistrictIds.length > 0 ||
      entries.some((entry) => entry.blockers.length > 0),
  }
}

const formatCount = (value: number | null) => (value === null ? '-' : String(value))

export const renderDistrictReadinessMatrix = (
  result: DistrictReadinessMatrixResult,
) => {
  const lines = [
    `District readiness matrix: ${result.hasBlockers ? 'WARN' : 'PASS'}`,
    `Configs: ${result.configGlob}`,
    `District filter: ${result.districtIds.join(', ') || 'all'}`,
    `Missing requested districts: ${result.missingDistrictIds.join(', ') || 'none'}`,
    `Public root: ${result.publicRoot}`,
    `Dry-run root: ${result.dryRunRoot}`,
    `Review root: ${result.reviewRoot}`,
    `Registry: ${result.registryFound ? result.registryPath : '-'}`,
    '',
    '| District | Runtime | Data | Parking | Inferred | Overrides | Review | Publish gate | Blockers |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
  ]

  result.entries.forEach((entry) => {
    lines.push(
      [
        `| ${entry.districtId}`,
        entry.runtimeStatus,
        entry.dataPackStatus,
        formatCount(entry.counts.parkingSpaces),
        formatCount(entry.counts.inferredCandidates),
        formatCount(entry.counts.signOverrides),
        entry.reviewStatus,
        entry.publishGateStatus,
        `${entry.blockers.join('; ') || 'none'} |`,
      ].join(' | '),
    )
  })

  lines.push('')
  result.entries.forEach((entry) => {
    lines.push(`- ${entry.districtId}: dataset ${entry.datasetHash ?? '-'} (${entry.primaryDatasetSource ?? '-'})`)
    lines.push(`  Review: ${entry.reviewPath ?? '-'}; next: ${entry.nextReviewPath ?? '-'}`)
    lines.push(
      `  Publish gate codes: warn ${entry.publishGateWarnCodes.join(', ') || 'none'}${entry.publishGateWarnAllowed ? ' (allowed)' : ''}; fail ${entry.publishGateFailCodes.join(', ') || 'none'}`,
    )
  })

  return lines.join('\n')
}

export const resolveDistrictReadinessMatrixSummaryPath = (
  options: Pick<DistrictReadinessMatrixOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseDistrictReadinessMatrixArgs(process.argv)
  const result = await runDistrictReadinessMatrix(options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderDistrictReadinessMatrix(result)
  console.log(output)

  const summaryPath = resolveDistrictReadinessMatrixSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderDistrictReadinessMatrix(result)}\n\n`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
