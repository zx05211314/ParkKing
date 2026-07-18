import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildP0Readiness } from './p0ReadinessState'
import type { P0ReadinessParams, P0ReadinessResult } from './p0ReadinessTypes'
import {
  buildRefreshPublishReport,
  type RefreshPublishReportResult,
} from './refreshPublishReportState'
import {
  runDistrictReadinessMatrix,
  type DistrictReadinessEntry,
  type DistrictReadinessMatrixOptions,
  type DistrictReadinessMatrixResult,
} from './districtReadinessMatrix'
import {
  runSmokeApiServices,
  type SmokeApiServicesOptions,
  type SmokeApiServicesSummary,
} from './smokeApiServices'
import {
  runSmokeAppServer,
  type SmokeAppServerOptions,
  type SmokeAppServerResult,
} from './smokeAppServer'
import {
  runSmokeParkingAnswerService,
  type SmokeParkingAnswerServiceOptions,
  type SmokeParkingAnswerServiceSummary,
} from './smokeParkingAnswerService'
import {
  runSmokeReviewedUiPacks,
  type SmokeReviewedUiPacksOptions,
  type SmokeReviewedUiPacksResult,
} from './smokeReviewedUiPacks'
import {
  runSmokeUiParkingAnswers,
  type SmokeUiParkingAnswersOptions,
  type SmokeUiParkingAnswersSummary,
} from './smokeUiParkingAnswers'
import {
  runSmokeUiMapView,
  type SmokeUiMapViewOptions,
  type SmokeUiMapViewSummary,
} from './smokeUiMapView'
import {
  runSmokeUiIssueReport,
  type SmokeUiIssueReportOptions,
  type SmokeUiIssueReportSummary,
} from './smokeUiIssueReport'
import {
  runSmokeUiPaidCurbReference,
  type SmokeUiPaidCurbReferenceOptions,
  type SmokeUiPaidCurbReferenceSummary,
} from './smokeUiPaidCurbReference'
import {
  runBundleBudget,
  type BundleBudgetOptions,
  type BundleBudgetResult,
} from './bundleBudget'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'
import { TAG_TRIGGER_ALLOW_WARN_OVERRIDE_REASON } from './releaseDataWorkflowInputs'

export interface P1ReleaseReadinessOptions {
  districtId?: string | null
  root?: string | null
  registryPath?: string | null
  configGlob?: string | null
  timeoutMs?: number | null
  skipUi?: boolean | null
  strictMatrix?: boolean | null
  answerCasesPath?: string | null
  distDir?: string | null
  summaryPath?: string | null
  json?: boolean | null
}

export interface P1ReleaseReadinessInputs {
  districtId: string
  root: string
  registryPath: string
  configGlob: string
  timeoutMs: number
  skipUi: boolean
  strictMatrix: boolean
  answerCasesPath: string
  distDir: string
  allowPublishWarn: boolean
  publishOverrideReason: string
}

export interface P1ReleaseReadinessCheck<T> {
  name: string
  required: boolean
  pass: boolean
  summary: T | null
  error: string | null
}

export interface P1ReleaseReadinessResult {
  pass: boolean
  inputs: P1ReleaseReadinessInputs
  publishReportRefresh: P1ReleaseReadinessCheck<RefreshPublishReportResult>
  p0Readiness: P1ReleaseReadinessCheck<P0ReadinessResult>
  districtMatrix: P1ReleaseReadinessCheck<DistrictReadinessMatrixResult>
  bundleBudget: P1ReleaseReadinessCheck<BundleBudgetResult>
  apiServices: P1ReleaseReadinessCheck<SmokeApiServicesSummary>
  appServer: P1ReleaseReadinessCheck<SmokeAppServerResult>
  parkingAnswerApi: P1ReleaseReadinessCheck<SmokeParkingAnswerServiceSummary>
  reviewedUi: P1ReleaseReadinessCheck<SmokeReviewedUiPacksResult> | null
  mapReviewedUi: P1ReleaseReadinessCheck<SmokeUiParkingAnswersSummary> | null
  mapUi: P1ReleaseReadinessCheck<SmokeUiMapViewSummary> | null
  paidCurbReferenceUi: P1ReleaseReadinessCheck<SmokeUiPaidCurbReferenceSummary> | null
  issueReportUi: P1ReleaseReadinessCheck<SmokeUiIssueReportSummary> | null
  blockers: string[]
  knownDistrictBlockers: Array<Pick<DistrictReadinessEntry, 'districtId' | 'blockers'>>
}

