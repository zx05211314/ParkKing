import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  appendWorkflowSummary,
  parseWorkflowSummaryArgs,
} from './workflowSummary'

describe('workflowSummary', () => {
  it('parses summary append events in command order', () => {
    expect(
      parseWorkflowSummaryArgs([
        'node',
        'workflow-summary',
        '--summary',
        'summary.md',
        '--append-glob',
        '.tmp/*.md',
        '--heading',
        'Artifacts',
        '--env-link',
        'Issue index=ISSUE_INDEX_URL',
        '--link',
        'Static=https://example.test/static',
      ]),
    ).toEqual({
      summaryPath: 'summary.md',
      events: [
        { type: 'appendGlob', pattern: '.tmp/*.md' },
        { type: 'heading', text: 'Artifacts' },
        { type: 'envLink', label: 'Issue index', envName: 'ISSUE_INDEX_URL' },
        { type: 'link', label: 'Static', url: 'https://example.test/static' },
      ],
    })
  })

  it('appends existing files and env-backed artifact links', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'workflow-summary-'))
    const summaryPath = path.join(base, 'summary.md')
    const summariesDir = path.join(base, 'summaries')
    await fs.mkdir(summariesDir, { recursive: true })
    await fs.writeFile(path.join(summariesDir, 'b.md'), '# B\n', 'utf-8')
    await fs.writeFile(path.join(summariesDir, 'a.md'), '# A\n', 'utf-8')

    const result = await appendWorkflowSummary(
      {
        summaryPath,
        events: [
          { type: 'appendGlob', pattern: path.join(summariesDir, '*.md') },
          { type: 'appendFile', filePath: path.join(base, 'missing.md') },
          { type: 'heading', text: 'Issue artifact downloads' },
          { type: 'envLink', label: 'Issue index', envName: 'ISSUE_INDEX_URL' },
          { type: 'envLink', label: 'Issue csv', envName: 'ISSUE_CSV_URL' },
        ],
      },
      {
        ISSUE_INDEX_URL: 'https://example.test/index',
        ISSUE_CSV_URL: '',
      },
    )

    const summary = await fs.readFile(summaryPath, 'utf-8')
    expect(result.appended).toBe(true)
    expect(result.appendedFiles.map((filePath) => path.basename(filePath))).toEqual([
      'a.md',
      'b.md',
    ])
    expect(result.skippedFiles).toContain(path.join(base, 'missing.md'))
    expect(result.skippedLinks).toEqual(['Issue csv=ISSUE_CSV_URL'])
    expect(summary).toContain('# A\n\n# B')
    expect(summary).toContain('## Issue artifact downloads')
    expect(summary).toContain('- [Issue index](https://example.test/index)')
    expect(summary).not.toContain('Issue csv')
  })

  it('skips writes when no summary path is available', async () => {
    const result = await appendWorkflowSummary(
      {
        events: [{ type: 'heading', text: 'No target' }],
      },
      {},
    )

    expect(result.appended).toBe(false)
    expect(result.summaryPath).toBeNull()
    expect(result.linesWritten).toBe(1)
  })
})
