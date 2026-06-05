import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  discoverGeneratedPackDirs,
  resolveGeneratedPackSource,
  type SmokeGeneratedPacksOptions,
} from './smokeGeneratedPacks'
import {
  runSmokeUiParkingAnswers as runUiParkingAnswers,
  type SmokeUiParkingAnswerView,
  type SmokeUiParkingAnswersOptions,
  type SmokeUiParkingAnswersSummary,
} from './smokeUiParkingAnswers'
import { discoverReviewedDistrictIds } from './reviewedDistrictDiscovery'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'

export interface SmokeReviewedUiPacksOptions extends SmokeGeneratedPacksOptions {
  appUrl?: string
  chromePath?: string
  timeoutMs?: number
  startPreview?: boolean
  limit?: number
  view?: SmokeUiParkingAnswerView
}

export interface SmokeReviewedUiPacksRunners {
  runSmokeUiParkingAnswers: (
    options: SmokeUiParkingAnswersOptions,
  ) => Promise<SmokeUiParkingAnswersSummary>
}

export interface SmokeReviewedUiPackResult {
  districtId: string
  datasetDir: string
  casesPath: string
  reviewedCasesRequired: boolean
  reviewedCasesFound: boolean
  smokeRun: boolean
  summary: SmokeUiParkingAnswersSummary | null
  errors: string[]
}

export interface SmokeReviewedUiPacksResult {
  root: string
  registryPath: string | null
  reportPath: string | null
  packResults: SmokeReviewedUiPackResult[]
  errors: string[]
  hasErrors: boolean
}

const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'
const DEFAULT_TIMEOUT_MS = 25_000

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
  argv.forEach((value, index) => {
    if (flags.includes(value)) {
      const next = argv[index + 1]
      if (next) {
        values.push(next)
      }
    }
  })
  return values
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseDistrictList = (values: string[]) =>
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

const parseSmokeReviewedUiPacksView = (
  value: string | null,
): SmokeUiParkingAnswerView | undefined => {
  if (value === null) {
    return undefined
  }
  const normalized = value.trim().toUpperCase()
  if (normalized !== 'LIST' && normalized !== 'MAP') {
    throw new Error('--view must be LIST or MAP')
  }
  return normalized
}

export const parseSmokeReviewedUiPacksArgs = (
  argv: string[],
): SmokeReviewedUiPacksOptions => ({
  root: getArgValue(argv, '--root', '--data-root', '--dataRoot') ?? DEFAULT_ROOT,
  registryPath:
    getArgValue(argv, '--registry', '--registry-path', '--registryPath') ??
    undefined,
  reportPath: getArgValue(argv, '--report', '--report-path', '--reportPath') ?? undefined,
  answerCasesDir:
    getArgValue(argv, '--answer-cases-dir', '--answerCasesDir') ??
    DEFAULT_ANSWER_CASES_DIR,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  requiredReviewedCaseDistricts: parseDistrictList(
    getArgValues(
      argv,
      '--require-reviewed-cases',
      '--required-reviewed-cases',
      '--requireReviewedCases',
    ),
  ),
  reviewed: hasFlag(argv, '--reviewed'),
  requireGenerated: !hasFlag(
    argv,
    '--allow-missing-generated',
    '--allowMissingGenerated',
  ),
  scanDirectories: hasFlag(
    argv,
    '--scan-directories',
    '--scanDirectories',
    '--all-dirs',
    '--allDirs',
  ),
  allowMismatchedCaseHash: hasFlag(
    argv,
    '--allow-mismatched-case-hash',
    '--allowMismatchedCaseHash',
  )
    ? true
    : undefined,
  appUrl: getArgValue(argv, '--app-url', '--appUrl') ?? undefined,
  chromePath:
    getArgValue(argv, '--chrome-path', '--chromePath') ??
    process.env.CHROME_PATH ??
    undefined,
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? DEFAULT_TIMEOUT_MS,
  startPreview: !hasFlag(argv, '--no-start-preview', '--noStartPreview'),
  limit: parsePositiveInteger(getArgValue(argv, '--limit'), 'limit'),
  view: parseSmokeReviewedUiPacksView(getArgValue(argv, '--view')),
})

const fileExists = async (target: string) => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const reviewedCasesPathForDistrict = (answerCasesDir: string, districtId: string) =>
  path.join(answerCasesDir, `${districtId}.answer-cases.json`)

const answerCasesGlobForDir = (answerCasesDir: string) =>
  path.join(answerCasesDir, '*.answer-cases.json').replace(/\\/g, '/')

export const resolveSmokeReviewedUiPacksRequiredReviewedDistricts = async (
  options: Pick<
    SmokeReviewedUiPacksOptions,
    'answerCasesDir' | 'reviewed' | 'requiredReviewedCaseDistricts'
  >,
) => {
  const explicitDistricts = options.requiredReviewedCaseDistricts ?? []
  if (explicitDistricts.length > 0 || !options.reviewed) {
    return explicitDistricts
  }
  return await discoverReviewedDistrictIds(
    answerCasesGlobForDir(options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR),
  )
}

const defaultRunners: SmokeReviewedUiPacksRunners = {
  runSmokeUiParkingAnswers: runUiParkingAnswers,
}

