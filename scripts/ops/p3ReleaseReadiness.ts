import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import {
  runDistrictReadinessMatrix,
  type DistrictReadinessMatrixOptions,
  type DistrictReadinessMatrixResult,
} from './districtReadinessMatrix'
import {
  runSmokeGeneratedPacks,
  type SmokeGeneratedPacksOptions,
  type SmokeGeneratedPacksResult,
} from './smokeGeneratedPacks'
import {
  runSmokeParkingAnswerService,
  type SmokeParkingAnswerServiceOptions,
  type SmokeParkingAnswerServiceSummary,
} from './smokeParkingAnswerService'
import {
  packageRelease,
  type PackageReleaseResult,
} from './packageRelease'
import {
  validateReleasePackage,
  type ValidateReleasePackageArgs,
  type ValidateReleasePackageResult,
} from './validateReleasePackage'

export interface P3ReleaseReadinessOptions {
  root?: string | null
  registryPath?: string | null
  configGlob?: string | null
  answerCasesGlob?: string | null
  districtIds?: string[] | null
  outDir?: string | null
  includeGlob?: string | null
  outPath?: string | null
  jsonOutPath?: string | null
  summaryPath?: string | null
  json?: boolean | null
}

export interface P3ReleaseReadinessInputs {
  root: string
  registryPath: string
  configGlob: string
  answerCasesGlob: string
  districtIds: string[]
  outDir: string
  includeGlob: string
}

export interface P3ReleaseReadinessCheck<T> {
  name: string
  pass: boolean
  summary: T | null
  error: string | null
}

export interface P3ReleaseReadinessResult {
  pass: boolean
  inputs: P3ReleaseReadinessInputs
  districtMatrix: P3ReleaseReadinessCheck<DistrictReadinessMatrixResult>
  generatedPacks: P3ReleaseReadinessCheck<SmokeGeneratedPacksResult>
  parkingAnswerApis: P3ReleaseReadinessCheck<SmokeParkingAnswerServiceSummary[]>
  releasePackage: P3ReleaseReadinessCheck<PackageReleaseResult>
  packageValidation: P3ReleaseReadinessCheck<ValidateReleasePackageResult>
  blockers: string[]
}

export interface P3ReleaseReadinessRunners {
  runDistrictReadinessMatrix: (
    options: DistrictReadinessMatrixOptions,
  ) => Promise<DistrictReadinessMatrixResult>
  runSmokeGeneratedPacks: (
    options: SmokeGeneratedPacksOptions,
  ) => Promise<SmokeGeneratedPacksResult>
  runSmokeParkingAnswerService: (
    options: SmokeParkingAnswerServiceOptions,
  ) => Promise<SmokeParkingAnswerServiceSummary>
  packageRelease: typeof packageRelease
  validateReleasePackage: (
    args: ValidateReleasePackageArgs,
  ) => Promise<ValidateReleasePackageResult>
}

const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_ANSWER_CASES_GLOB = 'configs/prod/*.answer-cases.json'
const DEFAULT_OUT_DIR = 'dist/releases'

