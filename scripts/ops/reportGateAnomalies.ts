import { fileURLToPath } from 'node:url'
import { parseReportGateAnomalyArgs } from './reportGateAnomalyArgs'
import { createGateAnomalyReport } from './reportGateAnomalyReportBuilder'
import { loadGateAnomalyReportState } from './reportGateAnomalyReportState'
import { writeGateAnomalyReport } from './reportGateAnomalyOutput'
import type { CliArgs, GateAnomalyReport } from './reportGateAnomalyTypes'

export { parseReportGateAnomalyArgs } from './reportGateAnomalyArgs'

export const buildGateAnomalyReport = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyReport> => {
  const state = await loadGateAnomalyReportState(params)
  return createGateAnomalyReport({ state })
}

export const reportGateAnomalies = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}) => {
  const report = await buildGateAnomalyReport(params)
  await writeGateAnomalyReport(report)
  return report
}

const run = async () => {
  const args: CliArgs = parseReportGateAnomalyArgs(process.argv)
  if (!args.districtId) {
    throw new Error(
      'Usage: tsx scripts/ops/reportGateAnomalies.ts --district <id> [--pack <path>] [--out <path>]',
    )
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
