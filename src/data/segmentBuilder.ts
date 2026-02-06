import { lineString, point, pointToLineDistance } from '@turf/turf'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
} from 'geojson'
import type {
  ConfidenceLevel,
  Segment,
  SignOverride,
  TimeWindow,
} from '../ui/types'

export interface DatasetMeta {
  schemaVersion?: number
  metricsSchemaVersion?: number
  districtId?: string
  districtName?: string
  generatedAt?: string
  sourceUpdatedAt?: string
  datasetHash?: string
  configHash?: string
  publishedAt?: string
  publishMode?: string
  segmentsCount?: number
  overridesAppliedCount?: number
  signOverridesCount?: number
  curbMarkingKnownRate?: number
  restrictionTriggeredRate?: number
  provenanceFetchedAt?: string | null
  files?: Record<string, { sha256: string; bytes: number }>
  totalBytes?: number
  signOverrideMatchToleranceMeters?: number
  counts?: {
    segments: number
    busStops: number
    hydrants: number
    intersections?: number
    crosswalks?: number
    signOverrides?: number
    inferredCandidates?: number
    overridesApplied?: number
    zones: number
  }
  intersectionsBBox?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } | null
  crosswalksBBox?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } | null
  signOverridesBBox?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } | null
  inferredCandidatesBBox?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } | null
  boundaryBBox?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } | null
  boundaryCenter?: [number, number] | null
  inferredRiskCounts?: Record<string, number> | null
  signOverridesUpdatedAt?: string | null
  signOverridesFreshnessDays?: number | null
  intersectionsReport?: {
    counts?: Record<string, unknown>
    angleSpreadHistogram?: Record<string, number>
    removed?: Record<string, number>
  } | null
}

const parseDate = (value: unknown): Date | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

const daysSince = (date: Date): number => {
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

const inferCurbMarking = (
  properties: Record<string, unknown> | null,
): Segment['curbMarking'] => {
  if (!properties) {
    return 'UNKNOWN'
  }

  const preferredKeys = ['color', 'curb', 'marking', 'type', 'class']
  for (const key of preferredKeys) {
    const value = properties[key]
    if (typeof value === 'string') {
      const normalized = value.toLowerCase()
      if (normalized.includes('red') || normalized.includes('紅')) {
        return 'RED'
      }
      if (normalized.includes('yellow') || normalized.includes('黃')) {
        return 'YELLOW'
      }
    }
    if (typeof value === 'number') {
      if (value === 1) {
        return 'RED'
      }
      if (value === 2) {
        return 'YELLOW'
      }
    }
  }

  const serialized = JSON.stringify(properties).toLowerCase()
  if (serialized.includes('red') || serialized.includes('紅')) {
    return 'RED'
  }
  if (serialized.includes('yellow') || serialized.includes('黃')) {
    return 'YELLOW'
  }

  return 'UNKNOWN'
}

const inferConfidence = (
  properties: Record<string, unknown> | null,
): Segment['confidence'] => {
  if (!properties) {
    return 'HIGH'
  }
  const value = properties.confidence ?? properties.conf ?? properties.quality
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized.includes('low')) {
      return 'LOW'
    }
    if (normalized.includes('med')) {
      return 'MEDIUM'
    }
    if (normalized.includes('high')) {
      return 'HIGH'
    }
  }
  if (typeof value === 'number') {
    if (value >= 0.8) {
      return 'HIGH'
    }
    if (value >= 0.5) {
      return 'MEDIUM'
    }
    return 'LOW'
  }
  return 'HIGH'
}

const normalizeOverrideConfidence = (
  value: unknown,
): SignOverride['confidence'] => {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase()
    if (normalized.startsWith('HIGH')) {
      return 'HIGH'
    }
    if (normalized.startsWith('MED')) {
      return 'MED'
    }
    if (normalized.startsWith('LOW')) {
      return 'LOW'
    }
  }
  if (typeof value === 'number') {
    if (value >= 0.8) {
      return 'HIGH'
    }
    if (value >= 0.5) {
      return 'MED'
    }
    return 'LOW'
  }
  return 'MED'
}

