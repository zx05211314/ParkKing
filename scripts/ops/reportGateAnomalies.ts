import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { TextDecoder } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { Geometry } from 'geojson'
import { diffPacks, type DistrictDiff, type DiffIssue, type PackDiffReport } from './diffPacks'

interface CliArgs {
  districtId: string | null
  packPath: string | null
  outPath: string | null
}

interface DeltaField {
  prev: number | null
  next: number | null
  delta: number | null
  deltaPct: number | null
}

interface ParsingFallbackBucket {
  used: boolean
  evidence: string[]
}

interface ParsingFallbackSummary {
  big5Fallback: ParsingFallbackBucket
  tabDelimiter: ParsingFallbackBucket
  headerMatchFallback: ParsingFallbackBucket
  missingPrjHeuristic: ParsingFallbackBucket
}

interface InvalidGeometryLayerSummary {
  layer: string
  totalFeatures: number
  nullGeometry: number
  invalidCoordinates: number
  totalInvalid: number
}

interface GateAnomalyReport {
  schemaVersion: number
  generatedAt: string
  districtId: string
  packPath: string
  outPath: string
  diffReportPath: string | null
  prevPackPath: string | null
  nextPackPath: string
  prevPublishedAt: string | null
  nextPublishedAt: string | null
  prevDistrictIds: string[]
  nextDistrictIds: string[]
  parsingFallbacks: ParsingFallbackSummary
  invalidGeometry: {
    layers: InvalidGeometryLayerSummary[]
    totalInvalid: number
  }
  thresholdDeltas: {
    issues: Array<{
      severity: string
      code: string
      message: string
      metric?: Record<string, unknown>
      threshold?: Record<string, unknown>
    }>
    deltas: Array<{
      field: string
      layer: string
      prev: number | null
      next: number | null
      delta: number | null
      deltaPct: number | null
    }>
  }
  bboxCenterAnomalies: Array<{
    severity: 'INFO' | 'WARN' | 'FAIL'
    code: string
    message: string
    metric?: Record<string, unknown>
  }>
  topOffenders: {
    biggestCountDelta: {
      field: string
      layer: string
      prev: number | null
      next: number | null
      delta: number | null
      deltaPct: number | null
    } | null
    metricTrigger: {
      severity: string
      code: string
      message: string
      metric?: Record<string, unknown>
      threshold?: Record<string, unknown>
    } | null
  }
}

const DEFAULT_DATASET_ROOTS = ['public/data/generated', 'data/generated']
const KNOWN_LAYER_FILES = [
  'red_yellow.geojson',
  'bus_stops.geojson',
  'hydrants.geojson',
  'intersections.geojson',
  'crosswalks.geojson',
  'sign_overrides.geojson',
  'candidates_inferred.geojson',
  'overrides_applied.geojson',
]

const DELTA_FIELDS = [
  { field: 'segmentsCount', layer: 'red_yellow.geojson' },
  { field: 'overridesAppliedCount', layer: 'overrides_applied.geojson' },
  { field: 'signOverridesCount', layer: 'sign_overrides.geojson' },
  { field: 'curbMarkingKnownRate', layer: 'dataset_meta.json' },
  { field: 'restrictionTriggeredRate', layer: 'dataset_meta.json' },
] as const

type ThresholdDeltaEntry = GateAnomalyReport['thresholdDeltas']['deltas'][number]

const parseArgs = (argv: string[]): CliArgs => {
  const args = [...argv]
  const districtIndex = args.findIndex((arg) => arg === '--district')
  const packIndex = args.findIndex((arg) => arg === '--pack')
  const outIndex = args.findIndex((arg) => arg === '--out')
  return {
    districtId: districtIndex >= 0 ? args[districtIndex + 1] ?? null : null,
    packPath: packIndex >= 0 ? args[packIndex + 1] ?? null : null,
    outPath: outIndex >= 0 ? args[outIndex + 1] ?? null : null,
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

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const resolvePackPath = async (districtId: string, packPath: string | null) => {
  if (packPath) {
    const resolved = path.resolve(packPath)
    if (await fileExists(path.resolve(resolved, 'dataset_meta.json'))) {
      return resolved
    }
    const nested = path.resolve(resolved, districtId)
    if (await fileExists(path.resolve(nested, 'dataset_meta.json'))) {
      return nested
    }
    throw new Error(`Could not locate dataset_meta.json in pack path: ${packPath}`)
  }

  for (const root of DEFAULT_DATASET_ROOTS) {
    const candidate = path.resolve(root, districtId)
    if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
      return candidate
    }
  }

  throw new Error(`Could not locate latest published pack for district: ${districtId}`)
}

const parseBBox = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  const minX = Number(candidate.minX)
  const minY = Number(candidate.minY)
  const maxX = Number(candidate.maxX)
  const maxY = Number(candidate.maxY)
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null
  }
  return { minX, minY, maxX, maxY }
}

