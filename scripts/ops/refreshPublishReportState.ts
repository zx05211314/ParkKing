import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { runBenchmark } from '../bench/benchEvaluate'
import { getBoundaryFileName } from '../ingest/ingestDistrictPaths'
import { buildIngestAllReport } from '../ingest/ingestAllReportState'
import { buildIngestDistrictSummary } from '../ingest/ingestAllSummaryState'
import type { IngestAllReport, IngestDistrictSummary } from '../ingest/ingestAllTypes'
import { readBoundaryBBox } from '../ingest/ingestAllArtifacts'
import { readConfig } from '../ingest/readConfig'

const DEFAULT_CONFIG_PATH = path.join('configs', 'prod', 'xinyi.json')
const DEFAULT_OUT_PATH = path.join('public', 'data', 'generated', 'ingest_all_report.json')
const DEFAULT_DAY_HHMM = '13:00'
const DEFAULT_NIGHT_HHMM = '21:00'

export interface RefreshPublishReportParams {
  configPath?: string | null
  datasetDir?: string | null
  outPath?: string | null
  dayHhmm?: string | null
  nightHhmm?: string | null
  generatedAt?: string | null
}

export interface RefreshPublishReportResult {
  configPath: string
  datasetDir: string
  outPath: string | null
  dayHhmm: string
  nightHhmm: string
  summary: IngestDistrictSummary
  report: IngestAllReport
}

const readJsonFile = async (filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as Record<string, unknown>

const countWarningsBySeverity = (summary: IngestDistrictSummary) =>
  summary.warnings.reduce(
    (acc, warning) => {
      const severity = warning.severity ?? 'WARN'
      if (severity === 'INFO' || severity === 'WARN' || severity === 'FAIL') {
        acc[severity] += 1
      }
      return acc
    },
    { INFO: 0, WARN: 0, FAIL: 0 },
  )

export const buildRefreshPublishReport = async ({
  configPath,
  datasetDir,
  outPath,
  dayHhmm,
  nightHhmm,
  generatedAt,
}: RefreshPublishReportParams = {}): Promise<RefreshPublishReportResult> => {
  const resolvedConfigPath = path.resolve(configPath ?? DEFAULT_CONFIG_PATH)
  const config = await readConfig([
    'node',
    'refreshPublishReport',
    '--config',
    resolvedConfigPath,
  ])
  const resolvedDatasetDir = path.resolve(datasetDir ?? config.outputs.publicDir)
  const resolvedOutPath = outPath === null ? null : path.resolve(outPath ?? DEFAULT_OUT_PATH)
  const resolvedDayHhmm = dayHhmm?.trim() || DEFAULT_DAY_HHMM
  const resolvedNightHhmm = nightHhmm?.trim() || DEFAULT_NIGHT_HHMM
  const meta = await readJsonFile(path.join(resolvedDatasetDir, 'dataset_meta.json'))
  const bbox = await readBoundaryBBox(
    resolvedDatasetDir,
    getBoundaryFileName(config.districtId),
  )
  const [dayEval, nightEval] = await Promise.all([
    runBenchmark(resolvedDatasetDir, resolvedDayHhmm),
    runBenchmark(resolvedDatasetDir, resolvedNightHhmm),
  ])
  const summary = await buildIngestDistrictSummary({
    config,
    label: path.basename(resolvedConfigPath),
    meta,
    bbox,
    dayEval,
    nightEval,
  })
  const report = buildIngestAllReport([summary], generatedAt ?? undefined)

  if (resolvedOutPath) {
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true })
    await fs.writeFile(resolvedOutPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
  }

  return {
    configPath: resolvedConfigPath,
    datasetDir: resolvedDatasetDir,
    outPath: resolvedOutPath,
    dayHhmm: resolvedDayHhmm,
    nightHhmm: resolvedNightHhmm,
    summary,
    report,
  }
}

export const summarizeRefreshPublishReportWarnings = (summary: IngestDistrictSummary) =>
  countWarningsBySeverity(summary)
