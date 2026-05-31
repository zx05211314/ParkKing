import type { P0FinalizeReviewResult } from './p0FinalizeReviewTypes'
import { REVIEW_TIMESTAMP_MESSAGE } from './reviewTimestamp'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const status = (pass: boolean | null | undefined) => {
  if (pass === undefined || pass === null) {
    return 'not run'
  }
  return pass ? 'PASS' : 'FAIL'
}

const quoteArg = (value: string) => `"${value}"`

const publishOverrideArgs = (result: P0FinalizeReviewResult) =>
  (result.inputs.allowPublishWarn || result.inputs.allowPublishFail) &&
  result.inputs.publishOverrideReason
    ? `${result.inputs.allowPublishWarn ? ' --allow-publish-warn' : ''}${result.inputs.allowPublishFail ? ' --allow-publish-fail' : ''} --publish-override ${quoteArg(result.inputs.publishOverrideReason)}`
    : ''

const ingestPublishOverrideArgs = (result: P0FinalizeReviewResult) =>
  (result.inputs.allowPublishWarn || result.inputs.allowPublishFail) &&
  result.inputs.publishOverrideReason
    ? `${result.inputs.allowPublishWarn ? ' --allowWarn' : ''}${result.inputs.allowPublishFail ? ' --allowFail' : ''} --override ${quoteArg(result.inputs.publishOverrideReason)}`
    : ''

const formatNextStep = (result: P0FinalizeReviewResult) => {
  if (result.stage === 'promote') {
    return [
      '- Fill `reviewStatus`, `reviewNote`, and `createdAt` in the handoff CSV from observed evidence, then rerun finalize.',
      `- Timestamp format: ${REVIEW_TIMESTAMP_MESSAGE}.`,
      `- Handoff CSV: ${result.inputs.reviewsPath}`,
    ]
  }
  if (result.stage === 'ingest') {
    return [
      '- Fix ingest errors before refreshing publish report or readiness.',
      `- Rebuild manually: npm run ingest:all -- --configs ${quoteArg(result.inputs.configPath)}${ingestPublishOverrideArgs(result)}`,
    ]
  }
  if (result.stage === 'refresh') {
    return [
      '- Rebuild succeeded, but publish report refresh failed.',
      `- Refresh manually: npm run ops:refresh-publish-report -- --config ${quoteArg(result.inputs.configPath)} --out ${quoteArg(result.inputs.publishReportPath ?? '')}`,
    ]
  }
  if (result.stage === 'answerCases') {
    return [
      '- Rebuild and publish report refresh succeeded, but reviewed answer case generation failed.',
      `- Regenerate manually: npm run ops:write-answer-cases -- --input ${quoteArg(result.inputs.mergedOutPath)} --dataset-dir ${quoteArg(result.refresh?.datasetDir ?? '')} --out ${quoteArg(result.inputs.answerCasesPath)}`,
    ]
  }
  if (result.stage === 'readiness') {
    return [
      '- Finalize ran through ingest and report refresh, but readiness is still blocked.',
      `- Inspect readiness: npm run ops:p0-readiness -- --review ${quoteArg(result.inputs.mergedOutPath)} --config ${quoteArg(result.inputs.configPath)}${publishOverrideArgs(result)}`,
    ]
  }
  return [
    '- P0 finalize passed. The merged reviewed CSV, rebuilt pack, publish report, and readiness gate are aligned.',
    '- Build production UI before release smoke: npm run build',
    '- Run full P1 release readiness: npm run ops:p1-release-readiness',
    `- Optional standalone MAP reviewed-answer smoke: npm run ops:smoke-ui-parking-answers-map:preview -- --cases ${quoteArg(result.inputs.answerCasesPath)} --district ${result.inputs.districtId} --limit 1 --timeout-ms 25000`,
  ]
}

export const formatP0FinalizeReview = (result: P0FinalizeReviewResult) =>
  [
    `# P0 Finalize Review: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Source QA CSV: ${result.inputs.sourcePath}`,
    `- Handoff CSV: ${result.inputs.reviewsPath}`,
    `- Merged CSV: ${result.inputs.mergedOutPath}`,
    `- Config: ${result.inputs.configPath}`,
    `- Answer cases: ${result.inputs.answerCasesPath}`,
    `- Override out dir: ${result.inputs.outDir ?? 'default data/overrides'}`,
    `- Publish report: ${result.inputs.publishReportPath ?? 'default'}`,
    `- Cleanup: ${result.inputs.noCleanup ? 'skipped' : 'enabled'}`,
    `- Allow publish WARN override: ${result.inputs.allowPublishWarn ? 'yes' : 'no'}`,
    `- Allow publish FAIL override: ${result.inputs.allowPublishFail ? 'yes' : 'no'}`,
    `- Publish override reason: ${result.inputs.publishOverrideReason ?? 'none'}`,
    '',
    '## Steps',
    '',
    `- Promote: ${status(result.promote?.pass)}`,
    `- Ingest: ${status(result.ingest?.pass)}`,
    `- Refresh publish report: ${status(result.refresh ? true : null)}`,
    `- Write answer cases: ${status(result.answerCases?.pass)}`,
    `- Readiness with merged CSV: ${status(result.readiness?.pass)}`,
    `- Stopped at: ${result.stage}`,
    '',
    '## Outputs',
    '',
    `- Applied review rows: ${result.promote?.apply?.appliedRows ?? 'not run'}`,
    `- Effective overrides: ${result.promote?.gate?.preflight?.effectiveOverrides ?? 'not run'}`,
    `- Refreshed dataset hash: ${result.refresh?.summary.datasetHash ?? 'not run'}`,
    `- Answer cases written: ${result.answerCases?.casesWritten ?? 'not run'}`,
    `- Readiness publish gate: ${result.readiness?.publishGate.pass === undefined ? 'not run' : status(result.readiness.publishGate.pass)}`,
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
