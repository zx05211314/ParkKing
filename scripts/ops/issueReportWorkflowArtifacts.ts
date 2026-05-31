import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifestBundle,
  validateIssueReportArtifactManifestRelations,
} from './issueReportArtifactManifest'
import { parseIssueReportWorkflowArtifactArgs } from './issueReportWorkflowArtifactArgs'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import { writeIssueReportSummaryCsvFiles } from './issueReportSummaryCsvFiles'
import {
  loadIssueReportTriagePacketBundle,
  writeIssueReportTriagePacketBundle,
} from './issueReportSummaryPacketFiles'
import { buildIssueReportTriagePacketBundle } from './issueReportSummaryPackets'
import { loadIssueReportSummary } from './issueReportSummaryState'
import { loadNightlyPublishGateSummary } from './notifyNightlyPublishGateSummary'
import { ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION } from './issueReportSummaryTypes'
import {
  findDistrictIssueHotspot,
  formatDistrictIssueHotspotLabel,
} from './issueReportSummaryHotspots'
import type { IssueReportWorkflowArtifactArgs } from './issueReportWorkflowArtifactArgs'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'
import type {
  IssueReportSegmentPacket,
  IssueReportWorkflowArtifactsManifest,
} from './issueReportSummaryTypes'
import type { IssueReportSummaryCsvWriteResult } from './issueReportSummaryCsvFiles'

export type IssueReportWorkflowArtifactsResult = IssueReportWorkflowArtifactsManifest
type IssueReportWorkflowPublishGateHotspot =
  IssueReportWorkflowArtifactsManifest['publishGateHotspots'][number]

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const buildRootCompatArtifactLinks = (params: {
  packetRootUrl: string | null
  packetLegacyArtifactUrl: string | null
  csvRootUrl: string | null
  csvLegacyArtifactUrl: string | null
}) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: params.packetRootUrl,
    packetLegacyArtifactUrl: params.packetLegacyArtifactUrl,
    csvRootUrl: params.csvRootUrl,
    csvLegacyArtifactUrl: params.csvLegacyArtifactUrl,
  })

const buildIssueReportWorkflowPublishGateHotspots = (params: {
  publishGateSummary: NightlyPublishGateSummary | null
  segmentEntries: Array<{ packet: IssueReportSegmentPacket; relativePath: string }>
  packetRootUrl: string | null
  packetLegacyArtifactUrl: string | null
  csvRootUrl: string | null
  csvLegacyArtifactUrl: string | null
}) =>
  params.publishGateSummary?.topDistricts.map((district) => {
    const hotspot = findDistrictIssueHotspot(
      params.segmentEntries.map(({ packet }) => packet),
      district.districtId,
    )
    const packetPath =
      hotspot
        ? params.segmentEntries.find(({ packet }) => packet.packetId === hotspot.packetId)
            ?.relativePath ?? null
        : null
    return {
      districtId: district.districtId,
      segmentLabel: hotspot ? formatDistrictIssueHotspotLabel(hotspot) : null,
      packetPath: packetPath ? toPortablePath(join('packets', packetPath)) : null,
      ...buildRootCompatArtifactLinks(params),
    }
  }) ?? []

const pickPreferredCsvPath = (csvPaths: string[]) =>
  csvPaths.find((entry) => entry.endsWith('publish-gate-districts.csv'))
  ?? csvPaths.find((entry) => entry.endsWith('top-segments.csv'))
  ?? csvPaths[0]
  ?? null

