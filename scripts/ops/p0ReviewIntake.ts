import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import fg from 'fast-glob'
import {
  type HumanReviewBundleEntry,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'
import {
  type P0ValidatePriorityReviewOptions,
  type P0ValidatePriorityReviewResult,
  runP0ValidatePriorityReview,
} from './p0ValidatePriorityReview'
import { VALID_QA_REVIEW_STATUSES } from './qaReviewSummaryTypes'
import { isValidReviewTimestamp } from './reviewTimestamp'

const DEFAULT_REVIEW_ROOT = '.tmp'
const DEFAULT_CONFIG_ROOT = 'configs/prod'
const DEFAULT_PUBLISH_GATE_SUMMARY = 'data/generated/_ops/publish_gate_summary.json'
const DEFAULT_MAX_FILES = 500

type IntakeStatus =
  | 'ready-to-finalize'
  | 'ready-to-validate'
  | 'action-required'
  | 'empty'
  | 'blocked'

export interface P0ReviewIntakeOptions {
  reviewRoot?: string
  configRoot?: string
  districtIds?: string[]
  scanDirs?: string[]
  includeCommonDirs?: boolean
  publishGateSummaryPath?: string | null
  maxFiles?: number
  validateReady?: boolean
  actionableOnly?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string
  json?: boolean
  validatePriorityReview?: (
    options: P0ValidatePriorityReviewOptions,
  ) => Promise<P0ValidatePriorityReviewResult>
}

export interface P0ReviewIntakeCandidate {
  districtId: string
  filePath: string
  isCanonicalHandoff: boolean
  totalRows: number
  relevantRows: number
  reviewedRows: number
  validReviewedRows: number
  invalidStatusRows: number
  missingEvidenceRows: number
  invalidTimestampRows: number
  statusCounts: Record<string, number>
  reviewedBucketCounts: Record<string, number>
  hasSourceRowNumber: boolean
  hasReviewIdentity: boolean
  nextAction: string
  validationCommand: string | null
  validation: P0ValidatePriorityReviewResult | null
  finalizeCommand: string | null
}

export interface P0ReviewIntakeResult {
  pass: boolean
  status: IntakeStatus
  reviewRoot: string
  scanDirs: string[]
  selectedDistricts: string[]
  scannedFiles: number
  candidates: P0ReviewIntakeCandidate[]
  errors: string[]
  warnings: string[]
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

const parsePositiveInteger = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const parseP0ReviewIntakeArgs = (
  argv: string[],
): P0ReviewIntakeOptions => ({
  reviewRoot:
    getArgValue(argv, '--review-root', '--reviewRoot') ?? DEFAULT_REVIEW_ROOT,
  configRoot:
    getArgValue(argv, '--config-root', '--configRoot') ?? DEFAULT_CONFIG_ROOT,
  districtIds: getArgValues(argv, '--district', '--district-id', '--districtId'),
  scanDirs: getArgValues(argv, '--scan-dir', '--scanDir'),
  includeCommonDirs: hasFlag(argv, '--include-common-dirs', '--includeCommonDirs'),
  publishGateSummaryPath: hasFlag(argv, '--no-publish-gate-summary')
    ? null
    : (getArgValue(
        argv,
        '--publish-gate-summary',
        '--publishGateSummary',
        '--publish-gate-summary-path',
        '--publishGateSummaryPath',
      ) ?? DEFAULT_PUBLISH_GATE_SUMMARY),
  maxFiles: parsePositiveInteger(
    getArgValue(argv, '--max-files', '--maxFiles'),
    DEFAULT_MAX_FILES,
  ),
  validateReady: hasFlag(argv, '--validate-ready', '--validateReady'),
  actionableOnly: hasFlag(argv, '--actionable-only', '--actionableOnly'),
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath') ?? undefined,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  json: hasFlag(argv, '--json'),
})

const normalizeHeader = (value: string) => value.trim().toLowerCase()

const hasHeader = (headers: string[], candidates: string[]) => {
  const normalized = new Set(headers.map(normalizeHeader))
  return candidates.some((candidate) => normalized.has(normalizeHeader(candidate)))
}

const findHeader = (headers: string[], candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalizeHeader)
  return (
    headers.find((header) =>
      normalizedCandidates.includes(normalizeHeader(header)),
    ) ?? null
  )
}

const getCsvValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

const getHeaderValue = (row: Record<string, unknown>, header: string | null) => {
  if (!header) {
    return ''
  }
  const value = row[header]
  return typeof value === 'string' ? value.trim() : ''
}

const getReviewStatus = (row: Record<string, unknown>, headers: string[]) => {
  const explicitReviewHeader = findHeader(headers, [
    'reviewStatus',
    'overrideStatus',
    'signOverrideStatus',
  ])
  if (explicitReviewHeader) {
    return getHeaderValue(row, explicitReviewHeader)
  }
  return getHeaderValue(row, findHeader(headers, ['status']))
}

const normalizeStatus = (value: string) => value.trim().toUpperCase()

const isValidStatus = (status: string) =>
  VALID_QA_REVIEW_STATUSES.includes(status as never)

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

const commonScanDirs = () => [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Downloads'),
]

const uniqueResolvedPaths = (paths: string[]) => {
  const seen = new Set<string>()
  return paths
    .map((entryPath) => path.resolve(entryPath))
    .filter((entryPath) => {
      const key = entryPath.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
}

const resolveScanDirs = (options: P0ReviewIntakeOptions) =>
  uniqueResolvedPaths([
    ...(options.scanDirs && options.scanDirs.length > 0
      ? options.scanDirs
      : [options.reviewRoot ?? DEFAULT_REVIEW_ROOT]),
    ...(options.includeCommonDirs ? commonScanDirs() : []),
  ])

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const candidateFileNameMatches = (filePath: string, districtIds: string[]) => {
  const lower = filePath.toLowerCase()
  return (
    /review|priority|next/.test(path.basename(lower)) ||
    districtIds.some((districtId) => lower.includes(districtId.toLowerCase()))
  )
}

const scanCsvFiles = async (
  scanDirs: string[],
  districtIds: string[],
  maxFiles: number,
) => {
  const existingDirs = []
  for (const scanDir of scanDirs) {
    if (await fileExists(scanDir)) {
      existingDirs.push(scanDir)
    }
  }
  const files = (
    await Promise.all(
      existingDirs.map((scanDir) =>
        fg(['**/*.csv'], {
          cwd: scanDir,
          absolute: true,
          onlyFiles: true,
          dot: true,
          ignore: [
            '**/.git/**',
            '**/node_modules/**',
            '**/dist/**',
            '**/public/data/generated/**',
            '**/data/generated/**',
          ],
        }),
      ),
    )
  )
    .flat()
    .map((filePath) => path.normalize(path.resolve(filePath)))
    .filter((filePath) => candidateFileNameMatches(filePath, districtIds))
    .sort((left, right) => left.localeCompare(right))
  return uniqueResolvedPaths(files).slice(0, maxFiles)
}

const parseCsvRecords = async (filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return parseCsv(raw, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]
}

const resolveDistrictRows = (
  filePath: string,
  rows: Record<string, unknown>[],
  districtId: string,
) => {
  const districtRows = rows.filter(
    (row) =>
      getCsvValue(row, ['districtId', 'district_id', 'district']) === districtId,
  )
  if (districtRows.length > 0) {
    return districtRows
  }
  return path.basename(filePath).toLowerCase().includes(districtId.toLowerCase())
    ? rows
    : []
}

const buildValidationCommand = (params: {
  districtId: string
  filePath: string
  configRoot: string
  bundleEntry: HumanReviewBundleEntry | undefined
}) => {
  const inputs = params.bundleEntry?.finalizeInputs
  const configPath =
    inputs?.configPath ?? path.join(params.configRoot, `${params.districtId}.json`)
  const answerCasesPath =
    inputs?.answerCasesPath ??
    path.join(params.configRoot, `${params.districtId}.answer-cases.json`)
  const args = [
    'npm run ops:p0-validate-priority-review --',
    '--district',
    params.districtId,
    '--config',
    quoteArg(configPath),
    '--answer-cases',
    quoteArg(answerCasesPath),
    ...(inputs?.sourcePath ? ['--source', quoteArg(inputs.sourcePath)] : []),
    '--reviews',
    quoteArg(params.filePath),
  ]
  if (inputs?.allowPublishWarn) {
    args.push('--allow-publish-warn')
  }
  if (inputs?.publishOverrideReason) {
    args.push('--publish-override', quoteArg(inputs.publishOverrideReason))
  }
  return args.join(' ')
}

const classifyCandidate = (params: {
  validReviewedRows: number
  reviewedRows: number
  invalidStatusRows: number
  missingEvidenceRows: number
  invalidTimestampRows: number
  hasSourceRowNumber: boolean
  hasReviewIdentity: boolean
}) => {
  if (!params.hasSourceRowNumber || !params.hasReviewIdentity) {
    return 'not a supported handoff CSV'
  }
  if (
    params.invalidStatusRows > 0 ||
    params.missingEvidenceRows > 0 ||
    params.invalidTimestampRows > 0
  ) {
    return 'fix invalid or incomplete reviewed rows'
  }
  if (params.validReviewedRows > 0) {
    return 'validate-priority-review'
  }
  if (params.reviewedRows > 0) {
    return 'fill missing evidence'
  }
  return 'fill review evidence'
}

const summarizeCandidate = (params: {
  districtId: string
  filePath: string
  configRoot: string
  rows: Record<string, unknown>[]
  allHeaders: string[]
  bundleEntry: HumanReviewBundleEntry | undefined
}): P0ReviewIntakeCandidate => {
  const statusCounts: Record<string, number> = {}
  const reviewedBucketCounts: Record<string, number> = {}
  let reviewedRows = 0
  let validReviewedRows = 0
  let invalidStatusRows = 0
  let missingEvidenceRows = 0
  let invalidTimestampRows = 0

  params.rows.forEach((row) => {
    const status = normalizeStatus(getReviewStatus(row, params.allHeaders))
    const note = getCsvValue(row, ['reviewNote', 'note', 'overrideNote'])
    const createdAt = getCsvValue(row, ['createdAt', 'reviewedAt', 'verifiedAt'])
    if (!status) {
      return
    }
    reviewedRows += 1
    increment(statusCounts, status)
    increment(
      reviewedBucketCounts,
      getCsvValue(row, ['reviewBucket', 'bucket', 'sampleBucket']) || 'unbucketed',
    )
    if (!isValidStatus(status)) {
      invalidStatusRows += 1
      return
    }
    if (!note || !createdAt) {
      missingEvidenceRows += 1
      return
    }
    if (!isValidReviewTimestamp(createdAt)) {
      invalidTimestampRows += 1
      return
    }
    validReviewedRows += 1
  })

  const hasSourceRowNumber = hasHeader(params.allHeaders, ['sourceRowNumber'])
  const hasReviewIdentity =
    hasHeader(params.allHeaders, ['districtId', 'district_id', 'district']) &&
    hasHeader(params.allHeaders, ['segmentId', 'segment_id', 'segment'])
  const nextAction = classifyCandidate({
    validReviewedRows,
    reviewedRows,
    invalidStatusRows,
    missingEvidenceRows,
    invalidTimestampRows,
    hasSourceRowNumber,
    hasReviewIdentity,
  })

  return {
    districtId: params.districtId,
    filePath: params.filePath,
    isCanonicalHandoff:
      params.bundleEntry?.files.handoffCsv.path !== undefined &&
      path.resolve(params.bundleEntry.files.handoffCsv.path).toLowerCase() ===
        path.resolve(params.filePath).toLowerCase(),
    totalRows: params.rows.length,
    relevantRows: params.rows.length,
    reviewedRows,
    validReviewedRows,
    invalidStatusRows,
    missingEvidenceRows,
    invalidTimestampRows,
    statusCounts,
    reviewedBucketCounts,
    hasSourceRowNumber,
    hasReviewIdentity,
    nextAction,
    validationCommand:
      nextAction === 'validate-priority-review'
        ? buildValidationCommand({
            districtId: params.districtId,
            filePath: params.filePath,
            configRoot: params.configRoot,
            bundleEntry: params.bundleEntry,
          })
        : null,
    validation: null,
    finalizeCommand: null,
  }
}

const allHeadersFromRows = (rows: Record<string, unknown>[]) =>
  Array.from(new Set(rows.flatMap((row) => Object.keys(row))))

const statusForCandidates = (
  errors: string[],
  candidates: P0ReviewIntakeCandidate[],
): IntakeStatus => {
  if (errors.length > 0) {
    return 'blocked'
  }
  if (candidates.some((candidate) => candidate.finalizeCommand)) {
    return 'ready-to-finalize'
  }
  if (candidates.some((candidate) => candidate.validationCommand)) {
    return 'ready-to-validate'
  }
  return candidates.length > 0 ? 'action-required' : 'empty'
}

const validateCandidate = async (
  candidate: P0ReviewIntakeCandidate,
  configRoot: string,
  bundleEntry: HumanReviewBundleEntry | undefined,
  validatePriorityReview: (
    options: P0ValidatePriorityReviewOptions,
  ) => Promise<P0ValidatePriorityReviewResult>,
) => {
  if (!candidate.validationCommand) {
    return candidate
  }
  const finalizeInputs = bundleEntry?.finalizeInputs
  const validation = await validatePriorityReview({
    districtId: candidate.districtId,
    configPath:
      finalizeInputs?.configPath ?? path.join(configRoot, `${candidate.districtId}.json`),
    answerCasesPath:
      finalizeInputs?.answerCasesPath ??
      path.join(configRoot, `${candidate.districtId}.answer-cases.json`),
    sourcePath: finalizeInputs?.sourcePath,
    reviewsPath: candidate.filePath,
    allowPublishWarn: finalizeInputs?.allowPublishWarn,
    publishOverrideReason: finalizeInputs?.publishOverrideReason,
  })
  return {
    ...candidate,
    nextAction: validation.pass ? 'finalize-review' : 'fix validation errors',
    validation,
    finalizeCommand: validation.finalizeCommand,
  }
}

const actionableCandidate = (candidate: P0ReviewIntakeCandidate) =>
  candidate.hasSourceRowNumber &&
  candidate.hasReviewIdentity &&
  (candidate.isCanonicalHandoff || candidate.reviewedRows > 0)

export const runP0ReviewIntake = async (
  options: P0ReviewIntakeOptions = {},
): Promise<P0ReviewIntakeResult> => {
  const reviewRoot = path.resolve(options.reviewRoot ?? DEFAULT_REVIEW_ROOT)
  const configRoot = options.configRoot ?? DEFAULT_CONFIG_ROOT
  const selectedDistricts = options.districtIds ?? []
  const scanDirs = resolveScanDirs({ ...options, reviewRoot })
  const errors: string[] = []
  const warnings: string[] = []
  if (selectedDistricts.length === 0) {
    errors.push('Pass at least one --district value.')
  }

  const publishGateSummaryPath =
    options.publishGateSummaryPath === undefined
      ? DEFAULT_PUBLISH_GATE_SUMMARY
      : options.publishGateSummaryPath
  const index = await runHumanReviewBundleIndex({
    reviewRoot,
    configRoot,
    districtIds: selectedDistricts,
    publishGateSummaryPath,
  })
  warnings.push(...index.warnings)
  const bundleByDistrict = new Map(
    index.entries.map((entry) => [entry.districtId, entry] as const),
  )

  let scannedFiles = 0
  const candidates: P0ReviewIntakeCandidate[] = []
  if (errors.length === 0) {
    const files = await scanCsvFiles(
      scanDirs,
      selectedDistricts,
      options.maxFiles ?? DEFAULT_MAX_FILES,
    )
    scannedFiles = files.length
    if (files.length >= (options.maxFiles ?? DEFAULT_MAX_FILES)) {
      warnings.push(
        `CSV scan reached max file limit ${(options.maxFiles ?? DEFAULT_MAX_FILES).toString()}; narrow --scan-dir if expected files are missing.`,
      )
    }
    for (const filePath of files) {
      let rows: Record<string, unknown>[]
      try {
        rows = await parseCsvRecords(filePath)
      } catch (error) {
        warnings.push(
          `Skipped unparsable CSV ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        )
        continue
      }
      const headers = allHeadersFromRows(rows)
      selectedDistricts.forEach((districtId) => {
        const districtRows = resolveDistrictRows(filePath, rows, districtId)
        if (districtRows.length === 0) {
          return
        }
        candidates.push(
          summarizeCandidate({
            districtId,
            filePath,
            configRoot,
            rows: districtRows,
            allHeaders: headers,
            bundleEntry: bundleByDistrict.get(districtId),
          }),
        )
      })
    }
  }

  candidates.sort(
    (left, right) =>
      right.validReviewedRows - left.validReviewedRows ||
      right.reviewedRows - left.reviewedRows ||
      left.districtId.localeCompare(right.districtId) ||
      left.filePath.localeCompare(right.filePath),
  )
  if (options.validateReady) {
    const validatedCandidates: P0ReviewIntakeCandidate[] = []
    for (const candidate of candidates) {
      validatedCandidates.push(
        await validateCandidate(
          candidate,
          configRoot,
          bundleByDistrict.get(candidate.districtId),
          options.validatePriorityReview ?? runP0ValidatePriorityReview,
        ),
      )
    }
    candidates.splice(0, candidates.length, ...validatedCandidates)
  }
  if (options.actionableOnly) {
    candidates.splice(
      0,
      candidates.length,
      ...candidates.filter(actionableCandidate),
    )
  }
  const status = statusForCandidates(errors, candidates)
  return {
    pass: status !== 'blocked',
    status,
    reviewRoot,
    scanDirs,
    selectedDistricts,
    scannedFiles,
    candidates,
    errors,
    warnings,
  }
}

const formatCounts = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return entries.length === 0
    ? 'none'
    : entries.map(([key, value]) => `${key} ${value}`).join(', ')
}

export const renderP0ReviewIntake = (result: P0ReviewIntakeResult) => {
  const lines = [
    `P0 review intake: ${result.pass ? result.status.toUpperCase() : 'BLOCKED'}`,
    `Review root: ${result.reviewRoot}`,
    `Scan dirs: ${result.scanDirs.join(', ') || 'none'}`,
    `Selected districts: ${result.selectedDistricts.join(', ') || 'none'}`,
    `Scanned CSV files: ${result.scannedFiles}`,
    '',
    '| District | Valid | Reviewed | Rows | Next action | File |',
    '| --- | ---: | ---: | ---: | --- | --- |',
  ]

  if (result.candidates.length === 0) {
    lines.push('| - | 0 | 0 | 0 | no review CSV found | - |')
  }
  result.candidates.forEach((candidate) => {
    lines.push(
      [
        `| ${candidate.districtId}`,
        candidate.validReviewedRows,
        candidate.reviewedRows,
        candidate.relevantRows,
        candidate.nextAction,
        `${candidate.filePath} |`,
      ].join(' | '),
    )
  })

  const readyCommands = result.candidates
    .map((candidate) =>
      candidate.finalizeCommand
        ? `Finalize ${candidate.districtId}: ${candidate.finalizeCommand}`
        : candidate.validationCommand
          ? `Validate ${candidate.districtId}: ${candidate.validationCommand}`
          : null,
    )
    .filter((command): command is string => Boolean(command))
  lines.push('', '## Ready Commands')
  if (readyCommands.length === 0) {
    lines.push('- none')
  } else {
    readyCommands.forEach((command) => lines.push(`- ${command}`))
  }

  lines.push('', '## Candidate Details')
  if (result.candidates.length === 0) {
    lines.push('- none')
  }
  result.candidates.slice(0, 30).forEach((candidate) => {
    lines.push(
      `- ${candidate.districtId}: valid ${candidate.validReviewedRows}, reviewed ${candidate.reviewedRows}, invalid status ${candidate.invalidStatusRows}, missing evidence ${candidate.missingEvidenceRows}, invalid timestamp ${candidate.invalidTimestampRows}, validation ${candidate.validation ? (candidate.validation.pass ? 'PASS' : 'FAIL') : 'not run'}, statuses ${formatCounts(candidate.statusCounts)}, reviewed buckets ${formatCounts(candidate.reviewedBucketCounts)}, file ${candidate.filePath}`,
    )
  })
  if (result.candidates.length > 30) {
    lines.push(`- ... ${result.candidates.length - 30} more candidate(s)`)
  }

  if (result.errors.length > 0) {
    lines.push('', '## Errors')
    result.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (result.warnings.length > 0) {
    lines.push('', '## Warnings')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }
  return lines.join('\n')
}

export const resolveP0ReviewIntakeSummaryPath = (
  options: Pick<P0ReviewIntakeOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP0ReviewIntakeArgs(process.argv)
  const result = await runP0ReviewIntake(options)
  const markdown = renderP0ReviewIntake(result)
  process.stdout.write(
    options.json ? `${JSON.stringify(result, null, 2)}\n` : `${markdown}\n`,
  )
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  const summaryPath = resolveP0ReviewIntakeSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${markdown}\n\n`)
  }
  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
