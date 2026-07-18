import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
  Point,
} from 'geojson'

const DEFAULT_CITY = 'Taoyuan'
const DEFAULT_OUTPUT = 'data/sources/taoyuan/paid_curb_segments.geojson'
const DEFAULT_API_BASE = 'https://tdx.transportdata.tw/api/basic'
const DEFAULT_TOKEN_URL =
  'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token'
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; ParkKing/1.0; +https://github.com/zx05211314/ParkKing)'
const PAGE_SIZE = 1000

export type TdxAcquisitionMode =
  | 'guest'
  | 'access-token'
  | 'client-credentials'
  | 'saved-input'

type PaidCurbGeometry = Point | LineString | MultiLineString

interface TdxName {
  Zh_tw?: string
  En?: string
}

interface TdxPoint {
  PositionLon?: number | string
  PositionLat?: number | string
}

interface TdxParkingSegment {
  ParkingSegmentID?: string
  ParkingSegmentName?: TdxName | string
  ParkingSegmentPosition?: TdxPoint
  Geometry?: string | PaidCurbGeometry | null
  RoadSection?: { Start?: string; End?: string } | null
  Description?: string
  FareDescription?: string
  HasChargingPoint?: number
  City?: string
  CityCode?: string
  TownName?: string
  TownID?: string
}

interface TdxParkingWrapper {
  SrcUpdateTime?: string
  UpdateTime?: string
  AuthorityCode?: string
  VersionID?: number
  Count?: number
  Items?: TdxParkingSegment[]
  ParkingSegments?: TdxParkingSegment[]
}

export interface PaidCurbSegmentProperties extends GeoJsonProperties {
  evidenceKind: 'PAID_CURB_SEGMENT'
  legalAnswerEligible: false
  geometryPrecision: 'SEGMENT_GEOMETRY' | 'REPRESENTATIVE_POINT'
  parkingSegmentId: string
  parkingSegmentNameZh: string | null
  parkingSegmentNameEn: string | null
  roadStart: string | null
  roadEnd: string | null
  description: string | null
  fareDescription: string | null
  hasChargingPoint: boolean
  city: string | null
  cityCode: string | null
  townName: string | null
  townId: string | null
  sourceDataset: 'TDX OnStreet ParkingSegment v1'
}

export interface PaidCurbSegmentCollection
  extends FeatureCollection<PaidCurbGeometry, PaidCurbSegmentProperties> {
  metadata: {
    sourceDataset: 'TDX OnStreet ParkingSegment v1'
    sourceUpdateTime: string | null
    platformUpdateTime: string | null
    authorityCode: string | null
    versionId: number | null
    sourceRecordCount: number
    featureCount: number
    coordinateCorrectionCount: number
    droppedRecordCount: number
    legalAnswerEligible: false
    acquisitionMode?: TdxAcquisitionMode
  }
}

const toFiniteNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const isLngLat = (coordinate: [number, number]) =>
  Math.abs(coordinate[0]) <= 180 && Math.abs(coordinate[1]) <= 90

const isPlausibleTaoyuanCoordinate = ([longitude, latitude]: [number, number]) =>
  longitude >= 120 && longitude <= 122 && latitude >= 24 && latitude <= 26

const parseLineStringWkt = (value: string): LineString | null => {
  const match = value.trim().match(/^LINESTRING(?:\s+Z)?\s*\((.+)\)$/i)
  if (!match) {
    return null
  }
  const coordinates = match[1]
    .split(',')
    .map((entry) => entry.trim().split(/\s+/).slice(0, 2).map(Number))
    .filter(
      (coordinate): coordinate is [number, number] =>
        coordinate.length === 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1]) &&
        isLngLat(coordinate as [number, number]),
    )
  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null
}

const isPaidCurbGeometry = (value: unknown): value is PaidCurbGeometry => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const geometry = value as { type?: unknown; coordinates?: unknown }
  return (
    (geometry.type === 'Point' ||
      geometry.type === 'LineString' ||
      geometry.type === 'MultiLineString') &&
    Array.isArray(geometry.coordinates)
  )
}

const parseSegmentGeometry = (value: TdxParkingSegment['Geometry']) => {
  if (isPaidCurbGeometry(value)) {
    return value
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (isPaidCurbGeometry(parsed)) {
      return parsed
    }
  } catch {
    return parseLineStringWkt(value)
  }
  return null
}

const getRepresentativePoint = (
  segment: TdxParkingSegment,
): { point: Point; coordinateCorrected: boolean } | null => {
  const longitude = toFiniteNumber(segment.ParkingSegmentPosition?.PositionLon)
  const latitude = toFiniteNumber(segment.ParkingSegmentPosition?.PositionLat)
  if (longitude === null || latitude === null) {
    return null
  }
  if (isLngLat([longitude, latitude])) {
    return {
      point: { type: 'Point', coordinates: [longitude, latitude] },
      coordinateCorrected: false,
    }
  }

  const swapped: [number, number] = [latitude, longitude]
  if (!isPlausibleTaoyuanCoordinate(swapped)) {
    return null
  }
  return {
    point: { type: 'Point', coordinates: swapped },
    coordinateCorrected: true,
  }
}