const inferSourceReliability = (
  properties: Record<string, unknown> | null,
): ConfidenceLevel | undefined => {
  if (!properties) {
    return undefined
  }
  const value =
    properties.reliability ?? properties.source_reliability ?? properties.source
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized.includes('low')) {
      return 'LOW'
    }
    if (normalized.includes('med')) {
      return 'MED'
    }
    if (normalized.includes('high')) {
      return 'HIGH'
    }
  }
  if (typeof value === 'number') {
    if (value >= 0.8) {
      return 'HIGH'
    }
    if (value >= 0.5) {
      return 'MED'
    }
    return 'LOW'
  }
  return undefined
}

const deriveFreshnessDays = (
  properties: Record<string, unknown> | null,
  meta: DatasetMeta | null,
): number | null => {
  const propDate =
    parseDate(properties?.updated_at) ??
    parseDate(properties?.update_date) ??
    parseDate(properties?.date)

  if (propDate) {
    return daysSince(propDate)
  }

  const metaDate = parseDate(meta?.sourceUpdatedAt)
  if (metaDate) {
    return daysSince(metaDate)
  }

  return null
}

const featureName = (feature: Feature, fallback: string) => {
  const props = feature.properties ?? {}
  const name = props.name ?? props.road ?? props.road_name ?? props.section
  return name ? String(name) : fallback
}

const flattenCoordinates = (coordinates: number[][]): [number, number][] => {
  return coordinates.map((coord) => [coord[0], coord[1]] as [number, number])
}

const parseSignOverride = (
  properties: Record<string, unknown> | null,
): SignOverride | undefined => {
  if (!properties) {
    return undefined
  }

  const raw =
    properties.signOverride ??
    properties.sign_override ??
    properties.sign_override_data

  if (raw && typeof raw === 'object') {
    const override = raw as Partial<SignOverride>
    if (override.note && override.confidence && Array.isArray(override.timeWindows)) {
      const windows = override.timeWindows.filter(
        (window) =>
          typeof window?.startHHMM === 'string' &&
          typeof window?.endHHMM === 'string' &&
          typeof window?.label === 'string',
      ) as SignOverride['timeWindows']

      if (windows.length > 0) {
        return {
          note: String(override.note),
          confidence: normalizeOverrideConfidence(override.confidence),
          timeWindows: windows,
          verifiedAt: override.verifiedAt,
        }
      }
    }
  }

  const note = properties.sign_override_note
  const confidence = properties.sign_override_confidence
  const windows = properties.sign_override_windows

  if (typeof note === 'string' && typeof confidence === 'string' && Array.isArray(windows)) {
    const parsedWindows = windows.filter(
      (window) =>
        typeof window?.startHHMM === 'string' &&
        typeof window?.endHHMM === 'string' &&
        typeof window?.label === 'string',
    ) as SignOverride['timeWindows']

    if (parsedWindows.length > 0) {
      return {
        note,
        confidence: normalizeOverrideConfidence(confidence),
        timeWindows: parsedWindows,
        verifiedAt:
          typeof properties.sign_override_verified_at === 'string'
            ? properties.sign_override_verified_at
            : undefined,
      }
    }
  }

  return undefined
}

const parseRiskTags = (
  properties: Record<string, unknown> | null,
): string[] | undefined => {
  if (!properties) {
    return undefined
  }
  const raw =
    properties.riskTags ?? properties.risk_tags ?? properties.riskTag ?? properties.risk_tag

  if (Array.isArray(raw)) {
    const tags = raw.map((entry) => String(entry).trim()).filter(Boolean)
    return tags.length > 0 ? tags : undefined
  }

  if (typeof raw === 'string') {
    const tags = raw
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
    return tags.length > 0 ? tags : undefined
  }

  return undefined
}