const parseCenter = (value: unknown) => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }
  const x = Number(value[0])
  const y = Number(value[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return [x, y] as [number, number]
}

const normalizeForCompare = (value: string) => value.toLowerCase().replace(/\s+/g, '')

const analyzeCsvHeaderFallbacks = (firstLine: string) => {
  if (!firstLine) {
    return { tabDelimiter: false, headerMatchFallback: false }
  }
  const tabDelimiter = firstLine.includes('\t') && !firstLine.includes(',')
  const delimiter = tabDelimiter ? '\t' : ','
  const headers = firstLine
    .split(delimiter)
    .map((header) => header.trim())
    .filter(Boolean)
  if (headers.length === 0) {
    return { tabDelimiter, headerMatchFallback: false }
  }

  const normalized = headers.map((header) => normalizeForCompare(header))
  const hasDirectLat = normalized.some((key) =>
    ['lat', 'latitude', 'lat_wgs84', 'y_wgs84'].includes(key),
  )
  const hasDirectLon = normalized.some((key) =>
    ['lon', 'lng', 'longitude', 'lon_wgs84', 'x_wgs84'].includes(key),
  )
  const hasDirectX = normalized.some((key) =>
    ['x', 'tm2_x', 'twd97_x', 'x_twd97'].includes(key),
  )
  const hasDirectY = normalized.some((key) =>
    ['y', 'tm2_y', 'twd97_y', 'y_twd97'].includes(key),
  )
  const hasDirect = (hasDirectLat && hasDirectLon) || (hasDirectX && hasDirectY)
  const patternHit = headers.some((header) =>
    /wgs|tm2|twd97|lat|lon|lng|longitude|latitude|x|y/i.test(header),
  )

  return {
    tabDelimiter,
    headerMatchFallback: !hasDirect && patternHit,
  }
}

const analyzeParsingFallbacks = async (
  sourceFiles: string[],
): Promise<ParsingFallbackSummary> => {
  const big5Evidence = new Set<string>()
  const tabEvidence = new Set<string>()
  const headerEvidence = new Set<string>()
  const missingPrjEvidence = new Set<string>()

  for (const sourcePath of sourceFiles) {
    const normalizedPath = path.resolve(sourcePath)
    const ext = path.extname(normalizedPath).toLowerCase()
    if (ext === '.csv' && (await fileExists(normalizedPath))) {
      const buffer = await fs.readFile(normalizedPath)
      let decodedText = ''
      let utf8Valid = true
      try {
        decodedText = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        utf8Valid = false
        decodedText = new TextDecoder('big5').decode(buffer)
      }
      if (!utf8Valid) {
        big5Evidence.add(normalizedPath)
      }
      const firstLine = decodedText.split(/\r?\n/, 1)[0] ?? ''
      const headerAnalysis = analyzeCsvHeaderFallbacks(firstLine)
      if (headerAnalysis.tabDelimiter) {
        tabEvidence.add(normalizedPath)
      }
      if (headerAnalysis.headerMatchFallback) {
        headerEvidence.add(normalizedPath)
      }
      continue
    }

    if (ext === '.shp') {
      const prjPath = normalizedPath.replace(/\.shp$/i, '.prj')
      if (!(await fileExists(prjPath))) {
        missingPrjEvidence.add(normalizedPath)
      }
    }
  }

  const toBucket = (evidence: Set<string>): ParsingFallbackBucket => ({
    used: evidence.size > 0,
    evidence: Array.from(evidence).sort((a, b) => a.localeCompare(b)),
  })

  return {
    big5Fallback: toBucket(big5Evidence),
    tabDelimiter: toBucket(tabEvidence),
    headerMatchFallback: toBucket(headerEvidence),
    missingPrjHeuristic: toBucket(missingPrjEvidence),
  }
}

const collectCoordinateNumbers = (coords: unknown, result: number[]) => {
  if (Array.isArray(coords)) {
    coords.forEach((value) => collectCoordinateNumbers(value, result))
    return
  }
  if (typeof coords === 'number') {
    result.push(coords)
  }
}

const hasValidCoordinates = (geometry: Geometry | null) => {
  if (!geometry) {
    return false
  }
  if (geometry.type === 'GeometryCollection') {
    if (geometry.geometries.length === 0) {
      return false
    }
    return geometry.geometries.every((child) => hasValidCoordinates(child))
  }
  const values: number[] = []
  collectCoordinateNumbers((geometry as Geometry & { coordinates?: unknown }).coordinates, values)
  if (values.length < 2 || values.length % 2 !== 0) {
    return false
  }
  return values.every((value) => Number.isFinite(value))
}

const summarizeInvalidGeometry = async (
  filePath: string,
): Promise<InvalidGeometryLayerSummary | null> => {
  if (!(await fileExists(filePath))) {
    return null
  }

  let parsed: { features?: Array<{ geometry?: Geometry | null }> } | null = null
  try {
    parsed = await readJson<{ features?: Array<{ geometry?: Geometry | null }> }>(filePath)
  } catch {
    return {
      layer: path.basename(filePath),
      totalFeatures: 0,
      nullGeometry: 0,
      invalidCoordinates: 0,
      totalInvalid: 1,
    }
  }

  const features = parsed?.features ?? []
  let nullGeometry = 0
  let invalidCoordinates = 0
  features.forEach((feature) => {
    if (!feature.geometry) {
      nullGeometry += 1
      return
    }
    if (!hasValidCoordinates(feature.geometry)) {
      invalidCoordinates += 1
    }
  })
  return {
    layer: path.basename(filePath),
    totalFeatures: features.length,
    nullGeometry,
    invalidCoordinates,
    totalInvalid: nullGeometry + invalidCoordinates,
  }
}

const pickDelta = (delta: Record<string, unknown> | undefined): DeltaField | null => {
  if (!delta) {
    return null
  }
  const prev = Number(delta.prev)
  const next = Number(delta.next)
  const deltaValue = Number(delta.delta)
  const deltaPct = Number(delta.deltaPct)
  return {
    prev: Number.isFinite(prev) ? prev : null,
    next: Number.isFinite(next) ? next : null,
    delta: Number.isFinite(deltaValue) ? deltaValue : null,
    deltaPct: Number.isFinite(deltaPct) ? deltaPct : null,
  }
}

const extractDistrictDiff = (
  diffReport: PackDiffReport | null,
  districtId: string,
): DistrictDiff | null => {
  if (!diffReport?.districts?.length) {
    return null
  }
  return diffReport.districts.find((entry) => entry.districtId === districtId) ?? null
}

const issueSeverityOrder = (severity: string) => {
  if (severity === 'FAIL') {
    return 0
  }
  if (severity === 'WARN') {
    return 1
  }
  return 2
}

const sortIssues = <T extends { severity: string; code: string }>(issues: T[]) => {
  return [...issues].sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    return a.code.localeCompare(b.code)
  })
}