const getName = (value: TdxParkingSegment['ParkingSegmentName'], language: keyof TdxName) => {
  if (typeof value === 'string') {
    return language === 'Zh_tw' && value.trim() ? value.trim() : null
  }
  const text = value?.[language]
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

const getSegments = (payload: unknown): TdxParkingSegment[] => {
  if (Array.isArray(payload)) {
    return payload as TdxParkingSegment[]
  }
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const wrapper = payload as TdxParkingWrapper
  if (Array.isArray(wrapper.Items)) {
    return wrapper.Items
  }
  return Array.isArray(wrapper.ParkingSegments) ? wrapper.ParkingSegments : []
}

const buildFeature = (
  segment: TdxParkingSegment,
  index: number,
): {
  feature: Feature<PaidCurbGeometry, PaidCurbSegmentProperties>
  coordinateCorrected: boolean
} | null => {
  const exactGeometry = parseSegmentGeometry(segment.Geometry)
  const representativePoint = exactGeometry ? null : getRepresentativePoint(segment)
  const geometry = exactGeometry ?? representativePoint?.point
  if (!geometry) {
    return null
  }

  return {
    feature: {
      type: 'Feature',
      id: segment.ParkingSegmentID ?? `tdx-segment-${index + 1}`,
      geometry,
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        legalAnswerEligible: false,
        geometryPrecision: exactGeometry ? 'SEGMENT_GEOMETRY' : 'REPRESENTATIVE_POINT',
        parkingSegmentId: segment.ParkingSegmentID ?? `tdx-segment-${index + 1}`,
        parkingSegmentNameZh: getName(segment.ParkingSegmentName, 'Zh_tw'),
        parkingSegmentNameEn: getName(segment.ParkingSegmentName, 'En'),
        roadStart: segment.RoadSection?.Start?.trim() || null,
        roadEnd: segment.RoadSection?.End?.trim() || null,
        description: segment.Description?.trim() || null,
        fareDescription: segment.FareDescription?.trim() || null,
        hasChargingPoint: segment.HasChargingPoint === 1,
        city: segment.City?.trim() || null,
        cityCode: segment.CityCode?.trim() || null,
        townName: segment.TownName?.trim() || null,
        townId: segment.TownID?.trim() || null,
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    },
    coordinateCorrected: representativePoint?.coordinateCorrected ?? false,
  }
}

export const normalizeTaoyuanPaidCurbSegments = (
  payload: unknown,
  acquisitionMode?: TdxAcquisitionMode,
): PaidCurbSegmentCollection => {
  const wrapper =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as TdxParkingWrapper)
      : {}
  const segments = getSegments(payload)
  const features: Array<
    Feature<PaidCurbGeometry, PaidCurbSegmentProperties>
  > = []
  let coordinateCorrectionCount = 0
  segments.forEach((segment, index) => {
    const result = buildFeature(segment, index)
    if (result) {
      features.push(result.feature)
      if (result.coordinateCorrected) {
        coordinateCorrectionCount += 1
      }
    }
  })
  features.sort(({ properties: left }, { properties: right }) =>
    left.parkingSegmentId < right.parkingSegmentId
      ? -1
      : left.parkingSegmentId > right.parkingSegmentId
        ? 1
        : 0,
  )

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      sourceDataset: 'TDX OnStreet ParkingSegment v1',
      sourceUpdateTime: wrapper.SrcUpdateTime ?? null,
      platformUpdateTime: wrapper.UpdateTime ?? null,
      authorityCode: wrapper.AuthorityCode ?? null,
      versionId: wrapper.VersionID ?? null,
      sourceRecordCount: segments.length,
      featureCount: features.length,
      coordinateCorrectionCount,
      droppedRecordCount: segments.length - features.length,
      legalAnswerEligible: false,
      ...(acquisitionMode ? { acquisitionMode } : {}),
    },
  }
}

const guestAcquisitionEnabled = (env: NodeJS.ProcessEnv) =>
  !['0', 'false', 'no', 'off'].includes(
    env.TDX_ALLOW_GUEST?.trim().toLowerCase() ?? '',
  )

