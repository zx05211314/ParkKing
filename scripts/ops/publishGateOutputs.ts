import {
  appendPublishGateLog,
  writePublishGateSummaryFile,
  writePublishGateSummaryMarkdownFile,
} from './publishGateArtifactFiles'
export {
  buildPublishGateRunSummary,
} from './publishGateRunSummary'
export type {
  PublishGateRunSummary,
} from './publishGateRunSummary'

export const writePublishGateArtifacts = async ({
  outputDir,
  summary,
}: {
  outputDir: string
  summary: PublishGateRunSummary
}) => {
  await writePublishGateSummaryFile(outputDir, summary)
  await writePublishGateSummaryMarkdownFile(outputDir, summary)

  if (
    (summary.allowWarn || summary.allowFailRequested || summary.allowBaselineAdopt) &&
    summary.overrideReason
  ) {
    await appendPublishGateLog(outputDir, 'publish_gate_overrides.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath: summary.reportPath,
      allowWarn: summary.allowWarn,
      allowFail: summary.allowFail,
      allowFailRequested: summary.allowFailRequested,
      allowBaselineAdopt: summary.allowBaselineAdopt,
      overrideReason: summary.overrideReason,
      bootstrapModeUsed: summary.bootstrap.modeUsed,
      baselineAdoptApplied: summary.baselineAdopt.applied,
      gateMessageFlags: summary.gateMessageFlags,
      totals: summary.totals,
    })
  }

  if (summary.baselineAdopt.applied && summary.overrideReason) {
    await appendPublishGateLog(outputDir, 'baseline_adopt_stamps.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath: summary.reportPath,
      overrideReason: summary.overrideReason,
      districtIds: summary.baselineAdopt.districtIds,
      reason: 'baseline_adopt',
    })
  }

  if (summary.exitCode !== 0) {
    await appendPublishGateLog(outputDir, 'publish_gate_failures.jsonl', {
      timestamp: new Date().toISOString(),
      reportPath: summary.reportPath,
      exitCode: summary.exitCode,
      totals: summary.totals,
    })
  }
}