const createIssueReportWorkflowArtifactsResult = (params: {
  generatedAt: string
  outRoot: string
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportWorkflowArtifactsManifest['publishGateHotspots']
  topDistricts: IssueReportWorkflowArtifactsManifest['topDistricts']
  packetRootUrl: string | null
  packetLegacyArtifactUrl: string | null
  csvRootUrl: string | null
  csvLegacyArtifactUrl: string | null
  packetRootPath: string
  packetSummaryPath: string
  packetSummaryRelativePath: string
  packetSummaryUrl: string | null
  packetManifestPath: string
  packetManifestRelativePath: string
  packetManifestUrl: string | null
  csvRootPath: string
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  indexSummaryPath: string
  indexSummaryRelativePath: string
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string
  indexSummaryJsonRelativePath: string
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string
  indexSurfaceRelativePath: string
  indexSurfaceUrl: string | null
  artifactIndexPath: string
  artifactIndexRelativePath: string
  artifactIndexUrl: string | null
  manifestPath: string
  packetPaths: string[]
  csvPaths: string[]
  storageFile: string
  totalCount: number
  filteredCount: number
}): IssueReportWorkflowArtifactsResult => ({
  artifactType: 'issue-report-workflow-artifacts',
  schemaVersion: ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION,
  generatedAt: params.generatedAt,
  outRoot: params.outRoot,
  publishGateSummary: params.publishGateSummary,
  publishGateHotspots: params.publishGateHotspots,
  topDistricts: params.topDistricts,
  ...buildRootCompatArtifactLinks(params),
  packetRootPath: params.packetRootPath,
  packetSummaryPath: params.packetSummaryPath,
  packetSummaryRelativePath: params.packetSummaryRelativePath,
  packetSummaryUrl: params.packetSummaryUrl,
  packetManifestPath: params.packetManifestPath,
  packetManifestRelativePath: params.packetManifestRelativePath,
  packetManifestUrl: params.packetManifestUrl,
  csvRootPath: params.csvRootPath,
  preferredCsvPath: params.preferredCsvPath,
  preferredCsvRelativePath: params.preferredCsvRelativePath,
  preferredCsvUrl: params.preferredCsvUrl,
  summaryPath: params.summaryPath,
  summaryRelativePath: params.summaryRelativePath,
  summaryUrl: params.summaryUrl,
  indexSummaryPath: params.indexSummaryPath,
  indexSummaryRelativePath: params.indexSummaryRelativePath,
  indexSummaryUrl: params.indexSummaryUrl,
  indexSummaryJsonPath: params.indexSummaryJsonPath,
  indexSummaryJsonRelativePath: params.indexSummaryJsonRelativePath,
  indexSummaryJsonUrl: params.indexSummaryJsonUrl,
  indexSurfacePath: params.indexSurfacePath,
  indexSurfaceRelativePath: params.indexSurfaceRelativePath,
  indexSurfaceUrl: params.indexSurfaceUrl,
  artifactIndexPath: params.artifactIndexPath,
  artifactIndexRelativePath: params.artifactIndexRelativePath,
  artifactIndexUrl: params.artifactIndexUrl,
  manifestPath: params.manifestPath,
  packetPaths: params.packetPaths,
  csvPaths: params.csvPaths,
  storageFile: params.storageFile,
  totalCount: params.totalCount,
  filteredCount: params.filteredCount,
})

const writeIssueReportWorkflowArtifactFiles = async (
  artifactResult: IssueReportWorkflowArtifactsResult,
) => {
  await writeFile(
    artifactResult.summaryPath,
    `${renderIssueReportWorkflowArtifactSummary(artifactResult)}\n`,
    'utf8',
  )
  await writeFile(
    artifactResult.manifestPath,
    `${JSON.stringify(artifactResult, null, 2)}\n`,
    'utf8',
  )
  return artifactResult
}

