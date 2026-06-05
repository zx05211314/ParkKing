import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  discoverGeneratedPackDirs,
  resolveGeneratedPackSource,
  type SmokeGeneratedPacksOptions,
} from './smokeGeneratedPacks'
import {
  runSmokeParkingAnswerService as runParkingAnswerService,
  type SmokeParkingAnswerServiceOptions,
  type SmokeParkingAnswerServiceSummary,
} from './smokeParkingAnswerService'
import { discoverReviewedDistrictIds } from './reviewedDistrictDiscovery'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'

export interface SmokeParkingAnswerServicesOptions
  extends SmokeGeneratedPacksOptions {
  timeoutMs?: number
  maxCases?: number
  hhmm?: string
  searchRadiusMeters?: number
  skipHealthCheck?: boolean
}

export interface SmokeParkingAnswerServicesRunners {
  runSmokeParkingAnswerService: (
    options: SmokeParkingAnswerServiceOptions,
  ) => Promise<SmokeParkingAnswerServiceSummary>
}

export interface SmokeParkingAnswerServicePackResult {
  districtId: string
  datasetDir: string
  casesPath: string
  reviewedCasesRequired: boolean
  reviewedCasesFound: boolean
  reviewedCasesUsed: boolean
  smokeRun: boolean
  summary: SmokeParkingAnswerServiceSummary | null
  errors: string[]
}

export interface SmokeParkingAnswerServicesResult {
  root: string
  registryPath: string | null
  reportPath: string | null
  packResults: SmokeParkingAnswerServicePackResult[]
  errors: string[]
  hasErrors: boolean
}

const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_HHMM = '21:00'
const DEFAULT_SEARCH_RADIUS_METERS = 25

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

const parseNumber = (value: string | null, label: string) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number`)
  }
  return parsed
}

export const parseSmokeParkingAnswerServicesArgs = (
  argv: string[],
): SmokeParkingAnswerServicesOptions => ({
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
  fixtureThresholds: hasFlag(
    argv,
    '--fixture-thresholds',
    '--fixtureThresholds',
  ),
  useReviewedCases: hasFlag(
    argv,
    '--use-reviewed-cases',
    '--useReviewedCases',
  ),
  reviewed: hasFlag(argv, '--reviewed'),
  requiredReviewedCaseDistricts: parseDistrictList(
    getArgValues(
      argv,
      '--require-reviewed-cases',
      '--required-reviewed-cases',
      '--requireReviewedCases',
    ),
  ),
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
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? DEFAULT_TIMEOUT_MS,
  maxCases: parsePositiveInteger(getArgValue(argv, '--max-cases', '--maxCases'), 'max-cases'),
  hhmm: getArgValue(argv, '--hhmm') ?? DEFAULT_HHMM,
  searchRadiusMeters:
    parseNumber(getArgValue(argv, '--radius', '--searchRadiusMeters'), 'radius') ??
    DEFAULT_SEARCH_RADIUS_METERS,
  skipHealthCheck: hasFlag(
    argv,
    '--skip-health-check',
    '--skipHealthCheck',
  ),
  allowMismatchedCaseHash: hasFlag(
    argv,
    '--allow-mismatched-case-hash',
    '--allowMismatchedCaseHash',
  )
    ? true
    : undefined,
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

export const resolveSmokeParkingAnswerServicesRequiredReviewedDistricts = async (
  options: Pick<
    SmokeParkingAnswerServicesOptions,
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

const applyFixtureThresholds = (
  options: SmokeParkingAnswerServiceOptions,
  districtId: string,
  fixtureThresholds: boolean | undefined,
) => {
  if (!fixtureThresholds) {
    return options
  }

  return {
    ...options,
    minMarkedSpaceParkAnswers: 0,
    ...(districtId === 'xinyi'
      ? {}
      : {
          minNoStopAnswers: 0,
        }),
  }
}

const defaultRunners: SmokeParkingAnswerServicesRunners = {
  runSmokeParkingAnswerService: runParkingAnswerService,
}

export const resolveSmokeParkingAnswerServicesSummaryPath = (
  options: Pick<SmokeParkingAnswerServicesOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

export const runSmokeParkingAnswerServices = async (
  options: SmokeParkingAnswerServicesOptions = {},
  runners: SmokeParkingAnswerServicesRunners = defaultRunners,
): Promise<SmokeParkingAnswerServicesResult> => {
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
    await resolveSmokeParkingAnswerServicesRequiredReviewedDistricts(options),
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

  const packResults: SmokeParkingAnswerServicePackResult[] = []
  for (const datasetDir of datasetDirs) {
    const districtId = path.basename(path.normalize(datasetDir))
    const casesPath = reviewedCasesPathForDistrict(answerCasesDir, districtId)
    const reviewedCasesRequired = requiredDistricts.has(districtId)
    const reviewedCasesFound = await fileExists(casesPath)
    const shouldUseReviewedCases =
      options.useReviewedCases === true || reviewedCasesRequired
    const reviewedCasesUsed = shouldUseReviewedCases && reviewedCasesFound
    const packErrors: string[] = []
    let summary: SmokeParkingAnswerServiceSummary | null = null

    if (!reviewedCasesFound && reviewedCasesRequired) {
      packErrors.push(
        `Reviewed API answer cases are required for generated district ${districtId}: ${casesPath}`,
      )
    }

    if (packErrors.length === 0) {
      try {
        summary = await runners.runSmokeParkingAnswerService(
          applyFixtureThresholds(
            {
              district: districtId,
              datasetDir,
              casesPath: reviewedCasesUsed ? casesPath : undefined,
              timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
              maxCases: options.maxCases,
              hhmm: options.hhmm ?? DEFAULT_HHMM,
              searchRadiusMeters:
                options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS,
              skipHealthCheck: options.skipHealthCheck,
              allowMismatchedCaseHash,
            },
            districtId,
            options.fixtureThresholds,
          ),
        )
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
      reviewedCasesUsed,
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

const formatCasesStatus = (result: SmokeParkingAnswerServicePackResult) => {
  if (result.reviewedCasesUsed) {
    return `used ${result.casesPath}`
  }
  if (result.reviewedCasesRequired) {
    return `missing required ${result.casesPath}`
  }
  if (result.reviewedCasesFound) {
    return `available but not requested ${result.casesPath}`
  }
  return 'not requested'
}

export const renderSmokeParkingAnswerServicesResult = (
  result: SmokeParkingAnswerServicesResult,
) => {
  const lines = [
    `Parking answer API pack smoke: ${result.hasErrors ? 'FAIL' : 'PASS'}`,
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
        `  API cases: ${pack.summary.passed}/${pack.summary.results.length}; probes ${pack.summary.probes.length > 0 ? pack.summary.probes.join(', ') : 'skipped'}; hash ${pack.summary.datasetHash ?? '-'}`,
      )
    }
    pack.errors.forEach((error) => {
      lines.push(`  ERROR: ${error}`)
    })
  })

  return lines.join('\n')
}

const run = async () => {
  const options = parseSmokeParkingAnswerServicesArgs(process.argv)
  const result = await runSmokeParkingAnswerServices(options)
  const output = renderSmokeParkingAnswerServicesResult(result)
  console.log(output)
  const summaryPath = resolveSmokeParkingAnswerServicesSummaryPath(options)
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
