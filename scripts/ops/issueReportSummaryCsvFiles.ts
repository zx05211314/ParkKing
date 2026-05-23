import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { buildIssueReportPublishGateHotspots } from './issueReportSummaryHotspots'
import type {
  IssueReportSummaryResult,
} from './issueReportSummaryTypes'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'

export interface IssueReportSummaryCsvWriteResult {
  rootPath: string
  filePaths: string[]
}

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

const toCsvRow = (cells: Array<string | number | boolean | null>) =>
  cells
    .map((cell) =>
      escapeCsvCell(
        typeof cell === 'string'
          ? cell
          : typeof cell === 'number' || typeof cell === 'boolean'
            ? String(cell)
            : '',
      ),
    )
    .join(',')

const segmentLabel = (params: { segmentName: string | null; segmentId: string | null }) =>
  params.segmentName && params.segmentId
    ? `${params.segmentName} (${params.segmentId})`
    : params.segmentName ?? params.segmentId ?? ''

const latestLocationLabel = (params: {
  latestDistrictId: string | null
  latestSegmentId: string | null
  latestSegmentName: string | null
}) =>
  params.latestSegmentName && params.latestSegmentId
    ? `${params.latestDistrictId ?? ''} / ${params.latestSegmentName} (${params.latestSegmentId})`
    : params.latestSegmentId
      ? `${params.latestDistrictId ?? ''} / ${params.latestSegmentId}`
      : params.latestDistrictId ?? ''

const renderDistrictCsv = (result: IssueReportSummaryResult) =>
  [
    toCsvRow(['scope', 'district_id', 'count', 'latest_created_at', 'latest_summary']),
    ...result.topDistricts.map((summary) =>
      toCsvRow([
        summary.scope,
        summary.districtId,
        summary.count,
        summary.latestCreatedAt,
        summary.latestSummary,
      ]),
    ),
  ].join('\n')

const renderLatestDistrictCsv = (result: IssueReportSummaryResult) =>
  [
    toCsvRow(['scope', 'district_id', 'latest_created_at', 'count', 'latest_summary']),
    ...result.latestDistricts.map((summary) =>
      toCsvRow([
        summary.scope,
        summary.districtId,
        summary.latestCreatedAt,
        summary.count,
        summary.latestSummary,
      ]),
    ),
  ].join('\n')

const renderSegmentCsv = (result: IssueReportSummaryResult) =>
  [
    toCsvRow([
      'scope',
      'district_id',
      'segment_id',
      'segment_label',
      'segment_tier',
      'count',
      'latest_created_at',
      'latest_summary',
    ]),
    ...result.topSegments.map((summary) =>
      toCsvRow([
        summary.scope,
        summary.districtId,
        summary.segmentId,
        segmentLabel(summary),
        summary.segmentTier,
        summary.count,
        summary.latestCreatedAt,
        summary.latestSummary,
      ]),
    ),
  ].join('\n')

const renderReasonCsv = (result: IssueReportSummaryResult) =>
  [
    toCsvRow([
      'reason_code',
      'count',
      'district_count',
      'segment_count',
      'latest_created_at',
      'latest_location',
    ]),
    ...result.topReasons.map((summary) =>
      toCsvRow([
        summary.reasonCode,
        summary.count,
        summary.districtCount,
        summary.segmentCount,
        summary.latestCreatedAt,
        latestLocationLabel(summary),
      ]),
    ),
  ].join('\n')

const renderIssueCsv = (result: IssueReportSummaryResult) =>
  [
    toCsvRow([
      'created_at',
      'scope',
      'district_id',
      'segment_id',
      'segment_label',
      'segment_tier',
      'allowed_now',
      'report_hhmm',
      'reason_codes',
      'summary',
    ]),
    ...result.issues.map((issue) =>
      toCsvRow([
        issue.createdAt,
        issue.scope,
        issue.districtId,
        issue.segmentId,
        segmentLabel(issue),
        issue.segmentTier,
        issue.allowedNow,
        issue.reportHhmm,
        issue.reasonCodes.join('|'),
        issue.summary,
      ]),
    ),
  ].join('\n')

const renderPublishGateDistrictCsv = (
  result: IssueReportSummaryResult,
  publishGateSummary: NightlyPublishGateSummary,
) =>
  [
    toCsvRow([
      'district_id',
      'warn',
      'fail',
      'top_warn_codes',
      'top_fail_codes',
      'direct_override_matches',
      'spatial_override_matches',
      'unmatched_named_overrides',
      'issue_hotspot_segment_id',
      'issue_hotspot_segment_name',
      'issue_hotspot_segment_label',
    ]),
    ...buildIssueReportPublishGateHotspots(result.topSegments, publishGateSummary).map((entry) =>
      toCsvRow([
        entry.districtId,
        entry.warn,
        entry.fail,
        entry.topWarnCodes.join('|'),
        entry.topFailCodes.join('|'),
        entry.directOverrideMatches,
        entry.spatialOverrideMatches,
        entry.unmatchedNamedOverrides,
        entry.issueHotspotSegmentId,
        entry.issueHotspotSegmentName,
        entry.issueHotspotSegmentLabel,
      ]),
    ),
  ].join('\n')

export const writeIssueReportSummaryCsvFiles = async (
  outPath: string,
  result: IssueReportSummaryResult,
  publishGateSummary: NightlyPublishGateSummary | null = null,
  cwd = process.cwd(),
): Promise<IssueReportSummaryCsvWriteResult> => {
  const rootPath = resolve(cwd, outPath)
  await mkdir(rootPath, { recursive: true })

  const files = [
    { fileName: 'top-districts.csv', content: renderDistrictCsv(result) },
    { fileName: 'latest-districts.csv', content: renderLatestDistrictCsv(result) },
    { fileName: 'top-segments.csv', content: renderSegmentCsv(result) },
    { fileName: 'top-reasons.csv', content: renderReasonCsv(result) },
    { fileName: 'recent-issues.csv', content: renderIssueCsv(result) },
    ...(publishGateSummary
      ? [
          {
            fileName: 'publish-gate-districts.csv',
            content: renderPublishGateDistrictCsv(result, publishGateSummary),
          },
        ]
      : []),
  ]

  const filePaths = await Promise.all(
    files.map(async ({ fileName, content }) => {
      const filePath = join(rootPath, fileName)
      await writeFile(filePath, `${content}\n`, 'utf8')
      return filePath
    }),
  )

  return {
    rootPath,
    filePaths,
  }
}