const renderIssueReportWorkflowPublishGateSummary = (
  summary: NightlyPublishGateSummary,
  hotspots: IssueReportWorkflowPublishGateHotspot[],
) => [
  '## Publish Gate',
  '',
  `- Summary: ${summary.summaryPath ? toPortablePath(summary.summaryPath) : '-'}`,
  `- Mode: ${summary.mode}`,
  `- Exit code: ${summary.exitCode}`,
  `- Totals: INFO ${summary.totals.info} / WARN ${summary.totals.warn} / FAIL ${summary.totals.fail}`,
  `- Allow fail: ${summary.allowFail ? 'yes' : 'no'}`,
  `- Override reason: ${summary.overrideReason ?? '-'}`,
  ...(summary.topDistricts.length > 0
    ? [
        '',
        '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Top issue hotspot | Issue hotspot packet | Packet root URL | CSV root URL |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...summary.topDistricts.map(
          (district) => {
            const hotspot =
              hotspots.find((entry) => entry.districtId === district.districtId) ?? null
            const rootLinks = buildRootCompatArtifactLinks({
              packetRootUrl: hotspot?.packetRootUrl ?? null,
              packetLegacyArtifactUrl: hotspot?.packetArtifactUrl ?? null,
              csvRootUrl: hotspot?.csvRootUrl ?? null,
              csvLegacyArtifactUrl: hotspot?.csvArtifactUrl ?? null,
            })
            const packetRootUrl = rootLinks.packetRootUrl
              ? `[artifact](${rootLinks.packetRootUrl})`
              : '-'
            const csvRootUrl = rootLinks.csvRootUrl
              ? `[artifact](${rootLinks.csvRootUrl})`
              : '-'
            return `| ${district.districtId} | ${district.warn} | ${district.fail} | ${district.signOverrideBreakdown?.matchedBySegmentId ?? '-'} | ${district.signOverrideBreakdown?.matchedBySpatial ?? '-'} | ${district.signOverrideBreakdown?.unmatchedNamed ?? '-'} | ${hotspot?.segmentLabel ?? '-'} | ${hotspot?.packetPath ?? '-'} | ${packetRootUrl} | ${csvRootUrl} |`
          },
        ),
      ]
    : []),
  '',
].join('\n')

export const renderIssueReportWorkflowArtifactSummary = (
  result: IssueReportWorkflowArtifactsResult,
) =>
  [
    '# Issue Report Workflow Artifacts',
    '',
    `Manifest schema: ${result.artifactType} v${result.schemaVersion}`,
    `Generated at: ${result.generatedAt}`,
    `Sync store: ${result.storageFile}`,
    `Matching issue reports: ${result.filteredCount}`,
    `Total synced issue reports: ${result.totalCount}`,
    `Workflow summary entry: ${toPortablePath(result.summaryRelativePath)}`,
    ...(result.summaryUrl
      ? [`Workflow summary URL: [download artifact](${result.summaryUrl})`]
      : []),
    `Index summary entry: ${toPortablePath(result.indexSummaryRelativePath)}`,
    ...(result.indexSummaryUrl
      ? [`Index summary URL: [download artifact](${result.indexSummaryUrl})`]
      : []),
    `Index summary json entry: ${toPortablePath(result.indexSummaryJsonRelativePath)}`,
    ...(result.indexSummaryJsonUrl
      ? [`Index summary json URL: [download artifact](${result.indexSummaryJsonUrl})`]
      : []),
    `Index surface entry: ${toPortablePath(result.indexSurfaceRelativePath)}`,
    ...(result.indexSurfaceUrl
      ? [`Index surface URL: [download artifact](${result.indexSurfaceUrl})`]
      : []),
    `Artifact index entry: ${toPortablePath(result.artifactIndexRelativePath)}`,
    ...(result.artifactIndexUrl
      ? [`Artifact index URL: [download artifact](${result.artifactIndexUrl})`]
      : []),
    '',
    ...(result.publishGateSummary
      ? [
          renderIssueReportWorkflowPublishGateSummary(
            result.publishGateSummary,
            result.publishGateHotspots,
          ),
        ]
      : []),
    '## Packet bundle',
    '',
    `- Root: ${toPortablePath(result.packetRootPath)}`,
    `- Index: ${toPortablePath(result.packetSummaryPath)}`,
    `- Index entry: ${toPortablePath(result.packetSummaryRelativePath)}`,
    ...(result.packetSummaryUrl
      ? [`- Index URL: [download artifact](${result.packetSummaryUrl})`]
      : []),
    `- Manifest: ${toPortablePath(result.packetManifestPath)}`,
    `- Manifest entry: ${toPortablePath(result.packetManifestRelativePath)}`,
    ...(result.packetManifestUrl
      ? [`- Manifest URL: [download artifact](${result.packetManifestUrl})`]
      : []),
    ...(result.packetRootUrl
      ? [`- Root URL: [download artifact](${result.packetRootUrl})`]
      : []),
    `- Files: ${result.packetPaths.length}`,
    '',
    '## CSV exports',
    '',
    `- Root: ${toPortablePath(result.csvRootPath)}`,
    ...(result.csvRootUrl
      ? [`- Root URL: [download artifact](${result.csvRootUrl})`]
      : []),
    ...(result.preferredCsvRelativePath
      ? [`- Preferred join file: ${result.preferredCsvRelativePath}`]
      : []),
    ...(result.preferredCsvUrl
      ? [`- Preferred join file URL: [download artifact](${result.preferredCsvUrl})`]
      : []),
    `- Files: ${result.csvPaths.length}`,
  ].join('\n')