export interface P1ReleaseReadinessRunners {
  refreshPublishReport: (
    options: Parameters<typeof buildRefreshPublishReport>[0],
  ) => Promise<RefreshPublishReportResult>
  buildP0Readiness: (params: P0ReadinessParams) => Promise<P0ReadinessResult>
  runDistrictReadinessMatrix: (
    options: DistrictReadinessMatrixOptions,
  ) => Promise<DistrictReadinessMatrixResult>
  runSmokeApiServices: (
    options: SmokeApiServicesOptions,
  ) => Promise<SmokeApiServicesSummary>
  runSmokeAppServer: (
    options: SmokeAppServerOptions,
  ) => Promise<SmokeAppServerResult>
  runBundleBudget: (options: BundleBudgetOptions) => Promise<BundleBudgetResult>
  runSmokeParkingAnswerService: (
    options: SmokeParkingAnswerServiceOptions,
  ) => Promise<SmokeParkingAnswerServiceSummary>
  runSmokeReviewedUiPacks: (
    options: SmokeReviewedUiPacksOptions,
  ) => Promise<SmokeReviewedUiPacksResult>
  runSmokeUiParkingAnswers: (
    options: SmokeUiParkingAnswersOptions,
  ) => Promise<SmokeUiParkingAnswersSummary>
  runSmokeUiMapView: (
    options: SmokeUiMapViewOptions,
  ) => Promise<SmokeUiMapViewSummary>
  runSmokeUiPaidCurbReference: (
    options: SmokeUiPaidCurbReferenceOptions,
  ) => Promise<SmokeUiPaidCurbReferenceSummary>
  runSmokeUiIssueReport: (
    options: SmokeUiIssueReportOptions,
  ) => Promise<SmokeUiIssueReportSummary>
}

const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_DIST_DIR = 'dist'

