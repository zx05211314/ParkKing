import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../../src/data/segmentBuilder'
import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import {
  countParkingSpacesNearSegments,
  type ParkingSpaceCollection,
} from '../../src/data/parkingSpaces'
import { evaluateSegmentWithZones } from '../../src/domain/rules/evaluateSegment'
import { resetClipCacheStats } from '../../src/domain/geometry/clipCache'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../../src/domain/zones/makeZones'
import {
  buildZoneIndex,
  type ZoneIndex,
} from '../../src/domain/zones/zoneIndex'
import type { Zone } from '../../src/domain/zones/zoneTypes'
import type { RiskMode } from '../../src/domain/ranking/rank'
import type { EvaluatedSegment, Segment } from '../../src/ui/types'
import {
  buildParkingAnswer,
  buildParkingAnswerFromSegmentsWithStats,
  type ParkingAnswer,
  type ParkingAnswerOptions,
} from '../../src/domain/answers/parkingAnswer'
import {
  buildParkingAnswerTrustSummary,
  type ParkingAnswerTrustSummary,
} from '../../src/ui/parkingAnswerPresentation'

export interface QueryParkingAnswerOptions extends ParkingAnswerOptions {
  datasetDir?: string
  lng?: number
  lat?: number
  hhmm?: string
  json?: boolean
}

export interface QueryParkingAnswerResult {
  datasetDir: string
  datasetHash: string
  hhmm: string
  evaluatedCount: number
  answer: ParkingAnswer
  trustSummary: ParkingAnswerTrustSummary
}

export interface EvaluatedSegmentsForAnswer {
  datasetHash: string
  segments: EvaluatedSegment[]
  reviewedSignOverridesCount: number | null
  appliedSignOverridesCount: number | null
}

export interface PreparedSegmentsForAnswer {
  datasetHash: string
  segments: Segment[]
  zoneIndex: ZoneIndex | null
  reviewedSignOverridesCount: number | null
  appliedSignOverridesCount: number | null
}

export interface ParkingAnswerPreparedIndexFile {
  schemaVersion: 1
  districtId: string
  datasetHash: string
  zoneParamsVersion: string
  segments: Segment[]
  zones: Zone[]
  reviewedSignOverridesCount: number | null
  appliedSignOverridesCount: number | null
}

export type QueryParkingAnswerLoader = (
  datasetDir: string,
  hhmm: string,
) => Promise<EvaluatedSegmentsForAnswer>

export type QueryParkingAnswerPreparedLoader = (
  datasetDir: string,
) => Promise<PreparedSegmentsForAnswer>

