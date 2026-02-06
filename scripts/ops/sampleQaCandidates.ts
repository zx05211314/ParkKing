import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson'
import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../../src/data/segmentBuilder'
import { DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS } from '../../src/data/constants'
import { applyRankingPolicy, isInferredSegment, type RiskMode } from '../../src/domain/ranking/policy'
import { evaluateSegmentWithZones } from '../../src/domain/rules/evaluateSegment'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../../src/domain/zones/makeZones'
import { getZoneIndex } from '../../src/domain/zones/zoneIndex'
import { distanceMeters, getPathMidpoint, MOCK_LOCATION } from '../../src/map/geo'
import type { EvaluatedSegment } from '../../src/ui/types'

const DEFAULT_TOP_N = 50
const DEFAULT_RADIUS_METERS = 600
const DEFAULT_DATASET_ROOTS = ['public/data/generated', 'data/generated']
const REQUIRED_DATASET_FILES = [
  'dataset_meta.json',
  'red_yellow.geojson',
  'bus_stops.geojson',
  'hydrants.geojson',
  'intersections.geojson',
]

interface CliArgs {
  districtId: string | null
  all: boolean
  topN: number
  outPath: string | null
  riskMode: RiskMode
  radiusMeters: number
  shuffle: boolean
  seed: number
}

interface DistrictResult {
  districtId: string
  outPath: string
  rowCount: number
}

export interface QaCandidateRow {
  districtId: string
  segmentId: string
  lat: string
  lon: string
  score: string
  topReasons: string[]
  flags: string[]
  mapsUrl: string
}

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
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

export const parseArgs = (argv: string[]): CliArgs => {
  const districtId = parseArgValue(argv, '--district')
  const all = argv.includes('--all')
  if ((districtId && all) || (!districtId && !all)) {
    throw new Error('Specify exactly one of --district <id> or --all')
  }

  const topNValue = parseArgValue(argv, '--topN') ?? parseArgValue(argv, '--count')
  const shuffle = argv.includes('--shuffle')

  return {
    districtId,
    all,
    topN: parsePositiveNumber(topNValue, DEFAULT_TOP_N, 'topN', true),
    outPath: parseArgValue(argv, '--out'),
    riskMode: parseRiskMode(parseArgValue(argv, '--riskMode')),
    radiusMeters: parsePositiveNumber(
      parseArgValue(argv, '--radius'),
      DEFAULT_RADIUS_METERS,
      'radius',
    ),
    shuffle,
    seed: shuffle
      ? parsePositiveNumber(parseArgValue(argv, '--seed'), 1, 'seed', true)
      : 1,
  }
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const hasRequiredDatasetFiles = async (dirPath: string) => {
  for (const fileName of REQUIRED_DATASET_FILES) {
    const target = path.resolve(dirPath, fileName)
    if (!(await fileExists(target))) {
      return false
    }
  }
  return true
}

const resolveDistrictDatasetDir = async (
  districtId: string,
  datasetRoots: string[],
) => {
  for (const root of datasetRoots) {
    const candidate = path.resolve(root, districtId)
    if (await hasRequiredDatasetFiles(candidate)) {
      return candidate
    }
  }
  return null
}

const readRegistryDistrictIds = async (datasetRoot: string) => {
  const registryPath = path.resolve(datasetRoot, 'registry.json')
  if (!(await fileExists(registryPath))) {
    return []
  }
  try {
    const raw = await fs.readFile(registryPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      districts?: Array<{ districtId?: string }>
    }
    return (parsed.districts ?? [])
      .map((entry) => entry.districtId?.trim())
      .filter((entry): entry is string => Boolean(entry))
  } catch {
    return []
  }
}

const readDirectoryDistrictIds = async (datasetRoot: string) => {
  try {
    const entries = await fs.readdir(datasetRoot, { withFileTypes: true })
    const districtIds: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      if (entry.name.startsWith('.') || entry.name === '_ops') {
        continue
      }
      const candidate = path.resolve(datasetRoot, entry.name)
      if (await hasRequiredDatasetFiles(candidate)) {
        districtIds.push(entry.name)
      }
    }
    return districtIds
  } catch {
    return []
  }
}

const discoverDistrictIds = async (datasetRoots: string[]) => {
  const districtIds = new Set<string>()
  for (const root of datasetRoots) {
    const [registryIds, directoryIds] = await Promise.all([
      readRegistryDistrictIds(root),
      readDirectoryDistrictIds(root),
    ])
    registryIds.forEach((districtId) => districtIds.add(districtId))
    directoryIds.forEach((districtId) => districtIds.add(districtId))
  }
  return Array.from(districtIds).sort((a, b) => a.localeCompare(b))
}

const loadOptionalGeoJson = async <T>(fileName: string, baseDir: string, fallback: T) => {
  try {
    return await loadGeoJson<T>(fileName, { baseDir })
  } catch {
    return fallback
  }
}

