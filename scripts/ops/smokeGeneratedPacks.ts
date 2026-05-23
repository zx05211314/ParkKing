import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import {
  runSmokeExactParkingAnswers as runExactParkingAnswers,
  type SmokeExactParkingAnswersOptions,
  type SmokeExactParkingAnswersSummary,
} from './smokeExactParkingAnswers'
import {
  runSmokeParkingAnswers as runParkingAnswers,
  type SmokeParkingAnswersOptions,
  type SmokeParkingAnswersSummary,
} from './smokeParkingAnswers'

export interface SmokeGeneratedPacksOptions {
  root?: string
  registryPath?: string | null
  reportPath?: string | null
  answerCasesDir?: string
  summaryPath?: string
  fixtureThresholds?: boolean
  useReviewedCases?: boolean
  requiredReviewedCaseDistricts?: string[]
  requireGenerated?: boolean
  scanDirectories?: boolean
}

export interface SmokeGeneratedPacksRunners {
  runSmokeParkingAnswers: (
    options: SmokeParkingAnswersOptions,
  ) => Promise<SmokeParkingAnswersSummary>
  runSmokeExactParkingAnswers: (
    options: SmokeExactParkingAnswersOptions,
  ) => Promise<SmokeExactParkingAnswersSummary>
}

export interface SmokeGeneratedPackPlan {
  districtId: string
  datasetDir: string
  parkingOptions: SmokeParkingAnswersOptions
  exactOptions: SmokeExactParkingAnswersOptions
  reviewedCasesPath: string
  reviewedCasesRequired: boolean
  reviewedCasesFound: boolean
  reviewedCasesUsed: boolean
  skipExact: boolean
  errors: string[]
}

export interface SmokeGeneratedPackResult extends SmokeGeneratedPackPlan {
  parkingSummary: SmokeParkingAnswersSummary | null
  exactSummary: SmokeExactParkingAnswersSummary | null
}

export interface SmokeGeneratedPacksResult {
  root: string
  registryPath: string | null
  reportPath: string | null
  packResults: SmokeGeneratedPackResult[]
  errors: string[]
  hasErrors: boolean
}

const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'

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

export const parseSmokeGeneratedPacksArgs = (
  argv: string[],
): SmokeGeneratedPacksOptions => ({
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
})

const fileExists = async (target: string) => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const assertSafeDistrictId = (districtId: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(districtId)) {
    throw new Error(`Invalid district id in registry: ${districtId}`)
  }
}

const loadDistrictIdsFile = async (inputPath: string, label: string) => {
  const raw = await fs.readFile(inputPath, 'utf-8')
  const parsed = JSON.parse(raw) as { districts?: Array<{ districtId?: unknown }> }
  if (!Array.isArray(parsed.districts)) {
    throw new Error(`${label} is missing districts array: ${inputPath}`)
  }
  return parsed.districts.map((entry, index) => {
    if (typeof entry.districtId !== 'string' || entry.districtId.trim() === '') {
      throw new Error(`${label} district at index ${index} is missing districtId`)
    }
    const districtId = entry.districtId.trim()
    assertSafeDistrictId(districtId)
    return districtId
  })
}

export const discoverGeneratedPackDirs = async (
  root = DEFAULT_ROOT,
  sourcePath?: string | null,
  sourceLabel = 'District list',
) => {
  if (sourcePath) {
    const districtIds = await loadDistrictIdsFile(sourcePath, sourceLabel)
    return districtIds
      .map((districtId) => path.join(root, districtId))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
  }
  if (!(await fileExists(root))) {
    return []
  }
  const matches = await fg('*/dataset_meta.json', {
    cwd: root,
    onlyFiles: true,
    dot: false,
    absolute: false,
  })
  return matches
    .map((match) => path.join(root, path.dirname(match)))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
}

export const resolveGeneratedPackSource = async (options: {
  root: string
  registryPath?: string | null
  reportPath?: string | null
  scanDirectories?: boolean
}) => {
  if (options.registryPath) {
    return { registryPath: options.registryPath, reportPath: options.reportPath ?? null }
  }
  if (options.reportPath) {
    return { registryPath: null, reportPath: options.reportPath }
  }
  if (options.scanDirectories) {
    return { registryPath: null, reportPath: null }
  }

  const defaultRegistryPath = path.join(options.root, 'registry.json')
  return {
    registryPath: (await fileExists(defaultRegistryPath)) ? defaultRegistryPath : null,
    reportPath: null,
  }
}

const reviewedCasesPathForDistrict = (answerCasesDir: string, districtId: string) =>
  path.join(answerCasesDir, `${districtId}.answer-cases.json`)

