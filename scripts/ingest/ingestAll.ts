import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import fg from 'fast-glob'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import { readConfig, type ResolvedConfig } from './readConfig'
import { ingestBusStops } from './ingestBusStops'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestHydrants } from './ingestHydrants'
import { ingestIntersections } from './ingestIntersections'
import { ingestRedYellow } from './ingestRedYellow'
import { ingestCrosswalks } from './ingestCrosswalks'
import { ingestSignOverrides } from './ingestSignOverrides'
import { ingestInferredCandidates } from './ingestInferredCandidates'
import { buildDatasetMeta, getBoundaryFileName, writeJson } from './utils'
import { validateOutputs } from './validateOutputs'
import { runBenchmark, type BenchmarkResult } from '../bench/benchEvaluate'
import { compareWithBaseline, type BaselineMetrics } from '../ops/compareBaseline'
import { publishPackAtomic } from './publishPackAtomic'
import { buildRegistryEntryFromMeta, readPublishedMetaPath } from '../ops/registryUtils'
import { cleanupBackups } from '../ops/cleanupBackups'
import { runPublishGate } from '../ops/publishGate'
import { writePublishManifest } from '../ops/manifestWriter'
import { writeLatestPointer, buildLatestPointer } from '../ops/latestPointer'

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const globIndex = args.findIndex(
    (arg) => arg === '--configs' || arg === '--config-glob' || arg === '--glob',
  )
  const overrideIndex = args.findIndex((arg) => arg === '--override')
  const allowWarn = args.includes('--allowWarn')
  const allowFail = args.includes('--allowFail')
  const dryRun = args.includes('--dryRun')

  return {
    globPattern: globIndex >= 0 ? args[globIndex + 1] : null,
    allowWarn,
    allowFail,
    overrideReason: overrideIndex >= 0 ? args[overrideIndex + 1] : null,
    dryRun,
  }
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const bboxFromGeometry = (geometry: Geometry): BBox => {
  const coords: [number, number][] = []
  collectCoords(geometry.coordinates, coords)

  if (coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const readBoundaryBBox = async (generatedDir: string, boundaryFile: string) => {
  const boundaryPath = path.resolve(generatedDir, boundaryFile)
  const raw = await fs.readFile(boundaryPath, 'utf-8')
  const collection = JSON.parse(raw) as FeatureCollection
  const boundary = collection.features[0] as Feature<Polygon | MultiPolygon>
  if (!boundary || !boundary.geometry) {
    return null
  }
  return bboxFromGeometry(boundary.geometry)
}

const formatBBox = (bbox: BBox | null) => {
  if (!bbox) {
    return 'n/a'
  }
  const fmt = (value: number) => value.toFixed(4)
  return `${fmt(bbox.minX)},${fmt(bbox.minY)} -> ${fmt(bbox.maxX)},${fmt(bbox.maxY)}`
}

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const copyProvenance = async (config: ResolvedConfig) => {
  const provenanceSource = path.resolve(
    process.cwd(),
    'data',
    'sources',
    config.districtId,
    'provenance.json',
  )
  const provenanceDest = path.resolve(config.outputs.generatedDir, 'provenance.json')
  try {
    await fs.copyFile(provenanceSource, provenanceDest)
  } catch {
    // Skip if provenance not available.
  }
}

const runPipeline = async (configPath: string) => {
  const config = await readConfig(['node', 'ingestAll', '--config', configPath])

  await ingestDistrictBounds(config)
  await ingestRedYellow(config)
  await ingestBusStops(config)
  await ingestHydrants(config)
  await ingestCrosswalks(config)
  await ingestIntersections(config)
  await ingestSignOverrides(config)
  await ingestInferredCandidates(config)

  const meta = await buildDatasetMeta(config)
  await writeJson(config, 'dataset_meta.json', meta)
  await copyProvenance(config)

  await validateOutputs(config)
  return { config, meta }
}

const expandConfigPaths = async (paths: string[]) => {
  const expanded: string[] = []
  const seen = new Set<string>()

  for (const rawPath of paths) {
    const resolved = path.resolve(rawPath)
    if (seen.has(resolved)) {
      continue
    }
    seen.add(resolved)
    expanded.push(resolved)

    let parsed: Record<string, unknown> | null = null
    try {
      const raw = await fs.readFile(resolved, 'utf-8')
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }

    if (!parsed || !('includeConfigs' in parsed)) {
      continue
    }
    const includeConfigs = parsed.includeConfigs
    if (!Array.isArray(includeConfigs)) {
      throw new Error(`includeConfigs must be an array in ${resolved}`)
    }
    includeConfigs.forEach((entry) => {
      if (typeof entry !== 'string' || entry.trim().length === 0) {
        throw new Error(`includeConfigs entries must be non-empty strings in ${resolved}`)
      }
      const includePath = path.isAbsolute(entry)
        ? entry
        : path.resolve(path.dirname(resolved), entry)
      if (!seen.has(includePath)) {
        seen.add(includePath)
        expanded.push(includePath)
      }
    })
  }

  return expanded
}

export const runIngestAll = async (argv: string[]) => {
  const parsedArgs = parseArgs(argv)
  const globPattern = parsedArgs.globPattern
  const noCleanup = argv.includes('--noCleanup')
  if (!globPattern) {
    throw new Error(
      'Missing --configs glob. Example: npm run ingest:all -- --configs "configs/*.json"',
    )
  }

  if ((parsedArgs.allowWarn || parsedArgs.allowFail) && !parsedArgs.overrideReason) {
    throw new Error('Missing --override "<reason>" for allowWarn/allowFail.')
  }

  const configPaths = await fg(globPattern, { absolute: true, onlyFiles: true })
  if (configPaths.length === 0) {
    throw new Error(`No config files matched: ${globPattern}`)
  }
  const resolvedConfigs = await expandConfigPaths(configPaths)

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

  const failures: string[] = []
  const summaries: Array<{
    districtId: string
    label: string
    datasetHash: string
    counts: Record<string, number> | null
    bbox: BBox | null
    dayEval: BenchmarkResult | null
    nightEval: BenchmarkResult | null
    intersectionsReport: Record<string, unknown> | null
    riskTagCounts: Record<string, number> | null
    districtName: string | null
    schemaVersion: number | null
    generatedAt: string | null
    warnings: ReturnType<typeof compareWithBaseline>
    baselineStatus: 'missing' | 'loaded'
    baselineCandidate: BaselineMetrics | null
    thresholds: {
      counts: {
        segments: number
        intersections: number
        inferredCandidates: number
        signOverrides: number
      }
      tierDistributionMaxDeltaPct: number
      perfRegressionMaxDeltaPct: number
      maxReasonCodeDeltaPct: number
      maxNewReasonCodePct: number
    }
    retention: {
      maxBackupsPerDistrict: number
      maxBackupAgeDays: number
    }
    config: ResolvedConfig
    registryEntry?: Awaited<ReturnType<typeof buildRegistryEntryFromMeta>>
    publishResult?: Awaited<ReturnType<typeof publishPackAtomic>>
    baselineUsed?: {
      baselineDatasetHash?: string
      baselineCreatedAt?: string
    }
  }> = []

  for (const configPath of resolvedConfigs) {
    const label = path.basename(configPath)
    try {
      const { config, meta } = await runPipeline(configPath)
      const boundaryFile = getBoundaryFileName(config.districtId)
      const bbox = await readBoundaryBBox(config.outputs.generatedDir, boundaryFile)
      const dayEval = await runBenchmark(config.outputs.generatedDir, '13:00')
      const nightEval = await runBenchmark(config.outputs.generatedDir, '21:00')
      const counts = (meta.counts as Record<string, number>) ?? null
      const thresholds = config.ops.thresholds
      const retention = config.ops.retention
      const districtId =
        (meta.districtId as string) ??
        path.basename(config.outputs.generatedDir) ??
        label.replace(path.extname(label), '')

      let baseline: BaselineMetrics | null = null
      let baselineStatus: 'missing' | 'loaded' = 'missing'
      let baselineCandidate: BaselineMetrics | null = null

      const baselinePath = path.resolve(
        process.cwd(),
        'ops/baselines',
        `${districtId}.json`,
      )
      try {
        const raw = await fs.readFile(baselinePath, 'utf-8')
        baseline = JSON.parse(raw) as BaselineMetrics
        baselineStatus = 'loaded'
      } catch {
        baselineStatus = 'missing'
      }

      const currentMetrics = {
        datasetHash: meta.datasetHash as string | undefined,
        schemaVersion: meta.schemaVersion as number | undefined,
        counts: {
          segments: counts?.segments ?? 0,
          intersections: counts?.intersections ?? 0,
          inferredCandidates: counts?.inferredCandidates ?? 0,
          signOverrides: counts?.signOverrides ?? 0,
        },
        distributions: {
          day: dayEval.distribution,
          night: nightEval.distribution,
        },
        performance: {
          day: { evalFirstMs: dayEval.timingsMs.evalFirst },
          night: { evalFirstMs: nightEval.timingsMs.evalFirst },
        },
        reasonCodes: {
          day: {
            counts: dayEval.reasonCodes.counts,
            total: dayEval.counts.evaluatedFirst,
            coveragePct: dayEval.reasonCodes.coveragePct,
          },
          night: {
            counts: nightEval.reasonCodes.counts,
            total: nightEval.counts.evaluatedFirst,
            coveragePct: nightEval.reasonCodes.coveragePct,
          },
        },
      }

      if (!baseline) {
        baselineCandidate = {
          counts: currentMetrics.counts,
          distributions: currentMetrics.distributions,
          performance: {
            day: { evalFirstMsMedian: dayEval.timingsMs.evalFirst },
            night: { evalFirstMsMedian: nightEval.timingsMs.evalFirst },
          },
          reasonCodes: {
            day: {
              ...buildReasonDistribution(
                dayEval.reasonCodes.counts,
                dayEval.counts.evaluatedFirst,
                dayEval.reasonCodes.coveragePct,
              ),
            },
            night: {
              ...buildReasonDistribution(
                nightEval.reasonCodes.counts,
                nightEval.counts.evaluatedFirst,
                nightEval.reasonCodes.coveragePct,
              ),
            },
          },
        }
      }

      const warnings = compareWithBaseline(currentMetrics, baseline, thresholds)
      const baselineUsed = baseline
        ? {
            baselineDatasetHash: baseline.baselineDatasetHash,
            baselineCreatedAt: baseline.baselineCreatedAt,
          }
        : undefined

      summaries.push({
        districtId,
        label,
        datasetHash:
          (meta.datasetHash as string) ?? 'unknown',
        counts,
        bbox,
        dayEval,
        nightEval,
        intersectionsReport: (meta.intersectionsReport as Record<string, unknown>) ?? null,
        riskTagCounts: (meta.inferredRiskCounts as Record<string, number>) ?? null,
        districtName: (meta.districtName as string) ?? null,
        schemaVersion:
          typeof meta.schemaVersion === 'number' ? meta.schemaVersion : null,
        generatedAt: (meta.generatedAt as string) ?? null,
        warnings,
        baselineStatus,
        baselineCandidate,
        thresholds,
        retention,
        config,
        baselineUsed,
      })
      console.log(`Ingested ${label}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${label}: ${message}`)
    }
  }

  if (summaries.length > 0) {
    console.log('Batch ingest summary:')
    summaries.forEach((summary) => {
      const counts = summary.counts
      const dayMs = summary.dayEval?.timingsMs.evalFirst ?? 0
      const nightMs = summary.nightEval?.timingsMs.evalFirst ?? 0
      const warningCount = summary.warnings.filter(
        (warning) => warning.severity !== 'INFO',
      ).length
      const countLabel = counts
        ? `segments ${counts.segments ?? 0} | zones ${counts.zones ?? 0} | inferred ${counts.inferredCandidates ?? 0}`
        : 'counts unavailable'
      console.log(
        `${summary.label} | ${countLabel} | eval ms day ${dayMs} night ${nightMs} | warnings ${warningCount} | bbox ${formatBBox(summary.bbox)} | hash ${summary.datasetHash}`,
      )
    })
  }

  const warnSummaries = summaries.filter((summary) =>
    summary.warnings.some((warning) => warning.severity !== 'INFO'),
  )
  if (warnSummaries.length > 0) {
    console.log('WARN summary:')
    warnSummaries.forEach((summary) => {
      const actionable = summary.warnings.filter((warning) => warning.severity !== 'INFO')
      const types = actionable.map((warning) => warning.code).join(', ')
      console.log(`${summary.districtId}: ${actionable.length} issue(s) [${types}]`)
    })
  }

  if (summaries.length > 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      districts: summaries.map((summary) => ({
        districtId: summary.districtId,
        districtName: summary.districtName ?? summary.label,
        datasetHash: summary.datasetHash,
        schemaVersion: summary.schemaVersion,
        generatedAt: summary.generatedAt,
        counts: summary.counts,
        bbox: summary.bbox,
        intersectionsReport: summary.intersectionsReport,
        riskTagCounts: summary.riskTagCounts,
        evaluations: {
          day: summary.dayEval,
          night: summary.nightEval,
        },
        reasonCodes: summary.dayEval && summary.nightEval
          ? {
              day: summary.dayEval.reasonCodes,
              night: summary.nightEval.reasonCodes,
            }
          : null,
        thresholds: summary.thresholds,
        baselineStatus: summary.baselineStatus,
        baselineCandidate: summary.baselineCandidate,
        warnings: summary.warnings,
      })),
    }

    const reportDir = path.resolve(process.cwd(), 'data/generated')
    await fs.mkdir(reportDir, { recursive: true })
    const reportPath = path.resolve(
      reportDir,
      parsedArgs.dryRun ? 'ingest_all_report_dry.json' : 'ingest_all_report.json',
    )
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
    console.log(`Wrote report to ${reportPath}`)

    let publicReportPath = reportPath
    if (!parsedArgs.dryRun) {
      const publicReportDir = path.resolve(process.cwd(), 'public/data/generated')
      await fs.mkdir(publicReportDir, { recursive: true })
      publicReportPath = path.resolve(publicReportDir, 'ingest_all_report.json')
      await fs.writeFile(
        publicReportPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf-8',
      )
      console.log(`Wrote report to ${publicReportPath}`)
    }

    if (failures.length === 0 && !parsedArgs.dryRun) {
      const gateResult = await runPublishGate({
        reportPath: publicReportPath,
        mode: 'strict',
        allowWarn: parsedArgs.allowWarn,
        allowFail: parsedArgs.allowFail,
        overrideReason: parsedArgs.overrideReason ?? undefined,
        datasetRootDir: path.resolve(process.cwd(), 'data/generated'),
        publishedRootDir: path.resolve(process.cwd(), 'public/data/generated'),
      })

      if (gateResult.exitCode !== 0) {
        throw new Error(`Publish gate failed with exit code ${gateResult.exitCode}`)
      }

      for (const summary of summaries) {
        const result = await publishPackAtomic({
          sourceDir: summary.config.outputs.generatedDir,
          destDir: summary.config.outputs.publicDir,
        })
        summary.publishResult = result
        const publishedMetaPath = readPublishedMetaPath(summary.config.outputs.publicDir)
        summary.registryEntry = await buildRegistryEntryFromMeta(
          publishedMetaPath,
          summary.districtId,
        )

        const hasWarn = summary.warnings.some((warning) => warning.severity === 'WARN')
        const hasFail = summary.warnings.some((warning) => warning.severity === 'FAIL')
        const gateResultLabel =
          hasFail || hasWarn
            ? parsedArgs.allowWarn || parsedArgs.allowFail
              ? 'OVERRIDE'
              : 'WARN'
            : 'PASS'

        const metaPath = readPublishedMetaPath(
          path.resolve(process.cwd(), 'public/data/generated', summary.districtId),
        )
        const metaRaw = await fs.readFile(metaPath, 'utf-8')
        const meta = JSON.parse(metaRaw) as Record<string, unknown>
        const provenancePath = path.resolve(
          process.cwd(),
          'public/data/generated',
          summary.districtId,
          'provenance.json',
        )
        let provenance: { path: string; sha256: string; bytes: number } | undefined
        try {
          const buffer = await fs.readFile(provenancePath)
          provenance = {
            path: path.relative(process.cwd(), provenancePath).replace(/\\/g, '/'),
            sha256: hashBuffer(buffer),
            bytes: buffer.length,
          }
        } catch {
          provenance = undefined
        }
        const diffReportPath = path.resolve(
          process.cwd(),
          'public/data/generated',
          summary.districtId,
          'diff_report.json',
        )
        let diffReport: { path: string; sha256: string; bytes: number } | undefined
        try {
          const buffer = await fs.readFile(diffReportPath)
          diffReport = {
            path: path.relative(process.cwd(), diffReportPath).replace(/\\/g, '/'),
            sha256: hashBuffer(buffer),
            bytes: buffer.length,
          }
        } catch {
          diffReport = undefined
        }
        const metricsHistoryPath = path.resolve(
          process.cwd(),
          'public/data/generated',
          summary.districtId,
          'metrics_history.jsonl',
        )
        let metricsHistory: { path: string; sha256: string; bytes: number } | undefined
        try {
          const buffer = await fs.readFile(metricsHistoryPath)
          metricsHistory = {
            path: path.relative(process.cwd(), metricsHistoryPath).replace(/\\/g, '/'),
            sha256: hashBuffer(buffer),
            bytes: buffer.length,
          }
        } catch {
          metricsHistory = undefined
        }
        const manifestPath = await writePublishManifest({
          baseDir: path.resolve(process.cwd(), 'public/data/generated'),
          manifest: {
            districtId: summary.districtId,
            districtName: summary.districtName ?? summary.districtId,
            schemaVersion: Number(meta.schemaVersion ?? 0),
            datasetHash: summary.datasetHash,
            configHash: (meta.configHash as string) ?? 'unknown',
            generatedAt: (meta.generatedAt as string) ?? '',
            publishedAt: result.publishedAt,
            metaSha256: result.metaSha256,
            packSha256: result.packSha256,
            totalBytes: result.totalBytes,
            files: (meta.files as Record<string, { sha256: string; bytes: number }>) ?? {},
            provenance,
            diffReport,
            metricsHistory,
            gateResult: gateResultLabel,
            overrideReason: parsedArgs.overrideReason ?? null,
            baselines: summary.baselineUsed,
            toolVersions: {
              node: process.version,
            },
          },
        })

        const latestPointer = buildLatestPointer({
          datasetHash: summary.datasetHash,
          publishedAt: result.publishedAt,
          manifestPath,
          schemaVersion: Number(meta.schemaVersion ?? 0),
        })
        await writeLatestPointer(
          path.resolve(process.cwd(), 'public/data/generated'),
          summary.districtId,
          latestPointer,
        )

        if (summary.registryEntry?.latest) {
          summary.registryEntry.latest.datasetHash = summary.datasetHash
          summary.registryEntry.latest.publishedAt = result.publishedAt
        }
      }

      const registry = {
        generatedAt: report.generatedAt,
        districts: summaries
          .map((summary) => summary.registryEntry)
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      }

      const registryDir = path.resolve(process.cwd(), 'public/data/generated')
      await fs.mkdir(registryDir, { recursive: true })
      const registryPath = path.resolve(registryDir, 'registry.json')
      await fs.writeFile(
        registryPath,
        `${JSON.stringify(registry, null, 2)}\n`,
        'utf-8',
      )
      console.log(`Wrote registry to ${registryPath}`)
    } else if (parsedArgs.dryRun) {
      const gateResult = await runPublishGate({
        reportPath,
        mode: 'strict',
        allowWarn: parsedArgs.allowWarn,
        allowFail: parsedArgs.allowFail,
        overrideReason: parsedArgs.overrideReason ?? undefined,
        outputDir: path.resolve(process.cwd(), 'data/generated'),
        datasetRootDir: path.resolve(process.cwd(), 'data/generated'),
        publishedRootDir: path.resolve(process.cwd(), 'public/data/generated'),
      })
      if (gateResult.exitCode !== 0) {
        throw new Error(`Publish gate failed with exit code ${gateResult.exitCode}`)
      }
    } else {
      console.log('Skipped registry.json write due to ingest failures.')
    }
  }

  if (failures.length > 0) {
    throw new Error(`Batch ingest failed:\n${failures.join('\n')}`)
  }

  if (!noCleanup && !parsedArgs.dryRun) {
    const retention = summaries[0]?.retention
    await cleanupBackups({
      baseDir: 'public/data/generated',
      maxBackupsPerDistrict: retention?.maxBackupsPerDistrict ?? 5,
      maxBackupAgeDays: retention?.maxBackupAgeDays ?? 30,
    })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIngestAll(process.argv).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
