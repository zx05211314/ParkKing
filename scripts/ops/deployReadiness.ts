import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  installReleasePackage as installReleasePackageRunner,
  renderInstallReleasePackageResult,
  type InstallReleasePackageArgs,
  type InstallReleasePackageResult,
} from './installReleasePackage'
import {
  renderSmokeAppServer,
  runSmokeAppServer as runSmokeAppServerRunner,
  type SmokeAppServerOptions,
  type SmokeAppServerResult,
} from './smokeAppServer'
import {
  renderSmokeGeneratedPacksResult,
  runSmokeGeneratedPacks as runSmokeGeneratedPacksRunner,
  type SmokeGeneratedPacksOptions,
  type SmokeGeneratedPacksResult,
} from './smokeGeneratedPacks'
import {
  renderSmokeParkingAnswerServicesResult,
  runSmokeParkingAnswerServices as runSmokeParkingAnswerServicesRunner,
  type SmokeParkingAnswerServicesOptions,
  type SmokeParkingAnswerServicesResult,
} from './smokeParkingAnswerServices'
import {
  resolveReleasePackagePaths as resolveReleasePackagePathsRunner,
  type ReleasePackagePaths,
  type ValidateReleasePackageArgs,
} from './validateReleasePackage'

const DEFAULT_RELEASE_OUT_DIR = 'dist/releases'
const DEFAULT_INSTALL_ROOT = '.tmp/deploy-readiness/public/data/generated'
const DEFAULT_STATIC_DIR = 'dist'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'
const DEFAULT_TIMEOUT_MS = 25_000

export interface DeployReadinessOptions {
  outDir?: string | null
  zipPath?: string | null
  manifestPath?: string | null
  installRoot?: string | null
  tmpDir?: string | null
  staticDir?: string | null
  answerCasesDir?: string | null
  timeoutMs?: number | null
  maxCases?: number | null
  skipStaticParity?: boolean | null
  skipGeneratedSmoke?: boolean | null
  skipApiSmoke?: boolean | null
  skipAppSmoke?: boolean | null
  summaryPath?: string | null
}

export interface DeployReadinessInputs {
  outDir: string
  installRoot: string
  tmpDir?: string
  staticDir: string
  answerCasesDir: string
  timeoutMs: number
  maxCases?: number
  skipStaticParity: boolean
  skipGeneratedSmoke: boolean
  skipApiSmoke: boolean
  skipAppSmoke: boolean
  summaryPath?: string
}

export interface StaticDataParityResult {
  pass: boolean
  installedRoot: string
  staticGeneratedRoot: string
  installedDistrictIds: string[]
  staticDistrictIds: string[]
  checkedDistricts: string[]
  errors: string[]
}

export interface DeployReadinessCheck<T> {
  pass: boolean
  skipped: boolean
  summary: string
  result: T | null
  error: string | null
}

export interface DeployReadinessResult {
  pass: boolean
  release: ReleasePackagePaths
  inputs: DeployReadinessInputs
  install: DeployReadinessCheck<InstallReleasePackageResult>
  staticParity: DeployReadinessCheck<StaticDataParityResult>
  generatedPacks: DeployReadinessCheck<SmokeGeneratedPacksResult>
  parkingAnswerApis: DeployReadinessCheck<SmokeParkingAnswerServicesResult>
  appServer: DeployReadinessCheck<SmokeAppServerResult>
}

export interface DeployReadinessRunners {
  resolveReleasePackagePaths: (
    args: ValidateReleasePackageArgs,
  ) => Promise<ReleasePackagePaths>
  installReleasePackage: (
    args: InstallReleasePackageArgs,
  ) => Promise<InstallReleasePackageResult>
  runSmokeGeneratedPacks: (
    options: SmokeGeneratedPacksOptions,
  ) => Promise<SmokeGeneratedPacksResult>
  runSmokeParkingAnswerServices: (
    options: SmokeParkingAnswerServicesOptions,
  ) => Promise<SmokeParkingAnswerServicesResult>
  runSmokeAppServer: (
    options: SmokeAppServerOptions,
  ) => Promise<SmokeAppServerResult>
}

