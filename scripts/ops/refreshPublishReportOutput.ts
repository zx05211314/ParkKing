import {
  summarizeRefreshPublishReportWarnings,
  type RefreshPublishReportResult,
} from './refreshPublishReportState'

export const formatRefreshPublishReport = (result: RefreshPublishReportResult) => {
  const warnings = summarizeRefreshPublishReportWarnings(result.summary)
  return [
    '# Refresh Publish Report: PASS',
    '',
    '## Inputs',
    '',
    `- Config: ${result.configPath}`,
    `- Dataset dir: ${result.datasetDir}`,
    `- Output report: ${result.outPath ?? 'not written'}`,
    `- Time slots: day ${result.dayHhmm}, night ${result.nightHhmm}`,
    '',
    '## District',
    '',
    `- District: ${result.summary.districtId}`,
    `- Dataset hash: ${result.summary.datasetHash}`,
    `- Baseline status: ${result.summary.baselineStatus}`,
    `- Counts: segments ${result.summary.counts?.segments ?? 0}, inferred ${result.summary.counts?.inferredCandidates ?? 0}, signOverrides ${result.summary.counts?.signOverrides ?? 0}`,
    `- Report warnings: info ${warnings.INFO}, warn ${warnings.WARN}, fail ${warnings.FAIL}`,
  ].join('\n')
}
