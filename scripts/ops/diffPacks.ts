import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import fg from 'fast-glob'

export type DiffSeverity = 'OK' | 'WARN' | 'FAIL'

export interface DiffIssue {
  severity: 'WARN' | 'FAIL'
  code: string
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}

export interface PackDiffReport {
  schemaVersion: number
  generatedAt: string
  prevPath: string | null
  nextPath: string
  firstPublish: boolean
  districts: DistrictDiff[]
  summary: {
    districtsAdded: string[]
    districtsRemoved: string[]
    totalChangedFiles: number
  }
}

export interface DistrictDiff {
  districtId: string
  status: 'ADDED' | 'REMOVED' | 'UPDATED' | 'UNCHANGED'
  severity: DiffSeverity
  issues: DiffIssue[]
  meta: {
    segmentsCount: Delta<number>
    overridesAppliedCount: Delta<number>
    signOverridesCount: Delta<number>
    curbMarkingKnownRate: Delta<number>
    restrictionTriggeredRate: Delta<number>
    boundaryBBox: BBoxDelta
    boundaryCenter: CenterDelta
    provenanceFetchedAt: {
      prev: string | null
      next: string | null
      changed: boolean
    }
  }
  files: {
    added: string[]
    removed: string[]
    modified: Array<{
      path: string
      prev: FileEntry | null
      next: FileEntry | null
    }>
  }
}

interface FileEntry {
  sha256: string
  bytes: number
}

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Delta<T> {
  prev: T | null
  next: T | null
  delta: T | null
  deltaPct: number | null
}

interface BBoxDelta {
  prev: BBox | null
  next: BBox | null
  delta: BBox | null
  area: Delta<number>
}

interface CenterDelta {
  prev: [number, number] | null
  next: [number, number] | null
  delta: [number, number] | null
  distance: number | null
}

const DIFF_SCHEMA_VERSION = 1
const DEFAULT_REPORT_NAME = 'diff_report.json'

const WARN_THRESHOLDS = {
  segmentsDeltaPct: 0.1,
  curbMarkingDrop: 0.1,
  restrictionTriggeredDrop: 0.01,
  overridesRatio: 0.3,
}

const FAIL_THRESHOLDS = {
  bboxNearZeroArea: 1e-10,
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const prevIndex = args.findIndex((arg) => arg === '--prev')
  const nextIndex = args.findIndex((arg) => arg === '--next')
  const outIndex = args.findIndex((arg) => arg === '--out')
  const formatIndex = args.findIndex((arg) => arg === '--format')
  return {
    prev: prevIndex >= 0 ? args[prevIndex + 1] : null,
    next: nextIndex >= 0 ? args[nextIndex + 1] : null,
    out: outIndex >= 0 ? args[outIndex + 1] : null,
    format: formatIndex >= 0 ? args[formatIndex + 1] : null,
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

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const hashFile = async (filePath: string): Promise<FileEntry> => {
  const buffer = await fs.readFile(filePath)
  return { sha256: hashBuffer(buffer), bytes: buffer.length }
}

const normalizeRelPath = (baseDir: string, filePath: string) => {
  return path.relative(baseDir, filePath).replace(/\\/g, '/')
}

const listFiles = async (dir: string): Promise<string[]> => {
  const globRoot = dir.replace(/\\/g, '/')
  const matches = await fg(`${globRoot}/**`, { onlyFiles: true, dot: true })
  return matches.map((entry) => normalizeRelPath(dir, entry))
}

const readMeta = async (dir: string): Promise<Record<string, unknown> | null> => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (!(await fileExists(metaPath))) {
    return null
  }
  try {
    return await readJson<Record<string, unknown>>(metaPath)
  } catch {
    return null
  }
}

const getMetaFiles = (meta: Record<string, unknown> | null) => {
  if (!meta || typeof meta !== 'object') {
    return null
  }
  const files = meta.files
  if (!files || typeof files !== 'object') {
    return null
  }
  return files as Record<string, FileEntry>
}

const buildFileMap = async (
  dir: string,
  metaFiles: Record<string, FileEntry> | null,
): Promise<Map<string, FileEntry>> => {
  const entries = await listFiles(dir)
  entries.sort((a, b) => a.localeCompare(b))
  const result = new Map<string, FileEntry>()

  for (const relPath of entries) {
    const metaEntry = metaFiles?.[relPath]
    if (
      metaEntry &&
      typeof metaEntry.sha256 === 'string' &&
      typeof metaEntry.bytes === 'number'
    ) {
      result.set(relPath, { sha256: metaEntry.sha256, bytes: metaEntry.bytes })
    } else {
      const filePath = path.resolve(dir, relPath)
      result.set(relPath, await hashFile(filePath))
    }
  }

  return result
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseBBox = (value: unknown): BBox | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  const minX = parseNumber(candidate.minX)
  const minY = parseNumber(candidate.minY)
  const maxX = parseNumber(candidate.maxX)
  const maxY = parseNumber(candidate.maxY)
  if (minX === null || minY === null || maxX === null || maxY === null) {
    return null
  }
  return { minX, minY, maxX, maxY }
}

const parseCenter = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }
  const x = parseNumber(value[0])
  const y = parseNumber(value[1])
  if (x === null || y === null) {
    return null
  }
  return [x, y]
}