const defaultRunners: DeployReadinessRunners = {
  resolveReleasePackagePaths: resolveReleasePackagePathsRunner,
  installReleasePackage: installReleasePackageRunner,
  runSmokeGeneratedPacks: runSmokeGeneratedPacksRunner,
  runSmokeParkingAnswerServices: runSmokeParkingAnswerServicesRunner,
  runSmokeAppServer: runSmokeAppServerRunner,
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

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseDeployReadinessArgs = (
  argv: string[],
): DeployReadinessOptions => ({
  outDir:
    getArgValue(argv, '--out-dir', '--outDir', '--release-dir', '--releaseDir') ??
    DEFAULT_RELEASE_OUT_DIR,
  zipPath: getArgValue(argv, '--zip', '--zip-path', '--zipPath'),
  manifestPath: getArgValue(argv, '--manifest', '--manifest-path', '--manifestPath'),
  installRoot:
    getArgValue(argv, '--install-root', '--installRoot') ?? DEFAULT_INSTALL_ROOT,
  tmpDir: getArgValue(argv, '--tmp-dir', '--tmpDir') ?? undefined,
  staticDir: getArgValue(argv, '--static-dir', '--staticDir') ?? DEFAULT_STATIC_DIR,
  answerCasesDir:
    getArgValue(argv, '--answer-cases-dir', '--answerCasesDir') ??
    DEFAULT_ANSWER_CASES_DIR,
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? DEFAULT_TIMEOUT_MS,
  maxCases: parsePositiveInteger(getArgValue(argv, '--max-cases', '--maxCases'), 'max-cases'),
  skipStaticParity: hasFlag(argv, '--skip-static-parity', '--skipStaticParity'),
  skipGeneratedSmoke: hasFlag(
    argv,
    '--skip-generated-smoke',
    '--skipGeneratedSmoke',
  ),
  skipApiSmoke: hasFlag(argv, '--skip-api-smoke', '--skipApiSmoke'),
  skipAppSmoke: hasFlag(argv, '--skip-app-smoke', '--skipAppSmoke'),
  summaryPath: getArgValue(argv, '--summary', '--summary-path', '--summaryPath'),
})

export const resolveDeployReadinessInputs = (
  options: DeployReadinessOptions = {},
): DeployReadinessInputs => ({
  outDir: options.outDir ?? DEFAULT_RELEASE_OUT_DIR,
  installRoot: path.resolve(options.installRoot ?? DEFAULT_INSTALL_ROOT),
  tmpDir: options.tmpDir ? path.resolve(options.tmpDir) : undefined,
  staticDir: path.resolve(options.staticDir ?? DEFAULT_STATIC_DIR),
  answerCasesDir: options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR,
  timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  maxCases: options.maxCases ?? undefined,
  skipStaticParity: Boolean(options.skipStaticParity),
  skipGeneratedSmoke: Boolean(options.skipGeneratedSmoke),
  skipApiSmoke: Boolean(options.skipApiSmoke),
  skipAppSmoke: Boolean(options.skipAppSmoke),
  summaryPath: options.summaryPath ?? undefined,
})

const readJson = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const sortedUnique = (values: string[]) => [...new Set(values)].sort()

const sameStringSet = (left: string[], right: string[]) => {
  const sortedLeft = sortedUnique(left)
  const sortedRight = sortedUnique(right)
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  )
}

const readRegistryDistrictIds = async (root: string) => {
  const registry = await readJson<{ districts?: Array<{ districtId?: unknown }> }>(
    path.join(root, 'registry.json'),
  )
  return sortedUnique(
    (registry.districts ?? [])
      .map((district) => district.districtId)
      .filter((districtId): districtId is string => typeof districtId === 'string'),
  )
}

