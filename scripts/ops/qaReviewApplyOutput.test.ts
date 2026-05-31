import { describe, expect, it } from 'vitest'
import { formatQaReviewApply } from './qaReviewApplyOutput'

describe('formatQaReviewApply', () => {
  it('formats apply status and diagnostics', () => {
    const output = formatQaReviewApply({
      sourcePath: 'review.csv',
      reviewsPath: 'next-review.csv',
      outPath: 'merged.csv',
      manifestPath: 'merged.manifest.json',
      totalReviewRows: 2,
      reviewedInputRows: 1,
      skippedBlankRows: 1,
      appliedRows: 1,
      errors: [],
      warnings: ['1 handoff row(s) have blank reviewStatus and were skipped.'],
      pass: true,
    })

    expect(output).toContain('# QA Review Apply: PASS')
    expect(output).toContain('- Manifest: merged.manifest.json')
    expect(output).toContain('- Applied rows: 1')
    expect(output).toContain('npm run ops:qa-review-gate -- --input "merged.csv"')
    expect(output).toContain('## Warnings')
  })
})