const metricMagnitude = (metric: Record<string, unknown> | undefined) => {
  if (!metric) {
    return 0
  }
  const candidates = ['drop', 'deltaPct', 'ratio', 'delta']
  for (const key of candidates) {
    const value = Number(metric[key])
    if (Number.isFinite(value)) {
      return Math.abs(value)
    }
  }
  return 0
}

const selectMetricTrigger = (issues: DiffIssue[]) => {
  if (issues.length === 0) {
    return null
  }
  const ranked = [...issues].sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    const magnitudeDelta = metricMagnitude(b.metric) - metricMagnitude(a.metric)
    if (magnitudeDelta !== 0) {
      return magnitudeDelta
    }
    return a.code.localeCompare(b.code)
  })
  const selected = ranked[0]
  if (!selected) {
    return null
  }
  return {
    severity: selected.severity,
    code: selected.code,
    message: selected.message,
    metric: selected.metric,
    threshold: selected.threshold,
  }
}

const resolveDiffReport = async (
  districtId: string,
  packPath: string,
): Promise<{ path: string | null; report: PackDiffReport | null }> => {
  const diffReportPath = path.resolve(packPath, 'diff_report.json')
  if (await fileExists(diffReportPath)) {
    return {
      path: diffReportPath,
      report: await readJson<PackDiffReport>(diffReportPath),
    }
  }

  const parentCandidate = path.resolve(path.dirname(packPath), districtId)
  if (
    parentCandidate !== packPath &&
    (await fileExists(path.resolve(parentCandidate, 'dataset_meta.json')))
  ) {
    const report = await diffPacks({
      prevDir: parentCandidate,
      nextDir: packPath,
    })
    return { path: null, report }
  }

  return { path: null, report: null }
}

