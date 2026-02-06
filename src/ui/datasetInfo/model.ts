export interface LatestPointer {
  datasetHash: string
  publishedAt: string
  manifestPath?: string
  schemaVersion?: number
}

export interface DatasetManifest {
  districtId: string
  districtName: string
  schemaVersion: number
  datasetHash: string
  configHash: string
  generatedAt: string
  publishedAt: string
  metaSha256: string
  packSha256: string
  totalBytes: number
  gateResult?: string
  overrideReason?: string | null
}

export interface DatasetMetaSummary {
  districtId?: string
  districtName?: string
  schemaVersion?: number
  metricsSchemaVersion?: number
  datasetHash?: string
  configHash?: string
  generatedAt?: string
  publishedAt?: string
  segmentsCount?: number
  overridesAppliedCount?: number
  signOverridesCount?: number
  curbMarkingKnownRate?: number
  restrictionTriggeredRate?: number
  provenanceFetchedAt?: string | null
  totalBytes?: number
  files?: Record<string, { sha256: string; bytes: number }>
}

export interface MetricsHistoryEntry {
  schemaVersion: number
  publishedAt: string
  packId: string
  districtId: string
  segmentsCount: number
  overridesAppliedCount: number
  signOverridesCount: number
  curbMarkingKnownRate: number
  restrictionTriggeredRate: number
  provenanceFetchedAt: string | null
}

export interface HealthDelta {
  key: string
  label: string
  value: string
  warn: boolean
}

export interface IngestReport {
  districts?: Array<{
    districtId?: string
    warnings?: Array<{ severity?: string; code?: string; message?: string }>
  }>
}

export interface DatasetInfoModel {
  districtId: string
  districtName: string
  dataSource: string
  schemaVersion: string
  datasetHash: string
  configHash: string
  generatedAt: string
  publishedAt: string
  metaSha256: string
  packSha256: string
  totalBytes: string
  gateResult: string
  anomalies: string[]
  health: {
    districtId: string
    lastUpdated: string
    publishedAt: string
    segmentsCount: string
    signOverridesCount: string
    overridesAppliedCount: string
    curbMarkingKnownRate: string
    restrictionTriggeredRate: string
    warnings: string[]
    deltas: HealthDelta[]
  }
}

const fallback = (value?: string | number | null) => {
  if (value === undefined || value === null) {
    return '-'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return value
}

const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-'
  }
  return `${(value * 100).toFixed(1)}%`
}

const formatSigned = (value: number | null, decimals = 0, suffix = '') => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const fixed = Math.abs(value).toFixed(decimals)
  return `${sign}${fixed}${suffix}`
}

const formatSignedPercent = (value: number | null, decimals = 1) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return formatSigned(value * 100, decimals, '%')
}

const formatSignedPoints = (value: number | null, decimals = 1) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return formatSigned(value * 100, decimals, 'pp')
}

const parseMetricsHistory = (raw?: string | null): MetricsHistoryEntry[] => {
  if (!raw) {
    return []
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as MetricsHistoryEntry
        if (parsed && typeof parsed.districtId === 'string') {
          return parsed
        }
      } catch {
        return null
      }
      return null
    })
    .filter((entry): entry is MetricsHistoryEntry => Boolean(entry))
}

const findPreviousEntry = (
  entries: MetricsHistoryEntry[],
  currentPublishedAt: string | null,
) => {
  if (entries.length === 0) {
    return null
  }
  const lastEntry = entries[entries.length - 1]
  if (currentPublishedAt && lastEntry.publishedAt === currentPublishedAt) {
    return entries.length > 1 ? entries[entries.length - 2] : null
  }
  return lastEntry
}

const computeDelta = (prev: number | null, next: number | null) => {
  if (prev === null || next === null) {
    return { delta: null, deltaPct: null }
  }
  const delta = next - prev
  const deltaPct = prev !== 0 ? delta / prev : null
  return { delta, deltaPct }
}

