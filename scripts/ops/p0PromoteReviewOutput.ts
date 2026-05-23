import type { P0PromoteReviewResult } from './p0PromoteReviewTypes'
import { REVIEW_TIMESTAMP_MESSAGE } from './reviewTimestamp'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const quoteArg = (value: string) => `"${value}"`

const formatGateSummary = (result: P0PromoteReviewResult) => {
  const gate = result.gate
  if (!gate) {
    return [
      '- Gate: not run',
      '- Reason: apply step failed before a merged review CSV could be gated.',
    ]
  }
  return [
    `- Gate: ${gate.pass ? 'PASS' : 'FAIL'}`,
    `- Review rows: ${gate.summary.validReviewedRows} valid / ${gate.summary.reviewedRows} reviewed / ${gate.summary.totalRows} total`,
    `- Effective overrides: ${gate.preflight?.effectiveOverrides ?? 'not run'}`,
    `- Matched segment overrides: ${gate.preflight?.matchedSegmentOverrides ?? 'not run'}`,
    `- Override out dir: ${gate.outDir}`,
  ]
}

const formatNextStep = (result: P0PromoteReviewResult) => {
  if (result.pass && !result.apply && result.gate?.pass) {
    return [
      `- Source review CSV was already gate-ready and was copied to: ${result.inputs.mergedOutPath}`,
      `- Ingest-ready overrides were written under: ${result.gate.outDir}`,
      `- Rebuild district pack: npm run ingest:all -- --configs ${quoteArg(result.inputs.configPath)}`,
      `- Refresh publish report from rebuilt pack: npm run ops:refresh-publish-report -- --config ${quoteArg(result.inputs.configPath)}`,
      `- Re-run readiness against the merged reviewed CSV: npm run ops:p0-readiness -- --review ${quoteArg(result.inputs.mergedOutPath)} --config ${quoteArg(result.inputs.configPath)}`,
    ]
  }
  if (!result.apply) {
    if (result.gate && !result.gate.pass) {
      return [
        '- Source review CSV is not gate-ready and the handoff contains no reviewed rows.',
        `- Review or regenerate handoff CSV: ${result.inputs.reviewsPath}`,
        '- Fill review evidence before promotion, or use a source QA CSV that already satisfies the P0 gate.',
      ]
    }
    return [
      '- Add evidence notes and review timestamps for every reviewed handoff row, then rerun this command.',
      `- Timestamp format: ${REVIEW_TIMESTAMP_MESSAGE}.`,
      `- Handoff CSV: ${result.inputs.reviewsPath}`,
      '- P0 promotion requires auditable evidence, not just a status value.',
    ]
  }
  if (!result.apply.pass) {
    return [
      '- Fill `reviewStatus`, `reviewNote`, and `createdAt` in the handoff CSV, then rerun this command.',
      `- Timestamp format: ${REVIEW_TIMESTAMP_MESSAGE}.`,
      `- Handoff CSV: ${result.inputs.reviewsPath}`,
      '- Do not fill statuses from product predictions; use observed curb/sign/parking-space evidence.',
    ]
  }
  if (!result.gate?.pass) {
    return [
      '- Fix QA gate errors before ingesting overrides.',
      `- Inspect merged CSV: ${result.inputs.mergedOutPath}`,
    ]
  }
  return [
    `- Ingest-ready overrides were written under: ${result.gate.outDir}`,
    `- Rebuild district pack: npm run ingest:all -- --configs ${quoteArg(result.inputs.configPath)}`,
    `- Refresh publish report from rebuilt pack: npm run ops:refresh-publish-report -- --config ${quoteArg(result.inputs.configPath)}`,
    `- Re-run readiness against the merged reviewed CSV: npm run ops:p0-readiness -- --review ${quoteArg(result.inputs.mergedOutPath)} --config ${quoteArg(result.inputs.configPath)}`,
  ]
}

export const formatP0PromoteReview = (result: P0PromoteReviewResult) =>
  [
    `# P0 Promote Review: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Source QA CSV: ${result.inputs.sourcePath}`,
    `- Handoff CSV: ${result.inputs.reviewsPath}`,
    `- Merged CSV: ${result.inputs.mergedOutPath}`,
    `- Config: ${result.inputs.configPath}`,
    `- Override out dir: ${result.inputs.outDir ?? 'default data/overrides'}`,
    '',
    '## Apply',
    '',
    `- Apply: ${result.apply ? (result.apply.pass ? 'PASS' : 'FAIL') : 'not run'}`,
    `- Handoff rows: ${
      result.apply
        ? `${result.apply.reviewedInputRows} reviewed / ${result.apply.totalReviewRows} total`
        : 'not run'
    }`,
    `- Applied rows: ${result.apply?.appliedRows ?? 'not run'}`,
    `- Skipped blank rows: ${result.apply?.skippedBlankRows ?? 'not run'}`,
    `- Manifest: ${result.apply?.manifestPath ?? 'not written'}`,
    '',
    '## Gate',
    '',
    ...formatGateSummary(result),
    '',
    '## Next Step',
    '',
    ...formatNextStep(result),
    '',
    '## Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