const resolveDistrictMetaPath = async (
  packPath: string | null,
  districtId: string,
) => {
  if (!packPath) {
    return null
  }
  const directMeta = path.resolve(packPath, 'dataset_meta.json')
  if (await fileExists(directMeta)) {
    return directMeta
  }
  const nestedMeta = path.resolve(packPath, districtId, 'dataset_meta.json')
  if (await fileExists(nestedMeta)) {
    return nestedMeta
  }
  return null
}

const readPublishedAt = async (packPath: string | null, districtId: string) => {
  const metaPath = await resolveDistrictMetaPath(packPath, districtId)
  if (!metaPath) {
    return null
  }
  try {
    const meta = await readJson<Record<string, unknown>>(metaPath)
    return typeof meta.publishedAt === 'string' ? meta.publishedAt : null
  } catch {
    return null
  }
}

const listDistrictIdsInPack = async (packPath: string | null) => {
  if (!packPath) {
    return []
  }
  const directMetaPath = path.resolve(packPath, 'dataset_meta.json')
  if (await fileExists(directMetaPath)) {
    try {
      const meta = await readJson<Record<string, unknown>>(directMetaPath)
      const districtId =
        typeof meta.districtId === 'string' && meta.districtId.trim().length > 0
          ? meta.districtId
          : path.basename(packPath)
      return [districtId]
    } catch {
      return [path.basename(packPath)]
    }
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>> = []
  try {
    entries = await fs.readdir(packPath, { withFileTypes: true })
  } catch {
    return []
  }

  const districtIds: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name.startsWith('.') || entry.name === '_ops') {
      continue
    }
    const metaPath = path.resolve(packPath, entry.name, 'dataset_meta.json')
    if (await fileExists(metaPath)) {
      districtIds.push(entry.name)
    }
  }
  return districtIds.sort((a, b) => a.localeCompare(b))
}

const boundaryAnomalies = (
  meta: Record<string, unknown>,
  districtDiff: DistrictDiff | null,
) => {
  const anomalies: GateAnomalyReport['bboxCenterAnomalies'] = []
  const boundaryBBox = parseBBox(meta.boundaryBBox)
  const boundaryCenter = parseCenter(meta.boundaryCenter)

  if (!boundaryBBox) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_BBOX_MISSING',
      message: 'boundaryBBox is missing or invalid in dataset_meta',
    })
  }
  if (!boundaryCenter) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_CENTER_MISSING',
      message: 'boundaryCenter is missing or invalid in dataset_meta',
    })
  }

  if (boundaryBBox && boundaryCenter) {
    const [x, y] = boundaryCenter
    const outside =
      x < boundaryBBox.minX ||
      x > boundaryBBox.maxX ||
      y < boundaryBBox.minY ||
      y > boundaryBBox.maxY
    if (outside) {
      anomalies.push({
        severity: 'FAIL',
        code: 'BOUNDARY_CENTER_OUTSIDE_BBOX',
        message: 'boundaryCenter falls outside boundaryBBox',
        metric: {
          boundaryCenter,
          boundaryBBox,
        },
      })
    }
  }

  const area = boundaryBBox
    ? Math.max(
        0,
        (boundaryBBox.maxX - boundaryBBox.minX) * (boundaryBBox.maxY - boundaryBBox.minY),
      )
    : null
  if (area !== null && area <= 1e-10) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_BBOX_NEAR_ZERO',
      message: 'boundaryBBox area is near zero',
      metric: { area },
    })
  }

  districtDiff?.issues.forEach((issue) => {
    if (!/BBOX|CENTER/i.test(issue.code)) {
      return
    }
    anomalies.push({
      severity: issue.severity === 'FAIL' ? 'FAIL' : 'WARN',
      code: issue.code,
      message: issue.message,
      metric: issue.metric,
    })
  })

  return anomalies.sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    return a.code.localeCompare(b.code)
  })
}

const buildTopCountDelta = (deltas: GateAnomalyReport['thresholdDeltas']['deltas']) => {
  const countsOnly = deltas.filter((entry) =>
    ['segmentsCount', 'overridesAppliedCount', 'signOverridesCount'].includes(entry.field),
  )
  const ranked = [...countsOnly].sort((a, b) => {
    const absA = Math.abs(a.delta ?? 0)
    const absB = Math.abs(b.delta ?? 0)
    if (absA !== absB) {
      return absB - absA
    }
    return a.field.localeCompare(b.field)
  })
  const top = ranked[0]
  if (!top || top.delta === null) {
    return null
  }
  return top
}