const DEFAULT_DATASET_DIR = 'public/data/generated/xinyi'
const DEFAULT_HHMM = '21:00'
export const DEFAULT_PARKING_ANSWER_INDEX_ROOT = '.tmp/parking-answer-index'

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
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${flags[0]}: ${value}`)
  }
  return parsed
}

const parseRiskMode = (value: string | null): RiskMode | undefined => {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toUpperCase()
  if (
    normalized === 'CONSERVATIVE' ||
    normalized === 'NEUTRAL' ||
    normalized === 'AGGRESSIVE'
  ) {
    return normalized
  }
  throw new Error(`Invalid risk mode: ${value}`)
}

export const parseQueryParkingAnswerArgs = (
  argv: string[],
): QueryParkingAnswerOptions => ({
  datasetDir:
    getArgValue(argv, '--datasetDir', '--dataset-dir') ?? DEFAULT_DATASET_DIR,
  lng: parseNumberArg(argv, '--lng', '--lon'),
  lat: parseNumberArg(argv, '--lat'),
  hhmm: getArgValue(argv, '--hhmm') ?? DEFAULT_HHMM,
  searchRadiusMeters: parseNumberArg(argv, '--radius', '--searchRadiusMeters'),
  includeInferred: hasFlag(argv, '--includeInferred', '--include-inferred'),
  riskMode: parseRiskMode(getArgValue(argv, '--riskMode', '--risk-mode')),
  maxAlternatives: parseNumberArg(argv, '--maxAlternatives', '--max-alternatives'),
  json: hasFlag(argv, '--json'),
})

const requireLocation = (
  options: Pick<QueryParkingAnswerOptions, 'lng' | 'lat'>,
): [number, number] => {
  if (options.lng === undefined || options.lat === undefined) {
    throw new Error('Missing required --lng and --lat coordinates.')
  }
  return [options.lng, options.lat]
}

export const loadParkingAnswerPreparedIndexSource = async (
  datasetDir: string,
): Promise<ParkingAnswerPreparedIndexFile> => {
  const [
    redYellow,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  ] = await Promise.all([
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      'red_yellow.geojson',
      { baseDir: datasetDir },
    ),
    loadGeoJson<FeatureCollection<Point>>('bus_stops.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection<Point>>('hydrants.geojson', { baseDir: datasetDir }),
    loadGeoJson<ParkingSpaceCollection>('parking_spaces.geojson', {
      baseDir: datasetDir,
    }),
    loadGeoJson<FeatureCollection<Point>>('intersections.geojson', {
      baseDir: datasetDir,
    }),
    loadGeoJson<FeatureCollection>('crosswalks.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection>('sign_overrides.geojson', {
      baseDir: datasetDir,
    }).catch(() => ({ type: 'FeatureCollection' as const, features: [] })),
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      'candidates_inferred.geojson',
      { baseDir: datasetDir },
    ).catch(() => ({ type: 'FeatureCollection' as const, features: [] })),
    loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir: datasetDir }),
  ])

  const rawSegments = redYellow.features.flatMap((feature, index) =>
    buildSegmentsFromFeature(feature, index, meta),
  )
  const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
    buildInferredSegmentsFromFeature(feature, index, meta),
  )
  const segmentsWithOverrides = applySignOverrides(
    [...rawSegments, ...inferredSegments],
    signOverrides,
    {
      matchToleranceMeters: meta.signOverrideMatchToleranceMeters ?? 15,
    },
  )
  const segments = countParkingSpacesNearSegments(
    segmentsWithOverrides,
    parkingSpaces,
  )
  const zones = makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks)

  return {
    schemaVersion: 1,
    districtId: path.basename(path.resolve(datasetDir)),
    datasetHash: meta.datasetHash ?? 'local',
    zoneParamsVersion: ZONE_PARAMS_VERSION,
    reviewedSignOverridesCount: meta.signOverridesCount ?? null,
    appliedSignOverridesCount: meta.overridesAppliedCount ?? null,
    segments,
    zones,
  }
}

const buildPreparedSegmentsForAnswer = ({
  datasetHash,
  zoneParamsVersion,
  reviewedSignOverridesCount,
  appliedSignOverridesCount,
  segments,
  zones,
}: ParkingAnswerPreparedIndexFile): PreparedSegmentsForAnswer => ({
  datasetHash,
  reviewedSignOverridesCount,
  appliedSignOverridesCount,
  segments,
  zoneIndex: buildZoneIndex(zones, datasetHash, zoneParamsVersion),
})

const loadPreparedIndexFile = async (
  datasetDir: string,
  indexRoot: string,
): Promise<ParkingAnswerPreparedIndexFile> => {
  const districtId = path.basename(path.resolve(datasetDir))
  const indexPath = path.resolve(indexRoot, `${districtId}.json`)
  const [raw, meta] = await Promise.all([
    fs.readFile(indexPath, 'utf-8'),
    loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir: datasetDir }),
  ])
  const parsed = JSON.parse(raw) as ParkingAnswerPreparedIndexFile
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported parking answer index schema: ${indexPath}`)
  }
  if (parsed.districtId !== districtId) {
    throw new Error(
      `Parking answer index district ${parsed.districtId} does not match ${districtId}`,
    )
  }
  if (parsed.datasetHash !== meta.datasetHash) {
    throw new Error(
      `Parking answer index hash ${parsed.datasetHash} does not match dataset ${String(meta.datasetHash)}`,
    )
  }
  if (parsed.zoneParamsVersion !== ZONE_PARAMS_VERSION) {
    throw new Error(
      `Parking answer index zone params ${parsed.zoneParamsVersion} do not match ${ZONE_PARAMS_VERSION}`,
    )
  }
  if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.zones)) {
    throw new Error(`Parking answer index is missing segments or zones: ${indexPath}`)
  }
  return parsed
}

export const loadPreparedSegmentsForAnswer = async (
  datasetDir: string,
): Promise<PreparedSegmentsForAnswer> => {
  const configuredIndexRoot =
    process.env.PARKKING_PARKING_ANSWER_INDEX_ROOT?.trim()
  const indexRoot =
    configuredIndexRoot ||
    (process.env.NODE_ENV === 'production'
      ? DEFAULT_PARKING_ANSWER_INDEX_ROOT
      : null)
  const prepared = indexRoot
    ? await loadPreparedIndexFile(datasetDir, indexRoot)
    : await loadParkingAnswerPreparedIndexSource(datasetDir)
  return buildPreparedSegmentsForAnswer(prepared)
}