const calcDelta = (prev: number | null, next: number | null): Delta<number> => {
  if (prev === null || next === null) {
    return { prev, next, delta: null, deltaPct: null }
  }
  const delta = next - prev
  const deltaPct = prev !== 0 ? delta / prev : null
  return { prev, next, delta, deltaPct }
}

const bboxArea = (bbox: BBox | null): number | null => {
  if (!bbox) {
    return null
  }
  const width = bbox.maxX - bbox.minX
  const height = bbox.maxY - bbox.minY
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }
  return Math.max(0, width * height)
}

const calcBBoxDelta = (prev: BBox | null, next: BBox | null): BBoxDelta => {
  const delta =
    prev && next
      ? {
          minX: next.minX - prev.minX,
          minY: next.minY - prev.minY,
          maxX: next.maxX - prev.maxX,
          maxY: next.maxY - prev.maxY,
        }
      : null

  const areaDelta = calcDelta(bboxArea(prev), bboxArea(next))

  return {
    prev,
    next,
    delta,
    area: areaDelta,
  }
}

const calcCenterDelta = (
  prev: [number, number] | null,
  next: [number, number] | null,
): CenterDelta => {
  if (!prev || !next) {
    return { prev, next, delta: null, distance: null }
  }
  const delta: [number, number] = [next[0] - prev[0], next[1] - prev[1]]
  const distance = Math.hypot(delta[0], delta[1])
  return { prev, next, delta, distance }
}

const diffFiles = (
  prevFiles: Map<string, FileEntry>,
  nextFiles: Map<string, FileEntry>,
) => {
  const prevKeys = Array.from(prevFiles.keys())
  const nextKeys = Array.from(nextFiles.keys())
  prevKeys.sort((a, b) => a.localeCompare(b))
  nextKeys.sort((a, b) => a.localeCompare(b))

  const added: string[] = []
  const removed: string[] = []
  const modified: Array<{ path: string; prev: FileEntry | null; next: FileEntry | null }> = []

  const prevSet = new Set(prevKeys)
  const nextSet = new Set(nextKeys)

  nextKeys.forEach((key) => {
    if (!prevSet.has(key)) {
      added.push(key)
      return
    }
    const prev = prevFiles.get(key)
    const next = nextFiles.get(key)
    if (prev && next && prev.sha256 !== next.sha256) {
      modified.push({ path: key, prev, next })
    }
  })

  prevKeys.forEach((key) => {
    if (!nextSet.has(key)) {
      removed.push(key)
    }
  })

  modified.sort((a, b) => a.path.localeCompare(b.path))

  return { added, removed, modified }
}

