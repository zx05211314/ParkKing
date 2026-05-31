import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig } from './readConfig'
import { ingestBusStops } from './ingestBusStops'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestHydrants } from './ingestHydrants'
import { ingestIntersections } from './ingestIntersections'
import { ingestParkingSpaces } from './ingestParkingSpaces'
import { ingestRedYellow } from './ingestRedYellow'
import { ingestCrosswalks } from './ingestCrosswalks'
import { ingestSignOverrides } from './ingestSignOverrides'
import { ingestInferredCandidates } from './ingestInferredCandidates'
import { writeJson } from './utils'
import { buildDatasetMeta } from './ingestDatasetMeta'
import { getBoundaryFileName } from './ingestDistrictPaths'
import { validateOutputs } from './validateOutputs'
import { copyProvenance, readBoundaryBBox } from './ingestAllArtifacts'
import { parseIngestAllArgs, resolveIngestAllConfigPaths } from './ingestAllArgs'
import { runBenchmark } from '../bench/benchEvaluate'
import { cleanupBackups } from '../ops/cleanupBackups'
import {
  buildIngestDistrictSummary,
} from './ingestAllSummaryState'
import {
  buildIngestAllReport,
  logIngestBatchSummary,
  logWarnSummaries,
} from './ingestAllReportState'
import { runIngestAllOutputWorkflow } from './ingestAllPublish'
import type { IngestDistrictSummary } from './ingestAllTypes'

const runPipeline = async (configPath: string) => {
  const config = await readConfig(['node', 'ingestAll', '--config', configPath])

  await ingestDistrictBounds(config)
  await ingestRedYellow(config)
  await ingestBusStops(config)
  await ingestHydrants(config)
  await ingestParkingSpaces(config)
  await ingestCrosswalks(config)
  await ingestIntersections(config)
  await ingestInferredCandidates(config)
  await ingestSignOverrides(config)

  const meta = await buildDatasetMeta(config)
  await writeJson(config, 'dataset_meta.json', meta)
  await copyProvenance(config)

  await validateOutputs(config)
  return { config, meta }
}

export const runIngestAll = async (argv: string[]) => {
  const parsedArgs = parseIngestAllArgs(argv)
  const globPattern = parsedArgs.globPattern
  const noCleanup = parsedArgs.noCleanup
  if (!globPattern) {
    throw new Error(
      'Missing --configs glob. Example: npm run ingest:all -- --configs "configs/*.json"',
    )
  }

  if ((parsedArgs.allowWarn || parsedArgs.allowFail) && !parsedArgs.overrideReason) {
    throw new Error('Missing --override "<reason>" for allowWarn/allowFail.')
  }

  const resolvedConfigs = await resolveIngestAllConfigPaths(globPattern)
  const failures: string[] = []
  const summaries: IngestDistrictSummary[] = []

  for (const configPath of resolvedConfigs) {
    const label = path.basename(configPath)
    try {
      const { config, meta } = await runPipeline(configPath)
      const boundaryFile = getBoundaryFileName(config.districtId)
      const bbox = await readBoundaryBBox(config.outputs.generatedDir, boundaryFile)
      const dayEval = await runBenchmark(config.outputs.generatedDir, '13:00')
      const nightEval = await runBenchmark(config.outputs.generatedDir, '21:00')

      summaries.push(
        await buildIngestDistrictSummary({
          config,
          label,
          meta: meta as Record<string, unknown>,
          bbox,
          dayEval,
          nightEval,
        }),
      )
      console.log(`Ingested ${label}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${label}: ${message}`)
    }
  }

  logIngestBatchSummary(summaries)
  logWarnSummaries(summaries)

  await runIngestAllOutputWorkflow({
    summaries,
    report: buildIngestAllReport(summaries),
    failures,
    args: parsedArgs,
  })

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
