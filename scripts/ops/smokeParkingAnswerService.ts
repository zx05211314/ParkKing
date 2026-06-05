import type { AddressInfo } from 'node:net'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveParkingAnswerServiceConfig,
  joinParkingAnswerServicePath,
  startParkingAnswerServiceServer,
} from './parkingAnswerService'
import {
  loadSmokeExactParkingAnswerCases,
  runSmokeExactParkingAnswers,
  type SmokeExactParkingAnswerSample,
  type SmokeExactParkingAnswerCase,
} from './smokeExactParkingAnswers'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'

export interface SmokeParkingAnswerServiceOptions {
  district?: string
  datasetDir?: string
  casesPath?: string
  endpoint?: string
  port?: number
  timeoutMs?: number
  maxCases?: number
  hhmm?: string
  searchRadiusMeters?: number
  minParkAnswers?: number
  minNoStopAnswers?: number
  minMarkedSpaceParkAnswers?: number
  skipHealthCheck?: boolean
  allowMismatchedCaseHash?: boolean
}

export interface SmokeParkingAnswerServiceCaseResult {
  id: string
  status: number
  pass: boolean
  errors: string[]
  expectedKind: string
  answerKind: string | null
  expectedEvidenceKind: string | null
  evidenceKind: string | null
  expectedPrimarySegmentId: string | null
  primarySegmentId: string | null
  trustLabel: string | null
}

export interface SmokeParkingAnswerServiceSummary {
  endpoint: string
  district: string
  casesPath: string
  datasetHash: string | null
  probes: string[]
  passed: number
  failed: number
  results: SmokeParkingAnswerServiceCaseResult[]
}

const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_HHMM = '21:00'
const DEFAULT_SEARCH_RADIUS_METERS = 25

export const resolveSmokeParkingAnswerServiceRuntime = (params: {
  district: string
  datasetDir?: string
}) => {
  const sampleDatasetDir =
    params.datasetDir ?? path.join('public', 'data', 'generated', params.district)
  const resolvedDatasetDir = path.resolve(sampleDatasetDir)
  return {
    sampleDatasetDir,
    serviceDistrict: params.datasetDir
      ? path.basename(resolvedDatasetDir)
      : params.district,
    serviceDatasetRoot: params.datasetDir
      ? path.dirname(resolvedDatasetDir)
      : undefined,
  }
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

const parseNumberArg = (argv: string[], ...flags: string[]) => {
  const value = getArgValue(argv, ...flags)
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flags[0]} must be a finite number`)
  }
  return parsed
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' ? record[key] : null

const getNumber = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : null

const buildCaseUrl = (
  endpoint: string,
  district: string,
  answerCase: SmokeExactParkingAnswerCase,
  datasetDir?: string,
) => {
  const url = new URL(endpoint)
  if (datasetDir) {
    url.searchParams.set('datasetDir', datasetDir)
  } else {
    url.searchParams.set('district', district)
  }
  url.searchParams.set('lng', String(answerCase.lng))
  url.searchParams.set('lat', String(answerCase.lat))
  if (answerCase.hhmm) {
    url.searchParams.set('hhmm', answerCase.hhmm)
  }
  if (answerCase.searchRadiusMeters !== undefined) {
    url.searchParams.set('radius', String(answerCase.searchRadiusMeters))
  }
  if (answerCase.includeInferred !== undefined) {
    url.searchParams.set('includeInferred', String(answerCase.includeInferred))
  }
  return url
}

const buildServiceProbeUrl = (endpoint: string, suffix: 'health' | 'ready') => {
  const url = new URL(endpoint)
  url.pathname = joinParkingAnswerServicePath(url.pathname, suffix)
  url.search = ''
  return url
}

const assertParkingAnswerServiceProbe = async (
  endpoint: string,
  suffix: 'health' | 'ready',
  timeoutMs: number,
) => {
  const url = buildServiceProbeUrl(endpoint, suffix)
  const { response, payload } = await fetchJsonWithTimeout(url, timeoutMs)
  if (!response.ok) {
    throw new Error(
      `Parking answer service ${suffix} probe failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    )
  }
}

const buildCaseFromSample = (
  sample: SmokeExactParkingAnswerSample,
  hhmm: string,
  searchRadiusMeters: number,
): SmokeExactParkingAnswerCase => ({
  id: `sample-${sample.sampleKind}-${sample.sourceSegmentId}`,
  label: sample.primaryName ?? sample.sourceSegmentId,
  lng: sample.location[0],
  lat: sample.location[1],
  hhmm,
  searchRadiusMeters,
  expectedKind: sample.expectedKind,
  expectedEvidenceKind: sample.evidenceKind,
  expectedPrimarySegmentId: sample.primarySegmentId ?? undefined,
  expectedFinalConfidence: sample.primaryFinalConfidence ?? undefined,
  minParkingSpaceCount: sample.parkingSpaceCount,
})

const fetchJsonWithTimeout = async (url: URL, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const payload = await response.json().catch(() => null)
    return { response, payload }
  } finally {
    clearTimeout(timeout)
  }
}