const sortIssues = (issues: DiffIssue[]) => {
  const severityOrder: Record<DiffIssue['severity'], number> = {
    FAIL: 0,
    WARN: 1,
  }
  issues.sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity]
    if (severity !== 0) {
      return severity
    }
    return a.code.localeCompare(b.code)
  })
}

const buildIssues = (params: {
  districtId: string
  segmentsCount: Delta<number>
  overridesAppliedCount: Delta<number>
  curbMarkingKnownRate: Delta<number>
  restrictionTriggeredRate: Delta<number>
  boundaryBBox: BBoxDelta
}) => {
  const issues: DiffIssue[] = []
  const segmentsPrev = params.segmentsCount.prev
  const segmentsNext = params.segmentsCount.next
  const segmentsDeltaPct = params.segmentsCount.deltaPct

  if (segmentsPrev !== null && segmentsNext !== null && segmentsPrev > 0 && segmentsNext === 0) {
    issues.push({
      severity: 'FAIL',
      code: 'DIFF_SEGMENTS_ZERO',
      message: `segmentsCount dropped to 0 for ${params.districtId}`,
      metric: { prev: segmentsPrev, next: segmentsNext },
      threshold: { min: 1 },
    })
  }

  if (
    segmentsDeltaPct !== null &&
    Math.abs(segmentsDeltaPct) > WARN_THRESHOLDS.segmentsDeltaPct
  ) {
    issues.push({
      severity: 'WARN',
      code: 'DIFF_SEGMENTS_DELTA_PCT',
      message: `segmentsCount changed more than ${WARN_THRESHOLDS.segmentsDeltaPct * 100}% for ${params.districtId}`,
      metric: {
        prev: segmentsPrev,
        next: segmentsNext,
        deltaPct: segmentsDeltaPct,
      },
      threshold: { maxPct: WARN_THRESHOLDS.segmentsDeltaPct },
    })
  }

  if (
    params.curbMarkingKnownRate.prev !== null &&
    params.curbMarkingKnownRate.next !== null
  ) {
    const drop = params.curbMarkingKnownRate.prev - params.curbMarkingKnownRate.next
    if (drop > WARN_THRESHOLDS.curbMarkingDrop) {
      issues.push({
        severity: 'WARN',
        code: 'DIFF_CURB_MARKING_DROP',
        message: `curbMarkingKnownRate dropped by more than ${WARN_THRESHOLDS.curbMarkingDrop} for ${params.districtId}`,
        metric: {
          prev: params.curbMarkingKnownRate.prev,
          next: params.curbMarkingKnownRate.next,
          drop,
        },
        threshold: { maxDrop: WARN_THRESHOLDS.curbMarkingDrop },
      })
    }
  }

  if (
    params.restrictionTriggeredRate.prev !== null &&
    params.restrictionTriggeredRate.next !== null
  ) {
    const drop =
      params.restrictionTriggeredRate.prev - params.restrictionTriggeredRate.next
    if (drop > WARN_THRESHOLDS.restrictionTriggeredDrop) {
      issues.push({
        severity: 'WARN',
        code: 'DIFF_RESTRICTION_DROP',
        message: `restrictionTriggeredRate dropped by more than ${WARN_THRESHOLDS.restrictionTriggeredDrop} for ${params.districtId}`,
        metric: {
          prev: params.restrictionTriggeredRate.prev,
          next: params.restrictionTriggeredRate.next,
          drop,
        },
        threshold: { maxDrop: WARN_THRESHOLDS.restrictionTriggeredDrop },
      })
    }
  }

  if (
    segmentsNext !== null &&
    segmentsNext > 0 &&
    params.overridesAppliedCount.next !== null
  ) {
    const ratio = params.overridesAppliedCount.next / segmentsNext
    if (ratio > WARN_THRESHOLDS.overridesRatio) {
      issues.push({
        severity: 'WARN',
        code: 'DIFF_OVERRIDES_RATIO_HIGH',
        message: `overridesAppliedCount ratio exceeds ${WARN_THRESHOLDS.overridesRatio} for ${params.districtId}`,
        metric: {
          ratio,
          overridesAppliedCount: params.overridesAppliedCount.next,
          segmentsCount: segmentsNext,
        },
        threshold: { maxRatio: WARN_THRESHOLDS.overridesRatio },
      })
    }
  }

  const prevArea = params.boundaryBBox.area.prev
  const nextArea = params.boundaryBBox.area.next
  if (prevArea !== null && nextArea !== null && prevArea > 0 && nextArea <= FAIL_THRESHOLDS.bboxNearZeroArea) {
    issues.push({
      severity: 'FAIL',
      code: 'DIFF_BBOX_COLLAPSE',
      message: `boundaryBBox area collapsed near zero for ${params.districtId}`,
      metric: { prevArea, nextArea },
      threshold: { minArea: FAIL_THRESHOLDS.bboxNearZeroArea },
    })
  }

  sortIssues(issues)
  return issues
}

