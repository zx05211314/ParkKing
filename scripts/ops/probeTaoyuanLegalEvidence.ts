import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  requestTdxAccessToken,
  type TdxAcquisitionMode,
} from './fetchTaoyuanPaidCurbSegments'

const DEFAULT_API_BASE = 'https://tdx.transportdata.tw/api/basic'
const DEFAULT_CITY = 'Taoyuan'
const DEFAULT_SPATIAL = 'data/sources/taoyuan/paid_curb_segments.geojson'
const DEFAULT_REPORT = '.tmp/taoyuan-legal-evidence-probe.md'
const DEFAULT_JSON_REPORT = '.tmp/taoyuan-legal-evidence-probe.json'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; ParkKing/1.0; +https://github.com/zx05211314/ParkKing)'

interface TdxCollectionProbe {
  id: 'parking-segments' | 'parking-spots'
  url: string
  status: number
  count: number | null
  sampleFields: string[]
  error: string | null
}

interface LocalSpatialProbe {
  path: string
  sourceRecordCount: number | null
  featureCount: number
  segmentGeometryCount: number
  representativePointCount: number
  legalAnswerEligible: false
}

export interface TaoyuanLegalEvidenceProbeResult {
  schemaVersion: 1
  probedAt: string
  probePass: boolean
  acquisitionMode: TdxAcquisitionMode
  endpoints: {
    parkingSegments: TdxCollectionProbe
    parkingSpots: TdxCollectionProbe
  }
  localSpatial: LocalSpatialProbe
  referenceAvailable: boolean
  legalAnswerEligible: false
  errors: string[]
  legalAnswerBlockers: string[]
  nextActions: string[]
}

interface TdxCollectionDefinition {
  id: TdxCollectionProbe['id']
  path: string
  collectionKey: 'ParkingSegments' | 'ParkingSegmentSpots'
}

const COLLECTIONS: TdxCollectionDefinition[] = [
  {
    id: 'parking-segments',
    path: 'ParkingSegment',
    collectionKey: 'ParkingSegments',
  },
  {
    id: 'parking-spots',
    path: 'ParkingSpot',
    collectionKey: 'ParkingSegmentSpots',
  },
]

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const toNonNegativeInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null

const getObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const probeTdxCollection = async (params: {
  definition: TdxCollectionDefinition
  baseUrl: string
  token: string | null
  timeoutMs: number
  userAgent: string
  fetchImpl: typeof fetch
}): Promise<TdxCollectionProbe> => {
  const url = new URL(
    `${params.baseUrl}/v1/Parking/OnStreet/${params.definition.path}/City/${DEFAULT_CITY}`,
  )
  url.searchParams.set('$top', '1')
  url.searchParams.set('$count', 'true')
  url.searchParams.set('$format', 'JSON')
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': params.userAgent,
  }
  if (params.token) {
    headers.authorization = `Bearer ${params.token}`
  }

  let response: Response
  try {
    response = await params.fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(params.timeoutMs),
    })
  } catch (error) {
    return {
      id: params.definition.id,
      url: url.toString(),
      status: 0,
      count: null,
      sampleFields: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
  if (!response.ok) {
    return {
      id: params.definition.id,
      url: url.toString(),
      status: response.status,
      count: null,
      sampleFields: [],
      error: `HTTP ${response.status}`,
    }
  }

  try {
    const payload = getObject(await response.json())
    const collection = payload?.[params.definition.collectionKey]
    const sample =
      Array.isArray(collection) && collection.length > 0
        ? getObject(collection[0])
        : null
    const count = toNonNegativeInteger(payload?.Count)
    return {
      id: params.definition.id,
      url: url.toString(),
      status: response.status,
      count,
      sampleFields: sample ? Object.keys(sample).sort() : [],
      error: count === null ? 'Response Count is missing or invalid.' : null,
    }
  } catch (error) {
    return {
      id: params.definition.id,
      url: url.toString(),
      status: response.status,
      count: null,
      sampleFields: [],
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

const readLocalSpatial = async (
  spatialPath: string,
): Promise<LocalSpatialProbe> => {
  const payload = getObject(
    JSON.parse(await fs.readFile(spatialPath, 'utf-8')) as unknown,
  )
  const metadata = getObject(payload?.metadata)
  const features = Array.isArray(payload?.features) ? payload.features : []
  if (metadata?.legalAnswerEligible !== false) {
    throw new Error(
      'Local spatial metadata must keep legalAnswerEligible false.',
    )
  }
  let segmentGeometryCount = 0
  let representativePointCount = 0
  let unsafeLegalFeatureCount = 0

  features.forEach((value) => {
    const feature = getObject(value)
    const geometry = getObject(feature?.geometry)
    const properties = getObject(feature?.properties)
    if (
      geometry?.type === 'LineString' ||
      geometry?.type === 'MultiLineString'
    ) {
      segmentGeometryCount += 1
    }
    if (
      geometry?.type === 'Point' &&
      properties?.geometryPrecision === 'REPRESENTATIVE_POINT'
    ) {
      representativePointCount += 1
    }
    if (properties?.legalAnswerEligible !== false) {
      unsafeLegalFeatureCount += 1
    }
  })
  if (unsafeLegalFeatureCount > 0) {
    throw new Error(
      `${unsafeLegalFeatureCount} local spatial features do not keep legalAnswerEligible false.`,
    )
  }

  return {
    path: spatialPath,
    sourceRecordCount: toNonNegativeInteger(metadata?.sourceRecordCount),
    featureCount: features.length,
    segmentGeometryCount,
    representativePointCount,
    legalAnswerEligible: false,
  }
}

export const assessTaoyuanLegalEvidence = (params: {
  probedAt: string
  acquisitionMode: TdxAcquisitionMode
  parkingSegments: TdxCollectionProbe
  parkingSpots: TdxCollectionProbe
  localSpatial: LocalSpatialProbe
}): TaoyuanLegalEvidenceProbeResult => {
  const errors = [params.parkingSegments, params.parkingSpots]
    .filter(({ error }) => Boolean(error))
    .map(
      ({ id, error }) =>
        `${id}: ${error ?? 'unknown endpoint probe failure'}`,
    )
  if (
    params.parkingSegments.count !== null &&
    params.localSpatial.sourceRecordCount !== null &&
    params.parkingSegments.count !== params.localSpatial.sourceRecordCount
  ) {
    errors.push(
      `TDX ParkingSegment count ${params.parkingSegments.count} does not match local sourceRecordCount ${params.localSpatial.sourceRecordCount}.`,
    )
  }

  const legalAnswerBlockers: string[] = []
  if (params.localSpatial.segmentGeometryCount === 0) {
    legalAnswerBlockers.push(
      `The normalized TDX ParkingSegment source has no curb-line geometry; all ${params.localSpatial.representativePointCount} points are representative references.`,
    )
  } else {
    legalAnswerBlockers.push(
      'TDX segment geometry is reference-only until a separate reviewed legal-answer promotion contract exists.',
    )
  }
  if (params.parkingSpots.count === 0) {
    legalAnswerBlockers.push(
      'The official TDX ParkingSpot endpoint reports zero Taoyuan records.',
    )
  } else if (params.parkingSpots.count !== null) {
    legalAnswerBlockers.push(
      `TDX reports ${params.parkingSpots.count} ParkingSpot records, but no reviewed spot importer or promotion contract exists.`,
    )
  }
  legalAnswerBlockers.push(
    'No official Taoyuan curb-restriction or sign-rule geometry layer is configured.',
  )

  return {
    schemaVersion: 1,
    probedAt: params.probedAt,
    probePass: errors.length === 0,
    acquisitionMode: params.acquisitionMode,
    endpoints: {
      parkingSegments: params.parkingSegments,
      parkingSpots: params.parkingSpots,
    },
    localSpatial: params.localSpatial,
    referenceAvailable:
      params.parkingSegments.count !== null &&
      params.parkingSegments.count > 0 &&
      params.localSpatial.featureCount > 0,
    legalAnswerEligible: false,
    errors,
    legalAnswerBlockers,
    nextActions: [
      'Request authoritative ParkingSpot or curb-line geometry from Taoyuan DOT/TDX.',
      'Acquire an official curb-restriction or sign-rule layer before general curb legality is evaluated.',
      'Keep all current Taoyuan paid-curb features reference-only with legalAnswerEligible false.',
      'Rerun npm run ops:probe-taoyuan-legal-evidence after the provider publishes new data.',
    ],
  }
}

export const runTaoyuanLegalEvidenceProbe = async (options: {
  spatialPath?: string
  reportPath?: string
  jsonReportPath?: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: Date
} = {}) => {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const spatialPath = path.resolve(options.spatialPath ?? DEFAULT_SPATIAL)
  const reportPath = path.resolve(options.reportPath ?? DEFAULT_REPORT)
  const jsonReportPath = path.resolve(
    options.jsonReportPath ?? DEFAULT_JSON_REPORT,
  )
  const { acquisitionMode, token } = await requestTdxAccessToken(env)
  const baseUrl = (
    env.TDX_PARKING_API_BASE_URL ?? DEFAULT_API_BASE
  ).replace(/\/+$/g, '')
  const probes = await Promise.all(
    COLLECTIONS.map((definition) =>
      probeTdxCollection({
        definition,
        baseUrl,
        token,
        timeoutMs,
        userAgent: env.TDX_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
        fetchImpl,
      }),
    ),
  )
  const parkingSegments = probes.find(
    ({ id }) => id === 'parking-segments',
  ) as TdxCollectionProbe
  const parkingSpots = probes.find(
    ({ id }) => id === 'parking-spots',
  ) as TdxCollectionProbe
  const result = assessTaoyuanLegalEvidence({
    probedAt: (options.now ?? new Date()).toISOString(),
    acquisitionMode,
    parkingSegments,
    parkingSpots,
    localSpatial: await readLocalSpatial(spatialPath),
  })
  await Promise.all([
    fs.mkdir(path.dirname(reportPath), { recursive: true }),
    fs.mkdir(path.dirname(jsonReportPath), { recursive: true }),
  ])
  await Promise.all([
    fs.writeFile(reportPath, `${renderTaoyuanLegalEvidenceProbe(result)}\n`),
    fs.writeFile(jsonReportPath, `${JSON.stringify(result, null, 2)}\n`),
  ])
  return result
}

const formatEndpoint = (probe: TdxCollectionProbe) =>
  `HTTP ${probe.status || '-'}; count=${probe.count ?? '-'}; sample fields=${probe.sampleFields.join(', ') || '-'}`

export const renderTaoyuanLegalEvidenceProbe = (
  result: TaoyuanLegalEvidenceProbeResult,
) =>
  [
    '# Taoyuan legal evidence probe',
    '',
    `- Probe: ${result.probePass ? 'PASS' : 'FAIL'}`,
    `- Probed at: ${result.probedAt}`,
    `- Acquisition mode: ${result.acquisitionMode}`,
    `- Paid-curb reference available: ${result.referenceAvailable ? 'yes' : 'no'}`,
    `- Legal parking answers eligible: ${result.legalAnswerEligible ? 'yes' : 'no'}`,
    '',
    '## Official endpoints',
    '',
    `- ParkingSegment: ${formatEndpoint(result.endpoints.parkingSegments)}`,
    `- ParkingSpot: ${formatEndpoint(result.endpoints.parkingSpots)}`,
    '',
    '## Local normalized spatial evidence',
    '',
    `- Path: ${result.localSpatial.path}`,
    `- Source records: ${result.localSpatial.sourceRecordCount ?? '-'}`,
    `- Features: ${result.localSpatial.featureCount}`,
    `- Segment geometries: ${result.localSpatial.segmentGeometryCount}`,
    `- Representative points: ${result.localSpatial.representativePointCount}`,
    '',
    '## Probe errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
    '',
    '## Legal-answer blockers',
    '',
    ...result.legalAnswerBlockers.map((blocker) => `- ${blocker}`),
    '',
    '## Next actions',
    '',
    ...result.nextActions.map((action) => `- ${action}`),
  ].join('\n')

const run = async () => {
  const timeoutValue = getArgValue(process.argv, '--timeout-ms')
  const result = await runTaoyuanLegalEvidenceProbe({
    spatialPath: getArgValue(process.argv, '--spatial') ?? undefined,
    reportPath: getArgValue(process.argv, '--out') ?? undefined,
    jsonReportPath: getArgValue(process.argv, '--json-out') ?? undefined,
    timeoutMs: timeoutValue ? Number(timeoutValue) : undefined,
  })
  console.log(renderTaoyuanLegalEvidenceProbe(result))
  if (!result.probePass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