export const buildSmokeParkingAnswerServiceCaseResult = (params: {
  answerCase: SmokeExactParkingAnswerCase
  responseStatus: number
  payload: unknown
  expectedDatasetHash?: string | null
}): SmokeParkingAnswerServiceCaseResult => {
  const { answerCase, responseStatus } = params
  const payload = toRecord(params.payload)
  const answer = toRecord(payload.answer)
  const evidence = toRecord(answer.evidence)
  const primary = toRecord(answer.primary)
  const trustSummary = toRecord(payload.trustSummary)
  const errors: string[] = []
  const answerKind = getString(answer, 'kind')
  const evidenceKind = getString(evidence, 'kind')
  const primarySegmentId = getString(primary, 'id')
  const trustLabel = getString(trustSummary, 'trustLabel')

  if (responseStatus !== 200) {
    errors.push(`expected HTTP 200, got ${responseStatus}`)
  }
  if (payload.schemaVersion !== 1) {
    errors.push(`expected schemaVersion 1, got ${String(payload.schemaVersion)}`)
  }
  if (
    params.expectedDatasetHash &&
    payload.datasetHash !== params.expectedDatasetHash
  ) {
    errors.push(
      `expected datasetHash ${params.expectedDatasetHash}, got ${String(payload.datasetHash)}`,
    )
  }
  if (answerKind !== answerCase.expectedKind) {
    errors.push(`expected kind ${answerCase.expectedKind}, got ${answerKind ?? 'none'}`)
  }
  if (
    answerCase.expectedEvidenceKind &&
    evidenceKind !== answerCase.expectedEvidenceKind
  ) {
    errors.push(
      `expected evidence ${answerCase.expectedEvidenceKind}, got ${evidenceKind ?? 'none'}`,
    )
  }
  if (
    answerCase.expectedPrimarySegmentId &&
    primarySegmentId !== answerCase.expectedPrimarySegmentId
  ) {
    errors.push(
      `expected primary ${answerCase.expectedPrimarySegmentId}, got ${primarySegmentId ?? 'none'}`,
    )
  }
  if (
    answerCase.expectedFinalConfidence &&
    primary.finalConfidence !== answerCase.expectedFinalConfidence
  ) {
    errors.push(
      `expected confidence ${answerCase.expectedFinalConfidence}, got ${String(primary.finalConfidence ?? 'none')}`,
    )
  }
  if (
    answerCase.minParkingSpaceCount !== undefined &&
    (getNumber(evidence, 'parkingSpaceCount') ?? 0) < answerCase.minParkingSpaceCount
  ) {
    errors.push(
      `expected at least ${answerCase.minParkingSpaceCount} parking spaces, got ${String(evidence.parkingSpaceCount ?? 'none')}`,
    )
  }

  return {
    id: answerCase.id,
    status: responseStatus,
    pass: errors.length === 0,
    errors,
    expectedKind: answerCase.expectedKind,
    answerKind,
    expectedEvidenceKind: answerCase.expectedEvidenceKind ?? null,
    evidenceKind,
    expectedPrimarySegmentId: answerCase.expectedPrimarySegmentId ?? null,
    primarySegmentId,
    trustLabel,
  }
}

export const parseSmokeParkingAnswerServiceArgs = (
  argv: string[],
): SmokeParkingAnswerServiceOptions => {
  const district = getArgValue(argv, '--district') ?? DEFAULT_DISTRICT
  const casesPath = hasFlag(argv, '--no-cases', '--sample-cases')
    ? undefined
    : getArgValue(argv, '--cases', '--casesPath', '--cases-path') ??
      `configs/prod/${district}.answer-cases.json`
  return {
    district,
    datasetDir:
      getArgValue(argv, '--datasetDir', '--dataset-dir') ?? undefined,
    casesPath,
    endpoint: getArgValue(argv, '--endpoint') ?? undefined,
    port: parseNumberArg(argv, '--port'),
    timeoutMs:
      parseNumberArg(argv, '--timeout-ms', '--timeoutMs') ?? DEFAULT_TIMEOUT_MS,
    maxCases: parseNumberArg(argv, '--max-cases', '--maxCases'),
    hhmm: getArgValue(argv, '--hhmm') ?? DEFAULT_HHMM,
    searchRadiusMeters:
      parseNumberArg(argv, '--radius', '--searchRadiusMeters') ??
      DEFAULT_SEARCH_RADIUS_METERS,
    minParkAnswers: parseNumberArg(argv, '--minParkAnswers'),
    minNoStopAnswers: parseNumberArg(argv, '--minNoStopAnswers'),
    minMarkedSpaceParkAnswers: parseNumberArg(
      argv,
      '--minMarkedSpaceParkAnswers',
    ),
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
  }
}

