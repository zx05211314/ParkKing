import { fileURLToPath } from 'node:url'
import { writeDiffPackOutputs, formatConsoleSummary } from './diffPackOutputs'
import { resolvePrevFromNext } from './diffPackLayout'
import {
  buildDiffPackUsageError,
  parseDiffPackArgs,
  resolveDiffPackReportPath,
} from './diffPackArgs'
import { buildPackDiffReport } from './diffPackReport'
import type { PackDiffReport } from './diffPackTypes'
export type { DiffIssue, DiffSeverity, DistrictDiff, PackDiffReport } from './diffPackTypes'

export const diffPacks = async (params: {
  prevDir?: string | null
  nextDir: string
  outPath?: string | null
  format?: 'json' | 'md'
}): Promise<PackDiffReport> => {
  const nextDir = params.nextDir
  let prevDir = params.prevDir ?? null

  if (!prevDir) {
    prevDir = await resolvePrevFromNext(nextDir)
  }

  const report = await buildPackDiffReport({ prevDir, nextDir })

  if (params.outPath) {
    await writeDiffPackOutputs({
      outPath: params.outPath,
      report,
      format: params.format,
    })
  }

  return report
}

const run = async () => {
  const args = parseDiffPackArgs(process.argv)
  if (!args.next) {
    throw buildDiffPackUsageError()
  }

  const nextDir = args.next
  const prevDir = args.prev
  const outPath = args.out
  const format = args.format
  const reportPath = resolveDiffPackReportPath(nextDir, outPath)

  const report = await diffPacks({ prevDir, nextDir, outPath: reportPath, format })

  console.log(formatConsoleSummary(report))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