const defaultRunners: P3ReleaseReadinessRunners = {
  runDistrictReadinessMatrix,
  runSmokeGeneratedPacks,
  runSmokeParkingAnswerService,
  packageRelease,
  validateReleasePackage,
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

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseDistrictIds = (value: string | null) =>
  value === null
    ? []
    : value
        .split(',')
        .map((districtId) => districtId.trim())
        .filter(Boolean)

export const parseP3ReleaseReadinessArgs = (
  argv: string[],
): P3ReleaseReadinessOptions => ({
  root: getArgValue(argv, '--root', '--public-root', '--publicRoot'),
  registryPath: getArgValue(argv, '--registry', '--registry-path', '--registryPath'),
  configGlob: getArgValue(argv, '--configs', '--config-glob', '--configGlob'),
  answerCasesGlob: getArgValue(
    argv,
    '--answer-cases',
    '--answer-cases-glob',
    '--answerCasesGlob',
  ),
  districtIds: parseDistrictIds(
    getArgValue(argv, '--district', '--districts'),
  ),
  outDir: getArgValue(argv, '--out-dir', '--outDir'),
  includeGlob: getArgValue(argv, '--include'),
  outPath: getArgValue(argv, '--out'),
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
  summaryPath: getArgValue(argv, '--summary', '--summary-path', '--summaryPath'),
  json: hasFlag(argv, '--json'),
})

export const discoverReviewedDistrictIds = async (
  answerCasesGlob = DEFAULT_ANSWER_CASES_GLOB,
) => {
  const files = await fg(answerCasesGlob, {
    onlyFiles: true,
    dot: false,
    absolute: false,
  })
  return files
    .map((file) => path.basename(file, '.answer-cases.json'))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

export const resolveP3ReleaseReadinessInputs = async (
  options: P3ReleaseReadinessOptions = {},
): Promise<P3ReleaseReadinessInputs> => {
  const root = options.root?.trim() || DEFAULT_ROOT
  const registryPath =
    options.registryPath?.trim() || path.join(root, 'registry.json')
  const answerCasesGlob =
    options.answerCasesGlob?.trim() || DEFAULT_ANSWER_CASES_GLOB
  const districtIds =
    options.districtIds && options.districtIds.length > 0
      ? options.districtIds
      : await discoverReviewedDistrictIds(answerCasesGlob)
  const outDir = options.outDir?.trim() || DEFAULT_OUT_DIR
  const includeGlob =
    options.includeGlob?.trim() ||
    (districtIds.length === 1
      ? path.join(root, districtIds[0], '**').replace(/\\/g, '/')
      : path.join(root, '**').replace(/\\/g, '/'))

  return {
    root,
    registryPath,
    configGlob: options.configGlob?.trim() || DEFAULT_CONFIG_GLOB,
    answerCasesGlob,
    districtIds,
    outDir,
    includeGlob,
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const runCheck = async <T>(
  name: string,
  check: () => Promise<T>,
  isPass: (summary: T) => boolean,
): Promise<P3ReleaseReadinessCheck<T>> => {
  try {
    const summary = await check()
    return {
      name,
      pass: isPass(summary),
      summary,
      error: null,
    }
  } catch (error) {
    return {
      name,
      pass: false,
      summary: null,
      error: errorMessage(error),
    }
  }
}

const checkBlocker = <T>(check: P3ReleaseReadinessCheck<T>) => {
  if (check.pass) {
    return null
  }
  if (check.error) {
    return `${check.name}: ${check.error.split('\n')[0]}`
  }
  return `${check.name}: failed`
}

export const runP3ReleaseReadiness = async (
  options: P3ReleaseReadinessOptions = {},
  runners: P3ReleaseReadinessRunners = defaultRunners,
): Promise<P3ReleaseReadinessResult> => {
  const inputs = await resolveP3ReleaseReadinessInputs(options)
  const districtMatrix = await runCheck(
    'District readiness matrix',
    () =>
      runners.runDistrictReadinessMatrix({
        configGlob: inputs.configGlob,
        publicRoot: inputs.root,
        registryPath: inputs.registryPath,
      }),
    (summary) => !summary.hasBlockers,
  )
  const generatedPacks = await runCheck(
    'Reviewed generated packs',
    () =>
      runners.runSmokeGeneratedPacks({
        root: inputs.root,
        registryPath: inputs.registryPath,
        useReviewedCases: true,
        requiredReviewedCaseDistricts: inputs.districtIds,
      }),
    (summary) => !summary.hasErrors,
  )
  const parkingAnswerApis = await runCheck(
    'Parking answer APIs',
    async () => {
      const summaries: SmokeParkingAnswerServiceSummary[] = []
      const answerCasesDir = path.dirname(inputs.answerCasesGlob)
      for (const districtId of inputs.districtIds) {
        summaries.push(
          await runners.runSmokeParkingAnswerService({
            district: districtId,
            casesPath: path.join(answerCasesDir, `${districtId}.answer-cases.json`),
          }),
        )
      }
      return summaries
    },
    (summaries) => summaries.every((summary) => summary.failed === 0),
  )
  const releasePackage = await runCheck(
    'Release package',
    () =>
      runners.packageRelease({
        outDir: inputs.outDir,
        includeGlob: inputs.includeGlob,
        registryPath: inputs.registryPath,
        districtIds: inputs.districtIds,
      }),
    () => true,
  )
  const packageValidation = await runCheck(
    'Release package validation',
    async () => {
      if (!releasePackage.summary) {
        throw new Error('release package did not complete')
      }
      return await runners.validateReleasePackage({
        zipPath: releasePackage.summary.zipPath,
        manifestPath: releasePackage.summary.manifestPath,
        districtIds: inputs.districtIds,
      })
    },
    (summary) => summary.pass,
  )
  const checks = [
    districtMatrix,
    generatedPacks,
    parkingAnswerApis,
    releasePackage,
    packageValidation,
  ]
  const blockers = checks.map(checkBlocker).filter((item): item is string => Boolean(item))

  return {
    pass: blockers.length === 0,
    inputs,
    districtMatrix,
    generatedPacks,
    parkingAnswerApis,
    releasePackage,
    packageValidation,
    blockers,
  }
}

const checkStatus = <T>(check: P3ReleaseReadinessCheck<T>) =>
  check.pass ? 'PASS' : 'FAIL'

const formatDistrictMatrix = (summary: DistrictReadinessMatrixResult | null) =>
  summary
    ? `${summary.entries.length} districts, ${summary.entries.filter((entry) => entry.blockers.length > 0).length} blocked`
    : '-'

const formatGeneratedPacks = (summary: SmokeGeneratedPacksResult | null) =>
  summary
    ? `${summary.packResults.filter((pack) => pack.errors.length === 0).length}/${summary.packResults.length} packs`
    : '-'

const formatParkingAnswerApis = (
  summary: SmokeParkingAnswerServiceSummary[] | null,
) =>
  summary
    ? `${summary.filter((district) => district.failed === 0).length}/${summary.length} districts`
    : '-'

const formatPackage = (summary: PackageReleaseResult | null) =>
  summary ? `${summary.fileCount} files, ${summary.totalBytes} bytes` : '-'

const formatValidation = (summary: ValidateReleasePackageResult | null) =>
  summary
    ? `${summary.fileCount} files, ${summary.errors.length} errors`
    : '-'

export const renderP3ReleaseReadiness = (result: P3ReleaseReadinessResult) =>
  [
    `# P3 Reviewed Release Readiness: ${result.pass ? 'PASS' : 'BLOCKED'}`,
    '',
    '## Inputs',
    '',
    `- Root: ${result.inputs.root}`,
    `- Registry: ${result.inputs.registryPath}`,
    `- Configs: ${result.inputs.configGlob}`,
    `- Answer cases: ${result.inputs.answerCasesGlob}`,
    `- Districts: ${result.inputs.districtIds.join(', ') || 'none'}`,
    `- Release out dir: ${result.inputs.outDir}`,
    '',
    '## Checks',
    '',
    '| Status | Check | Summary | Error |',
    '| --- | --- | --- | --- |',
    `| ${checkStatus(result.districtMatrix)} | District readiness matrix | ${formatDistrictMatrix(result.districtMatrix.summary)} | ${result.districtMatrix.error ?? ''} |`,
    `| ${checkStatus(result.generatedPacks)} | Reviewed generated packs | ${formatGeneratedPacks(result.generatedPacks.summary)} | ${result.generatedPacks.error ?? ''} |`,
    `| ${checkStatus(result.parkingAnswerApis)} | Parking answer APIs | ${formatParkingAnswerApis(result.parkingAnswerApis.summary)} | ${result.parkingAnswerApis.error ?? ''} |`,
    `| ${checkStatus(result.releasePackage)} | Release package | ${formatPackage(result.releasePackage.summary)} | ${result.releasePackage.error ?? ''} |`,
    `| ${checkStatus(result.packageValidation)} | Release package validation | ${formatValidation(result.packageValidation.summary)} | ${result.packageValidation.error ?? ''} |`,
    '',
    '## Blockers',
    '',
    ...(result.blockers.length > 0
      ? result.blockers.map((blocker) => `- ${blocker}`)
      : ['- none']),
  ].join('\n')

export const writeP3ReleaseReadinessOutputs = async (
  result: P3ReleaseReadinessResult,
  options: Pick<P3ReleaseReadinessOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${renderP3ReleaseReadiness(result)}\n`, 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

export const resolveP3ReleaseReadinessSummaryPath = (
  options: Pick<P3ReleaseReadinessOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseP3ReleaseReadinessArgs(process.argv)
  const result = await runP3ReleaseReadiness(options)
  await writeP3ReleaseReadinessOutputs(result, options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderP3ReleaseReadiness(result)
  console.log(output)
  const summaryPath = resolveP3ReleaseReadinessSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderP3ReleaseReadiness(result)}\n\n`)
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
