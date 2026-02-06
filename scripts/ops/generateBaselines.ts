import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { runBenchmark } from '../bench/benchEvaluate'

interface RegistryEntry {
  districtId: string
  districtName: string
  generatedAt: string
  datasetHash: string
  schemaVersion: number
  metaSha256?: string
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) {
    return 0
  }
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

const sha256 = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const findDatasetDir = async (districtId: string) => {
  const candidates = [
    path.resolve('data/generated', districtId),
    path.resolve('public/data/generated', districtId),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error(`Dataset directory not found for ${districtId}`)
}

const runMedianBench = async (datasetDir: string, hhmm: string, runs = 3) => {
  const results = []
  for (let i = 0; i < runs; i += 1) {
    // Run sequentially to reduce load variance
    const result = await runBenchmark(datasetDir, hhmm)
    results.push(result)
  }
  const evalFirstMedian = median(results.map((result) => result.timingsMs.evalFirst))
  const evalSecondMedian = median(results.map((result) => result.timingsMs.evalSecond))

  return {
    medianEvalFirstMs: evalFirstMedian,
    medianEvalSecondMs: evalSecondMedian,
    distribution: results[0]?.distribution ?? {},
    reasonCodes: results[0]?.reasonCodes ?? { coveragePct: 0, counts: {}, byTier: {} },
    evaluatedCount: results[0]?.counts?.evaluatedFirst ?? 0,
  }
}

const run = async () => {
  const force = process.argv.includes('--force')
  const seed = process.argv.includes('--seed')
  const districtArgIndex = process.argv.findIndex((arg) => arg === '--districtId')
  const districtIdFilter =
    districtArgIndex >= 0 ? process.argv[districtArgIndex + 1] : null

  const registryPath = path.resolve('public/data/generated/registry.json')
  const registry = await readJson<{ districts: RegistryEntry[] }>(registryPath)
  if (!registry.districts || registry.districts.length === 0) {
    throw new Error('registry.json has no districts')
  }

  const baselineDir = path.resolve('ops/baselines')
  await fs.mkdir(baselineDir, { recursive: true })
  const skipped: string[] = []

  const entries = districtIdFilter
    ? registry.districts.filter((entry) => entry.districtId === districtIdFilter)
    : registry.districts
  if (districtIdFilter && entries.length === 0) {
    throw new Error(`District ${districtIdFilter} not found in registry`)
  }

  for (const entry of entries) {
    const datasetDir = await findDatasetDir(entry.districtId)
    const outputPath = path.resolve(baselineDir, `${entry.districtId}.json`)
    try {
      await fs.access(outputPath)
      if (!force) {
        console.error(
          `Baseline exists for ${entry.districtId}. Re-run with --force to overwrite.`,
        )
        skipped.push(entry.districtId)
        continue
      }
    } catch {
      if (!seed && !force) {
        console.error(
          `Baseline missing for ${entry.districtId}. Re-run with --seed to create.`,
        )
        skipped.push(entry.districtId)
        continue
      }
    }

    const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
    const metaRaw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(metaRaw) as Record<string, unknown>
    const counts = (meta.counts as Record<string, number>) ?? {}

    const day = await runMedianBench(datasetDir, '13:00')
    const night = await runMedianBench(datasetDir, '21:00')

    const buildReasonDistribution = (
      counts: Record<string, number>,
      total: number,
      coveragePct: number,
      topN = 8,
    ) => {
      const sorted = Object.entries(counts).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )
      const topEntries = sorted.slice(0, topN)
      const otherEntries = sorted.slice(topN)
      const top = Object.fromEntries(topEntries)
      const other = otherEntries.reduce((sum, [, count]) => sum + count, 0)
      return { top, other, total, coveragePct }
    }

    const baseline = {
      baselineCreatedAt: new Date().toISOString(),
      baselineDatasetHash: entry.datasetHash ?? (meta.datasetHash as string) ?? 'unknown',
      baselineSchemaVersion:
        entry.schemaVersion ?? (meta.schemaVersion as number) ?? 0,
      baselineSourceMetaSha256: entry.metaSha256 ?? sha256(metaRaw),
      baselineDistrictName: entry.districtName ?? (meta.districtName as string),
      generatedAt: new Date().toISOString(),
      districtId: entry.districtId,
      datasetHash: entry.datasetHash,
      counts: {
        segments: counts.segments ?? 0,
        intersections: counts.intersections ?? 0,
        inferredCandidates: counts.inferredCandidates ?? 0,
        signOverrides: counts.signOverrides ?? 0,
      },
      distributions: {
        day: day.distribution,
        night: night.distribution,
      },
      performance: {
        day: {
          evalFirstMsMedian: day.medianEvalFirstMs,
          evalSecondMsMedian: day.medianEvalSecondMs,
        },
        night: {
          evalFirstMsMedian: night.medianEvalFirstMs,
          evalSecondMsMedian: night.medianEvalSecondMs,
        },
      },
      reasonCodes: {
        day: buildReasonDistribution(
          day.reasonCodes.counts,
          day.evaluatedCount,
          day.reasonCodes.coveragePct,
        ),
        night: buildReasonDistribution(
          night.reasonCodes.counts,
          night.evaluatedCount,
          night.reasonCodes.coveragePct,
        ),
      },
    }

    await fs.writeFile(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8')
    console.log(`Wrote baseline ${outputPath}`)
  }

  if (skipped.length > 0) {
    throw new Error(
      `Baseline update refused for ${skipped.join(
        ', ',
      )}. Run npm run ops:baseline:seed to create missing baselines or ops:baseline:force to overwrite.`,
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
