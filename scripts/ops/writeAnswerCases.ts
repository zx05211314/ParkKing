import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  runSmokeExactParkingAnswers,
  type SmokeExactParkingAnswerCase,
} from './smokeExactParkingAnswers'

export interface WriteAnswerCasesArgs {
  inputPath: string | null
  datasetDir: string | null
  outPath: string | null
  districtId: string | null
  hhmm: string | null
  searchRadiusMeters: number | null
  validate: boolean
}

export interface WriteAnswerCasesParams {
  inputPath: string
  datasetDir?: string | null
  outPath?: string | null
  districtId?: string | null
  hhmm?: string | null
  searchRadiusMeters?: number | null
  validate?: boolean
}

export interface WriteAnswerCasesResult {
  pass: boolean
  inputPath: string
  datasetDir: string
  outPath: string
  districtId: string
  datasetHash: string
  casesWritten: number
  validated: boolean
  errors: string[]
}

interface ReviewManifestSummary {
  districtId: string | null
  datasetHash: string | null
  datasetDir: string | null
  hhmm: string | null
}

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

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseNumberArg = (argv: string[], ...flags: string[]) => {
  const value = getArgValue(argv, ...flags)
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flags[0]} must be a finite number`)
  }
  return parsed
}

export const parseWriteAnswerCasesArgs = (argv: string[]): WriteAnswerCasesArgs => ({
  inputPath: getArgValue(argv, '--input', '--review'),
  datasetDir: getArgValue(argv, '--datasetDir', '--dataset-dir'),
  outPath: getArgValue(argv, '--out', '--outPath', '--out-path'),
  districtId: getArgValue(argv, '--district', '--districtId', '--district-id'),
  hhmm: getArgValue(argv, '--hhmm'),
  searchRadiusMeters: parseNumberArg(argv, '--radius', '--searchRadiusMeters'),
  validate: !hasFlag(argv, '--no-validate'),
})

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getRecord = (record: Record<string, unknown>, key: string) =>
  toRecord(record[key])

const getStringValue = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const getString = (record: Record<string, unknown>, key: string) =>
  getStringValue(record[key])

const getCsvString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const exact = getStringValue(row[key])
    if (exact) {
      return exact
    }
    const matchingKey = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    )
    const caseInsensitive = matchingKey ? getStringValue(row[matchingKey]) : null
    if (caseInsensitive) {
      return caseInsensitive
    }
  }
  return null
}

const hasCsvKey = (row: Record<string, unknown>, keys: string[]) => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))
  return Object.keys(row).some((key) => normalizedKeys.has(key.toLowerCase()))
}

const getCsvNumber = (row: Record<string, unknown>, keys: string[]) => {
  const value = getCsvString(row, keys)
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const adjacentManifestPath = (inputPath: string) => {
  const ext = path.extname(inputPath)
  const basePath = ext ? inputPath.slice(0, -ext.length) : inputPath
  return `${basePath}.manifest.json`
}

const loadReviewManifest = async (inputPath: string): Promise<ReviewManifestSummary> => {
  try {
    const manifestPath = adjacentManifestPath(inputPath)
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as unknown
    const record = toRecord(parsed)
    const dataset = getRecord(record, 'dataset')
    const params = getRecord(record, 'params')
    return {
      districtId: getString(record, 'districtId') ?? getString(dataset, 'districtId'),
      datasetHash: getString(dataset, 'datasetHash'),
      datasetDir: getString(dataset, 'baseDir'),
      hhmm: getString(params, 'hhmm'),
    }
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'ENOENT') {
      return {
        districtId: null,
        datasetHash: null,
        datasetDir: null,
        hhmm: null,
      }
    }
    throw error
  }
}

const loadDatasetMeta = async (datasetDir: string) => {
  const parsed = JSON.parse(
    await fs.readFile(path.resolve(datasetDir, 'dataset_meta.json'), 'utf-8'),
  ) as unknown
  const record = toRecord(parsed)
  return {
    districtId: getString(record, 'districtId'),
    datasetHash: getString(record, 'datasetHash'),
  }
}

const normalizeStatus = (value: string | null) => value?.trim().toUpperCase() ?? ''

const expectedKindForStatus = (status: string) => {
  if (status === 'LEGAL') {
    return 'PARK' as const
  }
  if (status === 'ILLEGAL') {
    return 'NO_STOP' as const
  }
  return null
}

const getReviewStatus = (row: Record<string, unknown>) => {
  const reviewStatusKeys = ['reviewStatus', 'status', 'overrideStatus']
  if (hasCsvKey(row, reviewStatusKeys)) {
    return getCsvString(row, reviewStatusKeys)
  }
  return getCsvString(row, ['signOverrideStatus'])
}

const isFinalConfidence = (
  value: string | null,
): value is NonNullable<SmokeExactParkingAnswerCase['expectedFinalConfidence']> =>
  value === 'HIGH' || value === 'MEDIUM' || value === 'LOW'

const buildCaseId = (
  districtId: string,
  status: string,
  segmentId: string,
  seen: Map<string, number>,
) => {
  const normalizedSegmentId =
    segmentId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'segment'
  const baseId = `${districtId}-reviewed-${status.toLowerCase()}-${normalizedSegmentId}`
  const next = seen.get(baseId) ?? 0
  seen.set(baseId, next + 1)
  return next === 0 ? baseId : `${baseId}-${next + 1}`
}

const buildReviewedAnswerCase = (params: {
  row: Record<string, unknown>
  districtId: string
  hhmm: string
  searchRadiusMeters: number
  seenCaseIds: Map<string, number>
}) => {
  const reviewStatus = normalizeStatus(getReviewStatus(params.row))
  const expectedKind = expectedKindForStatus(reviewStatus)
  if (!expectedKind) {
    return null
  }

  const rowDistrictId = getCsvString(params.row, ['districtId', 'district_id', 'district'])
  const segmentId = getCsvString(params.row, ['segmentId', 'segment_id', 'segment'])
  const lat = getCsvNumber(params.row, ['lat', 'latitude'])
  const lng = getCsvNumber(params.row, ['lon', 'lng', 'longitude'])
  if (rowDistrictId !== params.districtId || !segmentId || lat === null || lng === null) {
    return null
  }

  const parkingSpaceCount = getCsvNumber(params.row, [
    'parkingSpaceCount',
    'parking_spaces',
  ])
  const sourceType = getCsvString(params.row, ['sourceType', 'source_type'])?.toUpperCase()
  const expectedFinalConfidence = getCsvString(params.row, [
    'finalConfidence',
    'final_confidence',
  ])?.toUpperCase() ?? null
  const hasMarkedSpaces = parkingSpaceCount !== null && parkingSpaceCount > 0
  const isInferred = sourceType === 'INFERRED'
  const evidenceLabel = hasMarkedSpaces
    ? 'with marked-space evidence'
    : isInferred
      ? 'from inferred curb candidate'
      : 'from curb-rule evidence'
  const answerCase: SmokeExactParkingAnswerCase = {
    id: buildCaseId(params.districtId, reviewStatus, segmentId, params.seenCaseIds),
    label: `Reviewed ${reviewStatus === 'LEGAL' ? 'legal parking' : 'no-stop'} answer ${evidenceLabel}`,
    lng,
    lat,
    hhmm: params.hhmm,
    searchRadiusMeters: params.searchRadiusMeters,
    expectedKind,
    expectedEvidenceKind: hasMarkedSpaces ? 'MARKED_SPACE' : isInferred ? 'INFERRED' : 'CURB_RULE',
    expectedPrimarySegmentId: segmentId,
    ...(isFinalConfidence(expectedFinalConfidence) ? { expectedFinalConfidence } : {}),
    ...(hasMarkedSpaces ? { minParkingSpaceCount: parkingSpaceCount } : {}),
    ...(isInferred ? { includeInferred: true } : {}),
  }
  return answerCase
}

export const buildAnswerCasesFromReviewRows = (params: {
  rows: Record<string, unknown>[]
  districtId: string
  hhmm: string
  searchRadiusMeters: number
}) => {
  const seenCaseIds = new Map<string, number>()
  return params.rows
    .map((row) =>
      buildReviewedAnswerCase({
        row,
        districtId: params.districtId,
        hhmm: params.hhmm,
        searchRadiusMeters: params.searchRadiusMeters,
        seenCaseIds,
      }),
    )
    .filter((answerCase): answerCase is SmokeExactParkingAnswerCase => Boolean(answerCase))
}

const readReviewRows = async (inputPath: string) =>
  parseCsv(await fs.readFile(inputPath, 'utf-8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]

const writeValidatedCasesFile = async (params: {
  outPath: string
  serialized: string
  datasetDir: string
  hhmm: string
  searchRadiusMeters: number
  validate: boolean
}) => {
  await fs.mkdir(path.dirname(params.outPath), { recursive: true })
  if (!params.validate) {
    await fs.writeFile(params.outPath, params.serialized, 'utf-8')
    return
  }

  const tempPath = `${params.outPath}.tmp-${process.pid}-${Date.now()}`
  try {
    await fs.writeFile(tempPath, params.serialized, 'utf-8')
    await runSmokeExactParkingAnswers({
      datasetDir: params.datasetDir,
      hhmm: params.hhmm,
      searchRadiusMeters: params.searchRadiusMeters,
      minParkAnswers: 0,
      minNoStopAnswers: 0,
      minMarkedSpaceParkAnswers: 0,
      casesPath: tempPath,
    })
    await fs.copyFile(tempPath, params.outPath)
  } finally {
    await fs.unlink(tempPath).catch(() => undefined)
  }
}

export const writeAnswerCases = async (
  params: WriteAnswerCasesParams,
): Promise<WriteAnswerCasesResult> => {
  const inputPath = path.resolve(params.inputPath)
  const manifest = await loadReviewManifest(inputPath)
  const districtId = params.districtId?.trim() || manifest.districtId
  if (!districtId) {
    return {
      pass: false,
      inputPath,
      datasetDir: '',
      outPath: '',
      districtId: '',
      datasetHash: '',
      casesWritten: 0,
      validated: false,
      errors: ['District id is required when the review manifest does not provide one.'],
    }
  }

  const datasetDir = path.resolve(
    params.datasetDir ?? manifest.datasetDir ?? path.join('public', 'data', 'generated', districtId),
  )
  const datasetMeta = await loadDatasetMeta(datasetDir)
  const datasetHash = datasetMeta.datasetHash ?? manifest.datasetHash
  if (!datasetHash) {
    return {
      pass: false,
      inputPath,
      datasetDir,
      outPath: '',
      districtId,
      datasetHash: '',
      casesWritten: 0,
      validated: false,
      errors: [`datasetHash is missing from ${path.join(datasetDir, 'dataset_meta.json')}.`],
    }
  }
  if (datasetMeta.districtId && datasetMeta.districtId !== districtId) {
    return {
      pass: false,
      inputPath,
      datasetDir,
      outPath: '',
      districtId,
      datasetHash,
      casesWritten: 0,
      validated: false,
      errors: [`Dataset district ${datasetMeta.districtId} does not match ${districtId}.`],
    }
  }

  const hhmm = params.hhmm?.trim() || manifest.hhmm || DEFAULT_HHMM
  const searchRadiusMeters = params.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
  const rows = await readReviewRows(inputPath)
  const cases = buildAnswerCasesFromReviewRows({
    rows,
    districtId,
    hhmm,
    searchRadiusMeters,
  })
  const outPath = path.resolve(
    params.outPath ?? path.join('configs', 'prod', `${districtId}.answer-cases.json`),
  )
  if (cases.length === 0) {
    return {
      pass: false,
      inputPath,
      datasetDir,
      outPath,
      districtId,
      datasetHash,
      casesWritten: 0,
      validated: false,
      errors: ['No reviewed LEGAL/ILLEGAL rows with districtId, segmentId, lat, and lon were found.'],
    }
  }

  const payload = {
    schemaVersion: 1,
    districtId,
    datasetHash,
    cases,
  }
  const serialized = `${JSON.stringify(payload, null, 2)}\n`
  try {
    await writeValidatedCasesFile({
      outPath,
      serialized,
      datasetDir,
      hhmm,
      searchRadiusMeters,
      validate: params.validate ?? true,
    })
  } catch (error) {
    return {
      pass: false,
      inputPath,
      datasetDir,
      outPath,
      districtId,
      datasetHash,
      casesWritten: cases.length,
      validated: false,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }

  return {
    pass: true,
    inputPath,
    datasetDir,
    outPath,
    districtId,
    datasetHash,
    casesWritten: cases.length,
    validated: params.validate ?? true,
    errors: [],
  }
}

export const formatWriteAnswerCases = (result: WriteAnswerCasesResult) =>
  [
    `Answer cases: ${result.pass ? 'PASS' : 'FAIL'}`,
    `Input: ${result.inputPath}`,
    `Dataset: ${result.datasetDir || '-'}`,
    `Output: ${result.outPath || '-'}`,
    `District: ${result.districtId || '-'}`,
    `Dataset hash: ${result.datasetHash || '-'}`,
    `Cases written: ${result.casesWritten}`,
    `Validated: ${result.validated ? 'yes' : 'no'}`,
    ...result.errors.map((error) => `ERROR: ${error}`),
  ].join('\n')

const run = async () => {
  const args = parseWriteAnswerCasesArgs(process.argv)
  if (!args.inputPath) {
    throw new Error('--input is required')
  }
  const result = await writeAnswerCases({
    inputPath: args.inputPath,
    datasetDir: args.datasetDir,
    outPath: args.outPath,
    districtId: args.districtId,
    hhmm: args.hhmm,
    searchRadiusMeters: args.searchRadiusMeters,
    validate: args.validate,
  })
  console.log(formatWriteAnswerCases(result))
  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