export const resolveSmokeReviewedUiPacksSummaryPath = (
  options: Pick<SmokeReviewedUiPacksOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

export const runSmokeReviewedUiPacks = async (
  options: SmokeReviewedUiPacksOptions = {},
  runners: SmokeReviewedUiPacksRunners = defaultRunners,
): Promise<SmokeReviewedUiPacksResult> => {
  const root = options.root ?? DEFAULT_ROOT
  const allowMismatchedCaseHash =
    resolveReviewedCaseHashMismatchAllowance(options.allowMismatchedCaseHash)
  const resolvedSource = await resolveGeneratedPackSource({
    root,
    registryPath: options.registryPath,
    reportPath: options.reportPath,
    scanDirectories: options.scanDirectories,
  })
  const registryPath = resolvedSource.registryPath
  const reportPath = resolvedSource.reportPath
  const sourcePath = registryPath ?? reportPath
  const sourceLabel = registryPath ? 'Registry' : 'Report'
  const answerCasesDir = options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR
  const requiredDistricts = new Set(
    await resolveSmokeReviewedUiPacksRequiredReviewedDistricts(options),
  )
  const requireGenerated = options.requireGenerated ?? true
  const errors: string[] = []
  let datasetDirs: string[] = []

  try {
    datasetDirs = await discoverGeneratedPackDirs(root, sourcePath, sourceLabel)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  if (errors.length === 0 && datasetDirs.length === 0 && requireGenerated) {
    errors.push(`No generated district packs found under ${root}.`)
  }

  const packResults: SmokeReviewedUiPackResult[] = []
  for (const datasetDir of datasetDirs) {
    const districtId = path.basename(path.normalize(datasetDir))
    const casesPath = reviewedCasesPathForDistrict(answerCasesDir, districtId)
    const reviewedCasesRequired = requiredDistricts.has(districtId)
    const reviewedCasesFound = await fileExists(casesPath)
    const packErrors: string[] = []
    let summary: SmokeUiParkingAnswersSummary | null = null

    if (!reviewedCasesFound && reviewedCasesRequired) {
      packErrors.push(
        `Reviewed UI answer cases are required for generated district ${districtId}: ${casesPath}`,
      )
    }

    if (reviewedCasesFound) {
      try {
        summary = await runners.runSmokeUiParkingAnswers({
          appUrl: options.appUrl,
          casesPath,
          district: districtId,
          chromePath: options.chromePath,
          timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          startPreview: options.startPreview ?? true,
          limit: options.limit,
          view: options.view,
          allowMismatchedCaseHash,
        })
      } catch (error) {
        packErrors.push(error instanceof Error ? error.message : String(error))
      }
    }

    packResults.push({
      districtId,
      datasetDir,
      casesPath,
      reviewedCasesRequired,
      reviewedCasesFound,
      smokeRun: Boolean(summary),
      summary,
      errors: packErrors,
    })
  }

  return {
    root,
    registryPath,
    reportPath,
    packResults,
    errors,
    hasErrors:
      errors.length > 0 || packResults.some((result) => result.errors.length > 0),
  }
}

const formatCasesStatus = (result: SmokeReviewedUiPackResult) => {
  if (result.summary) {
    return `used ${result.casesPath}`
  }
  if (result.reviewedCasesRequired) {
    return `missing required ${result.casesPath}`
  }
  if (result.reviewedCasesFound) {
    return `found but UI smoke did not complete ${result.casesPath}`
  }
  return 'not found; skipped'
}

export const renderSmokeReviewedUiPacksResult = (
  result: SmokeReviewedUiPacksResult,
) => {
  const lines = [
    `Reviewed UI pack smoke: ${result.hasErrors ? 'FAIL' : 'PASS'}`,
    `Root: ${result.root}`,
    `Registry: ${result.registryPath ?? '-'}`,
    `Report: ${result.reportPath ?? '-'}`,
    `Packs: ${result.packResults.length}`,
  ]

  result.errors.forEach((error) => {
    lines.push(`ERROR: ${error}`)
  })

  result.packResults.forEach((pack) => {
    const status = pack.errors.length > 0 ? 'FAIL' : 'PASS'
    lines.push(`- ${status} ${pack.districtId} (${pack.datasetDir})`)
    lines.push(`  Reviewed cases: ${formatCasesStatus(pack)}`)
    if (pack.summary) {
      lines.push(
        `  UI cases: ${pack.summary.passCount}/${pack.summary.caseCount}; view ${pack.summary.view}; runtime hash ${pack.summary.runtimeDatasetHash ?? 'not checked'}`,
      )
    }
    pack.errors.forEach((error) => {
      lines.push(`  ERROR: ${error}`)
    })
  })

  return lines.join('\n')
}

const run = async () => {
  const options = parseSmokeReviewedUiPacksArgs(process.argv)
  const result = await runSmokeReviewedUiPacks(options)
  const output = renderSmokeReviewedUiPacksResult(result)
  console.log(output)
  const summaryPath = resolveSmokeReviewedUiPacksSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${output}\n\n`)
  }
  if (result.hasErrors) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
