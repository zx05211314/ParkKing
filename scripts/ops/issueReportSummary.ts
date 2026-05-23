import { basename, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIssueReportPublishGateHotspots } from './issueReportSummaryHotspots'
import { parseIssueReportSummaryArgs } from './issueReportSummaryArgs'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactBundleUrls,
} from './issueReportArtifactUrlResolvers'
import { writeIssueReportSummaryCsvFiles } from './issueReportSummaryCsvFiles'
import { writeIssueReportTriagePacketBundle } from './issueReportSummaryPacketFiles'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import {
  renderIssueReportSummaryBundleHandoff,
  renderIssueReportSummary,
  renderIssueReportSummaryWithArtifacts,
  renderIssueReportSummaryWithPublishGate,
} from './issueReportSummaryOutput'
import { buildIssueReportTriagePacketBundle } from './issueReportSummaryPackets'
import { loadIssueReportSummary } from './issueReportSummaryState'
import { loadNightlyPublishGateSummary } from './notifyNightlyPublishGateSummary'
import type {
  IssueReportSummaryArtifactOutputs,
  IssueReportSummaryJsonOutput,
} from './issueReportSummaryTypes'
import { ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION } from './issueReportSummaryTypes'

export {
  buildIssueReportTriagePacketBundle,
  parseIssueReportSummaryArgs,
  writeIssueReportSummaryCsvFiles,
  writeIssueReportTriagePacketBundle,
  writeIssueReportSummaryOutput,
  renderIssueReportSummary,
  renderIssueReportSummaryWithPublishGate,
  loadIssueReportSummary,
}

export const buildIssueReportSummaryJsonOutput = (params: {
  result: Awaited<ReturnType<typeof loadIssueReportSummary>>
  publishGateSummary: Awaited<ReturnType<typeof loadNightlyPublishGateSummary>>
  publishGateHotspots: ReturnType<typeof buildIssueReportPublishGateHotspots>
  artifacts: IssueReportSummaryArtifactOutputs
}): IssueReportSummaryJsonOutput => ({
  ...params.result,
  artifactType: 'issue-report-summary-json',
  schemaVersion: ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION,
  publishGateSummary: params.publishGateSummary,
  publishGateHotspots: params.publishGateHotspots,
  artifacts: params.artifacts,
})

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const toPortableRelativePath = (rootPath: string | null, entryPath: string | null) =>
  rootPath && entryPath ? toPortablePath(relative(rootPath, entryPath)) : null

const toPortableFileName = (entryPath: string | null) =>
  entryPath ? toPortablePath(basename(entryPath)) : null

const pickPreferredCsvRelativePath = (relativePaths: string[]) =>
  relativePaths.find((entry) => entry === 'publish-gate-districts.csv')
  ?? relativePaths.find((entry) => entry === 'top-segments.csv')
  ?? relativePaths[0]
  ?? null