export const buildSegmentsFromFeature = (
  feature: Feature<LineString | MultiLineString>,
  index: number,
  meta: DatasetMeta | null,
): Segment[] => {
  const idBase =
    (feature.properties?.id ??
      feature.properties?.ID ??
      feature.properties?.objectid ??
      feature.properties?.OBJECTID ??
      `seg-${index + 1}`) as string

  const properties = feature.properties ?? null
  const curbMarking = inferCurbMarking(properties)
  const confidence = inferConfidence(properties)
  const sourceReliability = inferSourceReliability(properties)
  const dataFreshnessDays = deriveFreshnessDays(properties, meta)
  const signOverride = parseSignOverride(properties)
  const riskTags = parseRiskTags(properties)

  const shared: Omit<Segment, 'id' | 'name' | 'path'> = {
    curbMarking,
    confidence,
    sourceReliability,
    dataFreshnessDays,
    signOverride,
    sourceType: 'CURB',
    source: 'CURB_MARKED',
    riskTags,
  }

  if (feature.geometry.type === 'LineString') {
    return [
      {
        ...shared,
        id: String(idBase),
        name: featureName(feature, `Segment ${index + 1}`),
        path: flattenCoordinates(feature.geometry.coordinates),
      },
    ]
  }

  return feature.geometry.coordinates.map((line, lineIndex) => ({
    ...shared,
    id: `${idBase}-p${lineIndex + 1}`,
    name: `${featureName(feature, `Segment ${index + 1}`)} - ${lineIndex + 1}`,
    path: flattenCoordinates(line),
  }))
}

const inferConfidenceWithFallback = (
  properties: Record<string, unknown> | null,
  fallback: Segment['confidence'],
): Segment['confidence'] => {
  if (!properties) {
    return fallback
  }
  const value = properties.confidence ?? properties.conf ?? properties.quality
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized.includes('low')) {
      return 'LOW'
    }
    if (normalized.includes('med')) {
      return 'MEDIUM'
    }
    if (normalized.includes('high')) {
      return 'HIGH'
    }
  }
  if (typeof value === 'number') {
    if (value >= 0.8) {
      return 'HIGH'
    }
    if (value >= 0.5) {
      return 'MEDIUM'
    }
    return 'LOW'
  }
  return fallback
}

export const buildInferredSegmentsFromFeature = (
  feature: Feature<LineString | MultiLineString>,
  index: number,
  meta: DatasetMeta | null,
): Segment[] => {
  const idBase =
    (feature.properties?.id ??
      feature.properties?.ID ??
      `inferred-${index + 1}`) as string

  const properties = feature.properties ?? null
  const confidence = inferConfidenceWithFallback(properties, 'LOW')
  const dataFreshnessDays = deriveFreshnessDays(properties, meta)
  const riskTags = parseRiskTags(properties)

  const shared: Omit<Segment, 'id' | 'name' | 'path'> = {
    curbMarking: 'YELLOW',
    confidence,
    sourceReliability: 'LOW',
    dataFreshnessDays,
    sourceType: 'INFERRED',
    source: 'INFERRED_CENTERLINE_OFFSET',
    riskTags,
  }

  if (feature.geometry.type === 'LineString') {
    return [
      {
        ...shared,
        id: String(idBase),
        name: featureName(feature, `Inferred ${index + 1}`),
        path: flattenCoordinates(feature.geometry.coordinates),
      },
    ]
  }

  return feature.geometry.coordinates.map((line, lineIndex) => ({
    ...shared,
    id: `${idBase}-p${lineIndex + 1}`,
    name: `${featureName(feature, `Inferred ${index + 1}`)} - ${lineIndex + 1}`,
    path: flattenCoordinates(line),
  }))
}

const normalizeTimeWindow = (
  entry: Record<string, unknown>,
  index: number,
): TimeWindow | null => {
  const start =
    entry.startHHMM ?? entry.start ?? entry.start_time ?? entry.startTime
  const end =
    entry.endHHMM ?? entry.end ?? entry.end_time ?? entry.endTime
  if (!start || !end) {
    return null
  }
  const label =
    typeof entry.label === 'string' && entry.label.length > 0
      ? entry.label
      : `Window ${index + 1}`
  return {
    label,
    startHHMM: String(start),
    endHHMM: String(end),
  }
}

