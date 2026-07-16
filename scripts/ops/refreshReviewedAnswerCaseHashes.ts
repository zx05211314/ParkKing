import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadSmokeExactParkingAnswerCases,
  runSmokeExactParkingAnswers,
} from './smokeExactParkingAnswers'

const DEFAULT_DATASET_ROOT = 'public/data/generated'
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'

type RefreshStatus =
  | 'unchanged'
  | 'would-repin'
  | 'repinned'
  | 'blocked'
  | 'failed'

export interface RefreshReviewedAnswerCaseHashesOptions {
  datasetRoot?: string
  answerCasesDir?: string
  districtIds?: string[]
  execute?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
  json?: boolean
}

export interface ReviewedAnswerCaseHashRefresh {
  districtId: string
  casesPath: string
  datasetDir: string
  caseCount: number
  previousDatasetHash: string | null
  runtimeDatasetHash: string | null
  semanticValidationPassed: boolean
  status: RefreshStatus
  errors: string[]
}

export interface RefreshReviewedAnswerCaseHashesResult {
  pass: boolean
  execute: boolean
  datasetRoot: string
  answerCasesDir: string
  requestedDistrictIds: string[]
  refreshed: ReviewedAnswerCaseHashRefresh[]
  errors: string[]
}

export interface ReviewedAnswerCaseSemanticValidation {
  datasetDir: string
  casesPath: string
  caseCount: number
}

export interface RefreshReviewedAnswerCaseHashesDependencies {
  validateSemantics?: (
    params: ReviewedAnswerCaseSemanticValidation,
  ) => Promise<void>
}

interface PreparedRefresh {
  result: ReviewedAnswerCaseHashRefresh
  payload: Record<string, unknown> | null
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
  flags.forEach((flag) => {
    argv.forEach((value, index) => {
      if (value === flag && argv[index + 1]) {
        values.push(argv[index + 1])
      }
    })
  })
  return values
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseDistrictIds = (values: string[]) => [
  ...new Set(
    values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean),
  ),
]

export const parseRefreshReviewedAnswerCaseHashesArgs = (
  argv: string[],
): RefreshReviewedAnswerCaseHashesOptions => ({
  datasetRoot:
    getArgValue(argv, '--root', '--dataset-root', '--datasetRoot') ??
    DEFAULT_DATASET_ROOT,
  answerCasesDir:
    getArgValue(
      argv,
      '--answer-cases-dir',
      '--answerCasesDir',
      '--cases-dir',
    ) ?? DEFAULT_ANSWER_CASES_DIR,
  districtIds: parseDistrictIds(
    getArgValues(argv, '--district', '--districts', '--district-id'),
  ),
  execute: hasFlag(argv, '--execute'),
  outPath: getArgValue(argv, '--out'),
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
  json: hasFlag(argv, '--json'),
})

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' && record[key].trim().length > 0
    ? record[key].trim()
    : null

const readJsonRecord = async (targetPath: string) =>
  toRecord(JSON.parse(await fs.readFile(targetPath, 'utf-8')) as unknown)

const districtIdFromCasesFile = (fileName: string) =>
  fileName.replace(/\.answer-cases\.json$/i, '')

const listAnswerCasePaths = async (
  answerCasesDir: string,
  requestedDistrictIds: string[],
) => {
  const requested = new Set(requestedDistrictIds)
  const entries = await fs.readdir(answerCasesDir, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.answer-cases.json') &&
        (requested.size === 0 || requested.has(districtIdFromCasesFile(entry.name))),
    )
    .map((entry) => path.join(answerCasesDir, entry.name))
    .sort((left, right) => left.localeCompare(right))
}

const defaultValidateSemantics = async (
  params: ReviewedAnswerCaseSemanticValidation,
) => {
  const summary = await runSmokeExactParkingAnswers({
    datasetDir: params.datasetDir,
    casesPath: params.casesPath,
    minParkAnswers: 0,
    minNoStopAnswers: 0,
    minMarkedSpaceParkAnswers: 0,
    allowMismatchedCaseHash: true,
  })
  const results = summary.caseResults ?? []
  if (results.length !== params.caseCount) {
    throw new Error(
      `Semantic validation returned ${results.length}/${params.caseCount} reviewed cases.`,
    )
  }
  const failed = results.filter(({ pass }) => !pass)
  if (failed.length > 0) {
    throw new Error(
      `Semantic validation failed for ${failed.map(({ id }) => id).join(', ')}.`,
    )
  }
}

