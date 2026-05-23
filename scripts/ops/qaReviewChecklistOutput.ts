import type {
  QaReviewChecklistResult,
  QaReviewChecklistRow,
} from './qaReviewChecklistTypes'
import { REVIEW_TIMESTAMP_MESSAGE } from './reviewTimestamp'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

const formatValue = (value: string | number | null) =>
  value === null || value === '' ? 'unknown' : String(value)

const quoteArg = (value: string) => `"${value.replace(/"/g, '\\"')}"`

const formatContext = (row: QaReviewChecklistRow) => {
  const values = [
    row.allowedNow ? `action ${row.allowedNow}` : null,
    row.tier ? `tier ${row.tier}` : null,
    row.score ? `score ${row.score}` : null,
    row.curbMarking ? `curb ${row.curbMarking}` : null,
    row.sourceType ? `source ${row.sourceType}` : null,
    row.sourceReliability ? `sourceReliability ${row.sourceReliability}` : null,
    row.dataFreshnessDays ? `freshnessDays ${row.dataFreshnessDays}` : null,
    row.finalConfidence ? `finalConfidence ${row.finalConfidence}` : null,
    row.coverageConfidence ? `coverageConfidence ${row.coverageConfidence}` : null,
    row.overrideConfidence ? `overrideConfidence ${row.overrideConfidence}` : null,
    row.parkingSpaceCount ? `spaces ${row.parkingSpaceCount}` : null,
    row.topReasons ? `reasons ${row.topReasons}` : null,
    row.flags ? `flags ${row.flags}` : null,
    row.riskTags ? `riskTags ${row.riskTags}` : null,
    row.signOverrideStatus ? `overrideStatus ${row.signOverrideStatus}` : null,
    row.signOverrideSource ? `overrideSource ${row.signOverrideSource}` : null,
  ].filter((value): value is string => value !== null)

  return values.length === 0 ? 'none' : values.join(', ')
}

const formatLinks = (row: QaReviewChecklistRow) => {
  const links = [
    row.mapsUrl ? `[Map](${row.mapsUrl})` : null,
    row.streetViewUrl ? `[Street View](${row.streetViewUrl})` : null,
  ].filter((value): value is string => value !== null)

  return links.length === 0 ? 'none' : links.join(' | ')
}

const formatLocation = (row: QaReviewChecklistRow) =>
  row.lat && row.lon ? `${row.lat}, ${row.lon}` : 'unknown'

const formatRowWarning = (row: QaReviewChecklistRow) =>
  row.reviewStatus && (!row.reviewNote || !row.createdAt)
    ? '- Row warning: reviewStatus is set but reviewNote/createdAt is incomplete.'
    : null

const formatRow = (row: QaReviewChecklistRow, index: number) =>
  [
    `### ${index + 1}. source row ${row.sourceRowNumber} - ${row.reviewBucket} - ${row.segmentId}`,
    '',
    `- District: ${formatValue(row.districtId)}`,
    `- CSV row: ${row.rowNumber}`,
    `- Plan rank: ${formatValue(row.reviewPlanRank)}`,
    `- Plan reason: ${formatValue(row.reviewPlanReason)}`,
    `- Location: ${formatLocation(row)}`,
    `- Context: ${formatContext(row)}`,
    `- Existing sign override note: ${formatValue(row.signOverrideNote ?? null)}`,
    `- Existing sign override verifiedAt: ${formatValue(row.signOverrideVerifiedAt ?? null)}`,
    `- Evidence links: ${formatLinks(row)}`,
    `- Existing reviewStatus: ${formatValue(row.reviewStatus)}`,
    `- Existing reviewNote: ${formatValue(row.reviewNote)}`,
    `- Existing createdAt: ${formatValue(row.createdAt)}`,
    formatRowWarning(row),
    `- Fill in handoff CSV: reviewStatus, reviewNote, createdAt (${REVIEW_TIMESTAMP_MESSAGE})`,
    `- Verdict checklist: [ ] LEGAL  [ ] ILLEGAL  [ ] UNCLEAR`,
  ]
    .filter((value): value is string => value !== null)
    .join('\n')

const formatApplyCommand = (result: QaReviewChecklistResult) => {
  if (!result.sourcePath || !result.mergedOutPath) {
    return '- Apply command unavailable until --source and --merged-out are provided.'
  }
  return [
    '```powershell',
    [
      'npm run ops:apply-qa-review --',
      '--source',
      quoteArg(result.sourcePath),
      '--reviews',
      quoteArg(result.inputPath),
      '--out',
      quoteArg(result.mergedOutPath),
    ].join(' '),
    '```',
  ].join('\n')
}

const formatGateCommand = (result: QaReviewChecklistResult) => {
  if (!result.configPath || !result.mergedOutPath) {
    return '- Gate command unavailable until --config and --merged-out are provided.'
  }
  return [
    '```powershell',
    [
      'npm run ops:qa-review-gate --',
      '--input',
      quoteArg(result.mergedOutPath),
      '--config',
      quoteArg(result.configPath),
    ].join(' '),
    '```',
  ].join('\n')
}

export const formatQaReviewChecklist = (result: QaReviewChecklistResult) =>
  [
    `# ${result.title}`,
    '',
    '## Packet',
    '',
    `- Status: ${result.pass ? 'PASS' : 'FAIL'}`,
    `- Next-review CSV: ${result.inputPath}`,
    `- Source QA CSV: ${result.sourcePath ?? 'not provided'}`,
    `- Output checklist: ${result.outPath ?? 'stdout'}`,
    `- Merged output CSV: ${result.mergedOutPath ?? 'not provided'}`,
    `- Config: ${result.configPath ?? 'not provided'}`,
    `- Handoff rows: ${result.totalRows}`,
    `- Rows already carrying reviewStatus: ${result.rowsWithReviewStatus}`,
    `- Source dataset hash: ${result.provenance.sourceDatasetHash ?? 'unknown'}`,
    `- Source config hash: ${result.provenance.sourceConfigHash ?? 'unknown'}`,
    `- Source row total: ${result.provenance.sourceRowsTotal ?? 'unknown'}`,
    '',
    '## Reviewer Rules',
    '',
    '- Fill `reviewStatus` only after checking curb/sign/parking-space evidence; do not copy product predictions into the verdict.',
    '- Allowed values are `LEGAL`, `ILLEGAL`, and `UNCLEAR`.',
    '- Use `UNCLEAR` when imagery or field evidence does not prove the rule.',
    `- Put the evidence source and observation in \`reviewNote\`, then set \`createdAt\` / \`reviewedAt\` to the review timestamp. ${REVIEW_TIMESTAMP_MESSAGE}.`,
    '',
    '## Rows',
    '',
    result.rows.length === 0
      ? '- none'
      : result.rows.map((row, index) => formatRow(row, index)).join('\n\n'),
    '',
    '## After Review',
    '',
    'Apply filled handoff rows back into the source QA CSV:',
    '',
    formatApplyCommand(result),
    '',
    'Gate the merged CSV before ingest/export:',
    '',
    formatGateCommand(result),
    '',
    '## Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
