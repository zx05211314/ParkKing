import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'

export const writeGateAnomalyReport = async (report: GateAnomalyReport) => {
  await fs.mkdir(path.dirname(report.outPath), { recursive: true })
  await fs.writeFile(report.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
}