const readLatestDatasetHash = async (root: string, districtId: string) => {
  const latest = await readJson<{ datasetHash?: unknown }>(
    path.join(root, districtId, 'LATEST.json'),
  )
  return typeof latest.datasetHash === 'string' ? latest.datasetHash : null
}

export const checkStaticDataParity = async (params: {
  installedRoot: string
  staticDir: string
}): Promise<StaticDataParityResult> => {
  const installedRoot = path.resolve(params.installedRoot)
  const staticGeneratedRoot = path.join(path.resolve(params.staticDir), 'data', 'generated')
  const errors: string[] = []
  let installedDistrictIds: string[] = []
  let staticDistrictIds: string[] = []

  try {
    installedDistrictIds = await readRegistryDistrictIds(installedRoot)
  } catch (error) {
    errors.push(
      `Installed registry unreadable: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    staticDistrictIds = await readRegistryDistrictIds(staticGeneratedRoot)
  } catch (error) {
    errors.push(
      `Built static registry unreadable: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (
    installedDistrictIds.length > 0 &&
    staticDistrictIds.length > 0 &&
    !sameStringSet(installedDistrictIds, staticDistrictIds)
  ) {
    errors.push(
      `Built static district set ${staticDistrictIds.join(', ')} does not match installed release ${installedDistrictIds.join(', ')}`,
    )
  }

  const checkedDistricts = installedDistrictIds.filter((districtId) =>
    staticDistrictIds.includes(districtId),
  )
  for (const districtId of checkedDistricts) {
    const [installedHash, staticHash] = await Promise.all([
      readLatestDatasetHash(installedRoot, districtId).catch((error) => {
        errors.push(
          `Installed ${districtId}/LATEST.json unreadable: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      }),
      readLatestDatasetHash(staticGeneratedRoot, districtId).catch((error) => {
        errors.push(
          `Built static ${districtId}/LATEST.json unreadable: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      }),
    ])
    if (installedHash && staticHash && installedHash !== staticHash) {
      errors.push(
        `Built static ${districtId} datasetHash ${staticHash} does not match installed release ${installedHash}`,
      )
    }
  }

  return {
    pass: errors.length === 0,
    installedRoot,
    staticGeneratedRoot,
    installedDistrictIds,
    staticDistrictIds,
    checkedDistricts,
    errors,
  }
}

const failedCheck = <T>(summary: string, error: unknown): DeployReadinessCheck<T> => ({
  pass: false,
  skipped: false,
  summary,
  result: null,
  error: error instanceof Error ? error.message : String(error),
})

const skippedCheck = <T>(summary: string): DeployReadinessCheck<T> => ({
  pass: true,
  skipped: true,
  summary,
  result: null,
  error: null,
})

const runChecked = async <T>(
  summary: string,
  action: () => Promise<T>,
  isPass: (result: T) => boolean,
  errorSummary: (result: T) => string,
): Promise<DeployReadinessCheck<T>> => {
  try {
    const result = await action()
    return {
      pass: isPass(result),
      skipped: false,
      summary: isPass(result) ? summary : errorSummary(result),
      result,
      error: isPass(result) ? null : errorSummary(result),
    }
  } catch (error) {
    return failedCheck(summary, error)
  }
}

const withTemporaryEnv = async <T>(
  updates: Record<string, string>,
  action: () => Promise<T>,
) => {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key])
    process.env[key] = value
  }
  try {
    return await action()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

export const runDeployReadiness = async (
  options: DeployReadinessOptions = {},
  runners: DeployReadinessRunners = defaultRunners,
): Promise<DeployReadinessResult> => {
  const inputs = resolveDeployReadinessInputs(options)
  const release = await runners.resolveReleasePackagePaths({
    outDir: inputs.outDir,
    zipPath: options.zipPath ?? undefined,
    manifestPath: options.manifestPath ?? undefined,
    districtIds: [],
  }).catch((error) => {
    const details = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not resolve a release package from ${inputs.outDir}. Run npm run ops:p3-release-readiness after npm run build, or pass --zip and --manifest. ${details}`,
    )
  })
  const registryPath = path.join(inputs.installRoot, 'registry.json')

  const install = await runChecked(
    'release package installed',
    () =>
      runners.installReleasePackage({
        zipPath: release.zipPath,
        manifestPath: release.manifestPath,
        outRoot: inputs.installRoot,
        tmpDir: inputs.tmpDir,
        requireManifest: true,
        clean: true,
      }),
    (result) => result.registryDistrictIds.length > 0,
    (result) =>
      `installed release has no registry districts (${result.outRoot})`,
  )

  const staticParity = inputs.skipStaticParity
    ? skippedCheck<StaticDataParityResult>('static data parity skipped')
    : install.pass && install.result
      ? await runChecked(
          'built static data matches installed release',
          () =>
            checkStaticDataParity({
              installedRoot: inputs.installRoot,
              staticDir: inputs.staticDir,
            }),
          (result) => result.pass,
          (result) => result.errors.join('; ') || 'static data parity failed',
        )
      : failedCheck<StaticDataParityResult>(
          'built static data matches installed release',
          install.error ?? 'release install failed',
        )

  const generatedPacks = inputs.skipGeneratedSmoke
    ? skippedCheck<SmokeGeneratedPacksResult>('generated pack smoke skipped')
    : install.pass && install.result
      ? await runChecked(
          'reviewed generated packs pass from installed release',
          () =>
            runners.runSmokeGeneratedPacks({
              root: inputs.installRoot,
              registryPath,
              answerCasesDir: inputs.answerCasesDir,
              reviewed: true,
            }),
          (result) => !result.hasErrors,
          (result) =>
            [
              ...result.errors,
              ...result.packResults.flatMap((pack) => pack.errors),
            ].join('; ') || 'generated pack smoke failed',
        )
      : failedCheck<SmokeGeneratedPacksResult>(
          'reviewed generated packs pass from installed release',
          install.error ?? 'release install failed',
        )

  const parkingAnswerApis = inputs.skipApiSmoke
    ? skippedCheck<SmokeParkingAnswerServicesResult>('parking-answer API smoke skipped')
    : install.pass && install.result
      ? await runChecked(
          'reviewed parking-answer APIs pass from installed release',
          () =>
            runners.runSmokeParkingAnswerServices({
              root: inputs.installRoot,
              registryPath,
              answerCasesDir: inputs.answerCasesDir,
              reviewed: true,
              timeoutMs: inputs.timeoutMs,
              maxCases: inputs.maxCases,
            }),
          (result) => !result.hasErrors,
          (result) =>
            [
              ...result.errors,
              ...result.packResults.flatMap((pack) => pack.errors),
            ].join('; ') || 'parking-answer API smoke failed',
        )
      : failedCheck<SmokeParkingAnswerServicesResult>(
          'reviewed parking-answer APIs pass from installed release',
          install.error ?? 'release install failed',
        )

  const appServer = inputs.skipAppSmoke
    ? skippedCheck<SmokeAppServerResult>('app server smoke skipped')
    : install.pass && install.result
      ? await runChecked(
          'same-origin app server answers from installed release',
          () =>
            withTemporaryEnv(
              {
                PARKKING_APP_STATIC_DIR: inputs.staticDir,
                PARKKING_PARKING_ANSWER_DATASET_ROOT: inputs.installRoot,
              },
              () => runners.runSmokeAppServer({ timeoutMs: inputs.timeoutMs }),
            ),
          (result) => result.pass,
          (result) =>
            result.probes
              .filter((probe) => !probe.pass)
              .map((probe) => `${probe.path}: ${probe.error ?? probe.summary}`)
              .join('; ') || 'app server smoke failed',
        )
      : failedCheck<SmokeAppServerResult>(
          'same-origin app server answers from installed release',
          install.error ?? 'release install failed',
        )

  return {
    pass:
      install.pass &&
      staticParity.pass &&
      generatedPacks.pass &&
      parkingAnswerApis.pass &&
      appServer.pass,
    release,
    inputs,
    install,
    staticParity,
    generatedPacks,
    parkingAnswerApis,
    appServer,
  }
}

const checkStatus = <T>(check: DeployReadinessCheck<T>) =>
  check.skipped ? 'SKIP' : check.pass ? 'PASS' : 'FAIL'

const renderStaticParity = (result: StaticDataParityResult) =>
  [
    `Static data parity: ${result.pass ? 'PASS' : 'FAIL'}`,
    `Installed root: ${result.installedRoot}`,
    `Static generated root: ${result.staticGeneratedRoot}`,
    `Installed districts: ${result.installedDistrictIds.join(', ') || '-'}`,
    `Static districts: ${result.staticDistrictIds.join(', ') || '-'}`,
    `Checked districts: ${result.checkedDistricts.join(', ') || '-'}`,
    ...result.errors.map((error) => `ERROR: ${error}`),
  ].join('\n')

const renderCheckDetails = <T>(
  title: string,
  check: DeployReadinessCheck<T>,
  render: (result: T) => string,
) => {
  if (check.skipped) {
    return [`## ${title}`, '', '- skipped'].join('\n')
  }
  if (!check.result) {
    return [`## ${title}`, '', `- ${check.error ?? 'failed'}`].join('\n')
  }
  return [`## ${title}`, '', render(check.result)].join('\n')
}

export const renderDeployReadiness = (result: DeployReadinessResult) =>
  [
    `# Deploy Readiness: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Release',
    '',
    `- Release ID: ${result.release.releaseId}`,
    `- Zip: ${result.release.zipPath}`,
    `- Manifest: ${result.release.manifestPath}`,
    `- Install root: ${result.inputs.installRoot}`,
    `- Static dir: ${result.inputs.staticDir}`,
    '',
    '## Checks',
    '',
    '| Status | Check | Summary | Error |',
    '| --- | --- | --- | --- |',
    `| ${checkStatus(result.install)} | Install release package | ${result.install.summary} | ${result.install.error ?? ''} |`,
    `| ${checkStatus(result.staticParity)} | Static data parity | ${result.staticParity.summary} | ${result.staticParity.error ?? ''} |`,
    `| ${checkStatus(result.generatedPacks)} | Generated pack smoke | ${result.generatedPacks.summary} | ${result.generatedPacks.error ?? ''} |`,
    `| ${checkStatus(result.parkingAnswerApis)} | Parking-answer API smoke | ${result.parkingAnswerApis.summary} | ${result.parkingAnswerApis.error ?? ''} |`,
    `| ${checkStatus(result.appServer)} | App server smoke | ${result.appServer.summary} | ${result.appServer.error ?? ''} |`,
    '',
    renderCheckDetails('Install Release Package', result.install, renderInstallReleasePackageResult),
    '',
    renderCheckDetails('Static Data Parity', result.staticParity, renderStaticParity),
    '',
    renderCheckDetails(
      'Generated Pack Smoke',
      result.generatedPacks,
      renderSmokeGeneratedPacksResult,
    ),
    '',
    renderCheckDetails(
      'Parking Answer API Smoke',
      result.parkingAnswerApis,
      renderSmokeParkingAnswerServicesResult,
    ),
    '',
    renderCheckDetails('App Server Smoke', result.appServer, renderSmokeAppServer),
  ].join('\n')

export const resolveDeployReadinessSummaryPath = (
  options: Pick<DeployReadinessOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseDeployReadinessArgs(process.argv)
  const result = await runDeployReadiness(options)
  const output = renderDeployReadiness(result)
  console.log(output)
  const summaryPath = resolveDeployReadinessSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${output}\n\n`)
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