const getSegmentsCount = (meta: Record<string, unknown> | null) => {
  if (!meta) {
    return null
  }
  const direct = parseNumber(meta.segmentsCount)
  if (direct !== null) {
    return direct
  }
  const counts = meta.counts
  if (counts && typeof counts === 'object') {
    return parseNumber((counts as Record<string, unknown>).segments)
  }
  return null
}

const getCountField = (meta: Record<string, unknown> | null, key: string) => {
  if (!meta) {
    return null
  }
  const direct = parseNumber(meta[key])
  if (direct !== null) {
    return direct
  }
  const counts = meta.counts
  if (counts && typeof counts === 'object') {
    return parseNumber((counts as Record<string, unknown>)[key])
  }
  return null
}

const hasMetaChanges = (meta: DistrictDiff['meta']) => {
  const deltas = [
    meta.segmentsCount.delta,
    meta.overridesAppliedCount.delta,
    meta.signOverridesCount.delta,
    meta.curbMarkingKnownRate.delta,
    meta.restrictionTriggeredRate.delta,
  ]
  if (deltas.some((delta) => delta !== null && delta !== 0)) {
    return true
  }
  const bboxDelta = meta.boundaryBBox.delta
  if (bboxDelta && Object.values(bboxDelta).some((value) => value !== 0)) {
    return true
  }
  const centerDelta = meta.boundaryCenter.delta
  if (centerDelta && (centerDelta[0] !== 0 || centerDelta[1] !== 0)) {
    return true
  }
  return meta.provenanceFetchedAt.changed
}

