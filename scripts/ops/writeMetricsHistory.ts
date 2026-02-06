import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const HISTORY_SCHEMA_VERSION = 1
const HISTORY_MAX_LINES = 180

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const packIndex = args.findIndex((arg) => arg === '--pack')
  const prevIndex = args.findIndex((arg) => arg === '--prevPack')
  return {
    packDir: packIndex >= 0 ? args[packIndex + 1] : null,
    prevPackDir: prevIndex >= 0 ? args[prevIndex + 1] : null,
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

const detectPackLayout = async (dir: string) => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (await fileExists(metaPath)) {
    const meta = await readJson<Record<string, unknown>>(metaPath)
    const districtId =
      typeof meta.districtId === 'string' && meta.districtId.trim()
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

const resolvePrevPack = async (packDir: string) => {
  const layout = await detectPackLayout(packDir)
  if (layout.kind !== 'single') {
    return null
  }
  const [districtId] = layout.districts.keys()
  const parent = path.dirname(packDir)
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

const buildMetricsEntry = (meta: Record<string, unknown>, packId: string) => {
  const counts =
    meta.counts && typeof meta.counts === 'object'
      ? (meta.counts as Record<string, unknown>)
      : null

  const segmentsCount =
    parseNumber(meta.segmentsCount) ??
    (counts ? parseNumber(counts.segments) : null) ??
    0
  const overridesAppliedCount =
    parseNumber(meta.overridesAppliedCount) ??
    (counts ? parseNumber(counts.overridesApplied) : null) ??
    0
  const signOverridesCount =
    parseNumber(meta.signOverridesCount) ??
    (counts ? parseNumber(counts.signOverrides) : null) ??
    0
  const curbMarkingKnownRate = parseNumber(meta.curbMarkingKnownRate) ?? 0
  const restrictionTriggeredRate = parseNumber(meta.restrictionTriggeredRate) ?? 0

  const publishedAt =
    typeof meta.publishedAt === 'string' && meta.publishedAt.trim().length > 0
      ? meta.publishedAt
      : new Date().toISOString()
  const provenanceFetchedAt =
    typeof meta.provenanceFetchedAt === 'string' ? meta.provenanceFetchedAt : null
  const districtId =
    typeof meta.districtId === 'string' && meta.districtId.trim().length > 0
      ? meta.districtId
      : 'unknown'

  const entry: MetricsHistoryEntry = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    publishedAt,
    packId,
    districtId,
    segmentsCount,
    overridesAppliedCount,
    signOverridesCount,
    curbMarkingKnownRate,
    restrictionTriggeredRate,
    provenanceFetchedAt,
  }

  return entry
}

const writeHistoryFile = async (params: {
  targetPath: string
  entry: MetricsHistoryEntry
  previousPath: string | null
}) => {
  let previousLines: string[] = []
  if (params.previousPath && (await fileExists(params.previousPath))) {
    const previousContent = await fs.readFile(params.previousPath, 'utf-8')
    previousLines = previousContent
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
  }

  const nextLines = [...previousLines, JSON.stringify(params.entry)]
  const trimmed =
    nextLines.length > HISTORY_MAX_LINES
      ? nextLines.slice(-HISTORY_MAX_LINES)
      : nextLines

  await fs.mkdir(path.dirname(params.targetPath), { recursive: true })
  await fs.writeFile(params.targetPath, `${trimmed.join('\n')}\n`, 'utf-8')
}

export const writeMetricsHistory = async (params: {
  packDir: string
  prevPackDir?: string | null
}) => {
  const packDir = path.resolve(params.packDir)
  const packLayout = await detectPackLayout(packDir)
  let prevPackDir = params.prevPackDir ? path.resolve(params.prevPackDir) : null

  if (!prevPackDir) {
    prevPackDir = await resolvePrevPack(packDir)
  }

  const prevLayout = prevPackDir ? await detectPackLayout(prevPackDir) : null
  const packId = path.basename(packDir)

  const districtIds = Array.from(packLayout.districts.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  for (const districtId of districtIds) {
    const districtDir = packLayout.districts.get(districtId)
    if (!districtDir) {
      continue
    }
    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    const meta = await readJson<Record<string, unknown>>(metaPath)

    const previousDir = prevLayout?.districts.get(districtId)
    const previousHistoryPath = previousDir
      ? path.resolve(previousDir, 'metrics_history.jsonl')
      : null

    const entry = buildMetricsEntry(meta, packId)
    const targetPath = path.resolve(districtDir, 'metrics_history.jsonl')

    await writeHistoryFile({
      targetPath,
      entry,
      previousPath: previousHistoryPath,
    })
  }
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.packDir) {
    throw new Error('Usage: tsx writeMetricsHistory.ts --pack <path> [--prevPack <path>]')
  }
  await writeMetricsHistory({
    packDir: args.packDir,
    prevPackDir: args.prevPackDir ?? undefined,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