export const buildIssueReportWorkflowArtifacts = async (
  args: IssueReportWorkflowArtifactArgs,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<IssueReportWorkflowArtifactsResult> => {
  if (args.manifestPath) {
    const loadedBundle = await loadIssueReportArtifactManifestBundle(args.manifestPath, cwd)
    validateIssueReportArtifactManifestRelations(loadedBundle)

    const workflowManifest = assertIssueReportArtifactManifestKind(
      loadedBundle.rootManifest,
      'workflow',
    )
    const rootLinks = buildRootCompatArtifactLinks({
      packetRootUrl: args.packetRootUrl ?? workflowManifest.packetRootUrl,
      packetLegacyArtifactUrl: workflowManifest.packetArtifactUrl,
      csvRootUrl: args.csvRootUrl ?? workflowManifest.csvRootUrl,
      csvLegacyArtifactUrl: workflowManifest.csvArtifactUrl,
    })
    const packetBundle = await loadIssueReportTriagePacketBundle(
      workflowManifest.packetManifestPath,
      cwd,
    )
    const packetRootUrl = rootLinks.packetRootUrl
    const csvRootUrl = rootLinks.csvRootUrl
    const csvWrite: IssueReportSummaryCsvWriteResult = packetBundle.csvWrite ?? {
      rootPath: workflowManifest.csvRootPath,
      filePaths: workflowManifest.csvPaths,
    }

    const packetWrite = await writeIssueReportTriagePacketBundle(
      workflowManifest.packetRootPath,
      packetBundle.bundle,
      {
        packetRootUrl,
        csvWrite,
        csvRootUrl,
      },
      cwd,
    )
    const generatedAt = new Date().toISOString()
    const publishGateHotspots = buildIssueReportWorkflowPublishGateHotspots({
      publishGateSummary: workflowManifest.publishGateSummary,
      segmentEntries: packetWrite.segmentEntries,
      packetRootUrl,
      packetLegacyArtifactUrl: workflowManifest.packetArtifactUrl,
      csvRootUrl,
      csvLegacyArtifactUrl: workflowManifest.csvArtifactUrl,
    })
    const preferredCsvPath = pickPreferredCsvPath(csvWrite.filePaths)
    const packetSummaryRelativePath = toPortablePath(
      relative(packetWrite.rootPath, packetWrite.summaryPath),
    )
    const packetManifestRelativePath = toPortablePath(
      relative(packetWrite.rootPath, packetWrite.manifestPath),
    )
    const preferredCsvRelativePath =
      preferredCsvPath ? relative(csvWrite.rootPath, preferredCsvPath).replace(/\\/g, '/') : null
    const {
      packetSummaryUrl,
      packetManifestUrl,
      preferredCsvUrl,
    } = resolveIssueReportArtifactBundleUrls({
      packetRootUrl,
      csvRootUrl,
      preferredCsvUrl: null,
      preferredCsvRelativePath,
      packetSummaryUrl: null,
      packetSummaryRelativePath,
      packetManifestUrl: null,
      packetManifestRelativePath,
    })

    return writeIssueReportWorkflowArtifactFiles(
      createIssueReportWorkflowArtifactsResult({
        generatedAt,
        outRoot: workflowManifest.outRoot,
        publishGateSummary: workflowManifest.publishGateSummary,
        publishGateHotspots,
        topDistricts: workflowManifest.topDistricts,
        packetRootUrl,
        packetLegacyArtifactUrl: workflowManifest.packetArtifactUrl,
        csvRootUrl,
        csvLegacyArtifactUrl: workflowManifest.csvArtifactUrl,
        packetRootPath: packetWrite.rootPath,
        packetSummaryPath: packetWrite.summaryPath,
        packetSummaryRelativePath,
        packetSummaryUrl,
        packetManifestPath: packetWrite.manifestPath,
        packetManifestRelativePath,
        packetManifestUrl,
        csvRootPath: csvWrite.rootPath,
        preferredCsvPath,
        preferredCsvRelativePath,
        preferredCsvUrl,
        summaryPath: workflowManifest.summaryPath,
        summaryRelativePath: workflowManifest.summaryRelativePath,
        summaryUrl:
          args.indexBaseUrl
            ? joinIssueReportBaseUrl(args.indexBaseUrl, workflowManifest.summaryRelativePath)
            : workflowManifest.summaryUrl,
        indexSummaryPath: workflowManifest.indexSummaryPath,
        indexSummaryRelativePath: workflowManifest.indexSummaryRelativePath,
        indexSummaryUrl:
          args.indexBaseUrl
            ? joinIssueReportBaseUrl(args.indexBaseUrl, workflowManifest.indexSummaryRelativePath)
            : workflowManifest.indexSummaryUrl,
        indexSummaryJsonPath: workflowManifest.indexSummaryJsonPath,
        indexSummaryJsonRelativePath: workflowManifest.indexSummaryJsonRelativePath,
        indexSummaryJsonUrl:
          args.indexBaseUrl
            ? joinIssueReportBaseUrl(
                args.indexBaseUrl,
                workflowManifest.indexSummaryJsonRelativePath,
              )
            : workflowManifest.indexSummaryJsonUrl,
        indexSurfacePath: workflowManifest.indexSurfacePath,
        indexSurfaceRelativePath: workflowManifest.indexSurfaceRelativePath,
        indexSurfaceUrl:
          args.indexBaseUrl
            ? joinIssueReportBaseUrl(args.indexBaseUrl, workflowManifest.indexSurfaceRelativePath)
            : workflowManifest.indexSurfaceUrl,
        artifactIndexPath: workflowManifest.artifactIndexPath,
        artifactIndexRelativePath: workflowManifest.artifactIndexRelativePath,
        artifactIndexUrl:
          args.indexBaseUrl
            ? joinIssueReportBaseUrl(
                args.indexBaseUrl,
                workflowManifest.artifactIndexRelativePath,
              )
            : workflowManifest.artifactIndexUrl,
        manifestPath: workflowManifest.manifestPath,
        packetPaths: [
          packetWrite.summaryPath,
          packetWrite.manifestPath,
          ...packetWrite.segmentPacketPaths,
          ...packetWrite.reasonPacketPaths,
        ],
        csvPaths: csvWrite.filePaths,
        storageFile: workflowManifest.storageFile,
        totalCount: workflowManifest.totalCount,
        filteredCount: workflowManifest.filteredCount,
      }),
    )
  }

  const result = await loadIssueReportSummary(
    {
      syncStorePath: args.syncStorePath,
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: args.limit,
    },
    env,
    cwd,
  )

  const publishGateSummary = await loadNightlyPublishGateSummary(
    args.publishGateSummaryPath,
    cwd,
  )
  const packetBundle = buildIssueReportTriagePacketBundle(
    result,
    args.packetIssueLimit,
    publishGateSummary,
  )
  const csvWrite = await writeIssueReportSummaryCsvFiles(
    join(args.outRoot, 'csv'),
    result,
    publishGateSummary,
    cwd,
  )
  const packetWrite = await writeIssueReportTriagePacketBundle(
    join(args.outRoot, 'packets'),
    packetBundle,
    {
      packetRootUrl: args.packetRootUrl,
      csvWrite,
      csvRootUrl: args.csvRootUrl,
    },
    cwd,
  )
  const outRoot = resolve(cwd, args.outRoot)
  const generatedAt = new Date().toISOString()
  const rootLinks = buildRootCompatArtifactLinks({
    packetRootUrl: args.packetRootUrl,
    packetLegacyArtifactUrl: null,
    csvRootUrl: args.csvRootUrl,
    csvLegacyArtifactUrl: null,
  })

  const publishGateHotspots = buildIssueReportWorkflowPublishGateHotspots({
    publishGateSummary,
    segmentEntries: packetWrite.segmentEntries,
    packetRootUrl: rootLinks.packetRootUrl,
    packetLegacyArtifactUrl: null,
    csvRootUrl: rootLinks.csvRootUrl,
    csvLegacyArtifactUrl: null,
  })
  const preferredCsvPath = pickPreferredCsvPath(csvWrite.filePaths)
  const packetSummaryRelativePath = toPortablePath(
    relative(packetWrite.rootPath, packetWrite.summaryPath),
  )
  const packetManifestRelativePath = toPortablePath(
    relative(packetWrite.rootPath, packetWrite.manifestPath),
  )
  const preferredCsvRelativePath =
    preferredCsvPath ? relative(csvWrite.rootPath, preferredCsvPath).replace(/\\/g, '/') : null
  const {
    packetSummaryUrl,
    packetManifestUrl,
    preferredCsvUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: rootLinks.packetRootUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    preferredCsvUrl: null,
    preferredCsvRelativePath,
    packetSummaryUrl: null,
    packetSummaryRelativePath,
    packetManifestUrl: null,
    packetManifestRelativePath,
  })

  return writeIssueReportWorkflowArtifactFiles(
    createIssueReportWorkflowArtifactsResult({
      generatedAt,
      outRoot,
      publishGateSummary,
      publishGateHotspots,
      topDistricts: result.topDistricts,
      packetRootUrl: rootLinks.packetRootUrl,
      packetLegacyArtifactUrl: null,
      csvRootUrl: rootLinks.csvRootUrl,
      csvLegacyArtifactUrl: null,
      packetRootPath: packetWrite.rootPath,
      packetSummaryPath: packetWrite.summaryPath,
      packetSummaryRelativePath,
      packetSummaryUrl,
      packetManifestPath: packetWrite.manifestPath,
      packetManifestRelativePath,
      packetManifestUrl,
      csvRootPath: csvWrite.rootPath,
      preferredCsvPath,
      preferredCsvRelativePath,
      preferredCsvUrl,
      summaryPath: join(outRoot, 'summary.md'),
      summaryRelativePath: 'summary.md',
      summaryUrl: joinIssueReportBaseUrl(args.indexBaseUrl ?? null, 'summary.md'),
      indexSummaryPath: join(outRoot, 'index-summary.md'),
      indexSummaryRelativePath: 'index-summary.md',
      indexSummaryUrl: joinIssueReportBaseUrl(args.indexBaseUrl ?? null, 'index-summary.md'),
      indexSummaryJsonPath: join(outRoot, 'index-summary.json'),
      indexSummaryJsonRelativePath: 'index-summary.json',
      indexSummaryJsonUrl: joinIssueReportBaseUrl(args.indexBaseUrl ?? null, 'index-summary.json'),
      indexSurfacePath: join(outRoot, 'index-surface.json'),
      indexSurfaceRelativePath: 'index-surface.json',
      indexSurfaceUrl: joinIssueReportBaseUrl(args.indexBaseUrl ?? null, 'index-surface.json'),
      artifactIndexPath: join(outRoot, 'artifact-index.json'),
      artifactIndexRelativePath: 'artifact-index.json',
      artifactIndexUrl: joinIssueReportBaseUrl(args.indexBaseUrl ?? null, 'artifact-index.json'),
      manifestPath: join(outRoot, 'manifest.json'),
      packetPaths: [
        packetWrite.summaryPath,
        packetWrite.manifestPath,
        ...packetWrite.segmentPacketPaths,
        ...packetWrite.reasonPacketPaths,
      ],
      csvPaths: csvWrite.filePaths,
      storageFile: result.storageFile,
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
    }),
  )
}

const run = async () => {
  const args = parseIssueReportWorkflowArtifactArgs(process.argv)
  const result = await buildIssueReportWorkflowArtifacts(args)

  console.log(`Wrote workflow issue report packets to ${result.packetRootPath}`)
  console.log(`Wrote workflow issue report csv exports to ${result.csvRootPath}`)
  console.log(`Wrote workflow issue report summary to ${result.summaryPath}`)
  console.log(`Issue report sync store: ${result.storageFile}`)
  console.log(
    `Issue report totals: ${result.filteredCount} matching / ${result.totalCount} total`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