export const buildDatasetInfoModel = (params: {
  latest: LatestPointer | null
  meta: DatasetMetaSummary | null
  manifest: DatasetManifest | null
  report: IngestReport | null
  metricsHistory?: string | null
  dataSource?: string
}): DatasetInfoModel => {
  const districtId = params.meta?.districtId ?? params.manifest?.districtId ?? '-'
  const districtName =
    params.meta?.districtName ?? params.manifest?.districtName ?? '-'

  const warnings =
    params.report?.districts?.find((district) => district.districtId === districtId)
      ?.warnings ?? []
  const anomalies = warnings
    .filter((warning) => warning.severity && warning.severity !== 'INFO')
    .map((warning) => warning.message ?? warning.code ?? 'Unknown warning')
    .slice(0, 3)

  const segmentsCount =
    typeof params.meta?.segmentsCount === 'number' ? params.meta.segmentsCount : null
  const overridesAppliedCount =
    typeof params.meta?.overridesAppliedCount === 'number'
      ? params.meta.overridesAppliedCount
      : null
  const signOverridesCount =
    typeof params.meta?.signOverridesCount === 'number'
      ? params.meta.signOverridesCount
      : null
  const curbMarkingKnownRate =
    typeof params.meta?.curbMarkingKnownRate === 'number'
      ? params.meta.curbMarkingKnownRate
      : null
  const restrictionTriggeredRate =
    typeof params.meta?.restrictionTriggeredRate === 'number'
      ? params.meta.restrictionTriggeredRate
      : null

  const metricsEntries = parseMetricsHistory(params.metricsHistory).filter(
    (entry) => entry.districtId === districtId,
  )
  const publishedAtRaw =
    typeof params.meta?.publishedAt === 'string'
      ? params.meta.publishedAt
      : typeof params.latest?.publishedAt === 'string'
        ? params.latest.publishedAt
        : typeof params.manifest?.publishedAt === 'string'
          ? params.manifest.publishedAt
          : null
  const previousEntry = findPreviousEntry(metricsEntries, publishedAtRaw)

  const segmentsDelta = computeDelta(
    previousEntry ? previousEntry.segmentsCount : null,
    segmentsCount,
  )
  const overridesDelta = computeDelta(
    previousEntry ? previousEntry.overridesAppliedCount : null,
    overridesAppliedCount,
  )
  const curbDelta = computeDelta(
    previousEntry ? previousEntry.curbMarkingKnownRate : null,
    curbMarkingKnownRate,
  )
  const restrictionDelta = computeDelta(
    previousEntry ? previousEntry.restrictionTriggeredRate : null,
    restrictionTriggeredRate,
  )

  const segmentDeltaLabel =
    segmentsDelta.delta === null
      ? '-'
      : `${formatSigned(segmentsDelta.delta, 0)}${
          segmentsDelta.deltaPct !== null
            ? ` (${formatSignedPercent(segmentsDelta.deltaPct)})`
            : ''
        }`
  const overridesDeltaLabel =
    overridesDelta.delta === null ? '-' : formatSigned(overridesDelta.delta, 0)
  const curbDeltaLabel =
    curbDelta.delta === null ? '-' : formatSignedPoints(curbDelta.delta)
  const restrictionDeltaLabel =
    restrictionDelta.delta === null
      ? '-'
      : formatSignedPoints(restrictionDelta.delta)

  const deltaBadges: HealthDelta[] = [
    {
      key: 'segments',
      label: 'Segments Δ',
      value: segmentDeltaLabel,
      warn: segmentsDelta.deltaPct !== null && segmentsDelta.deltaPct <= -0.1,
    },
    {
      key: 'overrides',
      label: 'Overrides Δ',
      value: overridesDeltaLabel,
      warn: false,
    },
    {
      key: 'curbKnown',
      label: 'Curb known Δ',
      value: curbDeltaLabel,
      warn: curbDelta.delta !== null && curbDelta.delta <= -0.1,
    },
    {
      key: 'restrictions',
      label: 'Restrictions Δ',
      value: restrictionDeltaLabel,
      warn: restrictionDelta.delta !== null && restrictionDelta.delta <= -0.01,
    },
  ]

  const overridesRatio =
    segmentsCount && overridesAppliedCount !== null
      ? overridesAppliedCount / segmentsCount
      : null

  const healthWarnings: string[] = []
  if (curbMarkingKnownRate !== null && curbMarkingKnownRate < 0.1) {
    healthWarnings.push('Low curb marking coverage')
  }
  if (restrictionTriggeredRate !== null && restrictionTriggeredRate < 0.01) {
    healthWarnings.push('Low restriction trigger rate')
  }
  if (overridesRatio !== null && overridesRatio > 0.2) {
    healthWarnings.push('High override volume')
  }

  const publishedAt = fallback(
    params.latest?.publishedAt ?? params.manifest?.publishedAt,
  )
  const lastUpdated = fallback(
    params.meta?.provenanceFetchedAt ??
      params.meta?.generatedAt ??
      params.manifest?.generatedAt,
  )

  return {
    districtId,
    districtName,
    dataSource: params.dataSource ?? '-',
    schemaVersion: fallback(
      params.meta?.schemaVersion ?? params.manifest?.schemaVersion,
    ),
    datasetHash: fallback(
      params.meta?.datasetHash ?? params.latest?.datasetHash ?? params.manifest?.datasetHash,
    ),
    configHash: fallback(params.meta?.configHash ?? params.manifest?.configHash),
    generatedAt: fallback(params.meta?.generatedAt ?? params.manifest?.generatedAt),
    publishedAt,
    metaSha256: fallback(params.manifest?.metaSha256),
    packSha256: fallback(params.manifest?.packSha256),
    totalBytes: fallback(
      params.manifest?.totalBytes ?? params.meta?.totalBytes ?? null,
    ),
    gateResult: fallback(params.manifest?.gateResult),
    anomalies: anomalies.length > 0 ? anomalies : ['-'],
    health: {
      districtId,
      lastUpdated,
      publishedAt,
      segmentsCount: fallback(segmentsCount),
      signOverridesCount: fallback(signOverridesCount),
      overridesAppliedCount: fallback(overridesAppliedCount),
      curbMarkingKnownRate: formatPercent(curbMarkingKnownRate),
      restrictionTriggeredRate: formatPercent(restrictionTriggeredRate),
      warnings: healthWarnings,
      deltas: deltaBadges,
    },
  }
}
