import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { PackDiffReport } from './diffPackTypes'
import { formatMarkdownSummary } from './diffPackSummaryFormatting'

export const writeDiffPackOutputs = async (params: {
  outPath: string
  report: PackDiffReport
  format?: 'json' | 'md'
}) => {
  const outPath = path.resolve(params.outPath)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(params.report, null, 2)}\n`, 'utf-8')

  if (params.format === 'md') {
    const mdPath = outPath.endsWith('.json')
      ? outPath.replace(/\.json$/i, '.md')
      : `${outPath}.md`
    await fs.writeFile(mdPath, `${formatMarkdownSummary(params.report)}\n`, 'utf-8')
  }
}
