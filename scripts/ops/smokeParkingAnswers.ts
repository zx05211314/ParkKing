import { fileURLToPath } from 'node:url'
import { runBenchmark, type BenchmarkResult } from '../bench/benchEvaluate'

export interface SmokeParkingAnswersOptions {
  datasetDir?: string
  dayHHMM?: string
  nightHHMM?: string
  minSegments?: number
  minParkAnswers?: number
  minNoStopAnswers?: number
  minReasonCoveragePct?: number
}

export interface SmokeParkingAnswersSummary {
  datasetDir: string
  datasetHash: string
  dayHHMM: string
  nightHHMM: string
  segmentCount: number
  dayEvaluatedCount: number
  nightEvaluatedCount: number
  dayParkAnswers: number
  dayNoStopAnswers: number
  nightParkAnswers: number
  nightNoStopAnswers: number
  nightGreenParkAnswers: number
  nightYellowParkAnswers: number
  dayReasonCoveragePct: number
  nightReasonCoveragePct: number
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  if (index < 0) {
    return null
  }
  return argv[index + 1] ?? null
}

const getNumericArgValue = (argv: string[], flag: string) => {
  const value = getArgValue(argv, flag)
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a finite number`)
  }
  return parsed
}

const countAllowed = (
  result: BenchmarkResult,
  allowedNow: 'PARK' | 'NO_STOP',
) =>
  Object.entries(result.distribution).reduce((sum, [key, count]) => {
    const [, entryAllowedNow] = key.split('|')
    return entryAllowedNow === allowedNow ? sum + count : sum
  }, 0)

const countExact = (
  result: BenchmarkResult,
  tier: string,
  allowedNow: string,
) => result.distribution[`${tier}|${allowedNow}`] ?? 0

export const parseSmokeParkingAnswersArgs = (
  argv: string[],
): SmokeParkingAnswersOptions => ({
  datasetDir:
    getArgValue(argv, '--datasetDir')
    ?? getArgValue(argv, '--dataset-dir')
    ?? undefined,
  dayHHMM: getArgValue(argv, '--day') ?? undefined,
  nightHHMM: getArgValue(argv, '--night') ?? undefined,
  minSegments: getNumericArgValue(argv, '--minSegments') ?? undefined,
  minParkAnswers: getNumericArgValue(argv, '--minParkAnswers') ?? undefined,
  minNoStopAnswers: getNumericArgValue(argv, '--minNoStopAnswers') ?? undefined,
  minReasonCoveragePct:
    getNumericArgValue(argv, '--minReasonCoveragePct') ?? undefined,
})

export const buildSmokeParkingAnswersSummary = (params: {
  datasetDir: string
  day: BenchmarkResult
  night: BenchmarkResult
}): SmokeParkingAnswersSummary => ({
  datasetDir: params.datasetDir,
  datasetHash: params.night.datasetHash,
  dayHHMM: params.day.hhmm,
  nightHHMM: params.night.hhmm,
  segmentCount: params.night.counts.segments,
  dayEvaluatedCount: params.day.counts.evaluatedFirst,
  nightEvaluatedCount: params.night.counts.evaluatedFirst,
  dayParkAnswers: countAllowed(params.day, 'PARK'),
  dayNoStopAnswers: countAllowed(params.day, 'NO_STOP'),
  nightParkAnswers: countAllowed(params.night, 'PARK'),
  nightNoStopAnswers: countAllowed(params.night, 'NO_STOP'),
  nightGreenParkAnswers: countExact(params.night, 'GREEN', 'PARK'),
  nightYellowParkAnswers: countExact(params.night, 'YELLOW', 'PARK'),
  dayReasonCoveragePct: params.day.reasonCodes.coveragePct,
  nightReasonCoveragePct: params.night.reasonCodes.coveragePct,
})

export const validateSmokeParkingAnswersSummary = (
  summary: SmokeParkingAnswersSummary,
  options: Required<
    Pick<
      SmokeParkingAnswersOptions,
      | 'minSegments'
      | 'minParkAnswers'
      | 'minNoStopAnswers'
      | 'minReasonCoveragePct'
    >
  >,
) => {
  const errors: string[] = []
  if (summary.segmentCount < options.minSegments) {
    errors.push(
      `segments ${summary.segmentCount} below required ${options.minSegments}`,
    )
  }
  if (summary.nightParkAnswers < options.minParkAnswers) {
    errors.push(
      `night PARK answers ${summary.nightParkAnswers} below required ${options.minParkAnswers}`,
    )
  }
  if (summary.nightNoStopAnswers < options.minNoStopAnswers) {
    errors.push(
      `night NO_STOP answers ${summary.nightNoStopAnswers} below required ${options.minNoStopAnswers}`,
    )
  }
  if (summary.dayReasonCoveragePct < options.minReasonCoveragePct) {
    errors.push(
      `day reason coverage ${summary.dayReasonCoveragePct.toFixed(1)}% below required ${options.minReasonCoveragePct}%`,
    )
  }
  if (summary.nightReasonCoveragePct < options.minReasonCoveragePct) {
    errors.push(
      `night reason coverage ${summary.nightReasonCoveragePct.toFixed(1)}% below required ${options.minReasonCoveragePct}%`,
    )
  }
  return errors
}

export const renderSmokeParkingAnswersSummary = (
  summary: SmokeParkingAnswersSummary,
) =>
  [
    `Parking answer smoke ok: ${summary.datasetDir}`,
    `Dataset hash: ${summary.datasetHash}`,
    `Segments: ${summary.segmentCount}`,
    `Day ${summary.dayHHMM}: evaluated ${summary.dayEvaluatedCount}, PARK ${summary.dayParkAnswers}, NO_STOP ${summary.dayNoStopAnswers}, reason coverage ${summary.dayReasonCoveragePct.toFixed(1)}%`,
    `Night ${summary.nightHHMM}: evaluated ${summary.nightEvaluatedCount}, PARK ${summary.nightParkAnswers} (GREEN ${summary.nightGreenParkAnswers}, YELLOW ${summary.nightYellowParkAnswers}), NO_STOP ${summary.nightNoStopAnswers}, reason coverage ${summary.nightReasonCoveragePct.toFixed(1)}%`,
  ].join('\n')

export const runSmokeParkingAnswers = async (
  options: SmokeParkingAnswersOptions = {},
) => {
  const datasetDir = options.datasetDir ?? 'public/data/generated/xinyi'
  const dayHHMM = options.dayHHMM ?? '13:00'
  const nightHHMM = options.nightHHMM ?? '21:00'
  const thresholds = {
    minSegments: options.minSegments ?? 1,
    minParkAnswers: options.minParkAnswers ?? 1,
    minNoStopAnswers: options.minNoStopAnswers ?? 1,
    minReasonCoveragePct: options.minReasonCoveragePct ?? 1,
  }
  const [day, night] = await Promise.all([
    runBenchmark(datasetDir, dayHHMM),
    runBenchmark(datasetDir, nightHHMM),
  ])
  const summary = buildSmokeParkingAnswersSummary({ datasetDir, day, night })
  const errors = validateSmokeParkingAnswersSummary(summary, thresholds)
  if (errors.length > 0) {
    throw new Error(`Parking answer smoke failed:\n${errors.join('\n')}`)
  }
  return summary
}

const run = async () => {
  const summary = await runSmokeParkingAnswers(
    parseSmokeParkingAnswersArgs(process.argv),
  )
  console.log(renderSmokeParkingAnswersSummary(summary))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