const run = async () => {
  const args = parseIssueReportSummaryArgs(process.argv)
  const result = await loadIssueReportSummary(args)
  const publishGateSummary = await loadNightlyPublishGateSummary(args.publishGateSummaryPath)
  const publishGateHotspots = buildIssueReportPublishGateHotspots(
    result.topSegments,
    publishGateSummary,
  )
  const content =
    args.json ? null : renderIssueReportSummaryWithPublishGate(result, publishGateSummary)
  const writes: string[] = []
  let summaryWritePath: string | null = null
  let rawWritePath: string | null = null

  if (args.outPath) {
    summaryWritePath =
      args.json
        ? resolve(process.cwd(), args.outPath)
        : await writeIssueReportSummaryOutput(args.outPath, content ?? '')
    writes.push(`Wrote issue report summary to ${summaryWritePath}`)
  }

  if (args.rawOutPath) {
    rawWritePath = await writeIssueReportSummaryOutput(
      args.rawOutPath,
      JSON.stringify(result.rawIssues, null, 2),
    )
    writes.push(`Wrote raw issue report export to ${rawWritePath}`)
  }

  let csvWrite: Awaited<ReturnType<typeof writeIssueReportSummaryCsvFiles>> | null = null
  if (args.csvOutPath) {
    csvWrite = await writeIssueReportSummaryCsvFiles(
      args.csvOutPath,
      result,
      publishGateSummary,
    )
    writes.push(`Wrote issue report CSV exports to ${csvWrite.rootPath}`)
  }

  let packetWrite: Awaited<ReturnType<typeof writeIssueReportTriagePacketBundle>> | null = null
  if (args.packetOutPath) {
    const packetBundle = buildIssueReportTriagePacketBundle(
      result,
      args.packetIssueLimit,
      publishGateSummary,
    )
    packetWrite = await writeIssueReportTriagePacketBundle(
      args.packetOutPath,
      packetBundle,
      {
        packetRootUrl: args.packetRootUrl,
        csvWrite,
        csvRootUrl: args.csvRootUrl,
      },
    )
    writes.push(`Wrote issue report triage packets to ${packetWrite.rootPath}`)
    writes.push(`Wrote issue report triage index to ${packetWrite.manifestPath}`)
  }

  const preferredCsvRelativePath = pickPreferredCsvRelativePath(
    csvWrite?.filePaths.map((filePath) =>
      toPortableRelativePath(csvWrite.rootPath, filePath) ?? toPortablePath(basename(filePath)),
    ) ?? [],
  )
  const packetSummaryRelativePath = toPortableRelativePath(
    packetWrite?.rootPath ?? null,
    packetWrite?.summaryPath ?? null,
  )
  const packetManifestRelativePath = toPortableRelativePath(
    packetWrite?.rootPath ?? null,
    packetWrite?.manifestPath ?? null,
  )
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: args.packetRootUrl,
    csvRootUrl: args.csvRootUrl,
    preferredCsvUrl: null,
    preferredCsvRelativePath,
    packetSummaryUrl: null,
    packetSummaryRelativePath,
    packetManifestUrl: null,
    packetManifestRelativePath,
  })

  const jsonOutput = buildIssueReportSummaryJsonOutput({
    result,
    publishGateSummary,
    publishGateHotspots,
    artifacts: {
      summaryPath: summaryWritePath,
      summaryRelativePath: toPortableFileName(summaryWritePath),
      summaryUrl: joinIssueReportBaseUrl(args.summaryBaseUrl, toPortableFileName(summaryWritePath)),
      rawIssuesPath: rawWritePath,
      rawIssuesRelativePath: toPortableFileName(rawWritePath),
      rawIssuesUrl: joinIssueReportBaseUrl(args.rawBaseUrl, toPortableFileName(rawWritePath)),
      csvRootPath: csvWrite?.rootPath ?? null,
      csvRootUrl: args.csvRootUrl,
      csvBaseUrl: null,
      preferredCsvPath:
        csvWrite?.filePaths.find((filePath) => toPortablePath(basename(filePath)) === 'publish-gate-districts.csv')
        ?? csvWrite?.filePaths.find((filePath) => toPortablePath(basename(filePath)) === 'top-segments.csv')
        ?? csvWrite?.filePaths[0]
        ?? null,
      preferredCsvRelativePath,
      preferredCsvUrl,
      csvPaths: csvWrite?.filePaths ?? [],
      csvRelativePaths:
        csvWrite?.filePaths.map((filePath) =>
          toPortableRelativePath(csvWrite.rootPath, filePath) ?? toPortablePath(basename(filePath)),
        ) ?? [],
      packetRootPath: packetWrite?.rootPath ?? null,
      packetRootUrl: args.packetRootUrl,
      packetBaseUrl: null,
      packetSummaryPath: packetWrite?.summaryPath ?? null,
      packetSummaryRelativePath,
      packetSummaryUrl,
      packetManifestPath: packetWrite?.manifestPath ?? null,
      packetManifestRelativePath,
      packetManifestUrl,
      packetPaths:
        packetWrite
          ? [
              packetWrite.summaryPath,
              packetWrite.manifestPath,
              ...packetWrite.segmentPacketPaths,
              ...packetWrite.reasonPacketPaths,
            ]
          : [],
      packetRelativePaths:
        packetWrite
          ? [
              toPortableRelativePath(packetWrite.rootPath, packetWrite.summaryPath) ?? 'summary.md',
              toPortableRelativePath(packetWrite.rootPath, packetWrite.manifestPath) ?? 'manifest.json',
              ...packetWrite.segmentEntries.map(({ relativePath }) => relativePath),
              ...packetWrite.reasonEntries.map(({ relativePath }) => relativePath),
            ]
          : [],
    },
  })
  const finalContent =
    args.json
      ? JSON.stringify(jsonOutput, null, 2)
      : renderIssueReportSummaryWithArtifacts({
          result,
          publishGateSummary,
          summaryPath: summaryWritePath,
          summary: jsonOutput,
        })

  if (args.json && summaryWritePath) {
    await writeIssueReportSummaryOutput(summaryWritePath, finalContent)
  }

  const exportHandoff = renderIssueReportSummaryBundleHandoff(jsonOutput)
  if (writes.length > 0) {
    writes.forEach((line) => console.log(line))
    if (exportHandoff.length > 0) {
      console.log('')
      console.log(exportHandoff)
    }
    if (!args.outPath) {
      console.log(finalContent)
    }
    return
  }

  console.log(finalContent)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