const toLocation = (meta: DatasetMeta | null): [number, number] => {
  const center = meta?.boundaryCenter
  if (!Array.isArray(center) || center.length !== 2) {
    return MOCK_LOCATION
  }
  const lon = Number(center[0])
  const lat = Number(center[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return MOCK_LOCATION
  }
  return [lon, lat]
}

const formatCoord = (value: number) => value.toFixed(6)
const formatScore = (value: number) => value.toFixed(4)

const createSeededRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleDeterministic = <T>(items: T[], seed: number) => {
  const rng = createSeededRng(seed)
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = items[index]
    items[index] = items[swapIndex] as T
    items[swapIndex] = current as T
  }
  return items
}

const toTopReasons = (segment: EvaluatedSegment) => {
  const unique: string[] = []
  segment.reasonCodes.forEach((code) => {
    if (!unique.includes(code)) {
      unique.push(code)
    }
  })
  return unique.slice(0, 3)
}

const toFlags = (segment: EvaluatedSegment) => {
  const reasonCodes = new Set(segment.reasonCodes)
  const flags: string[] = []

  if (reasonCodes.has('ZONE_HYDRANT')) {
    flags.push('hydrant')
  }
  if (reasonCodes.has('ZONE_BUS_STOP')) {
    flags.push('busStop')
  }
  if (reasonCodes.has('ZONE_INTERSECTION')) {
    flags.push('intersection')
  }
  if (reasonCodes.has('ZONE_CROSSWALK')) {
    flags.push('crosswalk')
  }
  if (reasonCodes.has('OVERRIDE_APPLIED')) {
    flags.push('override')
  }
  if (isInferredSegment(segment)) {
    flags.push('inferred')
  }
  if (reasonCodes.has('COVERAGE_LOW')) {
    flags.push('coverageLow')
  }
  if (reasonCodes.has('COVERAGE_MED')) {
    flags.push('coverageMed')
  }
  if (reasonCodes.has('DATA_FRESHNESS_STALE')) {
    flags.push('staleData')
  }
  if (reasonCodes.has('DATA_FRESHNESS_UNKNOWN')) {
    flags.push('freshnessUnknown')
  }

  const riskTags = [...(segment.riskTags ?? [])].sort((a, b) => a.localeCompare(b))
  riskTags.forEach((tag) => {
    flags.push(`risk:${tag}`)
  })

  return flags
}

const escapeCsvCell = (value: string) => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export const renderQaCandidatesCsv = (rows: QaCandidateRow[]) => {
  const header = [
    'districtId',
    'segmentId',
    'lat',
    'lon',
    'score',
    'topReasons[]',
    'flags',
    'mapsUrl',
  ]
  const lines = rows.map((row) =>
    [
      row.districtId,
      row.segmentId,
      row.lat,
      row.lon,
      row.score,
      JSON.stringify(row.topReasons),
      JSON.stringify(row.flags),
      row.mapsUrl,
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(','),
  )
  return `${header.join(',')}\n${lines.join('\n')}\n`
}

const resolveOutPath = (params: {
  districtId: string
  all: boolean
  outPath: string | null
}) => {
  if (!params.outPath) {
    return path.resolve('public', 'data', 'generated', params.districtId, 'qa_candidates.csv')
  }

  if (!params.all) {
    return path.resolve(params.outPath)
  }

  const replaced = params.outPath
    .replaceAll('{districtId}', params.districtId)
    .replaceAll('<id>', params.districtId)
  if (replaced !== params.outPath) {
    return path.resolve(replaced)
  }

  const parsed = path.parse(params.outPath)
  if (parsed.ext.toLowerCase() === '.csv') {
    return path.resolve(parsed.dir, `${parsed.name}-${params.districtId}${parsed.ext}`)
  }
  return path.resolve(params.outPath, `${params.districtId}.csv`)
}

export const buildQaCandidates = async (params: {
  districtId: string
  topN: number
  riskMode: RiskMode
  radiusMeters: number
  shuffle?: boolean
  seed?: number
  datasetRoots?: string[]
}): Promise<QaCandidateRow[]> => {
  const datasetRoots = params.datasetRoots ?? DEFAULT_DATASET_ROOTS
  const baseDir = await resolveDistrictDatasetDir(params.districtId, datasetRoots)
  if (!baseDir) {
    throw new Error(
      `Could not locate latest pack/generated directory for district ${params.districtId}`,
    )
  }

  const [
    redYellow,
    busStops,
    hydrants,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  ] = await Promise.all([
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>('red_yellow.geojson', {
      baseDir,
    }),
    loadGeoJson<FeatureCollection<Point>>('bus_stops.geojson', { baseDir }),
    loadGeoJson<FeatureCollection<Point>>('hydrants.geojson', { baseDir }),
    loadGeoJson<FeatureCollection<Point>>('intersections.geojson', { baseDir }),
    loadOptionalGeoJson<FeatureCollection>('crosswalks.geojson', baseDir, {
      type: 'FeatureCollection',
      features: [],
    }),
    loadOptionalGeoJson<FeatureCollection>('sign_overrides.geojson', baseDir, {
      type: 'FeatureCollection',
      features: [],
    }),
    loadOptionalGeoJson<FeatureCollection<LineString | MultiLineString>>(
      'candidates_inferred.geojson',
      baseDir,
      {
        type: 'FeatureCollection',
        features: [],
      },
    ),
    loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir }).catch(() => null),
  ])

  const baseSegments = redYellow.features.flatMap((feature, index) =>
    buildSegmentsFromFeature(feature, index, meta),
  )
  const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
    buildInferredSegmentsFromFeature(feature, index, meta),
  )

  const matchTolerance =
    meta?.signOverrideMatchToleranceMeters ?? DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS
  const segments = [
    ...applySignOverrides(baseSegments, signOverrides, {
      matchToleranceMeters: matchTolerance,
    }),
    ...inferredSegments,
  ]

  const zones = makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks)
  const zoneIndex = getZoneIndex(zones, meta?.datasetHash ?? 'qa-sampler', ZONE_PARAMS_VERSION)
  const evaluated = segments.flatMap((segment) =>
    evaluateSegmentWithZones(segment, '13:00', zoneIndex),
  )

  const anchor = toLocation(meta)
  const withDistance = evaluated.map((segment) => ({
    ...segment,
    distanceMeters: distanceMeters(anchor, getPathMidpoint(segment.path)),
  }))
  const ranked = applyRankingPolicy(withDistance, {
    includeInferred: true,
    radiusMeters: params.radiusMeters,
    riskMode: params.riskMode,
  })
  const ordered = params.shuffle
    ? shuffleDeterministic([...ranked], params.seed ?? 1)
    : ranked

  return ordered.slice(0, params.topN).map((segment) => {
    const [lon, lat] = getPathMidpoint(segment.path)
    const latText = formatCoord(lat)
    const lonText = formatCoord(lon)
    const score = formatScore(segment.rankScore)
    return {
      districtId: params.districtId,
      segmentId: segment.id,
      lat: latText,
      lon: lonText,
      score,
      topReasons: toTopReasons(segment),
      flags: toFlags(segment),
      mapsUrl: `https://www.google.com/maps?q=${latText},${lonText}`,
    }
  })
}