const parseTimeWindows = (properties: Record<string, unknown>): TimeWindow[] => {
  const raw =
    properties.timeWindows ??
    properties.time_windows ??
    properties.windows ??
    properties.window

  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        list = parsed
      }
    } catch {
      list = []
    }
  }

  const normalized = list
    .map((entry, index) => normalizeTimeWindow(entry as Record<string, unknown>, index))
    .filter((window): window is TimeWindow => Boolean(window))

  if (normalized.length > 0) {
    return normalized
  }

  const directStart =
    properties.startHHMM ?? properties.start ?? properties.start_time ?? properties.startTime
  const directEnd =
    properties.endHHMM ?? properties.end ?? properties.end_time ?? properties.endTime
  if (directStart && directEnd) {
    return [
      {
        label: typeof properties.label === 'string' ? properties.label : 'Window 1',
        startHHMM: String(directStart),
        endHHMM: String(directEnd),
      },
    ]
  }

  return []
}

const parseOverrideProperties = (
  properties: Record<string, unknown>,
): SignOverride => {
  const note =
    (properties.note ??
      properties.override_note ??
      properties.sign_note ??
      properties.description ??
      properties.rule) as string | undefined
  const confidenceValue =
    properties.confidence ??
    properties.override_confidence ??
    properties.sign_override_confidence ??
    properties.quality
  const timeWindows = parseTimeWindows(properties)
  const verifiedAt =
    (properties.verifiedAt ??
      properties.verified_at ??
      properties.verified ??
      properties.updated_at ??
      properties.update_date ??
      properties.date) as string | undefined

  return {
    note: note ? String(note) : 'Sign override',
    confidence: normalizeOverrideConfidence(confidenceValue),
    timeWindows,
    verifiedAt: verifiedAt ? String(verifiedAt) : undefined,
  }
}

type OverrideOrigin = 'USER' | 'DATASET'

const parseOverrideOrigin = (
  properties: Record<string, unknown> | null,
): OverrideOrigin => {
  if (!properties) {
    return 'DATASET'
  }
  const raw =
    properties.override_source ??
    properties.override_origin ??
    properties.overrideOrigin
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    if (normalized === 'user' || normalized === 'report') {
      return 'USER'
    }
  }
  return 'DATASET'
}

const parseSegmentId = (properties: Record<string, unknown>): string | null => {
  const raw =
    properties.segmentId ??
    properties.segment_id ??
    properties.segment ??
    properties.segmentID ??
    properties.segmentid
  return raw ? String(raw) : null
}

const centerFromGeometry = (geometry: Geometry): [number, number] | null => {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'LineString') {
    const mid = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)]
    return mid ? [mid[0], mid[1]] : null
  }
  if (geometry.type === 'MultiLineString') {
    const line = geometry.coordinates[0]
    if (!line || line.length === 0) {
      return null
    }
    const mid = line[Math.floor(line.length / 2)]
    return mid ? [mid[0], mid[1]] : null
  }
  if (geometry.type === 'Polygon') {
    const coord = geometry.coordinates[0]?.[0]
    return coord ? [coord[0], coord[1]] : null
  }
  if (geometry.type === 'MultiPolygon') {
    const coord = geometry.coordinates[0]?.[0]?.[0]
    return coord ? [coord[0], coord[1]] : null
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const center = centerFromGeometry(child)
      if (center) {
        return center
      }
    }
  }
  return null
}

interface ParsedOverride {
  segmentId: string | null
  override: SignOverride
  coord: [number, number] | null
  origin: OverrideOrigin
}

const parseOverrideFeature = (feature: Feature): ParsedOverride | null => {
  const properties = feature.properties ?? {}
  const override = parseOverrideProperties(properties)
  const origin = parseOverrideOrigin(properties as Record<string, unknown> | null)
  const segmentId = parseSegmentId(properties)
  const coord = feature.geometry ? centerFromGeometry(feature.geometry) : null

  if (!segmentId && !coord) {
    return null
  }

  return {
    segmentId,
    override,
    coord,
    origin,
  }
}

const overrideRank: Record<ConfidenceLevel, number> = {
  HIGH: 3,
  MED: 2,
  LOW: 1,
}

