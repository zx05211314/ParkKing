import type { QaReviewGeojsonResult } from './qaReviewGeojsonTypes'

const formatList = (values: string[]) =>
  values.length === 0 ? '- none' : values.map((value) => `- ${value}`).join('\n')

export const formatQaReviewGeojson = (result: QaReviewGeojsonResult) =>
  [
    `# QA Review GeoJSON: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Input: ${result.inputPath}`,
    `- Out: ${result.outPath ?? 'stdout/json only'}`,
    `- Rows: ${result.totalRows}`,
    `- Features: ${result.featureCount}`,
    `- Skipped rows: ${result.skippedRows}`,
    '',
    '## Next Step',
    '',
    result.pass
      ? '- Load the GeoJSON in a map viewer or GIS tool, then use the linked Street View / map evidence to fill the handoff CSV.'
      : '- Fix CSV errors before using the review map layer.',
    '',
    '## Errors',
    '',
    formatList(result.errors),
    '',
    '## Warnings',
    '',
    formatList(result.warnings),
  ].join('\n')
