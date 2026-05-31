import { fileURLToPath } from 'node:url'

import { parseNotifyNightlyArgs } from './notifyNightlyArgs'
import { buildNightlyIssueBody } from './notifyNightlyFormatting'
import { requestGitHubApi, resolveNightlyRunUrl } from './notifyNightlyGithub'
import {
  collectNightlyIssueReports,
  loadNightlyIssueReports,
} from './notifyNightlyIssueReports'
import { loadNightlyIssueArtifacts } from './notifyNightlyIssueArtifacts'
import {
  hasNightlyPublishGateAlerts,
  loadNightlyPublishGateSummary,
} from './notifyNightlyPublishGateSummary'
import { syncNightlyIssue } from './notifyNightlyIssueSync'
import { loadNightlyAlertsFromInputs } from './notifyNightlyReportState'
import type { NotifyNightlyArgs } from './notifyNightlyTypes'

export { collectNightlyAlerts } from './notifyNightlyAlerts'
export { buildNightlyIssueBody } from './notifyNightlyFormatting'
export { resolveNightlyDiffPaths as resolveDiffPaths } from './notifyNightlyFiles'
export { collectNightlyIssueReports, loadNightlyIssueReports }
export { loadNightlyIssueArtifacts }

export const runNotifyNightly = async (args: NotifyNightlyArgs) => {
  const { diffPaths, alerts } = await loadNightlyAlertsFromInputs(args.diffPaths)
  const issueArtifacts = await loadNightlyIssueArtifacts(args)
  const publishGateSummary = await loadNightlyPublishGateSummary(args.publishGateSummaryPath)
  const issueReports = issueArtifacts.summaries
  if (diffPaths.length === 0) {
    console.log('No diff reports found.')
    return
  }

  if (
    alerts.length === 0 &&
    issueReports.length === 0 &&
    !hasNightlyPublishGateAlerts(publishGateSummary)
  ) {
    console.log('No WARN/FAIL districts, publish gate alerts, or synced issue reports found.')
    return
  }

  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  const runUrl = resolveNightlyRunUrl()

  if (!token || !repo) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error('Missing GITHUB_TOKEN or GITHUB_REPOSITORY')
    }
    console.warn('Missing GitHub credentials; skipping notification.')
    return
  }

  const body = buildNightlyIssueBody({
    alerts,
    publishGateSummary: publishGateSummary
      ? {
          ...publishGateSummary,
          summaryUrl: args.publishGateSummaryUrl,
        }
      : null,
    issueReports,
    topIssueSegments: issueArtifacts.topSegments,
    topIssueReasons: issueArtifacts.topReasons,
    issueArtifacts: {
      ...issueArtifacts.artifacts,
      indexUrl: args.issueInputUrl,
      workflowSummaryUrl: args.issueInputUrl,
      indexSummaryUrl: args.issueInputUrl,
      indexSurfaceUrl: args.issueInputUrl,
      packetSummaryUrl: args.issuePacketUrl,
      packetUrl: args.issuePacketUrl,
      csvUrl: args.issueCsvUrl,
    },
    runUrl,
  })
  const result = await syncNightlyIssue({
    token,
    repo,
    body,
    requestApi: requestGitHubApi,
  })
  if (result.action === 'commented') {
    console.log(`Commented on issue #${result.issueNumber}`)
    return
  }
  console.log(`Created issue #${result.issueNumber ?? 'unknown'}`)
}

const run = async () => {
  await runNotifyNightly(parseNotifyNightlyArgs(process.argv))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
