import type { P0PrepareReviewResult } from './p0PrepareReviewTypes'
import { REVIEW_TIMESTAMP_MESSAGE } from './reviewTimestamp'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

const formatPromoteCommand = (result: P0PrepareReviewResult) =>
  [
    'npm run ops:p0-promote-review --',
    '--district',
    result.inputs.districtId,
    '--source',
    quoteArg(result.inputs.sourcePath),
    '--reviews',
    quoteArg(result.inputs.nextReviewOutPath),
    '--merged-out',
    quoteArg(result.inputs.mergedOutPath),
    '--config',
    quoteArg(result.inputs.configPath),
  ].join(' ')

const formatFinalizeCommand = (result: P0PrepareReviewResult) =>
  [
    'npm run ops:p0-finalize-review --',
    '--district',
    result.inputs.districtId,
    '--source',
    quoteArg(result.inputs.sourcePath),
    '--reviews',
    quoteArg(result.inputs.nextReviewOutPath),
    '--merged-out',
    quoteArg(result.inputs.mergedOutPath),
    '--config',
    quoteArg(result.inputs.configPath),
  ].join(' ')

const formatQaReview = (result: P0PrepareReviewResult) => {
  const summary = result.qaReview
  if (!summary) {
    return ['- Status: not run']
  }
  return [
    `- Status: ${summary.pass ? 'PASS' : 'BLOCKED'}`,
    `- Rows: total ${summary.totalRows}, valid reviewed ${summary.validReviewedRows}, pending ${summary.pendingRows}`,
    `- Missing statuses: ${summary.reviewRequirements.missingStatuses.join(', ') || 'none'}`,
    `- Missing buckets: ${summary.reviewRequirements.missingBuckets.join(', ') || 'none'}`,
    `- Next-review rows: ${summary.nextReviewRows.length}`,
  ]
}

const formatArtifacts = (result: P0PrepareReviewResult) => [
  `- Handoff CSV: ${result.nextReviewRowsWritten} row(s) -> ${result.inputs.nextReviewOutPath}`,
  `- Checklist: ${result.checklist ? (result.checklist.pass ? 'PASS' : 'FAIL') : 'not run'} -> ${result.inputs.checklistOutPath}`,
  `- GeoJSON: ${result.geojson ? (result.geojson.pass ? 'PASS' : 'FAIL') : 'not run'} -> ${result.inputs.geojsonOutPath}`,
  `- Planned merged CSV: ${result.inputs.mergedOutPath}`,
]

const formatNextStep = (result: P0PrepareReviewResult) => {
  if (!result.pass) {
    return ['- Fix prepare errors before handing this packet to a reviewer.']
  }
  if (result.qaReview?.pass) {
    return [
      `- QA review inputs already pass. Run \`${formatPromoteCommand(result)}\` to promote the source review CSV without adding handoff rows.`,
    ]
  }
  return [
    '- Review the handoff rows in the checklist or GeoJSON layer.',
    '- Fill `reviewStatus`, `reviewNote`, and `createdAt` from observed curb/sign/parking-space evidence.',
    `- Timestamp format: ${REVIEW_TIMESTAMP_MESSAGE}.`,
    `- Finalize after review: \`${formatFinalizeCommand(result)}\``,
  ]
}

export const formatP0PrepareReview = (result: P0PrepareReviewResult) =>
  [
    `# P0 Prepare Review: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Source QA CSV: ${result.inputs.sourcePath}`,
    `- Manifest: ${result.inputs.manifestPath ?? 'adjacent/default'}`,
    `- Config: ${result.inputs.configPath}`,
    `- Next-review limit: ${result.inputs.nextReviewRowsLimit}`,
    '',
    '## QA Review Inputs',
    '',
    ...formatQaReview(result),
    '',
    '## Artifacts',
    '',
    ...formatArtifacts(result),
    '',
    '## Next Step',
    '',
    ...formatNextStep(result),
    '',
    '## Review Blockers',
    '',
    formatList(result.qaReview?.errors ?? []),
    '',
    '## Prepare Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
