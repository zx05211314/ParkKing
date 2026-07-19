import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { EvaluatedSegment, AllowedAction } from '../../src/ui/types'
import {
  buildParkingAnswer,
  type ParkingAnswer,
  type ParkingAnswerEvidenceKind,
  type ParkingAnswerOptions,
} from '../../src/domain/answers/parkingAnswer'
import { getPathMidpoint } from '../../src/map/geo'
import {
  isDaytime,
  isSameParkingTimeMode,
} from '../../src/domain/rules/time'
import { loadEvaluatedSegmentsForAnswer } from './queryParkingAnswer'
import { resolveReviewedCaseHashMismatchAllowance } from './reviewedCaseHashMismatch'

export interface SmokeExactParkingAnswersOptions {
  datasetDir?: string
  hhmm?: string
  searchRadiusMeters?: number
  minParkAnswers?: number
  minNoStopAnswers?: number
  minMarkedSpaceParkAnswers?: number
  casesPath?: string
  allowUnpinnedCases?: boolean
  allowMismatchedCaseHash?: boolean
}

export interface SmokeExactParkingAnswerSample {
  sampleKind: 'PARK' | 'NO_STOP' | 'MARKED_SPACE_PARK'
  expectedKind: AllowedAction
  answerKind: ParkingAnswer['kind']
  sourceSegmentId: string
  primarySegmentId: string | null
  primaryName: string | null
  primaryFinalConfidence: EvaluatedSegment['finalConfidence'] | null
  location: [number, number]
  distanceMeters: number | null
  evidenceKind: ParkingAnswerEvidenceKind
  evidenceLabel: string
  parkingSpaceCount: number
  caveats: string[]
}

export interface SmokeExactParkingAnswerCase {
  id: string
  label?: string
  coverageAreaId?: string
  lng: number
  lat: number
  hhmm?: string
  searchRadiusMeters?: number
  expectedKind: ParkingAnswer['kind']
  expectedEvidenceKind?: ParkingAnswerEvidenceKind
  expectedPrimarySegmentId?: string
  expectedFinalConfidence?: EvaluatedSegment['finalConfidence']
  minParkingSpaceCount?: number
  includeInferred?: boolean
}

export interface SmokeExactParkingAnswerCaseFile {
  schemaVersion?: number
  districtId?: string
  datasetHash?: string
  cases: SmokeExactParkingAnswerCase[]
}

export interface SmokeExactParkingAnswerCaseResult {
  id: string
  label: string | null
  hhmm: string
  location: [number, number]
  searchRadiusMeters: number
  expectedKind: ParkingAnswer['kind']
  answerKind: ParkingAnswer['kind']
  expectedEvidenceKind: ParkingAnswerEvidenceKind | null
  evidenceKind: ParkingAnswerEvidenceKind
  expectedPrimarySegmentId: string | null
  primarySegmentId: string | null
  distanceMeters: number | null
  parkingSpaceCount: number
  pass: boolean
  errors: string[]
}

export interface SmokeExactParkingAnswersSummary {
  datasetDir: string
  datasetHash: string
  hhmm: string
  searchRadiusMeters: number
  evaluatedCount: number
  samples: SmokeExactParkingAnswerSample[]
  casesPath?: string | null
  caseResults?: SmokeExactParkingAnswerCaseResult[]
  counts: {
    parkAnswers: number
    noStopAnswers: number
    markedSpaceParkAnswers: number
  }
}

const DEFAULT_DATASET_DIR = 'public/data/generated/xinyi'
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

