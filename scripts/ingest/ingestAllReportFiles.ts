import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { IngestAllReport } from './ingestAllTypes'

export interface IngestAllReportPaths {
  reportPath: string
  publicReportPath: string
}

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export const writeIngestAllReport = async (params: {
  report: IngestAllReport
  dryRun: boolean
  cwd?: string
  logger?: (message: string) => void
}): Promise<IngestAllReportPaths> => {
  const cwd = params.cwd ?? process.cwd()
  const logger = params.logger ?? console.log
  const reportDir = path.resolve(cwd, 'data/generated')
  await fs.mkdir(reportDir, { recursive: true })

  const reportPath = path.resolve(
    reportDir,
    params.dryRun ? 'ingest_all_report_dry.json' : 'ingest_all_report.json',
  )
  await writeJsonFile(reportPath, params.report)
  logger(`Wrote report to ${reportPath}`)

  let publicReportPath = reportPath
  if (!params.dryRun) {
    const publicReportDir = path.resolve(cwd, 'public/data/generated')
    await fs.mkdir(publicReportDir, { recursive: true })
    publicReportPath = path.resolve(publicReportDir, 'ingest_all_report.json')
    await writeJsonFile(publicReportPath, params.report)
    logger(`Wrote report to ${publicReportPath}`)
  }

  return { reportPath, publicReportPath }
}