const writeQaCandidates = async (params: {
  districtId: string
  all: boolean
  outPath: string | null
  rows: QaCandidateRow[]
}) => {
  const outPath = resolveOutPath({
    districtId: params.districtId,
    all: params.all,
    outPath: params.outPath,
  })
  const csv = renderQaCandidatesCsv(params.rows)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, csv, 'utf-8')
  return outPath
}

export const sampleQaCandidates = async (params: {
  districtId?: string | null
  all?: boolean
  topN?: number
  count?: number
  outPath?: string | null
  riskMode?: RiskMode
  radiusMeters?: number
  shuffle?: boolean
  seed?: number
  datasetRoots?: string[]
}): Promise<DistrictResult[]> => {
  const all = params.all === true
  const topN = params.topN ?? params.count ?? DEFAULT_TOP_N
  const riskMode = params.riskMode ?? 'NEUTRAL'
  const radiusMeters = params.radiusMeters ?? DEFAULT_RADIUS_METERS
  const shuffle = params.shuffle === true
  const seed = params.seed ?? 1
  const datasetRoots = params.datasetRoots ?? DEFAULT_DATASET_ROOTS

  const districtIds = all
    ? await discoverDistrictIds(datasetRoots)
    : params.districtId
      ? [params.districtId]
      : []

  if (districtIds.length === 0) {
    throw new Error('No districts found to sample')
  }

  const results: DistrictResult[] = []
  const sortedDistrictIds = [...districtIds].sort((a, b) => a.localeCompare(b))
  for (const districtId of sortedDistrictIds) {
    const rows = await buildQaCandidates({
      districtId,
      topN,
      riskMode,
      radiusMeters,
      shuffle,
      seed,
      datasetRoots,
    })
    const outPath = await writeQaCandidates({
      districtId,
      all,
      outPath: params.outPath ?? null,
      rows,
    })
    results.push({
      districtId,
      outPath,
      rowCount: rows.length,
    })
  }

  return results
}

const run = async () => {
  const args = parseArgs(process.argv)
  const results = await sampleQaCandidates({
    districtId: args.districtId,
    all: args.all,
    topN: args.topN,
    outPath: args.outPath,
    riskMode: args.riskMode,
    radiusMeters: args.radiusMeters,
    shuffle: args.shuffle,
    seed: args.seed,
  })
  results.forEach((result) => {
    console.log(
      `Wrote ${result.rowCount} QA candidates for ${result.districtId} to ${result.outPath}`,
    )
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