export const buildSmokeGeneratedPackPlan = async (
  datasetDir: string,
  options: SmokeGeneratedPacksOptions = {},
): Promise<SmokeGeneratedPackPlan> => {
  const districtId = path.basename(path.normalize(datasetDir))
  const answerCasesDir = options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR
  const reviewedCasesPath = reviewedCasesPathForDistrict(answerCasesDir, districtId)
  const requiredDistricts = new Set(options.requiredReviewedCaseDistricts ?? [])
  const reviewedCasesRequired = requiredDistricts.has(districtId)
  const reviewedCasesFound = await fileExists(reviewedCasesPath)
  const shouldUseReviewedCases =
    options.useReviewedCases === true || reviewedCasesRequired
  const reviewedCasesUsed = shouldUseReviewedCases && reviewedCasesFound
  const errors: string[] = []

  const parkingOptions: SmokeParkingAnswersOptions = { datasetDir }
  const exactOptions: SmokeExactParkingAnswersOptions = { datasetDir }

  if (options.fixtureThresholds) {
    exactOptions.minMarkedSpaceParkAnswers = 0
    if (districtId !== 'xinyi') {
      parkingOptions.minNoStopAnswers = 0
      exactOptions.minNoStopAnswers = 0
    }
  }

  if (reviewedCasesUsed) {
    exactOptions.casesPath = reviewedCasesPath
  } else if (reviewedCasesRequired) {
    errors.push(
      `Reviewed exact answer cases are required for generated district ${districtId}: ${reviewedCasesPath}`,
    )
  }

  return {
    districtId,
    datasetDir,
    parkingOptions,
    exactOptions,
    reviewedCasesPath,
    reviewedCasesRequired,
    reviewedCasesFound,
    reviewedCasesUsed,
    skipExact: reviewedCasesRequired && !reviewedCasesFound,
    errors,
  }
}

const defaultRunners: SmokeGeneratedPacksRunners = {
  runSmokeParkingAnswers: runParkingAnswers,
  runSmokeExactParkingAnswers: runExactParkingAnswers,
}

export const resolveSmokeGeneratedPacksSummaryPath = (
  options: Pick<SmokeGeneratedPacksOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

export const runSmokeGeneratedPacks = async (
  options: SmokeGeneratedPacksOptions = {},
  runners: SmokeGeneratedPacksRunners = defaultRunners,
): Promise<SmokeGeneratedPacksResult> => {
  const root = options.root ?? DEFAULT_ROOT
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

  const packResults: SmokeGeneratedPackResult[] = []
  for (const datasetDir of datasetDirs) {
    const plan = await buildSmokeGeneratedPackPlan(datasetDir, options)
    let parkingSummary: SmokeParkingAnswersSummary | null = null
    let exactSummary: SmokeExactParkingAnswersSummary | null = null
    const packErrors = [...plan.errors]

    try {
      parkingSummary = await runners.runSmokeParkingAnswers(plan.parkingOptions)
    } catch (error) {
      packErrors.push(error instanceof Error ? error.message : String(error))
    }

    if (!plan.skipExact) {
      try {
        exactSummary = await runners.runSmokeExactParkingAnswers(plan.exactOptions)
      } catch (error) {
        packErrors.push(error instanceof Error ? error.message : String(error))
      }
    }

    packResults.push({
      ...plan,
      errors: packErrors,
      parkingSummary,
      exactSummary,
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

const reviewedCasesStatus = (result: SmokeGeneratedPackResult) => {
  if (result.reviewedCasesUsed) {
    return `used ${result.reviewedCasesPath}`
  }
  if (result.reviewedCasesRequired) {
    return `missing required ${result.reviewedCasesPath}`
  }
  if (result.reviewedCasesFound) {
    return `available but not requested ${result.reviewedCasesPath}`
  }
  return 'not requested'
}

const formatParkingSummary = (summary: SmokeParkingAnswersSummary) =>
  `Parking: hash ${summary.datasetHash}, segments ${summary.segmentCount}, night PARK ${summary.nightParkAnswers}, NO_STOP ${summary.nightNoStopAnswers}, reason coverage ${summary.nightReasonCoveragePct.toFixed(1)}%`

const formatExactSummary = (summary: SmokeExactParkingAnswersSummary) => {
  const caseResults = summary.caseResults ?? []
  const cases =
    caseResults.length > 0
      ? `, cases ${caseResults.filter((result) => result.pass).length}/${caseResults.length}`
      : ''
  return `Exact: hash ${summary.datasetHash}, PARK ${summary.counts.parkAnswers}, NO_STOP ${summary.counts.noStopAnswers}, MARKED_SPACE_PARK ${summary.counts.markedSpaceParkAnswers}${cases}`
}

export const renderSmokeGeneratedPacksResult = (
  result: SmokeGeneratedPacksResult,
) => {
  const lines = [
    `Generated pack smoke: ${result.hasErrors ? 'FAIL' : 'PASS'}`,
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
    lines.push(`  Reviewed cases: ${reviewedCasesStatus(pack)}`)
    if (pack.parkingSummary) {
      lines.push(`  ${formatParkingSummary(pack.parkingSummary)}`)
    }
    if (pack.exactSummary) {
      lines.push(`  ${formatExactSummary(pack.exactSummary)}`)
    }
    pack.errors.forEach((error) => {
      lines.push(`  ERROR: ${error}`)
    })
  })

  return lines.join('\n')
}

const run = async () => {
  const options = parseSmokeGeneratedPacksArgs(process.argv)
  const result = await runSmokeGeneratedPacks(options)
  const output = renderSmokeGeneratedPacksResult(result)
  console.log(output)
  const summaryPath = resolveSmokeGeneratedPacksSummaryPath(options)
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
