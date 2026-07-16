import type { RiskMode } from '../../src/domain/ranking/policy'
import type { CliArgs } from './sampleQaCandidateTypes'
import {
  DEFAULT_CONFIG_ROOT,
  DEFAULT_RADIUS_METERS,
  DEFAULT_QA_HHMM,
  DEFAULT_TOP_N,
  type QaCandidateStrategy,
} from './sampleQaCandidateTypes'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const parseArgValues = (argv: string[], ...flags: string[]) => {
  const values: string[] = []
  argv.forEach((arg, index) => {
    if (flags.includes(arg) && argv[index + 1]) {
      values.push(argv[index + 1])
    }
  })
  return values
}

const parseDatasetRoots = (argv: string[]) => {
  const values = parseArgValues(
    argv,
    '--dataset-root',
    '--datasetRoot',
    '--dataset-roots',
    '--datasetRoots',
  )
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

const parseRequiredSegmentIds = (argv: string[]) => {
  const values = parseArgValues(
    argv,
    '--include-segment',
    '--includeSegment',
    '--segment-id',
    '--segmentId',
  )
  return [...new Set(
    values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean),
  )]
}

const parsePositiveNumber = (
  value: string | null,
  fallback: number,
  label: string,
  toInteger = false,
) => {
  if (value === null) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`)
  }
  return toInteger ? Math.max(1, Math.floor(parsed)) : parsed
}

const parseRiskMode = (value: string | null): RiskMode => {
  if (!value) {
    return 'NEUTRAL'
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'conservative') {
    return 'CONSERVATIVE'
  }
  if (normalized === 'neutral') {
    return 'NEUTRAL'
  }
  if (normalized === 'aggressive') {
    return 'AGGRESSIVE'
  }
  throw new Error('riskMode must be Conservative, Neutral, or Aggressive')
}

const parseStrategy = (value: string | null): QaCandidateStrategy => {
  if (!value) {
    return 'ranked'
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'ranked' || normalized === 'review') {
    return normalized
  }
  throw new Error('strategy must be ranked or review')
}

const parseHHMM = (value: string | null) => {
  if (!value) {
    return DEFAULT_QA_HHMM
  }
  const normalized = value.trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new Error('hhmm must use 24-hour HH:MM format')
  }
  return normalized
}

export const parseArgs = (argv: string[]): CliArgs => {
  const districtId = parseArgValue(argv, '--district')
  const all = argv.includes('--all')
  if ((districtId && all) || (!districtId && !all)) {
    throw new Error('Specify exactly one of --district <id> or --all')
  }

  const topNValue = parseArgValue(argv, '--topN') ?? parseArgValue(argv, '--count')
  const shuffle = argv.includes('--shuffle')
  const datasetRoots = parseDatasetRoots(argv)

  return {
    districtId,
    all,
    topN: parsePositiveNumber(topNValue, DEFAULT_TOP_N, 'topN', true),
    outPath: parseArgValue(argv, '--out'),
    manifestOutPath: parseArgValue(argv, '--manifestOut'),
    reviewDocOutPath:
      parseArgValue(argv, '--reviewDocOut') ?? parseArgValue(argv, '--docOut'),
    configRoot:
      parseArgValue(argv, '--config-root') ??
      parseArgValue(argv, '--configRoot') ??
      DEFAULT_CONFIG_ROOT,
    riskMode: parseRiskMode(parseArgValue(argv, '--riskMode')),
    radiusMeters: parsePositiveNumber(
      parseArgValue(argv, '--radius'),
      DEFAULT_RADIUS_METERS,
      'radius',
    ),
    datasetRoots,
    shuffle,
    seed: shuffle
      ? parsePositiveNumber(parseArgValue(argv, '--seed'), 1, 'seed', true)
      : 1,
    strategy: parseStrategy(parseArgValue(argv, '--strategy')),
    hhmm: parseHHMM(parseArgValue(argv, '--hhmm') ?? parseArgValue(argv, '--time')),
    requiredSegmentIds: parseRequiredSegmentIds(argv),
  }
}