const prepareRefresh = async (params: {
  casesPath: string
  datasetRoot: string
  validateSemantics: (
    validation: ReviewedAnswerCaseSemanticValidation,
  ) => Promise<void>
}): Promise<PreparedRefresh> => {
  const fileDistrictId = districtIdFromCasesFile(path.basename(params.casesPath))
  const datasetDir = path.join(params.datasetRoot, fileDistrictId)
  const result: ReviewedAnswerCaseHashRefresh = {
    districtId: fileDistrictId,
    casesPath: params.casesPath,
    datasetDir,
    caseCount: 0,
    previousDatasetHash: null,
    runtimeDatasetHash: null,
    semanticValidationPassed: false,
    status: 'failed',
    errors: [],
  }

  try {
    const payload = await readJsonRecord(params.casesPath)
    const parsedCases = await loadSmokeExactParkingAnswerCases(params.casesPath)
    const districtId = getString(payload, 'districtId')
    result.caseCount = parsedCases.cases.length
    result.previousDatasetHash = getString(payload, 'datasetHash')
    if (districtId !== fileDistrictId) {
      throw new Error(
        `Answer-case district ${districtId ?? 'missing'} does not match ${fileDistrictId}.`,
      )
    }
    if (result.caseCount === 0) {
      throw new Error('Answer-case file has no reviewed cases.')
    }
    if (!result.previousDatasetHash) {
      throw new Error('Answer-case file has no datasetHash.')
    }

    const meta = await readJsonRecord(path.join(datasetDir, 'dataset_meta.json'))
    const runtimeDistrictId = getString(meta, 'districtId')
    result.runtimeDatasetHash = getString(meta, 'datasetHash')
    if (runtimeDistrictId !== fileDistrictId) {
      throw new Error(
        `Runtime district ${runtimeDistrictId ?? 'missing'} does not match ${fileDistrictId}.`,
      )
    }
    if (!result.runtimeDatasetHash) {
      throw new Error('Runtime dataset metadata has no datasetHash.')
    }

    await params.validateSemantics({
      datasetDir,
      casesPath: params.casesPath,
      caseCount: result.caseCount,
    })
    result.semanticValidationPassed = true
    result.status =
      result.previousDatasetHash === result.runtimeDatasetHash
        ? 'unchanged'
        : 'would-repin'
    return {
      result,
      payload: {
        ...payload,
        datasetHash: result.runtimeDatasetHash,
      },
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
    return { result, payload: null }
  }
}

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export const refreshReviewedAnswerCaseHashes = async (
  options: RefreshReviewedAnswerCaseHashesOptions = {},
  dependencies: RefreshReviewedAnswerCaseHashesDependencies = {},
): Promise<RefreshReviewedAnswerCaseHashesResult> => {
  const datasetRoot = path.resolve(options.datasetRoot ?? DEFAULT_DATASET_ROOT)
  const answerCasesDir = path.resolve(
    options.answerCasesDir ?? DEFAULT_ANSWER_CASES_DIR,
  )
  const requestedDistrictIds = options.districtIds ?? []
  const validateSemantics =
    dependencies.validateSemantics ?? defaultValidateSemantics
  const errors: string[] = []
  let casesPaths: string[] = []

  try {
    casesPaths = await listAnswerCasePaths(answerCasesDir, requestedDistrictIds)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  if (casesPaths.length === 0 && errors.length === 0) {
    errors.push('No reviewed answer-case files matched the request.')
  }

  const prepared = await Promise.all(
    casesPaths.map((casesPath) =>
      prepareRefresh({ casesPath, datasetRoot, validateSemantics }),
    ),
  )
  const validationFailed = prepared.some(
    ({ result }) => !result.semanticValidationPassed,
  )

  if (options.execute && !validationFailed && errors.length === 0) {
    for (const candidate of prepared) {
      if (
        candidate.result.status === 'would-repin' &&
        candidate.payload
      ) {
        await writeJson(candidate.result.casesPath, candidate.payload)
        candidate.result.status = 'repinned'
      }
    }
  } else if (options.execute && validationFailed) {
    prepared.forEach(({ result }) => {
      if (result.status === 'would-repin') {
        result.status = 'blocked'
      }
    })
    errors.push(
      'No answer-case hashes were written because at least one district failed semantic validation.',
    )
  }

  return {
    pass: errors.length === 0 && !validationFailed,
    execute: Boolean(options.execute),
    datasetRoot,
    answerCasesDir,
    requestedDistrictIds,
    refreshed: prepared.map(({ result }) => result),
    errors,
  }
}

const compactHash = (value: string | null) => value?.slice(0, 12) ?? '-'

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')

export const renderRefreshReviewedAnswerCaseHashes = (
  result: RefreshReviewedAnswerCaseHashesResult,
) => {
  const lines = [
    `# Reviewed answer-case semantic repin: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Mode: ${result.execute ? 'execute' : 'report-only'}`,
    `- Dataset root: ${result.datasetRoot}`,
    `- Answer cases: ${result.answerCasesDir}`,
    `- Districts: ${result.refreshed.length}`,
    '- Safety: hash mismatch is ignored only during exact semantic validation; writes occur only after every district passes.',
    '',
    '| District | Cases | Previous hash | Runtime hash | Semantic validation | Status | Error |',
    '| --- | ---: | --- | --- | --- | --- | --- |',
    ...result.refreshed.map((entry) =>
      [
        entry.districtId,
        entry.caseCount,
        compactHash(entry.previousDatasetHash),
        compactHash(entry.runtimeDatasetHash),
        entry.semanticValidationPassed ? 'pass' : 'fail',
        entry.status,
        escapeCell(entry.errors.join('; ')),
      ].join(' | ').replace(/^/, '| ').concat(' |'),
    ),
    ...(result.errors.length > 0
      ? ['', '## Errors', '', ...result.errors.map((error) => `- ${error}`)]
      : []),
    '',
  ]
  return lines.join('\n')
}

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseRefreshReviewedAnswerCaseHashesArgs(process.argv)
  const result = await refreshReviewedAnswerCaseHashes(options)
  const markdown = renderRefreshReviewedAnswerCaseHashes(result)
  console.log(options.json ? JSON.stringify(result, null, 2) : markdown)
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeJson(path.resolve(options.jsonOutPath), result)
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