export const resolveTdxAcquisitionMode = (
  env: NodeJS.ProcessEnv,
): Exclude<TdxAcquisitionMode, 'saved-input'> => {
  if (env.TDX_ACCESS_TOKEN?.trim()) {
    return 'access-token'
  }
  const clientId = env.TDX_CLIENT_ID?.trim()
  const clientSecret = env.TDX_CLIENT_SECRET?.trim()
  if (clientId || clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error(
        'TDX_CLIENT_ID and TDX_CLIENT_SECRET must be configured together.',
      )
    }
    return 'client-credentials'
  }
  if (guestAcquisitionEnabled(env)) {
    return 'guest'
  }
  throw new Error(
    'TDX guest access is disabled. Set TDX credentials, enable TDX_ALLOW_GUEST, or pass --input with a saved TDX JSON response.',
  )
}

const requestTdxAccessToken = async (env: NodeJS.ProcessEnv) => {
  const acquisitionMode = resolveTdxAcquisitionMode(env)
  if (acquisitionMode === 'guest') {
    return { acquisitionMode, token: null }
  }
  if (acquisitionMode === 'access-token') {
    return {
      acquisitionMode,
      token: env.TDX_ACCESS_TOKEN?.trim() ?? null,
    }
  }
  const clientId = env.TDX_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.TDX_CLIENT_SECRET?.trim() ?? ''

  const response = await fetch(env.TDX_TOKEN_URL ?? DEFAULT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!response.ok) {
    throw new Error(`TDX token request failed with HTTP ${response.status}`)
  }
  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) {
    throw new Error('TDX token response did not contain access_token')
  }
  return { acquisitionMode, token: payload.access_token }
}

const fetchTaoyuanPayload = async (env: NodeJS.ProcessEnv) => {
  const { acquisitionMode, token } = await requestTdxAccessToken(env)
  const baseUrl = (env.TDX_PARKING_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/g, '')
  const allSegments: TdxParkingSegment[] = []
  let firstWrapper: TdxParkingWrapper | null = null

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`${baseUrl}/v1/Parking/OnStreet/ParkingSegment/City/${DEFAULT_CITY}`)
    url.searchParams.set('$top', String(PAGE_SIZE))
    url.searchParams.set('$skip', String(page * PAGE_SIZE))
    url.searchParams.set('$count', 'true')
    url.searchParams.set('$format', 'JSON')
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': env.TDX_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
    }
    if (token) {
      headers.authorization = `Bearer ${token}`
    }
    const response = await fetch(url, { headers })
    if (!response.ok) {
      if (
        acquisitionMode === 'guest' &&
        (response.status === 401 || response.status === 403)
      ) {
        throw new Error(
          `TDX guest access returned HTTP ${response.status}. Configure TDX credentials or pass --input with a saved official response.`,
        )
      }
      throw new Error(`TDX parking segment request failed with HTTP ${response.status}`)
    }
    const wrapper = (await response.json()) as TdxParkingWrapper
    firstWrapper ??= wrapper
    const pageSegments = getSegments(wrapper)
    allSegments.push(...pageSegments)

    const total = typeof wrapper.Count === 'number' ? wrapper.Count : null
    if (
      pageSegments.length < PAGE_SIZE ||
      (total !== null && allSegments.length >= total)
    ) {
      break
    }
  }

  return {
    acquisitionMode,
    payload: {
      ...(firstWrapper ?? {}),
      Count: allSegments.length,
      Items: allSegments,
    } satisfies TdxParkingWrapper,
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const writeTaoyuanPaidCurbSegments = async (params: {
  inputPath?: string | null
  outputPath?: string | null
  env?: NodeJS.ProcessEnv
}) => {
  const acquisition = params.inputPath
    ? {
        acquisitionMode: 'saved-input' as const,
        payload: JSON.parse(
          await fs.readFile(path.resolve(params.inputPath), 'utf-8'),
        ) as unknown,
      }
    : await fetchTaoyuanPayload(params.env ?? process.env)
  const collection = normalizeTaoyuanPaidCurbSegments(
    acquisition.payload,
    acquisition.acquisitionMode,
  )
  if (collection.features.length === 0) {
    throw new Error('TDX payload did not contain any georeferenced parking segments')
  }

  const outputPath = path.resolve(params.outputPath ?? DEFAULT_OUTPUT)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf-8')
  return {
    outputPath,
    collection,
    acquisitionMode: acquisition.acquisitionMode,
  }
}

const run = async () => {
  const { outputPath, collection, acquisitionMode } =
    await writeTaoyuanPaidCurbSegments({
    inputPath: getArgValue(process.argv, '--input'),
    outputPath: getArgValue(process.argv, '--out'),
  })
  console.log(
    `Wrote ${collection.features.length} paid-curb reference features to ${outputPath}`,
  )
  console.log(`TDX acquisition mode: ${acquisitionMode}`)
  console.log(
    `Coordinate corrections: ${collection.metadata.coordinateCorrectionCount}; dropped records: ${collection.metadata.droppedRecordCount}`,
  )
  console.log('These features are not eligible for legal-answer or marked-space evidence.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
