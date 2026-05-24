import { formatMetaDate } from './displayFormatting'
import { resolveIssueReportSyncConfig } from '../feedback/issueReports'
import {
  ISSUE_REPORT_DEBUG_BUNDLE_NOTE,
  ISSUE_REPORT_SYNC_DEVICE_ONLY_LABEL,
  ISSUE_REPORT_SYNC_DEVICE_ONLY_NOTE,
  ISSUE_REPORT_SYNC_UPLOAD_ONLY_LABEL,
  ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE,
} from './issueReportSyncPresentation'
import type {
  BuildHeaderStatusPanelsPropsOptions,
  DatasetStatusPanelProps,
} from './buildHeaderStatusPanelsTypes'

export const buildDatasetStatusPanelProps = ({
  mode,
  districtName,
  schemaVersion,
  segmentsCount,
  inferredCount,
  overrideCount,
  signOverrideMatchedSegmentCount,
  signOverrideSpatialMatchCount,
  signOverrideUnmatchedNamedCount,
  zonesCount,
  intersectionCount,
  crosswalkCount,
  parkingSpaceCount,
  builtAtValue,
  evaluationStatus,
  datasetStatus,
  issueReportStatus,
  reportingIssue,
  clipCacheStats,
  onReportIssue,
  onExportReports,
  onOpenInfo,
}: BuildHeaderStatusPanelsPropsOptions): DatasetStatusPanelProps => {
  const issueReportsEndpoint = resolveIssueReportSyncConfig().endpoint

  return {
    districtName,
    schemaVersion,
    segmentsCount,
    inferredCount,
    overrideCount,
    signOverrideMatchedSegmentCount,
    signOverrideSpatialMatchCount,
    signOverrideUnmatchedNamedCount,
    zonesCount,
    intersectionCount,
    crosswalkCount,
    parkingSpaceCount,
    modeLabel: mode === 'NOW' ? 'Day' : 'Night',
    builtAtLabel: formatMetaDate(builtAtValue),
    evaluationStatus,
    clipCacheSummary: clipCacheStats
      ? `hits ${clipCacheStats.hits} | misses ${clipCacheStats.misses} | size ${clipCacheStats.size}`
      : '-',
    datasetStatus,
    issueReportSyncLabel: issueReportsEndpoint
      ? ISSUE_REPORT_SYNC_UPLOAD_ONLY_LABEL
      : ISSUE_REPORT_SYNC_DEVICE_ONLY_LABEL,
    issueReportSyncNote: issueReportsEndpoint
      ? ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE
      : ISSUE_REPORT_SYNC_DEVICE_ONLY_NOTE,
    issueReportDebugBundleNote: ISSUE_REPORT_DEBUG_BUNDLE_NOTE,
    issueReportStatus,
    reportingIssue,
    onReportIssue,
    onExportReports,
    onOpenInfo,
  }
}