export const renderSmokeParkingAnswerServiceSummary = (
  summary: SmokeParkingAnswerServiceSummary,
) =>
  [
    `Parking answer service smoke ok: ${summary.endpoint}`,
    `District: ${summary.district}`,
    `Probes: ${summary.probes.length > 0 ? summary.probes.join(', ') : 'skipped'}`,
    `Cases: ${summary.passed}/${summary.results.length} passed from ${summary.casesPath}`,
    `Dataset hash: ${summary.datasetHash ?? '-'}`,
    ...summary.results.map((result) => {
      const status = result.pass ? 'PASS' : `FAIL ${result.errors.join(' | ')}`
      return `CASE ${result.id}: ${status}; expected ${result.expectedKind}, got ${result.answerKind ?? 'none'}; primary ${result.primarySegmentId ?? '-'}; evidence ${result.evidenceKind ?? '-'}; trust ${result.trustLabel ?? '-'}`
    }),
  ].join('\n')

export const runSmokeParkingAnswerService = async (
  options: SmokeParkingAnswerServiceOptions = {},
) => {
  const district = options.district ?? DEFAULT_DISTRICT
  const hhmm = options.hhmm ?? DEFAULT_HHMM
  const searchRadiusMeters =
    options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
  const { sampleDatasetDir, serviceDistrict, serviceDatasetRoot } =
    resolveSmokeParkingAnswerServiceRuntime({
      district,
      datasetDir: options.datasetDir,
    })
  const caseFile = options.casesPath
    ? await loadSmokeExactParkingAnswerCases(options.casesPath)
    : null
  const allowMismatchedCaseHash =
    resolveReviewedCaseHashMismatchAllowance(options.allowMismatchedCaseHash)
  let exactSummary: Awaited<ReturnType<typeof runSmokeExactParkingAnswers>> | null =
    null
  let allCases: SmokeExactParkingAnswerCase[]
  if (caseFile) {
    allCases = caseFile.cases
  } else {
    exactSummary = await runSmokeExactParkingAnswers({
      datasetDir: sampleDatasetDir,
      hhmm,
      searchRadiusMeters,
      minParkAnswers: options.minParkAnswers,
      minNoStopAnswers: options.minNoStopAnswers,
      minMarkedSpaceParkAnswers: options.minMarkedSpaceParkAnswers,
    })
    allCases = exactSummary.samples.map((sample) =>
      buildCaseFromSample(sample, hhmm, searchRadiusMeters),
    )
  }
  const cases =
    options.maxCases && options.maxCases > 0
      ? allCases.slice(0, options.maxCases)
      : allCases
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const config = options.endpoint
    ? null
    : resolveParkingAnswerServiceConfig(
        {
          ...process.env,
          PARKKING_PARKING_ANSWER_PORT: String(options.port ?? 8790),
          PARKKING_PARKING_ANSWER_DATASET_ROOT:
            serviceDatasetRoot ??
            process.env.PARKKING_PARKING_ANSWER_DATASET_ROOT,
          PARKKING_PARKING_ANSWER_DISTRICTS: serviceDistrict,
          PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT: serviceDistrict,
          PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR: options.datasetDir
            ? '1'
            : process.env.PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR,
        },
        process.cwd(),
      )
  if (config && options.port === undefined) {
    config.port = 0
  }
  const server = config ? startParkingAnswerServiceServer(config) : null

  try {
    const endpoint = options.endpoint ?? await new Promise<string>((resolve) => {
      server?.on('listening', () => {
        const address = server.address() as AddressInfo
        resolve(`http://127.0.0.1:${address.port}${config?.path ?? ''}`)
      })
    })
    if (!options.skipHealthCheck) {
      await assertParkingAnswerServiceProbe(endpoint, 'health', timeoutMs)
      await assertParkingAnswerServiceProbe(endpoint, 'ready', timeoutMs)
    }
    const results: SmokeParkingAnswerServiceCaseResult[] = []
    for (const answerCase of cases) {
      const url = buildCaseUrl(endpoint, district, answerCase, options.datasetDir)
      const { response, payload } = await fetchJsonWithTimeout(url, timeoutMs)
      results.push(
        buildSmokeParkingAnswerServiceCaseResult({
          answerCase,
          responseStatus: response.status,
          payload,
          expectedDatasetHash: caseFile && allowMismatchedCaseHash
            ? undefined
            : caseFile?.datasetHash ?? exactSummary?.datasetHash,
        }),
      )
    }

    const summary: SmokeParkingAnswerServiceSummary = {
      endpoint,
      district,
      casesPath:
        options.casesPath ??
        `generated samples from ${sampleDatasetDir}`,
      datasetHash: caseFile?.datasetHash ?? exactSummary?.datasetHash ?? null,
      probes: options.skipHealthCheck ? [] : ['health', 'ready'],
      passed: results.filter((result) => result.pass).length,
      failed: results.filter((result) => !result.pass).length,
      results,
    }
    if (summary.failed > 0) {
      throw new Error(
        [
          'Parking answer service smoke failed:',
          renderSmokeParkingAnswerServiceSummary(summary),
        ].join('\n'),
      )
    }
    return summary
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    }
  }
}

const run = async () => {
  const summary = await runSmokeParkingAnswerService(
    parseSmokeParkingAnswerServiceArgs(process.argv),
  )
  console.log(renderSmokeParkingAnswerServiceSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
