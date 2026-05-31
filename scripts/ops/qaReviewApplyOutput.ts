import type { QaReviewApplyResult } from './qaReviewApplyTypes'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

export const formatQaReviewApply = (result: QaReviewApplyResult) =>
  [
    `# QA Review Apply: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Source: ${result.sourcePath}`,
    `- Reviews: ${result.reviewsPath}`,
    `- Out: ${result.outPath}`,
    `- Manifest: ${result.manifestPath ?? 'not written'}`,
    `- Review handoff rows: ${result.reviewedInputRows} reviewed / ${result.totalReviewRows} total`,
    `- Applied rows: ${result.appliedRows}`,
    `- Skipped blank rows: ${result.skippedBlankRows}`,
    '',
    '## Next Step',
    '',
    result.pass
      ? `- Gate the merged CSV: npm run ops:qa-review-gate -- --input "${result.outPath}" --config <config.json>`
      : '- Fix errors before running the QA review gate.',
    '',
    '## Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