export const loadEvaluatedSegmentsForAnswer = async (
  datasetDir: string,
  hhmm: string,
): Promise<EvaluatedSegmentsForAnswer> => {
  const {
    datasetHash,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
    segments,
    zoneIndex,
  } = await loadPreparedSegmentsForAnswer(datasetDir)

  resetClipCacheStats()
  return {
    datasetHash,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
    segments: segments.flatMap((segment: Segment) =>
      evaluateSegmentWithZones(segment, hhmm, zoneIndex),
    ),
  }
}

export const createQueryParkingAnswerRunner = (
  loadSegments: QueryParkingAnswerLoader = loadEvaluatedSegmentsForAnswer,
) => async (
  options: QueryParkingAnswerOptions,
): Promise<QueryParkingAnswerResult> => {
  const datasetDir = options.datasetDir ?? DEFAULT_DATASET_DIR
  const hhmm = options.hhmm ?? DEFAULT_HHMM
  const location = requireLocation(options)
  const {
    datasetHash,
    segments,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
  } = await loadSegments(datasetDir, hhmm)
  const answer = buildParkingAnswer(segments, location, {
    ...options,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
  })
  return {
    datasetDir,
    datasetHash,
    hhmm,
    evaluatedCount: segments.length,
    answer,
    trustSummary: buildParkingAnswerTrustSummary(answer),
  }
}

export const createPreparedQueryParkingAnswerRunner = (
  loadSegments: QueryParkingAnswerPreparedLoader = loadPreparedSegmentsForAnswer,
) => async (
  options: QueryParkingAnswerOptions,
): Promise<QueryParkingAnswerResult> => {
  const datasetDir = options.datasetDir ?? DEFAULT_DATASET_DIR
  const hhmm = options.hhmm ?? DEFAULT_HHMM
  const location = requireLocation(options)
  const {
    datasetHash,
    segments,
    zoneIndex,
    reviewedSignOverridesCount,
    appliedSignOverridesCount,
  } = await loadSegments(datasetDir)
  const { answer, evaluatedCount } = buildParkingAnswerFromSegmentsWithStats(
    segments,
    location,
    {
      ...options,
      nowHHMM: hhmm,
      zoneIndex,
      reviewedSignOverridesCount,
      appliedSignOverridesCount,
    },
  )

  return {
    datasetDir,
    datasetHash,
    hhmm,
    evaluatedCount,
    answer,
    trustSummary: buildParkingAnswerTrustSummary(answer),
  }
}

export const runQueryParkingAnswer = createQueryParkingAnswerRunner()

const formatMeters = (value: number) => `${Math.round(value)}m`

export const renderQueryParkingAnswer = ({
  answer,
  datasetDir,
  datasetHash,
  evaluatedCount,
  hhmm,
  trustSummary,
}: QueryParkingAnswerResult) => {
  const primary = answer.primary
  const lines = [
    `Parking answer: ${answer.kind}`,
    `Reason: ${answer.label}`,
    `Trust: ${trustSummary.trustLabel} (${trustSummary.trustTone})`,
    `Next step: ${trustSummary.nextStep}`,
    `Evidence strength: ${trustSummary.evidenceStrength}`,
    `Dataset: ${datasetDir}`,
    `Dataset hash: ${datasetHash}`,
    `Time: ${hhmm}`,
    `Location: ${answer.location[0]},${answer.location[1]}`,
    `Evaluated segments: ${evaluatedCount}`,
  ]

  if (trustSummary.fieldChecks.length > 0) {
    lines.push(`Field checks: ${trustSummary.fieldChecks.join('; ')}`)
  }

  if (!primary) {
    return lines.join('\n')
  }

  lines.push(
    `Nearest segment: ${primary.id} (${formatMeters(primary.distanceMeters)})`,
    `Tier/action: ${primary.tier}/${primary.allowedNow}`,
    `Confidence: ${primary.finalConfidence}`,
    `Evidence: ${answer.evidence.label}`,
    `Reasons: ${primary.reasons.join('; ') || primary.reasonCodes.join('; ')}`,
  )

  if (answer.caveats.length > 0) {
    lines.push(`Caveats: ${answer.caveats.join('; ')}`)
  }

  if (answer.alternatives.length > 0) {
    lines.push(
      `Alternatives: ${answer.alternatives
        .map(
          (candidate) =>
            `${candidate.id} ${candidate.tier}/${candidate.allowedNow} ${formatMeters(candidate.distanceMeters)}`,
        )
        .join(' | ')}`,
    )
  }

  return lines.join('\n')
}

const main = async () => {
  const options = parseQueryParkingAnswerArgs(process.argv)
  const result = await runQueryParkingAnswer(options)
  console.log(
    options.json
      ? JSON.stringify(result, null, 2)
      : renderQueryParkingAnswer(result),
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