const buildDistrictDiff = async (params: {
  districtId: string
  prevDir: string | null
  nextDir: string | null
}): Promise<DistrictDiff> => {
  const prevMeta = params.prevDir ? await readMeta(params.prevDir) : null
  const nextMeta = params.nextDir ? await readMeta(params.nextDir) : null

  const prevFiles = params.prevDir
    ? await buildFileMap(params.prevDir, getMetaFiles(prevMeta))
    : new Map<string, FileEntry>()
  const nextFiles = params.nextDir
    ? await buildFileMap(params.nextDir, getMetaFiles(nextMeta))
    : new Map<string, FileEntry>()

  const files = diffFiles(prevFiles, nextFiles)

  const segmentsCount = calcDelta(getSegmentsCount(prevMeta), getSegmentsCount(nextMeta))
  const overridesAppliedCount = calcDelta(
    getCountField(prevMeta, 'overridesAppliedCount') ?? getCountField(prevMeta, 'overridesApplied'),
    getCountField(nextMeta, 'overridesAppliedCount') ?? getCountField(nextMeta, 'overridesApplied'),
  )
  const signOverridesCount = calcDelta(
    getCountField(prevMeta, 'signOverridesCount') ?? getCountField(prevMeta, 'signOverrides'),
    getCountField(nextMeta, 'signOverridesCount') ?? getCountField(nextMeta, 'signOverrides'),
  )
  const curbMarkingKnownRate = calcDelta(
    parseNumber(prevMeta?.curbMarkingKnownRate),
    parseNumber(nextMeta?.curbMarkingKnownRate),
  )
  const restrictionTriggeredRate = calcDelta(
    parseNumber(prevMeta?.restrictionTriggeredRate),
    parseNumber(nextMeta?.restrictionTriggeredRate),
  )
  const boundaryBBox = calcBBoxDelta(
    parseBBox(prevMeta?.boundaryBBox),
    parseBBox(nextMeta?.boundaryBBox),
  )
  const boundaryCenter = calcCenterDelta(
    parseCenter(prevMeta?.boundaryCenter),
    parseCenter(nextMeta?.boundaryCenter),
  )

  const provenancePrev =
    typeof prevMeta?.provenanceFetchedAt === 'string'
      ? prevMeta.provenanceFetchedAt
      : null
  const provenanceNext =
    typeof nextMeta?.provenanceFetchedAt === 'string'
      ? nextMeta.provenanceFetchedAt
      : null

  const meta = {
    segmentsCount,
    overridesAppliedCount,
    signOverridesCount,
    curbMarkingKnownRate,
    restrictionTriggeredRate,
    boundaryBBox,
    boundaryCenter,
    provenanceFetchedAt: {
      prev: provenancePrev,
      next: provenanceNext,
      changed: provenancePrev !== provenanceNext,
    },
  }

  const issues = buildIssues({
    districtId: params.districtId,
    segmentsCount,
    overridesAppliedCount,
    curbMarkingKnownRate,
    restrictionTriggeredRate,
    boundaryBBox,
  })

  const severity: DiffSeverity = issues.some((issue) => issue.severity === 'FAIL')
    ? 'FAIL'
    : issues.length > 0
      ? 'WARN'
      : 'OK'

  const status = (() => {
    if (!params.prevDir && params.nextDir) {
      return 'ADDED'
    }
    if (params.prevDir && !params.nextDir) {
      return 'REMOVED'
    }
    if (params.prevDir && params.nextDir) {
      const hasFileChanges =
        files.added.length > 0 || files.removed.length > 0 || files.modified.length > 0
      return hasFileChanges || hasMetaChanges(meta) ? 'UPDATED' : 'UNCHANGED'
    }
    return 'UNCHANGED'
  })()

  return {
    districtId: params.districtId,
    status,
    severity,
    issues,
    meta,
    files,
  }
}

const detectPackLayout = async (dir: string) => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (await fileExists(metaPath)) {
    const meta = await readMeta(dir)
    const districtId =
      (meta && typeof meta.districtId === 'string' && meta.districtId.trim())
        ? meta.districtId
        : path.basename(dir)
    return {
      kind: 'single' as const,
      districts: new Map([[districtId, dir]]),
    }
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const districts = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name.startsWith('.') || entry.name === '_ops') {
      continue
    }
    const candidate = path.resolve(dir, entry.name)
    if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
      districts.set(entry.name, candidate)
    }
  }
  return {
    kind: 'multi' as const,
    districts,
  }
}

const resolvePrevFromNext = async (nextDir: string) => {
  const layout = await detectPackLayout(nextDir)
  if (layout.kind !== 'single') {
    return null
  }
  const [districtId] = layout.districts.keys()
  const parent = path.dirname(nextDir)
  const parentName = path.basename(parent)
  const baseDir =
    parentName === '.staging' || parentName === '.backup'
      ? path.resolve(parent, '..')
      : parent
  const candidate = path.resolve(baseDir, districtId)
  if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
    return candidate
  }
  return null
}