const overrideOriginRank: Record<OverrideOrigin, number> = {
  USER: 2,
  DATASET: 1,
}

const parseTimestamp = (value?: string) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.getTime()
}

const selectBestOverride = (overrides: ParsedOverride[]) => {
  return overrides.reduce((best, current) => {
    if (!best) {
      return current
    }
    const bestOrigin = overrideOriginRank[best.origin]
    const currentOrigin = overrideOriginRank[current.origin]
    if (currentOrigin > bestOrigin) {
      return current
    }
    if (currentOrigin < bestOrigin) {
      return best
    }
    const bestRank = overrideRank[best.override.confidence]
    const currentRank = overrideRank[current.override.confidence]
    if (currentRank > bestRank) {
      return current
    }
    if (currentRank < bestRank) {
      return best
    }
    const bestTime = parseTimestamp(best.override.verifiedAt)
    const currentTime = parseTimestamp(current.override.verifiedAt)
    if (currentTime && (!bestTime || currentTime > bestTime)) {
      return current
    }
    return best
  }, null as ParsedOverride | null)
}

export interface SignOverrideMatchOptions {
  matchToleranceMeters: number
}

export const applySignOverrides = (
  segments: Segment[],
  overrides: FeatureCollection | null,
  options: SignOverrideMatchOptions,
): Segment[] => {
  if (!overrides || overrides.features.length === 0) {
    return segments
  }

  const parsed = overrides.features
    .map((feature) => parseOverrideFeature(feature))
    .filter((entry): entry is ParsedOverride => Boolean(entry))

  if (parsed.length === 0) {
    return segments
  }

  const bySegmentId = new Map<string, ParsedOverride[]>()
  const spatial = parsed.filter((entry) => entry.coord)

  parsed.forEach((entry) => {
    if (!entry.segmentId) {
      return
    }
    const existing = bySegmentId.get(entry.segmentId) ?? []
    existing.push(entry)
    bySegmentId.set(entry.segmentId, existing)
  })

  return segments.map((segment) => {
    if (segment.signOverride || segment.sourceType === 'INFERRED') {
      return segment
    }

    const matchedById = bySegmentId.get(segment.id)
    if (matchedById && matchedById.length > 0) {
      const selected = selectBestOverride(matchedById)
      if (selected) {
        return {
          ...segment,
          signOverride: {
            ...selected.override,
            source: 'segmentId',
          },
        }
      }
    }

    if (spatial.length === 0) {
      return segment
    }

    let best: ParsedOverride | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    spatial.forEach((entry) => {
      if (!entry.coord) {
        return
      }
      const distance = pointToLineDistance(
        point(entry.coord),
        lineString(segment.path),
        { units: 'meters' },
      )
      if (distance <= options.matchToleranceMeters && distance < bestDistance) {
        best = entry
        bestDistance = distance
      }
    })

    if (best) {
      const chosen = best as ParsedOverride
      return {
        ...segment,
        signOverride: {
          ...chosen.override,
          source: 'spatial',
        },
      }
    }

    return segment
  })
}

export const applyMockOverrides = (segments: Segment[]): Segment[] => {
  const overrides: SignOverride[] = [
    {
      note: 'School pickup zone',
      confidence: 'MED',
      timeWindows: [
        { label: 'Morning', startHHMM: '07:00', endHHMM: '09:00' },
        { label: 'Afternoon', startHHMM: '15:00', endHHMM: '18:00' },
      ],
    },
    {
      note: 'Loading only (weekday)',
      confidence: 'HIGH',
      timeWindows: [
        { label: 'Weekday AM', startHHMM: '09:00', endHHMM: '11:30' },
      ],
    },
    {
      note: 'Event zone signage',
      confidence: 'LOW',
      timeWindows: [
        { label: 'Event window', startHHMM: '18:00', endHHMM: '22:00' },
      ],
    },
  ]

  return segments.map((segment, index) => {
    if (segment.signOverride) {
      return segment
    }
    const override = overrides[index % overrides.length]
    if (index < overrides.length) {
      return {
        ...segment,
        signOverride: override,
      }
    }
    return segment
  })
}
