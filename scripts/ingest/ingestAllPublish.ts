import type { IngestAllArgs } from './ingestAllArgs'
import type { IngestAllReport, IngestDistrictSummary } from './ingestAllTypes'
import { runIngestAllGate } from './ingestAllPublishGate'
import {
  publishDistrictSummary,
  writeIngestAllRegistry,
} from './ingestAllPublishRegistry'
export {
  type IngestAllReportPaths,
  writeIngestAllReport,
} from './ingestAllReportFiles'
import { writeIngestAllReport } from './ingestAllReportFiles'

export const runIngestAllOutputWorkflow = async (params: {
  summaries: IngestDistrictSummary[]
  report: IngestAllReport
  failures: string[]
  args: Pick<
    IngestAllArgs,
    'allowWarn' | 'allowFail' | 'overrideReason' | 'dryRun'
  >
  cwd?: string
  logger?: (message: string) => void
}) => {
  if (params.summaries.length === 0) {
    return
  }

  const cwd = params.cwd ?? process.cwd()
  const logger = params.logger ?? console.log
  const reportPaths = await writeIngestAllReport({
    report: params.report,
    dryRun: params.args.dryRun,
    cwd,
    logger,
  })

  if (params.failures.length === 0 && !params.args.dryRun) {
    await runIngestAllGate({
      reportPath: reportPaths.reportPath,
      publicReportPath: reportPaths.publicReportPath,
      args: params.args,
      cwd,
    })
    for (const summary of params.summaries) {
      await publishDistrictSummary({
        summary,
        args: params.args,
        cwd,
      })
    }
    await writeIngestAllRegistry({
      summaries: params.summaries,
      generatedAt: params.report.generatedAt,
      cwd,
      logger,
    })
    return
  }

  if (params.args.dryRun) {
    await runIngestAllGate({
      reportPath: reportPaths.reportPath,
      publicReportPath: reportPaths.publicReportPath,
      args: params.args,
      cwd,
    })
    return
  }

  logger('Skipped registry.json write due to ingest failures.')
}