export const buildGateAnomalyReport = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyReport> => {
  const districtId = params.districtId.trim()
  if (!districtId) {
    throw new Error('--district <id> is required')
  }

  const packPath = await resolvePackPath(districtId, params.packPath ?? null)
  const outPath = path.resolve(
    params.outPath ?? path.resolve('reports', `gate_anomalies_${districtId}.json`),
  )
  const metaPath = path.resolve(packPath, 'dataset_meta.json')
  const meta = await readJson<Record<string, unknown>>(metaPath)
  const { path: diffReportPath, report: diffReport } = await resolveDiffReport(
    districtId,
    packPath,
  )
  const reportedPrevPackPath =
    diffReport?.prevPath && diffReport.prevPath.trim().length > 0
      ? path.resolve(diffReport.prevPath)
      : null
  const reportedNextPackPath =
    diffReport?.nextPath && diffReport.nextPath.trim().length > 0
      ? path.resolve(diffReport.nextPath)
      : path.resolve(packPath)
  const nextPackPath =
    (await fileExists(path.resolve(reportedNextPackPath, 'dataset_meta.json'))) ||
    (await fileExists(path.resolve(reportedNextPackPath, districtId, 'dataset_meta.json')))
      ? reportedNextPackPath
      : path.resolve(packPath)
  const prevPackPath = reportedPrevPackPath

  const [prevPublishedAt, nextPublishedAt, prevDistrictIds, nextDistrictIds] =
    await Promise.all([
      readPublishedAt(prevPackPath, districtId),
      readPublishedAt(nextPackPath, districtId),
      listDistrictIdsInPack(prevPackPath),
      listDistrictIdsInPack(nextPackPath),
    ])
  const districtDiff = extractDistrictDiff(diffReport, districtId)

  const sourceFiles = Array.isArray(meta.sourceFiles)
    ? (meta.sourceFiles as Array<{ path?: unknown }>)
        .map((entry) => entry?.path)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  const parsingFallbacks = await analyzeParsingFallbacks(sourceFiles)

  const allFilesInPack = await fs.readdir(packPath)
  const boundaryFiles = allFilesInPack
    .filter((entry) => /_boundary\.geojson$/i.test(entry))
    .sort((a, b) => a.localeCompare(b))
  const layerFiles = [...KNOWN_LAYER_FILES, ...boundaryFiles]
  const invalidGeometryLayers: InvalidGeometryLayerSummary[] = []
  for (const fileName of layerFiles) {
    const summary = await summarizeInvalidGeometry(path.resolve(packPath, fileName))
    if (!summary) {
      continue
    }
    invalidGeometryLayers.push(summary)
  }
  invalidGeometryLayers.sort((a, b) => a.layer.localeCompare(b.layer))

  const issues = sortIssues(districtDiff?.issues ?? []).map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    metric: issue.metric,
    threshold: issue.threshold,
  }))

  const rawMeta = (districtDiff?.meta ?? {}) as Record<string, Record<string, unknown> | undefined>
  const deltas: ThresholdDeltaEntry[] = []
  DELTA_FIELDS.forEach(({ field, layer }) => {
    const delta = pickDelta(rawMeta[field])
    if (!delta) {
      return
    }
    deltas.push({
      field,
      layer,
      prev: delta.prev,
      next: delta.next,
      delta: delta.delta,
      deltaPct: delta.deltaPct,
    })
  })

  const report: GateAnomalyReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    districtId,
    packPath,
    outPath,
    diffReportPath,
    prevPackPath,
    nextPackPath,
    prevPublishedAt,
    nextPublishedAt,
    prevDistrictIds,
    nextDistrictIds,
    parsingFallbacks,
    invalidGeometry: {
      layers: invalidGeometryLayers,
      totalInvalid: invalidGeometryLayers.reduce((sum, layer) => sum + layer.totalInvalid, 0),
    },
    thresholdDeltas: {
      issues,
      deltas,
    },
    bboxCenterAnomalies: boundaryAnomalies(meta, districtDiff),
    topOffenders: {
      biggestCountDelta: buildTopCountDelta(deltas),
      metricTrigger: selectMetricTrigger(districtDiff?.issues ?? []),
    },
  }

  return report
}

export const reportGateAnomalies = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}) => {
  const report = await buildGateAnomalyReport(params)
  await fs.mkdir(path.dirname(report.outPath), { recursive: true })
  await fs.writeFile(report.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
  return report
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.districtId) {
    throw new Error('Usage: tsx scripts/ops/reportGateAnomalies.ts --district <id> [--pack <path>] [--out <path>]')
  }
  const report = await reportGateAnomalies({
    districtId: args.districtId,
    packPath: args.packPath,
    outPath: args.outPath,
  })
  console.log(`Wrote anomaly report for ${report.districtId} to ${report.outPath}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