const buildReport = async (params: {
  prevDir: string | null
  nextDir: string
}): Promise<PackDiffReport> => {
  const nextLayout = await detectPackLayout(params.nextDir)
  const prevLayout = params.prevDir ? await detectPackLayout(params.prevDir) : null

  const districtIds = new Set<string>()
  nextLayout.districts.forEach((_value, key) => districtIds.add(key))
  prevLayout?.districts.forEach((_value, key) => districtIds.add(key))

  const sortedDistricts = Array.from(districtIds).sort((a, b) => a.localeCompare(b))

  const districts = await Promise.all(
    sortedDistricts.map(async (districtId) => {
      const prevDir = prevLayout?.districts.get(districtId) ?? null
      const nextDir = nextLayout.districts.get(districtId) ?? null
      return buildDistrictDiff({ districtId, prevDir, nextDir })
    }),
  )

  const districtsAdded = districts
    .filter((district) => district.status === 'ADDED')
    .map((district) => district.districtId)
  const districtsRemoved = districts
    .filter((district) => district.status === 'REMOVED')
    .map((district) => district.districtId)

  const totalChangedFiles = districts.reduce((sum, district) => {
    return sum + district.files.added.length + district.files.removed.length + district.files.modified.length
  }, 0)

  return {
    schemaVersion: DIFF_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    prevPath: params.prevDir ? path.resolve(params.prevDir) : null,
    nextPath: path.resolve(params.nextDir),
    firstPublish: !params.prevDir,
    districts,
    summary: {
      districtsAdded,
      districtsRemoved,
      totalChangedFiles,
    },
  }
}

const formatConsoleSummary = (report: PackDiffReport) => {
  const added = report.summary.districtsAdded.length
  const removed = report.summary.districtsRemoved.length
  const changed = report.summary.totalChangedFiles
  const lines = [
    `Diff summary: ${added} added, ${removed} removed, ${changed} file changes`,
  ]

  report.districts.forEach((district) => {
    const fileChanges =
      district.files.added.length +
      district.files.removed.length +
      district.files.modified.length
    lines.push(
      `${district.districtId}: ${district.severity} (${district.status}, ${fileChanges} file changes)`,
    )
  })

  return lines.join('\n')
}

const formatMarkdownSummary = (report: PackDiffReport) => {
  const lines: string[] = []
  lines.push(`# Pack diff report`)
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Prev: ${report.prevPath ?? 'none'}`)
  lines.push(`- Next: ${report.nextPath}`)
  lines.push(`- Districts added: ${report.summary.districtsAdded.length}`)
  lines.push(`- Districts removed: ${report.summary.districtsRemoved.length}`)
  lines.push(`- Total file changes: ${report.summary.totalChangedFiles}`)
  lines.push('')
  lines.push(`| District | Status | Severity | File changes |`)
  lines.push(`| --- | --- | --- | --- |`)
  report.districts.forEach((district) => {
    const fileChanges =
      district.files.added.length +
      district.files.removed.length +
      district.files.modified.length
    lines.push(
      `| ${district.districtId} | ${district.status} | ${district.severity} | ${fileChanges} |`,
    )
  })
  lines.push('')
  return lines.join('\n')
}

export const diffPacks = async (params: {
  prevDir?: string | null
  nextDir: string
  outPath?: string | null
  format?: 'json' | 'md'
}): Promise<PackDiffReport> => {
  const nextDir = path.resolve(params.nextDir)
  let prevDir = params.prevDir ? path.resolve(params.prevDir) : null

  if (!prevDir) {
    prevDir = await resolvePrevFromNext(nextDir)
  }

  const report = await buildReport({ prevDir, nextDir })

  if (params.outPath) {
    const outPath = path.resolve(params.outPath)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')

    if (params.format === 'md') {
      const mdPath = outPath.endsWith('.json') ? outPath.replace(/\.json$/i, '.md') : `${outPath}.md`
      await fs.writeFile(mdPath, `${formatMarkdownSummary(report)}\n`, 'utf-8')
    }
  }

  return report
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.next) {
    throw new Error('Usage: tsx diffPacks.ts --next <path> [--prev <path>] [--out <path>] [--format json|md]')
  }

  const nextDir = args.next
  const prevDir = args.prev
  const outPath = args.out
  const format = args.format === 'md' ? 'md' : 'json'
  const reportPath = outPath ?? path.resolve(nextDir, DEFAULT_REPORT_NAME)

  const report = await diffPacks({ prevDir, nextDir, outPath: reportPath, format })

  console.log(formatConsoleSummary(report))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