const defaultRunners: P1ReleaseReadinessRunners = {
  refreshPublishReport: buildRefreshPublishReport,
  buildP0Readiness,
  runDistrictReadinessMatrix,
  runSmokeApiServices,
  runSmokeAppServer,
  runBundleBudget,
  runSmokeParkingAnswerService,
  runSmokeReviewedUiPacks,
  runSmokeUiParkingAnswers,
  runSmokeUiMapView,
  runSmokeUiPaidCurbReference,
  runSmokeUiIssueReport,
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
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseP1ReleaseReadinessArgs = (
  argv: string[],
): P1ReleaseReadinessOptions => ({
  districtId: getArgValue(argv, '--district', '--district-id', '--districtId'),
  root: getArgValue(argv, '--root', '--public-root', '--publicRoot'),
  registryPath: getArgValue(argv, '--registry', '--registry-path', '--registryPath'),
  configGlob: getArgValue(argv, '--configs', '--config-glob', '--configGlob'),
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? null,
  skipUi: hasFlag(argv, '--skip-ui', '--skipUi'),
  strictMatrix: hasFlag(argv, '--strict-matrix', '--strictMatrix'),
  answerCasesPath: getArgValue(
    argv,
    '--cases',
    '--answer-cases',
    '--answerCases',
    '--answer-cases-path',
  ),
  distDir: getArgValue(argv, '--dist', '--dist-dir', '--distDir'),
  summaryPath: getArgValue(argv, '--summary', '--summary-path', '--summaryPath'),
  json: hasFlag(argv, '--json'),
})

export const resolveP1ReleaseReadinessInputs = (
  options: P1ReleaseReadinessOptions = {},
): P1ReleaseReadinessInputs => {
  const districtId = options.districtId?.trim() || DEFAULT_DISTRICT
  const root = options.root?.trim() || DEFAULT_ROOT
  return {
    districtId,
    root,
    registryPath:
      options.registryPath?.trim() || path.join(root, 'registry.json'),
    configGlob: options.configGlob?.trim() || DEFAULT_CONFIG_GLOB,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    skipUi: Boolean(options.skipUi),
    strictMatrix: Boolean(options.strictMatrix),
    answerCasesPath:
      options.answerCasesPath?.trim() ||
      path.join('configs', 'prod', `${districtId}.answer-cases.json`),
    distDir: options.distDir?.trim() || DEFAULT_DIST_DIR,
    allowPublishWarn: true,
    publishOverrideReason: TAG_TRIGGER_ALLOW_WARN_OVERRIDE_REASON,
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const runCheck = async <T>(
  name: string,
  required: boolean,
  check: () => Promise<T>,
  isPass: (summary: T) => boolean,
): Promise<P1ReleaseReadinessCheck<T>> => {
  try {
    const summary = await check()
    return {
      name,
      required,
      pass: isPass(summary),
      summary,
      error: null,
    }
  } catch (error) {
    return {
      name,
      required,
      pass: false,
      summary: null,
      error: errorMessage(error),
    }
  }
}

const checkBlocker = (check: P1ReleaseReadinessCheck<unknown>) => {
  if (check.pass || !check.required) {
    return null
  }
  if (check.error) {
    return `${check.name}: ${check.error.split('\n')[0]}`
  }
  return `${check.name}: failed`
}

const knownDistrictBlockers = (matrix: DistrictReadinessMatrixResult | null) =>
  matrix
    ? matrix.entries
        .filter((entry) => entry.blockers.length > 0)
        .map((entry) => ({
          districtId: entry.districtId,
          blockers: entry.blockers,
        }))
    : []

const resolveP1PublishReportRefreshPath = (districtId: string) =>
  path.join('.tmp', 'p1-release-readiness', `${districtId}-ingest_all_report.json`)

export const runP1ReleaseReadiness = async (
  options: P1ReleaseReadinessOptions = {},
  runners: P1ReleaseReadinessRunners = defaultRunners,
): Promise<P1ReleaseReadinessResult> => {
  const inputs = resolveP1ReleaseReadinessInputs(options)
  const allowMismatchedCaseHash = resolveReviewedCaseHashMismatchAllowance(undefined)
  const refreshedPublishReportPath = resolveP1PublishReportRefreshPath(inputs.districtId)
  const publishReportRefresh = await runCheck(
    'Publish report refresh',
    true,
    () =>
      runners.refreshPublishReport({
        configPath: path.join('configs', 'prod', `${inputs.districtId}.json`),
        datasetDir: path.join(inputs.root, inputs.districtId),
        outPath: refreshedPublishReportPath,
      }),
    () => true,
  )
  const p0Readiness = await runCheck(
    'P0 readiness',
    true,
    () =>
      runners.buildP0Readiness({
        districtId: inputs.districtId,
        answerCasesPath: inputs.answerCasesPath,
        publishReportPath: refreshedPublishReportPath,
        allowPublishWarn: inputs.allowPublishWarn,
        publishOverrideReason: inputs.publishOverrideReason,
        ...(allowMismatchedCaseHash ? { allowMismatchedCaseHash } : {}),
      }),
    (summary) => summary.pass,
  )
  const districtMatrix = await runCheck(
    'District readiness matrix',
    inputs.strictMatrix,
    () =>
      runners.runDistrictReadinessMatrix({
        configGlob: inputs.configGlob,
        publicRoot: inputs.root,
        registryPath: inputs.registryPath,
      }),
    (summary) => (inputs.strictMatrix ? !summary.hasBlockers : true),
  )
  const bundleBudget = await runCheck(
    'Bundle budget',
    true,
    () =>
      runners.runBundleBudget({
        distDir: inputs.distDir,
      }),
    (summary) => summary.pass,
  )
  const apiServices = await runCheck(
    'API service probes',
    true,
    () =>
      runners.runSmokeApiServices({
        startPreview: true,
        timeoutMs: inputs.timeoutMs,
        syncIssueRoundtrip: true,
      }),
    (summary) => summary.failed === 0,
  )
  const appServer = await runCheck(
    'App server smoke',
    true,
    () =>
      runners.runSmokeAppServer({
        timeoutMs: inputs.timeoutMs,
      }),
    (summary) => summary.pass,
  )
  const parkingAnswerApi = await runCheck(
    'Parking answer API',
    true,
    () =>
      runners.runSmokeParkingAnswerService({
        district: inputs.districtId,
        casesPath: inputs.answerCasesPath,
        timeoutMs: inputs.timeoutMs,
        ...(allowMismatchedCaseHash ? { allowMismatchedCaseHash } : {}),
      }),
    (summary) => summary.failed === 0,
  )
  const reviewedUi = inputs.skipUi
    ? null
    : await runCheck(
        'Reviewed UI answers',
        true,
        () =>
          runners.runSmokeReviewedUiPacks({
            root: inputs.root,
            registryPath: inputs.registryPath,
            requiredReviewedCaseDistricts: [inputs.districtId],
            timeoutMs: inputs.timeoutMs,
            startPreview: true,
            ...(allowMismatchedCaseHash ? { allowMismatchedCaseHash } : {}),
          }),
        (summary) => !summary.hasErrors,
      )
  const mapReviewedUi = inputs.skipUi
    ? null
    : await runCheck(
        'MAP reviewed UI answer',
        true,
        () =>
          runners.runSmokeUiParkingAnswers({
            district: inputs.districtId,
            casesPath: inputs.answerCasesPath,
            view: 'MAP',
            limit: 1,
            timeoutMs: inputs.timeoutMs,
            startPreview: true,
            ...(allowMismatchedCaseHash ? { allowMismatchedCaseHash } : {}),
          }),
        (summary) => summary.passCount === summary.caseCount,
      )
  const mapUi = inputs.skipUi
    ? null
    : await runCheck(
        'MAP UI smoke',
        true,
        () =>
          runners.runSmokeUiMapView({
            district: inputs.districtId,
            timeoutMs: inputs.timeoutMs,
            startPreview: true,
          }),
        (summary) => summary.pass,
      )
  const paidCurbReferenceUi = inputs.skipUi
    ? null
    : await runCheck(
        'Paid-curb reference UI smoke',
        true,
        () =>
          runners.runSmokeUiPaidCurbReference({
            district: inputs.districtId,
            timeoutMs: inputs.timeoutMs,
            startPreview: true,
          }),
        (summary) => summary.pass,
      )
  const issueReportUi = inputs.skipUi
    ? null
    : await runCheck(
        'Issue report UI smoke',
        true,
        () =>
          runners.runSmokeUiIssueReport({
            district: inputs.districtId,
            timeoutMs: inputs.timeoutMs,
            startPreview: true,
          }),
        (summary) => summary.pass,
      )
  const checks: ReadonlyArray<P1ReleaseReadinessCheck<unknown>> = [
    publishReportRefresh,
    p0Readiness,
    districtMatrix,
    bundleBudget,
    apiServices,
    appServer,
    parkingAnswerApi,
    ...(reviewedUi ? [reviewedUi] : []),
    ...(mapReviewedUi ? [mapReviewedUi] : []),
    ...(mapUi ? [mapUi] : []),
    ...(paidCurbReferenceUi ? [paidCurbReferenceUi] : []),
    ...(issueReportUi ? [issueReportUi] : []),
  ]
  const blockers = checks.map(checkBlocker).filter((item): item is string => Boolean(item))
  return {
    pass: blockers.length === 0,
    inputs,
    publishReportRefresh,
    p0Readiness,
    districtMatrix,
    bundleBudget,
    apiServices,
    appServer,
    parkingAnswerApi,
    reviewedUi,
    mapReviewedUi,
    mapUi,
    paidCurbReferenceUi,
    issueReportUi,
    blockers,
    knownDistrictBlockers: knownDistrictBlockers(districtMatrix.summary),
  }
}

const checkStatus = <T>(check: P1ReleaseReadinessCheck<T>) => {
  if (check.pass) {
    return 'PASS'
  }
  return check.required ? 'FAIL' : 'WARN'
}

const formatApiServices = (summary: SmokeApiServicesSummary | null) =>
  summary
    ? `${summary.passed}/${summary.results.length + (summary.actions?.length ?? 0)} checks`
    : '-'

const formatAppServer = (summary: SmokeAppServerResult | null) =>
  summary
    ? `${summary.probes.filter((probe) => probe.pass).length}/${summary.probes.length} probes`
    : '-'

const formatBundleBudget = (summary: BundleBudgetResult | null) =>
  summary
    ? `entry ${summary.entry.bytes}/${summary.maxEntryBytes} bytes, initial JS ${summary.initialJsBytes}/${summary.maxInitialJsBytes} bytes`
    : '-'

const formatParkingAnswerApi = (
  summary: SmokeParkingAnswerServiceSummary | null,
) => (summary ? `${summary.passed}/${summary.results.length} cases` : '-')

const formatReviewedUi = (summary: SmokeReviewedUiPacksResult | null) =>
  summary
    ? `${summary.packResults.filter((pack) => !pack.errors.length).length}/${summary.packResults.length} packs`
    : '-'

const formatMapReviewedUi = (summary: SmokeUiParkingAnswersSummary | null) =>
  summary
    ? `${summary.passCount}/${summary.caseCount} cases, view ${summary.view}`
    : '-'

const formatMapUi = (summary: SmokeUiMapViewSummary | null) =>
  summary
    ? `segments ${summary.mapSegmentCount}/${summary.expectedSegmentsCount ?? '>0'}, parking spaces ${summary.mapParkingSpaceCount}/${summary.expectedParkingSpacesCount ?? '>0'}, canvas ${summary.canvasWidth}x${summary.canvasHeight}`
    : '-'

const formatPaidCurbReferenceUi = (
  summary: SmokeUiPaidCurbReferenceSummary | null,
) =>
  summary
    ? `source ${summary.sourceRecordCount ?? 'missing'}, points ${summary.referencePointCount ?? 'missing'}, excluded ${summary.excludedPointCount ?? 'missing'}, selected ${summary.selectedReferenceId ?? 'missing'}`
    : '-'

const formatIssueReportUi = (summary: SmokeUiIssueReportSummary | null) =>
  summary
    ? `issue ${summary.issueId}, local ${summary.localIssueCount}, remote ${summary.remoteIssueCount}, debug ${summary.downloadedFileName}`
    : '-'

const formatP0 = (summary: P0ReadinessResult | null) => {
  if (!summary) {
    return '-'
  }
  const cases = summary.exactSmoke.summary?.caseResults ?? []
  return `exact ${summary.exactSmoke.pass ? 'pass' : 'fail'}, review ${summary.qaReview.pass ? 'pass' : 'fail'}, publish ${summary.publishGate.pass ? 'pass' : 'fail'}, cases ${
    cases.length > 0 ? `${cases.filter((result) => result.pass).length}/${cases.length}` : 'none'
  }`
}

const formatPublishReportRefresh = (summary: RefreshPublishReportResult | null) => {
  if (!summary) {
    return '-'
  }
  const warnCount = summary.summary.warnings.filter(
    (warning) => warning.severity === 'WARN',
  ).length
  const failCount = summary.summary.warnings.filter(
    (warning) => warning.severity === 'FAIL',
  ).length
  return `${summary.summary.districtId} report refreshed, warn ${warnCount}, fail ${failCount}`
}

const formatKnownDistrictBlockers = (
  blockers: P1ReleaseReadinessResult['knownDistrictBlockers'],
) =>
  blockers.length === 0
    ? ['- none']
    : blockers.map(
        (entry) => `- ${entry.districtId}: ${entry.blockers.join('; ')}`,
      )

export const renderP1ReleaseReadiness = (result: P1ReleaseReadinessResult) => {
  const reviewedUiLine = result.reviewedUi
    ? `| ${checkStatus(result.reviewedUi)} | Reviewed UI answers | ${formatReviewedUi(result.reviewedUi.summary)} | ${result.reviewedUi.error ?? ''} |`
    : '| SKIP | Reviewed UI answers | skipped by --skip-ui | |'
  const mapReviewedUiLine = result.mapReviewedUi
    ? `| ${checkStatus(result.mapReviewedUi)} | MAP reviewed UI answer | ${formatMapReviewedUi(result.mapReviewedUi.summary)} | ${result.mapReviewedUi.error ?? ''} |`
    : '| SKIP | MAP reviewed UI answer | skipped by --skip-ui | |'
  const mapUiLine = result.mapUi
    ? `| ${checkStatus(result.mapUi)} | MAP UI smoke | ${formatMapUi(result.mapUi.summary)} | ${result.mapUi.error ?? ''} |`
    : '| SKIP | MAP UI smoke | skipped by --skip-ui | |'
  const paidCurbReferenceUiLine = result.paidCurbReferenceUi
    ? `| ${checkStatus(result.paidCurbReferenceUi)} | Paid-curb reference UI smoke | ${formatPaidCurbReferenceUi(result.paidCurbReferenceUi.summary)} | ${result.paidCurbReferenceUi.error ?? ''} |`
    : '| SKIP | Paid-curb reference UI smoke | skipped by --skip-ui | |'
  const issueReportUiLine = result.issueReportUi
    ? `| ${checkStatus(result.issueReportUi)} | Issue report UI smoke | ${formatIssueReportUi(result.issueReportUi.summary)} | ${result.issueReportUi.error ?? ''} |`
    : '| SKIP | Issue report UI smoke | skipped by --skip-ui | |'
  const lines = [
    `# P1 Release Readiness: ${result.pass ? 'PASS' : 'BLOCKED'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Root: ${result.inputs.root}`,
    `- Registry: ${result.inputs.registryPath}`,
    `- Configs: ${result.inputs.configGlob}`,
    `- Answer cases: ${result.inputs.answerCasesPath}`,
    `- Dist: ${result.inputs.distDir}`,
    `- Timeout: ${result.inputs.timeoutMs}ms`,
    `- Strict matrix: ${result.inputs.strictMatrix ? 'yes' : 'no'}`,
    `- UI smoke: ${result.inputs.skipUi ? 'skipped' : 'enabled'}`,
    `- Publish WARN override: ${result.inputs.allowPublishWarn ? 'yes' : 'no'}`,
    `- Publish override reason: ${result.inputs.publishOverrideReason}`,
    '',
    '## Checks',
    '',
    '| Status | Check | Summary | Error |',
    '| --- | --- | --- | --- |',
    `| ${checkStatus(result.publishReportRefresh)} | Publish report refresh | ${formatPublishReportRefresh(result.publishReportRefresh.summary)} | ${result.publishReportRefresh.error ?? ''} |`,
    `| ${checkStatus(result.p0Readiness)} | P0 readiness | ${formatP0(result.p0Readiness.summary)} | ${result.p0Readiness.error ?? ''} |`,
    `| ${checkStatus(result.districtMatrix)} | District readiness matrix | ${
      result.districtMatrix.summary
        ? `${result.districtMatrix.summary.entries.length} districts, ${result.knownDistrictBlockers.length} with blockers`
        : '-'
    } | ${result.districtMatrix.error ?? ''} |`,
    `| ${checkStatus(result.bundleBudget)} | Bundle budget | ${formatBundleBudget(result.bundleBudget.summary)} | ${result.bundleBudget.error ?? ''} |`,
    `| ${checkStatus(result.apiServices)} | API service probes | ${formatApiServices(result.apiServices.summary)} | ${result.apiServices.error ?? ''} |`,
    `| ${checkStatus(result.appServer)} | App server smoke | ${formatAppServer(result.appServer.summary)} | ${result.appServer.error ?? ''} |`,
    `| ${checkStatus(result.parkingAnswerApi)} | Parking answer API | ${formatParkingAnswerApi(result.parkingAnswerApi.summary)} | ${result.parkingAnswerApi.error ?? ''} |`,
    reviewedUiLine,
    mapReviewedUiLine,
    mapUiLine,
    paidCurbReferenceUiLine,
    issueReportUiLine,
    '',
    '## Blockers',
    '',
    ...(result.blockers.length === 0
      ? ['- none']
      : result.blockers.map((blocker) => `- ${blocker}`)),
    '',
    '## Known District Blockers',
    '',
    ...formatKnownDistrictBlockers(result.knownDistrictBlockers),
  ]
  return lines.join('\n')
}

export const resolveP1ReleaseReadinessSummaryPath = (
  options: Pick<P1ReleaseReadinessOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseP1ReleaseReadinessArgs(process.argv)
  const result = await runP1ReleaseReadiness(options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderP1ReleaseReadiness(result)
  console.log(output)
  const summaryPath = resolveP1ReleaseReadinessSummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderP1ReleaseReadiness(result)}\n\n`)
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
