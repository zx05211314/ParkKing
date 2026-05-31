import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseExportOverridesArgs } from './exportOverrideArgs'
import {
  normalizeDistrictId,
  sanitizeSegmentReport,
} from './exportOverrideNormalization'
import {
  groupReportsByDistrict,
  selectLatestReports,
  sortDistrictReports,
} from './exportOverrideSelection'
import { parseReportInputFile } from './exportOverrideStore'
import type {
  ExportOverridesParams,
  ExportOverridesResult,
  SegmentReport,
} from './exportOverrideTypes'

const sanitizeReportsForExport = (reports: SegmentReport[]) => {
  const errors: string[] = []
  const sanitized = reports
    .map((report, index) => {
      const normalized = sanitizeSegmentReport(report)
      if (!normalized) {
        errors.push(
          `report ${index + 1}: districtId, segmentId, reviewStatus, and createdAt are required; reviewStatus must be LEGAL, ILLEGAL, or UNCLEAR`,
        )
        return null
      }
      if (!normalized.note) {
        errors.push(`report ${index + 1}: reviewNote is required when reviewStatus is set`)
        return null
      }
      return normalized
    })
    .filter((report): report is SegmentReport => Boolean(report))

  if (errors.length > 0) {
    throw new Error(`Invalid override report input:\n- ${errors.join('\n- ')}`)
  }

  return sanitized
}

const writeFileIfChanged = async (filePath: string, content: string) => {
  try {
    const existing = await fs.readFile(filePath, 'utf-8')
    if (existing === content) {
      return false
    }
  } catch (error) {
    if (!(error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT')) {
      throw error
    }
  }

  await fs.writeFile(filePath, content, 'utf-8')
  return true
}

export const exportOverrides = async (
  params: ExportOverridesParams,
): Promise<ExportOverridesResult[]> => {
  const inputPath = path.resolve(params.inputPath)
  const outDir = params.outDir ? path.resolve(params.outDir) : path.resolve('data', 'overrides')

  const rawReports = await parseReportInputFile(inputPath)
  const sanitized = sanitizeReportsForExport(rawReports)

  if (sanitized.length === 0) {
    throw new Error('No valid reports found to export.')
  }

  const latestReports = selectLatestReports(sanitized)
  await fs.mkdir(outDir, { recursive: true })

  const districts = groupReportsByDistrict(latestReports)
  const results: ExportOverridesResult[] = []

  for (const [districtId, reports] of districts) {
    const sorted = sortDistrictReports(reports)
    const fileName = `${normalizeDistrictId(districtId)}.jsonl`
    const outputPath = path.resolve(outDir, fileName)
    const lines = sorted.map((entry) => JSON.stringify(entry)).join('\n')
    const didWrite = await writeFileIfChanged(outputPath, `${lines}\n`)
    console.log(
      `Exported ${sorted.length} override reports to ${outputPath}${didWrite ? '' : ' (unchanged)'}`,
    )
    results.push({ districtId, outputPath, count: sorted.length })
  }

  return results
}

const run = async () => {
  const args = parseExportOverridesArgs(process.argv)
  if (!args.inputPath) {
    throw new Error(
      'Usage: tsx exportOverrides.ts --input <reports.json|reports.jsonl|qa-review.csv>',
    )
  }
  await exportOverrides({ inputPath: args.inputPath, outDir: args.outDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
