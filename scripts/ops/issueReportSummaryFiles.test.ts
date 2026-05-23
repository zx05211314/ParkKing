import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'

describe('issueReportSummaryFiles', () => {
  it('writes summary output to a resolved file path', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-files-'))
    const outPath = '.tmp/reports/issue-summary.md'

    const resolvedPath = await writeIssueReportSummaryOutput(
      outPath,
      '# summary',
      base,
    )

    expect(resolvedPath).toBe(path.resolve(base, outPath))
    await expect(fs.readFile(resolvedPath, 'utf8')).resolves.toBe('# summary')
  })
})