const parseNumericArg = (argv: string[], ...flags: string[]) => {
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

export const parseSmokeExactParkingAnswersArgs = (
  argv: string[],
): SmokeExactParkingAnswersOptions => ({
  datasetDir:
    getArgValue(argv, '--datasetDir', '--dataset-dir') ?? DEFAULT_DATASET_DIR,
  hhmm: getArgValue(argv, '--hhmm') ?? DEFAULT_HHMM,
  searchRadiusMeters:
    parseNumericArg(argv, '--radius', '--searchRadiusMeters') ??
    DEFAULT_SEARCH_RADIUS_METERS,
  minParkAnswers: parseNumericArg(argv, '--minParkAnswers'),
  minNoStopAnswers: parseNumericArg(argv, '--minNoStopAnswers'),
  minMarkedSpaceParkAnswers: parseNumericArg(
    argv,
    '--minMarkedSpaceParkAnswers',
  ),
  casesPath: getArgValue(argv, '--cases', '--casesPath', '--cases-path') ?? undefined,
  allowUnpinnedCases: hasFlag(
    argv,
    '--allow-unpinned-cases',
    '--allowUnpinnedCases',
  ),
  allowMismatchedCaseHash: hasFlag(
    argv,
    '--allow-mismatched-case-hash',
    '--allowMismatchedCaseHash',
  )
    ? true
    : undefined,
})

const makeSample = (
  sampleKind: SmokeExactParkingAnswerSample['sampleKind'],
  expectedKind: AllowedAction,
  source: EvaluatedSegment,
  answer: ParkingAnswer,
  location: [number, number],
): SmokeExactParkingAnswerSample => ({
  sampleKind,
  expectedKind,
  answerKind: answer.kind,
  sourceSegmentId: source.id,
  primarySegmentId: answer.primary?.id ?? null,
  primaryName: answer.primary?.name ?? null,
  primaryFinalConfidence: answer.primary?.finalConfidence ?? null,
  location,
  distanceMeters: answer.primary?.distanceMeters ?? null,
  evidenceKind: answer.evidence.kind,
  evidenceLabel: answer.evidence.label,
  parkingSpaceCount: answer.evidence.parkingSpaceCount,
  caveats: answer.caveats,
})

const collectSamples = (params: {
  segments: EvaluatedSegment[]
  sampleKind: SmokeExactParkingAnswerSample['sampleKind']
  expectedKind: AllowedAction
  minCount: number
  searchRadiusMeters: number
  sourceFilter: (segment: EvaluatedSegment) => boolean
  answerFilter?: (answer: ParkingAnswer) => boolean
  answerOptions?: ParkingAnswerOptions
}) => {
  if (params.minCount <= 0) {
    return []
  }

  const samples: SmokeExactParkingAnswerSample[] = []
  const seenPrimaryIds = new Set<string>()

  for (const segment of params.segments) {
    if (!params.sourceFilter(segment)) {
      continue
    }

    const location = getPathMidpoint(segment.path)
    const answer = buildParkingAnswer(params.segments, location, {
      ...params.answerOptions,
      searchRadiusMeters: params.searchRadiusMeters,
      includeInferred: false,
      maxAlternatives: 0,
    })
    const primaryId = answer.primary?.id ?? null
    if (
      answer.kind !== params.expectedKind ||
      !primaryId ||
      seenPrimaryIds.has(primaryId) ||
      (params.answerFilter && !params.answerFilter(answer))
    ) {
      continue
    }

    seenPrimaryIds.add(primaryId)
    samples.push(
      makeSample(params.sampleKind, params.expectedKind, segment, answer, location),
    )
    if (samples.length >= params.minCount) {
      break
    }
  }

  return samples
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' && record[key].trim().length > 0
    ? record[key].trim()
    : null

const getNumber = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : null

const getBoolean = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'boolean' ? record[key] : undefined

const isParkingAnswerKind = (value: string): value is ParkingAnswer['kind'] =>
  value === 'PARK' ||
  value === 'TEMP_STOP' ||
  value === 'NO_STOP' ||
  value === 'NO_DATA'

const isEvidenceKind = (value: string): value is ParkingAnswerEvidenceKind =>
  value === 'MARKED_SPACE' ||
  value === 'CURB_RULE' ||
  value === 'INFERRED' ||
  value === 'NO_DATA'

const parseFinalConfidence = (
  value: string | null,
): EvaluatedSegment['finalConfidence'] | null => {
  if (value === null) {
    return null
  }
  if (value === 'MEDIUM') {
    return 'MED'
  }
  if (value === 'HIGH' || value === 'MED' || value === 'LOW') {
    return value
  }
  return null
}

const parseCase = (
  rawCase: unknown,
  index: number,
): SmokeExactParkingAnswerCase => {
  const record = toRecord(rawCase)
  const id = getString(record, 'id')
  const lng = getNumber(record, 'lng') ?? getNumber(record, 'lon')
  const lat = getNumber(record, 'lat')
  const expectedKind = getString(record, 'expectedKind')
  const rawExpectedEvidenceKind = getString(record, 'expectedEvidenceKind')
  const expectedEvidenceKind =
    rawExpectedEvidenceKind && isEvidenceKind(rawExpectedEvidenceKind)
      ? rawExpectedEvidenceKind
      : null
  const rawExpectedFinalConfidence = getString(record, 'expectedFinalConfidence')
  const expectedFinalConfidence = parseFinalConfidence(rawExpectedFinalConfidence)

  if (!id) {
    throw new Error(`answer case ${index + 1}: id is required`)
  }
  if (lng === null || lat === null) {
    throw new Error(`answer case ${id}: lng/lon and lat are required`)
  }
  if (!expectedKind || !isParkingAnswerKind(expectedKind)) {
    throw new Error(
      `answer case ${id}: expectedKind must be PARK, TEMP_STOP, NO_STOP, or NO_DATA`,
    )
  }
  if (rawExpectedEvidenceKind && !expectedEvidenceKind) {
    throw new Error(
      `answer case ${id}: expectedEvidenceKind must be MARKED_SPACE, CURB_RULE, INFERRED, or NO_DATA`,
    )
  }
  if (rawExpectedFinalConfidence && !expectedFinalConfidence) {
    throw new Error(
      `answer case ${id}: expectedFinalConfidence must be HIGH, MED, MEDIUM, or LOW`,
    )
  }

  return {
    id,
    label: getString(record, 'label') ?? undefined,
    coverageAreaId: getString(record, 'coverageAreaId') ?? undefined,
    lng,
    lat,
    hhmm: getString(record, 'hhmm') ?? undefined,
    searchRadiusMeters: getNumber(record, 'searchRadiusMeters') ?? undefined,
    expectedKind,
    expectedEvidenceKind: expectedEvidenceKind ?? undefined,
    expectedPrimarySegmentId: getString(record, 'expectedPrimarySegmentId') ?? undefined,
    expectedFinalConfidence: expectedFinalConfidence ?? undefined,
    minParkingSpaceCount: getNumber(record, 'minParkingSpaceCount') ?? undefined,
    includeInferred: getBoolean(record, 'includeInferred'),
  }
}

export const loadSmokeExactParkingAnswerCases = async (
  casesPath: string,
): Promise<SmokeExactParkingAnswerCaseFile> => {
  const parsed = JSON.parse(await fs.readFile(casesPath, 'utf-8')) as unknown
  const record = toRecord(parsed)
  const rawCases = record.cases
  if (!Array.isArray(rawCases)) {
    throw new Error(`Answer cases file must contain a cases array: ${casesPath}`)
  }

  return {
    schemaVersion: getNumber(record, 'schemaVersion') ?? undefined,
    districtId: getString(record, 'districtId') ?? undefined,
    datasetHash: getString(record, 'datasetHash') ?? undefined,
    cases: rawCases.map((entry, index) => parseCase(entry, index)),
  }
}

const buildCaseResult = (params: {
  answerCase: SmokeExactParkingAnswerCase
  answer: ParkingAnswer
  hhmm: string
  searchRadiusMeters: number
}): SmokeExactParkingAnswerCaseResult => {
  const errors: string[] = []
  const { answerCase, answer } = params
  const primarySegmentId = answer.primary?.id ?? null
  const distanceMeters = answer.primary?.distanceMeters ?? null

  if (answer.kind !== answerCase.expectedKind) {
    errors.push(`expected kind ${answerCase.expectedKind}, got ${answer.kind}`)
  }
  if (
    answerCase.expectedEvidenceKind &&
    answer.evidence.kind !== answerCase.expectedEvidenceKind
  ) {
    errors.push(
      `expected evidence ${answerCase.expectedEvidenceKind}, got ${answer.evidence.kind}`,
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
    answer.primary?.finalConfidence !== answerCase.expectedFinalConfidence
  ) {
    errors.push(
      `expected confidence ${answerCase.expectedFinalConfidence}, got ${answer.primary?.finalConfidence ?? 'none'}`,
    )
  }
  if (
    answerCase.minParkingSpaceCount !== undefined &&
    answer.evidence.parkingSpaceCount < answerCase.minParkingSpaceCount
  ) {
    errors.push(
      `expected at least ${answerCase.minParkingSpaceCount} parking spaces, got ${answer.evidence.parkingSpaceCount}`,
    )
  }

  return {
    id: answerCase.id,
    label: answerCase.label ?? null,
    hhmm: params.hhmm,
    location: [answerCase.lng, answerCase.lat],
    searchRadiusMeters: params.searchRadiusMeters,
    expectedKind: answerCase.expectedKind,
    answerKind: answer.kind,
    expectedEvidenceKind: answerCase.expectedEvidenceKind ?? null,
    evidenceKind: answer.evidence.kind,
    expectedPrimarySegmentId: answerCase.expectedPrimarySegmentId ?? null,
    primarySegmentId,
    distanceMeters,
    parkingSpaceCount: answer.evidence.parkingSpaceCount,
    pass: errors.length === 0,
    errors,
  }
}

const oppositeParkingTimeModeHhmm = (reviewedHhmm: string) =>
  isDaytime(reviewedHhmm) ? '21:00' : '13:00'

export const validateReviewedOverrideScope = (params: {
  answerCase: SmokeExactParkingAnswerCase
  caseHhmm: string
  activeSegments: EvaluatedSegment[]
  inactiveSegments: EvaluatedSegment[]
}) => {
  const expectedSegmentId = params.answerCase.expectedPrimarySegmentId
  if (!expectedSegmentId) {
    return []
  }
  const activeTarget = params.activeSegments.find(
    (segment) => segment.id === expectedSegmentId,
  )
  const override = activeTarget?.signOverride
  if (
    !activeTarget ||
    !override?.reviewedSegmentId ||
    !override.reviewedHhmm
  ) {
    return []
  }

  const errors: string[] = []
  if (override.reviewedSegmentId !== expectedSegmentId) {
    errors.push(
      `reviewed override target ${override.reviewedSegmentId} does not match answer case target ${expectedSegmentId}`,
    )
  }
  if (!isSameParkingTimeMode(override.reviewedHhmm, params.caseHhmm)) {
    errors.push(
      `answer case time ${params.caseHhmm} is outside reviewed context ${override.reviewedHhmm}`,
    )
  }
  if (!activeTarget.reasonCodes.includes('OVERRIDE_APPLIED')) {
    errors.push('reviewed override was not applied in its approved time context')
  }

  const inactiveTarget = params.inactiveSegments.find(
    (segment) => segment.id === expectedSegmentId,
  )
  if (inactiveTarget?.reasonCodes.includes('OVERRIDE_APPLIED')) {
    errors.push('reviewed override leaked outside its approved time context')
  }

  if (/-part-\d+$/i.test(override.reviewedSegmentId)) {
    const baseId = override.reviewedSegmentId.replace(/-part-\d+$/i, '')
    const pollutedSibling = params.activeSegments.find(
      (segment) =>
        segment.id !== override.reviewedSegmentId &&
        segment.id.startsWith(`${baseId}-part-`) &&
        segment.reasonCodes.includes('OVERRIDE_APPLIED'),
    )
    if (pollutedSibling) {
      errors.push(`reviewed override leaked to sibling ${pollutedSibling.id}`)
    }
  }

  return errors
}

export const buildSmokeExactParkingAnswersSummary = (params: {
  datasetDir: string
  datasetHash: string
  hhmm: string
  segments: EvaluatedSegment[]
  searchRadiusMeters: number
  minParkAnswers: number
  minNoStopAnswers: number
  minMarkedSpaceParkAnswers: number
  casesPath?: string | null
  caseResults?: SmokeExactParkingAnswerCaseResult[]
  reviewedSignOverridesCount?: number | null
  appliedSignOverridesCount?: number | null
}): SmokeExactParkingAnswersSummary => {
  const answerOptions: ParkingAnswerOptions = {
    reviewedSignOverridesCount: params.reviewedSignOverridesCount ?? null,
    appliedSignOverridesCount: params.appliedSignOverridesCount ?? null,
  }
  const parkSamples = collectSamples({
    segments: params.segments,
    sampleKind: 'PARK',
    expectedKind: 'PARK',
    minCount: params.minParkAnswers,
    searchRadiusMeters: params.searchRadiusMeters,
    sourceFilter: (segment) => segment.allowedNow === 'PARK',
    answerOptions,
  })
  const noStopSamples = collectSamples({
    segments: params.segments,
    sampleKind: 'NO_STOP',
    expectedKind: 'NO_STOP',
    minCount: params.minNoStopAnswers,
    searchRadiusMeters: params.searchRadiusMeters,
    sourceFilter: (segment) => segment.allowedNow === 'NO_STOP',
    answerOptions,
  })
  const markedSpaceParkSamples = collectSamples({
    segments: params.segments,
    sampleKind: 'MARKED_SPACE_PARK',
    expectedKind: 'PARK',
    minCount: params.minMarkedSpaceParkAnswers,
    searchRadiusMeters: params.searchRadiusMeters,
    sourceFilter: (segment) =>
      segment.allowedNow === 'PARK' && (segment.parkingSpaceCount ?? 0) > 0,
    answerFilter: (answer) => answer.evidence.kind === 'MARKED_SPACE',
    answerOptions,
  })

  return {
    datasetDir: params.datasetDir,
    datasetHash: params.datasetHash,
    hhmm: params.hhmm,
    searchRadiusMeters: params.searchRadiusMeters,
    evaluatedCount: params.segments.length,
    samples: [...parkSamples, ...noStopSamples, ...markedSpaceParkSamples],
    casesPath: params.casesPath ?? null,
    caseResults: params.caseResults ?? [],
    counts: {
      parkAnswers: parkSamples.length,
      noStopAnswers: noStopSamples.length,
      markedSpaceParkAnswers: markedSpaceParkSamples.length,
    },
  }
}

export const validateSmokeExactParkingAnswersSummary = (
  summary: SmokeExactParkingAnswersSummary,
  thresholds: Required<
    Pick<
      SmokeExactParkingAnswersOptions,
      'minParkAnswers' | 'minNoStopAnswers' | 'minMarkedSpaceParkAnswers'
    >
  >,
) => {
  const errors: string[] = []
  if (summary.counts.parkAnswers < thresholds.minParkAnswers) {
    errors.push(
      `exact PARK answers ${summary.counts.parkAnswers} below required ${thresholds.minParkAnswers}`,
    )
  }
  if (summary.counts.noStopAnswers < thresholds.minNoStopAnswers) {
    errors.push(
      `exact NO_STOP answers ${summary.counts.noStopAnswers} below required ${thresholds.minNoStopAnswers}`,
    )
  }
  if (
    summary.counts.markedSpaceParkAnswers <
    thresholds.minMarkedSpaceParkAnswers
  ) {
    errors.push(
      `marked-space-backed exact PARK answers ${summary.counts.markedSpaceParkAnswers} below required ${thresholds.minMarkedSpaceParkAnswers}`,
    )
  }
  ;(summary.caseResults ?? [])
    .filter((result) => !result.pass)
    .forEach((result) => {
      errors.push(`answer case ${result.id} failed: ${result.errors.join('; ')}`)
    })
  return errors
}

export const renderSmokeExactParkingAnswersSummary = (
  summary: SmokeExactParkingAnswersSummary,
) => {
  const sampleLines = summary.samples.map((sample) => {
    const distance =
      sample.distanceMeters === null ? '-' : `${Math.round(sample.distanceMeters)}m`
    const caveats =
      sample.caveats.length > 0 ? `; caveats ${sample.caveats.join(' | ')}` : ''
    return `${sample.sampleKind}: ${sample.answerKind} at ${sample.location[0]},${sample.location[1]} via ${sample.primarySegmentId ?? '-'} (${distance}); confidence ${sample.primaryFinalConfidence ?? '-'}; evidence ${sample.evidenceKind}${caveats}`
  })
  const caseResults = summary.caseResults ?? []
  const caseLines =
    caseResults.length === 0
      ? []
      : [
          `Answer cases: ${caseResults.filter((result) => result.pass).length}/${caseResults.length} passed${summary.casesPath ? ` from ${summary.casesPath}` : ''}`,
          ...caseResults.map((result) => {
            const distance =
              result.distanceMeters === null
                ? '-'
                : `${Math.round(result.distanceMeters)}m`
            const status = result.pass ? 'PASS' : `FAIL ${result.errors.join(' | ')}`
            return `CASE ${result.id}: ${status}; expected ${result.expectedKind}, got ${result.answerKind}; primary ${result.primarySegmentId ?? '-'} (${distance}); evidence ${result.evidenceKind}`
          }),
        ]

  return [
    `Exact parking answer summary: ${summary.datasetDir}`,
    `Dataset hash: ${summary.datasetHash}`,
    `Time: ${summary.hhmm}`,
    `Evaluated segments: ${summary.evaluatedCount}`,
    `Counts: PARK ${summary.counts.parkAnswers}, NO_STOP ${summary.counts.noStopAnswers}, MARKED_SPACE_PARK ${summary.counts.markedSpaceParkAnswers}`,
    ...sampleLines,
    ...caseLines,
  ].join('\n')
}

export const runSmokeExactParkingAnswers = async (
  options: SmokeExactParkingAnswersOptions = {},
) => {
  const datasetDir = options.datasetDir ?? DEFAULT_DATASET_DIR
  const hhmm = options.hhmm ?? DEFAULT_HHMM
  const searchRadiusMeters =
    options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
  const thresholds = {
    minParkAnswers: options.minParkAnswers ?? 1,
    minNoStopAnswers: options.minNoStopAnswers ?? 1,
    minMarkedSpaceParkAnswers: options.minMarkedSpaceParkAnswers ?? 1,
  }
  const {
    datasetHash,
    segments,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
  } = await loadEvaluatedSegmentsForAnswer(datasetDir, hhmm)
  const caseFile = options.casesPath
    ? await loadSmokeExactParkingAnswerCases(options.casesPath)
    : null
  const allowMismatchedCaseHash =
    resolveReviewedCaseHashMismatchAllowance(options.allowMismatchedCaseHash)
  if (caseFile && !caseFile.datasetHash && !options.allowUnpinnedCases) {
    throw new Error(
      [
        `Answer cases file must include datasetHash: ${options.casesPath}`,
        'Regenerate it with ops:write-answer-cases, or pass --allow-unpinned-cases for local debugging only.',
      ].join('\n'),
    )
  }
  if (
    caseFile?.datasetHash &&
    caseFile.datasetHash !== datasetHash &&
    !allowMismatchedCaseHash
  ) {
    throw new Error(
      `Answer cases datasetHash ${caseFile.datasetHash} does not match runtime datasetHash ${datasetHash}`,
    )
  }
  const loadedByHhmm = new Map<
    string,
    Awaited<ReturnType<typeof loadEvaluatedSegmentsForAnswer>>
  >([[hhmm, { datasetHash, segments, reviewedSignOverridesCount, appliedSignOverridesCount }]])
  const getLoadedForHhmm = async (caseHhmm: string) => {
    const cached = loadedByHhmm.get(caseHhmm)
    if (cached) {
      return cached
    }
    const loaded = await loadEvaluatedSegmentsForAnswer(datasetDir, caseHhmm)
    loadedByHhmm.set(caseHhmm, loaded)
    return loaded
  }
  const caseResults: SmokeExactParkingAnswerCaseResult[] = []
  for (const answerCase of caseFile?.cases ?? []) {
    const caseHhmm = answerCase.hhmm ?? hhmm
    const caseRadius = answerCase.searchRadiusMeters ?? searchRadiusMeters
    const loaded = await getLoadedForHhmm(caseHhmm)
    const answer = buildParkingAnswer(
      loaded.segments,
      [answerCase.lng, answerCase.lat],
      {
        searchRadiusMeters: caseRadius,
        includeInferred: answerCase.includeInferred ?? false,
        maxAlternatives: 0,
        reviewedSignOverridesCount: loaded.reviewedSignOverridesCount,
        appliedSignOverridesCount: loaded.appliedSignOverridesCount,
      },
    )
    const result = buildCaseResult({
      answerCase,
      answer,
      hhmm: caseHhmm,
      searchRadiusMeters: caseRadius,
    })
    const activeTarget = answerCase.expectedPrimarySegmentId
      ? loaded.segments.find(
          (segment) => segment.id === answerCase.expectedPrimarySegmentId,
        )
      : null
    if (
      activeTarget?.signOverride?.reviewedSegmentId &&
      activeTarget.signOverride.reviewedHhmm
    ) {
      const inactive = await getLoadedForHhmm(
        oppositeParkingTimeModeHhmm(activeTarget.signOverride.reviewedHhmm),
      )
      result.errors.push(
        ...validateReviewedOverrideScope({
          answerCase,
          caseHhmm,
          activeSegments: loaded.segments,
          inactiveSegments: inactive.segments,
        }),
      )
      result.pass = result.errors.length === 0
    }
    caseResults.push(result)
  }
  const summary = buildSmokeExactParkingAnswersSummary({
    datasetDir,
    datasetHash,
    hhmm,
    segments,
    searchRadiusMeters,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
    casesPath: options.casesPath ?? null,
    caseResults,
    ...thresholds,
  })
  const errors = validateSmokeExactParkingAnswersSummary(summary, thresholds)
  if (errors.length > 0) {
    throw new Error(
      [
        'Exact parking answer smoke failed:',
        ...errors,
        '',
        renderSmokeExactParkingAnswersSummary(summary),
      ].join('\n'),
    )
  }
  return summary
}

const run = async () => {
  const summary = await runSmokeExactParkingAnswers(
    parseSmokeExactParkingAnswersArgs(process.argv),
  )
  console.log('Exact parking answer smoke ok')
  console.log(renderSmokeExactParkingAnswersSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
